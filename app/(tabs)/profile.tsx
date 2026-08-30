import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { listPlayers, updatePlayer, deletePlayer } from '@/src/services/playerService';
import type { Profile, Position, PlayerWithPositions } from '@/src/types';

type MenuTab = 'profiles' | 'watchlist' | 'sold_players' | 'backup' | 'about';

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

  // Watchlist & Players State
  const [watchlist, setWatchlist] = useState<WatchlistWithDetails[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [players, setPlayers] = useState<PlayerWithPositions[]>([]);
  const [wLoading, setWLoading] = useState(false);

  // Watchlist Filter State in List
  const [wSearchQuery, setWSearchQuery] = useState('');
  const [wFilterPos, setWFilterPos] = useState('ALL');
  const [showWFilterPosModal, setShowWFilterPosModal] = useState(false);

  // Watchlist Add/Edit Form State
  const [showWatchModal, setShowWatchModal] = useState(false);
  const [watchEditTarget, setWatchEditTarget] = useState<WatchlistWithDetails | null>(null);
  const [wNamaTarget, setWNamaTarget] = useState('');
  const [wPosId, setWPosId] = useState('');
  const [wOvrMin, setWOvrMin] = useState('');
  const [wOvrMax, setWOvrMax] = useState('');
  const [wCatatan, setWCatatan] = useState('');
  const [wTerkaitPlayerId, setWTerkaitPlayerId] = useState<string | null>(null);

  // Pickers Modals inside Watchlist Form (No more horizontal scrolling)
  const [showPosPickerModal, setShowPosPickerModal] = useState(false);
  const [showPlayerPickerModal, setShowPlayerPickerModal] = useState(false);
  const [playerPickerSearch, setPlayerPickerSearch] = useState('');

  const loadData = useCallback(async () => {
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
      console.error('[MoreMenuScreen] loadData error:', e);
    } finally {
      setWLoading(false);
    }
  }, [activeProfile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived sold players
  const soldPlayers = useMemo(() => {
    return players.filter((p) => p.status === 'sudah_dijual');
  }, [players]);

  // Categorized Positions for Modals
  const gkPositions = useMemo(() => positions.filter((p) => p.nama.toUpperCase() === 'GK'), [positions]);
  const defPositions = useMemo(
    () => positions.filter((p) => ['LB', 'LWB', 'CB', 'RB', 'RWB'].includes(p.nama.toUpperCase())),
    [positions]
  );
  const midPositions = useMemo(
    () => positions.filter((p) => ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(p.nama.toUpperCase())),
    [positions]
  );
  const attPositions = useMemo(
    () =>
      positions.filter((p) => ['LW', 'RW', 'LF', 'RF', 'CF', 'ST'].includes(p.nama.toUpperCase())),
    [positions]
  );
  const otherPositions = useMemo(
    () =>
      positions.filter(
        (p) =>
          !['GK', 'LB', 'LWB', 'CB', 'RB', 'RWB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'LF', 'RF', 'CF', 'ST'].includes(
            p.nama.toUpperCase()
          )
      ),
    [positions]
  );

  // Filtered Watchlist in List View
  const filteredWatchlist = useMemo(() => {
    return watchlist.filter((item) => {
      if (wFilterPos !== 'ALL' && item.position_id !== wFilterPos) return false;
      if (wSearchQuery.trim()) {
        const q = wSearchQuery.toLowerCase();
        const matchName = item.nama_target?.toLowerCase().includes(q);
        const matchPos = item.position_nama?.toLowerCase().includes(q);
        const matchTerkait = item.terkait_player_nama?.toLowerCase().includes(q);
        const matchNote = item.catatan?.toLowerCase().includes(q);
        if (!matchName && !matchPos && !matchTerkait && !matchNote) return false;
      }
      return true;
    });
  }, [watchlist, wFilterPos, wSearchQuery]);

  // Selected details for Form Display
  const selectedFormPos = positions.find((p) => p.id === wPosId);
  const selectedFormPlayer = players.find((p) => p.id === wTerkaitPlayerId);
  const selectedFilterPosObj = positions.find((p) => p.id === wFilterPos);

  // Filtered players inside Player Replacement Picker Modal
  const pickerFilteredPlayers = useMemo(() => {
    return players
      .filter((p) => p.status !== 'sudah_dijual')
      .filter((p) => {
        if (!playerPickerSearch.trim()) return true;
        const q = playerPickerSearch.toLowerCase();
        return (
          p.nama.toLowerCase().includes(q) ||
          p.positions.some((pos) => pos.nama.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        // Show 'akan_dijual' first as recommendation
        if (a.status === 'akan_dijual' && b.status !== 'akan_dijual') return -1;
        if (b.status === 'akan_dijual' && a.status !== 'akan_dijual') return 1;
        return b.ovr_current - a.ovr_current;
      });
  }, [players, playerPickerSearch]);

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
    setWNamaTarget('');
    setWPosId(positions[0]?.id ?? '');
    setWOvrMin('78');
    setWOvrMax('83');
    setWCatatan('');
    setWTerkaitPlayerId(null);
    setShowWatchModal(true);
  }

  function openEditWatchlist(item: WatchlistWithDetails) {
    setWatchEditTarget(item);
    setWNamaTarget(item.nama_target ?? '');
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
          nama_target: wNamaTarget.trim() || null,
          position_id: wPosId,
          target_ovr_min: minNum,
          target_ovr_max: maxNum,
          terkait_player_id: wTerkaitPlayerId,
          catatan: wCatatan.trim() || null,
        });
      } else {
        await createWatchlist({
          profile_id: activeProfile.id,
          nama_target: wNamaTarget.trim() || null,
          position_id: wPosId,
          target_ovr_min: minNum,
          target_ovr_max: maxNum,
          terkait_player_id: wTerkaitPlayerId,
          catatan: wCatatan.trim() || null,
        });
      }
      setShowWatchModal(false);
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Gagal menyimpan target transfer');
    }
  }

  function handleDeleteWatchlist(item: WatchlistWithDetails) {
    Alert.alert(
      'Hapus Target',
      `Hapus target transfer ${item.nama_target || item.position_nama}?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteWatchlist(item.id);
              loadData();
            } catch (e) {
              Alert.alert('Error', 'Gagal menghapus target');
            }
          },
        },
      ]
    );
  }

  // ─── Sold Players Handlers ────────────────────────
  async function handleRevertSoldPlayer(player: PlayerWithPositions) {
    Alert.alert(
      'Kembalikan ke Skuad',
      `Kembalikan status "${player.nama}" menjadi AKTIF di skuad?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Kembalikan',
          onPress: async () => {
            try {
              await updatePlayer(player.id, {
                nama: player.nama,
                ovr_current: player.ovr_current,
                status: 'aktif',
                status_durasi: null,
                status_mulai: null,
                status_catatan: null,
                position_ids: player.positions.map((p) => p.id),
              });
              loadData();
              Alert.alert('Sukses', `Pemain "${player.nama}" kini kembali aktif di skuad.`);
            } catch (e) {
              Alert.alert('Error', 'Gagal mengembalikan status pemain');
            }
          },
        },
      ]
    );
  }

  function handleDeleteSoldPlayerPermanently(player: PlayerWithPositions) {
    Alert.alert(
      'Hapus Permanen',
      `Hapus "${player.nama}" secara permanen dari database?\nData riwayat OVR pemain ini akan hilang.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus Permanen',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePlayer(player.id);
              loadData();
            } catch (e) {
              Alert.alert('Error', 'Gagal menghapus pemain');
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
              Pusat konfigurasi, target transfer, arsip pemain terjual, backup data, dan informasi pengembang.
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
                    Catat nama pemain incaran, posisi target, target range OVR, dan pengganti pemain.
                  </Text>
                </View>
              </View>
              <Text style={styles.menuArrow}>➔</Text>
            </TouchableOpacity>

            {/* 3. Pemain Terjual (Arsip Penjualan) */}
            <TouchableOpacity
              style={styles.verticalMenuCard}
              onPress={() => setActiveMenu('sold_players')}
              activeOpacity={0.8}>
              <View style={styles.menuCardLeft}>
                <View style={[styles.menuIconBox, { backgroundColor: '#5F6368' }]}>
                  <Text style={styles.menuIconText}>🏷️</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.menuCardTitleRow}>
                    <Text style={styles.menuCardTitle}>PEMAIN TERJUAL</Text>
                    <View style={[styles.menuCountBadge, { backgroundColor: '#5F6368' }]}>
                      <Text style={[styles.menuCountText, { color: '#FFF' }]}>
                        {soldPlayers.length} Terjual
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.menuCardDesc}>
                    Arsip pemain yang telah dilepas dari klub. Otomatis tidak dihitung dalam kuota skuad.
                  </Text>
                </View>
              </View>
              <Text style={styles.menuArrow}>➔</Text>
            </TouchableOpacity>

            {/* 4. Backup & Ekspor */}
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

            {/* 5. Tentang & Dev */}
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
              {activeMenu === 'sold_players' && '🏷️ PEMAIN TERJUAL'}
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
            <View style={{ flex: 1 }}>
              {/* Filter & Search Bar */}
              <View style={styles.wFilterContainer}>
                {/* Search Bar */}
                <View style={styles.wSearchRow}>
                  <TextInput
                    style={styles.wSearchInput}
                    placeholder="🔍 Cari nama target, posisi, pengganti..."
                    placeholderTextColor="#888"
                    value={wSearchQuery}
                    onChangeText={setWSearchQuery}
                    returnKeyType="search"
                  />
                  {wSearchQuery.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setWSearchQuery('')}
                      style={styles.wSearchClearBtn}>
                      <Text style={styles.wSearchClearText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Filter & Add Button Row */}
                <View style={styles.wFilterActionRow}>
                  {/* Position Filter Button */}
                  <TouchableOpacity
                    style={[
                      styles.wFilterBigBtn,
                      wFilterPos !== 'ALL' && styles.wFilterBigBtnActive,
                    ]}
                    onPress={() => setShowWFilterPosModal(true)}
                    activeOpacity={0.8}>
                    <Text
                      style={[
                        styles.wFilterBigBtnText,
                        wFilterPos !== 'ALL' && styles.wFilterBigBtnTextActive,
                      ]}
                      numberOfLines={1}>
                      📍 POSISI: {wFilterPos === 'ALL' ? 'SEMUA' : selectedFilterPosObj?.nama ?? 'POSISI'} ▾
                    </Text>
                  </TouchableOpacity>

                  {/* Add Target Button */}
                  <TouchableOpacity
                    style={styles.wAddTargetBtn}
                    onPress={openAddWatchlist}
                    activeOpacity={0.8}>
                    <Text style={styles.wAddTargetBtnText}>+ TAMBAH TARGET</Text>
                  </TouchableOpacity>
                </View>

                {/* Active Filter Tags */}
                {(wFilterPos !== 'ALL' || wSearchQuery.trim() !== '') && (
                  <View style={styles.wActiveTagsRow}>
                    <Text style={styles.wActiveTagHeader}>FILTER AKTIF:</Text>
                    {wFilterPos !== 'ALL' && (
                      <TouchableOpacity
                        style={styles.wActiveTagChip}
                        onPress={() => setWFilterPos('ALL')}>
                        <Text style={styles.wActiveTagChipText}>
                          POSISI: {selectedFilterPosObj?.nama ?? wFilterPos} ✕
                        </Text>
                      </TouchableOpacity>
                    )}
                    {wSearchQuery.trim() !== '' && (
                      <TouchableOpacity
                        style={styles.wActiveTagChip}
                        onPress={() => setWSearchQuery('')}>
                        <Text style={styles.wActiveTagChipText}>
                          "{wSearchQuery}" ✕
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.wResetFilterChip}
                      onPress={() => {
                        setWFilterPos('ALL');
                        setWSearchQuery('');
                      }}>
                      <Text style={styles.wResetFilterChipText}>RESET</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Watchlist List */}
              {wLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#0A1128" />
                  <Text style={styles.loadingText}>Memuat target transfer...</Text>
                </View>
              ) : filteredWatchlist.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>
                    {watchlist.length === 0 ? 'Belum Ada Target Transfer' : 'Target Tidak Ditemukan'}
                  </Text>
                  <Text style={styles.emptySub}>
                    {watchlist.length === 0
                      ? 'Catat nama pemain yang ingin dibeli, target range OVR, dan pemain skuad yang akan digantikan.'
                      : 'Coba ganti filter posisi atau kata kunci pencarian.'}
                  </Text>
                  {(wFilterPos !== 'ALL' || wSearchQuery.trim() !== '') && (
                    <TouchableOpacity
                      style={styles.emptyResetBtn}
                      onPress={() => {
                        setWFilterPos('ALL');
                        setWSearchQuery('');
                      }}>
                      <Text style={styles.emptyResetBtnText}>RESET FILTER</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
                  <Text style={styles.wCountSummary}>
                    MENAMPILKAN {filteredWatchlist.length} DARI {watchlist.length} TARGET TRANSFER
                  </Text>

                  {filteredWatchlist.map((item) => (
                    <View key={item.id} style={styles.watchCard}>
                      {/* Top Header: Target Name & Position Badge */}
                      <View style={styles.watchCardTop}>
                        <View style={styles.watchPosBadge}>
                          <Text style={styles.watchPosBadgeText}>{item.position_nama}</Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={styles.watchPlayerNameHeader}>
                            {item.nama_target ? item.nama_target : `Target Pemain (${item.position_nama})`}
                          </Text>
                          <View style={styles.watchTargetOvrBadge}>
                            <Text style={styles.watchTargetOvrBadgeText}>
                              TARGET OVR:{' '}
                              {item.target_ovr_min && item.target_ovr_max
                                ? `${item.target_ovr_min} – ${item.target_ovr_max}`
                                : item.target_ovr_min
                                ? `Min ${item.target_ovr_min}`
                                : item.target_ovr_max
                                ? `Max ${item.target_ovr_max}`
                                : 'Bebas'}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Replacement Player Row */}
                      {item.terkait_player_nama ? (
                        <View style={styles.watchReplaceBox}>
                          <Text style={styles.watchReplaceLabel}>🔄 AKAN MENGGANTIKAN:</Text>
                          <Text style={styles.watchReplaceValue}>
                            {item.terkait_player_nama} (OVR {item.terkait_player_ovr ?? '-'})
                            {item.terkait_player_status === 'akan_dijual' && ' • [AKAN DIJUAL]'}
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.watchNoReplaceBox}>
                          <Text style={styles.watchNoReplaceText}>
                            ➕ Tambahan Skuad (Tanpa Menggantikan Pemain)
                          </Text>
                        </View>
                      )}

                      {/* Notes Box */}
                      {item.catatan ? (
                        <View style={styles.watchNoteBox}>
                          <Text style={styles.watchNoteLabel}>📝 Catatan:</Text>
                          <Text style={styles.watchNoteText}>"{item.catatan}"</Text>
                        </View>
                      ) : null}

                      {/* Actions */}
                      <View style={styles.watchActions}>
                        <TouchableOpacity
                          style={styles.watchEditBtn}
                          onPress={() => openEditWatchlist(item)}>
                          <Text style={styles.watchEditBtnText}>✏️ Edit Target</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.watchDeleteBtn}
                          onPress={() => handleDeleteWatchlist(item)}>
                          <Text style={styles.watchDeleteBtnText}>🗑️ Hapus</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* ─── 3. PEMAIN TERJUAL SECTION ─────────────── */}
          {activeMenu === 'sold_players' && (
            <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
              <View style={styles.soldBanner}>
                <Text style={styles.soldBannerTitle}>🏷️ ARSIP PENJUALAN PEMAIN ({soldPlayers.length})</Text>
                <Text style={styles.soldBannerDesc}>
                  Pemain di bawah ini telah dilepas dari klub. Mereka otomatis tidak dihitung dalam kuota skuad di dashboard dan tidak akan masuk ke Team Sheet saat auto-generate.
                </Text>
              </View>

              {soldPlayers.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>Belum Ada Pemain Terjual</Text>
                  <Text style={styles.emptySub}>
                    Untuk mengarsipkan penjualan pemain, ubah status pemain menjadi "Sudah Dijual" di tab Pemain.
                  </Text>
                </View>
              ) : (
                soldPlayers.map((player) => {
                  const primaryPos = player.positions[0]?.nama ?? '-';
                  return (
                    <View key={player.id} style={styles.soldCard}>
                      <View style={styles.soldCardMain}>
                        <View style={styles.soldOvrBadge}>
                          <Text style={styles.soldOvrNum}>{player.ovr_current}</Text>
                          <Text style={styles.soldPosText}>{primaryPos}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.soldPlayerName}>{player.nama}</Text>
                          <Text style={styles.soldStatusTag}>SUDAH DIJUAL / DILEPAS</Text>
                          {player.status_catatan && (
                            <Text style={styles.soldNote}>Catatan: {player.status_catatan}</Text>
                          )}
                        </View>
                      </View>

                      <View style={styles.soldActions}>
                        <TouchableOpacity
                          style={styles.revertBtn}
                          onPress={() => handleRevertSoldPlayer(player)}>
                          <Text style={styles.revertBtnText}>🔄 Kembalikan ke Skuad</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.soldDeleteBtn}
                          onPress={() => handleDeleteSoldPlayerPermanently(player)}>
                          <Text style={styles.soldDeleteBtnText}>🗑️ Hapus Permanen</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}

          {/* ─── 4. BACKUP & RESTORE SECTION ───────────── */}
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
                  Jika data profil default Anda kosong, tekan tombol ini untuk mengisi ulang 44 pemain, 24 formasi, dan skuad Career Mode.
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

          {/* ─── 5. TENTANG & DEV SECTION ──────────────── */}
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
                <Text style={styles.aboutVersion}>Versi 1.0.0 (Build Final iOS & Android)</Text>
                <View style={styles.aboutDivider} />

                <Text style={styles.aboutFeatureTitle}>FITUR UTAMA APLIKASI:</Text>
                <Text style={styles.aboutBullet}>• ⚡ Auto-Generate Team Sheet Berdasarkan OVR & Status</Text>
                <Text style={styles.aboutBullet}>• 📋 24 Formasi Resmi FC 26 & 8 Tactical Visions</Text>
                <Text style={styles.aboutBullet}>• 🧪 Simulator Taktis & Analisis Kecocokan Formasi</Text>
                <Text style={styles.aboutBullet}>• 📊 Monitor Kebutuhan Kuota Posisi (Dual-Mode)</Text>
                <Text style={styles.aboutBullet}>• 📁 Multi-Save Career Mode Profile Manager</Text>
                <Text style={styles.aboutBullet}>• 🎯 Transfer Watchlist & Pengganti Pemain</Text>
                <Text style={styles.aboutBullet}>• 🏷️ Arsip Penjualan Pemain Terjual</Text>
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

      {/* ─── ADD/EDIT WATCHLIST MODAL (REVAMPED CLEAN FORM) ── */}
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
                {watchEditTarget ? '✏️ EDIT TARGET TRANSFER' : '🎯 TAMBAH TARGET TRANSFER'}
              </Text>

              <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
                {/* Field 1: Nama Pemain Target */}
                <Text style={styles.fieldLabel}>NAMA PEMAIN TARGET (MISAL: F. WIRTZ / MBAPPÉ):</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Masukkan nama target transfer..."
                  placeholderTextColor="#999"
                  value={wNamaTarget}
                  onChangeText={setWNamaTarget}
                />

                {/* Field 2: Posisi Target (Large Trigger Button) */}
                <Text style={styles.fieldLabel}>POSISI TARGET:</Text>
                <TouchableOpacity
                  style={styles.selectorTriggerBtn}
                  onPress={() => setShowPosPickerModal(true)}
                  activeOpacity={0.8}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={styles.selectorTriggerBadge}>
                      <Text style={styles.selectorTriggerBadgeText}>
                        {selectedFormPos?.nama ?? 'POSISI'}
                      </Text>
                    </View>
                    <Text style={styles.selectorTriggerText}>
                      {selectedFormPos ? `Posisi: ${selectedFormPos.nama}` : 'Pilih Posisi'}
                    </Text>
                  </View>
                  <Text style={styles.selectorTriggerArrow}>UBAH ▾</Text>
                </TouchableOpacity>

                {/* Field 3: Target OVR Range */}
                <View style={{ flexDirection: 'row', gap: 10, marginVertical: 12 }}>
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

                {/* Field 4: Pemain yang Akan Digantikan (Large Trigger Button) */}
                <Text style={styles.fieldLabel}>AKAN MENGGANTIKAN PEMAIN (OPSIONAL):</Text>
                <TouchableOpacity
                  style={styles.selectorTriggerBtn}
                  onPress={() => {
                    setPlayerPickerSearch('');
                    setShowPlayerPickerModal(true);
                  }}
                  activeOpacity={0.8}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <View
                      style={[
                        styles.selectorTriggerBadge,
                        { backgroundColor: selectedFormPlayer ? '#0A1128' : '#666' },
                      ]}>
                      <Text style={styles.selectorTriggerBadgeText}>
                        {selectedFormPlayer ? `OVR ${selectedFormPlayer.ovr_current}` : 'SKUAD'}
                      </Text>
                    </View>
                    <Text style={styles.selectorTriggerText} numberOfLines={1}>
                      {selectedFormPlayer
                        ? `${selectedFormPlayer.nama} (${selectedFormPlayer.positions[0]?.nama ?? '-'})`
                        : 'Tanpa Pengganti (Tambahan Skuad)'}
                    </Text>
                  </View>
                  <Text style={styles.selectorTriggerArrow}>PILIH ▾</Text>
                </TouchableOpacity>

                {/* Field 5: Catatan Target */}
                <Text style={[styles.fieldLabel, { marginTop: 12 }]}>CATATAN TRANSFER:</Text>
                <TextInput
                  style={[styles.modalInput, { height: 65, textAlignVertical: 'top' }]}
                  placeholder="misal: Klausul rilis, butuh playmaker pengganti, dll."
                  placeholderTextColor="#999"
                  value={wCatatan}
                  onChangeText={setWCatatan}
                  multiline
                />
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowWatchModal(false)}>
                  <Text style={styles.modalCancelText}>BATAL</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleSaveWatchlist}>
                  <Text style={styles.modalConfirmText}>SIMPAN TARGET</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* ─── POSITION FILTER MODAL FOR WATCHLIST LIST ─ */}
      <Modal
        visible={showWFilterPosModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWFilterPosModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowWFilterPosModal(false)}>
          <View style={styles.filterModalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>FILTER POSISI TARGET TRANSFER</Text>
              <TouchableOpacity onPress={() => setShowWFilterPosModal(false)} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {/* Option: Semua Posisi */}
              <TouchableOpacity
                style={[styles.posGroupAllBtn, wFilterPos === 'ALL' && styles.posGroupAllBtnActive]}
                onPress={() => {
                  setWFilterPos('ALL');
                  setShowWFilterPosModal(false);
                }}>
                <Text style={[styles.posGroupAllText, wFilterPos === 'ALL' && styles.posGroupAllTextActive]}>
                  🔘 SEMUA POSISI ({watchlist.length} Target)
                </Text>
              </TouchableOpacity>

              {/* Group: Kiper */}
              {gkPositions.length > 0 && (
                <View style={styles.posCategorySection}>
                  <Text style={styles.posCategoryHeader}>🧤 PENJAGA GAWANG</Text>
                  <View style={styles.posCategoryGrid}>
                    {gkPositions.map((pos) => {
                      const count = watchlist.filter((w) => w.position_id === pos.id).length;
                      const isSelected = wFilterPos === pos.id;
                      return (
                        <TouchableOpacity
                          key={pos.id}
                          style={[styles.bigPosChip, isSelected && styles.bigPosChipActive]}
                          onPress={() => {
                            setWFilterPos(pos.id);
                            setShowWFilterPosModal(false);
                          }}>
                          <Text style={[styles.bigPosChipName, isSelected && styles.bigPosChipNameActive]}>
                            {pos.nama}
                          </Text>
                          <Text style={[styles.bigPosChipCount, isSelected && styles.bigPosChipCountActive]}>
                            {count}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Group: Bek */}
              {defPositions.length > 0 && (
                <View style={styles.posCategorySection}>
                  <Text style={styles.posCategoryHeader}>🛡️ BEK (DEFENDER)</Text>
                  <View style={styles.posCategoryGrid}>
                    {defPositions.map((pos) => {
                      const count = watchlist.filter((w) => w.position_id === pos.id).length;
                      const isSelected = wFilterPos === pos.id;
                      return (
                        <TouchableOpacity
                          key={pos.id}
                          style={[styles.bigPosChip, isSelected && styles.bigPosChipActive]}
                          onPress={() => {
                            setWFilterPos(pos.id);
                            setShowWFilterPosModal(false);
                          }}>
                          <Text style={[styles.bigPosChipName, isSelected && styles.bigPosChipNameActive]}>
                            {pos.nama}
                          </Text>
                          <Text style={[styles.bigPosChipCount, isSelected && styles.bigPosChipCountActive]}>
                            {count}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Group: Gelandang */}
              {midPositions.length > 0 && (
                <View style={styles.posCategorySection}>
                  <Text style={styles.posCategoryHeader}>⚙️ GELANDANG (MIDFIELDER)</Text>
                  <View style={styles.posCategoryGrid}>
                    {midPositions.map((pos) => {
                      const count = watchlist.filter((w) => w.position_id === pos.id).length;
                      const isSelected = wFilterPos === pos.id;
                      return (
                        <TouchableOpacity
                          key={pos.id}
                          style={[styles.bigPosChip, isSelected && styles.bigPosChipActive]}
                          onPress={() => {
                            setWFilterPos(pos.id);
                            setShowWFilterPosModal(false);
                          }}>
                          <Text style={[styles.bigPosChipName, isSelected && styles.bigPosChipNameActive]}>
                            {pos.nama}
                          </Text>
                          <Text style={[styles.bigPosChipCount, isSelected && styles.bigPosChipCountActive]}>
                            {count}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Group: Penyerang */}
              {attPositions.length > 0 && (
                <View style={styles.posCategorySection}>
                  <Text style={styles.posCategoryHeader}>⚡ PENYERANG (ATTACKER)</Text>
                  <View style={styles.posCategoryGrid}>
                    {attPositions.map((pos) => {
                      const count = watchlist.filter((w) => w.position_id === pos.id).length;
                      const isSelected = wFilterPos === pos.id;
                      return (
                        <TouchableOpacity
                          key={pos.id}
                          style={[styles.bigPosChip, isSelected && styles.bigPosChipActive]}
                          onPress={() => {
                            setWFilterPos(pos.id);
                            setShowWFilterPosModal(false);
                          }}>
                          <Text style={[styles.bigPosChipName, isSelected && styles.bigPosChipNameActive]}>
                            {pos.nama}
                          </Text>
                          <Text style={[styles.bigPosChipCount, isSelected && styles.bigPosChipCountActive]}>
                            {count}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Other positions */}
              {otherPositions.length > 0 && (
                <View style={styles.posCategorySection}>
                  <Text style={styles.posCategoryHeader}>LAINNYA</Text>
                  <View style={styles.posCategoryGrid}>
                    {otherPositions.map((pos) => {
                      const count = watchlist.filter((w) => w.position_id === pos.id).length;
                      const isSelected = wFilterPos === pos.id;
                      return (
                        <TouchableOpacity
                          key={pos.id}
                          style={[styles.bigPosChip, isSelected && styles.bigPosChipActive]}
                          onPress={() => {
                            setWFilterPos(pos.id);
                            setShowWFilterPosModal(false);
                          }}>
                          <Text style={[styles.bigPosChipName, isSelected && styles.bigPosChipNameActive]}>
                            {pos.nama}
                          </Text>
                          <Text style={[styles.bigPosChipCount, isSelected && styles.bigPosChipCountActive]}>
                            {count}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalBottomBtn}
              onPress={() => setShowWFilterPosModal(false)}>
              <Text style={styles.modalBottomBtnText}>TUTUP</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ─── POSITION PICKER MODAL FOR WATCHLIST FORM ── */}
      <Modal
        visible={showPosPickerModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPosPickerModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowPosPickerModal(false)}>
          <View style={styles.filterModalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>PILIH POSISI TARGET TRANSFER</Text>
              <TouchableOpacity onPress={() => setShowPosPickerModal(false)} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {/* Group: Kiper */}
              {gkPositions.length > 0 && (
                <View style={styles.posCategorySection}>
                  <Text style={styles.posCategoryHeader}>🧤 PENJAGA GAWANG</Text>
                  <View style={styles.posCategoryGrid}>
                    {gkPositions.map((pos) => (
                      <TouchableOpacity
                        key={pos.id}
                        style={[styles.bigPosChip, wPosId === pos.id && styles.bigPosChipActive]}
                        onPress={() => {
                          setWPosId(pos.id);
                          setShowPosPickerModal(false);
                        }}>
                        <Text style={[styles.bigPosChipName, wPosId === pos.id && styles.bigPosChipNameActive]}>
                          {pos.nama}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Group: Bek */}
              {defPositions.length > 0 && (
                <View style={styles.posCategorySection}>
                  <Text style={styles.posCategoryHeader}>🛡️ BEK (DEFENDER)</Text>
                  <View style={styles.posCategoryGrid}>
                    {defPositions.map((pos) => (
                      <TouchableOpacity
                        key={pos.id}
                        style={[styles.bigPosChip, wPosId === pos.id && styles.bigPosChipActive]}
                        onPress={() => {
                          setWPosId(pos.id);
                          setShowPosPickerModal(false);
                        }}>
                        <Text style={[styles.bigPosChipName, wPosId === pos.id && styles.bigPosChipNameActive]}>
                          {pos.nama}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Group: Gelandang */}
              {midPositions.length > 0 && (
                <View style={styles.posCategorySection}>
                  <Text style={styles.posCategoryHeader}>⚙️ GELANDANG (MIDFIELDER)</Text>
                  <View style={styles.posCategoryGrid}>
                    {midPositions.map((pos) => (
                      <TouchableOpacity
                        key={pos.id}
                        style={[styles.bigPosChip, wPosId === pos.id && styles.bigPosChipActive]}
                        onPress={() => {
                          setWPosId(pos.id);
                          setShowPosPickerModal(false);
                        }}>
                        <Text style={[styles.bigPosChipName, wPosId === pos.id && styles.bigPosChipNameActive]}>
                          {pos.nama}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Group: Penyerang */}
              {attPositions.length > 0 && (
                <View style={styles.posCategorySection}>
                  <Text style={styles.posCategoryHeader}>⚡ PENYERANG (ATTACKER)</Text>
                  <View style={styles.posCategoryGrid}>
                    {attPositions.map((pos) => (
                      <TouchableOpacity
                        key={pos.id}
                        style={[styles.bigPosChip, wPosId === pos.id && styles.bigPosChipActive]}
                        onPress={() => {
                          setWPosId(pos.id);
                          setShowPosPickerModal(false);
                        }}>
                        <Text style={[styles.bigPosChipName, wPosId === pos.id && styles.bigPosChipNameActive]}>
                          {pos.nama}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Other positions */}
              {otherPositions.length > 0 && (
                <View style={styles.posCategorySection}>
                  <Text style={styles.posCategoryHeader}>LAINNYA</Text>
                  <View style={styles.posCategoryGrid}>
                    {otherPositions.map((pos) => (
                      <TouchableOpacity
                        key={pos.id}
                        style={[styles.bigPosChip, wPosId === pos.id && styles.bigPosChipActive]}
                        onPress={() => {
                          setWPosId(pos.id);
                          setShowPosPickerModal(false);
                        }}>
                        <Text style={[styles.bigPosChipName, wPosId === pos.id && styles.bigPosChipNameActive]}>
                          {pos.nama}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalBottomBtn}
              onPress={() => setShowPosPickerModal(false)}>
              <Text style={styles.modalBottomBtnText}>TUTUP</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ─── PLAYER REPLACEMENT PICKER MODAL FOR WATCHLIST ─ */}
      <Modal
        visible={showPlayerPickerModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPlayerPickerModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowPlayerPickerModal(false)}>
          <View style={styles.filterModalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>PILIH PEMAIN YANG AKAN DIGANTIKAN</Text>
              <TouchableOpacity onPress={() => setShowPlayerPickerModal(false)} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Search Bar for Player Picker */}
            <View style={[styles.wSearchRow, { marginHorizontal: 0, marginBottom: 10 }]}>
              <TextInput
                style={styles.wSearchInput}
                placeholder="🔍 Cari pemain berdasarkan nama/posisi..."
                placeholderTextColor="#888"
                value={playerPickerSearch}
                onChangeText={setPlayerPickerSearch}
              />
              {playerPickerSearch.length > 0 && (
                <TouchableOpacity
                  onPress={() => setPlayerPickerSearch('')}
                  style={styles.wSearchClearBtn}>
                  <Text style={styles.wSearchClearText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              {/* Option: Tanpa Pengganti */}
              <TouchableOpacity
                style={[
                  styles.playerPickerItem,
                  wTerkaitPlayerId === null && styles.playerPickerItemActive,
                ]}
                onPress={() => {
                  setWTerkaitPlayerId(null);
                  setShowPlayerPickerModal(false);
                }}>
                <View style={styles.playerPickerItemLeft}>
                  <View style={[styles.playerPickerOvrBadge, { backgroundColor: '#666' }]}>
                    <Text style={styles.playerPickerOvrText}>-</Text>
                  </View>
                  <View>
                    <Text
                      style={[
                        styles.playerPickerName,
                        wTerkaitPlayerId === null && styles.playerPickerNameActive,
                      ]}>
                      Tanpa Pengganti
                    </Text>
                    <Text style={styles.playerPickerSub}>
                      Target transfer ini sebagai tambahan skuad baru
                    </Text>
                  </View>
                </View>
                {wTerkaitPlayerId === null && <Text style={styles.playerPickerCheck}>✓</Text>}
              </TouchableOpacity>

              {/* List of squad players */}
              {pickerFilteredPlayers.map((p) => {
                const isSelected = wTerkaitPlayerId === p.id;
                const primaryPos = p.positions[0]?.nama ?? '-';
                const isAkanDijual = p.status === 'akan_dijual';

                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.playerPickerItem,
                      isSelected && styles.playerPickerItemActive,
                      isAkanDijual && styles.playerPickerItemRecommended,
                    ]}
                    onPress={() => {
                      setWTerkaitPlayerId(p.id);
                      setShowPlayerPickerModal(false);
                    }}>
                    <View style={styles.playerPickerItemLeft}>
                      <View style={styles.playerPickerOvrBadge}>
                        <Text style={styles.playerPickerOvrText}>{p.ovr_current}</Text>
                        <Text style={styles.playerPickerPosText}>{primaryPos}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text
                            style={[
                              styles.playerPickerName,
                              isSelected && styles.playerPickerNameActive,
                            ]}>
                            {p.nama}
                          </Text>
                          {isAkanDijual && (
                            <View style={styles.akanDijualTag}>
                              <Text style={styles.akanDijualTagText}>AKAN DIJUAL</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.playerPickerSub}>
                          Posisi: {p.positions.map((pos) => pos.nama).join(', ')} • Status: {p.status.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    {isSelected && <Text style={styles.playerPickerCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalBottomBtn}
              onPress={() => setShowPlayerPickerModal(false)}>
              <Text style={styles.modalBottomBtnText}>TUTUP</Text>
            </TouchableOpacity>
          </View>
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

  // Watchlist Filters
  wFilterContainer: {
    padding: 12,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 2,
    borderBottomColor: '#000',
    gap: 8,
  },
  wSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#000',
    paddingHorizontal: 10,
    height: 42,
  },
  wSearchInput: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#0A1128',
  },
  wSearchClearBtn: {
    padding: 4,
  },
  wSearchClearText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#888',
  },
  wFilterActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  wFilterBigBtn: {
    flex: 1,
    height: 40,
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#000',
    justifyContent: 'center',
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  wFilterBigBtnActive: {
    backgroundColor: '#0A1128',
  },
  wFilterBigBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0A1128',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  wFilterBigBtnTextActive: {
    color: '#D4AF37',
  },
  wAddTargetBtn: {
    backgroundColor: '#D4AF37',
    borderWidth: 2,
    borderColor: '#000',
    height: 40,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  wAddTargetBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 0.5,
  },
  wActiveTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  wActiveTagHeader: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#0A1128',
  },
  wActiveTagChip: {
    backgroundColor: '#0A1128',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#000',
  },
  wActiveTagChipText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#D4AF37',
  },
  wResetFilterChip: {
    backgroundColor: '#C5221F',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#000',
  },
  wResetFilterChipText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#FFF',
  },
  wCountSummary: {
    fontSize: 10,
    fontWeight: '900',
    color: '#666',
    letterSpacing: 0.5,
    marginBottom: 10,
  },

  // Watchlist Card
  watchCard: {
    backgroundColor: '#FAFAFA',
    borderWidth: 2.5,
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
    marginBottom: 10,
  },
  watchPosBadge: {
    width: 44,
    height: 44,
    backgroundColor: '#0A1128',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
  },
  watchPosBadgeText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#D4AF37',
  },
  watchPlayerNameHeader: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 0.5,
  },
  watchTargetOvrBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#D4AF37',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#000',
    marginTop: 3,
  },
  watchTargetOvrBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#000',
  },
  watchReplaceBox: {
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: '#B06000',
    padding: 8,
    marginBottom: 8,
  },
  watchReplaceLabel: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#B06000',
  },
  watchReplaceValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0A1128',
    marginTop: 2,
  },
  watchNoReplaceBox: {
    backgroundColor: '#F0F4FF',
    borderWidth: 1,
    borderColor: '#0A1128',
    padding: 6,
    marginBottom: 8,
  },
  watchNoReplaceText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0A1128',
  },
  watchNoteBox: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#DDD',
    padding: 8,
    marginBottom: 8,
  },
  watchNoteLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#666',
    marginBottom: 2,
  },
  watchNoteText: {
    fontSize: 11,
    color: '#444',
    fontStyle: 'italic',
    lineHeight: 15,
  },
  watchActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 2,
  },
  watchEditBtn: {
    borderWidth: 1.5,
    borderColor: '#000',
    paddingHorizontal: 12,
    paddingVertical: 6,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFF',
  },
  watchDeleteBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#C5221F',
  },

  // Form Selector Trigger Button
  selectorTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAFAFA',
    borderWidth: 2,
    borderColor: '#000',
    padding: 10,
    marginBottom: 6,
  },
  selectorTriggerBadge: {
    backgroundColor: '#0A1128',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#000',
  },
  selectorTriggerBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#D4AF37',
  },
  selectorTriggerText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0A1128',
  },
  selectorTriggerArrow: {
    fontSize: 10,
    fontWeight: '900',
    color: '#B06000',
  },

  // Player Replacement Picker Modal
  playerPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAFAFA',
    borderWidth: 1.5,
    borderColor: '#DDD',
    padding: 10,
    marginBottom: 8,
  },
  playerPickerItemActive: {
    backgroundColor: '#F0F4FF',
    borderColor: '#0A1128',
    borderWidth: 2,
  },
  playerPickerItemRecommended: {
    borderLeftWidth: 4,
    borderLeftColor: '#B06000',
  },
  playerPickerItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  playerPickerOvrBadge: {
    width: 38,
    height: 38,
    backgroundColor: '#0A1128',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#000',
  },
  playerPickerOvrText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFF',
    lineHeight: 14,
  },
  playerPickerPosText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#D4AF37',
  },
  playerPickerName: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0A1128',
  },
  playerPickerNameActive: {
    color: '#0A1128',
  },
  playerPickerSub: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  playerPickerCheck: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0A1128',
  },
  akanDijualTag: {
    backgroundColor: '#B06000',
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  akanDijualTagText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#FFF',
  },

  // Categorized Position Modals (Shared with Players screen)
  filterModalCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#000',
    width: '92%',
    maxWidth: 420,
    maxHeight: '85%',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  filterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#000',
    paddingBottom: 10,
    marginBottom: 10,
  },
  filterModalTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 0.5,
    flex: 1,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalCloseBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000',
  },
  posGroupAllBtn: {
    backgroundColor: '#F0F0F0',
    borderWidth: 2,
    borderColor: '#000',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  posGroupAllBtnActive: {
    backgroundColor: '#0A1128',
  },
  posGroupAllText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0A1128',
    textAlign: 'center',
  },
  posGroupAllTextActive: {
    color: '#D4AF37',
  },
  posCategorySection: {
    marginBottom: 12,
  },
  posCategoryHeader: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 1,
    marginBottom: 6,
  },
  posCategoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  bigPosChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAFAFA',
    borderWidth: 1.5,
    borderColor: '#000',
    paddingVertical: 6,
    paddingHorizontal: 10,
    minWidth: 70,
  },
  bigPosChipActive: {
    backgroundColor: '#0A1128',
  },
  bigPosChipName: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0A1128',
  },
  bigPosChipNameActive: {
    color: '#D4AF37',
  },
  bigPosChipCount: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#666',
    marginLeft: 6,
  },
  bigPosChipCountActive: {
    color: '#FFF',
  },
  modalBottomBtn: {
    backgroundColor: '#0A1128',
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
    marginTop: 10,
  },
  modalBottomBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
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

  // Sold Players Section
  soldBanner: {
    backgroundColor: '#F1F3F4',
    borderWidth: 2,
    borderColor: '#000',
    padding: 14,
    marginBottom: 12,
  },
  soldBannerTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 0.5,
  },
  soldBannerDesc: {
    fontSize: 11,
    color: '#555',
    marginTop: 4,
    lineHeight: 16,
  },
  soldCard: {
    backgroundColor: '#FAFAFA',
    borderWidth: 2,
    borderColor: '#888',
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 0,
    elevation: 2,
  },
  soldCardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  soldOvrBadge: {
    width: 44,
    height: 44,
    backgroundColor: '#5F6368',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1.5,
    borderColor: '#000',
  },
  soldOvrNum: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFF',
    lineHeight: 18,
  },
  soldPosText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#DDD',
    letterSpacing: 0.5,
  },
  soldPlayerName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#333',
  },
  soldStatusTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#762700',
    marginTop: 2,
  },
  soldNote: {
    fontSize: 11,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 2,
  },
  soldActions: {
    flexDirection: 'row',
    gap: 8,
  },
  revertBtn: {
    flex: 1,
    backgroundColor: '#0A1128',
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#000',
  },
  revertBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#D4AF37',
  },
  soldDeleteBtn: {
    borderWidth: 1.5,
    borderColor: '#C5221F',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFF',
  },
  soldDeleteBtnText: {
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
    margin: 16,
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
  emptyResetBtn: {
    marginTop: 12,
    backgroundColor: '#0A1128',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: '#000',
  },
  emptyResetBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#D4AF37',
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
    padding: 18,
    width: '90%',
    maxWidth: 420,
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
    marginBottom: 10,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
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
