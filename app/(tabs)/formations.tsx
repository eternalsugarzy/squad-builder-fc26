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
import { listPlaystyles } from '@/src/services/playstyleService';
import {
  listFormations,
  FC26_PRESET_TEMPLATES,
  type FormationWithSlots,
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
  const [selectedCategory, setSelectedCategory] = useState<'All' | '4-Back' | '3-Back' | '5-Back'>('All');

  // Pitch Viewer Modal State
  const [viewingFormation, setViewingFormation] = useState<FormationWithSlots | null>(null);

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

  const viewingSlots: PitchSlotItem[] = viewingFormation
    ? viewingFormation.slots.map((s) => ({
        id: s.id,
        coord_x: s.coord_x,
        coord_y: s.coord_y,
        label: s.slot_label,
        positionName: s.position_nama,
      }))
    : [];

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

      {/* ─── FORMASI SECTION (SIMPLE LIST + MODAL PITCH) ─ */}
      {activeSection === 'formations' && (
        <View style={styles.sectionContent}>
          {/* Header Banner */}
          <View style={styles.catalogHeader}>
            <Text style={styles.catalogTitle}>DAFTAR 24 FORMASI RESMI FC 26</Text>
            <Text style={styles.catalogSub}>
              Tap salah satu formasi di bawah untuk melihat skema lapangan taktis dan struktur posisinya.
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
                    onPress={() => setViewingFormation(f)}
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
                      <Text style={styles.viewPitchBtnText}>👁️ LIHAT POSISI LAPANGAN ➔</Text>
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

      {/* ─── PITCH VIEWER MODAL ──────────────────────── */}
      <Modal
        visible={viewingFormation !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setViewingFormation(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setViewingFormation(null)}>
          <View style={styles.pitchViewerCard} onStartShouldSetResponder={() => true}>
            <View style={styles.pitchViewerHeader}>
              <View>
                <Text style={styles.pitchViewerTitle}>{viewingFormation?.nama_formasi}</Text>
                <Text style={styles.pitchViewerSub}>11 Slot Pemain Lapangan</Text>
              </View>
              <TouchableOpacity
                style={styles.closeModalBtn}
                onPress={() => setViewingFormation(null)}>
                <Text style={styles.closeModalText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Pitch Canvas */}
            <View style={styles.pitchViewerCanvasWrapper}>
              <PitchCanvas slots={viewingSlots} showLabelsOnly interactive={false} />
            </View>

            {/* Positions Role List */}
            <Text style={styles.viewerSlotsSummary}>
              {viewingFormation?.slots.map((s) => s.slot_label).join(' • ')}
            </Text>

            <TouchableOpacity
              style={styles.viewerCloseActionBtn}
              onPress={() => setViewingFormation(null)}>
              <Text style={styles.viewerCloseActionText}>TUTUP</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

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

  // Pitch Viewer Modal
  pitchViewerCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#000',
    width: '92%',
    maxHeight: '85%',
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
    padding: 6,
    backgroundColor: '#F0F0F0',
    borderWidth: 1.5,
    borderColor: '#000',
  },
  closeModalText: {
    fontSize: 14,
    fontWeight: '900',
  },
  pitchViewerCanvasWrapper: {
    height: 320,
    borderWidth: 2,
    borderColor: '#000',
    marginBottom: 10,
  },
  viewerSlotsSummary: {
    fontSize: 11,
    color: '#444',
    textAlign: 'center',
    marginBottom: 12,
  },
  viewerCloseActionBtn: {
    backgroundColor: '#0A1128',
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
  },
  viewerCloseActionText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#D4AF37',
    letterSpacing: 1,
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
