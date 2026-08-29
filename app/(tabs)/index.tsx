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
import { useRouter } from 'expo-router';
import { useProfile } from '@/src/contexts/ProfileContext';
import {
  getDashboardData,
  updateBufferMultiplier,
  type DashboardData,
} from '@/src/services/dashboardService';
import { checkExpiredStatusPlayers } from '@/src/services/notificationService';
import { ComparisonChart } from '@/src/components/ComparisonChart';

export default function HomeScreen() {
  const router = useRouter();
  const { activeProfile, loading: profileLoading } = useProfile();

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  // Buffer Multiplier Modal
  const [showBufferModal, setShowBufferModal] = useState(false);
  const [bufferValue, setBufferValue] = useState<number>(1.5);

  const loadData = useCallback(async () => {
    if (!activeProfile) return;
    setLoading(true);
    try {
      // Check for any expired injury statuses
      await checkExpiredStatusPlayers(activeProfile.id);

      const data = await getDashboardData(activeProfile.id);
      setDashboardData(data);
      setBufferValue(data.bufferMultiplier);
    } catch (e) {
      console.error('[HomeScreen] loadData error:', e);
    } finally {
      setLoading(false);
    }
  }, [activeProfile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSaveBuffer(val: number) {
    if (!activeProfile) return;
    try {
      await updateBufferMultiplier(activeProfile.id, val);
      setBufferValue(val);
      setShowBufferModal(false);
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Gagal memperbarui buffer multiplier');
    }
  }

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

          {/* Quick Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{d?.totalPlayers ?? 0}</Text>
              <Text style={styles.statLabel}>TOTAL</Text>
            </View>
            <View style={[styles.statBox, { borderColor: '#137333' }]}>
              <Text style={[styles.statNum, { color: '#137333' }]}>{d?.activeCount ?? 0}</Text>
              <Text style={styles.statLabel}>AKTIF</Text>
            </View>
            <View style={[styles.statBox, { borderColor: '#B06000' }]}>
              <Text style={[styles.statNum, { color: '#B06000' }]}>{d?.loanCount ?? 0}</Text>
              <Text style={styles.statLabel}>PINJAMAN</Text>
            </View>
            <View style={[styles.statBox, { borderColor: '#C5221F' }]}>
              <Text style={[styles.statNum, { color: '#C5221F' }]}>{d?.injuredCount ?? 0}</Text>
              <Text style={styles.statLabel}>CEDERA</Text>
            </View>
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
              onPress={() => router.push('/(tabs)/squads')}
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

        {/* ─── Position Quota Alert (On-The-Fly) ───── */}
        <View style={styles.quotaCard}>
          <View style={styles.quotaHeader}>
            <View>
              <Text style={styles.quotaTitle}>MONITOR KUOTA POSISI</Text>
              <Text style={styles.quotaSubtitle}>
                Dihitung real-time dari formasi aktif × Buffer ({bufferValue}x)
              </Text>
            </View>
            <TouchableOpacity
              style={styles.bufferBtn}
              onPress={() => setShowBufferModal(true)}>
              <Text style={styles.bufferBtnText}>⚙️ {bufferValue}x</Text>
            </TouchableOpacity>
          </View>

          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.colHeader, { flex: 1.2 }]}>POSISI</Text>
            <Text style={[styles.colHeader, { flex: 1, textAlign: 'center' }]}>IDEAL</Text>
            <Text style={[styles.colHeader, { flex: 1, textAlign: 'center' }]}>AKTIF</Text>
            <Text style={[styles.colHeader, { flex: 1.4, textAlign: 'right' }]}>STATUS</Text>
          </View>

          {/* Table Rows */}
          {d?.positionQuotas.length === 0 ? (
            <Text style={styles.emptyTableText}>Belum ada posisi terdaftar</Text>
          ) : (
            d?.positionQuotas.map((q) => {
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
                  <View style={[styles.statusTagWrapper, { flex: 1.4, alignItems: 'flex-end' }]}>
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

        {/* ─── Watchlist Summary ───────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>TRANSFER WATCHLIST</Text>
          <TouchableOpacity onPress={() => router.push('/watchlist' as any)}>
            <Text style={styles.seeAllText}>Kelola Watchlist ➔</Text>
          </TouchableOpacity>
        </View>

        {d?.topWatchlist.length === 0 ? (
          <View style={styles.emptyWatchCard}>
            <Text style={styles.emptyWatchText}>Belum ada target transfer</Text>
            <TouchableOpacity
              style={styles.addWatchBtn}
              onPress={() => router.push('/watchlist' as any)}>
              <Text style={styles.addWatchBtnText}>+ TAMBAH TARGET</Text>
            </TouchableOpacity>
          </View>
        ) : (
          d?.topWatchlist.map((w) => (
            <TouchableOpacity
              key={w.id}
              style={styles.watchItem}
              onPress={() => router.push('/watchlist' as any)}
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
                      ? `≥ ${w.target_ovr_min}`
                      : 'Bebas'}
                  {w.terkait_player_nama ? ` (Ganti ${w.terkait_player_nama})` : ''}
                </Text>
                {w.catatan && (
                  <Text style={styles.watchNote} numberOfLines={1}>
                    {w.catatan}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* ─── BUFFER MULTIPLIER MODAL ─────────────── */}
      <Modal visible={showBufferModal} transparent animationType="fade" onRequestClose={() => setShowBufferModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowBufferModal(false)}>
          <View style={styles.bufferModalCard}>
            <Text style={styles.bufferModalTitle}>PENGATURAN BUFFER KUOTA</Text>
            <Text style={styles.bufferModalDesc}>
              Buffer multiplier menentukan seberapa banyak pemain cadangan ideal yang dibutuhkan per slot formasi. Default: 1.5x.
            </Text>

            <View style={styles.bufferOptionsRow}>
              {[1.0, 1.25, 1.5, 1.75, 2.0].map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[
                    styles.bufferOptionChip,
                    bufferValue === val && styles.bufferOptionChipActive,
                  ]}
                  onPress={() => handleSaveBuffer(val)}>
                  <Text
                    style={[
                      styles.bufferOptionText,
                      bufferValue === val && styles.bufferOptionTextActive,
                    ]}>
                    {val}x
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.bufferModalClose}
              onPress={() => setShowBufferModal(false)}>
              <Text style={styles.bufferModalCloseText}>TUTUP</Text>
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
    padding: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 20,
  },
  actionBtn: {
    backgroundColor: '#0A1128',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: '#000',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 1,
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 130,
  },

  // Hero Card
  heroCard: {
    borderWidth: 3,
    borderColor: '#000',
    backgroundColor: '#FAFAFA',
    padding: 14,
    marginBottom: 14,
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
    borderBottomWidth: 2,
    borderBottomColor: '#000',
    paddingBottom: 10,
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 1,
  },
  heroSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D4AF37',
    letterSpacing: 2,
    marginTop: 2,
  },
  saveBadge: {
    backgroundColor: '#D4AF37',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1.5,
    borderColor: '#000',
  },
  saveBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#000',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  statBox: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#000',
    backgroundColor: '#FFF',
    paddingVertical: 8,
    alignItems: 'center',
  },
  statNum: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0A1128',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#888',
    letterSpacing: 0.5,
    marginTop: 2,
  },

  // Shortcuts
  shortcutsRow: {
    marginBottom: 16,
  },
  shortcutBtnPrimary: {
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
  },
  shortcutBtnTextPrimary: {
    fontSize: 14,
    fontWeight: '900',
    color: '#D4AF37',
    letterSpacing: 1.5,
  },

  // Section Headers
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 1,
  },
  seeAllText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1A73E8',
  },

  // Squads Overview Grid
  squadsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  squadCard: {
    width: '48.5%',
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#FAFAFA',
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  squadCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  squadCardTier: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0A1128',
  },
  squadOvrBadge: {
    backgroundColor: '#0A1128',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  squadOvrText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#D4AF37',
  },
  squadCardName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#444',
  },
  squadCardForm: {
    fontSize: 10,
    color: '#888',
    marginTop: 2,
  },

  // Position Quota Alert Card
  quotaCard: {
    borderWidth: 3,
    borderColor: '#000',
    backgroundColor: '#FAFAFA',
    padding: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  quotaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#000',
    paddingBottom: 8,
    marginBottom: 10,
  },
  quotaTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 1,
  },
  quotaSubtitle: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  bufferBtn: {
    borderWidth: 1.5,
    borderColor: '#000',
    backgroundColor: '#D4AF37',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  bufferBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000',
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1.5,
    borderBottomColor: '#000',
    paddingBottom: 6,
    marginBottom: 6,
  },
  colHeader: {
    fontSize: 10,
    fontWeight: '900',
    color: '#888',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  posTag: {
    backgroundColor: '#0A1128',
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  posTagText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFF',
  },
  tableCell: {
    fontSize: 12,
    fontWeight: '700',
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
    fontSize: 9,
    fontWeight: '800',
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
    fontSize: 9,
    fontWeight: '800',
    color: '#137333',
  },
  surplusBadge: {
    backgroundColor: '#E8F0FE',
    borderWidth: 1,
    borderColor: '#1A73E8',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  surplusText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1A73E8',
  },
  emptyTableText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    paddingVertical: 12,
  },

  // Watchlist Items
  emptyWatchCard: {
    borderWidth: 1.5,
    borderColor: '#DDD',
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    marginBottom: 16,
  },
  emptyWatchText: {
    fontSize: 12,
    color: '#888',
    marginBottom: 8,
  },
  addWatchBtn: {
    backgroundColor: '#0A1128',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addWatchBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFF',
  },
  watchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#FAFAFA',
    marginBottom: 8,
    padding: 8,
  },
  watchPosBox: {
    width: 40,
    height: 40,
    backgroundColor: '#0A1128',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  watchPosText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#D4AF37',
  },
  watchInfo: {
    flex: 1,
  },
  watchOvr: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0A1128',
  },
  watchNote: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
    fontStyle: 'italic',
  },

  // Buffer Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  bufferModalCard: {
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
  bufferModalTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 1,
    marginBottom: 8,
  },
  bufferModalDesc: {
    fontSize: 12,
    color: '#666',
    marginBottom: 16,
    lineHeight: 16,
  },
  bufferOptionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  bufferOptionChip: {
    borderWidth: 1.5,
    borderColor: '#000',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#F0F0F0',
  },
  bufferOptionChipActive: {
    backgroundColor: '#D4AF37',
  },
  bufferOptionText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0A1128',
  },
  bufferOptionTextActive: {
    color: '#000',
  },
  bufferModalClose: {
    alignSelf: 'center',
    padding: 6,
  },
  bufferModalCloseText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#666',
  },
});
