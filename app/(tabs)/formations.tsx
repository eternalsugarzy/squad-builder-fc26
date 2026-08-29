import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
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
import type { Position, Playstyle } from '@/src/types';

type Section = 'positions' | 'playstyles' | 'formations';

export default function FormationsScreen() {
  const { activeProfile } = useProfile();
  const [activeSection, setActiveSection] = useState<Section>('positions');

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

  const loadPositions = useCallback(async () => {
    if (!activeProfile) return;
    setPosLoading(true);
    try {
      const data = await listPositions(activeProfile.id);
      setPositions(data);
    } catch (e) {
      console.error('Error loading positions:', e);
    } finally {
      setPosLoading(false);
    }
  }, [activeProfile]);

  const loadPlaystyles = useCallback(async () => {
    if (!activeProfile) return;
    setPsLoading(true);
    try {
      const data = await listPlaystyles(activeProfile.id);
      setPlaystyles(data);
    } catch (e) {
      console.error('Error loading playstyles:', e);
    } finally {
      setPsLoading(false);
    }
  }, [activeProfile]);

  useEffect(() => {
    loadPositions();
    loadPlaystyles();
  }, [loadPositions, loadPlaystyles]);

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
      loadPositions();
    } catch (e) {
      Alert.alert('Error', 'Gagal menyimpan posisi');
      console.error(e);
    }
  }

  function handleDeletePosition(pos: Position) {
    Alert.alert(
      'Hapus Posisi',
      `Hapus posisi "${pos.nama}"?\n\nPemain yang memiliki posisi ini akan kehilangan assignment posisi tersebut.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePosition(pos.id);
              loadPositions();
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
      loadPlaystyles();
    } catch (e) {
      Alert.alert('Error', 'Gagal menyimpan playstyle');
      console.error(e);
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
              loadPlaystyles();
            } catch (e) {
              Alert.alert('Error', 'Gagal menghapus playstyle');
            }
          },
        },
      ]
    );
  }

  // ─── No profile guard ─────────────────────────────
  if (!activeProfile) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>⚙️</Text>
        <Text style={styles.emptyTitle}>Belum Ada Profil Aktif</Text>
        <Text style={styles.emptyHint}>Buat profil di tab Profil terlebih dahulu</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Section tabs */}
      <View style={styles.sectionTabs}>
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
        <TouchableOpacity
          style={[styles.sectionTab, activeSection === 'formations' && styles.sectionTabActive]}
          onPress={() => setActiveSection('formations')}>
          <Text style={[styles.sectionTabText, activeSection === 'formations' && styles.sectionTabTextActive]}>
            FORMASI
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeSection === 'positions' && (
        <View style={styles.sectionContent}>
          {posLoading ? (
            <ActivityIndicator size="large" color="#0A1128" style={{ marginTop: 40 }} />
          ) : positions.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptySectionText}>Belum ada posisi</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
              {positions.map((pos) => (
                <View key={pos.id} style={styles.listItem}>
                  <Text style={styles.listItemName}>{pos.nama}</Text>
                  <View style={styles.listItemActions}>
                    <TouchableOpacity style={styles.listItemBtn} onPress={() => openEditPosition(pos)}>
                      <Text style={styles.listItemBtnText}>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.listItemBtn} onPress={() => handleDeletePosition(pos)}>
                      <Text style={styles.listItemBtnText}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity style={styles.addButton} onPress={openAddPosition} activeOpacity={0.8}>
            <Text style={styles.addButtonText}>+ TAMBAH POSISI</Text>
          </TouchableOpacity>
        </View>
      )}

      {activeSection === 'playstyles' && (
        <View style={styles.sectionContent}>
          {psLoading ? (
            <ActivityIndicator size="large" color="#0A1128" style={{ marginTop: 40 }} />
          ) : playstyles.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptySectionText}>Belum ada playstyle</Text>
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
                      <Text style={styles.listItemBtnText}>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.listItemBtn} onPress={() => handleDeletePlaystyle(ps)}>
                      <Text style={styles.listItemBtnText}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity style={styles.addButton} onPress={openAddPlaystyle} activeOpacity={0.8}>
            <Text style={styles.addButtonText}>+ TAMBAH PLAYSTYLE</Text>
          </TouchableOpacity>
        </View>
      )}

      {activeSection === 'formations' && (
        <View style={styles.sectionContent}>
          <View style={styles.emptySection}>
            <Text style={styles.emptySectionText}>Builder formasi akan ditampilkan di Tahap 4</Text>
          </View>
        </View>
      )}

      {/* Position Modal */}
      <Modal visible={showPosModal} transparent animationType="fade" onRequestClose={() => setShowPosModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowPosModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalCenter}>
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
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
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
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
                returnKeyType="next"
              />
              <TextInput
                style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]}
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
    backgroundColor: '#FFFFFF',
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
    fontSize: 13,
    fontWeight: '800',
    color: '#666',
    letterSpacing: 1,
  },
  sectionTabTextActive: {
    color: '#FFFFFF',
  },

  // Section content
  sectionContent: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  emptySection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptySectionText: {
    fontSize: 14,
    color: '#999',
  },

  // List items
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

  // Modal
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
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#000',
    padding: 24,
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
    letterSpacing: 2,
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 2,
    borderColor: '#000',
    padding: 12,
    fontSize: 16,
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
    fontSize: 14,
    fontWeight: '800',
    color: '#333',
    letterSpacing: 1,
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
    fontSize: 14,
    fontWeight: '800',
    color: '#000',
    letterSpacing: 1,
  },
});
