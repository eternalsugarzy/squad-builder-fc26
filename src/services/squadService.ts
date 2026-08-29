/**
 * FC26 Career Mode Manager - Squad Service
 * Manages Squads (Tim 1-4), Starter squad_slots, and squad_bench.
 */

import { getDatabase, generateId } from '@/src/database';
import type {
  Squad,
  SquadSlot,
  SquadBench,
  PlayerWithPositions,
  FormationSlotWithPosition,
  SquadSlotFull,
} from '@/src/types';

export interface SquadFull extends Squad {
  formation_nama?: string;
  playstyle_nama?: string;
  starters: SquadSlotFull[];
  bench: (PlayerWithPositions & { order_index: number; bench_id: string })[];
  avg_ovr: number;
}

/**
 * Ensure 4 squads exist for a profile (Tim 1, Tim 2, Tim 3, Tim 4).
 * If not exist, creates them.
 */
export async function ensureDefaultSquads(profileId: string): Promise<void> {
  const db = await getDatabase();

  const existing = await db.getAllAsync<Squad>(
    'SELECT * FROM squads WHERE profile_id = ? ORDER BY tier_order ASC',
    profileId
  );

  if (existing.length < 4) {
    const existingTiers = new Set(existing.map((s) => s.tier_order));
    const defaultNames = ['Tim 1 (Utama)', 'Tim 2 (Rotasi)', 'Tim 3 (Cadangan)', 'Tim 4 (Hybrid)'];

    for (let tier = 1; tier <= 4; tier++) {
      if (!existingTiers.has(tier)) {
        const id = generateId();
        await db.runAsync(
          'INSERT INTO squads (id, profile_id, nama_tim, tier_order) VALUES (?, ?, ?, ?)',
          id,
          profileId,
          defaultNames[tier - 1],
          tier
        );
      }
    }
  }
}

/**
 * Get all 4 squads for a profile with full starter slots and bench details.
 */
export async function listSquadsWithDetails(profileId: string): Promise<SquadFull[]> {
  const db = await getDatabase();
  await ensureDefaultSquads(profileId);

  const squads = await db.getAllAsync<
    Squad & { formation_nama: string | null; playstyle_nama: string | null }
  >(
    `SELECT s.*, f.nama_formasi as formation_nama, ps.nama as playstyle_nama
     FROM squads s
     LEFT JOIN formations f ON s.formation_id = f.id
     LEFT JOIN playstyles ps ON s.playstyle_id = ps.id
     WHERE s.profile_id = ?
     ORDER BY s.tier_order ASC`,
    profileId
  );

  const result: SquadFull[] = [];

  for (const squad of squads) {
    // Get starter slots
    const starters = await db.getAllAsync<SquadSlotFull>(
      `SELECT
        ss.id, ss.squad_id, ss.formation_slot_id, ss.player_id, ss.is_captain,
        fs.slot_label, fs.coord_x, fs.coord_y,
        p.nama as position_nama,
        pl.nama as player_nama, pl.ovr_current as player_ovr
       FROM squad_slots ss
       JOIN formation_slots fs ON ss.formation_slot_id = fs.id
       JOIN positions p ON fs.position_id = p.id
       LEFT JOIN players pl ON ss.player_id = pl.id
       WHERE ss.squad_id = ?
       ORDER BY fs.coord_y ASC, fs.coord_x ASC`,
      squad.id
    );

    // Get bench players
    const benchRows = await db.getAllAsync<{
      bench_id: string;
      order_index: number;
      player_id: string;
      nama: string;
      ovr_current: number;
      status: string;
    }>(
      `SELECT sb.id as bench_id, sb.order_index, sb.player_id,
              pl.nama, pl.ovr_current, pl.status
       FROM squad_bench sb
       JOIN players pl ON sb.player_id = pl.id
       WHERE sb.squad_id = ?
       ORDER BY sb.order_index ASC`,
      squad.id
    );

    // Fetch positions for bench players
    const benchWithPos: (PlayerWithPositions & { order_index: number; bench_id: string })[] = [];
    for (const b of benchRows) {
      const pos = await db.getAllAsync<any>(
        `SELECT p.*, pp.order_index
         FROM player_positions pp
         JOIN positions p ON pp.position_id = p.id
         WHERE pp.player_id = ?
         ORDER BY pp.order_index ASC`,
        b.player_id
      );

      benchWithPos.push({
        id: b.player_id,
        profile_id: profileId,
        nama: b.nama,
        ovr_current: b.ovr_current,
        status: b.status as any,
        status_durasi: null,
        status_mulai: null,
        status_catatan: null,
        created_at: '',
        updated_at: '',
        positions: pos,
        order_index: b.order_index,
        bench_id: b.bench_id,
      });
    }

    // Calculate avg OVR of starting XI
    const filledStarters = starters.filter((s) => s.player_ovr !== undefined && s.player_ovr !== null);
    const avgOvr =
      filledStarters.length > 0
        ? Math.round(
            filledStarters.reduce((acc, s) => acc + (s.player_ovr || 0), 0) / filledStarters.length
          )
        : 0;

    result.push({
      ...squad,
      formation_nama: squad.formation_nama ?? undefined,
      playstyle_nama: squad.playstyle_nama ?? undefined,
      starters,
      bench: benchWithPos,
      avg_ovr: avgOvr,
    });
  }

  return result;
}

