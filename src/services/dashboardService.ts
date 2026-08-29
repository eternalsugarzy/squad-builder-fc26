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
 * Compute position quotas (supports both actual squad mode and simulated formation mode):
 * - Tim 1-3 are independent core squads.
 * - Tim 4 is a hybrid/combination squad using players from Tim 1-3 (not requiring additional separate players).
 * - If formationId is passed: simulates requirement for the 3 core squads (Tim 1-3).
 * - If formationId is null: aggregates actual formation slots across Tim 1-3.
 */
export async function calculatePositionQuotas(
  profileId: string,
  simulatedFormationId?: string | null,
  simulatedSquadCount: number = 3
): Promise<PositionQuota[]> {
  const db = await getDatabase();
  const positions = await listPositions(profileId);
  const allPlayers = await listPlayers(profileId);

  // Active players pool (status = aktif or akan_dijual)
  const activePlayers = allPlayers.filter(
    (p) => p.status === 'aktif' || p.status === 'akan_dijual'
  );

  const slotCountMap = new Map<string, number>();

  if (simulatedFormationId) {
    // Count slots for this single formation and multiply by simulatedSquadCount (default 3 core squads)
    const formationSlots = await db.getAllAsync<{ position_id: string; slot_count: number }>(
      `SELECT position_id, COUNT(id) as slot_count
       FROM formation_slots
       WHERE formation_id = ?
       GROUP BY position_id`,
      simulatedFormationId
    );

    for (const r of formationSlots) {
      slotCountMap.set(r.position_id, r.slot_count * simulatedSquadCount);
    }
  } else {
    // Count actual formation slots across independent core squads (tier_order <= 3)
    const slotCountRows = await db.getAllAsync<{ position_id: string; slot_count: number }>(
      `SELECT fs.position_id, COUNT(fs.id) as slot_count
       FROM squads s
       JOIN formation_slots fs ON s.formation_id = fs.formation_id
       WHERE s.profile_id = ? AND s.tier_order <= 3
       GROUP BY fs.position_id`,
      profileId
    );

    for (const r of slotCountRows) {
      slotCountMap.set(r.position_id, r.slot_count);
    }
  }

  const result: PositionQuota[] = [];

  for (const pos of positions) {
    const needed = slotCountMap.get(pos.id) ?? 0;

    // Count active players whose primary position (positions[0]) is this position
    const owned = activePlayers.filter((p) => p.positions[0]?.id === pos.id).length;

    const selisih = owned - needed;

    // Only include positions that are either needed > 0 OR owned > 0 (to keep monitor clean)
    if (needed > 0 || owned > 0) {
      result.push({
        position_id: pos.id,
        position_nama: pos.nama,
        kuota_ideal: needed,
        jumlah_aktif: owned,
        selisih,
      });
    }
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

  const squadPlayers = players.filter((p) => p.status !== 'sudah_dijual');
  const activeCount = players.filter((p) => p.status === 'aktif').length;
  const loanCount = players.filter((p) => p.status === 'loan_out').length;
  const injuredCount = players.filter((p) => p.status === 'injured').length;
  const akanDijualCount = players.filter((p) => p.status === 'akan_dijual').length;

  return {
    profileName: '',
    totalPlayers: squadPlayers.length,
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
