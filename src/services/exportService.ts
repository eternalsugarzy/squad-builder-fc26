/**
 * FC26 Career Mode Manager - Export & Import Service
 * Handles profile backup (JSON) and Team Sheet text export.
 */

import { getDatabase, generateId } from '@/src/database';
import { listPlayers } from './playerService';
import { listPositions } from './positionService';
import { listPlaystyles } from './playstyleService';
import { listFormations } from './formationService';
import { listSquadsWithDetails, type SquadFull } from './squadService';
import { listWatchlist } from './watchlistService';
import { getBufferMultiplier } from './dashboardService';
import { getProfileById, createProfile } from './profileService';

export interface ProfileExportData {
  version: number;
  exported_at: string;
  profile: {
    nama_save: string;
  };
  positions: { nama: string; sort_order: number }[];
  playstyles: { nama: string; catatan?: string | null }[];
  players: {
    nama: string;
    ovr_current: number;
    status: string;
    status_durasi?: string | null;
    status_mulai?: string | null;
    status_catatan?: string | null;
    positions: string[]; // array of position names
  }[];
  formations: {
    nama_formasi: string;
    slots: {
      position_nama: string;
      slot_label: string;
      coord_x: number;
      coord_y: number;
    }[];
  }[];
  squads: {
    tier_order: number;
    nama_tim: string;
    formation_nama?: string;
    playstyle_nama?: string;
    starters: {
      slot_label: string;
      player_nama?: string;
      is_captain: number;
    }[];
    bench: string[]; // array of player names
  }[];
  watchlist: {
    position_nama: string;
    target_ovr_min?: number | null;
    target_ovr_max?: number | null;
    catatan?: string | null;
    terkait_player_nama?: string | null;
  }[];
  settings: {
    buffer_multiplier: number;
  };
}

/**
 * Export complete profile data into a structured JSON string.
 */
