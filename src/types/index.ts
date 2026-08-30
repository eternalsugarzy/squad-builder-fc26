/**
 * FC26 Career Mode Manager - TypeScript Type Definitions
 * Maps to the SQLite database schema.
 */

// ─── Status Types ───────────────────────────────────────────────
export type PlayerStatus = 'aktif' | 'loan_out' | 'loan_in' | 'injured' | 'akan_dijual' | 'sudah_dijual';
export type StatusDurasi = '6_bulan' | '1_tahun' | '2_tahun';

// ─── Database Row Types ─────────────────────────────────────────

export interface Profile {
  id: string;
  nama_save: string;
  is_active: number; // SQLite boolean (0 or 1)
  created_at: string;
}

export interface Position {
  id: string;
  profile_id: string;
  nama: string;
  sort_order: number;
}

export interface Playstyle {
  id: string;
  profile_id: string;
  nama: string;
  catatan: string | null;
}

export interface Player {
  id: string;
  profile_id: string;
  nama: string;
  ovr_current: number;
  status: PlayerStatus;
  status_durasi: StatusDurasi | null;
  status_mulai: string | null;
  status_catatan: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlayerPosition {
  id: string;
  player_id: string;
  position_id: string;
  order_index: number; // 0 = primary position
}

export interface OvrHistory {
  id: string;
  player_id: string;
  ovr_lama: number;
  ovr_baru: number;
  tanggal: string;
}

export interface Formation {
  id: string;
  profile_id: string;
  nama_formasi: string;
}

export interface FormationSlot {
  id: string;
  formation_id: string;
  position_id: string;
  slot_label: string;
  coord_x: number; // 0-100 percentage
  coord_y: number; // 0-100 percentage, y=0 near own goal
}

export interface Squad {
  id: string;
  profile_id: string;
  nama_tim: string;
  formation_id: string | null;
  playstyle_id: string | null;
  tier_order: number; // 1-4
}

export interface SquadSlot {
  id: string;
  squad_id: string;
  formation_slot_id: string;
  player_id: string | null;
  is_captain: number; // SQLite boolean (0 or 1)
}

export interface SquadBench {
  id: string;
  squad_id: string;
  player_id: string;
  order_index: number;
}

export interface TransferWatchlist {
  id: string;
  profile_id: string;
  nama_target: string | null;
  position_id: string;
  target_ovr_min: number | null;
  target_ovr_max: number | null;
  catatan: string | null;
  terkait_player_id: string | null;
  created_at: string;
}

export interface PositionQuotaSettings {
  profile_id: string;
  buffer_multiplier: number;
}

// ─── Extended / Joined Types ────────────────────────────────────

/** Player with joined position data */
export interface PlayerWithPositions extends Player {
  positions: (Position & { order_index: number })[];
}

/** Formation slot with joined position name */
export interface FormationSlotWithPosition extends FormationSlot {
  position_nama: string;
}

/** Squad slot with player and slot info */
export interface SquadSlotFull extends SquadSlot {
  player_nama?: string;
  player_ovr?: number;
  slot_label: string;
  position_nama: string;
  coord_x: number;
  coord_y: number;
}

/** Position quota comparison (calculated on-the-fly) */
export interface PositionQuota {
  position_id: string;
  position_nama: string;
  kuota_ideal: number;
  jumlah_aktif: number;
  selisih: number; // positive = surplus, negative = deficit
}
