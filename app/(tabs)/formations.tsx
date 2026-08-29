import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { useProfile } from '@/src/contexts/ProfileContext';
import {
  listPositions,
  createPosition,
  updatePosition,
  deletePosition,
} from '@/src/services/positionService';
import {
  listPlaystyles,
  createPlaystyle,
  updatePlaystyle,
  deletePlaystyle,
} from '@/src/services/playstyleService';
import {
  listFormations,
  createFormation,
  updateFormation,
  deleteFormation,
  duplicateFormation,
  type FormationWithSlots,
  type SlotInput,
} from '@/src/services/formationService';
import { PitchCanvas, type PitchSlotItem } from '@/src/components/PitchCanvas';
import type { Position, Playstyle } from '@/src/types';

type Section = 'positions' | 'playstyles' | 'formations';

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
  const [showPsModal, setShowPsModal] = useState(false);
  const [psEditTarget, setPsEditTarget] = useState<Playstyle | null>(null);
  const [psName, setPsName] = useState('');
  const [psCatatan, setPsCatatan] = useState('');

  // Formations state
  const [formations, setFormations] = useState<FormationWithSlots[]>([]);
  const [fLoading, setFLoading] = useState(true);
  const [showBuilderModal, setShowBuilderModal] = useState(false);
  const [builderTarget, setBuilderTarget] = useState<FormationWithSlots | null>(null);
  const [builderName, setBuilderName] = useState('');
  const [builderSlots, setBuilderSlots] = useState<SlotInput[]>([]);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);

  // Slot add popup inside builder
  const [showSlotPicker, setShowSlotPicker] = useState(false);

  const loadData = useCallback(async () => {
    if (!activeProfile) return;
    setPosLoading(true);
    setPsLoading(true);
    setFLoading(true);
    try {
      const [posData, psData, fData] = await Promise.all([
        listPositions(activeProfile.id),
        listPlaystyles(activeProfile.id),
        listFormations(activeProfile.id),
      ]);
      setPositions(posData);
      setPlaystyles(psData);
      setFormations(fData);
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

  // ─── Position handlers ─────────────────────────────
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
      `Hapus posisi "${pos.nama}"?\nPemain yang memiliki posisi ini akan kehilangan assignment posisi tersebut.`,
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

  // ─── Playstyle handlers ────────────────────────────
  function openAddPlaystyle() {
    setPsEditTarget(null);
    setPsName('');
    setPsCatatan('');
    setShowPsModal(true);
  }

  function openEditPlaystyle(ps: Playstyle) {
    setPsEditTarget(ps);
    setPsName(ps.nama);
    setPsCatatan(ps.catatan ?? '');
    setShowPsModal(true);
  }

  async function handleSavePlaystyle() {
    if (!activeProfile) return;
    const trimmed = psName.trim();
    if (!trimmed) {
      Alert.alert('Error', 'Nama playstyle tidak boleh kosong');
      return;
    }
    try {
      if (psEditTarget) {
        await updatePlaystyle(psEditTarget.id, trimmed, psCatatan.trim() || undefined);
      } else {
        await createPlaystyle(activeProfile.id, trimmed, psCatatan.trim() || undefined);
      }
      setShowPsModal(false);
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Gagal menyimpan playstyle');
    }
  }

  function handleDeletePlaystyle(ps: Playstyle) {
    Alert.alert(
      'Hapus Playstyle',
      `Hapus playstyle "${ps.nama}"?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePlaystyle(ps.id);
              loadData();
            } catch (e) {
              Alert.alert('Error', 'Gagal menghapus playstyle');
            }
          },
        },
      ]
    );
  }

  // ─── Formation Builder handlers ────────────────────
  function openNewFormation() {
    setBuilderTarget(null);
    setBuilderName('');
    setBuilderSlots([]);
    setSelectedSlotIndex(null);
    setShowBuilderModal(true);
  }

  function openEditFormation(f: FormationWithSlots) {
    setBuilderTarget(f);
    setBuilderName(f.nama_formasi);
    setBuilderSlots(
      f.slots.map((s) => ({
        id: s.id,
        position_id: s.position_id,
        slot_label: s.slot_label,
        coord_x: s.coord_x,
        coord_y: s.coord_y,
      }))
    );
    setSelectedSlotIndex(null);
    setShowBuilderModal(true);
  }

  function handleDuplicateFormation(f: FormationWithSlots) {
    Alert.prompt
      ? Alert.prompt(
          'Duplikat Formasi',
          'Masukkan nama formasi baru:',
          async (text) => {
            if (text && text.trim()) {
              await duplicateFormation(f.id, text.trim());
              loadData();
            }
          },
          'plain-text',
          `${f.nama_formasi} (Copy)`
        )
      : (async () => {
          await duplicateFormation(f.id, `${f.nama_formasi} (Copy)`);
          loadData();
        })();
  }

  function handleDeleteFormation(f: FormationWithSlots) {
    Alert.alert(
      'Hapus Formasi',
      `Hapus formasi "${f.nama_formasi}"?\nSquad yang memakai formasi ini akan kehilangan susunan formasi.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFormation(f.id);
              loadData();
            } catch (e) {
              Alert.alert('Error', 'Gagal menghapus formasi');
            }
          },
        },
      ]
    );
  }

  // Load Preset
  function applyPreset(presetName: string) {
    const posMap = new Map<string, string>();
    for (const p of positions) {
      posMap.set(p.nama.toUpperCase(), p.id);
    }

    const findPos = (name: string) =>
      posMap.get(name.toUpperCase()) ?? positions[0]?.id ?? '';

    let newSlots: SlotInput[] = [];

    if (presetName === '4-3-3 Flat') {
      newSlots = [
        { position_id: findPos('GK'), slot_label: 'GK', coord_x: 50, coord_y: 8 },
        { position_id: findPos('LB'), slot_label: 'LB', coord_x: 15, coord_y: 28 },
        { position_id: findPos('CB'), slot_label: 'CB1', coord_x: 38, coord_y: 24 },
        { position_id: findPos('CB'), slot_label: 'CB2', coord_x: 62, coord_y: 24 },
        { position_id: findPos('RB'), slot_label: 'RB', coord_x: 85, coord_y: 28 },
        { position_id: findPos('CDM'), slot_label: 'CDM', coord_x: 50, coord_y: 46 },
        { position_id: findPos('CM'), slot_label: 'CM1', coord_x: 32, coord_y: 60 },
        { position_id: findPos('CM'), slot_label: 'CM2', coord_x: 68, coord_y: 60 },
        { position_id: findPos('LW'), slot_label: 'LW', coord_x: 18, coord_y: 82 },
        { position_id: findPos('ST'), slot_label: 'ST', coord_x: 50, coord_y: 88 },
        { position_id: findPos('RW'), slot_label: 'RW', coord_x: 82, coord_y: 82 },
      ];
    } else if (presetName === '4-2-3-1') {
      newSlots = [
        { position_id: findPos('GK'), slot_label: 'GK', coord_x: 50, coord_y: 8 },
        { position_id: findPos('LB'), slot_label: 'LB', coord_x: 15, coord_y: 28 },
        { position_id: findPos('CB'), slot_label: 'CB1', coord_x: 38, coord_y: 24 },
        { position_id: findPos('CB'), slot_label: 'CB2', coord_x: 62, coord_y: 24 },
        { position_id: findPos('RB'), slot_label: 'RB', coord_x: 85, coord_y: 28 },
        { position_id: findPos('CDM'), slot_label: 'CDM1', coord_x: 36, coord_y: 45 },
        { position_id: findPos('CDM'), slot_label: 'CDM2', coord_x: 64, coord_y: 45 },
        { position_id: findPos('CAM') || findPos('CM'), slot_label: 'CAM', coord_x: 50, coord_y: 68 },
        { position_id: findPos('LM') || findPos('LW'), slot_label: 'LM', coord_x: 20, coord_y: 68 },
        { position_id: findPos('RM') || findPos('RW'), slot_label: 'RM', coord_x: 80, coord_y: 68 },
        { position_id: findPos('ST'), slot_label: 'ST', coord_x: 50, coord_y: 88 },
      ];
    } else if (presetName === '4-4-2') {
      newSlots = [
        { position_id: findPos('GK'), slot_label: 'GK', coord_x: 50, coord_y: 8 },
        { position_id: findPos('LB'), slot_label: 'LB', coord_x: 15, coord_y: 28 },
        { position_id: findPos('CB'), slot_label: 'CB1', coord_x: 38, coord_y: 24 },
        { position_id: findPos('CB'), slot_label: 'CB2', coord_x: 62, coord_y: 24 },
        { position_id: findPos('RB'), slot_label: 'RB', coord_x: 85, coord_y: 28 },
        { position_id: findPos('LM') || findPos('LW'), slot_label: 'LM', coord_x: 18, coord_y: 56 },
        { position_id: findPos('CM'), slot_label: 'CM1', coord_x: 38, coord_y: 54 },
        { position_id: findPos('CM'), slot_label: 'CM2', coord_x: 62, coord_y: 54 },
        { position_id: findPos('RM') || findPos('RW'), slot_label: 'RM', coord_x: 82, coord_y: 56 },
        { position_id: findPos('ST'), slot_label: 'ST1', coord_x: 38, coord_y: 86 },
        { position_id: findPos('ST'), slot_label: 'ST2', coord_x: 62, coord_y: 86 },
      ];
    } else if (presetName === '3-5-2') {
      newSlots = [
        { position_id: findPos('GK'), slot_label: 'GK', coord_x: 50, coord_y: 8 },
        { position_id: findPos('CB'), slot_label: 'LCB', coord_x: 25, coord_y: 26 },
        { position_id: findPos('CB'), slot_label: 'CB', coord_x: 50, coord_y: 24 },
        { position_id: findPos('CB'), slot_label: 'RCB', coord_x: 75, coord_y: 26 },
        { position_id: findPos('CDM'), slot_label: 'CDM1', coord_x: 36, coord_y: 44 },
        { position_id: findPos('CDM'), slot_label: 'CDM2', coord_x: 64, coord_y: 44 },
        { position_id: findPos('LM') || findPos('LW'), slot_label: 'LM', coord_x: 14, coord_y: 58 },
        { position_id: findPos('CAM') || findPos('CM'), slot_label: 'CAM', coord_x: 50, coord_y: 66 },
        { position_id: findPos('RM') || findPos('RW'), slot_label: 'RM', coord_x: 86, coord_y: 58 },
        { position_id: findPos('ST'), slot_label: 'ST1', coord_x: 38, coord_y: 86 },
        { position_id: findPos('ST'), slot_label: 'ST2', coord_x: 62, coord_y: 86 },
      ];
    }

    setBuilderName(presetName);
    setBuilderSlots(newSlots);
    setSelectedSlotIndex(null);
  }

  function handleAddSlot(pos: Position) {
    // Determine label
    const existingCount = builderSlots.filter((s) => s.position_id === pos.id).length;
    const label = existingCount > 0 ? `${pos.nama}${existingCount + 1}` : pos.nama;

    const newSlot: SlotInput = {
      position_id: pos.id,
      slot_label: label,
      coord_x: 50,
      coord_y: 50,
    };

    setBuilderSlots((prev) => [...prev, newSlot]);
    setSelectedSlotIndex(builderSlots.length);
    setShowSlotPicker(false);
  }

  function handleRemoveSlot(index: number) {
    setBuilderSlots((prev) => prev.filter((_, i) => i !== index));
    setSelectedSlotIndex(null);
  }

  function handlePitchTap(cx: number, cy: number) {
    if (selectedSlotIndex !== null && selectedSlotIndex < builderSlots.length) {
      setBuilderSlots((prev) =>
        prev.map((s, idx) =>
          idx === selectedSlotIndex ? { ...s, coord_x: cx, coord_y: cy } : s
        )
      );
    }
  }

  async function handleSaveBuilder() {
    if (!activeProfile) return;
    const trimmed = builderName.trim();
    if (!trimmed) {
      Alert.alert('Error', 'Nama formasi tidak boleh kosong');
      return;
    }
    if (builderSlots.length === 0) {
      Alert.alert('Error', 'Formasi harus memiliki minimal 1 slot');
      return;
    }

    try {
      if (builderTarget) {
        await updateFormation(builderTarget.id, trimmed, builderSlots);
      } else {
        await createFormation(activeProfile.id, trimmed, builderSlots);
      }
      setShowBuilderModal(false);
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Gagal menyimpan formasi');
    }
  }

  // ─── Guard ─────────────────────────────────────────
  if (!activeProfile) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>⚽</Text>
        <Text style={styles.emptyTitle}>Belum Ada Profil Aktif</Text>
        <Text style={styles.emptyHint}>Buat profil di tab Profil terlebih dahulu</Text>
      </View>
    );
  }

  // Prepare Pitch slots for builder preview
  const previewSlots: PitchSlotItem[] = builderSlots.map((s, idx) => {
    const pos = positions.find((p) => p.id === s.position_id);
    return {
      id: String(idx),
      label: s.slot_label,
      positionName: pos?.nama ?? 'POS',
      coord_x: s.coord_x,
      coord_y: s.coord_y,
    };
  });

  return (
    <View style={styles.container}>
      {/* Segment Tabs */}
      <View style={styles.sectionTabs}>
        <TouchableOpacity
          style={[styles.sectionTab, activeSection === 'formations' && styles.sectionTabActive]}
          onPress={() => setActiveSection('formations')}>
          <Text style={[styles.sectionTabText, activeSection === 'formations' && styles.sectionTabTextActive]}>
            FORMASI
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sectionTab, activeSection === 'positions' && styles.sectionTabActive]}
          onPress={() => setActiveSection('positions')}>
          <Text style={[styles.sectionTabText, activeSection === 'positions' && styles.sectionTabTextActive]}>
            POSISI
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sectionTab, activeSection === 'playstyles' && styles.sectionTabActive]}
          onPress={() => setActiveSection('playstyles')}>
          <Text style={[styles.sectionTabText, activeSection === 'playstyles' && styles.sectionTabTextActive]}>
            PLAYSTYLE
          </Text>
        </TouchableOpacity>
      </View>

      {/* ─── FORMASI SECTION ─────────────────────────── */}
      {activeSection === 'formations' && (
        <View style={styles.sectionContent}>
          {/* Top Action Banner */}
          <View style={styles.topActionBar}>
            <TouchableOpacity style={styles.topActionBtn} onPress={openNewFormation} activeOpacity={0.8}>
              <Text style={styles.topActionBtnText}>+ BUAT FORMASI BARU</Text>
            </TouchableOpacity>
          </View>

          {fLoading ? (
            <ActivityIndicator size="large" color="#0A1128" style={{ marginTop: 40 }} />
          ) : formations.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptySectionText}>Belum ada formasi.</Text>
              <Text style={styles.emptyHint}>Tap tombol di atas untuk membuat formasi baru.</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
              {formations.map((f) => {
                // Group slots by position name
                const posCounts: Record<string, number> = {};
                for (const s of f.slots) {
                  posCounts[s.position_nama] = (posCounts[s.position_nama] || 0) + 1;
                }
                const summary = Object.entries(posCounts)
                  .map(([pos, cnt]) => `${cnt} ${pos}`)
                  .join(' • ');

                return (
                  <View key={f.id} style={styles.formationCard}>
                    <TouchableOpacity
                      style={styles.formationMain}
                      onPress={() => openEditFormation(f)}
                      activeOpacity={0.7}>
                      <View style={styles.formationHeader}>
                        <Text style={styles.formationTitle}>{f.nama_formasi}</Text>
                        <View style={styles.slotsCountBadge}>
                          <Text style={styles.slotsCountText}>{f.slots.length} SLOTS</Text>
                        </View>
                      </View>
                      <Text style={styles.formationSummary}>{summary || 'Tanpa slot'}</Text>
                    </TouchableOpacity>

                    <View style={styles.formationActions}>
                      <TouchableOpacity
                        style={styles.formActionBtn}
                        onPress={() => openEditFormation(f)}>
                        <Text style={styles.formActionText}>✏️ Edit Formasi</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.formActionBtn}
                        onPress={() => handleDuplicateFormation(f)}>
                        <Text style={styles.formActionText}>📋 Duplikat</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.formActionBtn, styles.deleteBtn]}
                        onPress={() => handleDeleteFormation(f)}>
                        <Text style={[styles.formActionText, { color: '#C5221F' }]}>🗑️ Hapus</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
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
                    <TouchableOpacity style={styles.listItemBtn} onPress={() => handleDeletePosition(pos)}>
                      <Text style={[styles.listItemBtnText, { color: '#C5221F' }]}>🗑️ Hapus</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* ─── PLAYSTYLE SECTION ───────────────────────── */}
      {activeSection === 'playstyles' && (
        <View style={styles.sectionContent}>
          {/* Top Action Banner */}
          <View style={styles.topActionBar}>
            <TouchableOpacity style={styles.topActionBtn} onPress={openAddPlaystyle} activeOpacity={0.8}>
              <Text style={styles.topActionBtnText}>+ TAMBAH PLAYSTYLE BARU</Text>
            </TouchableOpacity>
          </View>

          {psLoading ? (
            <ActivityIndicator size="large" color="#0A1128" style={{ marginTop: 40 }} />
          ) : playstyles.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptySectionText}>Belum ada playstyle</Text>
              <Text style={styles.emptyHint}>Tap tombol di atas untuk menambah playstyle baru.</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
              {playstyles.map((ps) => (
                <View key={ps.id} style={styles.listItem}>
                  <View style={styles.listItemInfo}>
                    <Text style={styles.listItemName}>{ps.nama}</Text>
                    {ps.catatan && <Text style={styles.listItemSub}>{ps.catatan}</Text>}
                  </View>
                  <View style={styles.listItemActions}>
                    <TouchableOpacity style={styles.listItemBtn} onPress={() => openEditPlaystyle(ps)}>
                      <Text style={styles.listItemBtnText}>✏️ Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.listItemBtn} onPress={() => handleDeletePlaystyle(ps)}>
                      <Text style={[styles.listItemBtnText, { color: '#C5221F' }]}>🗑️ Hapus</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* ─── FORMATION BUILDER MODAL ────────────────── */}
      <Modal visible={showBuilderModal} transparent animationType="slide" onRequestClose={() => setShowBuilderModal(false)}>
        <View style={styles.builderModalOverlay}>
          <View style={styles.builderModalCard}>
            {/* Header */}
            <View style={styles.builderHeader}>
              <TextInput
                style={styles.builderNameInput}
                placeholder="Nama Formasi (misal: 4-3-3 Flat)"
                placeholderTextColor="#999"
                value={builderName}
                onChangeText={setBuilderName}
              />
              <TouchableOpacity style={styles.builderCloseBtn} onPress={() => setShowBuilderModal(false)}>
                <Text style={styles.builderCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Presets Row */}
            <View style={styles.presetBar}>
              <Text style={styles.presetLabel}>PRESET:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {['4-3-3 Flat', '4-2-3-1', '4-4-2', '3-5-2'].map((pName) => (
                  <TouchableOpacity
                    key={pName}
                    style={styles.presetChip}
                    onPress={() => applyPreset(pName)}>
                    <Text style={styles.presetChipText}>{pName}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              {/* Interactive Pitch Canvas */}
              <View style={styles.pitchWrapper}>
                <PitchCanvas
                  slots={previewSlots}
                  selectedSlotId={selectedSlotIndex !== null ? String(selectedSlotIndex) : null}
                  onSelectSlot={(slot) => setSelectedSlotIndex(Number(slot.id))}
                  showLabelsOnly
                  interactive
                  onPitchPress={handlePitchTap}
                />
              </View>

              <Text style={styles.pitchHint}>
                💡 Tap slot untuk memilih • Tap area lapangan untuk pindahkan posisi slot
              </Text>

              {/* Slot Details & Controls when a slot is selected */}
              {selectedSlotIndex !== null && selectedSlotIndex < builderSlots.length && (
                <View style={styles.selectedSlotControls}>
                  <View style={styles.selectedSlotHeader}>
                    <Text style={styles.selectedSlotTitle}>
                      Slot #{selectedSlotIndex + 1}: {builderSlots[selectedSlotIndex].slot_label} (
                      {positions.find((p) => p.id === builderSlots[selectedSlotIndex].position_id)?.nama})
                    </Text>
                    <TouchableOpacity
                      style={styles.removeSlotBtn}
                      onPress={() => handleRemoveSlot(selectedSlotIndex)}>
                      <Text style={styles.removeSlotText}>HAPUS SLOT 🗑️</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.slotCoordRow}>
                    <Text style={styles.coordLabel}>
                      X: {builderSlots[selectedSlotIndex].coord_x}% | Y:{' '}
                      {builderSlots[selectedSlotIndex].coord_y}%
                    </Text>
                    {/* Nudge Buttons */}
                    <View style={styles.nudgeGrid}>
                      <TouchableOpacity
                        style={styles.nudgeBtn}
                        onPress={() =>
                          setBuilderSlots((prev) =>
                            prev.map((s, idx) =>
                              idx === selectedSlotIndex
                                ? { ...s, coord_y: Math.min(95, s.coord_y + 3) }
                                : s
                            )
                          )
                        }>
                        <Text style={styles.nudgeText}>▲</Text>
                      </TouchableOpacity>
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        <TouchableOpacity
                          style={styles.nudgeBtn}
                          onPress={() =>
                            setBuilderSlots((prev) =>
                              prev.map((s, idx) =>
                                idx === selectedSlotIndex
                                  ? { ...s, coord_x: Math.max(5, s.coord_x - 3) }
                                  : s
                              )
                            )
                          }>
                          <Text style={styles.nudgeText}>◀</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.nudgeBtn}
                          onPress={() =>
                            setBuilderSlots((prev) =>
                              prev.map((s, idx) =>
                                idx === selectedSlotIndex
                                  ? { ...s, coord_x: Math.min(95, s.coord_x + 3) }
                                  : s
                              )
                            )
                          }>
                          <Text style={styles.nudgeText}>▶</Text>
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity
                        style={styles.nudgeBtn}
                        onPress={() =>
                          setBuilderSlots((prev) =>
                            prev.map((s, idx) =>
                              idx === selectedSlotIndex
                                ? { ...s, coord_y: Math.max(5, s.coord_y - 3) }
                                : s
                            )
                          )
                        }>
                        <Text style={styles.nudgeText}>▼</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}

              {/* Slot Count Summary & Add Slot Button */}
              <View style={styles.slotSummaryRow}>
                <Text style={styles.slotCountNote}>
                  Total: {builderSlots.length} slot {builderSlots.length === 11 ? '✅ (Pas 11)' : '⚠️'}
                </Text>
                <TouchableOpacity
                  style={styles.addSlotBtn}
                  onPress={() => setShowSlotPicker(true)}>
                  <Text style={styles.addSlotBtnText}>+ TAMBAH SLOT</Text>
                </TouchableOpacity>
              </View>

              {/* Slot Picker popup */}
              {showSlotPicker && (
                <View style={styles.slotPickerCard}>
                  <Text style={styles.slotPickerTitle}>Pilih Posisi untuk Slot Baru:</Text>
                  <View style={styles.slotPickerGrid}>
                    {positions.map((pos) => (
                      <TouchableOpacity
                        key={pos.id}
                        style={styles.slotPickerChip}
                        onPress={() => handleAddSlot(pos)}>
                        <Text style={styles.slotPickerChipText}>{pos.nama}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity
                    style={styles.slotPickerClose}
                    onPress={() => setShowSlotPicker(false)}>
                    <Text style={styles.slotPickerCloseText}>Tutup</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>

            {/* Builder Footer Actions */}
            <View style={styles.builderFooter}>
              <TouchableOpacity
                style={styles.builderCancelBtn}
                onPress={() => setShowBuilderModal(false)}>
                <Text style={styles.builderCancelText}>BATAL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.builderSaveBtn} onPress={handleSaveBuilder}>
                <Text style={styles.builderSaveText}>SIMPAN FORMASI</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Position Modal */}
      <Modal visible={showPosModal} transparent animationType="fade" onRequestClose={() => setShowPosModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowPosModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalCenter}>
            <Pressable style={styles.formModalCard} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.modalTitle}>
                {posEditTarget ? 'EDIT POSISI' : 'POSISI BARU'}
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Nama posisi (misal: GK, CB, ST)"
                placeholderTextColor="#999"
                value={posName}
                onChangeText={setPosName}
                autoFocus
                autoCapitalize="characters"
                maxLength={10}
                returnKeyType="done"
                onSubmitEditing={handleSavePosition}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowPosModal(false)}>
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

      {/* Playstyle Modal */}
      <Modal visible={showPsModal} transparent animationType="fade" onRequestClose={() => setShowPsModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowPsModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalCenter}>
            <Pressable style={styles.formModalCard} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.modalTitle}>
                {psEditTarget ? 'EDIT PLAYSTYLE' : 'PLAYSTYLE BARU'}
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Nama playstyle"
                placeholderTextColor="#999"
                value={psName}
                onChangeText={setPsName}
                autoFocus
                maxLength={50}
              />
              <TextInput
                style={[styles.modalInput, { height: 70, textAlignVertical: 'top' }]}
                placeholder="Catatan (opsional)"
                placeholderTextColor="#999"
                value={psCatatan}
                onChangeText={setPsCatatan}
                multiline
                maxLength={200}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowPsModal(false)}>
                  <Text style={styles.modalCancelText}>BATAL</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleSavePlaystyle}>
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0A1128',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },

  // Section tabs
  sectionTabs: {
    flexDirection: 'row',
    borderBottomWidth: 3,
    borderBottomColor: '#000',
  },
  sectionTab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRightWidth: 1,
    borderRightColor: '#DDD',
  },
  sectionTabActive: {
    backgroundColor: '#0A1128',
  },
  sectionTabText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#666',
    letterSpacing: 1,
  },
  sectionTabTextActive: {
    color: '#FFFFFF',
  },

  sectionContent: {
    flex: 1,
  },
  topActionBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
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
    paddingBottom: 130,
  },
  posIconBadge: {
    width: 44,
    height: 44,
    backgroundColor: '#0A1128',
    borderRightWidth: 2,
    borderRightColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  posIconText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#D4AF37',
  },
  emptySection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptySectionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#666',
  },

  // Formation Card
  formationCard: {
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#FAFAFA',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  formationMain: {
    padding: 14,
  },
  formationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  formationTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 0.5,
  },
  slotsCountBadge: {
    backgroundColor: '#0A1128',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#000',
  },
  slotsCountText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#D4AF37',
    letterSpacing: 1,
  },
  formationSummary: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
  },
  formationActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#DDD',
  },
  formActionBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#DDD',
    backgroundColor: '#F5F5F5',
  },
  formActionText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#333',
  },
  deleteBtn: {
    borderRightWidth: 0,
  },

  // List items (Posisi & Playstyle)
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#FAFAFA',
    marginBottom: 8,
  },
  listItemInfo: {
    flex: 1,
    padding: 14,
  },
  listItemName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: '#0A1128',
    padding: 14,
  },
  listItemSub: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  listItemActions: {
    flexDirection: 'row',
    borderLeftWidth: 2,
    borderLeftColor: '#000',
  },
  listItemBtn: {
    padding: 14,
    borderLeftWidth: 1,
    borderLeftColor: '#DDD',
  },
  listItemBtnText: {
    fontSize: 16,
  },

  // Add button
  addButton: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    backgroundColor: '#0A1128',
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
  },

  // ─── Formation Builder Modal ───────────────────
  builderModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  builderModalCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#000',
    width: '94%',
    maxWidth: 480,
    height: '92%',
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  builderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#000',
    backgroundColor: '#FAFAFA',
    gap: 8,
  },
  builderNameInput: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#FFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 16,
    fontWeight: '800',
    color: '#0A1128',
  },
  builderCloseBtn: {
    padding: 8,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#F0F0F0',
  },
  builderCloseText: {
    fontSize: 16,
    fontWeight: '900',
  },
  presetBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#DDD',
    backgroundColor: '#F8F9FA',
    gap: 6,
  },
  presetLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 1,
  },
  presetChip: {
    borderWidth: 1,
    borderColor: '#000',
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#FFF',
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0A1128',
  },
  pitchWrapper: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  pitchHint: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  selectedSlotControls: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 10,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#FFFBE6',
  },
  selectedSlotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  selectedSlotTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0A1128',
  },
  removeSlotBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#FCE8E6',
    borderWidth: 1,
    borderColor: '#C5221F',
  },
  removeSlotText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#C5221F',
  },
  slotCoordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  coordLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#444',
  },
  nudgeGrid: {
    alignItems: 'center',
    gap: 2,
  },
  nudgeBtn: {
    borderWidth: 1,
    borderColor: '#000',
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#FFF',
  },
  nudgeText: {
    fontSize: 10,
    fontWeight: '900',
  },
  slotSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  slotCountNote: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0A1128',
  },
  addSlotBtn: {
    backgroundColor: '#0A1128',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 2,
    borderColor: '#000',
  },
  addSlotBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 1,
  },
  slotPickerCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 10,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#FAFAFA',
  },
  slotPickerTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0A1128',
    marginBottom: 6,
  },
  slotPickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  slotPickerChip: {
    borderWidth: 1,
    borderColor: '#000',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FFF',
  },
  slotPickerChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0A1128',
  },
  slotPickerClose: {
    marginTop: 8,
    alignSelf: 'center',
  },
  slotPickerCloseText: {
    fontSize: 11,
    color: '#888',
    textDecorationLine: 'underline',
  },
  builderFooter: {
    flexDirection: 'row',
    borderTopWidth: 2,
    borderTopColor: '#000',
    padding: 12,
    gap: 8,
    backgroundColor: '#FAFAFA',
  },
  builderCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#F0F0F0',
  },
  builderCancelText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#333',
  },
  builderSaveBtn: {
    flex: 2,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#D4AF37',
  },
  builderSaveText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1,
  },

  // Modals
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
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 1,
    marginBottom: 14,
  },
  modalInput: {
    borderWidth: 2,
    borderColor: '#000',
    padding: 10,
    fontSize: 14,
    fontWeight: '700',
    color: '#0A1128',
    backgroundColor: '#FAFAFA',
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
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
