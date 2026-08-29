/**
 * FC26 Career Mode Manager - Profile Service
 * CRUD operations for profiles + active profile management.
 */

import { getDatabase, generateId } from '@/src/database';
import type { Profile } from '@/src/types';

/**
 * Get all profiles ordered by creation date.
 */
export async function listProfiles(): Promise<Profile[]> {
  const db = await getDatabase();
  return db.getAllAsync<Profile>(
    'SELECT * FROM profiles ORDER BY created_at ASC'
  );
}

/**
 * Get the currently active profile.
 */
export async function getActiveProfile(): Promise<Profile | null> {
  const db = await getDatabase();
  const profile = await db.getFirstAsync<Profile>(
    'SELECT * FROM profiles WHERE is_active = 1 LIMIT 1'
  );
  return profile ?? null;
}

/**
 * Create a new profile. If it's the first profile, auto-activate it.
 */
export async function createProfile(namaSave: string): Promise<Profile> {
  const db = await getDatabase();
  const id = generateId();
  const now = new Date().toISOString();

  // Check if any profiles exist
  const count = await db.getFirstAsync<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM profiles'
  );
  const isFirst = (count?.cnt ?? 0) === 0;

  await db.runAsync(
    'INSERT INTO profiles (id, nama_save, is_active, created_at) VALUES (?, ?, ?, ?)',
    id, namaSave, isFirst ? 1 : 0, now
  );

  // Also create default position_quota_settings for this profile
  await db.runAsync(
    'INSERT INTO position_quota_settings (profile_id, buffer_multiplier) VALUES (?, ?)',
    id, 1.5
  );

  return {
    id,
    nama_save: namaSave,
    is_active: isFirst ? 1 : 0,
    created_at: now,
  };
}

/**
 * Rename a profile.
 */
export async function renameProfile(id: string, namaSave: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE profiles SET nama_save = ? WHERE id = ?',
    namaSave, id
  );
}

/**
 * Delete a profile and all its associated data (cascade).
 * If the deleted profile was active, activate the first remaining one.
 */
export async function deleteProfile(id: string): Promise<void> {
  const db = await getDatabase();

  // Check if this profile is active
  const profile = await db.getFirstAsync<Profile>(
    'SELECT * FROM profiles WHERE id = ?', id
  );
  const wasActive = profile?.is_active === 1;

  // Delete the profile (CASCADE handles related tables)
  await db.runAsync('DELETE FROM profiles WHERE id = ?', id);

  // If deleted profile was active, activate the first remaining one
  if (wasActive) {
    const firstRemaining = await db.getFirstAsync<Profile>(
      'SELECT * FROM profiles ORDER BY created_at ASC LIMIT 1'
    );
    if (firstRemaining) {
      await db.runAsync(
        'UPDATE profiles SET is_active = 1 WHERE id = ?',
        firstRemaining.id
      );
    }
  }
}

/**
 * Set a profile as active (deactivates all others).
 */
export async function setActiveProfile(id: string): Promise<void> {
  const db = await getDatabase();

  // Deactivate all profiles
  await db.runAsync('UPDATE profiles SET is_active = 0');

  // Activate the selected profile
  await db.runAsync(
    'UPDATE profiles SET is_active = 1 WHERE id = ?', id
  );
}

/**
 * Get profile by ID.
 */
export async function getProfileById(id: string): Promise<Profile | null> {
  const db = await getDatabase();
  const profile = await db.getFirstAsync<Profile>(
    'SELECT * FROM profiles WHERE id = ?', id
  );
  return profile ?? null;
}