export async function exportProfileToJson(profileId: string): Promise<string> {
  const profile = await getProfileById(profileId);
  if (!profile) throw new Error('Profile not found');

  const [positions, playstyles, players, formations, squads, watchlist, bufferMult] =
    await Promise.all([
      listPositions(profileId),
      listPlaystyles(profileId),
      listPlayers(profileId),
      listFormations(profileId),
      listSquadsWithDetails(profileId),
      listWatchlist(profileId),
      getBufferMultiplier(profileId),
    ]);

  const exportData: ProfileExportData = {
    version: 1,
    exported_at: new Date().toISOString(),
    profile: {
      nama_save: profile.nama_save,
    },
    positions: positions.map((p) => ({ nama: p.nama, sort_order: p.sort_order })),
    playstyles: playstyles.map((ps) => ({ nama: ps.nama, catatan: ps.catatan })),
    players: players.map((pl) => ({
      nama: pl.nama,
      ovr_current: pl.ovr_current,
      status: pl.status,
      status_durasi: pl.status_durasi,
      status_mulai: pl.status_mulai,
      status_catatan: pl.status_catatan,
      positions: pl.positions.map((p) => p.nama),
    })),
    formations: formations.map((f) => ({
      nama_formasi: f.nama_formasi,
      slots: f.slots.map((s) => ({
        position_nama: s.position_nama,
        slot_label: s.slot_label,
        coord_x: s.coord_x,
        coord_y: s.coord_y,
      })),
    })),
    squads: squads.map((sq) => ({
      tier_order: sq.tier_order,
      nama_tim: sq.nama_tim,
      formation_nama: sq.formation_nama,
      playstyle_nama: sq.playstyle_nama,
      starters: sq.starters.map((st) => ({
        slot_label: st.slot_label,
        player_nama: st.player_nama,
        is_captain: st.is_captain,
      })),
      bench: sq.bench.map((b) => b.nama),
    })),
    watchlist: watchlist.map((w) => ({
      position_nama: w.position_nama,
      target_ovr_min: w.target_ovr_min,
      target_ovr_max: w.target_ovr_max,
      catatan: w.catatan,
      terkait_player_nama: w.terkait_player_nama,
    })),
    settings: {
      buffer_multiplier: bufferMult,
    },
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Import a full profile from JSON. Creates a new profile with the imported data.
 */
export async function importProfileFromJson(jsonString: string): Promise<string> {
  const db = await getDatabase();
  const data: ProfileExportData = JSON.parse(jsonString);

  if (!data.profile || !data.profile.nama_save) {
    throw new Error('Format JSON tidak valid: nama profile tidak ditemukan');
  }

  // Create new profile
  const profile = await createProfile(`${data.profile.nama_save} (Import)`);
  const profileId = profile.id;

  // Insert positions
  const posMap = new Map<string, string>(); // name -> id
  for (const pos of data.positions || []) {
    const posId = generateId();
    await db.runAsync(
      'INSERT INTO positions (id, profile_id, nama, sort_order) VALUES (?, ?, ?, ?)',
      posId,
      profileId,
      pos.nama,
      pos.sort_order
    );
    posMap.set(pos.nama.toUpperCase(), posId);
  }

  // Insert playstyles
  const psMap = new Map<string, string>(); // name -> id
  for (const ps of data.playstyles || []) {
    const psId = generateId();
    await db.runAsync(
      'INSERT INTO playstyles (id, profile_id, nama, catatan) VALUES (?, ?, ?, ?)',
      psId,
      profileId,
      ps.nama,
      ps.catatan ?? null
    );
    psMap.set(ps.nama, psId);
  }

  // Insert players & positions
  const playerMap = new Map<string, string>(); // name -> id
  const now = new Date().toISOString();

  for (const pl of data.players || []) {
    const plId = generateId();
    await db.runAsync(
      `INSERT INTO players (id, profile_id, nama, ovr_current, status, status_durasi, status_mulai, status_catatan, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      plId,
      profileId,
      pl.nama,
      pl.ovr_current,
      pl.status,
      pl.status_durasi ?? null,
      pl.status_mulai ?? null,
      pl.status_catatan ?? null,
      now,
      now
    );
    playerMap.set(pl.nama, plId);

    // Positions
    for (let i = 0; i < (pl.positions || []).length; i++) {
      const posName = pl.positions[i].toUpperCase();
      const posId = posMap.get(posName);
      if (posId) {
        const ppId = generateId();
        await db.runAsync(
          'INSERT INTO player_positions (id, player_id, position_id, order_index) VALUES (?, ?, ?, ?)',
          ppId,
          plId,
          posId,
          i
        );
      }
    }
  }

  // Insert formations & slots
  const formMap = new Map<string, { id: string; slotMap: Map<string, string> }>();
  for (const f of data.formations || []) {
    const fId = generateId();
    await db.runAsync(
      'INSERT INTO formations (id, profile_id, nama_formasi) VALUES (?, ?, ?)',
      fId,
      profileId,
      f.nama_formasi
    );

    const slotMap = new Map<string, string>(); // slot_label -> slot_id
    for (const s of f.slots || []) {
      const posId = posMap.get(s.position_nama.toUpperCase());
      if (posId) {
        const slotId = generateId();
        await db.runAsync(
          `INSERT INTO formation_slots (id, formation_id, position_id, slot_label, coord_x, coord_y)
           VALUES (?, ?, ?, ?, ?, ?)`,
          slotId,
          fId,
          posId,
          s.slot_label,
          s.coord_x,
          s.coord_y
        );
        slotMap.set(s.slot_label, slotId);
      }
    }
    formMap.set(f.nama_formasi, { id: fId, slotMap });
  }

  // Insert squads
  for (const sq of data.squads || []) {
    const sqId = generateId();
    const formationData = sq.formation_nama ? formMap.get(sq.formation_nama) : null;
    const playstyleId = sq.playstyle_nama ? psMap.get(sq.playstyle_nama) : null;

    await db.runAsync(
      'INSERT INTO squads (id, profile_id, nama_tim, formation_id, playstyle_id, tier_order) VALUES (?, ?, ?, ?, ?, ?)',
      sqId,
      profileId,
      sq.nama_tim,
      formationData?.id ?? null,
      playstyleId ?? null,
      sq.tier_order
    );

    // Starters
    if (formationData) {
      for (const st of sq.starters || []) {
        const slotId = formationData.slotMap.get(st.slot_label);
        const playerId = st.player_nama ? playerMap.get(st.player_nama) : null;
        if (slotId) {
          const ssId = generateId();
          await db.runAsync(
            'INSERT INTO squad_slots (id, squad_id, formation_slot_id, player_id, is_captain) VALUES (?, ?, ?, ?, ?)',
            ssId,
            sqId,
            slotId,
            playerId ?? null,
            st.is_captain
          );
        }
      }
    }

    // Bench
    for (let i = 0; i < (sq.bench || []).length; i++) {
      const pName = sq.bench[i];
      const pId = playerMap.get(pName);
      if (pId) {
        const bId = generateId();
        await db.runAsync(
          'INSERT INTO squad_bench (id, squad_id, player_id, order_index) VALUES (?, ?, ?, ?)',
          bId,
          sqId,
          pId,
          i
        );
      }
    }
  }

  // Insert watchlist
  for (const w of data.watchlist || []) {
    const posId = posMap.get(w.position_nama.toUpperCase());
    const terkaitId = w.terkait_player_nama ? playerMap.get(w.terkait_player_nama) : null;
    if (posId) {
      const wId = generateId();
      await db.runAsync(
        `INSERT INTO transfer_watchlist (id, profile_id, position_id, target_ovr_min, target_ovr_max, catatan, terkait_player_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        wId,
        profileId,
        posId,
        w.target_ovr_min ?? null,
        w.target_ovr_max ?? null,
        w.catatan ?? null,
        terkaitId ?? null,
        now
      );
    }
  }

  return profileId;
}

/**
 * Format full Team Sheet (Tim 1-4) as clean shareable markdown text.
 */
export async function formatTeamSheetsText(profileId: string): Promise<string> {
  const squads = await listSquadsWithDetails(profileId);

  let text = `⚽ FC 26 CAREER MODE MANAGER — TEAM SHEETS\n`;
  text += `═══════════════════════════════════════════\n\n`;

  for (const sq of squads) {
    text += `📋 ${sq.nama_tim.toUpperCase()} (AVG OVR: ${sq.avg_ovr})\n`;
    text += `Formasi: ${sq.formation_nama || '-'} | Playstyle: ${sq.playstyle_nama || '-'}\n`;
    text += `───────────────────────────────────────────\n`;
    text += `STARTING XI:\n`;

    for (const st of sq.starters) {
      const capt = st.is_captain ? ' (C) ★' : '';
      const pName = st.player_nama ? `${st.player_nama} [${st.player_ovr}]` : '(Kosong)';
      text += `  • ${st.slot_label.padEnd(5)} : ${pName}${capt}\n`;
    }

    text += `\nBENCH (${sq.bench.length}/9):\n`;
    if (sq.bench.length === 0) {
      text += `  (Tidak ada cadangan)\n`;
    } else {
      const benchStr = sq.bench
        .map((b) => `${b.nama} [${b.ovr_current}]`)
        .join(', ');
      text += `  ${benchStr}\n`;
    }
    text += `\n`;
  }

  return text;
}
