/**
 * FC26 Career Mode Manager - Formation Service
 * CRUD formations & formation slots scoped to profile.
 */

import { getDatabase, generateId } from '@/src/database';
import type { Formation, FormationSlot, FormationSlotWithPosition } from '@/src/types';

export interface FormationWithSlots extends Formation {
  slots: FormationSlotWithPosition[];
}

export interface SlotInput {
  id?: string;
  position_id: string;
  slot_label: string;
  coord_x: number;
  coord_y: number;
}

/**
 * List all formations for a profile with slot counts.
 */
export async function listFormations(profileId: string): Promise<FormationWithSlots[]> {
  const db = await getDatabase();

  const formations = await db.getAllAsync<Formation>(
    'SELECT * FROM formations WHERE profile_id = ? ORDER BY nama_formasi ASC',
    profileId
  );

  if (formations.length === 0) return [];

  const slots = await db.getAllAsync<FormationSlotWithPosition>(
    `SELECT fs.*, p.nama as position_nama
     FROM formation_slots fs
     JOIN positions p ON fs.position_id = p.id
     JOIN formations f ON fs.formation_id = f.id
     WHERE f.profile_id = ?
     ORDER BY fs.coord_y ASC, fs.coord_x ASC`,
    profileId
  );

  const slotsMap = new Map<string, FormationSlotWithPosition[]>();
  for (const s of slots) {
    if (!slotsMap.has(s.formation_id)) {
      slotsMap.set(s.formation_id, []);
    }
    slotsMap.get(s.formation_id)!.push(s);
  }

  return formations.map((f) => ({
    ...f,
    slots: slotsMap.get(f.id) ?? [],
  }));
}

/**
 * Get a single formation by ID with its slots.
 */
export async function getFormationById(id: string): Promise<FormationWithSlots | null> {
  const db = await getDatabase();

  const formation = await db.getFirstAsync<Formation>(
    'SELECT * FROM formations WHERE id = ?',
    id
  );

  if (!formation) return null;

  const slots = await db.getAllAsync<FormationSlotWithPosition>(
    `SELECT fs.*, p.nama as position_nama
     FROM formation_slots fs
     JOIN positions p ON fs.position_id = p.id
     WHERE fs.formation_id = ?
     ORDER BY fs.coord_y ASC, fs.coord_x ASC`,
    id
  );

  return {
    ...formation,
    slots,
  };
}

/**
 * Create a new formation with slots.
 */
export async function createFormation(
  profileId: string,
  namaFormasi: string,
  slots: SlotInput[]
): Promise<FormationWithSlots> {
  const db = await getDatabase();
  const id = generateId();

  await db.runAsync(
    'INSERT INTO formations (id, profile_id, nama_formasi) VALUES (?, ?, ?)',
    id,
    profileId,
    namaFormasi.trim()
  );

  for (const slot of slots) {
    const slotId = slot.id || generateId();
    await db.runAsync(
      `INSERT INTO formation_slots (id, formation_id, position_id, slot_label, coord_x, coord_y)
       VALUES (?, ?, ?, ?, ?, ?)`,
      slotId,
      id,
      slot.position_id,
      slot.slot_label,
      slot.coord_x,
      slot.coord_y
    );
  }

  const created = await getFormationById(id);
  if (!created) throw new Error('Failed to retrieve newly created formation');
  return created;
}

/**
 * Update a formation and replace its slots.
 */
export async function updateFormation(
  id: string,
  namaFormasi: string,
  slots: SlotInput[]
): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    'UPDATE formations SET nama_formasi = ? WHERE id = ?',
    namaFormasi.trim(),
    id
  );

  // Delete existing slots and re-insert
  await db.runAsync('DELETE FROM formation_slots WHERE formation_id = ?', id);

  for (const slot of slots) {
    const slotId = slot.id || generateId();
    await db.runAsync(
      `INSERT INTO formation_slots (id, formation_id, position_id, slot_label, coord_x, coord_y)
       VALUES (?, ?, ?, ?, ?, ?)`,
      slotId,
      id,
      slot.position_id,
      slot.slot_label,
      slot.coord_x,
      slot.coord_y
    );
  }
}

/**
 * Delete a formation.
 */
export async function deleteFormation(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM formations WHERE id = ?', id);
}

/**
 * Duplicate a formation.
 */
export async function duplicateFormation(id: string, newName: string): Promise<FormationWithSlots> {
  const formation = await getFormationById(id);
  if (!formation) throw new Error('Formation not found');

  return createFormation(
    formation.profile_id,
    newName,
    formation.slots.map((s) => ({
      position_id: s.position_id,
      slot_label: s.slot_label,
      coord_x: s.coord_x,
      coord_y: s.coord_y,
    }))
  );
}