/**
 * Set formation for a squad and synchronize squad_slots with formation_slots.
 */
export async function setSquadFormation(squadId: string, formationId: string): Promise<void> {
  const db = await getDatabase();

  await db.runAsync('UPDATE squads SET formation_id = ? WHERE id = ?', formationId, squadId);

  // Get formation slots for this formation
  const formationSlots = await db.getAllAsync<{ id: string; position_id: string }>(
    'SELECT id, position_id FROM formation_slots WHERE formation_id = ? ORDER BY coord_y ASC, coord_x ASC',
    formationId
  );

  // Get existing squad slots to preserve players where possible
  const existingSquadSlots = await db.getAllAsync<{
    player_id: string | null;
    is_captain: number;
    position_id: string;
  }>(
    `SELECT ss.player_id, ss.is_captain, fs.position_id
     FROM squad_slots ss
     JOIN formation_slots fs ON ss.formation_slot_id = fs.id
     WHERE ss.squad_id = ?`,
    squadId
  );

  // Remove old squad_slots
  await db.runAsync('DELETE FROM squad_slots WHERE squad_id = ?', squadId);

  // Recreate squad_slots matching new formation_slots
  const usedPlayers = new Set<string>();

  for (const fs of formationSlots) {
    const slotId = generateId();
    // Try to match a player who played in the same position
    const match = existingSquadSlots.find(
      (ess) =>
        ess.player_id &&
        ess.position_id === fs.position_id &&
        !usedPlayers.has(ess.player_id)
    );

    const playerId = match?.player_id ?? null;
    const isCaptain = match?.is_captain ?? 0;
    if (playerId) usedPlayers.add(playerId);

    await db.runAsync(
      `INSERT INTO squad_slots (id, squad_id, formation_slot_id, player_id, is_captain)
       VALUES (?, ?, ?, ?, ?)`,
      slotId,
      squadId,
      fs.id,
      playerId,
      isCaptain
    );
  }
}

/**
 * Set playstyle for a squad.
 */
export async function setSquadPlaystyle(squadId: string, playstyleId: string | null): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE squads SET playstyle_id = ? WHERE id = ?', playstyleId, squadId);
}

/**
 * Rename a squad.
 */
export async function renameSquad(squadId: string, namaTim: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE squads SET nama_tim = ? WHERE id = ?', namaTim.trim(), squadId);
}

/**
 * Assign a player to a specific starter slot.
 */
export async function assignPlayerToSlot(
  squadSlotId: string,
  playerId: string | null
): Promise<void> {
  const db = await getDatabase();

  if (playerId) {
    // If player is on bench in this squad, remove them from bench
    const slot = await db.getFirstAsync<{ squad_id: string }>(
      'SELECT squad_id FROM squad_slots WHERE id = ?',
      squadSlotId
    );
    if (slot) {
      await db.runAsync(
        'DELETE FROM squad_bench WHERE squad_id = ? AND player_id = ?',
        slot.squad_id,
        playerId
      );
    }
  }

  await db.runAsync('UPDATE squad_slots SET player_id = ? WHERE id = ?', playerId, squadSlotId);
}

/**
 * Set captain for a squad (only one captain per squad).
 */
export async function setCaptain(squadId: string, squadSlotId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE squad_slots SET is_captain = 0 WHERE squad_id = ?', squadId);
  await db.runAsync('UPDATE squad_slots SET is_captain = 1 WHERE id = ?', squadSlotId);
}

/**
 * Swap two players:
 * Can swap Starter <-> Starter, Starter <-> Bench, or Bench <-> Bench.
 */
