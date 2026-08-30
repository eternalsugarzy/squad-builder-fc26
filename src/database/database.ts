/**
 * FC26 Career Mode Manager - Database Connection (Singleton)
 * Uses expo-sqlite for local SQLite database.
 */

import * as SQLite from 'expo-sqlite';
import { CREATE_TABLES_SQL, CREATE_INDEXES_SQL, SCHEMA_VERSION } from './schema';

let db: SQLite.SQLiteDatabase | null = null;

const DB_NAME = 'fc26_career_manager.db';

/**
 * Get the database instance (singleton).
 * Opens the database and runs migrations on first call.
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;

  db = await SQLite.openDatabaseAsync(DB_NAME);

  // Enable WAL mode for better performance
  await db.execAsync('PRAGMA journal_mode = WAL;');
  // Enable foreign keys
  await db.execAsync('PRAGMA foreign_keys = ON;');

  // Run migrations
  await runMigrations(db);

  return db;
}

/**
 * Run database migrations.
 * Creates all tables if they don't exist, applies schema updates.
 */
async function runMigrations(database: SQLite.SQLiteDatabase): Promise<void> {
  // Check current schema version
  await database.execAsync(
    `CREATE TABLE IF NOT EXISTS _schema_version (version INTEGER NOT NULL);`
  );

  const versionRow = await database.getFirstAsync<{ version: number }>(
    'SELECT version FROM _schema_version LIMIT 1'
  );

  const currentVersion = versionRow?.version ?? 0;

  if (currentVersion < SCHEMA_VERSION) {
    // Create all tables
    for (const sql of CREATE_TABLES_SQL) {
      await database.execAsync(sql);
    }

    // Create indexes
    for (const sql of CREATE_INDEXES_SQL) {
      await database.execAsync(sql);
    }

    // Specific migration steps
    if (currentVersion > 0 && currentVersion < 2) {
      try {
        await database.execAsync('ALTER TABLE transfer_watchlist ADD COLUMN nama_target TEXT;');
      } catch (e) {
        // column may already exist
      }
    }

    // Update schema version
    if (currentVersion === 0) {
      await database.runAsync(
        'INSERT INTO _schema_version (version) VALUES (?)',
        SCHEMA_VERSION
      );
    } else {
      await database.runAsync(
        'UPDATE _schema_version SET version = ?',
        SCHEMA_VERSION
      );
    }

    console.log(`[DB] Migrated to schema version ${SCHEMA_VERSION}`);
  } else {
    console.log(`[DB] Schema version ${currentVersion} is up to date`);
  }
}

/**
 * Close the database connection.
 */
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}

/**
 * Generate a UUID v4 for use as primary key.
 */
export function generateId(): string {
  // Simple UUID v4 implementation without external dependency
  // This avoids issues with uuid package in React Native
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
