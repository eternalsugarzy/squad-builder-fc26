import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useProfile } from '@/src/contexts/ProfileContext';
import {
  getDashboardData,
  calculatePositionQuotas,
  type DashboardData,
} from '@/src/services/dashboardService';
import { listFormations, type FormationWithSlots } from '@/src/services/formationService';
import { checkExpiredStatusPlayers } from '@/src/services/notificationService';
import { ComparisonChart } from '@/src/components/ComparisonChart';
import type { PositionQuota } from '@/src/types';

export default function HomeScreen() {
  const router = useRouter();
  const { activeProfile, loading: profileLoading } = useProfile();

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [formations, setFormations] = useState<FormationWithSlots[]>([]);
  const [loading, setLoading] = useState(true);

  // Simulation Mode State for Position Quota Monitor
  const [selectedSimFormationId, setSelectedSimFormationId] = useState<string | null>(null);
  const [simulatedQuotas, setSimulatedQuotas] = useState<PositionQuota[]>([]);
  const [showSimPickerModal, setShowSimPickerModal] = useState(false);
  const [simCatFilter, setSimCatFilter] = useState<'All' | '4-Back' | '3-Back' | '5-Back'>('All');

  const loadData = useCallback(async (showSpinner = false) => {
    if (!activeProfile) return;
    if (showSpinner) setLoading(true);
    try {
      // Check for any expired injury statuses
      await checkExpiredStatusPlayers(activeProfile.id);

      const [data, fList] = await Promise.all([
        getDashboardData(activeProfile.id),
        listFormations(activeProfile.id),
      ]);
      setDashboardData(data);
      setFormations(fList);
    } catch (e) {
      console.error('[HomeScreen] loadData error:', e);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [activeProfile]);

  // Live Auto-Refresh on Tab Focus
  useFocusEffect(
    useCallback(() => {
      loadData(dashboardData === null);
    }, [loadData, dashboardData])
  );

  // Recompute simulated quotas when simulation formation changes
  useEffect(() => {
    async function updateQuotas() {
      if (!activeProfile) return;
      if (selectedSimFormationId) {
        const sim = await calculatePositionQuotas(activeProfile.id, selectedSimFormationId, 3);
        setSimulatedQuotas(sim);
      }
    }
    updateQuotas();
  }, [selectedSimFormationId, activeProfile]);

  // ─── Guard: No Active Profile ───────────────────
  if (profileLoading || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0A1128" />
        <Text style={styles.loadingText}>Memuat Dashboard...</Text>
      </View>
    );
  }

  if (!activeProfile) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🏆</Text>
        <Text style={styles.emptyTitle}>FC 26 CAREER MANAGER</Text>
        <Text style={styles.emptyHint}>
          Belum ada profil aktif. Buat atau aktifkan profil untuk memulai.
        </Text>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => router.push('/(tabs)/profile')}>
          <Text style={styles.actionBtnText}>BUKA PROFIL</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const d = dashboardData;
  const activeQuotas = selectedSimFormationId ? simulatedQuotas : (d?.positionQuotas ?? []);
  const selectedFormationObj = formations.find((f) => f.id === selectedSimFormationId);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ─── Hero Header ─────────────────────────── */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroTitle}>CAREER MODE MANAGER</Text>
              <Text style={styles.heroSubtitle}>FC 26 TACTICAL HUB</Text>
            </View>
            <View style={styles.saveBadge}>
              <Text style={styles.saveBadgeText}>{activeProfile.nama_save.toUpperCase()}</Text>
            </View>
          </View>

          {/* Quick Stats Grid (Clickable to Filter Players) */}
          <View style={styles.statsGrid}>
            <TouchableOpacity
              style={styles.statBox}
              onPress={() => router.push({ pathname: '/(tabs)/players', params: { status: 'ALL' } })}
              activeOpacity={0.7}>
              <Text style={styles.statNum}>{d?.totalPlayers ?? 0}</Text>
              <Text style={styles.statLabel}>TOTAL ➔</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statBox, { borderColor: '#137333' }]}
              onPress={() => router.push({ pathname: '/(tabs)/players', params: { status: 'aktif' } })}
              activeOpacity={0.7}>
              <Text style={[styles.statNum, { color: '#137333' }]}>{d?.activeCount ?? 0}</Text>
              <Text style={styles.statLabel}>AKTIF ➔</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statBox, { borderColor: '#B06000' }]}
              onPress={() => router.push({ pathname: '/(tabs)/players', params: { status: 'loan_out' } })}
              activeOpacity={0.7}>
              <Text style={[styles.statNum, { color: '#B06000' }]}>{d?.loanCount ?? 0}</Text>
              <Text style={styles.statLabel}>PINJAMAN ➔</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statBox, { borderColor: '#C5221F' }]}
              onPress={() => router.push({ pathname: '/(tabs)/players', params: { status: 'injured' } })}
              activeOpacity={0.7}>
              <Text style={[styles.statNum, { color: '#C5221F' }]}>{d?.injuredCount ?? 0}</Text>
              <Text style={styles.statLabel}>CEDERA ➔</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── Quick Shortcuts Bar ─────────────────── */}
        <View style={styles.shortcutsRow}>
          <TouchableOpacity
            style={styles.shortcutBtnPrimary}
            onPress={() => router.push('/(tabs)/squads')}>
            <Text style={styles.shortcutBtnTextPrimary}>⚡ AUTO-GENERATE TEAM SHEET</Text>
          </TouchableOpacity>
        </View>

        {/* ─── Squads OVR Overview (Tim 1 - 4) ──────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>RINGKASAN TIM (1 – 4)</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/squads')}>
            <Text style={styles.seeAllText}>Buka Squad ➔</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.squadsGrid}>
          {d?.squads.map((sq) => (
            <TouchableOpacity
              key={sq.id}
              style={styles.squadCard}
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/squads',
                  params: { squadId: sq.id, tier: String(sq.tier_order) },
                })
              }
              activeOpacity={0.8}>
              <View style={styles.squadCardTop}>
                <Text style={styles.squadCardTier}>TIM {sq.tier_order}</Text>
                <View style={styles.squadOvrBadge}>
                  <Text style={styles.squadOvrText}>
                    {sq.avg_ovr ? `${sq.avg_ovr}` : '-'}
                  </Text>
                </View>
              </View>
              <Text style={styles.squadCardName} numberOfLines={1}>
                {sq.nama_tim}
              </Text>
              <Text style={styles.squadCardForm} numberOfLines={1}>
                {sq.formation_nama || 'Formasi: -'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ─── Team OVR Bar Chart ──────────────────── */}
        {d?.squads && d.squads.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <ComparisonChart squads={d.squads} />
          </View>
        )}

        {/* ─── Position Quota Monitor (Dual Mode: Sesuai Squad vs Simulasi) ─ */}
        <View style={styles.quotaCard}>
          <View style={styles.quotaHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.quotaTitle}>MONITOR KEBUTUHAN POSISI</Text>
              <Text style={styles.quotaSubtitle}>
                {selectedSimFormationId
                  ? `Simulasi kebutuhan 3 tim inti mandiri dengan formasi ${selectedFormationObj?.nama_formasi}`
                  : 'Dihitung dari 3 Tim Inti Mandiri (Tim 1–3). Tim 4 adalah tim hybrid gabungan.'}
              </Text>
            </View>
          </View>

          {/* Mode Switcher Dropdown Button */}
          <TouchableOpacity
            style={styles.modeDropdownBtn}
            onPress={() => setShowSimPickerModal(true)}
            activeOpacity={0.8}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modeDropdownLabel}>SUMBER TINJAUAN KUOTA:</Text>
              <Text style={styles.modeDropdownValue} numberOfLines={1}>
                {selectedSimFormationId
                  ? `🔍 Simulasi: ${selectedFormationObj?.nama_formasi ?? 'Formasi'} (3 Tim Inti)`
                  : '⚡ Sesuai Formasi 3 Tim Inti (Tim 1–3)'}
              </Text>
            </View>
            <View style={styles.modeDropdownArrowBox}>
              <Text style={styles.modeDropdownArrow}>▾ GANTI</Text>
            </View>
          </TouchableOpacity>

          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.colHeader, { flex: 1.2 }]}>POSISI</Text>
            <Text style={[styles.colHeader, { flex: 1, textAlign: 'center' }]}>BUTUH</Text>
            <Text style={[styles.colHeader, { flex: 1, textAlign: 'center' }]}>MILIK</Text>
            <Text style={[styles.colHeader, { flex: 1.5, textAlign: 'right' }]}>STATUS</Text>
          </View>

          {/* Table Rows */}
          {activeQuotas.length === 0 ? (
            <Text style={styles.emptyTableText}>Belum ada posisi terdaftar</Text>
          ) : (
            activeQuotas.map((q) => {
              const isDeficit = q.selisih < 0;
              const isSurplus = q.selisih > 0;
              const isBalanced = q.selisih === 0;

              return (
                <View key={q.position_id} style={styles.tableRow}>
                  <View style={[styles.posTag, { flex: 1.2 }]}>
                    <Text style={styles.posTagText}>{q.position_nama}</Text>
                  </View>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'center' }]}>
                    {q.kuota_ideal}
                  </Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'center', fontWeight: '900' }]}>
                    {q.jumlah_aktif}
                  </Text>
                  <View style={[styles.statusTagWrapper, { flex: 1.5, alignItems: 'flex-end' }]}>
                    {isDeficit && (
                      <View style={styles.deficitBadge}>
                        <Text style={styles.deficitText}>Kurang {Math.abs(q.selisih)} ⚠️</Text>
                      </View>
                    )}
                    {isBalanced && (
                      <View style={styles.balancedBadge}>
                        <Text style={styles.balancedText}>Pas (Ideal) ✓</Text>
                      </View>
                    )}
                    {isSurplus && (
                      <View style={styles.surplusBadge}>
                        <Text style={styles.surplusText}>Lebih +{q.selisih}</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* ─── Transfer & Loan Activity Overview Card ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>STATUS TRANSFER & PINJAMAN</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/profile' as any)}>
            <Text style={styles.seeAllText}>Kelola Lengkap ➔</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tlSummaryCard}>
          {/* Top Row Stats (4 Categories) */}
          <View style={styles.tlSummaryStatsRow}>
            <View style={[styles.tlStatPill, { borderColor: '#C5221F' }]}>
              <Text style={[styles.tlStatPillNum, { color: '#C5221F' }]}>
                {d?.akanDijualCount ?? 0}
              </Text>
              <Text style={styles.tlStatPillLabel}>JUAL</Text>
            </View>

            <View style={[styles.tlStatPill, { borderColor: '#B06000' }]}>
              <Text style={[styles.tlStatPillNum, { color: '#B06000' }]}>
                {d?.loanCount ?? 0}
              </Text>
              <Text style={styles.tlStatPillLabel}>LOAN OUT</Text>
            </View>

            <View style={[styles.tlStatPill, { borderColor: '#137333' }]}>
              <Text style={[styles.tlStatPillNum, { color: '#137333' }]}>
                {d?.loanInCount ?? 0}
              </Text>
              <Text style={styles.tlStatPillLabel}>LOAN IN</Text>
            </View>

            <View style={[styles.tlStatPill, { borderColor: '#5F6368' }]}>
              <Text style={[styles.tlStatPillNum, { color: '#5F6368' }]}>
                {d?.soldCount ?? 0}
              </Text>
              <Text style={styles.tlStatPillLabel}>TERJUAL</Text>
            </View>
          </View>

          {/* Players Preview List */}
          {(d?.akanDijualCount ?? 0) === 0 &&
          (d?.loanCount ?? 0) === 0 &&
          (d?.loanInCount ?? 0) === 0 &&
          (d?.soldCount ?? 0) === 0 ? (
            <View style={styles.tlCleanBox}>
              <Text style={styles.tlCleanText}>
                ✅ Skuad Bersih - Tidak ada pemain dalam daftar rencana jual, pinjaman, atau terjual.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 8, marginTop: 10 }}>
              {/* Rencana Jual Previews */}
              {(d?.akanDijualList?.length ?? 0) > 0 && (
                <View style={styles.tlGroupSection}>
                  <Text style={[styles.tlGroupTitle, { color: '#C5221F' }]}>
                    🔴 RENCANA JUAL ({d?.akanDijualList.length})
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tlChipScroll}>
                    {d?.akanDijualList.map((p) => (
                      <View key={p.id} style={[styles.tlPlayerChip, { borderColor: '#C5221F' }]}>
                        <View style={[styles.tlPlayerChipOvr, { backgroundColor: '#C5221F' }]}>
                          <Text style={styles.tlPlayerChipOvrText}>{p.ovr_current}</Text>
                        </View>
                        <View>
                          <Text style={styles.tlPlayerChipName} numberOfLines={1}>{p.nama}</Text>
                          <Text style={styles.tlPlayerChipPos}>{p.positions[0]?.nama ?? '-'}</Text>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Loan Out Previews */}
              {(d?.loanOutList?.length ?? 0) > 0 && (
                <View style={styles.tlGroupSection}>
                  <Text style={[styles.tlGroupTitle, { color: '#B06000' }]}>
                    🟡 DIPINJAMKAN KELUAR ({d?.loanOutList.length})
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tlChipScroll}>
                    {d?.loanOutList.map((p) => (
                      <View key={p.id} style={[styles.tlPlayerChip, { borderColor: '#B06000' }]}>
                        <View style={[styles.tlPlayerChipOvr, { backgroundColor: '#B06000' }]}>
                          <Text style={styles.tlPlayerChipOvrText}>{p.ovr_current}</Text>
                        </View>
                        <View>
                          <Text style={styles.tlPlayerChipName} numberOfLines={1}>{p.nama}</Text>
                          <Text style={styles.tlPlayerChipPos}>
                            {p.positions[0]?.nama ?? '-'} • {p.status_durasi === '6_bulan' ? '6Bln' : p.status_durasi === '2_tahun' ? '2Thn' : '1Thn'}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Loan In Previews */}
              {(d?.loanInList?.length ?? 0) > 0 && (
                <View style={styles.tlGroupSection}>
                  <Text style={[styles.tlGroupTitle, { color: '#137333' }]}>
                    🟢 PINJAMAN MASUK ({d?.loanInList.length})
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tlChipScroll}>
                    {d?.loanInList.map((p) => (
                      <View key={p.id} style={[styles.tlPlayerChip, { borderColor: '#137333' }]}>
                        <View style={[styles.tlPlayerChipOvr, { backgroundColor: '#137333' }]}>
                          <Text style={styles.tlPlayerChipOvrText}>{p.ovr_current}</Text>
                        </View>
                        <View>
                          <Text style={styles.tlPlayerChipName} numberOfLines={1}>{p.nama}</Text>
                          <Text style={styles.tlPlayerChipPos}>
                            {p.positions[0]?.nama ?? '-'} • {p.status_durasi === '6_bulan' ? '6Bln' : p.status_durasi === '2_tahun' ? '2Thn' : '1Thn'}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Pemain Terjual Previews */}
              {(d?.soldList?.length ?? 0) > 0 && (
                <View style={styles.tlGroupSection}>
                  <Text style={[styles.tlGroupTitle, { color: '#5F6368' }]}>
                    🏷️ PEMAIN TERJUAL / DILEPAS ({d?.soldList.length})
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tlChipScroll}>
                    {d?.soldList.map((p) => (
                      <View key={p.id} style={[styles.tlPlayerChip, { borderColor: '#5F6368' }]}>
                        <View style={[styles.tlPlayerChipOvr, { backgroundColor: '#5F6368' }]}>
                          <Text style={styles.tlPlayerChipOvrText}>{p.ovr_current}</Text>
                        </View>
                        <View>
                          <Text style={styles.tlPlayerChipName} numberOfLines={1}>{p.nama}</Text>
                          <Text style={styles.tlPlayerChipPos}>{p.positions[0]?.nama ?? '-'} • Terjual</Text>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          )}

          {/* Action Button */}
          <TouchableOpacity
            style={styles.tlManageActionBtn}
            onPress={() => router.push('/(tabs)/profile' as any)}
            activeOpacity={0.8}>
            <Text style={styles.tlManageActionBtnText}>BUKA TRANSFER & LOAN LIST ➔</Text>
          </TouchableOpacity>
        </View>

        {/* ─── Watchlist Summary ───────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>TRANSFER WATCHLIST</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/profile' as any)}>
            <Text style={styles.seeAllText}>Kelola di Menu Lainnya ➔</Text>
          </TouchableOpacity>
        </View>

        {d?.topWatchlist.length === 0 ? (
          <View style={styles.emptyWatchCard}>
            <Text style={styles.emptyWatchText}>Belum ada target transfer</Text>
            <TouchableOpacity
              style={styles.addWatchBtn}
              onPress={() => router.push('/(tabs)/profile' as any)}>
              <Text style={styles.addWatchBtnText}>+ TAMBAH TARGET</Text>
            </TouchableOpacity>
          </View>
        ) : (
          d?.topWatchlist.map((w) => (
            <TouchableOpacity
              key={w.id}
              style={styles.watchItem}
              onPress={() => router.push('/(tabs)/profile' as any)}
              activeOpacity={0.8}>
              <View style={styles.watchPosBox}>
                <Text style={styles.watchPosText}>{w.position_nama}</Text>
              </View>
              <View style={styles.watchInfo}>
                <Text style={styles.watchOvr}>
                  Target:{' '}
                  {w.target_ovr_min && w.target_ovr_max
                    ? `${w.target_ovr_min}–${w.target_ovr_max}`
                    : w.target_ovr_min
                    ? `Min ${w.target_ovr_min}`
                    : 'Bebas'}
                </Text>
                {w.terkait_player_nama && (
                  <Text style={styles.watchTerkait} numberOfLines={1}>
                    Gantikan: {w.terkait_player_nama} ({w.terkait_player_ovr ?? '-'})
                  </Text>
                )}
                {w.catatan && (
                  <Text style={styles.watchNote} numberOfLines={1}>
                    "{w.catatan}"
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ─── SIMULATION FORMATION PICKER MODAL ──────── */}
      <Modal
        visible={showSimPickerModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSimPickerModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowSimPickerModal(false)}>
          <View style={styles.simModalCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.simModalTitle}>PILIH SUMBER TINJAUAN KUOTA</Text>

            {/* Default Option: Actual Squad Formations */}
            <TouchableOpacity
              style={[
                styles.simChoiceItem,
                selectedSimFormationId === null && styles.simChoiceItemActive,
              ]}
              onPress={() => {
                setSelectedSimFormationId(null);
                setShowSimPickerModal(false);
              }}>
              <View>
                <Text
                  style={[
                    styles.simChoiceTitle,
                    selectedSimFormationId === null && styles.simChoiceTitleActive,
                  ]}>
                  ⚡ Sesuai Formasi Tim Inti (Tim 1–3) (Default)
                </Text>
                <Text style={styles.simChoiceSub}>
                  Menghitung kebutuhan slot dari formasi nyata Tim 1–3 (Tim 4 adalah tim gabungan hybrid).
                </Text>
              </View>
            </TouchableOpacity>

            <Text style={styles.simSectionHeader}>ATAU SIMULASI FORMASI TERTENTU (3 TIM INTI):</Text>

            {/* Category Filter */}
            <View style={styles.simCatFilterRow}>
              {(['All', '4-Back', '3-Back', '5-Back'] as const).map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.simCatChip, simCatFilter === cat && styles.simCatChipActive]}
                  onPress={() => setSimCatFilter(cat)}>
                  <Text style={[styles.simCatText, simCatFilter === cat && styles.simCatTextActive]}>
                    {cat === 'All' ? 'SEMUA' : cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {formations
                .filter((f) => {
                  if (simCatFilter === 'All') return true;
                  if (simCatFilter === '4-Back') return f.nama_formasi.startsWith('4');
                  if (simCatFilter === '3-Back') return f.nama_formasi.startsWith('3');
                  if (simCatFilter === '5-Back') return f.nama_formasi.startsWith('5');
                  return true;
                })
                .map((f) => {
                  const isSelected = selectedSimFormationId === f.id;
                  const slotsSummary = f.slots.map((s) => s.slot_label).join(' • ');

                  return (
                    <TouchableOpacity
                      key={f.id}
                      style={[styles.simChoiceItem, isSelected && styles.simChoiceItemActive]}
                      onPress={() => {
                        setSelectedSimFormationId(f.id);
                        setShowSimPickerModal(false);
                      }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={[styles.simChoiceTitle, isSelected && styles.simChoiceTitleActive]}>
                          {f.nama_formasi}
                        </Text>
                        {isSelected && (
                          <View style={styles.activeTag}>
                            <Text style={styles.activeTagText}>AKTIF</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.simChoiceSub} numberOfLines={1}>
                        {slotsSummary}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>

            <TouchableOpacity
              style={styles.simCloseBtn}
              onPress={() => setShowSimPickerModal(false)}>
              <Text style={styles.simCloseText}>TUTUP</Text>
            </TouchableOpacity>
          </View>
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#FFFFFF',
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 2,
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  actionBtn: {
    backgroundColor: '#0A1128',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
  },

  // Hero Card
  heroCard: {
    backgroundColor: '#0A1128',
    borderWidth: 3,
    borderColor: '#000000',
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  heroSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D4AF37',
    letterSpacing: 2,
    marginTop: 2,
  },
  saveBadge: {
    backgroundColor: '#D4AF37',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1.5,
    borderColor: '#000',
  },
  saveBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 1,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    paddingVertical: 10,
    alignItems: 'center',
  },
  statNum: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0A1128',
  },
  statLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#666',
    marginTop: 2,
    letterSpacing: 0.5,
  },

  // Shortcuts Row
  shortcutsRow: {
    marginBottom: 16,
  },
  shortcutBtnPrimary: {
    backgroundColor: '#D4AF37',
    borderWidth: 2,
    borderColor: '#000',
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  shortcutBtnTextPrimary: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1.5,
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 1,
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0A1128',
  },

  // Squads Grid
  squadsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  squadCard: {
    width: '48%',
    backgroundColor: '#FAFAFA',
    borderWidth: 2,
    borderColor: '#000',
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  squadCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  squadCardTier: {
    fontSize: 11,
    fontWeight: '900',
    color: '#666',
    letterSpacing: 1,
  },
  squadOvrBadge: {
    backgroundColor: '#0A1128',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  squadOvrText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#D4AF37',
  },
  squadCardName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0A1128',
    marginBottom: 2,
  },
  squadCardForm: {
    fontSize: 11,
    color: '#666',
  },

  // Quota Card
  quotaCard: {
    backgroundColor: '#FAFAFA',
    borderWidth: 2,
    borderColor: '#000',
    padding: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  quotaHeader: {
    marginBottom: 10,
  },
  quotaTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 1,
  },
  quotaSubtitle: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
    lineHeight: 15,
  },
  modeDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0F4FF',
    borderWidth: 1.5,
    borderColor: '#0A1128',
    padding: 10,
    marginBottom: 12,
  },
  modeDropdownLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 0.5,
  },
  modeDropdownValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0A1128',
    marginTop: 1,
  },
  modeDropdownArrowBox: {
    backgroundColor: '#0A1128',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  modeDropdownArrow: {
    fontSize: 10,
    fontWeight: '900',
    color: '#D4AF37',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0A1128',
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  colHeader: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  posTag: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#000',
    alignSelf: 'flex-start',
  },
  posTagText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0A1128',
  },
  tableCell: {
    fontSize: 13,
    color: '#0A1128',
  },
  statusTagWrapper: {},
  deficitBadge: {
    backgroundColor: '#FCE8E6',
    borderWidth: 1,
    borderColor: '#C5221F',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  deficitText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#C5221F',
  },
  balancedBadge: {
    backgroundColor: '#E6F4EA',
    borderWidth: 1,
    borderColor: '#137333',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  balancedText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#137333',
  },
  surplusBadge: {
    backgroundColor: '#F0F4FF',
    borderWidth: 1,
    borderColor: '#0A1128',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  surplusText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0A1128',
  },
  emptyTableText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    paddingVertical: 12,
  },

  // Watchlist Items
  emptyWatchCard: {
    backgroundColor: '#FAFAFA',
    borderWidth: 2,
    borderColor: '#000',
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyWatchText: {
    fontSize: 13,
    color: '#888',
    marginBottom: 8,
  },
  addWatchBtn: {
    backgroundColor: '#0A1128',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addWatchBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#D4AF37',
    letterSpacing: 1,
  },
  watchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderWidth: 2,
    borderColor: '#000',
    padding: 10,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  watchPosBox: {
    width: 38,
    height: 38,
    backgroundColor: '#0A1128',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#000',
  },
  watchPosText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#D4AF37',
  },
  watchInfo: {
    flex: 1,
  },
  watchOvr: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0A1128',
  },
  watchTerkait: {
    fontSize: 11,
    color: '#B06000',
    fontWeight: '700',
    marginTop: 1,
  },
  watchNote: {
    fontSize: 11,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 1,
  },

  // Transfer & Loan Activity Card Styles
  tlSummaryCard: {
    backgroundColor: '#FAFAFA',
    borderWidth: 2.5,
    borderColor: '#000',
    padding: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  tlSummaryStatsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tlStatPill: {
    flex: 1,
    backgroundColor: '#FFF',
    borderWidth: 2,
    paddingVertical: 8,
    alignItems: 'center',
  },
  tlStatPillNum: {
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 18,
  },
  tlStatPillLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#0A1128',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  tlCleanBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#137333',
    padding: 10,
    marginTop: 10,
  },
  tlCleanText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#137333',
    textAlign: 'center',
  },
  tlGroupSection: {
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: '#DDD',
    padding: 8,
  },
  tlGroupTitle: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  tlChipScroll: {
    gap: 6,
    paddingRight: 10,
  },
  tlPlayerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderWidth: 1.5,
    paddingVertical: 4,
    paddingHorizontal: 6,
    gap: 6,
  },
  tlPlayerChipOvr: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#000',
  },
  tlPlayerChipOvrText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFF',
  },
  tlPlayerChipName: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0A1128',
    maxWidth: 100,
  },
  tlPlayerChipPos: {
    fontSize: 9,
    fontWeight: '700',
    color: '#666',
  },
  tlManageActionBtn: {
    marginTop: 12,
    backgroundColor: '#0A1128',
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#000',
  },
  tlManageActionBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#D4AF37',
    letterSpacing: 0.5,
  },

  // Simulation Picker Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  simModalCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#000',
    width: '90%',
    maxWidth: 420,
    maxHeight: '80%',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  simModalTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 1,
    marginBottom: 12,
  },
  simChoiceItem: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1.5,
    borderColor: '#000',
    padding: 12,
    marginBottom: 8,
  },
  simChoiceItemActive: {
    backgroundColor: '#F0F4FF',
    borderColor: '#0A1128',
    borderWidth: 2.5,
  },
  simChoiceTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0A1128',
  },
  simChoiceTitleActive: {
    color: '#0A1128',
  },
  simChoiceSub: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
    lineHeight: 14,
  },
  simSectionHeader: {
    fontSize: 10,
    fontWeight: '900',
    color: '#888',
    letterSpacing: 1,
    marginTop: 8,
    marginBottom: 6,
  },
  simCatFilterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  simCatChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F0F0F0',
    borderWidth: 1.5,
    borderColor: '#000',
  },
  simCatChipActive: {
    backgroundColor: '#0A1128',
  },
  simCatText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0A1128',
  },
  simCatTextActive: {
    color: '#D4AF37',
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
  simCloseBtn: {
    alignSelf: 'center',
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 24,
    backgroundColor: '#0A1128',
    borderWidth: 2,
    borderColor: '#000',
  },
  simCloseText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },
});