export async function swapPlayers(
  squadId: string,
  from: { type: 'starter' | 'bench'; id: string; playerId: string | null },
  to: { type: 'starter' | 'bench'; id: string; playerId: string | null }
): Promise<void> {
  const db = await getDatabase();

  if (from.type === 'starter' && to.type === 'starter') {
    // Swap player_id between two squad_slots
    await db.runAsync('UPDATE squad_slots SET player_id = ? WHERE id = ?', to.playerId, from.id);
    await db.runAsync('UPDATE squad_slots SET player_id = ? WHERE id = ?', from.playerId, to.id);
  } else if (from.type === 'starter' && to.type === 'bench') {
    // from is squad_slot, to is squad_bench
    await db.runAsync('UPDATE squad_slots SET player_id = ? WHERE id = ?', to.playerId, from.id);
    if (from.playerId) {
      await db.runAsync('UPDATE squad_bench SET player_id = ? WHERE id = ?', from.playerId, to.id);
    } else {
      await db.runAsync('DELETE FROM squad_bench WHERE id = ?', to.id);
    }
  } else if (from.type === 'bench' && to.type === 'starter') {
    // from is squad_bench, to is squad_slot
    await db.runAsync('UPDATE squad_slots SET player_id = ? WHERE id = ?', from.playerId, to.id);
    if (to.playerId) {
      await db.runAsync('UPDATE squad_bench SET player_id = ? WHERE id = ?', to.playerId, from.id);
    } else {
      await db.runAsync('DELETE FROM squad_bench WHERE id = ?', from.id);
    }
  } else if (from.type === 'bench' && to.type === 'bench') {
    // Swap bench players
    await db.runAsync('UPDATE squad_bench SET player_id = ? WHERE id = ?', to.playerId, from.id);
    await db.runAsync('UPDATE squad_bench SET player_id = ? WHERE id = ?', from.playerId, to.id);
  }
}

/**
 * Add a player to the bench (max 9 players per bench).
 */
export async function addPlayerToBench(squadId: string, playerId: string): Promise<void> {
  const db = await getDatabase();

  const count = await db.getFirstAsync<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM squad_bench WHERE squad_id = ?',
    squadId
  );
  if ((count?.cnt ?? 0) >= 9) {
    throw new Error('Bench sudah penuh (maksimal 9 pemain)');
  }

  // Get next order_index
  const maxOrder = await db.getFirstAsync<{ max_order: number | null }>(
    'SELECT MAX(order_index) as max_order FROM squad_bench WHERE squad_id = ?',
    squadId
  );
  const nextOrder = (maxOrder?.max_order ?? -1) + 1;

  const id = generateId();
  await db.runAsync(
    'INSERT INTO squad_bench (id, squad_id, player_id, order_index) VALUES (?, ?, ?, ?)',
    id,
    squadId,
    playerId,
    nextOrder
  );
}

/**
 * Remove a player from the bench.
 */
export async function removePlayerFromBench(benchId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM squad_bench WHERE id = ?', benchId);
}

/**
 * Clear all starting XI slots and bench players for a squad to build manually from scratch.
 */
export async function clearEntireSquad(squadId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE squad_slots SET player_id = NULL, is_captain = 0 WHERE squad_id = ?', squadId);
  await db.runAsync('DELETE FROM squad_bench WHERE squad_id = ?', squadId);
}

/**
 * Create a new custom squad (Tim 5, Tim 6, Tim 7, etc. or custom named).
 */
export async function createCustomSquad(
  profileId: string,
  namaTim: string,
  formationId?: string | null,
  playstyleId?: string | null
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();

  // Find max tier_order
  const maxRow = await db.getFirstAsync<{ max_tier: number | null }>(
    'SELECT MAX(tier_order) as max_tier FROM squads WHERE profile_id = ?',
    profileId
  );
  const nextTier = (maxRow?.max_tier ?? 4) + 1;

  await db.runAsync(
    'INSERT INTO squads (id, profile_id, nama_tim, formation_id, playstyle_id, tier_order) VALUES (?, ?, ?, ?, ?, ?)',
    id,
    profileId,
    namaTim.trim(),
    formationId ?? null,
    playstyleId ?? null,
    nextTier
  );

  // If formation provided, initialize starter slots
  if (formationId) {
    await setSquadFormation(id, formationId);
  }

  return id;
}

/**
 * Delete a custom squad.
 */
export async function deleteSquad(squadId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM squad_slots WHERE squad_id = ?', squadId);
  await db.runAsync('DELETE FROM squad_bench WHERE squad_id = ?', squadId);
  await db.runAsync('DELETE FROM squads WHERE id = ?', squadId);
}


