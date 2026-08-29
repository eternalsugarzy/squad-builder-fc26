/**
 * FC26 Career Mode Manager - Player Service
 * Full CRUD, multi-position, OVR history, and bulk update.
 */

import { getDatabase, generateId } from '@/src/database';
import type {
  Player,
  PlayerWithPositions,
  PlayerStatus,
  StatusDurasi,
  OvrHistory,
  Position,
} from '@/src/types';

export interface CreatePlayerInput {
  profile_id: string;
  nama: string;
  ovr_current: number;
  status?: PlayerStatus;
  status_durasi?: StatusDurasi | null;
  status_mulai?: string | null;
  status_catatan?: string | null;
  position_ids: string[]; // ordered: index 0 is primary
}

export interface UpdatePlayerInput {
  nama: string;
  ovr_current: number;
  status: PlayerStatus;
  status_durasi?: StatusDurasi | null;
  status_mulai?: string | null;
  status_catatan?: string | null;
  position_ids: string[]; // ordered: index 0 is primary
}

/**
 * List all players for a profile with their positions.
 */
export async function listPlayers(profileId: string): Promise<PlayerWithPositions[]> {
  const db = await getDatabase();

  const players = await db.getAllAsync<Player>(
    'SELECT * FROM players WHERE profile_id = ? ORDER BY ovr_current DESC, nama ASC',
    profileId
  );

  if (players.length === 0) return [];

  // Fetch all positions for these players
  const playerPositions = await db.getAllAsync<{
    player_id: string;
    position_id: string;
    order_index: number;
    pos_nama: string;
    pos_sort_order: number;
  }>(
    `SELECT pp.player_id, pp.position_id, pp.order_index, p.nama as pos_nama, p.sort_order as pos_sort_order
     FROM player_positions pp
     JOIN positions p ON pp.position_id = p.id
     JOIN players pl ON pp.player_id = pl.id
     WHERE pl.profile_id = ?
     ORDER BY pp.order_index ASC`,
    profileId
  );

  const posMap = new Map<string, (Position & { order_index: number })[]>();
  for (const row of playerPositions) {
    if (!posMap.has(row.player_id)) {
      posMap.set(row.player_id, []);
    }
    posMap.get(row.player_id)!.push({
      id: row.position_id,
      profile_id: profileId,
      nama: row.pos_nama,
      sort_order: row.pos_sort_order,
      order_index: row.order_index,
    });
  }

  return players.map((pl) => ({
    ...pl,
    positions: posMap.get(pl.id) ?? [],
  }));
}

/**
 * Get a single player with positions and OVR history.
 */
export async function getPlayerById(playerId: string): Promise<PlayerWithPositions | null> {
  const db = await getDatabase();

  const player = await db.getFirstAsync<Player>(
    'SELECT * FROM players WHERE id = ?',
    playerId
  );

  if (!player) return null;

  const positions = await db.getAllAsync<Position & { order_index: number }>(
    `SELECT p.id, p.profile_id, p.nama, p.sort_order, pp.order_index
     FROM player_positions pp
     JOIN positions p ON pp.position_id = p.id
     WHERE pp.player_id = ?
     ORDER BY pp.order_index ASC`,
    playerId
  );

  return {
    ...player,
    positions,
  };
}

/**
 * Create a player with multi-position.
 */
export async function createPlayer(input: CreatePlayerInput): Promise<PlayerWithPositions> {
  const db = await getDatabase();
  const id = generateId();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO players (
      id, profile_id, nama, ovr_current, status,
      status_durasi, status_mulai, status_catatan, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.profile_id,
    input.nama.trim(),
    input.ovr_current,
    input.status ?? 'aktif',
    input.status_durasi ?? null,
    input.status_mulai ?? null,
    input.status_catatan ?? null,
    now,
    now
  );

  // Insert positions
  for (let i = 0; i < input.position_ids.length; i++) {
    const ppId = generateId();
    await db.runAsync(
      'INSERT INTO player_positions (id, player_id, position_id, order_index) VALUES (?, ?, ?, ?)',
      ppId,
      id,
      input.position_ids[i],
      i
    );
  }

  const created = await getPlayerById(id);
  if (!created) throw new Error('Failed to retrieve newly created player');
  return created;
}

