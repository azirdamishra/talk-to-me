import { getDb } from './schema.js';

export interface QueueItem {
  id: number;
  song: string;
  videoId: string;
  position: number;
}

export interface PlaybackState {
  videoId: string | null;
  song: string | null;
  offsetMs: number;
  previousVideoId: string | null;
  previousSong: string | null;
}

export function getOrCreateUser(amazonUserId: string): number {
  const db = getDb();
  const existing = db
    .prepare('SELECT id FROM users WHERE amazon_user_id = ?')
    .get(amazonUserId) as { id: number } | undefined;
  if (existing) return existing.id;

  const result = db
    .prepare('INSERT INTO users (amazon_user_id, created_at) VALUES (?, ?)')
    .run(amazonUserId, new Date().toISOString());
  return Number(result.lastInsertRowid);
}

export function enqueue(userId: number, song: string, videoId: string): void {
  const db = getDb();
  const { nextPosition } = db
    .prepare('SELECT COALESCE(MAX(position), 0) + 1 AS nextPosition FROM queue WHERE user_id = ?')
    .get(userId) as { nextPosition: number };
  db.prepare(
    'INSERT INTO queue (user_id, song, video_id, position, added_at) VALUES (?, ?, ?, ?, ?)',
  ).run(userId, song, videoId, nextPosition, new Date().toISOString());
}

export function peekQueue(userId: number): QueueItem[] {
  const db = getDb();
  return db
    .prepare('SELECT id, song, video_id AS videoId, position FROM queue WHERE user_id = ? ORDER BY position')
    .all(userId) as QueueItem[];
}

export function dequeueNext(userId: number): QueueItem | undefined {
  const db = getDb();
  const item = db
    .prepare(
      'SELECT id, song, video_id AS videoId, position FROM queue WHERE user_id = ? ORDER BY position LIMIT 1',
    )
    .get(userId) as QueueItem | undefined;
  if (item) {
    db.prepare('DELETE FROM queue WHERE id = ?').run(item.id);
  }
  return item;
}

export function getPlaybackState(userId: number): PlaybackState {
  const db = getDb();
  const row = db
    .prepare(
      'SELECT video_id AS videoId, song, offset_ms AS offsetMs, previous_video_id AS previousVideoId, previous_song AS previousSong FROM playback_state WHERE user_id = ?',
    )
    .get(userId) as PlaybackState | undefined;
  return row ?? { videoId: null, song: null, offsetMs: 0, previousVideoId: null, previousSong: null };
}

// Advancing playback (Play/Next/Previous) replaces "current" and pushes the
// old current into "previous", which is what lets AMAZON.PreviousIntent go
// back one step without the queue table needing a second, backward cursor.
export function setCurrentTrack(userId: number, song: string, videoId: string): void {
  const db = getDb();
  const previous = getPlaybackState(userId);
  db.prepare(
    `INSERT INTO playback_state (user_id, video_id, song, offset_ms, previous_video_id, previous_song, updated_at)
     VALUES (?, ?, ?, 0, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       video_id = excluded.video_id,
       song = excluded.song,
       offset_ms = 0,
       previous_video_id = excluded.previous_video_id,
       previous_song = excluded.previous_song,
       updated_at = excluded.updated_at`,
  ).run(userId, videoId, song, previous.videoId, previous.song, new Date().toISOString());
}

export function setPlaybackOffset(userId: number, offsetMs: number): void {
  const db = getDb();
  db.prepare('UPDATE playback_state SET offset_ms = ?, updated_at = ? WHERE user_id = ?').run(
    offsetMs,
    new Date().toISOString(),
    userId,
  );
}
