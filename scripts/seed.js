require("dotenv").config();
const bcrypt = require("bcryptjs");
const db = require("../src/db");

const email = "olena.k@skrynia.ua";
const password = "skrynia123";

if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) {
  console.log(`Демо-користувач уже існує: ${email}`);
  process.exit(0);
}

const userId = db
  .prepare("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)")
  .run("Олена Ковальчук", email, bcrypt.hashSync(password, 10)).lastInsertRowid;

const at = (daysAgo, hours, minutes) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString().slice(0, 19).replace("T", " ");
};

const insert = db.prepare(
  "INSERT INTO messages (owner_id, from_name, from_email, to_email, subject, body, folder, starred, unread, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
);

const inbox = [
  {
    from_name: "Нова пошта",
    from_email: "no-reply@novaposhta.ua",
    subject: "Посилка №2043 прибула у відділення",
    body: "Заберіть відправлення протягом 5 днів.\n\nВідділення №12, вул. Хрещатик, 22.\nГрафік роботи: 9:00–20:00.",
    unread: 1,
    date: at(0, 9, 24)
  },
  {
    from_name: "Тарас Мельник",
    from_email: "t.melnyk@knu.ua",
    subject: "Щодо курсової роботи",
    body: "Доброго дня, Олено!\n\nПереглянув першу частину вашої курсової — структура хороша. У другому розділі варто додати порівняння з наявними рішеннями та розширити висновки.\n\nНадішліть, будь ласка, оновлену версію до п'ятниці.\n\nЗ повагою,\nТарас Мельник",
    unread: 1,
    date: at(1, 16, 40)
  },
  {
    from_name: "Дія",
    from_email: "no-reply@diia.gov.ua",
    subject: "Документ підписано успішно",
    body: "Ваш підпис додано до заяви №118-3.\n\nПереглянути документ можна у застосунку Дія.",
    unread: 1,
    date: at(1, 11, 5)
  },
  {
    from_name: "Марічка Гнатюк",
    from_email: "marichka.h@gmail.com",
    subject: "Світлини з Карпат",
    body: "Привіт!\n\nНарешті розібрала фото з походу, тримай добірку. Найкращі — з Драгобрату на світанку.\n\nОбіймаю,\nМарічка",
    starred: 1,
    date: at(3, 19, 12)
  },
  {
    from_name: "Одеський кінофестиваль",
    from_email: "tickets@oiff.com.ua",
    subject: "Ваші квитки на відкриття",
    body: "Квитки у вкладенні. Початок о 19:00.\n\nЧекаємо на вас у Одеському театрі опери та балету.",
    date: at(4, 14, 30)
  },
  {
    from_name: "Мама",
    from_email: "halyna.kov@ukr.net",
    subject: "Не забудь подзвонити бабусі",
    body: "У неї завтра день народження!\n\nІ приїжджай на вихідні, спечу твій улюблений пиріг.",
    starred: 1,
    date: at(5, 20, 45)
  },
  {
    from_name: "Prom.ua",
    from_email: "news@prom.ua",
    subject: "Знижки тижня на техніку",
    body: "Ноутбуки та навушники до −40%.\n\nАкція діє до неділі.",
    date: at(6, 8, 0)
  },
  {
    from_name: "Українська правда",
    from_email: "digest@pravda.com.ua",
    subject: "Ранковий дайджест",
    body: "Головні новини за сьогодні — у нашому щоденному огляді.",
    date: at(7, 7, 30)
  }
];

for (const m of inbox) {
  insert.run(userId, m.from_name, m.from_email, email, m.subject, m.body, "inbox", m.starred || 0, m.unread || 0, m.date);
}

insert.run(
  userId,
  "Олена Ковальчук",
  email,
  "t.melnyk@knu.ua",
  "Курсова робота — перша частина",
  "Доброго дня, Тарасе Івановичу!\n\nНадсилаю першу частину курсової роботи. Буду вдячна за зауваження.\n\nЗ повагою,\nОлена",
  "sent",
  0,
  0,
  at(8, 15, 10)
);

insert.run(
  userId,
  "Олена Ковальчук",
  email,
  "t.melnyk@knu.ua",
  "Оновлена курсова робота",
  "Доброго дня, Тарасе Івановичу!\n\nНадсилаю оновлену версію курсової з доповненим другим розділом.",
  "drafts",
  0,
  0,
  at(0, 12, 0)
);

const spam = [
  ["Розіграш призів", "win@lottery-prize.biz", "Ви виграли мільйон гривень!!!", "Надішліть свої дані, щоб отримати виграш уже сьогодні."],
  ["Crypto Invest", "offer@crypto-fast.io", "Подвойте свої гроші за тиждень", "Гарантований прибуток без ризику. Лише сьогодні."],
  ["Знайомства поруч", "hello@meet-now.click", "Хтось шукає саме вас", "Перегляньте анкети у вашому місті."]
];

spam.forEach(([name, from, subject, body], i) => {
  insert.run(userId, name, from, email, subject, body, "spam", 0, 1, at(2 + i, 6, 15));
});

console.log("Демо-дані створено.");
console.log(`Адреса: ${email}`);
console.log(`Пароль: ${password}`);
