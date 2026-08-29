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
  ensureStandardPositions,
} from '@/src/services/positionService';
import {
  listPlaystyles,
  FC26_DEFAULT_PLAYSTYLES,
} from '@/src/services/playstyleService';
import {
  listFormations,
  createFormation,
  updateFormation,
  deleteFormation,
  duplicateFormation,
  FC26_PRESET_TEMPLATES,
  type FormationWithSlots,
  type SlotInput,
} from '@/src/services/formationService';
import { PitchCanvas, type PitchSlotItem } from '@/src/components/PitchCanvas';
import type { Position, Playstyle } from '@/src/types';

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
  const [showBuilderModal, setShowBuilderModal] = useState(false);
  const [builderTarget, setBuilderTarget] = useState<FormationWithSlots | null>(null);
  const [builderName, setBuilderName] = useState('');
  const [builderSlots, setBuilderSlots] = useState<SlotInput[]>([]);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);

  // Large Preset Picker Modal State
  const [showPresetPickerModal, setShowPresetPickerModal] = useState(false);
  const [presetCategory, setPresetCategory] = useState<'All' | '4-Back' | '3-Back' | '5-Back'>('All');

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

  // ─── FORMASI BUILDER HANDLERS ─────────────────────
  function openCreateFormation() {
    setBuilderTarget(null);
    setBuilderName('4-3-3 Flat');
    applyPreset('4-3-3 Flat');
    setShowBuilderModal(true);
  }

  function openEditFormation(formation: FormationWithSlots) {
    setBuilderTarget(formation);
    setBuilderName(formation.nama_formasi);
    setBuilderSlots(
      formation.slots.map((s) => ({
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

  async function handleDuplicateFormation(formation: FormationWithSlots) {
    try {
      await duplicateFormation(formation.id, `${formation.nama_formasi} (Salinan)`);
      loadData();
      Alert.alert('Sukses', `Formasi ${formation.nama_formasi} berhasil diduplikat`);
    } catch (e) {
      Alert.alert('Error', 'Gagal menduplikat formasi');
    }
  }

  function handleDeleteFormation(formation: FormationWithSlots) {
    Alert.alert(
      'Hapus Formasi',
      `Hapus formasi "${formation.nama_formasi}"?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFormation(formation.id);
              loadData();
            } catch (e) {
              Alert.alert('Error', 'Gagal menghapus formasi');
            }
          },
        },
      ]
    );
  }

  // Load Preset from FC 26 Presets
  function applyPreset(presetName: string) {
    const template = FC26_PRESET_TEMPLATES.find((t) => t.name === presetName);
    if (!template) return;

    const posMap = new Map<string, string>();
    for (const p of positions) {
      posMap.set(p.nama.toUpperCase(), p.id);
    }

    const findPos = (name: string) => {
      const u = name.toUpperCase();
      if (posMap.has(u)) return posMap.get(u)!;
      if (u === 'LWB') return posMap.get('LB') ?? positions[0]?.id ?? '';
      if (u === 'RWB') return posMap.get('RB') ?? positions[0]?.id ?? '';
      if (u === 'CAM') return posMap.get('CM') ?? positions[0]?.id ?? '';
      if (u === 'CF' || u === 'LF' || u === 'RF') return posMap.get('ST') ?? positions[0]?.id ?? '';
      if (u === 'LM') return posMap.get('LW') ?? positions[0]?.id ?? '';
      if (u === 'RM') return posMap.get('RW') ?? positions[0]?.id ?? '';
      return positions[0]?.id ?? '';
    };

    const newSlots: SlotInput[] = template.slots.map((s) => ({
      position_id: findPos(s.pos),
      slot_label: s.label,
      coord_x: s.x,
      coord_y: s.y,
    }));

    setBuilderName(presetName);
    setBuilderSlots(newSlots);
    setSelectedSlotIndex(null);
    setShowPresetPickerModal(false);
  }

  function handlePitchTap(pctX: number, pctY: number) {
    if (selectedSlotIndex === null) return;
    const updated = [...builderSlots];
    updated[selectedSlotIndex] = {
      ...updated[selectedSlotIndex],
      coord_x: Math.round(pctX),
      coord_y: Math.round(pctY),
    };
    setBuilderSlots(updated);
  }

  function handleAddSlot(posId: string) {
    const pos = positions.find((p) => p.id === posId);
    if (!pos) return;

    const newSlot: SlotInput = {
      position_id: pos.id,
      slot_label: pos.nama,
      coord_x: 50,
      coord_y: 50,
    };
    const updated = [...builderSlots, newSlot];
    setBuilderSlots(updated);
    setSelectedSlotIndex(updated.length - 1);
    setShowSlotPicker(false);
  }

  function handleRemoveSlot(index: number) {
    const updated = builderSlots.filter((_, i) => i !== index);
    setBuilderSlots(updated);
    setSelectedSlotIndex(null);
  }

  async function handleSaveFormation() {
    if (!activeProfile) return;
    const trimmed = builderName.trim();
    if (!trimmed) {
      Alert.alert('Error', 'Nama formasi tidak boleh kosong');
      return;
    }
    if (builderSlots.length !== 11) {
      Alert.alert('Perhatian', `Formasi harus memiliki tepat 11 slot pemain (saat ini: ${builderSlots.length} slot)`);
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

  const previewSlots: PitchSlotItem[] = builderSlots.map((s, idx) => {
    const pos = positions.find((p) => p.id === s.position_id);
    return {
      id: String(idx),
      coord_x: s.coord_x,
      coord_y: s.coord_y,
      label: s.slot_label,
      positionName: pos?.nama ?? s.slot_label,
    };
  });

  const filteredPresets = FC26_PRESET_TEMPLATES.filter((t) => {
    if (presetCategory === 'All') return true;
    return t.category === presetCategory;
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
            PLAYSTYLE FC 26 ({playstyles.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* ─── FORMASI SECTION ─────────────────────────── */}
      {activeSection === 'formations' && (
        <View style={styles.sectionContent}>
          {/* Top Action Banner */}
          <View style={styles.topActionBar}>
            <TouchableOpacity style={styles.topActionBtn} onPress={openCreateFormation} activeOpacity={0.8}>
              <Text style={styles.topActionBtnText}>+ BUAT FORMASI BARU</Text>
            </TouchableOpacity>
          </View>

          {fLoading ? (
            <ActivityIndicator size="large" color="#0A1128" style={{ marginTop: 40 }} />
          ) : formations.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptySectionText}>Belum ada formasi</Text>
              <Text style={styles.emptyHint}>
                Tap tombol di atas untuk membuat formasi kustom atau gunakan preset.
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
              {formations.map((f) => {
                const miniSlots: PitchSlotItem[] = f.slots.map((s) => ({
                  id: s.id,
                  coord_x: s.coord_x,
                  coord_y: s.coord_y,
                  label: s.slot_label,
                  positionName: s.position_nama,
                }));

                return (
                  <View key={f.id} style={styles.formationCard}>
                    <View style={styles.formationHeader}>
                      <View>
                        <Text style={styles.formationTitle}>{f.nama_formasi}</Text>
                        <Text style={styles.formationSub}>{f.slots.length} Slot Pemain</Text>
                      </View>
                    </View>

                    {/* Mini Pitch Preview */}
                    <View style={styles.miniPitchContainer}>
                      <PitchCanvas slots={miniSlots} showLabelsOnly interactive={false} />
                    </View>

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

      {/* ─── FORMATION BUILDER MODAL ─────────────────── */}
      <Modal
        visible={showBuilderModal}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setShowBuilderModal(false)}>
        <View style={styles.builderContainer}>
          {/* Header */}
          <View style={styles.builderHeader}>
            <TextInput
              style={styles.builderTitleInput}
              placeholder="Nama Formasi (misal: 4-3-3 Flat)"
              placeholderTextColor="#999"
              value={builderName}
              onChangeText={setBuilderName}
            />
            <TouchableOpacity style={styles.builderCloseBtn} onPress={() => setShowBuilderModal(false)}>
              <Text style={styles.builderCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Big Easy Preset Selector Button */}
          <View style={styles.presetActionBar}>
            <TouchableOpacity
              style={styles.openPresetPickerBtn}
              onPress={() => setShowPresetPickerModal(true)}
              activeOpacity={0.8}>
              <Text style={styles.openPresetPickerText}>
                📋 PILIH DARI 24 PRESET FORMASI FC 26 ➔
              </Text>
            </TouchableOpacity>
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
              💡 Tap slot untuk memilih • Tap area lapangan untuk geser posisi slot
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
                </View>

                {/* Change Position for Slot */}
                <Text style={styles.slotChangePosLabel}>GANTI POSISI SLOT:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {positions.map((p) => {
                      const isCurrent = builderSlots[selectedSlotIndex]?.position_id === p.id;
                      return (
                        <TouchableOpacity
                          key={p.id}
                          style={[styles.posChip, isCurrent && styles.posChipActive]}
                          onPress={() => {
                            const updated = [...builderSlots];
                            updated[selectedSlotIndex] = {
                              ...updated[selectedSlotIndex],
                              position_id: p.id,
                              slot_label: p.nama,
                            };
                            setBuilderSlots(updated);
                          }}>
                          <Text style={[styles.posChipText, isCurrent && styles.posChipTextActive]}>
                            {p.nama}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Slot Count & Add Slot */}
            <View style={styles.slotSummaryBar}>
              <Text style={styles.slotCountText}>
                TOTAL SLOT: <Text style={{ color: builderSlots.length === 11 ? '#0A8754' : '#C5221F' }}>{builderSlots.length} / 11</Text>
              </Text>
              {builderSlots.length < 11 && (
                <TouchableOpacity
                  style={styles.addSlotBtn}
                  onPress={() => setShowSlotPicker(true)}>
                  <Text style={styles.addSlotBtnText}>+ TAMBAH SLOT</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={{ height: 120 }} />
          </ScrollView>

          {/* Builder Footer */}
          <View style={styles.builderFooter}>
            <TouchableOpacity
              style={styles.builderCancelBtn}
              onPress={() => setShowBuilderModal(false)}>
              <Text style={styles.builderCancelText}>BATAL</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.builderSaveBtn} onPress={handleSaveFormation}>
              <Text style={styles.builderSaveText}>SIMPAN FORMASI</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── DEDICATED PRESET FORMATION PICKER MODAL ── */}
      <Modal
        visible={showPresetPickerModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPresetPickerModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowPresetPickerModal(false)}>
          <View style={styles.presetModalContainer} onStartShouldSetResponder={() => true}>
            <View style={styles.presetModalHeader}>
              <Text style={styles.presetModalTitle}>PILIH PRESET FORMASI FC 26</Text>
              <TouchableOpacity
                style={styles.builderCloseBtn}
                onPress={() => setShowPresetPickerModal(false)}>
                <Text style={styles.builderCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Category Filter Pills */}
            <View style={styles.categoryFilterRow}>
              {(['All', '4-Back', '3-Back', '5-Back'] as const).map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catFilterChip, presetCategory === cat && styles.catFilterChipActive]}
                  onPress={() => setPresetCategory(cat)}>
                  <Text style={[styles.catFilterText, presetCategory === cat && styles.catFilterTextActive]}>
                    {cat === 'All' ? 'SEMUA (24)' : cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Big Formation Cards List */}
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              {filteredPresets.map((tmpl) => (
                <TouchableOpacity
                  key={tmpl.name}
                  style={styles.presetBigCard}
                  onPress={() => applyPreset(tmpl.name)}
                  activeOpacity={0.8}>
                  <View style={styles.presetBigCardHeader}>
                    <Text style={styles.presetBigCardTitle}>{tmpl.name}</Text>
                    <View style={styles.presetCatBadge}>
                      <Text style={styles.presetCatText}>{tmpl.category}</Text>
                    </View>
                  </View>

                  <Text style={styles.presetSlotsSummary}>
                    {tmpl.slots.map((s) => s.pos).join(' • ')}
                  </Text>

                  <View style={styles.presetSelectBtn}>
                    <Text style={styles.presetSelectBtnText}>PILIH FORMASI INI ➔</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* ─── ADD POSITION MODAL ──────────────────────── */}
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

      {/* ─── PICK POSITION FOR NEW SLOT MODAL ────────── */}
      <Modal
        visible={showSlotPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSlotPicker(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowSlotPicker(false)}>
          <Pressable style={styles.formModalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>PILIH POSISI UNTUK SLOT</Text>
            <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {positions.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.slotPickerItem}
                    onPress={() => handleAddSlot(p.id)}>
                    <Text style={styles.slotPickerItemText}>{p.nama}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <TouchableOpacity
              style={[styles.modalCancelBtn, { marginTop: 16 }]}
              onPress={() => setShowSlotPicker(false)}>
              <Text style={styles.modalCancelText}>BATAL</Text>
            </TouchableOpacity>
          </Pressable>
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

  // Formations Card
  formationCard: {
    backgroundColor: '#FAFAFA',
    borderWidth: 2,
    borderColor: '#000',
    marginBottom: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  formationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  formationTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0A1128',
  },
  formationSub: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  miniPitchContainer: {
    height: 180,
    borderWidth: 2,
    borderColor: '#000',
    marginBottom: 10,
  },
  formationActions: {
    flexDirection: 'row',
    gap: 8,
  },
  formActionBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#000',
    backgroundColor: '#FFFFFF',
  },
  deleteBtn: {
    borderColor: '#C5221F',
    backgroundColor: '#FFF0F0',
  },
  formActionText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0A1128',
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

  // Builder Modal
  builderContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },
  builderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#000',
  },
  builderTitleInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '900',
    color: '#0A1128',
    borderWidth: 2,
    borderColor: '#000',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FAFAFA',
  },
  builderCloseBtn: {
    marginLeft: 10,
    padding: 8,
    backgroundColor: '#F0F0F0',
    borderWidth: 2,
    borderColor: '#000',
  },
  builderCloseText: {
    fontSize: 16,
    fontWeight: '900',
  },

  // Preset Action Bar inside Builder
  presetActionBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 2,
    borderBottomColor: '#000',
  },
  openPresetPickerBtn: {
    backgroundColor: '#D4AF37',
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  openPresetPickerText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1,
  },

  pitchWrapper: {
    height: 380,
    margin: 16,
    borderWidth: 3,
    borderColor: '#000',
  },
  pitchHint: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  selectedSlotControls: {
    backgroundColor: '#F0F4FF',
    borderWidth: 2,
    borderColor: '#000',
    marginHorizontal: 16,
    padding: 12,
    marginBottom: 12,
  },
  selectedSlotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedSlotTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0A1128',
  },
  removeSlotBtn: {
    backgroundColor: '#FFE5E5',
    borderWidth: 1.5,
    borderColor: '#C5221F',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  removeSlotText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#C5221F',
  },
  slotCoordRow: {
    marginTop: 6,
    marginBottom: 6,
  },
  coordLabel: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
  },
  slotChangePosLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  slotSummaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    padding: 12,
    backgroundColor: '#FAFAFA',
    borderWidth: 2,
    borderColor: '#000',
  },
  slotCountText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0A1128',
  },
  addSlotBtn: {
    backgroundColor: '#0A1128',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: '#000',
  },
  addSlotBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#D4AF37',
  },
  builderFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    backgroundColor: '#FAFAFA',
    borderTopWidth: 2,
    borderTopColor: '#000',
    gap: 12,
  },
  builderCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#FFF',
  },
  builderCancelText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0A1128',
  },
  builderSaveBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#0A1128',
  },
  builderSaveText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#D4AF37',
  },

  // Dedicated Preset Picker Modal
  presetModalContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#000',
    width: '92%',
    maxHeight: '85%',
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  presetModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  presetModalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 1,
  },
  categoryFilterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  catFilterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F0F0F0',
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
  presetBigCard: {
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
  presetBigCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  presetBigCardTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0A1128',
  },
  presetCatBadge: {
    backgroundColor: '#0A1128',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  presetCatText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D4AF37',
  },
  presetSlotsSummary: {
    fontSize: 11,
    color: '#555',
    marginBottom: 10,
    lineHeight: 16,
  },
  presetSelectBtn: {
    backgroundColor: '#D4AF37',
    borderWidth: 1.5,
    borderColor: '#000',
    paddingVertical: 8,
    alignItems: 'center',
  },
  presetSelectBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1,
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
  posChip: {
    borderWidth: 1.5,
    borderColor: '#000',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FFF',
  },
  posChipActive: {
    backgroundColor: '#0A1128',
  },
  posChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0A1128',
  },
  posChipTextActive: {
    color: '#D4AF37',
  },
  slotPickerItem: {
    borderWidth: 2,
    borderColor: '#000',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FAFAFA',
    minWidth: 60,
    alignItems: 'center',
  },
  slotPickerItemText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0A1128',
  },
});
