import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useProfile } from '@/src/contexts/ProfileContext';
import {
  exportProfileToJson,
  importProfileFromJson,
  formatTeamSheetsText,
} from '@/src/services/exportService';
import {
  listWatchlist,
  createWatchlist,
  updateWatchlist,
  deleteWatchlist,
  type WatchlistWithDetails,
} from '@/src/services/watchlistService';
import { listPositions } from '@/src/services/positionService';
import { listPlayers } from '@/src/services/playerService';
import type { Profile, Position, PlayerWithPositions } from '@/src/types';

type MenuTab = 'profiles' | 'watchlist' | 'backup' | 'about';

export default function MoreMenuScreen() {
  const {
    profiles,
    activeProfile,
    loading: profileLoading,
    switchProfile,
    addProfile,
    editProfileName,
    removeProfile,
    seedData,
    refresh,
  } = useProfile();

  const [activeMenu, setActiveMenu] = useState<MenuTab>('profiles');

  // Profile Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [renameTarget, setRenameTarget] = useState<Profile | null>(null);
  const [renameName, setRenameName] = useState('');

  // Export / Import Modals
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportContent, setExportContent] = useState('');
  const [exportTitle, setExportTitle] = useState('');

  const [showImportModal, setShowImportModal] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // Watchlist State
  const [watchlist, setWatchlist] = useState<WatchlistWithDetails[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [players, setPlayers] = useState<PlayerWithPositions[]>([]);
  const [wLoading, setWLoading] = useState(false);

  // Watchlist Add/Edit Modal State
  const [showWatchModal, setShowWatchModal] = useState(false);
  const [watchEditTarget, setWatchEditTarget] = useState<WatchlistWithDetails | null>(null);
  const [wPosId, setWPosId] = useState('');
  const [wOvrMin, setWOvrMin] = useState('');
  const [wOvrMax, setWOvrMax] = useState('');
  const [wCatatan, setWCatatan] = useState('');
  const [wTerkaitPlayerId, setWTerkaitPlayerId] = useState<string | null>(null);

  const loadWatchlistData = useCallback(async () => {
    if (!activeProfile) return;
    setWLoading(true);
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
      console.error('[MoreMenuScreen] loadWatchlistData error:', e);
    } finally {
      setWLoading(false);
    }
  }, [activeProfile]);

  useEffect(() => {
    if (activeMenu === 'watchlist') {
      loadWatchlistData();
    }
  }, [activeMenu, loadWatchlistData]);

  if (profileLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0A1128" />
        <Text style={styles.loadingText}>Memuat menu...</Text>
      </View>
    );
  }

  // ─── Profile Handlers ─────────────────────────────
  async function handleAddProfile() {
    const trimmed = newName.trim();
    if (!trimmed) {
      Alert.alert('Error', 'Nama save tidak boleh kosong');
      return;
    }
    try {
      await addProfile(trimmed);
      setNewName('');
      setShowAddModal(false);
    } catch (error) {
      Alert.alert('Error', 'Gagal membuat profil');
    }
  }

  async function handleRenameProfile() {
    if (!renameTarget) return;
    const trimmed = renameName.trim();
    if (!trimmed) {
      Alert.alert('Error', 'Nama save tidak boleh kosong');
      return;
    }
    try {
      await editProfileName(renameTarget.id, trimmed);
      setRenameTarget(null);
      setRenameName('');
      setShowRenameModal(false);
    } catch (error) {
      Alert.alert('Error', 'Gagal mengganti nama profil');
    }
  }

  function handleDeleteProfileConfirm(profile: Profile) {
    Alert.alert(
      'Hapus Profil',
      `Yakin ingin menghapus "${profile.nama_save}"?\n\nSemua data pemain, formasi, squad, dan riwayat yang terkait akan dihapus permanen.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeProfile(profile.id);
            } catch (error) {
              Alert.alert('Error', 'Gagal menghapus profil');
            }
          },
        },
      ]
    );
  }

  function openRenameModal(profile: Profile) {
    setRenameTarget(profile);
    setRenameName(profile.nama_save);
    setShowRenameModal(true);
  }

  async function handleExportJson() {
    if (!activeProfile) return;
    try {
      const json = await exportProfileToJson(activeProfile.id);
      setExportTitle('EXPORT JSON PROFIL');
      setExportContent(json);
      setShowExportModal(true);
    } catch (e) {
      Alert.alert('Error', 'Gagal mengekspor profil ke JSON');
    }
  }

  async function handleExportTeamSheetsText() {
    if (!activeProfile) return;
    try {
      const text = await formatTeamSheetsText(activeProfile.id);
      setExportTitle('EXPORT TEAM SHEETS (TEXT)');
      setExportContent(text);
      setShowExportModal(true);
    } catch (e) {
      Alert.alert('Error', 'Gagal mengekspor Team Sheets');
    }
  }

  async function handleExecuteImport() {
    const trimmed = importJsonText.trim();
    if (!trimmed) {
      Alert.alert('Error', 'Paste teks JSON profil terlebih dahulu');
      return;
    }

    setIsImporting(true);
    try {
      await importProfileFromJson(trimmed);
      Alert.alert('Sukses 🎉', 'Profil berhasil diimpor!');
      setImportJsonText('');
      setShowImportModal(false);
      await refresh();
    } catch (e: any) {
      Alert.alert('Error Import', e.message ?? 'Format JSON tidak valid');
    } finally {
      setIsImporting(false);
    }
  }

  // ─── Watchlist Handlers ───────────────────────────
  function openAddWatchlist() {
    setWatchEditTarget(null);
    setWPosId(positions[0]?.id ?? '');
    setWOvrMin('78');
    setWOvrMax('83');
    setWCatatan('');
    setWTerkaitPlayerId(null);
    setShowWatchModal(true);
  }

  function openEditWatchlist(item: WatchlistWithDetails) {
    setWatchEditTarget(item);
    setWPosId(item.position_id);
    setWOvrMin(item.target_ovr_min ? String(item.target_ovr_min) : '');
    setWOvrMax(item.target_ovr_max ? String(item.target_ovr_max) : '');
    setWCatatan(item.catatan ?? '');
    setWTerkaitPlayerId(item.terkait_player_id ?? null);
    setShowWatchModal(true);
  }

  async function handleSaveWatchlist() {
    if (!activeProfile) return;
    if (!wPosId) {
      Alert.alert('Error', 'Pilih posisi target');
      return;
    }

    const minNum = wOvrMin.trim() ? parseInt(wOvrMin.trim(), 10) : null;
    const maxNum = wOvrMax.trim() ? parseInt(wOvrMax.trim(), 10) : null;

    try {
      if (watchEditTarget) {
        await updateWatchlist(watchEditTarget.id, {
          position_id: wPosId,
          target_ovr_min: minNum,
          target_ovr_max: maxNum,
          catatan: wCatatan.trim() || null,
          terkait_player_id: wTerkaitPlayerId || null,
        });
      } else {
        await createWatchlist({
          profile_id: activeProfile.id,
          position_id: wPosId,
          target_ovr_min: minNum,
          target_ovr_max: maxNum,
          catatan: wCatatan.trim() || null,
          terkait_player_id: wTerkaitPlayerId || null,
        });
      }
      setShowWatchModal(false);
      loadWatchlistData();
    } catch (e) {
      Alert.alert('Error', 'Gagal menyimpan target transfer');
    }
  }

  function handleDeleteWatchlist(item: WatchlistWithDetails) {
    Alert.alert(
      'Hapus Target Transfer',
      `Hapus target posisi ${item.position_nama}?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteWatchlist(item.id);
              loadWatchlistData();
            } catch (e) {
              Alert.alert('Error', 'Gagal menghapus target');
            }
          },
        },
      ]
    );
  }

  return (
    <View style={styles.container}>
      {/* ─── Top 4 Menu Segment Tabs ───────────────── */}
      <View style={styles.menuSegmentBar}>
        <TouchableOpacity
          style={[styles.menuSegmentBtn, activeMenu === 'profiles' && styles.menuSegmentBtnActive]}
          onPress={() => setActiveMenu('profiles')}
          activeOpacity={0.8}>
          <Text style={[styles.menuSegmentText, activeMenu === 'profiles' && styles.menuSegmentTextActive]}>
            📁 PROFIL
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuSegmentBtn, activeMenu === 'watchlist' && styles.menuSegmentBtnActive]}
          onPress={() => setActiveMenu('watchlist')}
          activeOpacity={0.8}>
          <Text style={[styles.menuSegmentText, activeMenu === 'watchlist' && styles.menuSegmentTextActive]}>
            🎯 WATCHLIST
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuSegmentBtn, activeMenu === 'backup' && styles.menuSegmentBtnActive]}
          onPress={() => setActiveMenu('backup')}
          activeOpacity={0.8}>
          <Text style={[styles.menuSegmentText, activeMenu === 'backup' && styles.menuSegmentTextActive]}>
            💾 BACKUP
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuSegmentBtn, activeMenu === 'about' && styles.menuSegmentBtnActive]}
          onPress={() => setActiveMenu('about')}
          activeOpacity={0.8}>
          <Text style={[styles.menuSegmentText, activeMenu === 'about' && styles.menuSegmentTextActive]}>
            ℹ️ TENTANG
          </Text>
        </TouchableOpacity>
      </View>

      {/* ═══════════════════════════════════════════════ */}
      {/* ─── MENU 1: PROFIL & SAVE CAREER MODE ──────── */}
      {/* ═══════════════════════════════════════════════ */}
      {activeMenu === 'profiles' && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>DAFTAR SAVE CAREER MODE</Text>
            <Text style={styles.sectionSub}>{profiles.length} save terdaftar di aplikasi</Text>
          </View>

          {profiles.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📂</Text>
              <Text style={styles.emptyTitle}>Belum Ada Save Profil</Text>
              <Text style={styles.emptyHint}>
                Buat profil baru untuk memulai Career Mode Manager
              </Text>
            </View>
          ) : (
            <View style={styles.listWrapper}>
              {profiles.map((item) => {
                const isActive = item.id === activeProfile?.id;
                return (
                  <View
                    key={item.id}
                    style={[styles.profileCard, isActive && styles.profileCardActive]}>
                    <TouchableOpacity
                      style={styles.profileMain}
                      onPress={() => switchProfile(item.id)}
                      activeOpacity={0.7}>
                      <View style={styles.profileInfo}>
                        <View style={styles.profileNameRow}>
                          <Text style={[styles.profileName, isActive && styles.profileNameActive]}>
                            {item.nama_save}
                          </Text>
                          {isActive && (
                            <View style={styles.activeBadge}>
                              <Text style={styles.activeBadgeText}>AKTIF</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.profileDate}>
                          Dibuat: {new Date(item.created_at).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <View style={styles.profileActions}>
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => openRenameModal(item)}>
                        <Text style={styles.actionBtnText}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.deleteBtn]}
                        onPress={() => handleDeleteProfileConfirm(item)}>
                        <Text style={styles.actionBtnText}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Add Profile Button */}
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              setNewName('');
              setShowAddModal(true);
            }}
            activeOpacity={0.8}>
            <Text style={styles.addButtonText}>+ BUAT SAVE PROFIL BARU</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* ─── MENU 2: TRANSFER WATCHLIST ──────────────── */}
      {/* ═══════════════════════════════════════════════ */}
      {activeMenu === 'watchlist' && (
        <View style={{ flex: 1 }}>
          <View style={styles.watchActionBar}>
            <TouchableOpacity
              style={styles.watchAddBtn}
              onPress={openAddWatchlist}
              activeOpacity={0.8}>
              <Text style={styles.watchAddBtnText}>+ TAMBAH TARGET TRANSFER</Text>
            </TouchableOpacity>
          </View>

          {wLoading ? (
            <ActivityIndicator size="large" color="#0A1128" style={{ marginTop: 40 }} />
          ) : watchlist.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🎯</Text>
              <Text style={styles.emptyTitle}>Belum Ada Target Transfer</Text>
              <Text style={styles.emptyHint}>
                Daftarkan target transfer dan hubungkan dengan pemain yang akan dijual
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {watchlist.map((item) => (
                <View key={item.id} style={styles.watchCard}>
                  <View style={styles.watchCardTop}>
                    <View style={styles.watchPosBox}>
                      <Text style={styles.watchPosText}>{item.position_nama}</Text>
                    </View>
                    <View style={styles.watchOvrBox}>
                      <Text style={styles.watchOvrText}>
                        TARGET OVR: {item.target_ovr_min ?? '—'} – {item.target_ovr_max ?? '—'}
                      </Text>
                    </View>
                  </View>

                  {/* Related player replacement */}
                  {item.terkait_player_nama && (
                    <View style={styles.terkaitBox}>
                      <Text style={styles.terkaitLabel}>🔄 MENGGANTIKAN:</Text>
                      <Text style={styles.terkaitPlayer}>
                        {item.terkait_player_nama} ({item.terkait_player_ovr ?? '-'})
                        {item.terkait_player_status === 'akan_dijual' && ' [Akan Dijual]'}
                      </Text>
                    </View>
                  )}

                  {/* Notes */}
                  {item.catatan && (
                    <Text style={styles.watchCatatanText}>"{item.catatan}"</Text>
                  )}

                  {/* Actions */}
                  <View style={styles.watchActionsRow}>
                    <TouchableOpacity
                      style={styles.watchItemBtn}
                      onPress={() => openEditWatchlist(item)}>
                      <Text style={styles.watchItemBtnText}>✏️ Edit Target</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.watchItemBtn, { borderColor: '#C5221F' }]}
                      onPress={() => handleDeleteWatchlist(item)}>
                      <Text style={[styles.watchItemBtnText, { color: '#C5221F' }]}>🗑️ Hapus</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* ─── MENU 3: BACKUP & EKSPOR ─────────────────── */}
      {/* ═══════════════════════════════════════════════ */}
      {activeMenu === 'backup' && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>BACKUP & EKSPOR DATA</Text>
            <Text style={styles.sectionSub}>
              Profil Aktif: <Text style={{ fontWeight: '900', color: '#0A1128' }}>{activeProfile?.nama_save ?? '-'}</Text>
            </Text>
          </View>

          {activeProfile && (
            <View style={styles.toolsCard}>
              <TouchableOpacity style={styles.toolBtn} onPress={handleExportTeamSheetsText}>
                <Text style={styles.toolBtnText}>📋 Ekspor Team Sheets (Format Teks)</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.toolBtn} onPress={handleExportJson}>
                <Text style={styles.toolBtnText}>💾 Backup Profil Ini ke File JSON</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toolBtn, styles.toolBtnImport]}
                onPress={() => setShowImportModal(true)}>
                <Text style={[styles.toolBtnText, { color: '#000' }]}>
                  📥 Impor Profil dari Teks JSON
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toolBtn, { backgroundColor: '#F0F4FF', marginTop: 10 }]}
                onPress={async () => {
                  Alert.alert(
                    'Muat Data Awal',
                    'Muat ulang data profil "Save 1" (44 pemain, formasi 4-3-3, 4 tim, watchlist)?',
                    [
                      { text: 'Batal', style: 'cancel' },
                      {
                        text: 'Muat',
                        onPress: async () => {
                          await seedData();
                          Alert.alert('Sukses', 'Data Save 1 berhasil dimuat!');
                        },
                      },
                    ]
                  );
                }}>
                <Text style={[styles.toolBtnText, { color: '#0A1128' }]}>
                  ⚡ Muat Ulang Data Awal (Save 1)
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* ─── MENU 4: TENTANG & DEVELOPER ─────────────── */}
      {/* ═══════════════════════════════════════════════ */}
      {activeMenu === 'about' && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Developer Card */}
          <View style={styles.devCard}>
            <View style={styles.devHeaderRow}>
              <Text style={styles.devTag}>APP CREATOR & DEVELOPER</Text>
              <View style={styles.devVerBadge}>
                <Text style={styles.devVerText}>v1.0</Text>
              </View>
            </View>
            <Text style={styles.devName}>Irwan Firmanto</Text>
            <Text style={styles.devSub}>FC 26 Career Mode Manager • Personal iOS Edition</Text>
          </View>

          {/* App Info Card */}
          <View style={[styles.toolsCard, { marginTop: 14 }]}>
            <Text style={styles.toolsTitle}>TENTANG APLIKASI</Text>
            <Text style={styles.aboutDesc}>
              Aplikasi pendamping Career Mode EA Sports FC 26 untuk mengelola seluruh data skuad, formasi kustom, status pemain, dan penyusunan otomatis starting XI Tim 1–4 serta tim tambahan tanpa batas.
            </Text>

            <View style={styles.featureItem}>
              <Text style={styles.featureBullet}>⚡</Text>
              <Text style={styles.featureText}>
                <Text style={{ fontWeight: '800' }}>Auto-Generate Team Sheet:</Text> Algoritma multi-tier pintar yang memprioritaskan OVR tertinggi, status aktif, posisi utama & sekunder, serta rotasi cerdas.
              </Text>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureBullet}>⚽</Text>
              <Text style={styles.featureText}>
                <Text style={{ fontWeight: '800' }}>24 Preset Formasi Resmi:</Text> Pustaka taktik lengkap 4-Bek, 3-Bek, dan 5-Bek dengan penyesuaian visual lapangan.
              </Text>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureBullet}>🎯</Text>
              <Text style={styles.featureText}>
                <Text style={{ fontWeight: '800' }}>Transfer Watchlist & Kuota Posisi:</Text> Monitor keseimbangan skuad real-time dan perencanaan transfer pemain.
              </Text>
            </View>
          </View>
        </ScrollView>
      )}

      {/* ─── ADD/EDIT WATCHLIST MODAL ───────────────── */}
      <Modal
        visible={showWatchModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWatchModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowWatchModal(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalCenter}>
            <Pressable style={styles.formModalCard} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.modalTitle}>
                {watchEditTarget ? 'EDIT TARGET TRANSFER' : 'TARGET TRANSFER BARU'}
              </Text>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
                {/* Position Picker */}
                <Text style={styles.inputLabel}>POSISI TARGET *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {positions.map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        style={[styles.posChip, wPosId === p.id && styles.posChipActive]}
                        onPress={() => setWPosId(p.id)}>
                        <Text style={[styles.posChipText, wPosId === p.id && styles.posChipTextActive]}>
                          {p.nama}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                {/* Target OVR Min & Max */}
                <Text style={styles.inputLabel}>TARGET RANGE OVR</Text>
                <View style={styles.ovrRangeRow}>
                  <TextInput
                    style={[styles.modalInput, { flex: 1 }]}
                    placeholder="Min OVR (misal: 78)"
                    placeholderTextColor="#999"
                    keyboardType="number-pad"
                    value={wOvrMin}
                    onChangeText={setWOvrMin}
                    maxLength={2}
                  />
                  <Text style={styles.rangeDivider}>sampai</Text>
                  <TextInput
                    style={[styles.modalInput, { flex: 1 }]}
                    placeholder="Max OVR (misal: 83)"
                    placeholderTextColor="#999"
                    keyboardType="number-pad"
                    value={wOvrMax}
                    onChangeText={setWOvrMax}
                    maxLength={2}
                  />
                </View>

                {/* Linked Player (e.g. akan_dijual) */}
                <Text style={styles.inputLabel}>MENGGANTIKAN PEMAIN (OPSIONAL)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity
                      style={[styles.playerChip, !wTerkaitPlayerId && styles.playerChipActive]}
                      onPress={() => setWTerkaitPlayerId(null)}>
                      <Text style={[styles.playerChipText, !wTerkaitPlayerId && styles.playerChipTextActive]}>
                        (Tanpa Pengganti)
                      </Text>
                    </TouchableOpacity>
                    {players.map((pl) => (
                      <TouchableOpacity
                        key={pl.id}
                        style={[
                          styles.playerChip,
                          wTerkaitPlayerId === pl.id && styles.playerChipActive,
                          pl.status === 'akan_dijual' && { borderColor: '#B06000' },
                        ]}
                        onPress={() => setWTerkaitPlayerId(pl.id)}>
                        <Text
                          style={[
                            styles.playerChipText,
                            wTerkaitPlayerId === pl.id && styles.playerChipTextActive,
                          ]}>
                          {pl.nama} ({pl.ovr_current})
                          {pl.status === 'akan_dijual' ? ' ⚠️' : ''}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                {/* Notes */}
                <Text style={styles.inputLabel}>CATATAN KEBUTUHAN</Text>
                <TextInput
                  style={[styles.modalInput, { height: 60, textAlignVertical: 'top' }]}
                  placeholder="Misal: Butuh winger lincah pengganti Moore"
                  placeholderTextColor="#999"
                  value={wCatatan}
                  onChangeText={setWCatatan}
                  multiline
                  maxLength={150}
                />
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowWatchModal(false)}>
                  <Text style={styles.modalCancelText}>BATAL</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleSaveWatchlist}>
                  <Text style={styles.modalConfirmText}>SIMPAN</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* ─── ADD PROFILE MODAL ───────────────────────── */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowAddModal(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalCenter}>
            <Pressable style={styles.formModalCard} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.modalTitle}>SAVE PROFIL BARU</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Nama save (misal: Save 2)"
                placeholderTextColor="#999"
                value={newName}
                onChangeText={setNewName}
                autoFocus
                maxLength={50}
                returnKeyType="done"
                onSubmitEditing={handleAddProfile}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowAddModal(false)}>
                  <Text style={styles.modalCancelText}>BATAL</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleAddProfile}>
                  <Text style={styles.modalConfirmText}>BUAT</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* ─── RENAME PROFILE MODAL ────────────────────── */}
      <Modal
        visible={showRenameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRenameModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowRenameModal(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalCenter}>
            <Pressable style={styles.formModalCard} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.modalTitle}>GANTI NAMA SAVE</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Nama save baru"
                placeholderTextColor="#999"
                value={renameName}
                onChangeText={setRenameName}
                autoFocus
                maxLength={50}
                returnKeyType="done"
                onSubmitEditing={handleRenameProfile}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowRenameModal(false)}>
                  <Text style={styles.modalCancelText}>BATAL</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleRenameProfile}>
                  <Text style={styles.modalConfirmText}>SIMPAN</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* ─── EXPORT MODAL ────────────────────────────── */}
      <Modal
        visible={showExportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowExportModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowExportModal(false)}>
          <View style={styles.exportModalCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>{exportTitle}</Text>
            <ScrollView style={styles.exportTextBox} showsVerticalScrollIndicator>
              <TextInput
                style={styles.exportTextInput}
                value={exportContent}
                multiline
                editable={false}
                selectTextOnFocus
              />
            </ScrollView>
            <TouchableOpacity
              style={styles.modalConfirmBtn}
              onPress={() => setShowExportModal(false)}>
              <Text style={styles.modalConfirmText}>TUTUP</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ─── IMPORT MODAL ────────────────────────────── */}
      <Modal
        visible={showImportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowImportModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowImportModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalCenter}>
            <Pressable style={styles.exportModalCard} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.modalTitle}>IMPOR PROFIL (JSON)</Text>
              <Text style={styles.importHint}>
                Paste seluruh isi teks JSON cadangan profil di bawah ini:
              </Text>
              <TextInput
                style={styles.importInput}
                placeholder='Paste JSON di sini (misal: {"version": 1, ...})'
                placeholderTextColor="#999"
                value={importJsonText}
                onChangeText={setImportJsonText}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowImportModal(false)}>
                  <Text style={styles.modalCancelText}>BATAL</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalConfirmBtn, isImporting && { opacity: 0.6 }]}
                  disabled={isImporting}
                  onPress={handleExecuteImport}>
                  <Text style={styles.modalConfirmText}>
                    {isImporting ? 'MENGIMPOR...' : 'IMPOR SEKARANG'}
                  </Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },

  // 4 Menu Segment Tabs
  menuSegmentBar: {
    flexDirection: 'row',
    borderBottomWidth: 3,
    borderBottomColor: '#000',
    backgroundColor: '#FAFAFA',
  },
  menuSegmentBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#DDD',
    backgroundColor: '#F0F0F0',
  },
  menuSegmentBtnActive: {
    backgroundColor: '#0A1128',
  },
  menuSegmentText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#666',
    letterSpacing: 0.5,
  },
  menuSegmentTextActive: {
    color: '#FFFFFF',
  },

  // Section Header
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 1,
  },
  sectionSub: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 140,
  },
  listWrapper: {
    marginBottom: 12,
  },

  // Profile card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderWidth: 2,
    borderColor: '#000',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  profileCardActive: {
    borderColor: '#0A1128',
    borderWidth: 3,
    backgroundColor: '#F0F4FF',
  },
  profileMain: {
    flex: 1,
    padding: 14,
  },
  profileInfo: {
    flex: 1,
  },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0A1128',
  },
  profileNameActive: {
    color: '#0A1128',
  },
  activeBadge: {
    backgroundColor: '#D4AF37',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1.5,
    borderColor: '#000',
  },
  activeBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1,
  },
  profileDate: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
  },
  profileActions: {
    flexDirection: 'row',
    borderLeftWidth: 2,
    borderLeftColor: '#000',
  },
  actionBtn: {
    padding: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#DDD',
  },
  actionBtnText: {
    fontSize: 16,
  },
  deleteBtn: {},

  // Developer Card
  devCard: {
    borderWidth: 3,
    borderColor: '#000',
    backgroundColor: '#0A1128',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  devHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  devTag: {
    fontSize: 10,
    fontWeight: '900',
    color: '#D4AF37',
    letterSpacing: 1.5,
  },
  devVerBadge: {
    backgroundColor: '#D4AF37',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  devVerText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#000',
  },
  devName: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  devSub: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E0E0E0',
    marginTop: 4,
  },
  aboutDesc: {
    fontSize: 12,
    color: '#444',
    lineHeight: 18,
    marginBottom: 12,
  },
  featureItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  featureBullet: {
    fontSize: 14,
    marginRight: 8,
    marginTop: 1,
  },
  featureText: {
    flex: 1,
    fontSize: 12,
    color: '#333',
    lineHeight: 17,
  },

  // Empty state
  emptyState: {
    padding: 40,
    alignItems: 'center',
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

  // Add button
  addButton: {
    backgroundColor: '#0A1128',
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
    marginBottom: 20,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
  },

  // Tools Card
  toolsCard: {
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#FAFAFA',
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  toolsTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 1,
    marginBottom: 10,
  },
  toolBtn: {
    borderWidth: 1.5,
    borderColor: '#000',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#FFF',
    marginBottom: 8,
  },
  toolBtnImport: {
    backgroundColor: '#D4AF37',
    marginBottom: 0,
  },
  toolBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0A1128',
  },

  // Watchlist specific styles
  watchActionBar: {
    padding: 12,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 2,
    borderBottomColor: '#000',
  },
  watchAddBtn: {
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
  watchAddBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#D4AF37',
    letterSpacing: 1.5,
  },
  watchCard: {
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
  watchCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  watchPosBox: {
    width: 44,
    height: 44,
    backgroundColor: '#0A1128',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: '#000',
  },
  watchPosText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#D4AF37',
  },
  watchOvrBox: {
    flex: 1,
  },
  watchOvrText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0A1128',
  },
  terkaitBox: {
    backgroundColor: '#FFFBE6',
    borderWidth: 1,
    borderColor: '#B06000',
    padding: 8,
    marginBottom: 8,
  },
  terkaitLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#B06000',
  },
  terkaitPlayer: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0A1128',
    marginTop: 2,
  },
  watchCatatanText: {
    fontSize: 12,
    color: '#444',
    fontStyle: 'italic',
    marginBottom: 10,
  },
  watchActionsRow: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#DDD',
    paddingTop: 8,
  },
  watchItemBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#000',
    backgroundColor: '#FFF',
  },
  watchItemBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0A1128',
  },

  // Chip Pickers
  posChip: {
    borderWidth: 1.5,
    borderColor: '#000',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FAFAFA',
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
  playerChip: {
    borderWidth: 1.5,
    borderColor: '#000',
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#FAFAFA',
  },
  playerChipActive: {
    backgroundColor: '#0A1128',
  },
  playerChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0A1128',
  },
  playerChipTextActive: {
    color: '#D4AF37',
  },
  ovrRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  rangeDivider: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 4,
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
    width: '88%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  exportModalCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#000',
    padding: 18,
    width: '90%',
    maxWidth: 440,
    maxHeight: '85%',
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
  exportTextBox: {
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#FAFAFA',
    maxHeight: 320,
    padding: 10,
    marginBottom: 12,
  },
  exportTextInput: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    color: '#0A1128',
  },
  importHint: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  importInput: {
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#FAFAFA',
    height: 180,
    padding: 10,
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    textAlignVertical: 'top',
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
