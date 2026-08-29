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

  const [players, setPlayers] = useState<PlayerWithPositions[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPos, setFilterPos] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('ovr_desc');

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

  // Filtered & Sorted Players
  const filteredPlayers = useMemo(() => {
    return players
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
  }, [players, searchQuery, filterPos, filterStatus, sortBy]);

  // ─── Quick OVR ──────────────────────────────────
  async function handleQuickOvr(playerId: string, delta: number) {
    try {
      const newOvr = await quickChangeOvr(playerId, delta);
      setPlayers((prev) =>
        prev.map((p) => (p.id === playerId ? { ...p, ovr_current: newOvr } : p))
      );
    } catch (e) {
      console.error('Quick OVR error:', e);
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
          {/* Left OVR badge (FIFA card inspired) */}
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

  return (
    <View style={styles.container}>
      {/* Top Search & Filter Bar */}
      <View style={styles.topBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Cari nama pemain..."
          placeholderTextColor="#888"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity
          style={[styles.bulkToggleBtn, isBulkMode && styles.bulkToggleBtnActive]}
          onPress={() => {
            setIsBulkMode(!isBulkMode);
            setSelectedIds(new Set());
          }}>
          <Text
            style={[
              styles.bulkToggleText,
              isBulkMode && styles.bulkToggleTextActive,
            ]}>
            {isBulkMode ? 'SELESAI' : 'BULK OVR'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Position Filter Pills (Horizontal Scroll) */}
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsScroll}>
          <TouchableOpacity
            style={[styles.pill, filterPos === 'ALL' && styles.pillActive]}
            onPress={() => setFilterPos('ALL')}>
            <Text style={[styles.pillText, filterPos === 'ALL' && styles.pillTextActive]}>
              SEMUA POSISI
            </Text>
          </TouchableOpacity>
          {positions.map((pos) => (
            <TouchableOpacity
              key={pos.id}
              style={[styles.pill, filterPos === pos.id && styles.pillActive]}
              onPress={() => setFilterPos(pos.id)}>
              <Text style={[styles.pillText, filterPos === pos.id && styles.pillTextActive]}>
                {pos.nama}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Status Filter & Sort Row */}
      <View style={styles.filterRowSecondary}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsScroll}>
          <TouchableOpacity
            style={[styles.statusPill, filterStatus === 'ALL' && styles.statusPillActive]}
            onPress={() => setFilterStatus('ALL')}>
            <Text style={[styles.statusPillText, filterStatus === 'ALL' && styles.statusPillTextActive]}>
              Semua Status
            </Text>
          </TouchableOpacity>
          {(['aktif', 'loan_out', 'injured', 'akan_dijual', 'sudah_dijual'] as PlayerStatus[]).map((st) => (
            <TouchableOpacity
              key={st}
              style={[styles.statusPill, filterStatus === st && styles.statusPillActive]}
              onPress={() => setFilterStatus(st)}>
              <Text style={[styles.statusPillText, filterStatus === st && styles.statusPillTextActive]}>
                {STATUS_CONFIG[st].label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Sort selection bar */}
      <View style={styles.sortBar}>
        <Text style={styles.countText}>
          {filteredPlayers.length} PEMAIN
        </Text>
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
        </View>
      ) : (
        <FlatList
          data={filteredPlayers}
          renderItem={renderPlayerCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Floating Add Player Button (Round Plus) */}
      {!isBulkMode && (
        <TouchableOpacity style={styles.fabAdd} onPress={openAdd} activeOpacity={0.8}>
          <Text style={styles.fabAddIcon}>+</Text>
        </TouchableOpacity>
      )}

      {/* ─── ADD MODAL ──────────────────────────────── */}
      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
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

                {/* Notes */}
                <Text style={styles.inputLabel}>CATATAN (Opsional)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Catatan status..."
                  placeholderTextColor="#999"
                  value={formCatatan}
                  onChangeText={setFormCatatan}
                  maxLength={100}
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

      {/* ─── EDIT MODAL ─────────────────────────────── */}
      <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => setShowEditModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowEditModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalCenter}>
            <Pressable style={styles.formModalCard} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>EDIT PEMAIN</Text>
                {editPlayer && (
                  <TouchableOpacity onPress={() => handleDelete(editPlayer)}>
                    <Text style={styles.deleteLinkText}>HAPUS 🗑️</Text>
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
                {/* Name */}
                <Text style={styles.inputLabel}>NAMA PEMAIN</Text>
                <TextInput
                  style={styles.modalInput}
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
                  POSISI (Tap toggle, Long-press set UTAMA ★)
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

                {/* Notes */}
                <Text style={styles.inputLabel}>CATATAN</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Catatan..."
                  placeholderTextColor="#999"
                  value={formCatatan}
                  onChangeText={setFormCatatan}
                  maxLength={100}
                />

                {/* OVR History Timeline */}
                <Text style={[styles.inputLabel, { marginTop: 16 }]}>
                  RIWAYAT PERUBAHAN OVR
                </Text>
                {ovrHistoryList.length === 0 ? (
                  <Text style={styles.historyEmpty}>Belum ada riwayat perubahan OVR</Text>
                ) : (
                  <View style={styles.historyList}>
                    {ovrHistoryList.map((hist) => (
                      <View key={hist.id} style={styles.historyItem}>
                        <Text style={styles.historyOvr}>
                          {hist.ovr_lama} →{' '}
                          <Text style={{ fontWeight: '900', color: hist.ovr_baru >= hist.ovr_lama ? '#137333' : '#C5221F' }}>
                            {hist.ovr_baru}
                          </Text>
                        </Text>
                        <Text style={styles.historyDate}>
                          {new Date(hist.tanggal).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowEditModal(false)}>
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

  // Top Bar
  topBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
    backgroundColor: '#FAFAFA',
  },
  searchInput: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#0A1128',
  },
  bulkToggleBtn: {
    borderWidth: 2,
    borderColor: '#000',
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
  },
  bulkToggleBtnActive: {
    backgroundColor: '#D4AF37',
  },
  bulkToggleText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 1,
  },
  bulkToggleTextActive: {
    color: '#000',
  },

  // Pills Row
  filterRow: {
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingVertical: 6,
  },
  filterRowSecondary: {
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 2,
    borderBottomColor: '#000',
    paddingVertical: 4,
  },
  pillsScroll: {
    paddingHorizontal: 16,
    gap: 6,
  },
  pill: {
    borderWidth: 2,
    borderColor: '#000',
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#FFF',
  },
  pillActive: {
    backgroundColor: '#0A1128',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0A1128',
  },
  pillTextActive: {
    color: '#FFF',
  },
  statusPill: {
    borderWidth: 1,
    borderColor: '#CCC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#FFF',
  },
  statusPillActive: {
    borderColor: '#000',
    backgroundColor: '#D4AF37',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#666',
  },
  statusPillTextActive: {
    color: '#000',
  },

  // Sort bar
  sortBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#DDD',
    backgroundColor: '#F8F9FA',
  },
  countText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 1,
  },
  sortBtns: {
    flexDirection: 'row',
    gap: 4,
  },
  sortBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#DDD',
    backgroundColor: '#FFF',
  },
  sortBtnActive: {
    borderColor: '#000',
    backgroundColor: '#0A1128',
  },
  sortBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#666',
  },
  sortBtnTextActive: {
    color: '#FFF',
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
    borderWidth: 1,
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
    color: '#FFF',
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
    color: '#888',
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
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
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
    borderWidth: 2,
    borderColor: '#CCC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFF',
  },
  posSelectChipSelected: {
    borderColor: '#000',
    backgroundColor: '#E6F4EA',
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
    color: '#137333',
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
    borderWidth: 1,
    borderColor: '#CCC',
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: '#FFF',
  },
  statusOptionActive: {
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#D4AF37',
  },
  statusOptionText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#555',
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
    borderWidth: 1,
    borderColor: '#CCC',
    paddingVertical: 6,
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  durasiBtnActive: {
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#0A1128',
  },
  durasiBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#666',
  },
  durasiBtnTextActive: {
    color: '#FFF',
  },
  historyEmpty: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    paddingVertical: 6,
  },
  historyList: {
    borderWidth: 1,
    borderColor: '#DDD',
    backgroundColor: '#FAFAFA',
    padding: 8,
    marginTop: 4,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  historyOvr: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0A1128',
  },
  historyDate: {
    fontSize: 11,
    color: '#888',
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
    fontSize: 13,
    fontWeight: '800',
    color: '#000',
    letterSpacing: 1,
  },
});
