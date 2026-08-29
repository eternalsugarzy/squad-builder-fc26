import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { useLocalSearchParams } from 'expo-router';
import { useProfile } from '@/src/contexts/ProfileContext';
import {
  listPlayers,
  createPlayer,
  updatePlayer,
  deletePlayer,
  quickChangeOvr,
  bulkUpdateOvr,
  getOvrHistory,
} from '@/src/services/playerService';
import { listPositions } from '@/src/services/positionService';
import type {
  PlayerWithPositions,
  Position,
  PlayerStatus,
  StatusDurasi,
  OvrHistory,
} from '@/src/types';

const STATUS_CONFIG: Record<PlayerStatus, { label: string; bg: string; text: string }> = {
  aktif: { label: 'AKTIF', bg: '#E6F4EA', text: '#137333' },
  loan_out: { label: 'LOAN OUT', bg: '#FEF7E0', text: '#B06000' },
  injured: { label: 'INJURED', bg: '#FCE8E6', text: '#C5221F' },
  akan_dijual: { label: 'AKAN DIJUAL', bg: '#FEEFC3', text: '#762700' },
  sudah_dijual: { label: 'SUDAH DIJUAL', bg: '#E8EAED', text: '#5F6368' },
};

type SortOption = 'ovr_desc' | 'ovr_asc' | 'nama_asc' | 'posisi';

