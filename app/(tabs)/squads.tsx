import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
  FlatList,
} from 'react-native';
import { useProfile } from '@/src/contexts/ProfileContext';
import {
  listSquadsWithDetails,
  setSquadFormation,
  setSquadPlaystyle,
  assignPlayerToSlot,
  setCaptain,
  swapPlayers,
  addPlayerToBench,
  removePlayerFromBench,
  type SquadFull,
} from '@/src/services/squadService';
import { listFormations, type FormationWithSlots } from '@/src/services/formationService';
import { listPlaystyles } from '@/src/services/playstyleService';
import { listPlayers } from '@/src/services/playerService';
import {
  validatePlayerPool,
  autoGenerateTeamSheets,
  type PoolValidationWarning,
} from '@/src/services/autoGenerateService';
import { PitchCanvas, type PitchSlotItem } from '@/src/components/PitchCanvas';
import { PlayerPickerModal } from '@/src/components/PlayerPickerModal';
import type {
  PlayerWithPositions,
  Formation,
  Playstyle,
  SquadSlotFull,
} from '@/src/types';

interface SwapTarget {
  type: 'starter' | 'bench';
  id: string; // squad_slot id or squad_bench id
  playerId: string | null;
  playerName: string;
}

export default function SquadsScreen() {
  const { activeProfile } = useProfile();

  const [squads, setSquads] = useState<SquadFull[]>([]);
  const [activeTier, setActiveTier] = useState<number>(1);
  const [formations, setFormations] = useState<FormationWithSlots[]>([]);
  const [playstyles, setPlaystyles] = useState<Playstyle[]>([]);
  const [allPlayers, setAllPlayers] = useState<PlayerWithPositions[]>([]);
  const [loading, setLoading] = useState(true);

  // Auto-Generate State
  const [showAutoGenerateModal, setShowAutoGenerateModal] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [validationWarnings, setValidationWarnings] = useState<PoolValidationWarning[]>([]);

  // Swap State
  const [swapSource, setSwapSource] = useState<SwapTarget | null>(null);

  // Slot Action / Picker Modal State
  const [selectedSlot, setSelectedSlot] = useState<SquadSlotFull | null>(null);
  const [showSlotActionModal, setShowSlotActionModal] = useState(false);
  const [showPlayerPicker, setShowPlayerPicker] = useState(false);
  const [isPickingForBench, setIsPickingForBench] = useState(false);

  // Dropdown Modals
  const [showFormationPicker, setShowFormationPicker] = useState(false);
  const [showPlaystylePicker, setShowPlaystylePicker] = useState(false);

  const loadData = useCallback(async () => {
    if (!activeProfile) return;
    setLoading(true);
    try {
      const [sqList, fList, psList, pList] = await Promise.all([
        listSquadsWithDetails(activeProfile.id),
        listFormations(activeProfile.id),
        listPlaystyles(activeProfile.id),
        listPlayers(activeProfile.id),
      ]);
      setSquads(sqList);
      setFormations(fList);
      setPlaystyles(psList);
      setAllPlayers(pList);
    } catch (e) {
      console.error('[SquadsScreen] loadData error:', e);
    } finally {
      setLoading(false);
    }
  }, [activeProfile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Current Active Squad
  const currentSquad = useMemo(() => {
    return squads.find((s) => s.tier_order === activeTier) ?? squads[0] ?? null;
  }, [squads, activeTier]);

  // Assigned player IDs in this squad (starter + bench)
  const assignedPlayerIds = useMemo(() => {
    const ids = new Set<string>();
    if (!currentSquad) return ids;
    for (const s of currentSquad.starters) {
      if (s.player_id) ids.add(s.player_id);
    }
    for (const b of currentSquad.bench) {
      ids.add(b.id);
    }
    return ids;
  }, [currentSquad]);

  // ─── Auto-Generate Team Sheet ─────────────────
  async function handleOpenAutoGenerate() {
    if (!activeProfile) return;
    setIsValidating(true);
    setShowAutoGenerateModal(true);
    try {
      const res = await validatePlayerPool(activeProfile.id);
      setValidationWarnings(res.warnings);
    } catch (e) {
      console.error(e);
    } finally {
      setIsValidating(false);
    }
  }

  async function handleExecuteAutoGenerate() {
    if (!activeProfile) return;
    setIsGenerating(true);
    try {
      const res = await autoGenerateTeamSheets(activeProfile.id);
      if (res.success) {
        Alert.alert('Sukses 🎉', res.message);
        setShowAutoGenerateModal(false);
        await loadData();
        setActiveTier(1);
      } else {
        Alert.alert('Gagal', res.message);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Gagal generate team sheet');
    } finally {
      setIsGenerating(false);
    }
  }

  // ─── Formation & Playstyle Changes ─────────────
  async function handleSelectFormation(formationId: string) {
    if (!currentSquad) return;
    try {
      await setSquadFormation(currentSquad.id, formationId);
      setShowFormationPicker(false);
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Gagal mengganti formasi squad');
    }
  }

  async function handleSelectPlaystyle(playstyleId: string | null) {
    if (!currentSquad) return;
    try {
      await setSquadPlaystyle(currentSquad.id, playstyleId);
      setShowPlaystylePicker(false);
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Gagal mengganti playstyle squad');
    }
  }

  // ─── Slot Tap Handling ─────────────────────────
  function handleSlotPress(slotItem: PitchSlotItem) {
    if (!currentSquad) return;
    const starter = currentSquad.starters.find((s) => s.id === slotItem.id);
    if (!starter) return;

    if (swapSource) {
      // Execute Swap
      const target: SwapTarget = {
        type: 'starter',
        id: starter.id,
        playerId: starter.player_id,
        playerName: starter.player_nama ?? 'Slot Kosong',
      };
      executeSwap(swapSource, target);
      setSwapSource(null);
    } else {
      setSelectedSlot(starter);
      setShowSlotActionModal(true);
    }
  }

  // ─── Swap Logic ────────────────────────────────
  function startSwap(target: SwapTarget) {
    setShowSlotActionModal(false);
    setSwapSource(target);
  }

  async function executeSwap(from: SwapTarget, to: SwapTarget) {
    if (!currentSquad) return;
    try {
      await swapPlayers(currentSquad.id, from, to);
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Gagal melakukan swap pemain');
    }
  }

  // ─── Bench Actions ─────────────────────────────
  function handleBenchPress(benchItem: any) {
    if (swapSource) {
      const target: SwapTarget = {
        type: 'bench',
        id: benchItem.bench_id,
        playerId: benchItem.id,
        playerName: benchItem.nama,
      };
      executeSwap(swapSource, target);
      setSwapSource(null);
    } else {
      startSwap({
        type: 'bench',
        id: benchItem.bench_id,
        playerId: benchItem.id,
        playerName: benchItem.nama,
      });
    }
  }

  async function handleRemoveBench(benchId: string) {
    try {
      await removePlayerFromBench(benchId);
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Gagal menghapus pemain dari cadangan');
    }
  }

  function handleOpenBenchPicker() {
    if (!currentSquad) return;
    if (currentSquad.bench.length >= 9) {
      Alert.alert('Info', 'Cadangan sudah maksimal 9 pemain');
      return;
    }
    setIsPickingForBench(true);
    setShowPlayerPicker(true);
  }

  // ─── Assign Player to Starter or Bench ─────────
  async function handlePlayerSelected(player: PlayerWithPositions | null) {
    if (!currentSquad) return;

    if (isPickingForBench) {
      if (player) {
        try {
          await addPlayerToBench(currentSquad.id, player.id);
          loadData();
        } catch (e: any) {
          Alert.alert('Error', e.message ?? 'Gagal menambah ke cadangan');
        }
      }
      setIsPickingForBench(false);
    } else if (selectedSlot) {
      try {
        await assignPlayerToSlot(selectedSlot.id, player ? player.id : null);
        setSelectedSlot(null);
        loadData();
      } catch (e) {
        Alert.alert('Error', 'Gagal menetapkan pemain ke slot');
      }
    }
  }

  // ─── Set Captain ───────────────────────────────
  async function handleToggleCaptain() {
    if (!currentSquad || !selectedSlot) return;
    try {
      await setCaptain(currentSquad.id, selectedSlot.id);
      setShowSlotActionModal(false);
      setSelectedSlot(null);
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Gagal mengatur kapten');
    }
  }

  // ─── Pitch Slots Data Prep ─────────────────────
  const pitchSlots: PitchSlotItem[] = useMemo(() => {
    if (!currentSquad) return [];
    return currentSquad.starters.map((s) => ({
      id: s.id,
      label: s.slot_label,
      positionName: s.position_nama,
      coord_x: s.coord_x,
      coord_y: s.coord_y,
      playerName: s.player_nama,
      playerOvr: s.player_ovr,
      isCaptain: s.is_captain === 1,
    }));
  }, [currentSquad]);

  // ─── Guard: No Active Profile ───────────────────
  if (!activeProfile) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🛡️</Text>
        <Text style={styles.emptyTitle}>Belum Ada Profil Aktif</Text>
        <Text style={styles.emptyHint}>Pilih atau buat profil di tab Profil</Text>
      </View>
    );
  }

  if (loading || !currentSquad) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0A1128" />
        <Text style={styles.loadingText}>Memuat Tim & Squad...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ─── Top Auto-Generate Action Bar ─────────── */}
      <View style={styles.autoGenBanner}>
        <TouchableOpacity
          style={styles.autoGenBannerBtn}
          onPress={handleOpenAutoGenerate}
          activeOpacity={0.8}>
          <Text style={styles.autoGenBannerBtnText}>⚡ AUTO-GENERATE TEAM SHEET</Text>
        </TouchableOpacity>
      </View>

      {/* ─── Top Squad Tier Tabs (Tim 1 - 4) ──────── */}
      <View style={styles.tierTabBar}>
        {[1, 2, 3, 4].map((tier) => {
          const sq = squads.find((s) => s.tier_order === tier);
          const isActive = activeTier === tier;

          return (
            <TouchableOpacity
              key={tier}
              style={[styles.tierTab, isActive && styles.tierTabActive]}
              onPress={() => {
                setActiveTier(tier);
                setSwapSource(null);
              }}>
              <Text style={[styles.tierTabText, isActive && styles.tierTabTextActive]}>
                TIM {tier}
              </Text>
              <Text style={[styles.tierOvrText, isActive && styles.tierOvrTextActive]}>
                {sq?.avg_ovr ? `AVG ${sq.avg_ovr}` : '-'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ─── Active Swap Banner ───────────────────── */}
      {swapSource && (
        <View style={styles.swapBanner}>
          <Text style={styles.swapBannerText} numberOfLines={1}>
            🔄 Swap: <Text style={{ fontWeight: '900' }}>{swapSource.playerName}</Text> → Tap slot/bench lain
          </Text>
          <TouchableOpacity
            style={styles.swapCancelBtn}
            onPress={() => setSwapSource(null)}>
            <Text style={styles.swapCancelText}>BATAL</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ─── Squad Config Header Bar ────────────── */}
        <View style={styles.configCard}>
          {/* Formation Picker Button */}
          <TouchableOpacity
            style={styles.configBtn}
            onPress={() => setShowFormationPicker(true)}>
            <Text style={styles.configLabel}>FORMASI</Text>
            <Text style={styles.configValue} numberOfLines={1}>
              {currentSquad.formation_nama || 'PILIH FORMASI ▾'}
            </Text>
          </TouchableOpacity>

          {/* Playstyle Picker Button */}
          <TouchableOpacity
            style={styles.configBtn}
            onPress={() => setShowPlaystylePicker(true)}>
            <Text style={styles.configLabel}>PLAYSTYLE</Text>
            <Text style={styles.configValue} numberOfLines={1}>
              {currentSquad.playstyle_nama || 'PILIH PLAYSTYLE ▾'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ─── Pitch View / Starting XI ───────────── */}
        {currentSquad.starters.length === 0 ? (
          <View style={styles.noFormationCard}>
            <Text style={styles.noFormationIcon}>⚠️</Text>
            <Text style={styles.noFormationTitle}>Formasi Belum Dipilih</Text>
            <Text style={styles.noFormationHint}>
              Pilih formasi di atas untuk menampilkan starting XI di lapangan
            </Text>
          </View>
        ) : (
          <View style={styles.pitchSection}>
            <PitchCanvas
              slots={pitchSlots}
              selectedSlotId={swapSource?.id ?? null}
              onSelectSlot={handleSlotPress}
              interactive
            />
          </View>
        )}

        {/* ─── Bench Section (Cadangan, Maks 9) ────── */}
        <View style={styles.benchSection}>
          <View style={styles.benchHeader}>
            <View style={styles.benchHeaderLeft}>
              <Text style={styles.benchTitle}>CADANGAN</Text>
              <View style={styles.benchCountBadge}>
                <Text style={styles.benchCountText}>{currentSquad.bench.length}/9</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[
                styles.addBenchBtn,
                currentSquad.bench.length >= 9 && { opacity: 0.5 },
              ]}
              onPress={handleOpenBenchPicker}
              disabled={currentSquad.bench.length >= 9}>
              <Text style={styles.addBenchBtnText}>+ PEMAIN</Text>
            </TouchableOpacity>
          </View>

          {currentSquad.bench.length === 0 ? (
            <View style={styles.emptyBench}>
              <Text style={styles.emptyBenchText}>Belum ada pemain di bangku cadangan</Text>
            </View>
          ) : (
            <View style={styles.benchGrid}>
              {currentSquad.bench.map((b) => {
                const isSwapSelected = swapSource?.id === b.bench_id;
                const primaryPos = b.positions[0]?.nama ?? '-';

                return (
                  <TouchableOpacity
                    key={b.bench_id}
                    style={[styles.benchCard, isSwapSelected && styles.benchCardActive]}
                    onPress={() => handleBenchPress(b)}
                    activeOpacity={0.7}>
                    {/* OVR + Pos */}
                    <View style={styles.benchOvrBox}>
                      <Text style={styles.benchOvr}>{b.ovr_current}</Text>
                      <Text style={styles.benchPos}>{primaryPos}</Text>
                    </View>

                    {/* Name */}
                    <View style={styles.benchInfo}>
                      <Text style={styles.benchName} numberOfLines={1}>
                        {b.nama}
                      </Text>
                    </View>

                    {/* Actions */}
                    <TouchableOpacity
                      style={styles.benchRemoveBtn}
                      onPress={() => handleRemoveBench(b.bench_id)}>
                      <Text style={styles.benchRemoveText}>✕</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ─── SLOT ACTION MODAL (When tapping a slot) ─ */}
      <Modal visible={showSlotActionModal} transparent animationType="fade" onRequestClose={() => setShowSlotActionModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowSlotActionModal(false)}>
          <View style={styles.actionModalCard}>
            <View style={styles.actionModalHeader}>
              <Text style={styles.actionModalTitle}>
                Slot: {selectedSlot?.slot_label} ({selectedSlot?.position_nama})
              </Text>
              <Text style={styles.actionModalPlayer}>
                {selectedSlot?.player_nama
                  ? `${selectedSlot.player_nama} (OVR ${selectedSlot.player_ovr})`
                  : 'Slot Kosong'}
              </Text>
            </View>

            <View style={styles.actionModalBtns}>
              <TouchableOpacity
                style={styles.actionItemBtn}
                onPress={() => {
                  setShowSlotActionModal(false);
                  setIsPickingForBench(false);
                  setShowPlayerPicker(true);
                }}>
                <Text style={styles.actionItemText}>👤 Ganti / Pilih Pemain</Text>
              </TouchableOpacity>

              {selectedSlot?.player_id && (
                <>
                  <TouchableOpacity
                    style={styles.actionItemBtn}
                    onPress={() =>
                      startSwap({
                        type: 'starter',
                        id: selectedSlot.id,
                        playerId: selectedSlot.player_id,
                        playerName: selectedSlot.player_nama ?? 'Starter',
                      })
                    }>
                    <Text style={styles.actionItemText}>🔄 Swap dengan Pemain Lain</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionItemBtn}
                    onPress={handleToggleCaptain}>
                    <Text style={styles.actionItemText}>
                      {selectedSlot.is_captain === 1 ? '★ Copot Kapten' : '★ Jadikan Kapten'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionItemBtn, { backgroundColor: '#FCE8E6' }]}
                    onPress={async () => {
                      await assignPlayerToSlot(selectedSlot.id, null);
                      setShowSlotActionModal(false);
                      loadData();
                    }}>
                    <Text style={[styles.actionItemText, { color: '#C5221F' }]}>
                      ⚪ Kosongkan Slot Ini
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            <TouchableOpacity
              style={styles.actionModalClose}
              onPress={() => setShowSlotActionModal(false)}>
              <Text style={styles.actionModalCloseText}>TUTUP</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ─── PLAYER PICKER MODAL ───────────────────── */}
      <PlayerPickerModal
        visible={showPlayerPicker}
        onClose={() => {
          setShowPlayerPicker(false);
          setIsPickingForBench(false);
        }}
        onSelectPlayer={handlePlayerSelected}
        players={allPlayers}
        targetPositionName={isPickingForBench ? undefined : selectedSlot?.position_nama}
        targetSlotLabel={isPickingForBench ? 'Cadangan' : selectedSlot?.slot_label}
        assignedPlayerIds={assignedPlayerIds}
        currentPlayerId={isPickingForBench ? null : selectedSlot?.player_id}
      />

      {/* ─── FORMATION PICKER MODAL ────────────────── */}
      <Modal visible={showFormationPicker} transparent animationType="slide" onRequestClose={() => setShowFormationPicker(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowFormationPicker(false)}>
          <View style={styles.pickerModalCard}>
            <Text style={styles.pickerModalTitle}>PILIH FORMASI</Text>
            {formations.length === 0 ? (
              <Text style={styles.pickerEmpty}>Belum ada formasi. Buat di tab Formasi.</Text>
            ) : (
              <FlatList
                data={formations}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.pickerItem,
                      currentSquad.formation_id === item.id && styles.pickerItemActive,
                    ]}
                    onPress={() => handleSelectFormation(item.id)}>
                    <Text
                      style={[
                        styles.pickerItemText,
                        currentSquad.formation_id === item.id && styles.pickerItemTextActive,
                      ]}>
                      {item.nama_formasi} ({item.slots.length} slots)
                    </Text>
                  </TouchableOpacity>
                )}
              />
            )}
            <TouchableOpacity
              style={styles.pickerCloseBtn}
              onPress={() => setShowFormationPicker(false)}>
              <Text style={styles.pickerCloseText}>BATAL</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ─── PLAYSTYLE PICKER MODAL ────────────────── */}
      <Modal visible={showPlaystylePicker} transparent animationType="slide" onRequestClose={() => setShowPlaystylePicker(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowPlaystylePicker(false)}>
          <View style={styles.pickerModalCard}>
            <Text style={styles.pickerModalTitle}>PILIH PLAYSTYLE</Text>
            <TouchableOpacity
              style={[
                styles.pickerItem,
                !currentSquad.playstyle_id && styles.pickerItemActive,
              ]}
              onPress={() => handleSelectPlaystyle(null)}>
              <Text
                style={[
                  styles.pickerItemText,
                  !currentSquad.playstyle_id && styles.pickerItemTextActive,
                ]}>
                Tanpa Playstyle
              </Text>
            </TouchableOpacity>
            <FlatList
              data={playstyles}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.pickerItem,
                    currentSquad.playstyle_id === item.id && styles.pickerItemActive,
                  ]}
                  onPress={() => handleSelectPlaystyle(item.id)}>
                  <Text
                    style={[
                      styles.pickerItemText,
                      currentSquad.playstyle_id === item.id && styles.pickerItemTextActive,
                    ]}>
                    {item.nama}
                  </Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={styles.pickerCloseBtn}
              onPress={() => setShowPlaystylePicker(false)}>
              <Text style={styles.pickerCloseText}>BATAL</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ─── AUTO-GENERATE MODAL ─────────────────── */}
      <Modal
        visible={showAutoGenerateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAutoGenerateModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowAutoGenerateModal(false)}>
          <View style={styles.autoGenCard} onStartShouldSetResponder={() => true}>
            <View style={styles.autoGenHeader}>
              <Text style={styles.autoGenTitle}>⚡ AUTO-GENERATE TEAM SHEET</Text>
              <Text style={styles.autoGenSubtitle}>
                Menyusun Tim 1, 2, 3 (100% unik) & Tim 4 (Hybrid) secara otomatis.
              </Text>
            </View>

            {isValidating ? (
              <View style={{ padding: 24, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#0A1128" />
                <Text style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                  Memvalidasi pool pemain...
                </Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 300, padding: 12 }}>
                {validationWarnings.length > 0 ? (
                  <View style={styles.warningBox}>
                    <Text style={styles.warningTitle}>⚠️ PERINGATAN KEKURANGAN PEMAIN:</Text>
                    {validationWarnings.map((w) => (
                      <Text key={w.positionId} style={styles.warningItem}>
                        • Posisi <Text style={{ fontWeight: '900' }}>{w.positionNama}</Text>: butuh{' '}
                        {w.requiredCount}, hanya ada {w.availableCount} aktif (kurang {w.deficit})
                      </Text>
                    ))}
                    <Text style={styles.warningNote}>
                      Slot yang kurang akan dikosongkan atau diisi pemain dari posisi lain.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.validBox}>
                    <Text style={styles.validText}>
                      ✅ Pool pemain aktif cukup untuk semua formasi Tim 1-4!
                    </Text>
                  </View>
                )}

                <View style={styles.ruleSummary}>
                  <Text style={styles.ruleTitle}>Aturan Penyusunan:</Text>
                  <Text style={styles.ruleItem}>1. Tim 1: Starter OVR tertinggi</Text>
                  <Text style={styles.ruleItem}>2. Tim 2: Starter OVR berikutnya</Text>
                  <Text style={styles.ruleItem}>3. Tim 3: Starter OVR berikutnya</Text>
                  <Text style={styles.ruleItem}>4. Tim 4: Hybrid (min 3 perwakilan T1, T2, T3)</Text>
                  <Text style={styles.ruleItem}>5. Cadangan: Maks 9 pemain (otomatis di-trim)</Text>
                </View>
              </ScrollView>
            )}

            <View style={styles.autoGenFooter}>
              <TouchableOpacity
                style={styles.autoGenCancelBtn}
                onPress={() => setShowAutoGenerateModal(false)}>
                <Text style={styles.autoGenCancelText}>BATAL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.autoGenConfirmBtn, isGenerating && { opacity: 0.6 }]}
                disabled={isGenerating}
                onPress={handleExecuteAutoGenerate}>
                <Text style={styles.autoGenConfirmText}>
                  {isGenerating ? 'MENYUSUN...' : 'GENERATE SEKARANG ⚡'}
                </Text>
              </TouchableOpacity>
            </View>
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

  // Tier Tab Bar
  tierTabBar: {
    flexDirection: 'row',
    borderBottomWidth: 3,
    borderBottomColor: '#000',
    backgroundColor: '#FAFAFA',
  },
  tierTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#DDD',
    backgroundColor: '#F0F0F0',
  },
  tierTabActive: {
    backgroundColor: '#0A1128',
  },
  tierTabText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#666',
    letterSpacing: 1,
  },
  tierTabTextActive: {
    color: '#FFFFFF',
  },
  tierOvrText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#888',
    marginTop: 2,
  },
  tierOvrTextActive: {
    color: '#D4AF37',
  },

  // Swap Banner
  swapBanner: {
    backgroundColor: '#FFFBE6',
    borderBottomWidth: 2,
    borderBottomColor: '#000',
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  swapBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#0A1128',
  },
  swapCancelBtn: {
    backgroundColor: '#0A1128',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#000',
  },
  swapCancelText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFF',
  },

  scrollContent: {
    paddingBottom: 40,
  },

  // Config Card
  configCard: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 2,
    borderBottomColor: '#000',
  },
  configBtn: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#FFF',
    padding: 8,
  },
  configLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#888',
    letterSpacing: 1,
  },
  configValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0A1128',
    marginTop: 2,
  },

  // Pitch Section
  pitchSection: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  noFormationCard: {
    margin: 20,
    padding: 30,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#FAFAFA',
    alignItems: 'center',
  },
  noFormationIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  noFormationTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0A1128',
    marginBottom: 4,
  },
  noFormationHint: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },

  // Bench Section
  benchSection: {
    marginTop: 12,
    marginHorizontal: 16,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#FAFAFA',
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  benchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  benchHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  benchTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 1,
  },
  benchCountBadge: {
    backgroundColor: '#0A1128',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  benchCountText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#D4AF37',
  },
  addBenchBtn: {
    backgroundColor: '#0A1128',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1.5,
    borderColor: '#000',
  },
  addBenchBtnText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 1,
  },
  emptyBench: {
    padding: 16,
    alignItems: 'center',
  },
  emptyBenchText: {
    fontSize: 12,
    color: '#888',
  },
  benchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  benchCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#000',
    backgroundColor: '#FFF',
    padding: 6,
  },
  benchCardActive: {
    backgroundColor: '#FFFBE6',
    borderColor: '#D4AF37',
    borderWidth: 2,
  },
  benchOvrBox: {
    width: 32,
    height: 32,
    backgroundColor: '#0A1128',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  benchOvr: {
    fontSize: 12,
    fontWeight: '900',
    color: '#D4AF37',
  },
  benchPos: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FFF',
  },
  benchInfo: {
    flex: 1,
  },
  benchName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0A1128',
  },
  benchRemoveBtn: {
    padding: 4,
  },
  benchRemoveText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#999',
  },

  // Modal Overlays
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  actionModalCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#000',
    width: '85%',
    maxWidth: 380,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  actionModalHeader: {
    borderBottomWidth: 2,
    borderBottomColor: '#000',
    paddingBottom: 10,
    marginBottom: 12,
  },
  actionModalTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#888',
    letterSpacing: 1,
  },
  actionModalPlayer: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0A1128',
    marginTop: 2,
  },
  actionModalBtns: {
    gap: 8,
    marginBottom: 12,
  },
  actionItemBtn: {
    borderWidth: 2,
    borderColor: '#000',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FAFAFA',
  },
  actionItemText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0A1128',
  },
  actionModalClose: {
    alignSelf: 'center',
    padding: 6,
  },
  actionModalCloseText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#666',
  },

  // Picker Modal
  pickerModalCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#000',
    width: '85%',
    maxWidth: 380,
    maxHeight: '70%',
    padding: 16,
  },
  pickerModalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 1,
    marginBottom: 12,
  },
  pickerEmpty: {
    fontSize: 13,
    color: '#888',
    paddingVertical: 12,
  },
  pickerItem: {
    borderWidth: 1.5,
    borderColor: '#000',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FAFAFA',
    marginBottom: 6,
  },
  pickerItemActive: {
    backgroundColor: '#0A1128',
  },
  pickerItemText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0A1128',
  },
  pickerItemTextActive: {
    color: '#D4AF37',
  },
  pickerCloseBtn: {
    alignSelf: 'center',
    marginTop: 10,
    padding: 6,
  },
  pickerCloseText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#666',
  },

  // Auto-Generate Banner & Modal
  autoGenBanner: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 2,
    borderBottomColor: '#000',
  },
  autoGenBannerBtn: {
    backgroundColor: '#D4AF37',
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  autoGenBannerBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1.5,
  },
  autoGenCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#000',
    width: '90%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  autoGenHeader: {
    padding: 14,
    borderBottomWidth: 2,
    borderBottomColor: '#000',
    backgroundColor: '#FAFAFA',
  },
  autoGenTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 1,
  },
  autoGenSubtitle: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  warningBox: {
    backgroundColor: '#FFFBE6',
    borderWidth: 1.5,
    borderColor: '#B06000',
    padding: 10,
    marginBottom: 10,
  },
  warningTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#B06000',
    marginBottom: 6,
  },
  warningItem: {
    fontSize: 11,
    color: '#333',
    marginBottom: 3,
  },
  warningNote: {
    fontSize: 10,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 4,
  },
  validBox: {
    backgroundColor: '#E6F4EA',
    borderWidth: 1.5,
    borderColor: '#137333',
    padding: 10,
    marginBottom: 10,
  },
  validText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#137333',
  },
  ruleSummary: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#DDD',
    padding: 10,
  },
  ruleTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0A1128',
    marginBottom: 4,
  },
  ruleItem: {
    fontSize: 10,
    color: '#555',
    marginBottom: 2,
  },
  autoGenFooter: {
    flexDirection: 'row',
    borderTopWidth: 2,
    borderTopColor: '#000',
    padding: 12,
    gap: 8,
    backgroundColor: '#FAFAFA',
  },
  autoGenCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#F0F0F0',
  },
  autoGenCancelText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#333',
  },
  autoGenConfirmBtn: {
    flex: 2,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#D4AF37',
  },
  autoGenConfirmText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1,
  },
});

