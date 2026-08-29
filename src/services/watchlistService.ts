/**
 * FC26 Career Mode Manager - Transfer Watchlist Service
 * CRUD for transfer watchlist scoped to active profile.
 */

import { getDatabase, generateId } from '@/src/database';
import type { TransferWatchlist, Position, Player } from '@/src/types';

export interface WatchlistWithDetails extends TransferWatchlist {
  position_nama: string;
  terkait_player_nama?: string;
  terkait_player_ovr?: number;
  terkait_player_status?: string;
}

export interface CreateWatchlistInput {
  profile_id: string;
  position_id: string;
  target_ovr_min?: number | null;
  target_ovr_max?: number | null;
  catatan?: string | null;
  terkait_player_id?: string | null;
}

export interface UpdateWatchlistInput {
  position_id: string;
  target_ovr_min?: number | null;
  target_ovr_max?: number | null;
  catatan?: string | null;
  terkait_player_id?: string | null;
}

/**
 * List all watchlist entries for a profile with joined position & related player.
 */
export async function listWatchlist(profileId: string): Promise<WatchlistWithDetails[]> {
  const db = await getDatabase();

  return db.getAllAsync<WatchlistWithDetails>(
    `SELECT
      tw.*,
      p.nama as position_nama,
      pl.nama as terkait_player_nama,
      pl.ovr_current as terkait_player_ovr,
      pl.status as terkait_player_status
     FROM transfer_watchlist tw
     JOIN positions p ON tw.position_id = p.id
     LEFT JOIN players pl ON tw.terkait_player_id = pl.id
     WHERE tw.profile_id = ?
     ORDER BY tw.created_at DESC`,
    profileId
  );
}

/**
 * Create a new watchlist entry.
 */
export async function createWatchlist(input: CreateWatchlistInput): Promise<WatchlistWithDetails> {
  const db = await getDatabase();
  const id = generateId();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO transfer_watchlist (
      id, profile_id, position_id, target_ovr_min, target_ovr_max,
      catatan, terkait_player_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.profile_id,
    input.position_id,
    input.target_ovr_min ?? null,
    input.target_ovr_max ?? null,
    input.catatan ?? null,
    input.terkait_player_id ?? null,
    now
  );

  const items = await listWatchlist(input.profile_id);
  const created = items.find((i) => i.id === id);
  if (!created) throw new Error('Failed to retrieve newly created watchlist entry');
  return created;
}

/**
 * Update a watchlist entry.
 */
export async function updateWatchlist(id: string, input: UpdateWatchlistInput): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `UPDATE transfer_watchlist SET
      position_id = ?,
      target_ovr_min = ?,
      target_ovr_max = ?,
      catatan = ?,
      terkait_player_id = ?
     WHERE id = ?`,
    input.position_id,
    input.target_ovr_min ?? null,
    input.target_ovr_max ?? null,
    input.catatan ?? null,
    input.terkait_player_id ?? null,
    id
  );
}

/**
 * Delete a watchlist entry.
 */
export async function deleteWatchlist(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM transfer_watchlist WHERE id = ?', id);
}
