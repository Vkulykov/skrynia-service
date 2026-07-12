// Чисті допоміжні функції: форматування та валідація.
// Винесені в окремий модуль без побічних ефектів, щоб покрити їх
// юніт-тестами (див. test/format.test.js).

const DOMAIN = "skrynia.ua";

// Ініціали з імені: до двох перших літер слів, у верхньому регістрі.
function initials(name) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
}

// Українська форма множини за числом n.
function plural(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

// Людиночитабельний розмір файлу (Б / КБ / МБ / ГБ), кома як роздільник.
function fmtSize(bytes) {
  if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(1).replace(".", ",") + " ГБ";
  if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(1).replace(".", ",") + " МБ";
  if (bytes >= 1024) return Math.round(bytes / 1024) + " КБ";
  return bytes + " Б";
}

// Короткий уривок тіла листа для списку (одним рядком, до 90 символів).
function snippet(body) {
  return String(body).replace(/\s+/g, " ").trim().slice(0, 90);
}

// Захист параметра "back": лише "folder" або "folder/id", інакше — inbox.
function safeBack(value) {
  return /^[a-z]+(\/\d+)?$/.test(String(value || "")) ? String(value) : "inbox";
}

// Ім'я вкладення з multer приходить у latin1 — повертаємо коректний utf8.
function decodeName(name) {
  return Buffer.from(name, "latin1").toString("utf8");
}

// Префікс адреси при реєстрації: 2–32 символи, латиниця/цифри/._-
function isValidPrefix(prefix) {
  return /^[a-z0-9][a-z0-9._-]{1,31}$/.test(String(prefix || ""));
}

// Спрощена перевірка адреси отримувача листа.
function isValidRecipient(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
}

module.exports = {
  DOMAIN,
  initials,
  plural,
  fmtSize,
  snippet,
  safeBack,
  decodeName,
  isValidPrefix,
  isValidRecipient
};
