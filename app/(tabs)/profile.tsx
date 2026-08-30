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
import type { Profile, Position, PlayerWithPositions, StatusDurasi, PlayerStatus } from '@/src/types';

type MenuTab = 'profiles' | 'watchlist' | 'transfer_loan' | 'sold_players' | 'backup' | 'about';

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

  // Pickers Modals inside Watchlist Form
  const [showPosPickerModal, setShowPosPickerModal] = useState(false);
  const [showPlayerPickerModal, setShowPlayerPickerModal] = useState(false);
  const [playerPickerSearch, setPlayerPickerSearch] = useState('');

  // ─── Transfer & Loan List State ───────────────────
  const [tlSubTab, setTlSubTab] = useState<'jual' | 'loan'>('jual');
  const [tlSearchQuery, setTlSearchQuery] = useState('');
  const [tlFilterPos, setTlFilterPos] = useState('ALL');
  const [showTlFilterPosModal, setShowTlFilterPosModal] = useState(false);

  // Transfer & Loan Add/Edit Modal State
  const [showAddTlModal, setShowAddTlModal] = useState(false);
  const [tlEditPlayerTarget, setTlEditPlayerTarget] = useState<PlayerWithPositions | null>(null);
  const [tlSelectedPlayerId, setTlSelectedPlayerId] = useState<string | null>(null);
  const [tlType, setTlType] = useState<'akan_dijual' | 'loan_out'>('akan_dijual');
  const [tlDurasi, setTlDurasi] = useState<StatusDurasi>('1_tahun');
  const [tlIsOpsiBeli, setTlIsOpsiBeli] = useState(false);
  const [tlCatatan, setTlCatatan] = useState('');
  const [showTlPlayerPickerModal, setShowTlPlayerPickerModal] = useState(false);
  const [tlPlayerPickerSearch, setTlPlayerPickerSearch] = useState('');

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

  // Derived collections
  const soldPlayers = useMemo(() => players.filter((p) => p.status === 'sudah_dijual'), [players]);
  const akanDijualPlayers = useMemo(() => players.filter((p) => p.status === 'akan_dijual'), [players]);
  const loanPlayers = useMemo(() => players.filter((p) => p.status === 'loan_out'), [players]);

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

  // Filtered Transfer & Loan List
  const filteredAkanDijual = useMemo(() => {
    return akanDijualPlayers.filter((p) => {
      if (tlFilterPos !== 'ALL') {
        const hasPos = p.positions.some((pos) => pos.id === tlFilterPos);
        if (!hasPos) return false;
      }
      if (tlSearchQuery.trim()) {
        const q = tlSearchQuery.toLowerCase();
        const matchName = p.nama.toLowerCase().includes(q);
        const matchPos = p.positions.some((pos) => pos.nama.toLowerCase().includes(q));
        const matchNote = p.status_catatan?.toLowerCase().includes(q);
        if (!matchName && !matchPos && !matchNote) return false;
      }
      return true;
    });
  }, [akanDijualPlayers, tlFilterPos, tlSearchQuery]);

  const filteredLoanPlayers = useMemo(() => {
    return loanPlayers.filter((p) => {
      if (tlFilterPos !== 'ALL') {
        const hasPos = p.positions.some((pos) => pos.id === tlFilterPos);
        if (!hasPos) return false;
      }
      if (tlSearchQuery.trim()) {
        const q = tlSearchQuery.toLowerCase();
        const matchName = p.nama.toLowerCase().includes(q);
        const matchPos = p.positions.some((pos) => pos.nama.toLowerCase().includes(q));
        const matchNote = p.status_catatan?.toLowerCase().includes(q);
        if (!matchName && !matchPos && !matchNote) return false;
      }
      return true;
    });
  }, [loanPlayers, tlFilterPos, tlSearchQuery]);

  // Selected details for Form Display
  const selectedFormPos = positions.find((p) => p.id === wPosId);
  const selectedFormPlayer = players.find((p) => p.id === wTerkaitPlayerId);
  const selectedFilterPosObj = positions.find((p) => p.id === wFilterPos);
  const selectedTlFilterPosObj = positions.find((p) => p.id === tlFilterPos);
  const selectedTlPlayerObj = players.find((p) => p.id === tlSelectedPlayerId);

  // Filtered players inside Replacement Picker Modal (for Watchlist Form)
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
        if (a.status === 'akan_dijual' && b.status !== 'akan_dijual') return -1;
        if (b.status === 'akan_dijual' && a.status !== 'akan_dijual') return 1;
        return b.ovr_current - a.ovr_current;
      });
  }, [players, playerPickerSearch]);

  // Available players to add into Transfer / Loan List (Active players)
  const availableSquadPlayersForTl = useMemo(() => {
    return players
      .filter((p) => p.status !== 'sudah_dijual')
      .filter((p) => {
        if (!tlPlayerPickerSearch.trim()) return true;
        const q = tlPlayerPickerSearch.toLowerCase();
        return (
          p.nama.toLowerCase().includes(q) ||
          p.positions.some((pos) => pos.nama.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => b.ovr_current - a.ovr_current);
  }, [players, tlPlayerPickerSearch]);

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
  function openAddWatchlist(presetPlayer?: PlayerWithPositions) {
    setWatchEditTarget(null);
    setWNamaTarget('');
    setWPosId(presetPlayer ? presetPlayer.positions[0]?.id ?? positions[0]?.id : positions[0]?.id ?? '');
    setWOvrMin('78');
    setWOvrMax('83');
    setWCatatan(presetPlayer ? `Pengganti ${presetPlayer.nama} yang akan dilepas` : '');
    setWTerkaitPlayerId(presetPlayer ? presetPlayer.id : null);
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

  // ─── Transfer & Loan Handlers ─────────────────────
  function openAddTransferLoan() {
    setTlEditPlayerTarget(null);
    setTlSelectedPlayerId(players.find((p) => p.status === 'aktif')?.id ?? null);
    setTlType(tlSubTab === 'loan' ? 'loan_out' : 'akan_dijual');
    setTlDurasi('1_tahun');
    setTlIsOpsiBeli(false);
    setTlCatatan('');
    setShowAddTlModal(true);
  }

  function openEditTransferLoan(player: PlayerWithPositions) {
    setTlEditPlayerTarget(player);
    setTlSelectedPlayerId(player.id);
    setTlType(player.status === 'loan_out' ? 'loan_out' : 'akan_dijual');
    setTlDurasi(player.status_durasi ?? '1_tahun');
    const hasOpsiBeli = player.status_catatan?.includes('[OPSI BELI]') ?? false;
    setTlIsOpsiBeli(hasOpsiBeli);
    const cleanNote = (player.status_catatan ?? '').replace('[OPSI BELI] ', '').replace('[OPSI BELI]', '');
    setTlCatatan(cleanNote);
    setShowAddTlModal(true);
  }

  async function handleSaveTransferLoan() {
    if (!tlSelectedPlayerId) {
      Alert.alert('Error', 'Pilih pemain skuad terlebih dahulu');
      return;
    }
    const targetPlayer = players.find((p) => p.id === tlSelectedPlayerId);
    if (!targetPlayer) return;

    let finalNote = tlCatatan.trim();
    if (tlType === 'loan_out' && tlIsOpsiBeli) {
      finalNote = finalNote ? `[OPSI BELI] ${finalNote}` : '[OPSI BELI] Pinjaman dengan opsi beli permanen';
    }

    try {
      await updatePlayer(targetPlayer.id, {
        nama: targetPlayer.nama,
        ovr_current: targetPlayer.ovr_current,
        status: tlType,
        status_durasi: tlType === 'loan_out' ? tlDurasi : null,
        status_mulai: new Date().toISOString(),
        status_catatan: finalNote || null,
        position_ids: targetPlayer.positions.map((p) => p.id),
      });

      setShowAddTlModal(false);
      loadData();
      Alert.alert(
        'Sukses 🎉',
        `Pemain "${targetPlayer.nama}" berhasil ditetapkan ke ${
          tlType === 'loan_out' ? 'Daftar Pinjaman' : 'Rencana Jual'
        }.`
      );
    } catch (e) {
      Alert.alert('Error', 'Gagal menyimpan status transfer/loan pemain');
    }
  }

  function handleMarkAsSold(player: PlayerWithPositions) {
    Alert.alert(
      'Konfirmasi Penjualan',
      `Tandai "${player.nama}" sebagai SUDAH TERJUAL?\n\nPemain akan dipindahkan ke Arsip Pemain Terjual dan total kuota skuad klub di dashboard otomatis berkurang.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Sudah Terjual',
          onPress: async () => {
            try {
              await updatePlayer(player.id, {
                nama: player.nama,
                ovr_current: player.ovr_current,
                status: 'sudah_dijual',
                status_durasi: null,
                status_mulai: new Date().toISOString(),
                status_catatan: player.status_catatan ? `[Terjual] ${player.status_catatan}` : 'Pemain resmi dilepas/terjual',
                position_ids: player.positions.map((p) => p.id),
              });
              loadData();
              Alert.alert('Sukses 🎉', `Pemain "${player.nama}" kini berstatus SUDAH DIJUAL.`);
            } catch (e) {
              Alert.alert('Error', 'Gagal memperbarui status pemain');
            }
          },
        },
      ]
    );
  }

  function handleCancelSell(player: PlayerWithPositions) {
    Alert.alert(
      'Batalkan Rencana Jual',
      `Kembalikan "${player.nama}" menjadi pemain AKTIF di skuad?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Kembalikan ke Skuad',
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
            } catch (e) {
              Alert.alert('Error', 'Gagal membatalkan rencana jual');
            }
          },
        },
      ]
    );
  }

  function handleRecallLoan(player: PlayerWithPositions) {
    Alert.alert(
      'Recall dari Pinjaman',
      `Tarik kembali "${player.nama}" ke skuad utama?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Recall ke Skuad',
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
              Alert.alert('Sukses 🎉', `Pemain "${player.nama}" kini kembali aktif di skuad utama.`);
            } catch (e) {
              Alert.alert('Error', 'Gagal menarik pemain dari pinjaman');
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
              Pusat konfigurasi, transfer target & rencana keluar, arsip pemain terjual, backup data, dan informasi pengembang.
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
                    Catat nama pemain incaran luar klub, posisi target, range OVR, dan pengganti.
                  </Text>
                </View>
              </View>
              <Text style={styles.menuArrow}>➔</Text>
            </TouchableOpacity>

            {/* 3. Transfer & Loan List (NEW) */}
            <TouchableOpacity
              style={styles.verticalMenuCard}
              onPress={() => setActiveMenu('transfer_loan')}
              activeOpacity={0.8}>
              <View style={styles.menuCardLeft}>
                <View style={[styles.menuIconBox, { backgroundColor: '#C5221F' }]}>
                  <Text style={styles.menuIconText}>📤</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.menuCardTitleRow}>
                    <Text style={styles.menuCardTitle}>TRANSFER & LOAN LIST</Text>
                    <View style={[styles.menuCountBadge, { backgroundColor: '#C5221F' }]}>
                      <Text style={[styles.menuCountText, { color: '#FFF' }]}>
                        {akanDijualPlayers.length + loanPlayers.length} Pemain
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.menuCardDesc}>
                    Rencana jual pemain skuad & daftar pemain yang dipinjamkan (6 bln, 1 thn, 2 thn, opsi beli).
                  </Text>
                </View>
              </View>
              <Text style={styles.menuArrow}>➔</Text>
            </TouchableOpacity>

            {/* 4. Pemain Terjual (Arsip Penjualan) */}
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

            {/* 5. Backup & Ekspor */}
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

            {/* 6. Tentang & Dev */}
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
              {activeMenu === 'transfer_loan' && '📤 TRANSFER & LOAN LIST'}
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
                    onPress={() => openAddWatchlist()}
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

          {/* ─── 3. TRANSFER & LOAN LIST SECTION (NEW) ─── */}
          {activeMenu === 'transfer_loan' && (
            <View style={{ flex: 1 }}>
              {/* Segmented Switcher (Rencana Jual vs Daftar Pinjaman) */}
              <View style={styles.tlSegmentBar}>
                <TouchableOpacity
                  style={[styles.tlSegmentBtn, tlSubTab === 'jual' && styles.tlSegmentBtnActiveJual]}
                  onPress={() => setTlSubTab('jual')}>
                  <Text
                    style={[
                      styles.tlSegmentBtnText,
                      tlSubTab === 'jual' && styles.tlSegmentBtnTextActiveJual,
                    ]}>
                    🔴 RENCANA JUAL ({akanDijualPlayers.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tlSegmentBtn, tlSubTab === 'loan' && styles.tlSegmentBtnActiveLoan]}
                  onPress={() => setTlSubTab('loan')}>
                  <Text
                    style={[
                      styles.tlSegmentBtnText,
                      tlSubTab === 'loan' && styles.tlSegmentBtnTextActiveLoan,
                    ]}>
                    🟡 DAFTAR LOAN ({loanPlayers.length})
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Filter & Search Bar */}
              <View style={styles.wFilterContainer}>
                {/* Search Bar */}
                <View style={styles.wSearchRow}>
                  <TextInput
                    style={styles.wSearchInput}
                    placeholder="🔍 Cari nama pemain, posisi, catatan..."
                    placeholderTextColor="#888"
                    value={tlSearchQuery}
                    onChangeText={setTlSearchQuery}
                    returnKeyType="search"
                  />
                  {tlSearchQuery.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setTlSearchQuery('')}
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
                      tlFilterPos !== 'ALL' && styles.wFilterBigBtnActive,
                    ]}
                    onPress={() => setShowTlFilterPosModal(true)}
                    activeOpacity={0.8}>
                    <Text
                      style={[
                        styles.wFilterBigBtnText,
                        tlFilterPos !== 'ALL' && styles.wFilterBigBtnTextActive,
                      ]}
                      numberOfLines={1}>
                      📍 POSISI: {tlFilterPos === 'ALL' ? 'SEMUA' : selectedTlFilterPosObj?.nama ?? 'POSISI'} ▾
                    </Text>
                  </TouchableOpacity>

                  {/* Add Player to Sell/Loan Button */}
                  <TouchableOpacity
                    style={styles.wAddTargetBtn}
                    onPress={openAddTransferLoan}
                    activeOpacity={0.8}>
                    <Text style={styles.wAddTargetBtnText}>+ TAMBAH PEMAIN</Text>
                  </TouchableOpacity>
                </View>

                {/* Active Filter Tags */}
                {(tlFilterPos !== 'ALL' || tlSearchQuery.trim() !== '') && (
                  <View style={styles.wActiveTagsRow}>
                    <Text style={styles.wActiveTagHeader}>FILTER AKTIF:</Text>
                    {tlFilterPos !== 'ALL' && (
                      <TouchableOpacity
                        style={styles.wActiveTagChip}
                        onPress={() => setTlFilterPos('ALL')}>
                        <Text style={styles.wActiveTagChipText}>
                          POSISI: {selectedTlFilterPosObj?.nama ?? tlFilterPos} ✕
                        </Text>
                      </TouchableOpacity>
                    )}
                    {tlSearchQuery.trim() !== '' && (
                      <TouchableOpacity
                        style={styles.wActiveTagChip}
                        onPress={() => setTlSearchQuery('')}>
                        <Text style={styles.wActiveTagChipText}>
                          "{tlSearchQuery}" ✕
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.wResetFilterChip}
                      onPress={() => {
                        setTlFilterPos('ALL');
                        setTlSearchQuery('');
                      }}>
                      <Text style={styles.wResetFilterChipText}>RESET</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* ─── SUB-TAB 1: RENCANA JUAL ─────────────── */}
              {tlSubTab === 'jual' && (
                <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
                  {filteredAkanDijual.length === 0 ? (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyTitle}>
                        {akanDijualPlayers.length === 0 ? 'Belum Ada Pemain Akan Dijual' : 'Pemain Tidak Ditemukan'}
                      </Text>
                      <Text style={styles.emptySub}>
                        {akanDijualPlayers.length === 0
                          ? 'Gunakan tombol "+ TAMBAH PEMAIN" di atas untuk menandai pemain skuad yang ingin dijual.'
                          : 'Coba ganti filter posisi atau kata kunci pencarian.'}
                      </Text>
                    </View>
                  ) : (
                    filteredAkanDijual.map((player) => {
                      const primaryPos = player.positions[0]?.nama ?? '-';
                      const secondaryPos = player.positions.slice(1).map((p) => p.nama).join(', ');

                      // Find ALL matching Watchlist targets for this player or player's positions
                      const matchingTargets = watchlist.filter(
                        (w) =>
                          w.terkait_player_id === player.id ||
                          player.positions.some((pos) => pos.id === w.position_id)
                      );

                      return (
                        <View key={player.id} style={styles.tlSellCard}>
                          {/* Top: Player Name & OVR */}
                          <View style={styles.watchCardTop}>
                            <View style={[styles.watchPosBadge, { backgroundColor: '#B06000' }]}>
                              <Text style={[styles.watchPosBadgeText, { color: '#FFF' }]}>{primaryPos}</Text>
                            </View>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={styles.watchPlayerNameHeader}>{player.nama}</Text>
                                <View style={styles.akanDijualTag}>
                                  <Text style={styles.akanDijualTagText}>AKAN DIJUAL</Text>
                                </View>
                              </View>
                              <Text style={styles.tlPlayerSub}>
                                OVR: {player.ovr_current} • Posisi: {player.positions.map((p) => p.nama).join(', ')}
                              </Text>
                            </View>
                          </View>

                          {/* Reason / Notes */}
                          {player.status_catatan && (
                            <View style={styles.watchNoteBox}>
                              <Text style={styles.watchNoteLabel}>📝 Alasan / Catatan Penjualan:</Text>
                              <Text style={styles.watchNoteText}>"{player.status_catatan}"</Text>
                            </View>
                          )}

                          {/* Connected Watchlist Targets (Shows ALL matching targets) */}
                          <View style={styles.tlWatchlistConnectBox}>
                            <View style={styles.tlWatchlistConnectHeader}>
                              <Text style={styles.tlWatchlistConnectTitle}>
                                🎯 PERKIRAAN TARGET PENGGANTI DARI WATCHLIST ({matchingTargets.length}):
                              </Text>
                              <TouchableOpacity
                                onPress={() => openAddWatchlist(player)}
                                style={styles.tlAddTargetMiniBtn}>
                                <Text style={styles.tlAddTargetMiniBtnText}>+ INCAR TARGET</Text>
                              </TouchableOpacity>
                            </View>

                            {matchingTargets.length === 0 ? (
                              <Text style={styles.tlNoTargetText}>
                                ℹ️ Belum ada target di Transfer Watchlist untuk posisi {primaryPos}. Tekan "+ Incar Target" untuk mencatat incaran baru.
                              </Text>
                            ) : (
                              <View style={{ gap: 6, marginTop: 4 }}>
                                {matchingTargets.map((t) => (
                                  <View key={t.id} style={styles.tlTargetItemRow}>
                                    <View style={styles.tlTargetItemBadge}>
                                      <Text style={styles.tlTargetItemBadgeText}>{t.position_nama}</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                      <Text style={styles.tlTargetItemName}>
                                        {t.nama_target ? t.nama_target : `Target Pemain ${t.position_nama}`}
                                        <Text style={styles.tlTargetItemOvr}>
                                          {' '}
                                          (Target OVR:{' '}
                                          {t.target_ovr_min && t.target_ovr_max
                                            ? `${t.target_ovr_min}–${t.target_ovr_max}`
                                            : t.target_ovr_min
                                            ? `Min ${t.target_ovr_min}`
                                            : 'Bebas'}
                                          )
                                        </Text>
                                      </Text>
                                      {t.catatan && (
                                        <Text style={styles.tlTargetItemNote}>"{t.catatan}"</Text>
                                      )}
                                    </View>
                                  </View>
                                ))}
                              </View>
                            )}
                          </View>

                          {/* Quick Actions */}
                          <View style={styles.tlActionsRow}>
                            <TouchableOpacity
                              style={styles.tlSoldConfirmBtn}
                              onPress={() => handleMarkAsSold(player)}
                              activeOpacity={0.8}>
                              <Text style={styles.tlSoldConfirmBtnText}>✅ Tandai Sudah Terjual</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.tlCancelBtn}
                              onPress={() => handleCancelSell(player)}>
                              <Text style={styles.tlCancelBtnText}>🔄 Batal Jual</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.tlEditBtn}
                              onPress={() => openEditTransferLoan(player)}>
                              <Text style={styles.tlEditBtnText}>✏️ Edit</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })
                  )}
                </ScrollView>
              )}

              {/* ─── SUB-TAB 2: DAFTAR PINJAMAN ──────────── */}
              {tlSubTab === 'loan' && (
                <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
                  {filteredLoanPlayers.length === 0 ? (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyTitle}>
                        {loanPlayers.length === 0 ? 'Belum Ada Pemain yang Dipinjamkan' : 'Pemain Tidak Ditemukan'}
                      </Text>
                      <Text style={styles.emptySub}>
                        {loanPlayers.length === 0
                          ? 'Gunakan tombol "+ TAMBAH PEMAIN" di atas untuk meminjamkan pemain muda/cadangan ke klub lain.'
                          : 'Coba ganti filter posisi atau kata kunci pencarian.'}
                      </Text>
                    </View>
                  ) : (
                    filteredLoanPlayers.map((player) => {
                      const primaryPos = player.positions[0]?.nama ?? '-';
                      const durasiLabel =
                        player.status_durasi === '6_bulan'
                          ? '6 Bulan'
                          : player.status_durasi === '2_tahun'
                          ? '2 Tahun'
                          : '1 Tahun';
                      const hasOpsiBeli = player.status_catatan?.includes('[OPSI BELI]') ?? false;
                      const cleanNote = (player.status_catatan ?? '').replace('[OPSI BELI] ', '').replace('[OPSI BELI]', '');

                      return (
                        <View key={player.id} style={styles.tlLoanCard}>
                          {/* Top: Player Name & OVR */}
                          <View style={styles.watchCardTop}>
                            <View style={[styles.watchPosBadge, { backgroundColor: '#0A1128' }]}>
                              <Text style={styles.watchPosBadgeText}>{primaryPos}</Text>
                            </View>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={styles.watchPlayerNameHeader}>{player.nama}</Text>
                                <View style={styles.loanBadgeTag}>
                                  <Text style={styles.loanBadgeTagText}>DIPINJAMKAN</Text>
                                </View>
                              </View>
                              <Text style={styles.tlPlayerSub}>
                                OVR: {player.ovr_current} • Posisi: {player.positions.map((p) => p.nama).join(', ')}
                              </Text>
                            </View>
                          </View>

                          {/* Loan Badges: Durasi & Opsi Beli */}
                          <View style={styles.tlLoanBadgesRow}>
                            <View style={styles.tlLoanDurationBadge}>
                              <Text style={styles.tlLoanDurationBadgeText}>⏱️ Durasi: {durasiLabel}</Text>
                            </View>

                            <View
                              style={[
                                styles.tlLoanOptionBadge,
                                hasOpsiBeli && styles.tlLoanOptionBadgeBuy,
                              ]}>
                              <Text
                                style={[
                                  styles.tlLoanOptionBadgeText,
                                  hasOpsiBeli && styles.tlLoanOptionBadgeTextBuy,
                                ]}>
                                {hasOpsiBeli ? '🏷️ Dengan Opsi Beli' : '🛡️ Pinjaman Murni'}
                              </Text>
                            </View>
                          </View>

                          {/* Notes */}
                          {cleanNote ? (
                            <View style={styles.watchNoteBox}>
                              <Text style={styles.watchNoteLabel}>📝 Catatan Pinjaman / Klub Tujuan:</Text>
                              <Text style={styles.watchNoteText}>"{cleanNote}"</Text>
                            </View>
                          ) : null}

                          {/* Actions */}
                          <View style={styles.tlActionsRow}>
                            <TouchableOpacity
                              style={styles.tlRecallBtn}
                              onPress={() => handleRecallLoan(player)}
                              activeOpacity={0.8}>
                              <Text style={styles.tlRecallBtnText}>🔙 Recall ke Skuad</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.tlEditBtn}
                              onPress={() => openEditTransferLoan(player)}>
                              <Text style={styles.tlEditBtnText}>✏️ Edit Pinjaman</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })
                  )}
                </ScrollView>
              )}
            </View>
          )}

          {/* ─── 4. PEMAIN TERJUAL SECTION ─────────────── */}
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
                    Untuk mengarsipkan penjualan pemain, ubah status pemain menjadi "Sudah Dijual" di menu Transfer List atau tab Pemain.
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

          {/* ─── 5. BACKUP & RESTORE SECTION ───────────── */}
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

          {/* ─── 6. TENTANG & DEV SECTION ──────────────── */}
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
                <Text style={styles.aboutBullet}>• 📤 Transfer & Loan List (Jual & Pinjamkan)</Text>
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

                {/* Field 4: Pemain yang Akan Digantikan */}
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

      {/* ─── ADD/EDIT TRANSFER & LOAN MODAL (NEW) ───── */}
      <Modal
        visible={showAddTlModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddTlModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowAddTlModal(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalCenter}>
            <Pressable style={styles.formModalCard} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.modalTitle}>
                {tlEditPlayerTarget
                  ? `✏️ EDIT STATUS TRANSFER / PINJAMAN`
                  : `📤 TAMBAH KE DAFTAR JUAL / PINJAM`}
              </Text>

              <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
                {/* Field 1: Pilih Pemain Skuad */}
                <Text style={styles.fieldLabel}>PILIH PEMAIN SKUAD:</Text>
                <TouchableOpacity
                  style={[
                    styles.selectorTriggerBtn,
                    tlEditPlayerTarget !== null && { opacity: 0.8 },
                  ]}
                  onPress={() => {
                    if (tlEditPlayerTarget) return; // cannot change player in edit mode
                    setTlPlayerPickerSearch('');
                    setShowTlPlayerPickerModal(true);
                  }}
                  disabled={tlEditPlayerTarget !== null}
                  activeOpacity={0.8}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <View style={styles.selectorTriggerBadge}>
                      <Text style={styles.selectorTriggerBadgeText}>
                        {selectedTlPlayerObj ? `OVR ${selectedTlPlayerObj.ovr_current}` : 'PILIH'}
                      </Text>
                    </View>
                    <Text style={styles.selectorTriggerText} numberOfLines={1}>
                      {selectedTlPlayerObj
                        ? `${selectedTlPlayerObj.nama} (${selectedTlPlayerObj.positions[0]?.nama ?? '-'})`
                        : 'Pilih Pemain Skuad'}
                    </Text>
                  </View>
                  {!tlEditPlayerTarget && <Text style={styles.selectorTriggerArrow}>PILIH ▾</Text>}
                </TouchableOpacity>

                {/* Field 2: Tipe Status (Akan Dijual vs Dipinjamkan) */}
                <Text style={[styles.fieldLabel, { marginTop: 12 }]}>TETAPKAN STATUS PEMAIN:</Text>
                <View style={styles.tlTypeChoiceRow}>
                  <TouchableOpacity
                    style={[
                      styles.tlTypeChoiceBtn,
                      tlType === 'akan_dijual' && styles.tlTypeChoiceBtnActiveJual,
                    ]}
                    onPress={() => setTlType('akan_dijual')}>
                    <Text
                      style={[
                        styles.tlTypeChoiceBtnText,
                        tlType === 'akan_dijual' && styles.tlTypeChoiceBtnTextActiveJual,
                      ]}>
                      🔴 Rencana Jual
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.tlTypeChoiceBtn,
                      tlType === 'loan_out' && styles.tlTypeChoiceBtnActiveLoan,
                    ]}
                    onPress={() => setTlType('loan_out')}>
                    <Text
                      style={[
                        styles.tlTypeChoiceBtnText,
                        tlType === 'loan_out' && styles.tlTypeChoiceBtnTextActiveLoan,
                      ]}>
                      🟡 Dipinjamkan
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* If Loan Out: Durasi Pinjaman (6 Bulan, 1 Tahun, 2 Tahun) */}
                {tlType === 'loan_out' && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.fieldLabel}>DURASI PINJAMAN:</Text>
                    <View style={styles.tlDurasiRow}>
                      {(['6_bulan', '1_tahun', '2_tahun'] as StatusDurasi[]).map((d) => {
                        const isSel = tlDurasi === d;
                        const label = d === '6_bulan' ? '6 Bulan' : d === '1_tahun' ? '1 Tahun' : '2 Tahun';
                        return (
                          <TouchableOpacity
                            key={d}
                            style={[styles.tlDurasiBtn, isSel && styles.tlDurasiBtnActive]}
                            onPress={() => setTlDurasi(d)}>
                            <Text style={[styles.tlDurasiBtnText, isSel && styles.tlDurasiBtnTextActive]}>
                              {label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Opsi Pembelian Dropdown / Selector */}
                    <Text style={[styles.fieldLabel, { marginTop: 12 }]}>OPSI PEMBELIAN (LOAN OPTION):</Text>
                    <View style={styles.tlOpsiBeliRow}>
                      <TouchableOpacity
                        style={[
                          styles.tlOpsiBeliBtn,
                          !tlIsOpsiBeli && styles.tlOpsiBeliBtnActive,
                        ]}
                        onPress={() => setTlIsOpsiBeli(false)}>
                        <Text
                          style={[
                            styles.tlOpsiBeliBtnText,
                            !tlIsOpsiBeli && styles.tlOpsiBeliBtnTextActive,
                          ]}>
                          🛡️ Pinjaman Murni (Tanpa Opsi Beli)
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.tlOpsiBeliBtn,
                          tlIsOpsiBeli && styles.tlOpsiBeliBtnActiveBuy,
                        ]}
                        onPress={() => setTlIsOpsiBeli(true)}>
                        <Text
                          style={[
                            styles.tlOpsiBeliBtnText,
                            tlIsOpsiBeli && styles.tlOpsiBeliBtnTextActiveBuy,
                          ]}>
                          🏷️ Pinjaman dengan Opsi Beli (Loan to Buy)
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Field 3: Catatan */}
                <Text style={[styles.fieldLabel, { marginTop: 12 }]}>
                  {tlType === 'akan_dijual'
                    ? 'ALASAN PENJUALAN / TARGET KLUB PEMINAT:'
                    : 'CATATAN PINJAMAN / KLUB TUJUAN:'}
                </Text>
                <TextInput
                  style={[styles.modalInput, { height: 65, textAlignVertical: 'top' }]}
                  placeholder={
                    tlType === 'akan_dijual'
                      ? 'misal: Surplus kuota sayap, butuh dana peremajaan bek'
                      : 'misal: Dipinjamkan ke Girona untuk menit bermain tim utama'
                  }
                  placeholderTextColor="#999"
                  value={tlCatatan}
                  onChangeText={setTlCatatan}
                  multiline
                />
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowAddTlModal(false)}>
                  <Text style={styles.modalCancelText}>BATAL</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleSaveTransferLoan}>
                  <Text style={styles.modalConfirmText}>SIMPAN STATUS</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* ─── POSITION FILTER MODAL (SHARED WATCHLIST & TL) ── */}
      <Modal
        visible={showWFilterPosModal || showTlFilterPosModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowWFilterPosModal(false);
          setShowTlFilterPosModal(false);
        }}>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setShowWFilterPosModal(false);
            setShowTlFilterPosModal(false);
          }}>
          <View style={styles.filterModalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>FILTER BERDASARKAN POSISI</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowWFilterPosModal(false);
                  setShowTlFilterPosModal(false);
                }}
                style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {/* Option: Semua Posisi */}
              <TouchableOpacity
                style={[
                  styles.posGroupAllBtn,
                  ((showWFilterPosModal && wFilterPos === 'ALL') ||
                    (showTlFilterPosModal && tlFilterPos === 'ALL')) &&
                    styles.posGroupAllBtnActive,
                ]}
                onPress={() => {
                  if (showWFilterPosModal) setWFilterPos('ALL');
                  if (showTlFilterPosModal) setTlFilterPos('ALL');
                  setShowWFilterPosModal(false);
                  setShowTlFilterPosModal(false);
                }}>
                <Text
                  style={[
                    styles.posGroupAllText,
                    ((showWFilterPosModal && wFilterPos === 'ALL') ||
                      (showTlFilterPosModal && tlFilterPos === 'ALL')) &&
                      styles.posGroupAllTextActive,
                  ]}>
                  🔘 SEMUA POSISI
                </Text>
              </TouchableOpacity>

              {/* Group: Kiper */}
              {gkPositions.length > 0 && (
                <View style={styles.posCategorySection}>
                  <Text style={styles.posCategoryHeader}>🧤 PENJAGA GAWANG</Text>
                  <View style={styles.posCategoryGrid}>
                    {gkPositions.map((pos) => {
                      const isSelected =
                        showWFilterPosModal ? wFilterPos === pos.id : tlFilterPos === pos.id;
                      return (
                        <TouchableOpacity
                          key={pos.id}
                          style={[styles.bigPosChip, isSelected && styles.bigPosChipActive]}
                          onPress={() => {
                            if (showWFilterPosModal) setWFilterPos(pos.id);
                            if (showTlFilterPosModal) setTlFilterPos(pos.id);
                            setShowWFilterPosModal(false);
                            setShowTlFilterPosModal(false);
                          }}>
                          <Text style={[styles.bigPosChipName, isSelected && styles.bigPosChipNameActive]}>
                            {pos.nama}
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
                      const isSelected =
                        showWFilterPosModal ? wFilterPos === pos.id : tlFilterPos === pos.id;
                      return (
                        <TouchableOpacity
                          key={pos.id}
                          style={[styles.bigPosChip, isSelected && styles.bigPosChipActive]}
                          onPress={() => {
                            if (showWFilterPosModal) setWFilterPos(pos.id);
                            if (showTlFilterPosModal) setTlFilterPos(pos.id);
                            setShowWFilterPosModal(false);
                            setShowTlFilterPosModal(false);
                          }}>
                          <Text style={[styles.bigPosChipName, isSelected && styles.bigPosChipNameActive]}>
                            {pos.nama}
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
                      const isSelected =
                        showWFilterPosModal ? wFilterPos === pos.id : tlFilterPos === pos.id;
                      return (
                        <TouchableOpacity
                          key={pos.id}
                          style={[styles.bigPosChip, isSelected && styles.bigPosChipActive]}
                          onPress={() => {
                            if (showWFilterPosModal) setWFilterPos(pos.id);
                            if (showTlFilterPosModal) setTlFilterPos(pos.id);
                            setShowWFilterPosModal(false);
                            setShowTlFilterPosModal(false);
                          }}>
                          <Text style={[styles.bigPosChipName, isSelected && styles.bigPosChipNameActive]}>
                            {pos.nama}
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
                      const isSelected =
                        showWFilterPosModal ? wFilterPos === pos.id : tlFilterPos === pos.id;
                      return (
                        <TouchableOpacity
                          key={pos.id}
                          style={[styles.bigPosChip, isSelected && styles.bigPosChipActive]}
                          onPress={() => {
                            if (showWFilterPosModal) setWFilterPos(pos.id);
                            if (showTlFilterPosModal) setTlFilterPos(pos.id);
                            setShowWFilterPosModal(false);
                            setShowTlFilterPosModal(false);
                          }}>
                          <Text style={[styles.bigPosChipName, isSelected && styles.bigPosChipNameActive]}>
                            {pos.nama}
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
                      const isSelected =
                        showWFilterPosModal ? wFilterPos === pos.id : tlFilterPos === pos.id;
                      return (
                        <TouchableOpacity
                          key={pos.id}
                          style={[styles.bigPosChip, isSelected && styles.bigPosChipActive]}
                          onPress={() => {
                            if (showWFilterPosModal) setWFilterPos(pos.id);
                            if (showTlFilterPosModal) setTlFilterPos(pos.id);
                            setShowWFilterPosModal(false);
                            setShowTlFilterPosModal(false);
                          }}>
                          <Text style={[styles.bigPosChipName, isSelected && styles.bigPosChipNameActive]}>
                            {pos.nama}
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
              onPress={() => {
                setShowWFilterPosModal(false);
                setShowTlFilterPosModal(false);
              }}>
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
              {/* Kiper */}
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

              {/* Bek */}
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

              {/* Gelandang */}
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

              {/* Penyerang */}
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

              {/* Lainnya */}
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

      {/* ─── PLAYER REPLACEMENT PICKER MODAL (WATCHLIST) ─ */}
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

      {/* ─── SQUAD PLAYER PICKER MODAL FOR TRANSFER & LOAN ─ */}
      <Modal
        visible={showTlPlayerPickerModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTlPlayerPickerModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowTlPlayerPickerModal(false)}>
          <View style={styles.filterModalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>PILIH PEMAIN SKUAD</Text>
              <TouchableOpacity onPress={() => setShowTlPlayerPickerModal(false)} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.wSearchRow, { marginHorizontal: 0, marginBottom: 10 }]}>
              <TextInput
                style={styles.wSearchInput}
                placeholder="🔍 Cari nama pemain atau posisi..."
                placeholderTextColor="#888"
                value={tlPlayerPickerSearch}
                onChangeText={setTlPlayerPickerSearch}
              />
              {tlPlayerPickerSearch.length > 0 && (
                <TouchableOpacity
                  onPress={() => setTlPlayerPickerSearch('')}
                  style={styles.wSearchClearBtn}>
                  <Text style={styles.wSearchClearText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              {availableSquadPlayersForTl.map((p) => {
                const isSelected = tlSelectedPlayerId === p.id;
                const primaryPos = p.positions[0]?.nama ?? '-';

                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.playerPickerItem,
                      isSelected && styles.playerPickerItemActive,
                    ]}
                    onPress={() => {
                      setTlSelectedPlayerId(p.id);
                      setShowTlPlayerPickerModal(false);
                    }}>
                    <View style={styles.playerPickerItemLeft}>
                      <View style={styles.playerPickerOvrBadge}>
                        <Text style={styles.playerPickerOvrText}>{p.ovr_current}</Text>
                        <Text style={styles.playerPickerPosText}>{primaryPos}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.playerPickerName,
                            isSelected && styles.playerPickerNameActive,
                          ]}>
                          {p.nama}
                        </Text>
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
              onPress={() => setShowTlPlayerPickerModal(false)}>
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

  // Segmented Bar (Transfer & Loan)
  tlSegmentBar: {
    flexDirection: 'row',
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 2,
    borderBottomColor: '#000',
    padding: 8,
    gap: 8,
  },
  tlSegmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#FFF',
  },
  tlSegmentBtnActiveJual: {
    backgroundColor: '#C5221F',
  },
  tlSegmentBtnActiveLoan: {
    backgroundColor: '#0A1128',
  },
  tlSegmentBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 0.5,
  },
  tlSegmentBtnTextActiveJual: {
    color: '#FFF',
  },
  tlSegmentBtnTextActiveLoan: {
    color: '#D4AF37',
  },

  // Filters Container (Shared)
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

  // Transfer & Loan Cards (Jual & Loan)
  tlSellCard: {
    backgroundColor: '#FFF8F6',
    borderWidth: 2.5,
    borderColor: '#C5221F',
    padding: 14,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  tlLoanCard: {
    backgroundColor: '#FAFAFA',
    borderWidth: 2.5,
    borderColor: '#0A1128',
    padding: 14,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  tlPlayerSub: {
    fontSize: 11,
    fontWeight: '700',
    color: '#555',
    marginTop: 2,
  },
  tlLoanBadgesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  tlLoanDurationBadge: {
    backgroundColor: '#0A1128',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#000',
  },
  tlLoanDurationBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#D4AF37',
  },
  tlLoanOptionBadge: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#000',
  },
  tlLoanOptionBadgeBuy: {
    backgroundColor: '#B06000',
  },
  tlLoanOptionBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#333',
  },
  tlLoanOptionBadgeTextBuy: {
    color: '#FFF',
  },
  tlWatchlistConnectBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#B06000',
    padding: 10,
    marginBottom: 10,
  },
  tlWatchlistConnectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  tlWatchlistConnectTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#B06000',
    letterSpacing: 0.5,
    flex: 1,
  },
  tlAddTargetMiniBtn: {
    backgroundColor: '#B06000',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#000',
  },
  tlAddTargetMiniBtnText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFF',
  },
  tlNoTargetText: {
    fontSize: 10.5,
    color: '#777',
    fontStyle: 'italic',
    marginTop: 2,
    lineHeight: 15,
  },
  tlTargetItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#DDD',
    padding: 6,
  },
  tlTargetItemBadge: {
    backgroundColor: '#0A1128',
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 8,
  },
  tlTargetItemBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#D4AF37',
  },
  tlTargetItemName: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#0A1128',
  },
  tlTargetItemOvr: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#B06000',
  },
  tlTargetItemNote: {
    fontSize: 9.5,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 1,
  },
  tlActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  tlSoldConfirmBtn: {
    flex: 1.5,
    backgroundColor: '#C5221F',
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#000',
  },
  tlSoldConfirmBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFF',
  },
  tlRecallBtn: {
    flex: 1.5,
    backgroundColor: '#0A1128',
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#000',
  },
  tlRecallBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#D4AF37',
  },
  tlCancelBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#000',
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  tlCancelBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0A1128',
  },
  tlEditBtn: {
    borderWidth: 1.5,
    borderColor: '#000',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFF',
  },
  tlEditBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0A1128',
  },

  // Transfer & Loan Form Styles
  tlTypeChoiceRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  tlTypeChoiceBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#FAFAFA',
  },
  tlTypeChoiceBtnActiveJual: {
    backgroundColor: '#C5221F',
  },
  tlTypeChoiceBtnActiveLoan: {
    backgroundColor: '#0A1128',
  },
  tlTypeChoiceBtnText: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#333',
  },
  tlTypeChoiceBtnTextActiveJual: {
    color: '#FFF',
  },
  tlTypeChoiceBtnTextActiveLoan: {
    color: '#D4AF37',
  },
  tlDurasiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  tlDurasiBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#000',
    backgroundColor: '#FAFAFA',
  },
  tlDurasiBtnActive: {
    backgroundColor: '#0A1128',
  },
  tlDurasiBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0A1128',
  },
  tlDurasiBtnTextActive: {
    color: '#D4AF37',
  },
  tlOpsiBeliRow: {
    gap: 6,
    marginBottom: 6,
  },
  tlOpsiBeliBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1.5,
    borderColor: '#000',
    backgroundColor: '#FAFAFA',
  },
  tlOpsiBeliBtnActive: {
    backgroundColor: '#0A1128',
  },
  tlOpsiBeliBtnActiveBuy: {
    backgroundColor: '#B06000',
  },
  tlOpsiBeliBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#333',
  },
  tlOpsiBeliBtnTextActive: {
    color: '#D4AF37',
  },
  tlOpsiBeliBtnTextActiveBuy: {
    color: '#FFF',
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
    backgroundColor: '#C5221F',
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  akanDijualTagText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#FFF',
  },
  loanBadgeTag: {
    backgroundColor: '#0A1128',
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  loanBadgeTagText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#D4AF37',
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
