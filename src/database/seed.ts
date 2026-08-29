/**
 * FC26 Career Mode Manager - Seed Script for Profile 1
 * Seeds Profile "Save 1" with all 44 players, 10 positions, 4-3-3 Flat formation,
 * High Pressing playstyle, 4 Team Sheets, and 1 Transfer Watchlist entry.
 */

import { getDatabase, generateId } from './database';

export async function seedProfile1(): Promise<string> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  // Check if Save 1 already exists
  const existing = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM profiles WHERE nama_save = 'Save 1' LIMIT 1"
  );
  if (existing) {
    console.log('[Seed] Profile "Save 1" already exists with ID:', existing.id);
    return existing.id;
  }

  // 1. Profile
  const profileId = generateId();
  // Deactivate other profiles if any
  await db.runAsync('UPDATE profiles SET is_active = 0');
  await db.runAsync(
    'INSERT INTO profiles (id, nama_save, is_active, created_at) VALUES (?, ?, 1, ?)',
    profileId,
    'Save 1',
    now
  );

  // Buffer multiplier setting (1.5)
  await db.runAsync(
    'INSERT INTO position_quota_settings (profile_id, buffer_multiplier) VALUES (?, 1.5)',
    profileId
  );

  // 2. Playstyle: High Pressing
  const playstyleId = generateId();
  await db.runAsync(
    'INSERT INTO playstyles (id, profile_id, nama, catatan) VALUES (?, ?, ?, ?)',
    playstyleId,
    profileId,
    'High Pressing',
    'Tekanan tinggi konstan pada area lawan'
  );

  // 3. Positions (17 standard FC 26 positions)
  const posNames = [
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
  const posMap = new Map<string, string>(); // name -> id

  for (let i = 0; i < posNames.length; i++) {
    const pId = generateId();
    await db.runAsync(
      'INSERT INTO positions (id, profile_id, nama, sort_order) VALUES (?, ?, ?, ?)',
      pId,
      profileId,
      posNames[i],
      i
    );
    posMap.set(posNames[i], pId);
  }

  // 4. Formation: 4-3-3 Flat (11 slots)
  const formationId = generateId();
  await db.runAsync(
    'INSERT INTO formations (id, profile_id, nama_formasi) VALUES (?, ?, ?)',
    formationId,
    profileId,
    '4-3-3 Flat'
  );

  const slotDefs = [
    { label: 'GK', pos: 'GK', x: 50, y: 8 },
    { label: 'LB', pos: 'LB', x: 15, y: 28 },
    { label: 'CB1', pos: 'CB', x: 38, y: 24 },
    { label: 'CB2', pos: 'CB', x: 62, y: 24 },
    { label: 'RB', pos: 'RB', x: 85, y: 28 },
    { label: 'CDM', pos: 'CDM', x: 50, y: 46 },
    { label: 'CM1', pos: 'CM', x: 32, y: 60 },
    { label: 'CM2', pos: 'CM', x: 68, y: 60 },
    { label: 'LW', pos: 'LW', x: 18, y: 82 },
    { label: 'ST', pos: 'ST', x: 50, y: 88 },
    { label: 'RW', pos: 'RW', x: 82, y: 82 },
  ];

  const slotMap = new Map<string, string>(); // label -> slot_id

  for (const s of slotDefs) {
    const sId = generateId();
    const posId = posMap.get(s.pos)!;
    await db.runAsync(
      `INSERT INTO formation_slots (id, formation_id, position_id, slot_label, coord_x, coord_y)
       VALUES (?, ?, ?, ?, ?, ?)`,
      sId,
      formationId,
      posId,
      s.label,
      s.x,
      s.y
    );
    slotMap.set(s.label, sId);
  }

  // 5. 33 Active Players + 11 Loan-Out Players (Total 44)
  const activePlayerData = [
    // GK
    { nama: 'N. Atubolu', pos: 'GK', ovr: 82, status: 'aktif' },
    { nama: 'M. González', pos: 'GK', ovr: 80, status: 'aktif' },
    { nama: 'R. Acuña', pos: 'GK', ovr: 76, status: 'aktif' },
    // LB
    { nama: 'E. Diouf', pos: 'LB', ovr: 82, status: 'aktif' },
    { nama: 'F. Chissumba', pos: 'LB', ovr: 74, status: 'aktif' },
    { nama: 'M. Cocchi', pos: 'LB', ovr: 73, status: 'aktif' },
    // CB
    { nama: 'M. Kayode', pos: 'CB', ovr: 83, status: 'aktif' },
    { nama: 'J. Acheampong', pos: 'CB', ovr: 80, status: 'aktif' },
    { nama: 'I. Menéndez', pos: 'CB', ovr: 79, status: 'aktif' },
    { nama: 'C. Akpa', pos: 'CB', ovr: 77, status: 'aktif' },
    { nama: 'T. Blokzijl', pos: 'CB', ovr: 76, status: 'aktif' },
    { nama: 'R. Koster', pos: 'CB', ovr: 56, status: 'aktif' },
    // RB
    { nama: 'T. Alexander-Arnold', pos: 'RB', ovr: 85, status: 'aktif' },
    { nama: 'F. Canales', pos: 'RB', ovr: 77, status: 'aktif' },
    { nama: 'Z. Athekame', pos: 'RB', ovr: 70, status: 'aktif' },
    // CDM
    { nama: 'T. Morton', pos: 'CDM', ovr: 82, status: 'aktif' },
    { nama: 'D. Santos', pos: 'CDM', ovr: 81, status: 'aktif' },
    { nama: 'D. Aguirre', pos: 'CDM', ovr: 79, status: 'aktif' },
    // CM
    { nama: 'W. Mefrane', pos: 'CM', ovr: 87, status: 'aktif' },
    { nama: 'L. Camara', pos: 'CM', ovr: 84, status: 'aktif' },
    { nama: 'M. Fernandes', pos: 'CM', ovr: 83, status: 'aktif' },
    { nama: 'D. Bobadilla', pos: 'CM', ovr: 77, status: 'aktif' },
    { nama: 'L. Amatucci', pos: 'CM', ovr: 77, status: 'aktif' },
    { nama: 'M. Amondarain', pos: 'CM', ovr: 75, status: 'aktif' },
    // LW
    { nama: 'Rodrygo', pos: 'LW', ovr: 87, status: 'aktif' },
    { nama: 'M. Moore', pos: 'LW', ovr: 82, status: 'akan_dijual' },
    { nama: 'J. Barber', pos: 'LW', ovr: 55, status: 'aktif' },
    // RW
    { nama: 'L. Yamal', pos: 'RW', ovr: 93, status: 'aktif' },
    { nama: 'I. Akhomach', pos: 'RW', ovr: 83, status: 'aktif' },
    { nama: 'G. Prestianni', pos: 'RW', ovr: 79, status: 'aktif' },
    // ST
    { nama: 'Endrick', pos: 'ST', ovr: 85, status: 'aktif' },
    { nama: 'S. Hammond', pos: 'ST', ovr: 77, status: 'aktif' },
    { nama: 'A. Moreira', pos: 'ST', ovr: 69, status: 'aktif' },
  ];

  const loanPlayerData = [
    { nama: 'E. Cabrera', pos: 'GK', ovr: 63 },
    { nama: 'R. Araoye', pos: 'CB', ovr: 59 },
    { nama: 'N. Reich', pos: 'CDM', ovr: 63 },
    { nama: 'M. Leblanc', pos: 'CM', ovr: 66 },
    { nama: 'J. Carré', pos: 'CM', ovr: 63 },
    { nama: 'S. Thomas', pos: 'CM', ovr: 62 },
    { nama: 'M. Mannhardt', pos: 'CM', ovr: 60 },
    { nama: 'E. Bamba', pos: 'RM', ovr: 59 },
    { nama: 'R. Aloko', pos: 'RW', ovr: 71 },
    { nama: 'A. Japaur', pos: 'ST', ovr: 66 },
    { nama: 'H. Abdelkarim', pos: 'ST', ovr: 72 },
  ];

  const playerMap = new Map<string, string>(); // name -> id

  // Insert active players
  for (const p of activePlayerData) {
    const plId = generateId();
    await db.runAsync(
      `INSERT INTO players (id, profile_id, nama, ovr_current, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      plId,
      profileId,
      p.nama,
      p.ovr,
      p.status,
      now,
      now
    );

    const posId = posMap.get(p.pos)!;
    const ppId = generateId();
    await db.runAsync(
      'INSERT INTO player_positions (id, player_id, position_id, order_index) VALUES (?, ?, ?, 0)',
      ppId,
      plId,
      posId
    );

    playerMap.set(p.nama, plId);
  }

  // Insert loan out players
  for (const p of loanPlayerData) {
    const plId = generateId();
    await db.runAsync(
      `INSERT INTO players (id, profile_id, nama, ovr_current, status, status_durasi, status_mulai, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'loan_out', '1_tahun', ?, ?, ?)`,
      plId,
      profileId,
      p.nama,
      p.ovr,
      now,
      now,
      now
    );

    const posId = posMap.get(p.pos)!;
    const ppId = generateId();
    await db.runAsync(
      'INSERT INTO player_positions (id, player_id, position_id, order_index) VALUES (?, ?, ?, 0)',
      ppId,
      plId,
      posId
    );

    playerMap.set(p.nama, plId);
  }

  // 6. Squads (Tim 1, 2, 3, 4) with starting XI and Bench
  const squadDefinitions = [
    {
      tier: 1,
      name: 'Tim 1 (Utama)',
      captain: 'W. Mefrane',
      starters: {
        GK: 'N. Atubolu',
        LB: 'E. Diouf',
        CB1: 'M. Kayode',
        CB2: 'J. Acheampong',
        RB: 'T. Alexander-Arnold',
        CDM: 'T. Morton',
        CM1: 'W. Mefrane',
        CM2: 'L. Camara',
        LW: 'Rodrygo',
        RW: 'L. Yamal',
        ST: 'Endrick',
      },
      bench: [
        'M. González',
        'F. Chissumba',
        'I. Menéndez',
        'F. Canales',
        'D. Santos',
        'M. Fernandes',
        'M. Moore',
        'I. Akhomach',
        'S. Hammond',
      ],
    },
    {
      tier: 2,
      name: 'Tim 2 (Rotasi)',
      captain: null,
      starters: {
        GK: 'M. González',
        LB: 'F. Chissumba',
        CB1: 'I. Menéndez',
        CB2: 'C. Akpa',
        RB: 'F. Canales',
        CDM: 'D. Santos',
        CM1: 'M. Fernandes',
        CM2: 'D. Bobadilla',
        LW: 'M. Moore',
        RW: 'I. Akhomach',
        ST: 'S. Hammond',
      },
      bench: [
        'R. Acuña',
        'M. Cocchi',
        'T. Blokzijl',
        'Z. Athekame',
        'D. Aguirre',
        'L. Amatucci',
        'J. Barber',
        'G. Prestianni',
        'A. Moreira',
      ],
    },
    {
      tier: 3,
      name: 'Tim 3 (Cadangan)',
      captain: null,
      starters: {
        GK: 'R. Acuña',
        LB: 'M. Cocchi',
        CB1: 'T. Blokzijl',
        CB2: 'R. Koster',
        RB: 'Z. Athekame',
        CDM: 'D. Aguirre',
        CM1: 'L. Amatucci',
        CM2: 'M. Amondarain',
        LW: 'J. Barber',
        RW: 'G. Prestianni',
        ST: 'A. Moreira',
      },
      bench: [
        'N. Atubolu',
        'E. Diouf',
        'M. Kayode',
        'T. Alexander-Arnold',
        'T. Morton',
        'W. Mefrane',
        'M. Moore',
        'L. Yamal',
        'Endrick',
      ],
    },
    {
      tier: 4,
      name: 'Tim 4 (Hybrid)',
      captain: 'W. Mefrane',
      starters: {
        GK: 'M. González',
        LB: 'E. Diouf',
        CB1: 'M. Kayode',
        CB2: 'C. Akpa',
        RB: 'T. Alexander-Arnold',
        CDM: 'D. Aguirre',
        CM1: 'W. Mefrane',
        CM2: 'M. Fernandes',
        LW: 'M. Moore',
        RW: 'G. Prestianni',
        ST: 'Endrick',
      },
      bench: [
        'I. Menéndez',
        'D. Santos',
        'I. Akhomach',
        'R. Acuña',
        'M. Cocchi',
        'L. Amatucci',
        'N. Atubolu',
        'T. Morton',
        'L. Yamal',
      ],
    },
  ];

  for (const sqDef of squadDefinitions) {
    const sqId = generateId();
    await db.runAsync(
      `INSERT INTO squads (id, profile_id, nama_tim, formation_id, playstyle_id, tier_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      sqId,
      profileId,
      sqDef.name,
      formationId,
      playstyleId,
      sqDef.tier
    );

    // Insert starter slots
    for (const [slotLabel, playerName] of Object.entries(sqDef.starters)) {
      const fSlotId = slotMap.get(slotLabel);
      const pId = playerMap.get(playerName);
      if (fSlotId && pId) {
        const isCaptain = sqDef.captain === playerName ? 1 : 0;
        const ssId = generateId();
        await db.runAsync(
          `INSERT INTO squad_slots (id, squad_id, formation_slot_id, player_id, is_captain)
           VALUES (?, ?, ?, ?, ?)`,
          ssId,
          sqId,
          fSlotId,
          pId,
          isCaptain
        );
      }
    }

    // Insert bench
    for (let bIdx = 0; bIdx < sqDef.bench.length; bIdx++) {
      const bPlayerName = sqDef.bench[bIdx];
      const pId = playerMap.get(bPlayerName);
      if (pId) {
        const bId = generateId();
        await db.runAsync(
          `INSERT INTO squad_bench (id, squad_id, player_id, order_index)
           VALUES (?, ?, ?, ?)`,
          bId,
          sqId,
          pId,
          bIdx
        );
      }
    }
  }

  // 7. Transfer Watchlist Entry
  const lwPosId = posMap.get('LW')!;
  const moorePlayerId = playerMap.get('M. Moore')!;
  const watchlistId = generateId();

  await db.runAsync(
    `INSERT INTO transfer_watchlist (
      id, profile_id, position_id, target_ovr_min, target_ovr_max,
      catatan, terkait_player_id, created_at
    ) VALUES (?, ?, ?, 78, 83, ?, ?, ?)`,
    watchlistId,
    profileId,
    lwPosId,
    'M. Moore akan dijual, butuh pengganti LW',
    moorePlayerId,
    now
  );

  console.log('[Seed] Profile 1 seeded successfully with ID:', profileId);
  return profileId;
}
