const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

// Шлях до бази можна перевизначити через SKRYNIA_DB (використовується у тестах,
// напр. окремий тимчасовий файл або ":memory:"). За замовчуванням — data/skrynia.db.
const dbPath = process.env.SKRYNIA_DB || path.join(__dirname, "..", "data", "skrynia.db");
if (dbPath !== ":memory:") {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_name TEXT NOT NULL,
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  folder TEXT NOT NULL CHECK (folder IN ('inbox', 'sent', 'drafts', 'spam', 'trash')),
  starred INTEGER NOT NULL DEFAULT 0,
  unread INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  size INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_owner_folder ON messages(owner_id, folder);
`);

module.exports = db;
