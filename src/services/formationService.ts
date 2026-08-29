import { getDatabase, generateId } from '@/src/database';
import { ensureStandardPositions, listPositions } from './positionService';
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
 * Ensure all 24 standard FC 26 formations exist for a profile.
 */
export async function ensureDefaultFormations(profileId: string): Promise<void> {
  const db = await getDatabase();
  await ensureStandardPositions(profileId);

  const existing = await db.getAllAsync<Formation>(
    'SELECT nama_formasi FROM formations WHERE profile_id = ?',
    profileId
  );
  const existingNames = new Set(existing.map((f) => f.nama_formasi.trim().toLowerCase()));

  // Fetch current positions for profile
  const positions = await listPositions(profileId);
  const posMap = new Map<string, string>();
  for (const p of positions) {
    posMap.set(p.nama.toUpperCase(), p.id);
  }

  const findPos = (name: string) => {
    const u = name.toUpperCase();
    if (posMap.has(u)) return posMap.get(u)!;
    if (u === 'LWB') return posMap.get('LB') ?? positions[0]?.id ?? '';
    if (u === 'RWB') return posMap.get('RB') ?? positions[0]?.id ?? '';
    if (u === 'CAM') return posMap.get('CM') ?? positions[0]?.id ?? '';
    if (u === 'CF' || u === 'LF' || u === 'RF') return posMap.get('ST') ?? positions[0]?.id ?? '';
    if (u === 'LM') return posMap.get('LW') ?? positions[0]?.id ?? '';
    if (u === 'RM') return posMap.get('RW') ?? positions[0]?.id ?? '';
    return positions[0]?.id ?? '';
  };

  for (const tmpl of FC26_PRESET_TEMPLATES) {
    if (!existingNames.has(tmpl.name.trim().toLowerCase())) {
      const fId = generateId();
      await db.runAsync(
        'INSERT INTO formations (id, profile_id, nama_formasi) VALUES (?, ?, ?)',
        fId,
        profileId,
        tmpl.name
      );

      for (const slot of tmpl.slots) {
        const slotId = generateId();
        await db.runAsync(
          `INSERT INTO formation_slots (id, formation_id, position_id, slot_label, coord_x, coord_y)
           VALUES (?, ?, ?, ?, ?, ?)`,
          slotId,
          fId,
          findPos(slot.pos),
          slot.label,
          slot.x,
          slot.y
        );
      }
    }
  }
}

/**
 * List all formations for a profile with slot counts (auto-populates default FC 26 formations).
 */
