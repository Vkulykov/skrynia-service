"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  initials,
  plural,
  fmtSize,
  snippet,
  safeBack,
  decodeName,
  isValidPrefix,
  isValidRecipient
} = require("../src/format");

test("initials: до двох перших літер, верхній регістр", () => {
  assert.equal(initials("Олена Ковальчук"), "ОК");
  assert.equal(initials("тарас мельник петрович"), "ТМ");
  assert.equal(initials("Дія"), "Д");
  assert.equal(initials("  "), "?");
  assert.equal(initials(""), "?");
});

test("plural: українські форми множини", () => {
  const f = (n) => plural(n, "лист", "листи", "листів");
  assert.equal(f(1), "лист");
  assert.equal(f(2), "листи");
  assert.equal(f(4), "листи");
  assert.equal(f(5), "листів");
  assert.equal(f(11), "листів"); // виняток 11–14
  assert.equal(f(12), "листів");
  assert.equal(f(21), "лист");
  assert.equal(f(22), "листи");
  assert.equal(f(25), "листів");
  assert.equal(f(0), "листів");
});

test("fmtSize: людиночитабельний розмір з комою", () => {
  assert.equal(fmtSize(0), "0 Б");
  assert.equal(fmtSize(512), "512 Б");
  assert.equal(fmtSize(1024), "1 КБ");
  assert.equal(fmtSize(1536), "2 КБ"); // округлення
  assert.equal(fmtSize(1024 * 1024), "1,0 МБ");
  assert.equal(fmtSize(5 * 1024 * 1024), "5,0 МБ");
  assert.equal(fmtSize(1024 ** 3), "1,0 ГБ");
  assert.equal(fmtSize(10 * 1024 ** 3), "10,0 ГБ");
});

test("snippet: один рядок, максимум 90 символів", () => {
  assert.equal(snippet("  привіт\n\n  світ  "), "привіт світ");
  assert.equal(snippet("рядок\tз\rрізними   пробілами"), "рядок з різними пробілами");
  const long = "я".repeat(200);
  assert.equal(snippet(long).length, 90);
});

test("safeBack: приймає лише folder або folder/id", () => {
  assert.equal(safeBack("inbox"), "inbox");
  assert.equal(safeBack("sent/42"), "sent/42");
  assert.equal(safeBack("trash/7"), "trash/7");
  assert.equal(safeBack("../etc"), "inbox"); // відкидає підозріле
  assert.equal(safeBack("inbox/abc"), "inbox"); // id має бути числом
  assert.equal(safeBack(""), "inbox");
  assert.equal(safeBack(undefined), "inbox");
});

test("decodeName: latin1 → utf8 (кирилиця у вкладеннях)", () => {
  const original = "Звіт.pdf";
  const asMulterSees = Buffer.from(original, "utf8").toString("latin1");
  assert.equal(decodeName(asMulterSees), original);
});

test("isValidPrefix: правила адреси при реєстрації", () => {
  assert.ok(isValidPrefix("olena.k"));
  assert.ok(isValidPrefix("user-01"));
  assert.ok(isValidPrefix("ab"));
  assert.ok(!isValidPrefix("a")); // закоротка
  assert.ok(!isValidPrefix(".start")); // не з крапки
  assert.ok(!isValidPrefix("Olena")); // без верхнього регістру
  assert.ok(!isValidPrefix("імʼя")); // лише латиниця
  assert.ok(!isValidPrefix("a".repeat(33))); // задовга
  assert.ok(!isValidPrefix(""));
});

test("isValidRecipient: перевірка адреси отримувача", () => {
  assert.ok(isValidRecipient("olena.k@skrynia.ua"));
  assert.ok(isValidRecipient("t.melnyk@knu.ua"));
  assert.ok(!isValidRecipient("без-адреси"));
  assert.ok(!isValidRecipient("no@domain"));
  assert.ok(!isValidRecipient("two @spaces.ua"));
  assert.ok(!isValidRecipient(""));
});
