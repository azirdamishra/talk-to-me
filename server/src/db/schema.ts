import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const DB_PATH = process.env.DB_PATH || './data/alexa-hub.db';

let db: Database.Database | undefined;

export function getDb(): Database.Database {
  if (db) return db;

  if (DB_PATH !== ':memory:') {
    mkdirSync(dirname(DB_PATH), { recursive: true });
  }
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amazon_user_id TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      song TEXT NOT NULL,
      video_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      added_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS queue_user_position ON queue(user_id, position);

    CREATE TABLE IF NOT EXISTS playback_state (
      user_id INTEGER PRIMARY KEY REFERENCES users(id),
      video_id TEXT,
      song TEXT,
      offset_ms INTEGER NOT NULL DEFAULT 0,
      previous_video_id TEXT,
      previous_song TEXT,
      updated_at TEXT NOT NULL
    );
  `);
  return db;
}

// Test-only: forces a fresh in-memory database on the next getDb() call.
export function resetDbForTests(): void {
  db?.close();
  db = undefined;
}