export async function listFormations(profileId: string): Promise<FormationWithSlots[]> {
  const db = await getDatabase();
  await ensureDefaultFormations(profileId);

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

export interface PresetTemplate {
  name: string;
  category: '4-Back' | '3-Back' | '5-Back';
  slots: { pos: string; label: string; x: number; y: number }[];
}

export const FC26_PRESET_TEMPLATES: PresetTemplate[] = [
  // ─── 4-Back Formations ───────────────────────────
  {
    name: '4-3-3 Flat',
    category: '4-Back',
    slots: [
      { pos: 'GK', label: 'GK', x: 50, y: 8 },
      { pos: 'LB', label: 'LB', x: 15, y: 28 },
      { pos: 'CB', label: 'CB1', x: 38, y: 24 },
      { pos: 'CB', label: 'CB2', x: 62, y: 24 },
      { pos: 'RB', label: 'RB', x: 85, y: 28 },
      { pos: 'CDM', label: 'CDM', x: 50, y: 46 },
      { pos: 'CM', label: 'CM1', x: 32, y: 60 },
      { pos: 'CM', label: 'CM2', x: 68, y: 60 },
      { pos: 'LW', label: 'LW', x: 18, y: 82 },
      { pos: 'ST', label: 'ST', x: 50, y: 88 },
      { pos: 'RW', label: 'RW', x: 82, y: 82 },
    ],
  },
  {
    name: '4-3-3 Attack (4)',
    category: '4-Back',
    slots: [
      { pos: 'GK', label: 'GK', x: 50, y: 8 },
      { pos: 'LB', label: 'LB', x: 15, y: 28 },
      { pos: 'CB', label: 'CB1', x: 38, y: 24 },
      { pos: 'CB', label: 'CB2', x: 62, y: 24 },
      { pos: 'RB', label: 'RB', x: 85, y: 28 },
      { pos: 'CM', label: 'CM1', x: 34, y: 48 },
      { pos: 'CM', label: 'CM2', x: 66, y: 48 },
      { pos: 'CAM', label: 'CAM', x: 50, y: 68 },
      { pos: 'LW', label: 'LW', x: 18, y: 82 },
      { pos: 'ST', label: 'ST', x: 50, y: 88 },
      { pos: 'RW', label: 'RW', x: 82, y: 82 },
    ],
  },
  {
    name: '4-3-3 Holding (2)',
    category: '4-Back',
    slots: [
      { pos: 'GK', label: 'GK', x: 50, y: 8 },
      { pos: 'LB', label: 'LB', x: 15, y: 28 },
      { pos: 'CB', label: 'CB1', x: 38, y: 24 },
      { pos: 'CB', label: 'CB2', x: 62, y: 24 },
      { pos: 'RB', label: 'RB', x: 85, y: 28 },
      { pos: 'CDM', label: 'CDM', x: 50, y: 44 },
      { pos: 'CM', label: 'LCM', x: 32, y: 62 },
      { pos: 'CM', label: 'RCM', x: 68, y: 62 },
      { pos: 'LW', label: 'LW', x: 18, y: 82 },
      { pos: 'ST', label: 'ST', x: 50, y: 88 },
      { pos: 'RW', label: 'RW', x: 82, y: 82 },
    ],
  },
  {
    name: '4-3-3 Defend (3)',
    category: '4-Back',
    slots: [
      { pos: 'GK', label: 'GK', x: 50, y: 8 },
      { pos: 'LB', label: 'LB', x: 15, y: 28 },
      { pos: 'CB', label: 'CB1', x: 38, y: 24 },
      { pos: 'CB', label: 'CB2', x: 62, y: 24 },
      { pos: 'RB', label: 'RB', x: 85, y: 28 },
      { pos: 'CDM', label: 'LDM', x: 36, y: 44 },
      { pos: 'CDM', label: 'RDM', x: 64, y: 44 },
      { pos: 'CM', label: 'CM', x: 50, y: 62 },
      { pos: 'LW', label: 'LW', x: 18, y: 82 },
      { pos: 'ST', label: 'ST', x: 50, y: 88 },
      { pos: 'RW', label: 'RW', x: 82, y: 82 },
    ],
  },
  {
    name: '4-3-3 False 9 (5)',
    category: '4-Back',
    slots: [
      { pos: 'GK', label: 'GK', x: 50, y: 8 },
      { pos: 'LB', label: 'LB', x: 15, y: 28 },
      { pos: 'CB', label: 'CB1', x: 38, y: 24 },
      { pos: 'CB', label: 'CB2', x: 62, y: 24 },
      { pos: 'RB', label: 'RB', x: 85, y: 28 },
      { pos: 'CDM', label: 'CDM', x: 50, y: 44 },
      { pos: 'CM', label: 'LCM', x: 32, y: 58 },
      { pos: 'CM', label: 'RCM', x: 68, y: 58 },
      { pos: 'LW', label: 'LW', x: 18, y: 82 },
      { pos: 'CF', label: 'CF', x: 50, y: 76 },
      { pos: 'RW', label: 'RW', x: 82, y: 82 },
    ],
  },
  {
    name: '4-2-3-1 (Wide)',
    category: '4-Back',
    slots: [
      { pos: 'GK', label: 'GK', x: 50, y: 8 },
      { pos: 'LB', label: 'LB', x: 15, y: 28 },
      { pos: 'CB', label: 'CB1', x: 38, y: 24 },
      { pos: 'CB', label: 'CB2', x: 62, y: 24 },
      { pos: 'RB', label: 'RB', x: 85, y: 28 },
      { pos: 'CDM', label: 'LDM', x: 36, y: 45 },
      { pos: 'CDM', label: 'RDM', x: 64, y: 45 },
      { pos: 'CAM', label: 'CAM', x: 50, y: 68 },
      { pos: 'LM', label: 'LM', x: 18, y: 68 },
      { pos: 'RM', label: 'RM', x: 82, y: 68 },
      { pos: 'ST', label: 'ST', x: 50, y: 88 },
    ],
  },
  {
    name: '4-2-3-1 (Narrow)',
    category: '4-Back',
    slots: [
      { pos: 'GK', label: 'GK', x: 50, y: 8 },
      { pos: 'LB', label: 'LB', x: 15, y: 28 },
      { pos: 'CB', label: 'CB1', x: 38, y: 24 },
      { pos: 'CB', label: 'CB2', x: 62, y: 24 },
      { pos: 'RB', label: 'RB', x: 85, y: 28 },
      { pos: 'CDM', label: 'LDM', x: 36, y: 45 },
      { pos: 'CDM', label: 'RDM', x: 64, y: 45 },
      { pos: 'CAM', label: 'LCAM', x: 30, y: 68 },
      { pos: 'CAM', label: 'CAM', x: 50, y: 70 },
      { pos: 'CAM', label: 'RCAM', x: 70, y: 68 },
      { pos: 'ST', label: 'ST', x: 50, y: 88 },
    ],
  },
  {
    name: '4-4-2 Flat',
    category: '4-Back',
    slots: [
      { pos: 'GK', label: 'GK', x: 50, y: 8 },
      { pos: 'LB', label: 'LB', x: 15, y: 28 },
      { pos: 'CB', label: 'CB1', x: 38, y: 24 },
      { pos: 'CB', label: 'CB2', x: 62, y: 24 },
      { pos: 'RB', label: 'RB', x: 85, y: 28 },
      { pos: 'LM', label: 'LM', x: 18, y: 56 },
      { pos: 'CM', label: 'LCM', x: 38, y: 54 },
      { pos: 'CM', label: 'RCM', x: 62, y: 54 },
      { pos: 'RM', label: 'RM', x: 82, y: 56 },
      { pos: 'ST', label: 'LST', x: 38, y: 86 },
      { pos: 'ST', label: 'RST', x: 62, y: 86 },
    ],
  },
  {
    name: '4-4-2 Holding',
    category: '4-Back',
    slots: [
      { pos: 'GK', label: 'GK', x: 50, y: 8 },
      { pos: 'LB', label: 'LB', x: 15, y: 28 },
      { pos: 'CB', label: 'CB1', x: 38, y: 24 },
      { pos: 'CB', label: 'CB2', x: 62, y: 24 },
      { pos: 'RB', label: 'RB', x: 85, y: 28 },
      { pos: 'LM', label: 'LM', x: 18, y: 60 },
      { pos: 'CDM', label: 'LDM', x: 38, y: 46 },
      { pos: 'CDM', label: 'RDM', x: 62, y: 46 },
      { pos: 'RM', label: 'RM', x: 82, y: 60 },
      { pos: 'ST', label: 'LST', x: 38, y: 86 },
      { pos: 'ST', label: 'RST', x: 62, y: 86 },
    ],
  },
  {
    name: '4-1-2-1-2 (Narrow)',
    category: '4-Back',
    slots: [
      { pos: 'GK', label: 'GK', x: 50, y: 8 },
      { pos: 'LB', label: 'LB', x: 15, y: 28 },
      { pos: 'CB', label: 'CB1', x: 38, y: 24 },
      { pos: 'CB', label: 'CB2', x: 62, y: 24 },
      { pos: 'RB', label: 'RB', x: 85, y: 28 },
      { pos: 'CDM', label: 'CDM', x: 50, y: 44 },
      { pos: 'CM', label: 'LCM', x: 30, y: 58 },
      { pos: 'CM', label: 'RCM', x: 70, y: 58 },
      { pos: 'CAM', label: 'CAM', x: 50, y: 70 },
      { pos: 'ST', label: 'LST', x: 38, y: 88 },
      { pos: 'ST', label: 'RST', x: 62, y: 88 },
    ],
  },
  {
    name: '4-1-2-1-2 (Wide)',
    category: '4-Back',
    slots: [
      { pos: 'GK', label: 'GK', x: 50, y: 8 },
      { pos: 'LB', label: 'LB', x: 15, y: 28 },
      { pos: 'CB', label: 'CB1', x: 38, y: 24 },
      { pos: 'CB', label: 'CB2', x: 62, y: 24 },
      { pos: 'RB', label: 'RB', x: 85, y: 28 },
      { pos: 'CDM', label: 'CDM', x: 50, y: 44 },
      { pos: 'LM', label: 'LM', x: 16, y: 62 },
      { pos: 'RM', label: 'RM', x: 84, y: 62 },
      { pos: 'CAM', label: 'CAM', x: 50, y: 70 },
      { pos: 'ST', label: 'LST', x: 38, y: 88 },
      { pos: 'ST', label: 'RST', x: 62, y: 88 },
    ],
  },
  {
    name: '4-2-2-2',
    category: '4-Back',
    slots: [
      { pos: 'GK', label: 'GK', x: 50, y: 8 },
      { pos: 'LB', label: 'LB', x: 15, y: 28 },
      { pos: 'CB', label: 'CB1', x: 38, y: 24 },
      { pos: 'CB', label: 'CB2', x: 62, y: 24 },
      { pos: 'RB', label: 'RB', x: 85, y: 28 },
      { pos: 'CDM', label: 'LDM', x: 36, y: 45 },
      { pos: 'CDM', label: 'RDM', x: 64, y: 45 },
      { pos: 'CAM', label: 'LCAM', x: 26, y: 68 },
      { pos: 'CAM', label: 'RCAM', x: 74, y: 68 },
      { pos: 'ST', label: 'LST', x: 38, y: 88 },
      { pos: 'ST', label: 'RST', x: 62, y: 88 },
    ],
  },
  {
    name: '4-3-2-1',
    category: '4-Back',
    slots: [
      { pos: 'GK', label: 'GK', x: 50, y: 8 },
      { pos: 'LB', label: 'LB', x: 15, y: 28 },
      { pos: 'CB', label: 'CB1', x: 38, y: 24 },
      { pos: 'CB', label: 'CB2', x: 62, y: 24 },
      { pos: 'RB', label: 'RB', x: 85, y: 28 },
      { pos: 'CM', label: 'LCM', x: 28, y: 52 },
      { pos: 'CM', label: 'CCM', x: 50, y: 48 },
      { pos: 'CM', label: 'RCM', x: 72, y: 52 },
      { pos: 'CF', label: 'LCF', x: 32, y: 74 },
      { pos: 'CF', label: 'RCF', x: 68, y: 74 },
      { pos: 'ST', label: 'ST', x: 50, y: 88 },
    ],
  },
  {
    name: '4-3-1-2',
    category: '4-Back',
    slots: [
      { pos: 'GK', label: 'GK', x: 50, y: 8 },
      { pos: 'LB', label: 'LB', x: 15, y: 28 },
      { pos: 'CB', label: 'CB1', x: 38, y: 24 },
      { pos: 'CB', label: 'CB2', x: 62, y: 24 },
      { pos: 'RB', label: 'RB', x: 85, y: 28 },
      { pos: 'CM', label: 'LCM', x: 28, y: 52 },
      { pos: 'CM', label: 'CCM', x: 50, y: 48 },
      { pos: 'CM', label: 'RCM', x: 72, y: 52 },
      { pos: 'CAM', label: 'CAM', x: 50, y: 68 },
      { pos: 'ST', label: 'LST', x: 38, y: 88 },
      { pos: 'ST', label: 'RST', x: 62, y: 88 },
    ],
  },
  {
    name: '4-5-1 Flat',
    category: '4-Back',
    slots: [
      { pos: 'GK', label: 'GK', x: 50, y: 8 },
      { pos: 'LB', label: 'LB', x: 15, y: 28 },
      { pos: 'CB', label: 'CB1', x: 38, y: 24 },
      { pos: 'CB', label: 'CB2', x: 62, y: 24 },
      { pos: 'RB', label: 'RB', x: 85, y: 28 },
      { pos: 'LM', label: 'LM', x: 16, y: 58 },
      { pos: 'CM', label: 'LCM', x: 34, y: 54 },
      { pos: 'CM', label: 'CCM', x: 50, y: 50 },
      { pos: 'CM', label: 'RCM', x: 66, y: 54 },
      { pos: 'RM', label: 'RM', x: 84, y: 58 },
      { pos: 'ST', label: 'ST', x: 50, y: 88 },
    ],
  },
  {
    name: '4-5-1 Attack',
    category: '4-Back',
    slots: [
      { pos: 'GK', label: 'GK', x: 50, y: 8 },
      { pos: 'LB', label: 'LB', x: 15, y: 28 },
      { pos: 'CB', label: 'CB1', x: 38, y: 24 },
      { pos: 'CB', label: 'CB2', x: 62, y: 24 },
      { pos: 'RB', label: 'RB', x: 85, y: 28 },
      { pos: 'CM', label: 'CM', x: 50, y: 46 },
      { pos: 'CAM', label: 'LCAM', x: 34, y: 66 },
      { pos: 'CAM', label: 'RCAM', x: 66, y: 66 },
      { pos: 'LM', label: 'LM', x: 16, y: 68 },
      { pos: 'RM', label: 'RM', x: 84, y: 68 },
      { pos: 'ST', label: 'ST', x: 50, y: 88 },
    ],
  },

  // ─── 3-Back Formations ───────────────────────────
  {
    name: '3-5-2',
    category: '3-Back',
    slots: [
      { pos: 'GK', label: 'GK', x: 50, y: 8 },
      { pos: 'CB', label: 'LCB', x: 25, y: 26 },
      { pos: 'CB', label: 'CB', x: 50, y: 24 },
      { pos: 'CB', label: 'RCB', x: 75, y: 26 },
      { pos: 'CDM', label: 'LDM', x: 36, y: 44 },
      { pos: 'CDM', label: 'RDM', x: 64, y: 44 },
      { pos: 'LM', label: 'LM', x: 14, y: 58 },
      { pos: 'CAM', label: 'CAM', x: 50, y: 66 },
      { pos: 'RM', label: 'RM', x: 86, y: 58 },
      { pos: 'ST', label: 'LST', x: 38, y: 86 },
      { pos: 'ST', label: 'RST', x: 62, y: 86 },
    ],
  },
  {
    name: '3-4-3 Flat',
    category: '3-Back',
    slots: [
      { pos: 'GK', label: 'GK', x: 50, y: 8 },
      { pos: 'CB', label: 'LCB', x: 25, y: 26 },
      { pos: 'CB', label: 'CB', x: 50, y: 24 },
      { pos: 'CB', label: 'RCB', x: 75, y: 26 },
      { pos: 'LM', label: 'LM', x: 14, y: 54 },
      { pos: 'CM', label: 'LCM', x: 38, y: 52 },
      { pos: 'CM', label: 'RCM', x: 62, y: 52 },
      { pos: 'RM', label: 'RM', x: 86, y: 54 },
      { pos: 'LW', label: 'LW', x: 20, y: 82 },
      { pos: 'ST', label: 'ST', x: 50, y: 88 },
      { pos: 'RW', label: 'RW', x: 80, y: 82 },
    ],
  },
  {
    name: '3-4-2-1',
    category: '3-Back',
    slots: [
      { pos: 'GK', label: 'GK', x: 50, y: 8 },
      { pos: 'CB', label: 'LCB', x: 25, y: 26 },
      { pos: 'CB', label: 'CB', x: 50, y: 24 },
      { pos: 'CB', label: 'RCB', x: 75, y: 26 },
      { pos: 'LM', label: 'LM', x: 14, y: 54 },
      { pos: 'CM', label: 'LCM', x: 38, y: 52 },
      { pos: 'CM', label: 'RCM', x: 62, y: 52 },
      { pos: 'RM', label: 'RM', x: 86, y: 54 },
      { pos: 'CF', label: 'LF', x: 32, y: 74 },
      { pos: 'CF', label: 'RF', x: 68, y: 74 },
      { pos: 'ST', label: 'ST', x: 50, y: 88 },
    ],
  },
  {
    name: '3-4-1-2',
    category: '3-Back',
    slots: [
      { pos: 'GK', label: 'GK', x: 50, y: 8 },
      { pos: 'CB', label: 'LCB', x: 25, y: 26 },
      { pos: 'CB', label: 'CB', x: 50, y: 24 },
      { pos: 'CB', label: 'RCB', x: 75, y: 26 },
      { pos: 'LM', label: 'LM', x: 14, y: 54 },
      { pos: 'CM', label: 'LCM', x: 38, y: 50 },
      { pos: 'CM', label: 'RCM', x: 62, y: 50 },
      { pos: 'RM', label: 'RM', x: 86, y: 54 },
      { pos: 'CAM', label: 'CAM', x: 50, y: 68 },
      { pos: 'ST', label: 'LST', x: 38, y: 86 },
      { pos: 'ST', label: 'RST', x: 62, y: 86 },
    ],
  },

  // ─── 5-Back Formations ───────────────────────────
  {
    name: '5-3-2',
    category: '5-Back',
    slots: [
      { pos: 'GK', label: 'GK', x: 50, y: 8 },
      { pos: 'LWB', label: 'LWB', x: 14, y: 32 },
      { pos: 'CB', label: 'LCB', x: 32, y: 24 },
      { pos: 'CB', label: 'CB', x: 50, y: 22 },
      { pos: 'CB', label: 'RCB', x: 68, y: 24 },
      { pos: 'RWB', label: 'RWB', x: 86, y: 32 },
      { pos: 'CM', label: 'LCM', x: 30, y: 54 },
      { pos: 'CM', label: 'CCM', x: 50, y: 50 },
      { pos: 'CM', label: 'RCM', x: 70, y: 54 },
      { pos: 'ST', label: 'LST', x: 38, y: 86 },
      { pos: 'ST', label: 'RST', x: 62, y: 86 },
    ],
  },
  {
    name: '5-2-3',
    category: '5-Back',
    slots: [
      { pos: 'GK', label: 'GK', x: 50, y: 8 },
      { pos: 'LWB', label: 'LWB', x: 14, y: 32 },
      { pos: 'CB', label: 'LCB', x: 32, y: 24 },
      { pos: 'CB', label: 'CB', x: 50, y: 22 },
      { pos: 'CB', label: 'RCB', x: 68, y: 24 },
      { pos: 'RWB', label: 'RWB', x: 86, y: 32 },
      { pos: 'CM', label: 'LCM', x: 38, y: 52 },
      { pos: 'CM', label: 'RCM', x: 62, y: 52 },
      { pos: 'LW', label: 'LW', x: 20, y: 82 },
      { pos: 'ST', label: 'ST', x: 50, y: 88 },
      { pos: 'RW', label: 'RW', x: 80, y: 82 },
    ],
  },
  {
    name: '5-4-1 Flat',
    category: '5-Back',
    slots: [
      { pos: 'GK', label: 'GK', x: 50, y: 8 },
      { pos: 'LWB', label: 'LWB', x: 14, y: 32 },
      { pos: 'CB', label: 'LCB', x: 32, y: 24 },
      { pos: 'CB', label: 'CB', x: 50, y: 22 },
      { pos: 'CB', label: 'RCB', x: 68, y: 24 },
      { pos: 'RWB', label: 'RWB', x: 86, y: 32 },
      { pos: 'LM', label: 'LM', x: 18, y: 58 },
      { pos: 'CM', label: 'LCM', x: 38, y: 54 },
      { pos: 'CM', label: 'RCM', x: 62, y: 54 },
      { pos: 'RM', label: 'RM', x: 82, y: 58 },
      { pos: 'ST', label: 'ST', x: 50, y: 88 },
    ],
  },
  {
    name: '5-2-1-2',
    category: '5-Back',
    slots: [
      { pos: 'GK', label: 'GK', x: 50, y: 8 },
      { pos: 'LWB', label: 'LWB', x: 14, y: 32 },
      { pos: 'CB', label: 'LCB', x: 32, y: 24 },
      { pos: 'CB', label: 'CB', x: 50, y: 22 },
      { pos: 'CB', label: 'RCB', x: 68, y: 24 },
      { pos: 'RWB', label: 'RWB', x: 86, y: 32 },
      { pos: 'CM', label: 'LCM', x: 38, y: 50 },
      { pos: 'CM', label: 'RCM', x: 62, y: 50 },
      { pos: 'CAM', label: 'CAM', x: 50, y: 68 },
      { pos: 'ST', label: 'LST', x: 38, y: 86 },
      { pos: 'ST', label: 'RST', x: 62, y: 86 },
    ],
  },
];

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


