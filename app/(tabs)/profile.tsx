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

  // null = Menu Hub (Vertical List), or specific section
  const [activeMenu, setActiveMenu] = useState<MenuTab | null>(null);

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
    loadWatchlistData();
  }, [loadWatchlistData]);

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

    if (minNum !== null && maxNum !== null && minNum > maxNum) {
      Alert.alert('Error', 'Target OVR Min tidak boleh lebih besar dari Max');
      return;
    }

    try {
      if (watchEditTarget) {
        await updateWatchlist(watchEditTarget.id, {
          position_id: wPosId,
          target_ovr_min: minNum,
          target_ovr_max: maxNum,
          terkait_player_id: wTerkaitPlayerId,
          catatan: wCatatan.trim() || null,
        });
      } else {
        await createWatchlist({
          profile_id: activeProfile.id,
          position_id: wPosId,
          target_ovr_min: minNum,
          target_ovr_max: maxNum,
          terkait_player_id: wTerkaitPlayerId,
          catatan: wCatatan.trim() || null,
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
      'Hapus Target',
      `Hapus target transfer posisi ${item.position_nama}?`,
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
      {/* ─── MAIN VERTICAL MENU HUB (WHEN NO SUB-MENU SELECTED) ─ */}
      {activeMenu === null ? (
        <ScrollView
          contentContainerStyle={styles.menuHubContent}
          showsVerticalScrollIndicator={false}>
          {/* Header Banner */}
          <View style={styles.menuHubHeader}>
            <Text style={styles.menuHubTitle}>MENU & LAINNYA</Text>
            <Text style={styles.menuHubSubtitle}>
              Pusat konfigurasi, target transfer, backup data, dan informasi pengembang.
            </Text>
            {activeProfile && (
              <View style={styles.activeSaveBadgeRow}>
                <Text style={styles.activeSaveLabel}>SAVE AKTIF:</Text>
                <Text style={styles.activeSaveVal}>{activeProfile.nama_save.toUpperCase()}</Text>
              </View>
            )}
          </View>

          {/* Vertical Menu Cards (Datar ke Bawah) */}
          <View style={styles.verticalMenuList}>
            {/* 1. Profil & Save */}
            <TouchableOpacity
              style={styles.verticalMenuCard}
              onPress={() => setActiveMenu('profiles')}
              activeOpacity={0.8}>
              <View style={styles.menuCardLeft}>
                <View style={styles.menuIconBox}>
                  <Text style={styles.menuIconText}>📁</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.menuCardTitleRow}>
                    <Text style={styles.menuCardTitle}>PROFIL & SAVE</Text>
                    <View style={styles.menuCountBadge}>
                      <Text style={styles.menuCountText}>{profiles.length} Save</Text>
                    </View>
                  </View>
                  <Text style={styles.menuCardDesc}>
                    Ganti save aktif, buat profil save baru, rename, dan hapus profil.
                  </Text>
                </View>
              </View>
              <Text style={styles.menuArrow}>➔</Text>
            </TouchableOpacity>

            {/* 2. Transfer Watchlist */}
            <TouchableOpacity
              style={styles.verticalMenuCard}
              onPress={() => setActiveMenu('watchlist')}
              activeOpacity={0.8}>
              <View style={styles.menuCardLeft}>
                <View style={[styles.menuIconBox, { backgroundColor: '#B06000' }]}>
                  <Text style={styles.menuIconText}>🎯</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.menuCardTitleRow}>
                    <Text style={styles.menuCardTitle}>TRANSFER WATCHLIST</Text>
                    <View style={[styles.menuCountBadge, { backgroundColor: '#B06000' }]}>
                      <Text style={[styles.menuCountText, { color: '#FFF' }]}>{watchlist.length} Target</Text>
                    </View>
                  </View>
                  <Text style={styles.menuCardDesc}>
                    Pantau target posisi transfer, range target OVR, dan pengganti pemain.
                  </Text>
                </View>
              </View>
              <Text style={styles.menuArrow}>➔</Text>
            </TouchableOpacity>

            {/* 3. Backup & Ekspor */}
            <TouchableOpacity
              style={styles.verticalMenuCard}
              onPress={() => setActiveMenu('backup')}
              activeOpacity={0.8}>
              <View style={styles.menuCardLeft}>
                <View style={[styles.menuIconBox, { backgroundColor: '#137333' }]}>
                  <Text style={styles.menuIconText}>💾</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.menuCardTitleRow}>
                    <Text style={styles.menuCardTitle}>BACKUP & RESTORE</Text>
                    <View style={[styles.menuCountBadge, { backgroundColor: '#137333' }]}>
                      <Text style={[styles.menuCountText, { color: '#FFF' }]}>JSON & Teks</Text>
                    </View>
                  </View>
                  <Text style={styles.menuCardDesc}>
                    Ekspor format teks team sheet, backup seluruh database profil ke JSON, atau impor file JSON.
                  </Text>
                </View>
              </View>
              <Text style={styles.menuArrow}>➔</Text>
            </TouchableOpacity>

            {/* 4. Tentang & Dev */}
            <TouchableOpacity
              style={styles.verticalMenuCard}
              onPress={() => setActiveMenu('about')}
              activeOpacity={0.8}>
              <View style={styles.menuCardLeft}>
                <View style={[styles.menuIconBox, { backgroundColor: '#0A1128' }]}>
                  <Text style={styles.menuIconText}>ℹ️</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.menuCardTitleRow}>
                    <Text style={styles.menuCardTitle}>TENTANG & DEVELOPER</Text>
                    <View style={styles.menuCountBadge}>
                      <Text style={styles.menuCountText}>Irwan Firmanto</Text>
                    </View>
                  </View>
                  <Text style={styles.menuCardDesc}>
                    Identitas developer, informasi aplikasi, panduan fitur, dan lisensi.
                  </Text>
                </View>
              </View>
              <Text style={styles.menuArrow}>➔</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        /* ─── SUB-MENU SCREEN WITH BACK BUTTON ─────────── */
        <View style={styles.sectionContainer}>
          {/* Top Bar Back to Main Menu */}
          <View style={styles.backNavBar}>
            <TouchableOpacity
              style={styles.backNavBtn}
              onPress={() => setActiveMenu(null)}
              activeOpacity={0.8}>
              <Text style={styles.backNavBtnText}>← KEMBALI KE MENU LAINNYA</Text>
            </TouchableOpacity>
            <Text style={styles.subScreenTitle}>
              {activeMenu === 'profiles' && '📁 PROFIL & SAVE'}
              {activeMenu === 'watchlist' && '🎯 TRANSFER WATCHLIST'}
              {activeMenu === 'backup' && '💾 BACKUP & RESTORE'}
              {activeMenu === 'about' && 'ℹ️ TENTANG & DEVELOPER'}
            </Text>
          </View>

          {/* ─── 1. PROFIL SECTION ─────────────────────── */}
          {activeMenu === 'profiles' && (
            <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
              <View style={styles.subSectionHeader}>
                <Text style={styles.subSectionTitle}>SAVE CAREER MODE ({profiles.length})</Text>
                <TouchableOpacity
                  style={styles.subSectionActionBtn}
                  onPress={() => setShowAddModal(true)}>
                  <Text style={styles.subSectionActionBtnText}>+ SAVE BARU</Text>
                </TouchableOpacity>
              </View>

              {profiles.map((profile) => {
                const isActive = activeProfile?.id === profile.id;
                return (
                  <View
                    key={profile.id}
                    style={[styles.profileCard, isActive && styles.profileCardActive]}>
                    <View style={styles.profileCardHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.profileName}>{profile.nama_save}</Text>
                          {isActive && (
                            <View style={styles.activeTag}>
                              <Text style={styles.activeTagText}>AKTIF</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.profileMeta}>
                          Dibuat: {new Date(profile.created_at).toLocaleDateString('id-ID')}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.profileActions}>
                      {!isActive && (
                        <TouchableOpacity
                          style={styles.switchBtn}
                          onPress={() => switchProfile(profile.id)}>
                          <Text style={styles.switchBtnText}>PILIH SAVE INI</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.editBtn}
                        onPress={() => openRenameModal(profile)}>
                        <Text style={styles.editBtnText}>✏️ Rename</Text>
                      </TouchableOpacity>
                      {profiles.length > 1 && (
                        <TouchableOpacity
                          style={styles.deleteBtn}
                          onPress={() => handleDeleteProfileConfirm(profile)}>
                          <Text style={styles.deleteBtnText}>🗑️</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}

          {/* ─── 2. WATCHLIST SECTION ──────────────────── */}
          {activeMenu === 'watchlist' && (
            <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
              <View style={styles.subSectionHeader}>
                <Text style={styles.subSectionTitle}>TARGET TRANSFER ({watchlist.length})</Text>
                <TouchableOpacity
                  style={styles.subSectionActionBtn}
                  onPress={openAddWatchlist}>
                  <Text style={styles.subSectionActionBtnText}>+ TAMBAH TARGET</Text>
                </TouchableOpacity>
              </View>

              {wLoading ? (
                <ActivityIndicator size="large" color="#0A1128" style={{ marginTop: 24 }} />
              ) : watchlist.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>Belum Ada Target Transfer</Text>
                  <Text style={styles.emptySub}>
                    Catat posisi yang perlu dibeli, target range OVR, dan pemain yang ingin digantikan.
                  </Text>
                </View>
              ) : (
                watchlist.map((item) => (
                  <View key={item.id} style={styles.watchCard}>
                    <View style={styles.watchCardTop}>
                      <View style={styles.watchPosBadge}>
                        <Text style={styles.watchPosBadgeText}>{item.position_nama}</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.watchTargetOvr}>
                          Target OVR:{' '}
                          {item.target_ovr_min && item.target_ovr_max
                            ? `${item.target_ovr_min} – ${item.target_ovr_max}`
                            : item.target_ovr_min
                            ? `Min ${item.target_ovr_min}`
                            : 'Bebas'}
                        </Text>
                        {item.terkait_player_nama && (
                          <Text style={styles.watchReplace}>
                            Gantikan: {item.terkait_player_nama} ({item.terkait_player_ovr ?? '-'})
                          </Text>
                        )}
                      </View>
                    </View>

                    {item.catatan ? (
                      <View style={styles.watchNoteBox}>
                        <Text style={styles.watchNoteText}>"{item.catatan}"</Text>
                      </View>
                    ) : null}

                    <View style={styles.watchActions}>
                      <TouchableOpacity
                        style={styles.watchEditBtn}
                        onPress={() => openEditWatchlist(item)}>
                        <Text style={styles.watchEditBtnText}>✏️ Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.watchDeleteBtn}
                        onPress={() => handleDeleteWatchlist(item)}>
                        <Text style={styles.watchDeleteBtnText}>🗑️ Hapus</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          )}

          {/* ─── 3. BACKUP & RESTORE SECTION ───────────── */}
          {activeMenu === 'backup' && (
            <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
              <View style={styles.backupCard}>
                <Text style={styles.backupCardTitle}>📋 EKSPOR TEKS TEAM SHEETS</Text>
                <Text style={styles.backupCardDesc}>
                  Format teks rapi yang menampilkan susunan Tim 1–4 beserta formasi dan playstyle untuk dibagikan atau dicatat.
                </Text>
                <TouchableOpacity
                  style={styles.backupBtn}
                  onPress={handleExportTeamSheetsText}
                  activeOpacity={0.8}>
                  <Text style={styles.backupBtnText}>LIHAT / SALIN TEKS TEAM SHEETS</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.backupCard}>
                <Text style={styles.backupCardTitle}>📦 BACKUP PROFIL (JSON)</Text>
                <Text style={styles.backupCardDesc}>
                  Ekspor seluruh data profil aktif (pemain, formasi, squad, riwayat OVR, watchlist) dalam format file JSON.
                </Text>
                <TouchableOpacity
                  style={styles.backupBtn}
                  onPress={handleExportJson}
                  activeOpacity={0.8}>
                  <Text style={styles.backupBtnText}>UNDUH / SALIN JSON PROFIL</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.backupCard}>
                <Text style={styles.backupCardTitle}>📥 RESTORE / IMPOR JSON</Text>
                <Text style={styles.backupCardDesc}>
                  Impor profil save Career Mode dari string JSON yang sebelumnya Anda backup.
                </Text>
                <TouchableOpacity
                  style={[styles.backupBtn, { backgroundColor: '#137333' }]}
                  onPress={() => {
                    setImportJsonText('');
                    setShowImportModal(true);
                  }}
                  activeOpacity={0.8}>
                  <Text style={[styles.backupBtnText, { color: '#FFF' }]}>IMPOR PROFIL DARI JSON</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.backupCard, { borderColor: '#B06000' }]}>
                <Text style={styles.backupCardTitle}>🔄 MUAT ULANG DATA SEED SAVE 1</Text>
                <Text style={styles.backupCardDesc}>
                  Jika data profil default Anda kosong, tekan tombol ini untuk mengisi ulang 31 pemain, 24 formasi, dan skuad Career Mode.
                </Text>
                <TouchableOpacity
                  style={[styles.backupBtn, { backgroundColor: '#B06000' }]}
                  onPress={async () => {
                    Alert.alert(
                      'Muat Ulang Seed',
                      'Isi ulang data default Career Mode ke profil aktif?',
                      [
                        { text: 'Batal', style: 'cancel' },
                        {
                          text: 'Muat Ulang',
                          onPress: async () => {
                            await seedData();
                            Alert.alert('Sukses', 'Data seed berhasil dimuat ulang!');
                          },
                        },
                      ]
                    );
                  }}
                  activeOpacity={0.8}>
                  <Text style={[styles.backupBtnText, { color: '#FFF' }]}>MUAT ULANG DATA SEED</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {/* ─── 4. TENTANG & DEV SECTION ──────────────── */}
          {activeMenu === 'about' && (
            <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
              {/* Developer Card */}
              <View style={styles.devCard}>
                <View style={styles.devBadge}>
                  <Text style={styles.devBadgeText}>LEAD DEVELOPER</Text>
                </View>
                <Text style={styles.devName}>Irwan Firmanto</Text>
                <Text style={styles.devRole}>Creator & Developer of FC 26 Career Mode Manager</Text>
                <View style={styles.devDivider} />
                <Text style={styles.devBio}>
                  Aplikasi manajemen tim pribadi yang dirancang khusus untuk mengoptimalkan rotasi, formasi taktis, dan penyusunan Team Sheet otomatis di EA SPORTS FC 26 Career Mode.
                </Text>
              </View>

              {/* App Info Card */}
              <View style={styles.aboutCard}>
                <Text style={styles.aboutTitle}>FC 26 CAREER MODE MANAGER</Text>
                <Text style={styles.aboutVersion}>Versi 1.0.0 (Build Final iOS)</Text>
                <View style={styles.aboutDivider} />

                <Text style={styles.aboutFeatureTitle}>FITUR UTAMA APLIKASI:</Text>
                <Text style={styles.aboutBullet}>• ⚡ Auto-Generate Team Sheet Berdasarkan OVR & Status</Text>
                <Text style={styles.aboutBullet}>• 📋 24 Formasi Resmi FC 26 & 8 Tactical Visions</Text>
                <Text style={styles.aboutBullet}>• 🧪 Simulator Taktis & Analisis Kecocokan Formasi</Text>
                <Text style={styles.aboutBullet}>• 📊 Monitor Kebutuhan Kuota Posisi (Dual-Mode)</Text>
                <Text style={styles.aboutBullet}>• 📁 Multi-Save Career Mode Profile Manager</Text>
                <Text style={styles.aboutBullet}>• 🎯 Transfer Watchlist & Pengganti Pemain</Text>
                <Text style={styles.aboutBullet}>• 💾 Backup & Restore Full JSON</Text>
              </View>
            </ScrollView>
          )}
        </View>
      )}

      {/* ─── ADD SAVE PROFILE MODAL ─────────────────── */}
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
              <Text style={styles.modalTitle}>BUAT SAVE BARU</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Nama Save (misal: Arsenal S2, Madrid)"
                placeholderTextColor="#999"
                value={newName}
                onChangeText={setNewName}
                autoFocus
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

      {/* ─── RENAME SAVE PROFILE MODAL ──────────────── */}
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
              <Text style={styles.modalTitle}>RENAME SAVE PROFIL</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Nama Save Baru"
                placeholderTextColor="#999"
                value={renameName}
                onChangeText={setRenameName}
                autoFocus
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

      {/* ─── ADD/EDIT WATCHLIST MODAL ───────────────── */}
      <Modal
        visible={showWatchModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowWatchModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowWatchModal(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalCenter}>
            <Pressable style={styles.formModalCard} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.modalTitle}>
                {watchEditTarget ? 'EDIT TARGET TRANSFER' : 'TAMBAH TARGET TRANSFER'}
              </Text>

              <Text style={styles.fieldLabel}>PILIH POSISI TARGET:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {positions.map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.posSelectChip, wPosId === p.id && styles.posSelectChipActive]}
                      onPress={() => setWPosId(p.id)}>
                      <Text
                        style={[
                          styles.posSelectChipText,
                          wPosId === p.id && styles.posSelectChipTextActive,
                        ]}>
                        {p.nama}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>OVR MIN:</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="78"
                    placeholderTextColor="#999"
                    value={wOvrMin}
                    onChangeText={setWOvrMin}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>OVR MAX:</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="84"
                    placeholderTextColor="#999"
                    value={wOvrMax}
                    onChangeText={setWOvrMax}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>TARGET PENGGANTI PEMAIN (OPSIONAL):</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity
                    style={[styles.posSelectChip, wTerkaitPlayerId === null && styles.posSelectChipActive]}
                    onPress={() => setWTerkaitPlayerId(null)}>
                    <Text
                      style={[
                        styles.posSelectChipText,
                        wTerkaitPlayerId === null && styles.posSelectChipTextActive,
                      ]}>
                      Tanpa Pengganti
                    </Text>
                  </TouchableOpacity>
                  {players
                    .filter((p) => p.status === 'akan_dijual' || p.status === 'aktif')
                    .map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        style={[
                          styles.posSelectChip,
                          wTerkaitPlayerId === p.id && styles.posSelectChipActive,
                        ]}
                        onPress={() => setWTerkaitPlayerId(p.id)}>
                        <Text
                          style={[
                            styles.posSelectChipText,
                            wTerkaitPlayerId === p.id && styles.posSelectChipTextActive,
                          ]}>
                          {p.nama} ({p.ovr_current})
                        </Text>
                      </TouchableOpacity>
                    ))}
                </View>
              </ScrollView>

              <Text style={styles.fieldLabel}>CATATAN TARGET:</Text>
              <TextInput
                style={[styles.modalInput, { height: 60 }]}
                placeholder="misal: Butuh gelandang dengan visi umpan tinggi"
                placeholderTextColor="#999"
                value={wCatatan}
                onChangeText={setWCatatan}
                multiline
              />

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

      {/* ─── EXPORT MODAL ───────────────────────────── */}
      <Modal
        visible={showExportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowExportModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowExportModal(false)}>
          <View style={styles.exportModalCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.exportModalTitle}>{exportTitle}</Text>
            <ScrollView style={styles.exportScrollBox}>
              <Text style={styles.exportContentText} selectable>
                {exportContent}
              </Text>
            </ScrollView>
            <TouchableOpacity
              style={styles.exportCloseBtn}
              onPress={() => setShowExportModal(false)}>
              <Text style={styles.exportCloseBtnText}>TUTUP</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ─── IMPORT JSON MODAL ──────────────────────── */}
      <Modal
        visible={showImportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowImportModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowImportModal(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalCenter}>
            <Pressable style={styles.exportModalCard} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.exportModalTitle}>IMPOR PROFIL DARI JSON</Text>
              <TextInput
                style={styles.importInput}
                placeholder="Paste teks JSON profil di sini..."
                placeholderTextColor="#999"
                value={importJsonText}
                onChangeText={setImportJsonText}
                multiline
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowImportModal(false)}>
                  <Text style={styles.modalCancelText}>BATAL</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalConfirmBtn, { backgroundColor: '#137333' }]}
                  onPress={handleExecuteImport}
                  disabled={isImporting}>
                  {isImporting ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={[styles.modalConfirmText, { color: '#FFF' }]}>IMPOR</Text>
                  )}
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

  // Menu Hub (Vertical List)
  menuHubContent: {
    padding: 16,
    paddingBottom: 150,
  },
  menuHubHeader: {
    backgroundColor: '#0A1128',
    borderWidth: 3,
    borderColor: '#000',
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  menuHubTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#D4AF37',
    letterSpacing: 1.5,
  },
  menuHubSubtitle: {
    fontSize: 11,
    color: '#E0E0E0',
    marginTop: 4,
    lineHeight: 16,
  },
  activeSaveBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#D4AF37',
  },
  activeSaveLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#D4AF37',
    marginRight: 6,
  },
  activeSaveVal: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  // Vertical Menu Cards
  verticalMenuList: {
    gap: 12,
  },
  verticalMenuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAFAFA',
    borderWidth: 2.5,
    borderColor: '#000',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  menuCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  menuIconBox: {
    width: 44,
    height: 44,
    backgroundColor: '#0A1128',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 2,
    borderColor: '#000',
  },
  menuIconText: {
    fontSize: 20,
  },
  menuCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  menuCardTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 0.5,
  },
  menuCountBadge: {
    backgroundColor: '#D4AF37',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#000',
  },
  menuCountText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#000',
  },
  menuCardDesc: {
    fontSize: 11,
    color: '#666',
    lineHeight: 15,
  },
  menuArrow: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0A1128',
  },

  // Sub Screen Structure
  sectionContainer: {
    flex: 1,
  },
  backNavBar: {
    backgroundColor: '#0A1128',
    padding: 14,
    borderBottomWidth: 3,
    borderBottomColor: '#000',
  },
  backNavBtn: {
    backgroundColor: '#D4AF37',
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderColor: '#000',
    marginBottom: 6,
  },
  backNavBtnText: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 0.5,
  },
  subScreenTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },

  listContent: {
    padding: 16,
    paddingBottom: 150,
  },
  subSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  subSectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 1,
  },
  subSectionActionBtn: {
    backgroundColor: '#0A1128',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: '#000',
  },
  subSectionActionBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#D4AF37',
  },

  // Profile Card
  profileCard: {
    backgroundColor: '#FAFAFA',
    borderWidth: 2,
    borderColor: '#000',
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  profileCardActive: {
    backgroundColor: '#F0F4FF',
    borderColor: '#0A1128',
    borderWidth: 2.5,
  },
  profileCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0A1128',
  },
  profileMeta: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  activeTag: {
    backgroundColor: '#D4AF37',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#000',
  },
  activeTagText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#000',
  },
  profileActions: {
    flexDirection: 'row',
    gap: 8,
  },
  switchBtn: {
    flex: 1,
    backgroundColor: '#0A1128',
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#000',
  },
  switchBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#D4AF37',
  },
  editBtn: {
    borderWidth: 1.5,
    borderColor: '#000',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFF',
  },
  editBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0A1128',
  },
  deleteBtn: {
    borderWidth: 1.5,
    borderColor: '#C5221F',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFF',
  },
  deleteBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#C5221F',
  },

  // Watchlist Card
  watchCard: {
    backgroundColor: '#FAFAFA',
    borderWidth: 2,
    borderColor: '#000',
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  watchCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  watchPosBadge: {
    width: 40,
    height: 40,
    backgroundColor: '#0A1128',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#000',
  },
  watchPosBadgeText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#D4AF37',
  },
  watchTargetOvr: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0A1128',
  },
  watchReplace: {
    fontSize: 11,
    color: '#B06000',
    fontWeight: '700',
    marginTop: 1,
  },
  watchNoteBox: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#DDD',
    padding: 8,
    marginBottom: 8,
  },
  watchNoteText: {
    fontSize: 11,
    color: '#555',
    fontStyle: 'italic',
  },
  watchActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  watchEditBtn: {
    borderWidth: 1.5,
    borderColor: '#000',
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#FFF',
  },
  watchEditBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0A1128',
  },
  watchDeleteBtn: {
    borderWidth: 1.5,
    borderColor: '#C5221F',
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#FFF',
  },
  watchDeleteBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#C5221F',
  },

  // Backup Card
  backupCard: {
    backgroundColor: '#FAFAFA',
    borderWidth: 2,
    borderColor: '#000',
    padding: 14,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  backupCardTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  backupCardDesc: {
    fontSize: 11,
    color: '#666',
    lineHeight: 16,
    marginBottom: 12,
  },
  backupBtn: {
    backgroundColor: '#0A1128',
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#000',
  },
  backupBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#D4AF37',
    letterSpacing: 1,
  },

  // Developer Card
  devCard: {
    backgroundColor: '#0A1128',
    borderWidth: 3,
    borderColor: '#000',
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  devBadge: {
    backgroundColor: '#D4AF37',
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#000',
    marginBottom: 8,
  },
  devBadgeText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1,
  },
  devName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  devRole: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D4AF37',
    marginTop: 2,
  },
  devDivider: {
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: 12,
  },
  devBio: {
    fontSize: 12,
    color: '#E0E0E0',
    lineHeight: 18,
  },

  // About App Card
  aboutCard: {
    backgroundColor: '#FAFAFA',
    borderWidth: 2,
    borderColor: '#000',
    padding: 16,
  },
  aboutTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 1,
  },
  aboutVersion: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  aboutDivider: {
    height: 1.5,
    backgroundColor: '#DDD',
    marginVertical: 12,
  },
  aboutFeatureTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  aboutBullet: {
    fontSize: 11.5,
    color: '#444',
    lineHeight: 18,
    marginBottom: 4,
  },

  // Empty State
  emptyCard: {
    backgroundColor: '#FAFAFA',
    borderWidth: 2,
    borderColor: '#000',
    padding: 24,
    alignItems: 'center',
    marginTop: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0A1128',
  },
  emptySub: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 16,
  },

  // Modals & Forms
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
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 1,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0A1128',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  modalInput: {
    borderWidth: 2,
    borderColor: '#000',
    padding: 10,
    fontSize: 13,
    fontWeight: '600',
    color: '#0A1128',
    backgroundColor: '#FAFAFA',
    marginBottom: 12,
  },
  posSelectChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F0F0F0',
    borderWidth: 1.5,
    borderColor: '#000',
  },
  posSelectChipActive: {
    backgroundColor: '#0A1128',
  },
  posSelectChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0A1128',
  },
  posSelectChipTextActive: {
    color: '#D4AF37',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
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
    fontSize: 12,
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
    fontSize: 12,
    fontWeight: '900',
    color: '#000',
  },

  // Export / Import Modals
  exportModalCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#000',
    width: '90%',
    maxHeight: '80%',
    padding: 18,
  },
  exportModalTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0A1128',
    marginBottom: 12,
  },
  exportScrollBox: {
    backgroundColor: '#F5F5F5',
    borderWidth: 2,
    borderColor: '#000',
    padding: 12,
    maxHeight: 350,
    marginBottom: 12,
  },
  exportContentText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    color: '#0A1128',
    lineHeight: 16,
  },
  exportCloseBtn: {
    backgroundColor: '#0A1128',
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
  },
  exportCloseBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  importInput: {
    borderWidth: 2,
    borderColor: '#000',
    padding: 10,
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#0A1128',
    backgroundColor: '#FAFAFA',
    height: 180,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
});
