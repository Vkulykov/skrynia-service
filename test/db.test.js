"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");

// Направляємо db.js на тимчасовий файл ще до require — жодних доторків
// до робочої data/skrynia.db.
const tmpFile = path.join(os.tmpdir(), `skrynia-test-${process.pid}-${Date.now()}.db`);
process.env.SKRYNIA_DB = tmpFile;

const db = require("../src/db");

test.after(() => {
  db.close();
  for (const suffix of ["", "-wal", "-shm"]) {
    fs.rmSync(tmpFile + suffix, { force: true });
  }
});

function makeUser(email = "olena.k@skrynia.ua") {
  return db
    .prepare("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)")
    .run("Олена", email, "hash").lastInsertRowid;
}

function makeMessage(ownerId, folder = "inbox", extra = {}) {
  return db
    .prepare(
      "INSERT INTO messages (owner_id, from_name, from_email, to_email, subject, body, folder, starred, unread) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      ownerId,
      extra.from_name || "Хтось",
      extra.from_email || "someone@skrynia.ua",
      extra.to_email || "olena.k@skrynia.ua",
      extra.subject || "Тема",
      extra.body || "Тіло",
      folder,
      extra.starred || 0,
      extra.unread || 0
    ).lastInsertRowid;
}

test("схему створено: users, messages, attachments", () => {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all()
    .map((r) => r.name);
  for (const t of ["users", "messages", "attachments"]) {
    assert.ok(tables.includes(t), `очікували таблицю ${t}`);
  }
});

test("email користувача унікальний", () => {
  makeUser("dup@skrynia.ua");
  assert.throws(() => makeUser("dup@skrynia.ua"), /UNIQUE/);
});

test("folder обмежено CHECK-переліком", () => {
  const uid = makeUser("check@skrynia.ua");
  for (const f of ["inbox", "sent", "drafts", "spam", "trash"]) {
    assert.doesNotThrow(() => makeMessage(uid, f));
  }
  assert.throws(() => makeMessage(uid, "starred"), /CHECK/); // "starred" — віртуальна тека
  assert.throws(() => makeMessage(uid, "невідома"), /CHECK/);
});

test("перемикання зірочки: starred = 1 - starred", () => {
  const uid = makeUser("star@skrynia.ua");
  const mid = makeMessage(uid, "inbox", { starred: 0 });
  const toggle = db.prepare("UPDATE messages SET starred = 1 - starred WHERE id = ?");
  const read = db.prepare("SELECT starred FROM messages WHERE id = ?");

  toggle.run(mid);
  assert.equal(read.get(mid).starred, 1);
  toggle.run(mid);
  assert.equal(read.get(mid).starred, 0);
});

test("видалення користувача каскадно чистить його листи", () => {
  const uid = makeUser("cascade@skrynia.ua");
  makeMessage(uid, "inbox");
  makeMessage(uid, "sent");
  const count = () =>
    db.prepare("SELECT COUNT(*) c FROM messages WHERE owner_id = ?").get(uid).c;

  assert.equal(count(), 2);
  db.prepare("DELETE FROM users WHERE id = ?").run(uid);
  assert.equal(count(), 0);
});

test("видалення листа каскадно чистить вкладення", () => {
  const uid = makeUser("att@skrynia.ua");
  const mid = makeMessage(uid, "inbox");
  db.prepare(
    "INSERT INTO attachments (message_id, original_name, stored_name, size) VALUES (?, ?, ?, ?)"
  ).run(mid, "звіт.pdf", "abc123.pdf", 2048);

  const count = () =>
    db.prepare("SELECT COUNT(*) c FROM attachments WHERE message_id = ?").get(mid).c;
  assert.equal(count(), 1);
  db.prepare("DELETE FROM messages WHERE id = ?").run(mid);
  assert.equal(count(), 0);
});