export default function PlayersScreen() {
  const { activeProfile } = useProfile();
  const params = useLocalSearchParams<{ status?: string }>();

  const [players, setPlayers] = useState<PlayerWithPositions[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPos, setFilterPos] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('ovr_desc');

  // Filter Modals
  const [showPosFilterModal, setShowPosFilterModal] = useState(false);
  const [showStatusFilterModal, setShowStatusFilterModal] = useState(false);

  // Handle incoming status parameter from Home screen
  useEffect(() => {
    if (params.status) {
      setFilterStatus(params.status);
    }
  }, [params.status]);

  // Bulk Mode
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDelta, setBulkDelta] = useState<number>(1);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editPlayer, setEditPlayer] = useState<PlayerWithPositions | null>(null);
  const [ovrHistoryList, setOvrHistoryList] = useState<OvrHistory[]>([]);

  // Form State
  const [formNama, setFormNama] = useState('');
  const [formOvr, setFormOvr] = useState(75);
  const [formPositionIds, setFormPositionIds] = useState<string[]>([]);
  const [formStatus, setFormStatus] = useState<PlayerStatus>('aktif');
  const [formDurasi, setFormDurasi] = useState<StatusDurasi | null>(null);
  const [formCatatan, setFormCatatan] = useState('');

  const loadData = useCallback(async () => {
    if (!activeProfile) return;
    setLoading(true);
    try {
      const [pList, posList] = await Promise.all([
        listPlayers(activeProfile.id),
        listPositions(activeProfile.id),
      ]);
      setPlayers(pList);
      setPositions(posList);
    } catch (e) {
      console.error('[PlayersScreen] loadData error:', e);
    } finally {
      setLoading(false);
    }
  }, [activeProfile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const squadPlayers = useMemo(() => players.filter((p) => p.status !== 'sudah_dijual'), [players]);

  // Filtered & Sorted Players (Excludes sudah_dijual, which lives in Menu Lainnya -> Pemain Terjual)
  const filteredPlayers = useMemo(() => {
    return squadPlayers
      .filter((p) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          if (!p.nama.toLowerCase().includes(q)) return false;
        }
        // Position filter
        if (filterPos !== 'ALL') {
          const hasPos = p.positions.some((pos) => pos.id === filterPos);
          if (!hasPos) return false;
        }
        // Status filter
        if (filterStatus !== 'ALL') {
          if (p.status !== filterStatus) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'ovr_desc') return b.ovr_current - a.ovr_current;
        if (sortBy === 'ovr_asc') return a.ovr_current - b.ovr_current;
        if (sortBy === 'nama_asc') return a.nama.localeCompare(b.nama);
        if (sortBy === 'posisi') {
          const posA = a.positions[0]?.sort_order ?? 999;
          const posB = b.positions[0]?.sort_order ?? 999;
          return posA - posB;
        }
        return 0;
      });
  }, [squadPlayers, searchQuery, filterPos, filterStatus, sortBy]);

  // Categorized Positions for the Position Filter Modal
  const gkPositions = useMemo(() => positions.filter((p) => p.nama.toUpperCase() === 'GK'), [positions]);
  const defPositions = useMemo(
    () => positions.filter((p) => ['LB', 'CB', 'RB', 'LWB', 'RWB'].includes(p.nama.toUpperCase())),
    [positions]
  );
  const midPositions = useMemo(
    () => positions.filter((p) => ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(p.nama.toUpperCase())),
    [positions]
  );
  const attPositions = useMemo(
    () => positions.filter((p) => ['LW', 'RW', 'ST', 'CF', 'LF', 'RF'].includes(p.nama.toUpperCase())),
    [positions]
  );
  const otherPositions = useMemo(
    () =>
      positions.filter(
        (p) =>
          !['GK', 'LB', 'CB', 'RB', 'LWB', 'RWB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST', 'CF', 'LF', 'RF'].includes(
            p.nama.toUpperCase()
          )
      ),
    [positions]
  );

  const selectedPosObj = positions.find((p) => p.id === filterPos);
  const selectedPosLabel = filterPos === 'ALL' ? 'Semua Posisi' : selectedPosObj?.nama ?? 'Posisi';
  const selectedStatusLabel =
    filterStatus === 'ALL'
      ? 'Semua Status'
      : (STATUS_CONFIG[filterStatus as PlayerStatus]?.label ?? filterStatus.toUpperCase());

  // ─── Quick OVR Stepper ────────────────────────────
  async function handleQuickOvr(playerId: string, delta: number) {
    try {
      await quickChangeOvr(playerId, delta);
      setPlayers((prev) =>
        prev.map((p) => {
          if (p.id === playerId) {
            const nextOvr = Math.min(99, Math.max(1, p.ovr_current + delta));
            return { ...p, ovr_current: nextOvr };
          }
          return p;
        })
      );
    } catch (e) {
      Alert.alert('Error', 'Gagal mengubah OVR');
    }
  }

  // ─── Bulk Mode ──────────────────────────────────
  function toggleSelectPlayer(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSelectAll() {
    if (selectedIds.size === filteredPlayers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPlayers.map((p) => p.id)));
    }
  }

  async function handleApplyBulk() {
    if (selectedIds.size === 0) {
      Alert.alert('Info', 'Pilih minimal 1 pemain');
      return;
    }
    Alert.alert(
      'Konfirmasi Bulk Update',
      `Terapkan OVR ${bulkDelta > 0 ? `+${bulkDelta}` : bulkDelta} ke ${selectedIds.size} pemain terpilih?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Terapkan',
          onPress: async () => {
            try {
              await bulkUpdateOvr(Array.from(selectedIds), bulkDelta);
              setSelectedIds(new Set());
              setIsBulkMode(false);
              loadData();
            } catch (e) {
              Alert.alert('Error', 'Gagal update OVR massal');
            }
          },
        },
      ]
    );
  }

  // ─── Add / Edit Modals ──────────────────────────
  function openAdd() {
    setFormNama('');
    setFormOvr(75);
    setFormPositionIds(positions.length > 0 ? [positions[0].id] : []);
    setFormStatus('aktif');
    setFormDurasi(null);
    setFormCatatan('');
    setShowAddModal(true);
  }

  async function openEdit(player: PlayerWithPositions) {
    setEditPlayer(player);
    setFormNama(player.nama);
    setFormOvr(player.ovr_current);
    setFormPositionIds(player.positions.map((p) => p.id));
    setFormStatus(player.status);
    setFormDurasi(player.status_durasi);
    setFormCatatan(player.status_catatan ?? '');
    setShowEditModal(true);

    try {
      const hist = await getOvrHistory(player.id);
      setOvrHistoryList(hist);
    } catch (e) {
      setOvrHistoryList([]);
    }
  }

  function togglePositionInForm(posId: string) {
    setFormPositionIds((prev) => {
      if (prev.includes(posId)) {
        if (prev.length === 1) {
          Alert.alert('Peringatan', 'Pemain harus memiliki minimal 1 posisi');
          return prev;
        }
        return prev.filter((id) => id !== posId);
      } else {
        return [...prev, posId];
      }
    });
  }

  function setPrimaryPositionInForm(posId: string) {
    setFormPositionIds((prev) => {
      const filtered = prev.filter((id) => id !== posId);
      return [posId, ...filtered];
    });
  }

  async function handleSaveAdd() {
    if (!activeProfile) return;
    const trimmed = formNama.trim();
    if (!trimmed) {
      Alert.alert('Error', 'Nama pemain tidak boleh kosong');
      return;
    }
    if (formPositionIds.length === 0) {
      Alert.alert('Error', 'Pilih minimal 1 posisi');
      return;
    }

    try {
      await createPlayer({
        profile_id: activeProfile.id,
        nama: trimmed,
        ovr_current: formOvr,
        status: formStatus,
        status_durasi:
          formStatus === 'loan_out' || formStatus === 'injured' ? formDurasi : null,
        status_mulai:
          formStatus === 'loan_out' || formStatus === 'injured'
            ? new Date().toISOString()
            : null,
        status_catatan: formCatatan.trim() || null,
        position_ids: formPositionIds,
      });
      setShowAddModal(false);
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Gagal menambah pemain');
    }
  }

  async function handleSaveEdit() {
    if (!editPlayer) return;
    const trimmed = formNama.trim();
    if (!trimmed) {
      Alert.alert('Error', 'Nama pemain tidak boleh kosong');
      return;
    }
    if (formPositionIds.length === 0) {
      Alert.alert('Error', 'Pilih minimal 1 posisi');
      return;
    }

    try {
      await updatePlayer(editPlayer.id, {
        nama: trimmed,
        ovr_current: formOvr,
        status: formStatus,
        status_durasi:
          formStatus === 'loan_out' || formStatus === 'injured' ? formDurasi : null,
        status_mulai:
          formStatus === 'loan_out' || formStatus === 'injured'
            ? editPlayer.status_mulai ?? new Date().toISOString()
            : null,
        status_catatan: formCatatan.trim() || null,
        position_ids: formPositionIds,
      });
      setShowEditModal(false);
      setEditPlayer(null);
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Gagal memperbarui pemain');
    }
  }

  function handleDelete(player: PlayerWithPositions) {
    Alert.alert(
      'Hapus Pemain',
      `Hapus pemain "${player.nama}"?\nSemua riwayat dan penempatan squad pemain ini akan terhapus.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePlayer(player.id);
              setShowEditModal(false);
              setEditPlayer(null);
              loadData();
            } catch (e) {
              Alert.alert('Error', 'Gagal menghapus pemain');
            }
          },
        },
      ]
    );
  }

  // ─── Guard: No Active Profile ───────────────────
  if (!activeProfile) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>👥</Text>
        <Text style={styles.emptyTitle}>Belum Ada Profil Aktif</Text>
        <Text style={styles.emptyHint}>Pilih atau buat profil di tab Profil</Text>
      </View>
    );
  }

  // ─── Render Player Card ─────────────────────────
  function renderPlayerCard({ item }: { item: PlayerWithPositions }) {
    const isSelected = selectedIds.has(item.id);
    const primaryPos = item.positions[0]?.nama ?? '-';
    const secPositions = item.positions.slice(1);
    const statusCfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.aktif;

    return (
      <View style={[styles.playerCard, isSelected && styles.playerCardSelected]}>
        {isBulkMode && (
          <TouchableOpacity
            style={styles.checkboxTouch}
            onPress={() => toggleSelectPlayer(item.id)}>
            <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
              {isSelected && <Text style={styles.checkboxCheck}>✓</Text>}
            </View>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.cardMain}
          onPress={() => (isBulkMode ? toggleSelectPlayer(item.id) : openEdit(item))}
          activeOpacity={0.7}>
          {/* Left OVR badge */}
          <View style={styles.ovrBadge}>
            <Text style={styles.ovrNumber}>{item.ovr_current}</Text>
            <Text style={styles.primaryPosText}>{primaryPos}</Text>
          </View>

          {/* Player Info */}
          <View style={styles.playerInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.playerName} numberOfLines={1}>
                {item.nama}
              </Text>
            </View>

            {/* Sub info: Secondary positions & Status */}
            <View style={styles.subInfoRow}>
              {secPositions.length > 0 && (
                <View style={styles.secPosContainer}>
                  {secPositions.map((sp) => (
                    <View key={sp.id} style={styles.secPosBadge}>
                      <Text style={styles.secPosText}>{sp.nama}</Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
                <Text style={[styles.statusText, { color: statusCfg.text }]}>
                  {statusCfg.label}
                  {item.status_durasi ? ` (${item.status_durasi.replace('_', ' ')})` : ''}
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* Stepper Quick Edit (+ / -) */}
        {!isBulkMode && (
          <View style={styles.stepperContainer}>
            <TouchableOpacity
              style={styles.stepperBtn}
              onPress={() => handleQuickOvr(item.id, 1)}>
              <Text style={styles.stepperBtnText}>▲</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.stepperBtn}
              onPress={() => handleQuickOvr(item.id, -1)}>
              <Text style={styles.stepperBtnText}>▼</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  const hasActiveFilter = filterPos !== 'ALL' || filterStatus !== 'ALL' || searchQuery.trim().length > 0;

  return (
    <View style={styles.container}>
      {/* ─── Top Search & Bulk Bar ─────────────────── */}
      <View style={styles.topBar}>
        <View style={styles.searchWrapper}>
          <TextInput
            style={styles.searchInput}
            placeholder="Cari nama pemain..."
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.trim().length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.searchClearBtn}>
              <Text style={styles.searchClearText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.bulkToggleBtn, isBulkMode && styles.bulkToggleBtnActive]}
          onPress={() => {
            setIsBulkMode(!isBulkMode);
            setSelectedIds(new Set());
          }}>
          <Text style={[styles.bulkToggleText, isBulkMode && styles.bulkToggleTextActive]}>
            {isBulkMode ? 'SELESAI' : 'BULK OVR'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ─── Big Dual-Filter Selector Bar ──────────── */}
      <View style={styles.dualFilterRow}>
        {/* Position Filter Button */}
        <TouchableOpacity
          style={[styles.bigFilterBtn, filterPos !== 'ALL' && styles.bigFilterBtnActive]}
          onPress={() => setShowPosFilterModal(true)}
          activeOpacity={0.8}>
          <Text style={styles.bigFilterLabel}>POSISI:</Text>
          <View style={styles.bigFilterValRow}>
            <Text style={[styles.bigFilterValue, filterPos !== 'ALL' && styles.bigFilterValueActive]} numberOfLines={1}>
              {selectedPosLabel}
            </Text>
            <Text style={[styles.bigFilterArrow, filterPos !== 'ALL' && styles.bigFilterArrowActive]}>▾</Text>
          </View>
        </TouchableOpacity>

        {/* Status Filter Button */}
        <TouchableOpacity
          style={[styles.bigFilterBtn, filterStatus !== 'ALL' && styles.bigFilterBtnActive]}
          onPress={() => setShowStatusFilterModal(true)}
          activeOpacity={0.8}>
          <Text style={styles.bigFilterLabel}>STATUS:</Text>
          <View style={styles.bigFilterValRow}>
            <Text style={[styles.bigFilterValue, filterStatus !== 'ALL' && styles.bigFilterValueActive]} numberOfLines={1}>
              {selectedStatusLabel}
            </Text>
            <Text style={[styles.bigFilterArrow, filterStatus !== 'ALL' && styles.bigFilterArrowActive]}>▾</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ─── Active Filter Tags Bar (If Any Active) ─── */}
      {hasActiveFilter && (
        <View style={styles.activeFilterTagsRow}>
          <Text style={styles.activeFilterLead}>FILTER:</Text>
          {filterPos !== 'ALL' && (
            <TouchableOpacity style={styles.activeFilterTag} onPress={() => setFilterPos('ALL')}>
              <Text style={styles.activeFilterTagText}>Posisi: {selectedPosLabel} ✕</Text>
            </TouchableOpacity>
          )}
          {filterStatus !== 'ALL' && (
            <TouchableOpacity style={styles.activeFilterTag} onPress={() => setFilterStatus('ALL')}>
              <Text style={styles.activeFilterTagText}>Status: {selectedStatusLabel} ✕</Text>
            </TouchableOpacity>
          )}
          {searchQuery.trim().length > 0 && (
            <TouchableOpacity style={styles.activeFilterTag} onPress={() => setSearchQuery('')}>
              <Text style={styles.activeFilterTagText}>"{searchQuery}" ✕</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.resetAllFilterBtn}
            onPress={() => {
              setFilterPos('ALL');
              setFilterStatus('ALL');
              setSearchQuery('');
            }}>
            <Text style={styles.resetAllFilterText}>Reset 🔄</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ─── Sort selection bar ─────────────────────── */}
      <View style={styles.sortBar}>
        <Text style={styles.countText}>{filteredPlayers.length} PEMAIN</Text>
        <View style={styles.sortBtns}>
          <TouchableOpacity
            style={[styles.sortBtn, sortBy === 'ovr_desc' && styles.sortBtnActive]}
            onPress={() => setSortBy('ovr_desc')}>
            <Text style={[styles.sortBtnText, sortBy === 'ovr_desc' && styles.sortBtnTextActive]}>
              OVR ↓
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortBtn, sortBy === 'ovr_asc' && styles.sortBtnActive]}
            onPress={() => setSortBy('ovr_asc')}>
            <Text style={[styles.sortBtnText, sortBy === 'ovr_asc' && styles.sortBtnTextActive]}>
              OVR ↑
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortBtn, sortBy === 'nama_asc' && styles.sortBtnActive]}
            onPress={() => setSortBy('nama_asc')}>
            <Text style={[styles.sortBtnText, sortBy === 'nama_asc' && styles.sortBtnTextActive]}>
              A-Z
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortBtn, sortBy === 'posisi' && styles.sortBtnActive]}
            onPress={() => setSortBy('posisi')}>
            <Text style={[styles.sortBtnText, sortBy === 'posisi' && styles.sortBtnTextActive]}>
              POSISI
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bulk Action Header when active */}
      {isBulkMode && (
        <View style={styles.bulkActionBar}>
          <TouchableOpacity style={styles.bulkSelectAllBtn} onPress={handleSelectAll}>
            <Text style={styles.bulkSelectAllText}>
              {selectedIds.size === filteredPlayers.length ? 'Batal Semua' : 'Pilih Semua'}
            </Text>
          </TouchableOpacity>
          <View style={styles.bulkDeltaControls}>
            <Text style={styles.bulkDeltaLabel}>Delta:</Text>
            {[-2, -1, 1, 2, 3].map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.bulkDeltaBtn, bulkDelta === d && styles.bulkDeltaBtnActive]}
                onPress={() => setBulkDelta(d)}>
                <Text
                  style={[
                    styles.bulkDeltaBtnText,
                    bulkDelta === d && styles.bulkDeltaBtnTextActive,
                  ]}>
                  {d > 0 ? `+${d}` : d}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.bulkApplyBtn, selectedIds.size === 0 && { opacity: 0.5 }]}
            onPress={handleApplyBulk}
            disabled={selectedIds.size === 0}>
            <Text style={styles.bulkApplyText}>APPLY ({selectedIds.size})</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Player List */}
      {loading ? (
        <ActivityIndicator size="large" color="#0A1128" style={{ marginTop: 40 }} />
      ) : filteredPlayers.length === 0 ? (
        <View style={styles.emptyList}>
          <Text style={styles.emptyListText}>Tidak ada pemain ditemukan</Text>
          {hasActiveFilter && (
            <TouchableOpacity
              style={styles.emptyResetBtn}
              onPress={() => {
                setFilterPos('ALL');
                setFilterStatus('ALL');
                setSearchQuery('');
              }}>
              <Text style={styles.emptyResetText}>RESET FILTER</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredPlayers}
          keyExtractor={(item) => item.id}
          renderItem={renderPlayerCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Floating Button (Circular Plus) */}
      {!isBulkMode && (
        <TouchableOpacity style={styles.fabAdd} onPress={openAdd} activeOpacity={0.8}>
          <Text style={styles.fabAddIcon}>+</Text>
        </TouchableOpacity>
      )}

      {/* ─── POSITION FILTER MODAL (ORGANIZED GRID) ── */}
      <Modal
        visible={showPosFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPosFilterModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowPosFilterModal(false)}>
          <View style={styles.filterModalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>PILIH FILTER POSISI</Text>
              <TouchableOpacity onPress={() => setShowPosFilterModal(false)} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {/* Option: Semua Posisi */}
              <TouchableOpacity
                style={[styles.posGroupAllBtn, filterPos === 'ALL' && styles.posGroupAllBtnActive]}
                onPress={() => {
                  setFilterPos('ALL');
                  setShowPosFilterModal(false);
                }}>
                <Text style={[styles.posGroupAllText, filterPos === 'ALL' && styles.posGroupAllTextActive]}>
                  🔘 SEMUA POSISI ({squadPlayers.length} Pemain)
                </Text>
              </TouchableOpacity>

              {/* Group: Kiper */}
              {gkPositions.length > 0 && (
                <View style={styles.posCategorySection}>
                  <Text style={styles.posCategoryHeader}>🧤 PENJAGA GAWANG</Text>
                  <View style={styles.posCategoryGrid}>
                    {gkPositions.map((pos) => {
                      const count = squadPlayers.filter((p) => p.positions.some((pp) => pp.id === pos.id)).length;
                      const isSelected = filterPos === pos.id;
                      return (
                        <TouchableOpacity
                          key={pos.id}
                          style={[styles.bigPosChip, isSelected && styles.bigPosChipActive]}
                          onPress={() => {
                            setFilterPos(pos.id);
                            setShowPosFilterModal(false);
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
                  <Text style={styles.posCategoryHeader}>🛡️ BEK / DEFENDER</Text>
                  <View style={styles.posCategoryGrid}>
                    {defPositions.map((pos) => {
                      const count = players.filter((p) => p.positions.some((pp) => pp.id === pos.id)).length;
                      const isSelected = filterPos === pos.id;
                      return (
                        <TouchableOpacity
                          key={pos.id}
                          style={[styles.bigPosChip, isSelected && styles.bigPosChipActive]}
                          onPress={() => {
                            setFilterPos(pos.id);
                            setShowPosFilterModal(false);
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
                  <Text style={styles.posCategoryHeader}>⚙️ GELANDANG / MIDFIELD</Text>
                  <View style={styles.posCategoryGrid}>
                    {midPositions.map((pos) => {
                      const count = players.filter((p) => p.positions.some((pp) => pp.id === pos.id)).length;
                      const isSelected = filterPos === pos.id;
                      return (
                        <TouchableOpacity
                          key={pos.id}
                          style={[styles.bigPosChip, isSelected && styles.bigPosChipActive]}
                          onPress={() => {
                            setFilterPos(pos.id);
                            setShowPosFilterModal(false);
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
                  <Text style={styles.posCategoryHeader}>⚡ PENYERANG / ATTACK</Text>
                  <View style={styles.posCategoryGrid}>
                    {attPositions.map((pos) => {
                      const count = players.filter((p) => p.positions.some((pp) => pp.id === pos.id)).length;
                      const isSelected = filterPos === pos.id;
                      return (
                        <TouchableOpacity
                          key={pos.id}
                          style={[styles.bigPosChip, isSelected && styles.bigPosChipActive]}
                          onPress={() => {
                            setFilterPos(pos.id);
                            setShowPosFilterModal(false);
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
                      const count = players.filter((p) => p.positions.some((pp) => pp.id === pos.id)).length;
                      const isSelected = filterPos === pos.id;
                      return (
                        <TouchableOpacity
                          key={pos.id}
                          style={[styles.bigPosChip, isSelected && styles.bigPosChipActive]}
                          onPress={() => {
                            setFilterPos(pos.id);
                            setShowPosFilterModal(false);
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
              onPress={() => setShowPosFilterModal(false)}>
              <Text style={styles.modalBottomBtnText}>TUTUP</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ─── STATUS FILTER MODAL (ORGANIZED LIST) ──── */}
      <Modal
        visible={showStatusFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStatusFilterModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowStatusFilterModal(false)}>
          <View style={styles.filterModalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>PILIH FILTER STATUS</Text>
              <TouchableOpacity onPress={() => setShowStatusFilterModal(false)} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={{ gap: 8, marginVertical: 8 }}>
              {/* Option: Semua Status */}
              <TouchableOpacity
                style={[styles.statusChoiceRow, filterStatus === 'ALL' && styles.statusChoiceRowActive]}
                onPress={() => {
                  setFilterStatus('ALL');
                  setShowStatusFilterModal(false);
                }}>
                <Text style={[styles.statusChoiceName, filterStatus === 'ALL' && styles.statusChoiceNameActive]}>
                  🔘 Semua Status Skuad
                </Text>
                <Text style={[styles.statusChoiceCount, filterStatus === 'ALL' && styles.statusChoiceCountActive]}>
                  {squadPlayers.length} Pemain
                </Text>
              </TouchableOpacity>

              {(['aktif', 'loan_out', 'injured', 'akan_dijual'] as PlayerStatus[]).map((st) => {
                const count = players.filter((p) => p.status === st).length;
                const isSelected = filterStatus === st;
                const cfg = STATUS_CONFIG[st];

                return (
                  <TouchableOpacity
                    key={st}
                    style={[styles.statusChoiceRow, isSelected && styles.statusChoiceRowActive]}
                    onPress={() => {
                      setFilterStatus(st);
                      setShowStatusFilterModal(false);
                    }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={[styles.statusChoiceBadge, { backgroundColor: cfg.bg }]}>
                        <Text style={[styles.statusChoiceBadgeText, { color: cfg.text }]}>
                          {cfg.label}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.statusChoiceCount, isSelected && styles.statusChoiceCountActive]}>
                      {count} Pemain
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.modalBottomBtn}
              onPress={() => setShowStatusFilterModal(false)}>
              <Text style={styles.modalBottomBtnText}>TUTUP</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ─── ADD PLAYER MODAL ───────────────────────── */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowAddModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalCenter}>
            <Pressable style={styles.formModalCard} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.modalTitle}>TAMBAH PEMAIN</Text>
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
                {/* Name */}
                <Text style={styles.inputLabel}>NAMA PEMAIN</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Misal: Rodrygo"
                  placeholderTextColor="#999"
                  value={formNama}
                  onChangeText={setFormNama}
                  maxLength={50}
                />

                {/* OVR Stepper */}
                <Text style={styles.inputLabel}>OVERALL RATING (OVR)</Text>
                <View style={styles.formOvrRow}>
                  <TouchableOpacity
                    style={styles.formOvrBtn}
                    onPress={() => setFormOvr(Math.max(40, formOvr - 1))}>
                    <Text style={styles.formOvrBtnText}>-1</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.formOvrInput}
                    value={String(formOvr)}
                    onChangeText={(val) => {
                      const num = parseInt(val, 10);
                      if (!isNaN(num)) setFormOvr(Math.min(99, Math.max(1, num)));
                    }}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                  <TouchableOpacity
                    style={styles.formOvrBtn}
                    onPress={() => setFormOvr(Math.min(99, formOvr + 1))}>
                    <Text style={styles.formOvrBtnText}>+1</Text>
                  </TouchableOpacity>
                </View>

                {/* Position Multi-select */}
                <Text style={styles.inputLabel}>
                  POSISI (Tap untuk pilih, Posisi pertama = UTAMA)
                </Text>
                <View style={styles.positionsSelectGrid}>
                  {positions.map((pos) => {
                    const isSelected = formPositionIds.includes(pos.id);
                    const isPrimary = formPositionIds[0] === pos.id;

                    return (
                      <TouchableOpacity
                        key={pos.id}
                        style={[
                          styles.posSelectChip,
                          isSelected && styles.posSelectChipSelected,
                          isPrimary && styles.posSelectChipPrimary,
                        ]}
                        onPress={() => togglePositionInForm(pos.id)}
                        onLongPress={() => setPrimaryPositionInForm(pos.id)}>
                        <Text
                          style={[
                            styles.posSelectChipText,
                            isSelected && styles.posSelectChipTextSelected,
                            isPrimary && styles.posSelectChipTextPrimary,
                          ]}>
                          {pos.nama} {isPrimary ? '★' : ''}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Status */}
                <Text style={styles.inputLabel}>STATUS</Text>
                <View style={styles.statusGrid}>
                  {(['aktif', 'loan_out', 'injured', 'akan_dijual', 'sudah_dijual'] as PlayerStatus[]).map((st) => (
                    <TouchableOpacity
                      key={st}
                      style={[styles.statusOption, formStatus === st && styles.statusOptionActive]}
                      onPress={() => setFormStatus(st)}>
                      <Text
                        style={[
                          styles.statusOptionText,
                          formStatus === st && styles.statusOptionTextActive,
                        ]}>
                        {STATUS_CONFIG[st].label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Durasi if loan_out / injured */}
                {(formStatus === 'loan_out' || formStatus === 'injured') && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.inputLabel}>DURASI</Text>
                    <View style={styles.durasiRow}>
                      {(['6_bulan', '1_tahun', '2_tahun'] as StatusDurasi[]).map((d) => (
                        <TouchableOpacity
                          key={d}
                          style={[styles.durasiBtn, formDurasi === d && styles.durasiBtnActive]}
                          onPress={() => setFormDurasi(d)}>
                          <Text
                            style={[
                              styles.durasiBtnText,
                              formDurasi === d && styles.durasiBtnTextActive,
                            ]}>
                            {d.replace('_', ' ')}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Catatan */}
                <Text style={styles.inputLabel}>CATATAN (OPSIONAL)</Text>
                <TextInput
                  style={[styles.modalInput, { height: 60 }]}
                  placeholder="Catatan pemain..."
                  placeholderTextColor="#999"
                  value={formCatatan}
                  onChangeText={setFormCatatan}
                  multiline
                />
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowAddModal(false)}>
                  <Text style={styles.modalCancelText}>BATAL</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleSaveAdd}>
                  <Text style={styles.modalConfirmText}>SIMPAN</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* ─── EDIT PLAYER MODAL ───────────────────────── */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowEditModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalCenter}>
            <Pressable style={styles.formModalCard} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>EDIT PEMAIN</Text>
                {editPlayer && (
                  <TouchableOpacity onPress={() => handleDelete(editPlayer)}>
                    <Text style={styles.deleteLinkText}>🗑️ Hapus</Text>
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 440 }}>
                {/* Name */}
                <Text style={styles.inputLabel}>NAMA PEMAIN</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Nama Pemain"
                  placeholderTextColor="#999"
                  value={formNama}
                  onChangeText={setFormNama}
                  maxLength={50}
                />

                {/* OVR Stepper */}
                <Text style={styles.inputLabel}>OVERALL RATING (OVR)</Text>
                <View style={styles.formOvrRow}>
                  <TouchableOpacity
                    style={styles.formOvrBtn}
                    onPress={() => setFormOvr(Math.max(40, formOvr - 1))}>
                    <Text style={styles.formOvrBtnText}>-1</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.formOvrInput}
                    value={String(formOvr)}
                    onChangeText={(val) => {
                      const num = parseInt(val, 10);
                      if (!isNaN(num)) setFormOvr(Math.min(99, Math.max(1, num)));
                    }}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                  <TouchableOpacity
                    style={styles.formOvrBtn}
                    onPress={() => setFormOvr(Math.min(99, formOvr + 1))}>
                    <Text style={styles.formOvrBtnText}>+1</Text>
                  </TouchableOpacity>
                </View>

                {/* Position Multi-select */}
                <Text style={styles.inputLabel}>
                  POSISI (Tap untuk toggle, Long press = UTAMA)
                </Text>
                <View style={styles.positionsSelectGrid}>
                  {positions.map((pos) => {
                    const isSelected = formPositionIds.includes(pos.id);
                    const isPrimary = formPositionIds[0] === pos.id;

                    return (
                      <TouchableOpacity
                        key={pos.id}
                        style={[
                          styles.posSelectChip,
                          isSelected && styles.posSelectChipSelected,
                          isPrimary && styles.posSelectChipPrimary,
                        ]}
                        onPress={() => togglePositionInForm(pos.id)}
                        onLongPress={() => setPrimaryPositionInForm(pos.id)}>
                        <Text
                          style={[
                            styles.posSelectChipText,
                            isSelected && styles.posSelectChipTextSelected,
                            isPrimary && styles.posSelectChipTextPrimary,
                          ]}>
                          {pos.nama} {isPrimary ? '★' : ''}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Status */}
                <Text style={styles.inputLabel}>STATUS</Text>
                <View style={styles.statusGrid}>
                  {(['aktif', 'loan_out', 'injured', 'akan_dijual', 'sudah_dijual'] as PlayerStatus[]).map((st) => (
                    <TouchableOpacity
                      key={st}
                      style={[styles.statusOption, formStatus === st && styles.statusOptionActive]}
                      onPress={() => setFormStatus(st)}>
                      <Text
                        style={[
                          styles.statusOptionText,
                          formStatus === st && styles.statusOptionTextActive,
                        ]}>
                        {STATUS_CONFIG[st].label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Durasi if loan_out / injured */}
                {(formStatus === 'loan_out' || formStatus === 'injured') && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.inputLabel}>DURASI</Text>
                    <View style={styles.durasiRow}>
                      {(['6_bulan', '1_tahun', '2_tahun'] as StatusDurasi[]).map((d) => (
                        <TouchableOpacity
                          key={d}
                          style={[styles.durasiBtn, formDurasi === d && styles.durasiBtnActive]}
                          onPress={() => setFormDurasi(d)}>
                          <Text
                            style={[
                              styles.durasiBtnText,
                              formDurasi === d && styles.durasiBtnTextActive,
                            ]}>
                            {d.replace('_', ' ')}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Catatan */}
                <Text style={styles.inputLabel}>CATATAN</Text>
                <TextInput
                  style={[styles.modalInput, { height: 60 }]}
                  placeholder="Catatan..."
                  placeholderTextColor="#999"
                  value={formCatatan}
                  onChangeText={setFormCatatan}
                  multiline
                />

                {/* OVR History */}
                {ovrHistoryList.length > 0 && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.inputLabel}>RIWAYAT PERUBAHAN OVR</Text>
                    <View style={styles.historyBox}>
                      {ovrHistoryList.map((h) => (
                        <View key={h.id} style={styles.historyRow}>
                          <Text style={styles.historyDate}>
                            {new Date(h.tanggal).toLocaleDateString('id-ID')}
                          </Text>
                          <Text style={styles.historyChange}>
                            {h.ovr_lama} ➔ {h.ovr_baru} (
                            {h.ovr_baru - h.ovr_lama > 0 ? `+${h.ovr_baru - h.ovr_lama}` : h.ovr_baru - h.ovr_lama})
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => {
                    setShowEditModal(false);
                    setEditPlayer(null);
                  }}>
                  <Text style={styles.modalCancelText}>BATAL</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleSaveEdit}>
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
    padding: 32,
    backgroundColor: '#FFFFFF',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 1,
  },
  emptyHint: {
    fontSize: 13,
    color: '#666',
    marginTop: 6,
  },

  // Top Search Bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  searchWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#FAFAFA',
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: '700',
    color: '#0A1128',
  },
  searchClearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  searchClearText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#888',
  },
  bulkToggleBtn: {
    backgroundColor: '#FAFAFA',
    borderWidth: 2,
    borderColor: '#000',
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  bulkToggleBtnActive: {
    backgroundColor: '#0A1128',
  },
  bulkToggleText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 0.5,
  },
  bulkToggleTextActive: {
    color: '#D4AF37',
  },

  // Big Dual Filter Buttons
  dualFilterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  bigFilterBtn: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    borderWidth: 2,
    borderColor: '#000',
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  bigFilterBtnActive: {
    backgroundColor: '#F0F4FF',
    borderColor: '#0A1128',
  },
  bigFilterLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#888',
    letterSpacing: 0.5,
  },
  bigFilterValRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  bigFilterValue: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0A1128',
    flex: 1,
  },
  bigFilterValueActive: {
    color: '#0A1128',
  },
  bigFilterArrow: {
    fontSize: 12,
    fontWeight: '900',
    color: '#888',
    marginLeft: 4,
  },
  bigFilterArrowActive: {
    color: '#0A1128',
  },

  // Active Filter Tags Bar
  activeFilterTagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 6,
    marginBottom: 8,
  },
  activeFilterLead: {
    fontSize: 10,
    fontWeight: '900',
    color: '#666',
  },
  activeFilterTag: {
    backgroundColor: '#0A1128',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#000',
  },
  activeFilterTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D4AF37',
  },
  resetAllFilterBtn: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#000',
  },
  resetAllFilterText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#333',
  },

  // Sort bar
  sortBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: '#000',
    backgroundColor: '#F8F9FA',
  },
  countText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 0.5,
  },
  sortBtns: {
    flexDirection: 'row',
    gap: 4,
  },
  sortBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1.5,
    borderColor: '#000',
    backgroundColor: '#FFF',
  },
  sortBtnActive: {
    backgroundColor: '#0A1128',
  },
  sortBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#666',
  },
  sortBtnTextActive: {
    color: '#D4AF37',
  },

  // Bulk Action Bar
  bulkActionBar: {
    backgroundColor: '#FFFBE6',
    borderBottomWidth: 2,
    borderBottomColor: '#000',
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bulkSelectAllBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1.5,
    borderColor: '#000',
    backgroundColor: '#FFF',
  },
  bulkSelectAllText: {
    fontSize: 11,
    fontWeight: '800',
  },
  bulkDeltaControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bulkDeltaLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0A1128',
  },
  bulkDeltaBtn: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#000',
    backgroundColor: '#FFF',
  },
  bulkDeltaBtnActive: {
    backgroundColor: '#0A1128',
  },
  bulkDeltaBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0A1128',
  },
  bulkDeltaBtnTextActive: {
    color: '#FFF',
  },
  bulkApplyBtn: {
    backgroundColor: '#0A1128',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 2,
    borderColor: '#000',
  },
  bulkApplyText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#D4AF37',
  },

  // Player List
  listContent: {
    padding: 16,
    paddingBottom: 160,
  },
  emptyList: {
    padding: 40,
    alignItems: 'center',
  },
  emptyListText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#888',
  },
  emptyResetBtn: {
    marginTop: 12,
    backgroundColor: '#0A1128',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: '#000',
  },
  emptyResetText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#D4AF37',
  },

  // Player Card
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#FAFAFA',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  playerCardSelected: {
    backgroundColor: '#FFF9E6',
    borderColor: '#D4AF37',
  },
  checkboxTouch: {
    padding: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: '#0A1128',
  },
  checkboxCheck: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 14,
  },
  cardMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  ovrBadge: {
    width: 48,
    height: 48,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#0A1128',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  ovrNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: '#D4AF37',
    lineHeight: 20,
  },
  primaryPosText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 1,
  },
  playerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0A1128',
  },
  subInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  secPosContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  secPosBadge: {
    borderWidth: 1,
    borderColor: '#888',
    paddingHorizontal: 4,
    paddingVertical: 1,
    backgroundColor: '#EFEFEF',
  },
  secPosText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#555',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  statusText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  stepperContainer: {
    borderLeftWidth: 2,
    borderLeftColor: '#000',
    backgroundColor: '#EEE',
  },
  stepperBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperBtnText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0A1128',
  },

  // Floating Button (Circular Plus)
  fabAdd: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 68 : 50,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0A1128',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
    zIndex: 99,
  },
  fabAddIcon: {
    fontSize: 34,
    fontWeight: '900',
    color: '#D4AF37',
    marginTop: -3,
    textAlign: 'center',
    includeFontPadding: false,
  },

  // Filter Modals
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
  filterModalCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#000',
    padding: 16,
    width: '92%',
    maxWidth: 440,
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
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#000',
  },
  filterModalTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 1,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalCloseBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#666',
  },
  posGroupAllBtn: {
    backgroundColor: '#F0F0F0',
    borderWidth: 2,
    borderColor: '#000',
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  posGroupAllBtnActive: {
    backgroundColor: '#0A1128',
  },
  posGroupAllText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0A1128',
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
    color: '#888',
    letterSpacing: 0.5,
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
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: '31%',
    flexGrow: 1,
  },
  bigPosChipActive: {
    backgroundColor: '#0A1128',
    borderColor: '#0A1128',
  },
  bigPosChipName: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0A1128',
  },
  bigPosChipNameActive: {
    color: '#D4AF37',
  },
  bigPosChipCount: {
    fontSize: 10,
    fontWeight: '800',
    color: '#666',
    marginLeft: 4,
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

  // Status Filter Modal Rows
  statusChoiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderWidth: 1.5,
    borderColor: '#000',
    padding: 12,
  },
  statusChoiceRowActive: {
    backgroundColor: '#F0F4FF',
    borderColor: '#0A1128',
    borderWidth: 2.5,
  },
  statusChoiceName: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0A1128',
  },
  statusChoiceNameActive: {
    color: '#0A1128',
  },
  statusChoiceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  statusChoiceBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  statusChoiceCount: {
    fontSize: 11,
    color: '#666',
    fontWeight: '700',
  },
  statusChoiceCountActive: {
    color: '#0A1128',
    fontWeight: '900',
  },

  // Form Modals (Add / Edit)
  formModalCard: {
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
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 1,
    marginBottom: 12,
  },
  deleteLinkText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#C5221F',
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
    fontWeight: '700',
    color: '#0A1128',
    backgroundColor: '#FAFAFA',
  },
  formOvrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  formOvrBtn: {
    borderWidth: 2,
    borderColor: '#000',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F0F0F0',
  },
  formOvrBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0A1128',
  },
  formOvrInput: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#000',
    paddingVertical: 8,
    fontSize: 22,
    fontWeight: '900',
    color: '#0A1128',
    textAlign: 'center',
    backgroundColor: '#FAFAFA',
  },
  positionsSelectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  posSelectChip: {
    borderWidth: 1.5,
    borderColor: '#DDD',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FAFAFA',
  },
  posSelectChipSelected: {
    borderColor: '#0A1128',
    backgroundColor: '#E8F0FE',
  },
  posSelectChipPrimary: {
    borderColor: '#000',
    backgroundColor: '#0A1128',
  },
  posSelectChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#888',
  },
  posSelectChipTextSelected: {
    color: '#0A1128',
  },
  posSelectChipTextPrimary: {
    color: '#D4AF37',
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  statusOption: {
    borderWidth: 1.5,
    borderColor: '#DDD',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FAFAFA',
  },
  statusOptionActive: {
    borderColor: '#000',
    backgroundColor: '#D4AF37',
  },
  statusOptionText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#666',
  },
  statusOptionTextActive: {
    color: '#000',
  },
  durasiRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  durasiBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#DDD',
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  durasiBtnActive: {
    borderColor: '#000',
    backgroundColor: '#0A1128',
  },
  durasiBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#666',
  },
  durasiBtnTextActive: {
    color: '#D4AF37',
  },
  historyBox: {
    borderWidth: 1.5,
    borderColor: '#DDD',
    backgroundColor: '#FAFAFA',
    padding: 8,
    marginTop: 4,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  historyDate: {
    fontSize: 11,
    color: '#666',
  },
  historyChange: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0A1128',
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
    fontWeight: '900',
    color: '#000',
  },
});
