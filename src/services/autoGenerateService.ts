/**
 * FC26 Career Mode Manager - Auto-Generate Team Sheet Algorithm
 * Replicates and generalises the user's manual rules for Tim 1-4.
 */

import { getDatabase, generateId } from '@/src/database';
import { listPlayers } from './playerService';
import { listSquadsWithDetails, setSquadFormation } from './squadService';
import { getFormationById, type FormationWithSlots } from './formationService';
import type { PlayerWithPositions, FormationSlotWithPosition } from '@/src/types';

export interface PoolValidationWarning {
  positionId: string;
  positionNama: string;
  requiredCount: number; // across T1, T2, T3
  availableCount: number;
  deficit: number;
}

export interface PoolValidationResult {
  isValid: boolean;
  warnings: PoolValidationWarning[];
}

export interface AutoGenerateOptions {
  useExistingAsBaseline?: boolean;
}

export interface GenerateResult {
  success: boolean;
  message: string;
  warnings?: string[];
}

/**
 * Step 1: Validate active player pool against selected formations for all 4 squads.
 */
export async function validatePlayerPool(profileId: string): Promise<PoolValidationResult> {
  const squads = await listSquadsWithDetails(profileId);
  const allPlayers = await listPlayers(profileId);

  // Eligible pool: aktif, loan_in, or akan_dijual
  const activePlayers = allPlayers.filter(
    (p) => p.status === 'aktif' || p.status === 'akan_dijual' || p.status === 'loan_in'
  );

  // Count slots needed per position across T1, T2, T3 (unique starters required)
  const requiredCounts: Record<string, { nama: string; count: number }> = {};

  for (const squad of squads.filter((s) => s.tier_order <= 3)) {
    if (!squad.formation_id) continue;
    const formation = await getFormationById(squad.formation_id);
    if (!formation) continue;

    for (const slot of formation.slots) {
      if (!requiredCounts[slot.position_id]) {
        requiredCounts[slot.position_id] = {
          nama: slot.position_nama,
          count: 0,
        };
      }
      requiredCounts[slot.position_id].count += 1;
    }
  }

  const warnings: PoolValidationWarning[] = [];

  for (const [posId, data] of Object.entries(requiredCounts)) {
    // Count players who can play this position (primary or secondary)
    const available = activePlayers.filter((p) =>
      p.positions.some((pos) => pos.id === posId)
    ).length;

    if (available < data.count) {
      warnings.push({
        positionId: posId,
        positionNama: data.nama,
        requiredCount: data.count,
        availableCount: available,
        deficit: data.count - available,
      });
    }
  }

  return {
    isValid: warnings.length === 0,
    warnings,
  };
}

/**
 * Generalized Bench Trim Rule:
 * Finds 1-2 positions with the most slots in the formation,
 * and drops the lowest-OVR players from those positions until bench <= maxCount (9).
 */
function trimBenchPlayers(
  benchCandidates: PlayerWithPositions[],
  formationSlots: FormationSlotWithPosition[],
  maxCount = 9
): PlayerWithPositions[] {
  let trimmed = [...benchCandidates];

  if (trimmed.length <= maxCount) {
    return trimmed;
  }

  // Count positions in the formation to find most populated positions
  const posCountInFormation: Record<string, number> = {};
  for (const slot of formationSlots) {
    posCountInFormation[slot.position_id] = (posCountInFormation[slot.position_id] || 0) + 1;
  }

  // Sort positions by frequency in formation descending
  const sortedPosIds = Object.keys(posCountInFormation).sort(
    (a, b) => (posCountInFormation[b] || 0) - (posCountInFormation[a] || 0)
  );

  // Iteratively remove lowest OVR from highest-populated positions
  while (trimmed.length > maxCount) {
    let removed = false;

    for (const posId of sortedPosIds) {
      // Find candidate players who have this position (prefer secondary/primary)
      const matching = trimmed.filter((p) => p.positions.some((pos) => pos.id === posId));

      if (matching.length > 1) {
        // Find lowest OVR among matching
        matching.sort((a, b) => a.ovr_current - b.ovr_current);
        const toRemove = matching[0];

        trimmed = trimmed.filter((p) => p.id !== toRemove.id);
        removed = true;
        if (trimmed.length <= maxCount) break;
      }
    }

    // Fallback: if we couldn't remove from top positions, remove overall lowest OVR
    if (!removed && trimmed.length > maxCount) {
      trimmed.sort((a, b) => a.ovr_current - b.ovr_current);
      trimmed.shift();
    }
  }

  return trimmed;
}

/**
 * Core Algorithm: Auto-generate Team Sheets for Tim 1, 2, 3, and 4.
 */
