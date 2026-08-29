import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useProfile } from '@/src/contexts/ProfileContext';
import {
  listWatchlist,
  createWatchlist,
  updateWatchlist,
  deleteWatchlist,
  type WatchlistWithDetails,
} from '@/src/services/watchlistService';
import { listPositions } from '@/src/services/positionService';
import { listPlayers } from '@/src/services/playerService';
import type { Position, PlayerWithPositions } from '@/src/types';

export default function WatchlistScreen() {
  const router = useRouter();
  const { activeProfile } = useProfile();

  const [watchlist, setWatchlist] = useState<WatchlistWithDetails[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [players, setPlayers] = useState<PlayerWithPositions[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal Form State
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<WatchlistWithDetails | null>(null);
  const [formPosId, setFormPosId] = useState<string>('');
  const [formOvrMin, setFormOvrMin] = useState<string>('');
  const [formOvrMax, setFormOvrMax] = useState<string>('');
  const [formCatatan, setFormCatatan] = useState<string>('');
  const [formTerkaitPlayerId, setFormTerkaitPlayerId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!activeProfile) return;
    setLoading(true);
    try {
      const [wList, posList, pList] = await Promise.all([
        listWatchlist(activeProfile.id),
        listPositions(activeProfile.id),
        listPlayers(activeProfile.id),
      ]);
      setWatchlist(wList);
      setPositions(posList);
      setPlayers(pList);
    } catch (e) {
      console.error('[WatchlistScreen] loadData error:', e);
    } finally {
      setLoading(false);
    }
  }, [activeProfile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Candidates for related players (especially akan_dijual)
  const candidatePlayers = players.filter(
    (p) => p.status === 'akan_dijual' || p.status === 'aktif'
  );

  function openAdd() {
    setEditTarget(null);
    setFormPosId(positions[0]?.id ?? '');
    setFormOvrMin('');
    setFormOvrMax('');
    setFormCatatan('');
    setFormTerkaitPlayerId(null);
    setShowModal(true);
  }

  function openEdit(item: WatchlistWithDetails) {
    setEditTarget(item);
    setFormPosId(item.position_id);
    setFormOvrMin(item.target_ovr_min ? String(item.target_ovr_min) : '');
    setFormOvrMax(item.target_ovr_max ? String(item.target_ovr_max) : '');
    setFormCatatan(item.catatan ?? '');
    setFormTerkaitPlayerId(item.terkait_player_id);
    setShowModal(true);
  }

  async function handleSave() {
    if (!activeProfile) return;
    if (!formPosId) {
      Alert.alert('Error', 'Pilih posisi target');
      return;
    }

    const minNum = formOvrMin ? parseInt(formOvrMin, 10) : null;
    const maxNum = formOvrMax ? parseInt(formOvrMax, 10) : null;

    try {
      if (editTarget) {
        await updateWatchlist(editTarget.id, {
          position_id: formPosId,
          target_ovr_min: minNum,
          target_ovr_max: maxNum,
          catatan: formCatatan.trim() || null,
          terkait_player_id: formTerkaitPlayerId || null,
        });
      } else {
        await createWatchlist({
          profile_id: activeProfile.id,
          position_id: formPosId,
          target_ovr_min: minNum,
          target_ovr_max: maxNum,
          catatan: formCatatan.trim() || null,
          terkait_player_id: formTerkaitPlayerId || null,
        });
      }
      setShowModal(false);
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Gagal menyimpan target watchlist');
    }
  }

  function handleDelete(item: WatchlistWithDetails) {
    Alert.alert('Hapus Watchlist', 'Hapus entri transfer watchlist ini?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteWatchlist(item.id);
            loadData();
          } catch (e) {
            Alert.alert('Error', 'Gagal menghapus entri');
          }
        },
      },
    ]);
  }

  if (!activeProfile) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🔍</Text>
        <Text style={styles.emptyTitle}>Belum Ada Profil Aktif</Text>
        <Text style={styles.emptyHint}>Pilih profil di tab Profil</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'TRANSFER WATCHLIST',
          headerShown: true,
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTitleStyle: { fontWeight: '900', fontSize: 18, color: '#0A1128' },
        }}
      />

      {loading ? (
        <ActivityIndicator size="large" color="#0A1128" style={{ marginTop: 40 }} />
      ) : watchlist.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🎯</Text>
          <Text style={styles.emptyTitle}>Watchlist Kosong</Text>
          <Text style={styles.emptyHint}>
            Tambahkan target posisi atau pemain buruan transfer di sini.
          </Text>
        </View>
      ) : (
        <FlatList
          data={watchlist}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const hasOvrRange = item.target_ovr_min || item.target_ovr_max;

            return (
              <View style={styles.watchCard}>
                {/* Position Badge */}
                <View style={styles.posBadge}>
                  <Text style={styles.posBadgeText}>{item.position_nama}</Text>
                </View>

                {/* Details */}
                <View style={styles.cardInfo}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.targetOvrText}>
                      Target OVR:{' '}
                      <Text style={{ fontWeight: '900', color: '#0A1128' }}>
                        {item.target_ovr_min && item.target_ovr_max
                          ? `${item.target_ovr_min} – ${item.target_ovr_max}`
                          : item.target_ovr_min
                            ? `≥ ${item.target_ovr_min}`
                            : item.target_ovr_max
                              ? `≤ ${item.target_ovr_max}`
                              : 'Bebas'}
                      </Text>
                    </Text>
                  </View>

                  {item.terkait_player_nama && (
                    <View style={styles.relatedRow}>
                      <Text style={styles.relatedLabel}>Terkait:</Text>
                      <Text style={styles.relatedValue}>
                        {item.terkait_player_nama} (OVR {item.terkait_player_ovr})
                        {item.terkait_player_status === 'akan_dijual' && ' • Akan Dijual ⚠️'}
                      </Text>
                    </View>
                  )}

                  {item.catatan && <Text style={styles.notesText}>{item.catatan}</Text>}
                </View>

                {/* Actions */}
                <View style={styles.actionsCol}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(item)}>
                    <Text style={styles.actionBtnText}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.deleteBtn]}
                    onPress={() => handleDelete(item)}>
                    <Text style={styles.actionBtnText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Floating Add Button */}
      <TouchableOpacity style={styles.fabAdd} onPress={openAdd} activeOpacity={0.8}>
        <Text style={styles.fabAddText}>+ TAMBAH TARGET TRANSFER</Text>
      </TouchableOpacity>

      {/* ─── ADD/EDIT MODAL ───────────────────────── */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalCenter}>
            <Pressable style={styles.formCard} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.modalTitle}>
                {editTarget ? 'EDIT TARGET TRANSFER' : 'TARGET TRANSFER BARU'}
              </Text>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 440 }}>
                {/* Position Picker */}
                <Text style={styles.inputLabel}>POSISI TARGET</Text>
                <View style={styles.posGrid}>
                  {positions.map((pos) => (
                    <TouchableOpacity
                      key={pos.id}
                      style={[styles.posChip, formPosId === pos.id && styles.posChipActive]}
                      onPress={() => setFormPosId(pos.id)}>
                      <Text
                        style={[
                          styles.posChipText,
                          formPosId === pos.id && styles.posChipTextActive,
                        ]}>
                        {pos.nama}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Target OVR Range */}
                <Text style={styles.inputLabel}>TARGET OVR (MIN - MAX)</Text>
                <View style={styles.ovrRangeRow}>
                  <TextInput
                    style={styles.ovrInput}
                    placeholder="Min (75)"
                    placeholderTextColor="#999"
                    value={formOvrMin}
                    onChangeText={setFormOvrMin}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                  <Text style={styles.rangeDivider}>sampai</Text>
                  <TextInput
                    style={styles.ovrInput}
                    placeholder="Max (85)"
                    placeholderTextColor="#999"
                    value={formOvrMax}
                    onChangeText={setFormOvrMax}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>

                {/* Related Player (Optional) */}
                <Text style={styles.inputLabel}>TERKAIT PEMAIN (Opsional)</Text>
                <View style={styles.relatedPicker}>
                  <TouchableOpacity
                    style={[
                      styles.relatedChip,
                      formTerkaitPlayerId === null && styles.relatedChipActive,
                    ]}
                    onPress={() => setFormTerkaitPlayerId(null)}>
                    <Text
                      style={[
                        styles.relatedChipText,
                        formTerkaitPlayerId === null && styles.relatedChipTextActive,
                      ]}>
                      Tanpa Kaitan
                    </Text>
                  </TouchableOpacity>
                  {candidatePlayers.map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        styles.relatedChip,
                        formTerkaitPlayerId === p.id && styles.relatedChipActive,
                      ]}
                      onPress={() => setFormTerkaitPlayerId(p.id)}>
                      <Text
                        style={[
                          styles.relatedChipText,
                          formTerkaitPlayerId === p.id && styles.relatedChipTextActive,
                        ]}>
                        {p.nama} ({p.ovr_current}) {p.status === 'akan_dijual' ? '⚠️' : ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Notes */}
                <Text style={styles.inputLabel}>CATATAN</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Misal: Butuh pengganti starter LW..."
                  placeholderTextColor="#999"
                  value={formCatatan}
                  onChangeText={setFormCatatan}
                  maxLength={150}
                />
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowModal(false)}>
                  <Text style={styles.modalCancelText}>BATAL</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleSave}>
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
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  watchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#FAFAFA',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  posBadge: {
    width: 52,
    height: 52,
    backgroundColor: '#0A1128',
    borderRightWidth: 2,
    borderRightColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  posBadgeText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#D4AF37',
    letterSpacing: 1,
  },
  cardInfo: {
    flex: 1,
    padding: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  targetOvrText: {
    fontSize: 13,
    color: '#555',
  },
  relatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  relatedLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#888',
  },
  relatedValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0A1128',
  },
  notesText: {
    fontSize: 12,
    color: '#444',
    marginTop: 4,
    fontStyle: 'italic',
  },
  actionsCol: {
    borderLeftWidth: 1,
    borderLeftColor: '#DDD',
  },
  actionBtn: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtn: {
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  actionBtnText: {
    fontSize: 15,
  },
  fabAdd: {
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
  fabAddText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 1.5,
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
  formCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#000',
    padding: 20,
    width: '90%',
    maxWidth: 440,
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 1,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 1,
    marginTop: 10,
    marginBottom: 4,
  },
  modalInput: {
    borderWidth: 2,
    borderColor: '#000',
    padding: 10,
    fontSize: 14,
    fontWeight: '600',
    color: '#0A1128',
    backgroundColor: '#FAFAFA',
  },
  posGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  posChip: {
    borderWidth: 1,
    borderColor: '#CCC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FFF',
  },
  posChipActive: {
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#0A1128',
  },
  posChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#666',
  },
  posChipTextActive: {
    color: '#D4AF37',
  },
  ovrRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ovrInput: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#000',
    padding: 8,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    backgroundColor: '#FAFAFA',
  },
  rangeDivider: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
  },
  relatedPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  relatedChip: {
    borderWidth: 1,
    borderColor: '#CCC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FFF',
  },
  relatedChipActive: {
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#D4AF37',
  },
  relatedChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#666',
  },
  relatedChipTextActive: {
    color: '#000',
    fontWeight: '900',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
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