/**
 * Update player details, positions, and record OVR history if OVR changed.
 */
export async function updatePlayer(id: string, input: UpdatePlayerInput): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  const current = await db.getFirstAsync<Player>('SELECT * FROM players WHERE id = ?', id);
  if (!current) throw new Error('Player not found');

  // Check if OVR changed
  if (current.ovr_current !== input.ovr_current) {
    const historyId = generateId();
    await db.runAsync(
      'INSERT INTO ovr_history (id, player_id, ovr_lama, ovr_baru, tanggal) VALUES (?, ?, ?, ?, ?)',
      historyId,
      id,
      current.ovr_current,
      input.ovr_current,
      now
    );
  }

  // If status changed to sudah_dijual, remove from all squad_slots & squad_bench
  if (input.status === 'sudah_dijual' && current.status !== 'sudah_dijual') {
    await db.runAsync('UPDATE squad_slots SET player_id = NULL WHERE player_id = ?', id);
    await db.runAsync('DELETE FROM squad_bench WHERE player_id = ?', id);
  }

  await db.runAsync(
    `UPDATE players SET
      nama = ?,
      ovr_current = ?,
      status = ?,
      status_durasi = ?,
      status_mulai = ?,
      status_catatan = ?,
      updated_at = ?
     WHERE id = ?`,
    input.nama.trim(),
    input.ovr_current,
    input.status,
    input.status_durasi ?? null,
    input.status_mulai ?? null,
    input.status_catatan ?? null,
    now,
    id
  );

  // Replace positions
  await db.runAsync('DELETE FROM player_positions WHERE player_id = ?', id);
  for (let i = 0; i < input.position_ids.length; i++) {
    const ppId = generateId();
    await db.runAsync(
      'INSERT INTO player_positions (id, player_id, position_id, order_index) VALUES (?, ?, ?, ?)',
      ppId,
      id,
      input.position_ids[i],
      i
    );
  }
}

/**
 * Quick change OVR (+1 or -1 or custom delta) with history recording.
 */
export async function quickChangeOvr(playerId: string, delta: number): Promise<number> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  const current = await db.getFirstAsync<Player>('SELECT * FROM players WHERE id = ?', playerId);
  if (!current) throw new Error('Player not found');

  const newOvr = Math.max(1, Math.min(99, current.ovr_current + delta));
  if (newOvr === current.ovr_current) return newOvr;

  const historyId = generateId();
  await db.runAsync(
    'INSERT INTO ovr_history (id, player_id, ovr_lama, ovr_baru, tanggal) VALUES (?, ?, ?, ?, ?)',
    historyId,
    playerId,
    current.ovr_current,
    newOvr,
    now
  );

  await db.runAsync(
    'UPDATE players SET ovr_current = ?, updated_at = ? WHERE id = ?',
    newOvr,
    now,
    playerId
  );

  return newOvr;
}

/**
 * Bulk update OVR for multiple players by a delta (+1, +2, -1, etc.).
 */
export async function bulkUpdateOvr(playerIds: string[], delta: number): Promise<void> {
  if (playerIds.length === 0 || delta === 0) return;
  for (const id of playerIds) {
    await quickChangeOvr(id, delta);
  }
}

/**
 * Delete a player.
 */
export async function deletePlayer(playerId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM players WHERE id = ?', playerId);
}

/**
 * Get OVR history for a player ordered by date DESC.
 */
export async function getOvrHistory(playerId: string): Promise<OvrHistory[]> {
  const db = await getDatabase();
  return db.getAllAsync<OvrHistory>(
    'SELECT * FROM ovr_history WHERE player_id = ? ORDER BY tanggal DESC',
    playerId
  );
}
