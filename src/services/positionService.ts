/**
 * FC26 Career Mode Manager - Position Service
 * CRUD operations for positions scoped to active profile.
 */

import { getDatabase, generateId } from '@/src/database';
import type { Position } from '@/src/types';

/**
 * List all positions for a profile, ordered by sort_order.
 */
export async function listPositions(profileId: string): Promise<Position[]> {
  const db = await getDatabase();
  return db.getAllAsync<Position>(
    'SELECT * FROM positions WHERE profile_id = ? ORDER BY sort_order ASC',
    profileId
  );
}

/**
 * Create a new position.
 */
export async function createPosition(profileId: string, nama: string): Promise<Position> {
  const db = await getDatabase();
  const id = generateId();

  // Get next sort_order
  const maxOrder = await db.getFirstAsync<{ max_order: number | null }>(
    'SELECT MAX(sort_order) as max_order FROM positions WHERE profile_id = ?',
    profileId
  );
  const sortOrder = (maxOrder?.max_order ?? -1) + 1;

  await db.runAsync(
    'INSERT INTO positions (id, profile_id, nama, sort_order) VALUES (?, ?, ?, ?)',
    id, profileId, nama, sortOrder
  );

  return { id, profile_id: profileId, nama, sort_order: sortOrder };
}

/**
 * Update a position name.
 */
export async function updatePosition(id: string, nama: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE positions SET nama = ? WHERE id = ?', nama, id);
}

/**
 * Delete a position.
 */
export async function deletePosition(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM positions WHERE id = ?', id);
}

/**
 * Standard complete FC 26 football positions.
 */
export const ALL_FC26_POSITIONS = [
  'GK',
  'LB',
  'LWB',
  'CB',
  'RB',
  'RWB',
  'CDM',
  'CM',
  'CAM',
  'LM',
  'RM',
  'LW',
  'RW',
  'LF',
  'RF',
  'CF',
  'ST',
];

/**
 * Ensure all standard FC 26 positions exist in the given profile.
 */
export async function ensureStandardPositions(profileId: string): Promise<void> {
  const existing = await listPositions(profileId);
  const existingNames = new Set(existing.map((p) => p.nama.toUpperCase()));

  for (let i = 0; i < ALL_FC26_POSITIONS.length; i++) {
    const posName = ALL_FC26_POSITIONS[i];
    if (!existingNames.has(posName)) {
      await createPosition(profileId, posName);
    }
  }
}

/**
 * Reorder positions by updating sort_order for each.
 */
export async function reorderPositions(orderedIds: string[]): Promise<void> {
  const db = await getDatabase();
  for (let i = 0; i < orderedIds.length; i++) {
    await db.runAsync(
      'UPDATE positions SET sort_order = ? WHERE id = ?',
      i, orderedIds[i]
    );
  }
}

/**
 * Get a single position by ID.
 */
export async function getPositionById(id: string): Promise<Position | null> {
  const db = await getDatabase();
  const pos = await db.getFirstAsync<Position>(
    'SELECT * FROM positions WHERE id = ?', id
  );
  return pos ?? null;
}
