const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");

const router = express.Router();
const DOMAIN = "skrynia.ua";

function sendWelcome(userId, name, email) {
  const body = [
    `Доброго дня, ${name}!`,
    "",
    `Вашу поштову скриню створено. Тепер у вас є адреса ${email} та 10 ГБ місця для листів.`,
    "",
    "Кілька порад на початок:",
    "— натисніть «Написати», щоб надіслати перший лист;",
    `— листи всередині ${DOMAIN} доставляються миттєво;`,
    "— важливі листи позначайте зірочкою.",
    "",
    "Гарних листів!",
    "Команда Skrynia"
  ].join("\n");
  db.prepare(
    "INSERT INTO messages (owner_id, from_name, from_email, to_email, subject, body, folder, unread) VALUES (?, 'Skrynia', ?, ?, 'Вітаємо у Skrynia!', ?, 'inbox', 1)"
  ).run(userId, `vitannia@${DOMAIN}`, email, body);
}

router.get("/login", (req, res) => {
  if (req.session.userId) return res.redirect("/mail");
  res.render("login", { error: null, email: "" });
});

router.post("/login", (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).render("login", { error: "Невірна адреса або пароль", email });
  }
  req.session.userId = user.id;
  res.redirect("/mail");
});

router.get("/register", (req, res) => {
  if (req.session.userId) return res.redirect("/mail");
  res.render("register", { error: null, name: "", prefix: "" });
});

router.post("/register", (req, res) => {
  const name = String(req.body.name || "").trim();
  const prefix = String(req.body.prefix || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const password2 = String(req.body.password2 || "");

  const fail = (error) => res.status(400).render("register", { error, name, prefix });

  if (!name || name.length > 60) return fail("Вкажіть ваше ім'я");
  if (!/^[a-z0-9][a-z0-9._-]{1,31}$/.test(prefix)) {
    return fail("Адреса: 2–32 символи, латинські літери, цифри, крапка, дефіс");
  }
  if (password.length < 8) return fail("Пароль має містити щонайменше 8 символів");
  if (password !== password2) return fail("Паролі не збігаються");

  const email = `${prefix}@${DOMAIN}`;
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) {
    return fail("Така адреса вже зайнята");
  }

  const userId = db
    .prepare("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)")
    .run(name, email, bcrypt.hashSync(password, 10)).lastInsertRowid;
  sendWelcome(userId, name, email);

  req.session.userId = userId;
  res.redirect("/mail");
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

module.exports = router;
