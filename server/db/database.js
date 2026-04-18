import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'microsite.db');

let db;

export async function initDB() {
  const SQL = await initSqlJs();

  // Load existing database if it exists
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      s3_key TEXT,
      s3_url TEXT,
      local_path TEXT,
      face_ids TEXT DEFAULT '[]',
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS snippets (
      id TEXT PRIMARY KEY,
      type TEXT CHECK(type IN ('keynote', 'panel')) NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      speaker_name TEXT,
      s3_key TEXT,
      s3_url TEXT,
      local_path TEXT,
      thumbnail_s3_key TEXT,
      thumbnail_url TEXT,
      thumbnail_local_path TEXT,
      duration_seconds REAL,
      start_time TEXT,
      end_time TEXT,
      source_video_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS source_videos (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      s3_key TEXT,
      s3_url TEXT,
      local_path TEXT,
      type TEXT,
      transcript TEXT,
      status TEXT DEFAULT 'uploaded',
      error_message TEXT,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      processed_at DATETIME
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS couple_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      selfie_path TEXT,
      matched_photo_ids TEXT DEFAULT '[]',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  saveDB();
  console.log('✅ Database initialized');
  return db;
}

/**
 * Persist the in-memory database to disk
 */
export function saveDB() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

/**
 * Get the database instance
 */
export function getDB() {
  if (!db) {
    throw new Error('Database not initialized. Call initDB() first.');
  }
  return db;
}

/**
 * Helper: Run an INSERT/UPDATE/DELETE statement with params
 */
export function dbRun(sql, params = []) {
  db.run(sql, params);
  saveDB();
}

/**
 * Helper: Get all rows from a SELECT
 */
export function dbAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);

  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

/**
 * Helper: Get a single row from a SELECT
 */
export function dbGet(sql, params = []) {
  const results = dbAll(sql, params);
  return results.length > 0 ? results[0] : null;
}
