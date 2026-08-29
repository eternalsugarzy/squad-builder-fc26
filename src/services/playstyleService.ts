/**
 * FC26 Career Mode Manager - Playstyle Service
 * CRUD operations for playstyles scoped to active profile.
 */

import { getDatabase, generateId } from '@/src/database';
import type { Playstyle } from '@/src/types';

/**
 * List all playstyles for a profile.
 */
export async function listPlaystyles(profileId: string): Promise<Playstyle[]> {
  const db = await getDatabase();
  return db.getAllAsync<Playstyle>(
    'SELECT * FROM playstyles WHERE profile_id = ? ORDER BY nama ASC',
    profileId
  );
}

/**
 * Create a new playstyle.
 */
export async function createPlaystyle(
  profileId: string,
  nama: string,
  catatan?: string
): Promise<Playstyle> {
  const db = await getDatabase();
  const id = generateId();

  await db.runAsync(
    'INSERT INTO playstyles (id, profile_id, nama, catatan) VALUES (?, ?, ?, ?)',
    id, profileId, nama, catatan ?? null
  );

  return { id, profile_id: profileId, nama, catatan: catatan ?? null };
}

/**
 * Update a playstyle.
 */
export async function updatePlaystyle(
  id: string,
  nama: string,
  catatan?: string
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE playstyles SET nama = ?, catatan = ? WHERE id = ?',
    nama, catatan ?? null, id
  );
}

/**
 * Delete a playstyle.
 */
export async function deletePlaystyle(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM playstyles WHERE id = ?', id);
}

/**
 * Get a single playstyle by ID.
 */
export async function getPlaystyleById(id: string): Promise<Playstyle | null> {
  const db = await getDatabase();
  const ps = await db.getFirstAsync<Playstyle>(
    'SELECT * FROM playstyles WHERE id = ?', id
  );
  return ps ?? null;
}
