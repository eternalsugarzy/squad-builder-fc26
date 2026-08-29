/**
 * FC26 Career Mode Manager - Dashboard & Position Quota Service
 * Calculates on-the-fly position quotas, squad overviews, and status summaries.
 */

import { getDatabase } from '@/src/database';
import { listPlayers } from './playerService';
import { listPositions } from './positionService';
import { listSquadsWithDetails, type SquadFull } from './squadService';
import { listWatchlist, type WatchlistWithDetails } from './watchlistService';
import type { PositionQuota, PositionQuotaSettings } from '@/src/types';

export interface DashboardData {
  profileName: string;
  totalPlayers: number;
  activeCount: number;
  loanCount: number;
  injuredCount: number;
  akanDijualCount: number;
  squads: SquadFull[];
  positionQuotas: PositionQuota[];
  bufferMultiplier: number;
  topWatchlist: WatchlistWithDetails[];
}

/**
 * Get the buffer multiplier setting for a profile (default 1.5).
 */
export async function getBufferMultiplier(profileId: string): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<PositionQuotaSettings>(
    'SELECT buffer_multiplier FROM position_quota_settings WHERE profile_id = ?',
    profileId
  );
  return row?.buffer_multiplier ?? 1.5;
}

/**
 * Update the buffer multiplier setting for a profile.
 */
export async function updateBufferMultiplier(
  profileId: string,
  bufferMultiplier: number
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO position_quota_settings (profile_id, buffer_multiplier)
     VALUES (?, ?)
     ON CONFLICT(profile_id) DO UPDATE SET buffer_multiplier = ?`,
    profileId,
    bufferMultiplier,
    bufferMultiplier
  );
}

/**
 * Compute on-the-fly position quotas:
 * kuota_ideal(posisi) = SUM(slots with position across squads) × buffer_multiplier
 * jumlah_aktif = count of active players who have that position (primary or secondary)
 */
export async function calculatePositionQuotas(profileId: string): Promise<PositionQuota[]> {
  const db = await getDatabase();
  const bufferMultiplier = await getBufferMultiplier(profileId);
  const positions = await listPositions(profileId);
  const allPlayers = await listPlayers(profileId);

  // Active players pool (status = aktif or akan_dijual)
  const activePlayers = allPlayers.filter(
    (p) => p.status === 'aktif' || p.status === 'akan_dijual'
  );

  // Count formation slots across all squads belonging to this profile
  const slotCountRows = await db.getAllAsync<{ position_id: string; slot_count: number }>(
    `SELECT fs.position_id, COUNT(fs.id) as slot_count
     FROM squads s
     JOIN formation_slots fs ON s.formation_id = fs.formation_id
     WHERE s.profile_id = ?
     GROUP BY fs.position_id`,
    profileId
  );

  const slotCountMap = new Map<string, number>();
  for (const r of slotCountRows) {
    slotCountMap.set(r.position_id, r.slot_count);
  }

  const result: PositionQuota[] = [];

  for (const pos of positions) {
    const rawSlots = slotCountMap.get(pos.id) ?? 0;
    const kuotaIdeal = Math.round(rawSlots * bufferMultiplier);

    // Count active players who have this position (primary or secondary)
    const jumlahAktif = activePlayers.filter((p) =>
      p.positions.some((pp) => pp.id === pos.id)
    ).length;

    const selisih = jumlahAktif - kuotaIdeal;

    result.push({
      position_id: pos.id,
      position_nama: pos.nama,
      kuota_ideal: kuotaIdeal,
      jumlah_aktif: jumlahAktif,
      selisih,
    });
  }

  return result;
}

/**
 * Fetch all dashboard aggregated data for active profile.
 */
export async function getDashboardData(profileId: string): Promise<DashboardData> {
  const [players, squads, quotas, bufferMultiplier, watchlist] = await Promise.all([
    listPlayers(profileId),
    listSquadsWithDetails(profileId),
    calculatePositionQuotas(profileId),
    getBufferMultiplier(profileId),
    listWatchlist(profileId),
  ]);

  const activeCount = players.filter((p) => p.status === 'aktif').length;
  const loanCount = players.filter((p) => p.status === 'loan_out').length;
  const injuredCount = players.filter((p) => p.status === 'injured').length;
  const akanDijualCount = players.filter((p) => p.status === 'akan_dijual').length;

  return {
    profileName: '',
    totalPlayers: players.length,
    activeCount,
    loanCount,
    injuredCount,
    akanDijualCount,
    squads,
    positionQuotas: quotas,
    bufferMultiplier,
    topWatchlist: watchlist.slice(0, 5),
  };
}
