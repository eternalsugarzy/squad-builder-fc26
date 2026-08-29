import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useProfile } from '@/src/contexts/ProfileContext';
import {
  listPositions,
  createPosition,
  updatePosition,
  deletePosition,
  ensureStandardPositions,
} from '@/src/services/positionService';
import { listPlaystyles } from '@/src/services/playstyleService';
import { listPlayers } from '@/src/services/playerService';
import {
  listFormations,
  FC26_PRESET_TEMPLATES,
  type FormationWithSlots,
} from '@/src/services/formationService';
import { PitchCanvas, type PitchSlotItem } from '@/src/components/PitchCanvas';
import { PlayerPickerModal } from '@/src/components/PlayerPickerModal';
import type { Position, Playstyle, PlayerWithPositions } from '@/src/types';

type Section = 'formations' | 'positions' | 'playstyles';

export default function FormationsScreen() {
  const { activeProfile } = useProfile();
  const [activeSection, setActiveSection] = useState<Section>('formations');

  // Positions state
  const [positions, setPositions] = useState<Position[]>([]);
  const [posLoading, setPosLoading] = useState(true);
  const [showPosModal, setShowPosModal] = useState(false);
  const [posEditTarget, setPosEditTarget] = useState<Position | null>(null);
  const [posName, setPosName] = useState('');

  // Playstyles state
  const [playstyles, setPlaystyles] = useState<Playstyle[]>([]);
  const [psLoading, setPsLoading] = useState(true);

  // Formations state
  const [formations, setFormations] = useState<FormationWithSlots[]>([]);
  const [fLoading, setFLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<'All' | '4-Back' | '3-Back' | '5-Back'>('All');

  // Players for Simulation
  const [allPlayers, setAllPlayers] = useState<PlayerWithPositions[]>([]);

  // Pitch Viewer & Tactical Simulator Modal State
  const [viewingFormation, setViewingFormation] = useState<FormationWithSlots | null>(null);
  const [modalTab, setModalTab] = useState<'pitch' | 'simulation'>('pitch');
  const [simLineup, setSimLineup] = useState<Record<string, PlayerWithPositions | null>>({});

  // Player Picker for Manual Slot Placement
  const [pickerSlotId, setPickerSlotId] = useState<string | null>(null);
  const [showPlayerPicker, setShowPlayerPicker] = useState(false);

  const loadData = useCallback(async () => {
    if (!activeProfile) return;
    setPosLoading(true);
    setPsLoading(true);
    setFLoading(true);
    try {
      const [posData, psData, fData, pData] = await Promise.all([
        listPositions(activeProfile.id),
        listPlaystyles(activeProfile.id),
        listFormations(activeProfile.id),
        listPlayers(activeProfile.id),
      ]);
      setPositions(posData);
      setPlaystyles(psData);
      setFormations(fData);
      setAllPlayers(pData);
    } catch (e) {
      console.error('Error loading formations tab data:', e);
    } finally {
      setPosLoading(false);
      setPsLoading(false);
      setFLoading(false);
    }
  }, [activeProfile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reset simulation when opening a formation
  function handleOpenFormation(formation: FormationWithSlots) {
    setViewingFormation(formation);
    setModalTab('pitch');
    setSimLineup({});
  }

  // ─── POSISI HANDLERS ──────────────────────────────
  function openAddPosition() {
    setPosEditTarget(null);
    setPosName('');
    setShowPosModal(true);
  }

  function openEditPosition(pos: Position) {
    setPosEditTarget(pos);
    setPosName(pos.nama);
    setShowPosModal(true);
  }

  async function handleSavePosition() {
    if (!activeProfile) return;
    const trimmed = posName.trim().toUpperCase();
    if (!trimmed) {
      Alert.alert('Error', 'Nama posisi tidak boleh kosong');
      return;
    }

    try {
      if (posEditTarget) {
        await updatePosition(posEditTarget.id, trimmed);
      } else {
        await createPosition(activeProfile.id, trimmed);
      }
      setShowPosModal(false);
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Gagal menyimpan posisi');
    }
  }

  function handleDeletePosition(pos: Position) {
    Alert.alert(
      'Hapus Posisi',
      `Hapus posisi ${pos.nama}? Formasi dan pemain yang memakai posisi ini mungkin terpengaruh.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePosition(pos.id);
              loadData();
            } catch (e) {
              Alert.alert('Error', 'Gagal menghapus posisi');
            }
          },
        },
      ]
    );
  }

  // ─── TACTICAL FIT & SIMULATION ALGORITHM ───────────
  function handleAutoFillSimulation() {
    if (!viewingFormation) return;

    const activeAvailable = allPlayers.filter(
      (p) => p.status === 'aktif' || p.status === 'akan_dijual'
    );
    const usedIds = new Set<string>();
    const newLineup: Record<string, PlayerWithPositions | null> = {};

    // Sort slots so specialized positions get first priority (GK, CB, ST, etc.)
    for (const slot of viewingFormation.slots) {
      const posName = slot.position_nama.toUpperCase();

      // 1. First priority: Matching Primary Position (Rank 1)
      let candidate = activeAvailable
        .filter((p) => !usedIds.has(p.id))
        .filter((p) => p.positions[0]?.nama.toUpperCase() === posName)
        .sort((a, b) => b.ovr_current - a.ovr_current)[0];

      // 2. Second priority: Matching Secondary Position (Rank > 1)
      if (!candidate) {
        candidate = activeAvailable
          .filter((p) => !usedIds.has(p.id))
          .filter((p) => p.positions.slice(1).some((pos) => pos.nama.toUpperCase() === posName))
          .sort((a, b) => b.ovr_current - a.ovr_current)[0];
      }

      // 3. Third priority: Compatible position fallback
      if (!candidate) {
        candidate = activeAvailable
          .filter((p) => !usedIds.has(p.id))
          .filter((p) => {
            if (posName === 'GK') return p.positions.some((pp) => pp.nama === 'GK');
            if (['LB', 'LWB', 'RB', 'RWB', 'CB'].includes(posName)) {
              return p.positions.some((pp) => ['LB', 'LWB', 'RB', 'RWB', 'CB'].includes(pp.nama));
            }
            if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(posName)) {
              return p.positions.some((pp) => ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(pp.nama));
            }
            if (['ST', 'CF', 'LW', 'RW', 'LF', 'RF'].includes(posName)) {
              return p.positions.some((pp) => ['ST', 'CF', 'LW', 'RW', 'LF', 'RF'].includes(pp.nama));
            }
            return true;
          })
          .sort((a, b) => b.ovr_current - a.ovr_current)[0];
      }

      if (candidate) {
        usedIds.add(candidate.id);
        newLineup[slot.id] = candidate;
      } else {
        newLineup[slot.id] = null;
      }
    }

    setSimLineup(newLineup);
  }

  // Calculate Tactical Fit Analysis
  const fitAnalysis = useMemo(() => {
    if (!viewingFormation) return null;

    const slots = viewingFormation.slots;
    let filledCount = 0;
    let naturalMatchCount = 0;
    let secondaryMatchCount = 0;
    let outOfPosCount = 0;
    let totalOvr = 0;
    const warnings: string[] = [];
    const strengths: string[] = [];

    for (const s of slots) {
      const player = simLineup[s.id];
      if (!player) continue;

      filledCount++;
      totalOvr += player.ovr_current;
      const targetPos = s.position_nama.toUpperCase();
      const primaryPos = player.positions[0]?.nama.toUpperCase();
      const hasSecPos = player.positions.slice(1).some((p) => p.nama.toUpperCase() === targetPos);

      if (primaryPos === targetPos) {
        naturalMatchCount++;
      } else if (hasSecPos) {
        secondaryMatchCount++;
        warnings.push(`${player.nama} di ${s.slot_label} (Posisi Sekunder)`);
      } else {
        outOfPosCount++;
        warnings.push(`⚠️ ${player.nama} bukan pemain asli ${s.slot_label} (${primaryPos ?? '-'})`);
      }
    }

    const avgOvr = filledCount > 0 ? Math.round(totalOvr / filledCount) : 0;
    let score = 0;

    if (filledCount > 0) {
      const naturalRatio = naturalMatchCount / 11;
      const secondaryRatio = secondaryMatchCount / 11;
      const filledRatio = filledCount / 11;

      score = Math.round((naturalRatio * 70 + secondaryRatio * 40 + filledRatio * 30));
      score = Math.min(100, Math.max(10, score));
    }

    if (naturalMatchCount >= 9) {
      strengths.push('🔥 Formasi sangat natural! Sebagian besar pemain bermain di posisi aslinya.');
    } else if (naturalMatchCount >= 7) {
      strengths.push('✅ Komposisi skuad seimbang dan cocok untuk dimainkan.');
    }

    if (filledCount < 11) {
      warnings.unshift(`Slot belum terisi penuh (${filledCount}/11).`);
    }

    let verdict = 'Belum Ada Pemain';
    let verdictColor = '#666';
    let verdictBg = '#F0F0F0';

    if (filledCount > 0) {
      if (score >= 85) {
        verdict = 'SANGAT COCOK 🔥';
        verdictColor = '#137333';
        verdictBg = '#E6F4EA';
      } else if (score >= 70) {
        verdict = 'COCOK ✓';
        verdictColor = '#137333';
        verdictBg = '#E6F4EA';
      } else if (score >= 50) {
        verdict = 'CUKUP COCOK ⚠️';
        verdictColor = '#B06000';
        verdictBg = '#FEF7E0';
      } else {
        verdict = 'KURANG COCOK ❌';
        verdictColor = '#C5221F';
        verdictBg = '#FCE8E6';
      }
    }

    return {
      filledCount,
      avgOvr,
      score,
      verdict,
      verdictColor,
      verdictBg,
      naturalMatchCount,
      secondaryMatchCount,
      outOfPosCount,
      strengths,
      warnings,
    };
  }, [viewingFormation, simLineup]);

  const assignedSimPlayerIds = useMemo(() => {
    const set = new Set<string>();
    for (const p of Object.values(simLineup)) {
      if (p) set.add(p.id);
    }
    return set;
  }, [simLineup]);

  const currentPickerSlot = viewingFormation?.slots.find((s) => s.id === pickerSlotId);

  // Pitch Slots mapping for PitchCanvas
  const pitchSlots: PitchSlotItem[] = useMemo(() => {
    if (!viewingFormation) return [];

    return viewingFormation.slots.map((s) => {
      const simPlayer = simLineup[s.id];

      if (modalTab === 'simulation' && simPlayer) {
        const isNatural = simPlayer.positions[0]?.nama.toUpperCase() === s.position_nama.toUpperCase();
        return {
          id: s.id,
          coord_x: s.coord_x,
          coord_y: s.coord_y,
          label: s.slot_label,
          positionName: s.position_nama,
          playerName: simPlayer.nama,
          playerOvr: simPlayer.ovr_current,
          statusBadge: isNatural ? undefined : '⚠️',
          statusColor: isNatural ? undefined : '#B06000',
        };
      }

      return {
        id: s.id,
        coord_x: s.coord_x,
        coord_y: s.coord_y,
        label: s.slot_label,
        positionName: s.position_nama,
      };
    });
  }, [viewingFormation, simLineup, modalTab]);

  const filteredFormations = formations.filter((f) => {
    if (selectedCategory === 'All') return true;
    const template = FC26_PRESET_TEMPLATES.find((t) => t.name === f.nama_formasi);
    if (template) {
      return template.category === selectedCategory;
    }
    if (selectedCategory === '4-Back') return f.nama_formasi.startsWith('4');
    if (selectedCategory === '3-Back') return f.nama_formasi.startsWith('3');
    if (selectedCategory === '5-Back') return f.nama_formasi.startsWith('5');
    return true;
  });

  return (
    <View style={styles.container}>
      {/* ─── Top Sub-Nav Segment Tabs ─────────────── */}
      <View style={styles.subTabBar}>
        <TouchableOpacity
          style={[styles.subTab, activeSection === 'formations' && styles.subTabActive]}
          onPress={() => setActiveSection('formations')}
          activeOpacity={0.8}>
          <Text style={[styles.subTabText, activeSection === 'formations' && styles.subTabTextActive]}>
            FORMASI ({formations.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.subTab, activeSection === 'positions' && styles.subTabActive]}
          onPress={() => setActiveSection('positions')}
          activeOpacity={0.8}>
          <Text style={[styles.subTabText, activeSection === 'positions' && styles.subTabTextActive]}>
            POSISI ({positions.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.subTab, activeSection === 'playstyles' && styles.subTabActive]}
          onPress={() => setActiveSection('playstyles')}
          activeOpacity={0.8}>
          <Text style={[styles.subTabText, activeSection === 'playstyles' && styles.subTabTextActive]}>
            PLAYSTYLE ({playstyles.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* ─── FORMASI SECTION (COMPACT LIST) ─────────── */}
      {activeSection === 'formations' && (
        <View style={styles.sectionContent}>
          {/* Header Banner */}
          <View style={styles.catalogHeader}>
            <Text style={styles.catalogTitle}>DAFTAR 24 FORMASI RESMI FC 26</Text>
            <Text style={styles.catalogSub}>
              Tap salah satu formasi untuk melihat skema lapangan dan menguji kecocokan skuad pemain Anda.
            </Text>
          </View>

          {/* Category Filter Pills */}
          <View style={styles.catFilterBar}>
            {(['All', '4-Back', '3-Back', '5-Back'] as const).map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.catFilterChip, selectedCategory === cat && styles.catFilterChipActive]}
                onPress={() => setSelectedCategory(cat)}>
                <Text style={[styles.catFilterText, selectedCategory === cat && styles.catFilterTextActive]}>
                  {cat === 'All' ? `SEMUA (${formations.length})` : cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {fLoading ? (
            <ActivityIndicator size="large" color="#0A1128" style={{ marginTop: 40 }} />
          ) : filteredFormations.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptySectionText}>Belum ada formasi</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
              {filteredFormations.map((f, idx) => {
                const template = FC26_PRESET_TEMPLATES.find((t) => t.name === f.nama_formasi);
                const positionsSummary = f.slots.map((s) => s.slot_label).join(' • ');

                return (
                  <TouchableOpacity
                    key={f.id}
                    style={styles.simpleFormationCard}
                    onPress={() => handleOpenFormation(f)}
                    activeOpacity={0.8}>
                    <View style={styles.simpleCardHeader}>
                      <View style={styles.formationNumBadge}>
                        <Text style={styles.formationNumText}>#{idx + 1}</Text>
                      </View>
                      <Text style={styles.simpleFormationTitle}>{f.nama_formasi}</Text>
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryBadgeText}>{template?.category ?? 'Taktik'}</Text>
                      </View>
                    </View>

                    <Text style={styles.simpleSlotsSummary} numberOfLines={1}>
                      {positionsSummary}
                    </Text>

                    <View style={styles.viewPitchBtn}>
                      <Text style={styles.viewPitchBtnText}>👁️ LIHAT LAPANGAN & UJI KECOCOKAN ➔</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

      {/* ─── POSISI SECTION ──────────────────────────── */}
      {activeSection === 'positions' && (
        <View style={styles.sectionContent}>
          {/* Top Action Banner */}
          <View style={styles.topActionBar}>
            <TouchableOpacity style={styles.topActionBtn} onPress={openAddPosition} activeOpacity={0.8}>
              <Text style={styles.topActionBtnText}>+ TAMBAH POSISI BARU</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.topActionBtn, { backgroundColor: '#F0F4FF', marginTop: 6 }]}
              onPress={async () => {
                if (!activeProfile) return;
                await ensureStandardPositions(activeProfile.id);
                loadData();
                Alert.alert('Sukses 🎉', 'Semua 17 posisi standar FC 26 telah dipastikan ada di profil ini!');
              }}
              activeOpacity={0.8}>
              <Text style={[styles.topActionBtnText, { color: '#0A1128' }]}>
                ⚡ Lengkapi 17 Posisi FC 26
              </Text>
            </TouchableOpacity>
          </View>

          {posLoading ? (
            <ActivityIndicator size="large" color="#0A1128" style={{ marginTop: 40 }} />
          ) : positions.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptySectionText}>Belum ada posisi</Text>
              <Text style={styles.emptyHint}>Tap tombol di atas untuk menambah posisi baru.</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
              {positions.map((pos) => (
                <View key={pos.id} style={styles.listItem}>
                  <View style={styles.posIconBadge}>
                    <Text style={styles.posIconText}>{pos.nama}</Text>
                  </View>
                  <Text style={styles.listItemName}>{pos.nama}</Text>
                  <View style={styles.listItemActions}>
                    <TouchableOpacity style={styles.listItemBtn} onPress={() => openEditPosition(pos)}>
                      <Text style={styles.listItemBtnText}>✏️ Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.listItemBtn, { borderColor: '#C5221F' }]}
                      onPress={() => handleDeletePosition(pos)}>
                      <Text style={[styles.listItemBtnText, { color: '#C5221F' }]}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* ─── PLAYSTYLE SECTION (TACTICAL GUIDE) ───────── */}
      {activeSection === 'playstyles' && (
        <View style={styles.sectionContent}>
          <View style={styles.playstyleBanner}>
            <Text style={styles.playstyleBannerTitle}>TACTICAL VISIONS FC 26 (DEFAULT)</Text>
            <Text style={styles.playstyleBannerSub}>
              8 Visi Taktis resmi bawaan game FC 26 otomatis tersedia untuk dipilih di setiap tim sheet.
            </Text>
          </View>

          {psLoading ? (
            <ActivityIndicator size="large" color="#0A1128" style={{ marginTop: 40 }} />
          ) : (
            <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
              {playstyles.map((ps, idx) => (
                <View key={ps.id} style={styles.playstyleCard}>
                  <View style={styles.playstyleCardHeader}>
                    <View style={styles.playstyleNumBadge}>
                      <Text style={styles.playstyleNumText}>#{idx + 1}</Text>
                    </View>
                    <Text style={styles.playstyleName}>{ps.nama}</Text>
                  </View>
                  {ps.catatan ? (
                    <Text style={styles.playstyleCatatan}>{ps.catatan}</Text>
                  ) : null}
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* ─── PITCH VIEWER & TACTICAL SIMULATOR MODAL ─── */}
      <Modal
        visible={viewingFormation !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setViewingFormation(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setViewingFormation(null)}>
          <View style={styles.pitchViewerCard} onStartShouldSetResponder={() => true}>
            {/* Header with Title and Clear Close Button */}
            <View style={styles.pitchViewerHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pitchViewerTitle}>{viewingFormation?.nama_formasi}</Text>
                <Text style={styles.pitchViewerSub}>11 Posisi Lapangan FC 26</Text>
              </View>
              <TouchableOpacity
                style={styles.closeModalBtn}
                onPress={() => setViewingFormation(null)}
                activeOpacity={0.7}>
                <Text style={styles.closeModalText}>✕ TUTUP</Text>
              </TouchableOpacity>
            </View>

            {/* Modal Internal Tab Switcher */}
            <View style={styles.modalNavRow}>
              <TouchableOpacity
                style={[styles.modalNavTab, modalTab === 'pitch' && styles.modalNavTabActive]}
                onPress={() => setModalTab('pitch')}
                activeOpacity={0.8}>
                <Text style={[styles.modalNavText, modalTab === 'pitch' && styles.modalNavTextActive]}>
                  📋 SKEMA LAPANGAN
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalNavTab, modalTab === 'simulation' && styles.modalNavTabActive]}
                onPress={() => {
                  setModalTab('simulation');
                  if (Object.keys(simLineup).length === 0) {
                    handleAutoFillSimulation();
                  }
                }}
                activeOpacity={0.8}>
                <Text style={[styles.modalNavText, modalTab === 'simulation' && styles.modalNavTextActive]}>
                  🧪 UJI KECOCOKAN SKUAD
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScrollBody}
              contentContainerStyle={{ paddingBottom: 24 }}
              showsVerticalScrollIndicator={false}>
              {/* Tactical Fit Score Card (When in Simulation Mode) */}
              {modalTab === 'simulation' && fitAnalysis && (
                <View style={styles.fitAnalysisCard}>
                  <View style={styles.fitTopRow}>
                    <View>
                      <Text style={styles.fitTitle}>ANALISIS KECOCOKAN TAKTIK</Text>
                      <Text style={styles.fitSub}>
                        Terisi: {fitAnalysis.filledCount}/11 • Rata-rata OVR: {fitAnalysis.avgOvr || '-'}
                      </Text>
                    </View>
                    <View style={[styles.verdictBadge, { backgroundColor: fitAnalysis.verdictBg }]}>
                      <Text style={[styles.verdictText, { color: fitAnalysis.verdictColor }]}>
                        {fitAnalysis.verdict}
                      </Text>
                    </View>
                  </View>

                  {/* Actions Row */}
                  <View style={styles.simActionsRow}>
                    <TouchableOpacity
                      style={styles.simAutoBtn}
                      onPress={handleAutoFillSimulation}
                      activeOpacity={0.8}>
                      <Text style={styles.simAutoBtnText}>⚡ AUTO-FILL TERBAIK</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.simResetBtn}
                      onPress={() => setSimLineup({})}
                      activeOpacity={0.8}>
                      <Text style={styles.simResetBtnText}>🔄 RESET</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Strengths & Warnings */}
                  {fitAnalysis.strengths.map((str, i) => (
                    <Text key={`str-${i}`} style={styles.fitStrengthText}>
                      {str}
                    </Text>
                  ))}
                  {fitAnalysis.warnings.map((warn, i) => (
                    <Text key={`warn-${i}`} style={styles.fitWarningText}>
                      {warn}
                    </Text>
                  ))}
                  <Text style={styles.simTapHint}>
                    💡 Tap posisi pemain di lapangan untuk ganti pemain secara manual.
                  </Text>
                </View>
              )}

              {/* Pitch Canvas */}
              <View style={styles.pitchViewerCanvasWrapper}>
                <PitchCanvas
                  slots={pitchSlots}
                  showLabelsOnly={modalTab === 'pitch'}
                  interactive={modalTab === 'simulation'}
                  onSelectSlot={(slot) => {
                    if (modalTab === 'simulation') {
                      setPickerSlotId(slot.id);
                      setShowPlayerPicker(true);
                    }
                  }}
                />
              </View>

              {/* Positions Role Breakdown */}
              <View style={styles.rolesBreakdownBox}>
                <Text style={styles.rolesBreakdownTitle}>STRUKTUR POSISI:</Text>
                <Text style={styles.viewerSlotsSummary}>
                  {viewingFormation?.slots.map((s) => s.slot_label).join(' • ')}
                </Text>
              </View>
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* ─── MANUAL PLAYER PICKER MODAL (FOR SIMULATION) ── */}
      <PlayerPickerModal
        visible={showPlayerPicker}
        onClose={() => setShowPlayerPicker(false)}
        onSelectPlayer={(selectedPlayer) => {
          if (pickerSlotId) {
            setSimLineup((prev) => ({
              ...prev,
              [pickerSlotId]: selectedPlayer,
            }));
          }
          setShowPlayerPicker(false);
        }}
        players={allPlayers}
        targetPositionName={currentPickerSlot?.position_nama}
        targetSlotLabel={currentPickerSlot?.slot_label}
        assignedPlayerIds={assignedSimPlayerIds}
        currentPlayerId={pickerSlotId ? simLineup[pickerSlotId]?.id : null}
      />

      {/* ─── ADD/EDIT POSITION MODAL ─────────────────── */}
      <Modal
        visible={showPosModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPosModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowPosModal(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalCenter}>
            <Pressable style={styles.formModalCard} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.modalTitle}>
                {posEditTarget ? 'EDIT POSISI' : 'TAMBAH POSISI BARU'}
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Kode Posisi (misal: CAM, LWB, RW)"
                placeholderTextColor="#999"
                value={posName}
                onChangeText={setPosName}
                autoFocus
                autoCapitalize="characters"
                maxLength={6}
                returnKeyType="done"
                onSubmitEditing={handleSavePosition}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowPosModal(false)}>
                  <Text style={styles.modalCancelText}>BATAL</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleSavePosition}>
                  <Text style={styles.modalConfirmText}>SIMPAN</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  subTabBar: {
    flexDirection: 'row',
    borderBottomWidth: 3,
    borderBottomColor: '#000',
    backgroundColor: '#FAFAFA',
  },
  subTab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#DDD',
    backgroundColor: '#F0F0F0',
  },
  subTabActive: {
    backgroundColor: '#0A1128',
  },
  subTabText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#666',
    letterSpacing: 0.5,
  },
  subTabTextActive: {
    color: '#FFFFFF',
  },
  sectionContent: {
    flex: 1,
  },
  catalogHeader: {
    padding: 14,
    backgroundColor: '#0A1128',
    borderBottomWidth: 2,
    borderBottomColor: '#000',
  },
  catalogTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#D4AF37',
    letterSpacing: 1,
  },
  catalogSub: {
    fontSize: 11,
    color: '#E0E0E0',
    marginTop: 2,
    lineHeight: 16,
  },
  catFilterBar: {
    flexDirection: 'row',
    padding: 10,
    gap: 6,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 2,
    borderBottomColor: '#000',
  },
  catFilterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: '#000',
  },
  catFilterChipActive: {
    backgroundColor: '#0A1128',
  },
  catFilterText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0A1128',
  },
  catFilterTextActive: {
    color: '#D4AF37',
  },
  topActionBar: {
    padding: 12,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 2,
    borderBottomColor: '#000',
  },
  topActionBtn: {
    backgroundColor: '#0A1128',
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  topActionBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#D4AF37',
    letterSpacing: 1.5,
  },
  listContent: {
    padding: 16,
    paddingBottom: 150,
  },
  emptySection: {
    padding: 40,
    alignItems: 'center',
  },
  emptySectionText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0A1128',
  },
  emptyHint: {
    fontSize: 13,
    color: '#888',
    marginTop: 6,
    textAlign: 'center',
  },

  // Simple Formation Card (Compact & Clean)
  simpleFormationCard: {
    backgroundColor: '#FAFAFA',
    borderWidth: 2,
    borderColor: '#000',
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  simpleCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  formationNumBadge: {
    backgroundColor: '#D4AF37',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#000',
    marginRight: 8,
  },
  formationNumText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#000',
  },
  simpleFormationTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
    color: '#0A1128',
  },
  categoryBadge: {
    backgroundColor: '#0A1128',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  categoryBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#D4AF37',
  },
  simpleSlotsSummary: {
    fontSize: 11,
    color: '#666',
    marginBottom: 10,
  },
  viewPitchBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#000',
    paddingVertical: 8,
    alignItems: 'center',
  },
  viewPitchBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 0.5,
  },

  // Pitch Viewer & Simulator Modal (Full screen proportioned)
  pitchViewerCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#000',
    width: '94%',
    height: '92%',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  pitchViewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#000',
  },
  pitchViewerTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0A1128',
  },
  pitchViewerSub: {
    fontSize: 11,
    color: '#666',
    marginTop: 1,
  },
  closeModalBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#0A1128',
    borderWidth: 1.5,
    borderColor: '#000',
  },
  closeModalText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#D4AF37',
  },
  modalNavRow: {
    flexDirection: 'row',
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#000',
  },
  modalNavTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
  },
  modalNavTabActive: {
    backgroundColor: '#0A1128',
  },
  modalNavText: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#666',
  },
  modalNavTextActive: {
    color: '#D4AF37',
  },
  modalScrollBody: {
    flex: 1,
  },
  fitAnalysisCard: {
    backgroundColor: '#FAFAFA',
    borderWidth: 2,
    borderColor: '#000',
    padding: 12,
    marginBottom: 12,
  },
  fitTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fitTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0A1128',
  },
  fitSub: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  verdictBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#000',
  },
  verdictText: {
    fontSize: 10,
    fontWeight: '900',
  },
  simActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  simAutoBtn: {
    flex: 1,
    backgroundColor: '#0A1128',
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#000',
  },
  simAutoBtnText: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#D4AF37',
  },
  simResetBtn: {
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#000',
  },
  simResetBtnText: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#0A1128',
  },
  fitStrengthText: {
    fontSize: 11,
    color: '#137333',
    fontWeight: '700',
    marginBottom: 2,
  },
  fitWarningText: {
    fontSize: 10.5,
    color: '#B06000',
    marginBottom: 2,
  },
  simTapHint: {
    fontSize: 10,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 4,
  },
  pitchViewerCanvasWrapper: {
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
    marginBottom: 10,
  },
  rolesBreakdownBox: {
    backgroundColor: '#F9F9F9',
    borderWidth: 1.5,
    borderColor: '#DDD',
    padding: 10,
  },
  rolesBreakdownTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0A1128',
    marginBottom: 4,
  },
  viewerSlotsSummary: {
    fontSize: 11,
    color: '#444',
    lineHeight: 16,
  },

  // Posisi List
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderWidth: 2,
    borderColor: '#000',
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  posIconBadge: {
    width: 36,
    height: 36,
    backgroundColor: '#0A1128',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#000',
  },
  posIconText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#D4AF37',
  },
  listItemName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: '#0A1128',
  },
  listItemActions: {
    flexDirection: 'row',
    gap: 6,
  },
  listItemBtn: {
    borderWidth: 1.5,
    borderColor: '#000',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFF',
  },
  listItemBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0A1128',
  },

  // Playstyle Tactical Guide
  playstyleBanner: {
    backgroundColor: '#0A1128',
    padding: 14,
    borderBottomWidth: 3,
    borderBottomColor: '#000',
  },
  playstyleBannerTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#D4AF37',
    letterSpacing: 1,
  },
  playstyleBannerSub: {
    fontSize: 11,
    color: '#E0E0E0',
    marginTop: 4,
    lineHeight: 16,
  },
  playstyleCard: {
    backgroundColor: '#FAFAFA',
    borderWidth: 2,
    borderColor: '#000',
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  playstyleCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  playstyleNumBadge: {
    backgroundColor: '#D4AF37',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#000',
    marginRight: 8,
  },
  playstyleNumText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#000',
  },
  playstyleName: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0A1128',
  },
  playstyleCatatan: {
    fontSize: 12,
    color: '#555',
    lineHeight: 18,
  },

  // Modals & Chips
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCenter: {
    width: '100%',
    alignItems: 'center',
  },
  formModalCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#000',
    padding: 20,
    width: '85%',
    maxWidth: 380,
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 1,
    marginBottom: 12,
  },
  modalInput: {
    borderWidth: 2,
    borderColor: '#000',
    padding: 10,
    fontSize: 14,
    fontWeight: '600',
    color: '#0A1128',
    backgroundColor: '#FAFAFA',
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#F0F0F0',
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#333',
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#D4AF37',
  },
  modalConfirmText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000',
  },
});
