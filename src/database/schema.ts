/**
 * FC26 Career Mode Manager - Database Schema
 * All tables are scoped to profile_id for multi-profile isolation.
 */

export const SCHEMA_VERSION = 2;

export const CREATE_TABLES_SQL = [
  // Profiles - top-level entity
  `CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    nama_save TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

  // Positions - scoped to profile
  `CREATE TABLE IF NOT EXISTS positions (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    nama TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
  );`,

  // Playstyles - scoped to profile
  `CREATE TABLE IF NOT EXISTS playstyles (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    nama TEXT NOT NULL,
    catatan TEXT,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
  );`,

  // Players - scoped to profile
  `CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    nama TEXT NOT NULL,
    ovr_current INTEGER NOT NULL DEFAULT 50,
    status TEXT NOT NULL DEFAULT 'aktif',
    status_durasi TEXT,
    status_mulai TEXT,
    status_catatan TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
  );`,

  // Player-Positions many-to-many (order_index=0 is primary position)
  `CREATE TABLE IF NOT EXISTS player_positions (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL,
    position_id TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE CASCADE
  );`,

  // OVR History - tracks OVR changes over time
  `CREATE TABLE IF NOT EXISTS ovr_history (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL,
    ovr_lama INTEGER NOT NULL,
    ovr_baru INTEGER NOT NULL,
    tanggal TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
  );`,

  // Formations - scoped to profile
  `CREATE TABLE IF NOT EXISTS formations (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    nama_formasi TEXT NOT NULL,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
  );`,

  // Formation Slots - positions within a formation
  `CREATE TABLE IF NOT EXISTS formation_slots (
    id TEXT PRIMARY KEY,
    formation_id TEXT NOT NULL,
    position_id TEXT NOT NULL,
    slot_label TEXT NOT NULL,
    coord_x REAL NOT NULL DEFAULT 50,
    coord_y REAL NOT NULL DEFAULT 50,
    FOREIGN KEY (formation_id) REFERENCES formations(id) ON DELETE CASCADE,
    FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE CASCADE
  );`,

  // Squads (Tim 1-4 per profile)
  `CREATE TABLE IF NOT EXISTS squads (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    nama_tim TEXT NOT NULL,
    formation_id TEXT,
    playstyle_id TEXT,
    tier_order INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (formation_id) REFERENCES formations(id) ON DELETE SET NULL,
    FOREIGN KEY (playstyle_id) REFERENCES playstyles(id) ON DELETE SET NULL
  );`,

  // Squad Slots - starter XI assignment
  `CREATE TABLE IF NOT EXISTS squad_slots (
    id TEXT PRIMARY KEY,
    squad_id TEXT NOT NULL,
    formation_slot_id TEXT NOT NULL,
    player_id TEXT,
    is_captain INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (squad_id) REFERENCES squads(id) ON DELETE CASCADE,
    FOREIGN KEY (formation_slot_id) REFERENCES formation_slots(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL
  );`,

  // Squad Bench - bench players (ordered)
  `CREATE TABLE IF NOT EXISTS squad_bench (
    id TEXT PRIMARY KEY,
    squad_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (squad_id) REFERENCES squads(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
  );`,

  // Transfer Watchlist
  `CREATE TABLE IF NOT EXISTS transfer_watchlist (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    nama_target TEXT,
    position_id TEXT NOT NULL,
    target_ovr_min INTEGER,
    target_ovr_max INTEGER,
    catatan TEXT,
    terkait_player_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE CASCADE,
    FOREIGN KEY (terkait_player_id) REFERENCES players(id) ON DELETE SET NULL
  );`,

  // Position Quota Settings - per profile
  `CREATE TABLE IF NOT EXISTS position_quota_settings (
    profile_id TEXT PRIMARY KEY,
    buffer_multiplier REAL NOT NULL DEFAULT 1.5,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
  );`,
];

// Indexes for common queries
export const CREATE_INDEXES_SQL = [
  `CREATE INDEX IF NOT EXISTS idx_positions_profile ON positions(profile_id);`,
  `CREATE INDEX IF NOT EXISTS idx_playstyles_profile ON playstyles(profile_id);`,
  `CREATE INDEX IF NOT EXISTS idx_players_profile ON players(profile_id);`,
  `CREATE INDEX IF NOT EXISTS idx_players_status ON players(status);`,
  `CREATE INDEX IF NOT EXISTS idx_player_positions_player ON player_positions(player_id);`,
  `CREATE INDEX IF NOT EXISTS idx_player_positions_position ON player_positions(position_id);`,
  `CREATE INDEX IF NOT EXISTS idx_ovr_history_player ON ovr_history(player_id);`,
  `CREATE INDEX IF NOT EXISTS idx_formations_profile ON formations(profile_id);`,
  `CREATE INDEX IF NOT EXISTS idx_formation_slots_formation ON formation_slots(formation_id);`,
  `CREATE INDEX IF NOT EXISTS idx_squads_profile ON squads(profile_id);`,
  `CREATE INDEX IF NOT EXISTS idx_squad_slots_squad ON squad_slots(squad_id);`,
  `CREATE INDEX IF NOT EXISTS idx_squad_bench_squad ON squad_bench(squad_id);`,
  `CREATE INDEX IF NOT EXISTS idx_watchlist_profile ON transfer_watchlist(profile_id);`,
];