export async function autoGenerateTeamSheets(
  profileId: string,
  options?: AutoGenerateOptions
): Promise<GenerateResult> {
  const db = await getDatabase();
  const squads = await listSquadsWithDetails(profileId);
  const allPlayers = await listPlayers(profileId);

  // Filter pool: aktif, loan_in, or akan_dijual
  const activePlayers = allPlayers.filter(
    (p) => p.status === 'aktif' || p.status === 'akan_dijual' || p.status === 'loan_in'
  );

  // Ensure all 4 squads have a formation assigned
  for (const sq of squads) {
    if (!sq.formation_id) {
      return {
        success: false,
        message: `${sq.nama_tim} belum memiliki formasi. Pilih formasi terlebih dahulu.`,
      };
    }
  }

  // Load formations
  const squadFormations: Record<number, FormationWithSlots> = {};
  for (const sq of squads) {
    const f = await getFormationById(sq.formation_id!);
    if (!f || f.slots.length === 0) {
      return {
        success: false,
        message: `Formasi untuk ${sq.nama_tim} tidak memiliki slot posisi.`,
      };
    }
    squadFormations[sq.tier_order] = f;
  }

  // Track assigned starters for T1, T2, T3 (must be 100% unique)
  const assignedT1_T3 = new Set<string>();

  // Helper to pick best player for a position from remaining pool
  function pickBestPlayer(
    slotPosId: string,
    availablePool: PlayerWithPositions[],
    excludedIds: Set<string>
  ): PlayerWithPositions | null {
    // 1. Primary position match first
    const primaryMatches = availablePool
      .filter(
        (p) =>
          !excludedIds.has(p.id) &&
          p.positions.length > 0 &&
          p.positions[0].id === slotPosId
      )
      .sort((a, b) => b.ovr_current - a.ovr_current);

    if (primaryMatches.length > 0) {
      return primaryMatches[0];
    }

    // 2. Secondary position match
    const secondaryMatches = availablePool
      .filter(
        (p) =>
          !excludedIds.has(p.id) &&
          p.positions.some((pos) => pos.id === slotPosId)
      )
      .sort((a, b) => b.ovr_current - a.ovr_current);

    if (secondaryMatches.length > 0) {
      return secondaryMatches[0];
    }

    // 3. Fallback: highest OVR available player
    const fallbackMatches = availablePool
      .filter((p) => !excludedIds.has(p.id))
      .sort((a, b) => b.ovr_current - a.ovr_current);

    return fallbackMatches[0] ?? null;
  }

  // ─── 1. TIM 1 STARTERS ──────────────────────────────
  const t1Starters: { slotId: string; player: PlayerWithPositions | null }[] = [];
  for (const slot of squadFormations[1].slots) {
    const player = pickBestPlayer(slot.position_id, activePlayers, assignedT1_T3);
    if (player) {
      assignedT1_T3.add(player.id);
    }
    t1Starters.push({ slotId: slot.id, player });
  }

  // ─── 2. TIM 2 STARTERS ──────────────────────────────
  const t2Starters: { slotId: string; player: PlayerWithPositions | null }[] = [];
  for (const slot of squadFormations[2].slots) {
    const player = pickBestPlayer(slot.position_id, activePlayers, assignedT1_T3);
    if (player) {
      assignedT1_T3.add(player.id);
    }
    t2Starters.push({ slotId: slot.id, player });
  }

  // ─── 3. TIM 3 STARTERS ──────────────────────────────
  const t3Starters: { slotId: string; player: PlayerWithPositions | null }[] = [];
  for (const slot of squadFormations[3].slots) {
    const player = pickBestPlayer(slot.position_id, activePlayers, assignedT1_T3);
    if (player) {
      assignedT1_T3.add(player.id);
    }
    t3Starters.push({ slotId: slot.id, player });
  }

  // ─── 4. TIM 4 STARTERS (HYBRID) ─────────────────────
  // Mandatory: at least 3 players from T1, at least 3 from T2, at least 3 from T3.
  const t1StarterPlayers = t1Starters.map((s) => s.player).filter(Boolean) as PlayerWithPositions[];
  const t2StarterPlayers = t2Starters.map((s) => s.player).filter(Boolean) as PlayerWithPositions[];
  const t3StarterPlayers = t3Starters.map((s) => s.player).filter(Boolean) as PlayerWithPositions[];

  const t4Starters: { slotId: string; player: PlayerWithPositions | null }[] = [];
  const assignedT4 = new Set<string>();

  // Sort each tier pool by OVR descending
  const sortedT1 = [...t1StarterPlayers].sort((a, b) => b.ovr_current - a.ovr_current);
  const sortedT2 = [...t2StarterPlayers].sort((a, b) => b.ovr_current - a.ovr_current);
  const sortedT3 = [...t3StarterPlayers].sort((a, b) => b.ovr_current - a.ovr_current);

  // Quotas for hybrid: pick top 3 from each
  const hybridReps: PlayerWithPositions[] = [];
  let countT1 = 0;
  let countT2 = 0;
  let countT3 = 0;

  // Function to fill hybrid squad
  for (const slot of squadFormations[4].slots) {
    let candidate: PlayerWithPositions | null = null;

    // Prioritize meeting T1 >= 3, T2 >= 3, T3 >= 3
    if (countT1 < 3) {
      candidate = pickBestPlayer(slot.position_id, sortedT1, assignedT4);
      if (candidate) countT1++;
    }
    if (!candidate && countT2 < 3) {
      candidate = pickBestPlayer(slot.position_id, sortedT2, assignedT4);
      if (candidate) countT2++;
    }
    if (!candidate && countT3 < 3) {
      candidate = pickBestPlayer(slot.position_id, sortedT3, assignedT4);
      if (candidate) countT3++;
    }

    // If quotas met or no match in quota tier, pick best from all active players
    if (!candidate) {
      candidate = pickBestPlayer(slot.position_id, activePlayers, assignedT4);
    }

    if (candidate) {
      assignedT4.add(candidate.id);
    }
    t4Starters.push({ slotId: slot.id, player: candidate });
  }

  // ─── 5. BENCH GENERATION (TRIMMED TO 9) ─────────────
  // Bench T1 = Starter XI T2, trimmed
  const bench1Candidates = t2Starters.map((s) => s.player).filter(Boolean) as PlayerWithPositions[];
  const benchT1 = trimBenchPlayers(bench1Candidates, squadFormations[1].slots, 9);

  // Bench T2 = Starter XI T3, trimmed
  const bench2Candidates = t3Starters.map((s) => s.player).filter(Boolean) as PlayerWithPositions[];
  const benchT2 = trimBenchPlayers(bench2Candidates, squadFormations[2].slots, 9);

  // Bench T3 = Starter XI T4 (avoid duplicate with XI T3), trimmed
  const t3StarterIds = new Set(t3Starters.map((s) => s.player?.id).filter(Boolean) as string[]);
  const bench3Candidates = t4Starters
    .map((s) => s.player)
    .filter((p): p is PlayerWithPositions => p !== null && p !== undefined)
    .filter((p) => !t3StarterIds.has(p.id));
  const benchT3 = trimBenchPlayers(bench3Candidates, squadFormations[3].slots, 9);

  // Bench T4 = Proportional mix of Bench T1 + T2 + T3 (avoid duplicate with XI T4), trimmed
  const t4StarterIds = new Set(t4Starters.map((s) => s.player?.id).filter(Boolean) as string[]);
  const combinedBenchPool: PlayerWithPositions[] = [];
  const seenBenchIds = new Set<string>();

  for (const b of [...benchT1, ...benchT2, ...benchT3]) {
    if (!t4StarterIds.has(b.id) && !seenBenchIds.has(b.id)) {
      seenBenchIds.add(b.id);
      combinedBenchPool.push(b);
    }
  }
  const benchT4 = trimBenchPlayers(combinedBenchPool, squadFormations[4].slots, 9);

  // ─── 6. SAVE TO DATABASE ────────────────────────────
  const squadTierMap = new Map(squads.map((s) => [s.tier_order, s.id]));

  const allSquadAssignments = [
    { tier: 1, starters: t1Starters, bench: benchT1 },
    { tier: 2, starters: t2Starters, bench: benchT2 },
    { tier: 3, starters: t3Starters, bench: benchT3 },
    { tier: 4, starters: t4Starters, bench: benchT4 },
  ];

  for (const item of allSquadAssignments) {
    const squadId = squadTierMap.get(item.tier);
    if (!squadId) continue;

    // Remove existing squad_slots & bench
    await db.runAsync('DELETE FROM squad_slots WHERE squad_id = ?', squadId);
    await db.runAsync('DELETE FROM squad_bench WHERE squad_id = ?', squadId);

    // Insert starters
    for (const st of item.starters) {
      const slotId = generateId();
      await db.runAsync(
        `INSERT INTO squad_slots (id, squad_id, formation_slot_id, player_id, is_captain)
         VALUES (?, ?, ?, ?, ?)`,
        slotId,
        squadId,
        st.slotId,
        st.player ? st.player.id : null,
        0
      );
    }

    // Insert bench
    for (let i = 0; i < item.bench.length; i++) {
      const benchId = generateId();
      await db.runAsync(
        `INSERT INTO squad_bench (id, squad_id, player_id, order_index)
         VALUES (?, ?, ?, ?)`,
        benchId,
        squadId,
        item.bench[i].id,
        i
      );
    }
  }

  return {
    success: true,
    message: 'Team Sheet Tim 1, 2, 3, dan 4 berhasil di-generate secara otomatis!',
  };
}
