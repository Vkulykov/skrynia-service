const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const multer = require("multer");
const db = require("../db");
const { sendExternal } = require("../mailer");
const {
  initials,
  plural,
  fmtSize,
  snippet,
  safeBack,
  decodeName,
  isValidRecipient
} = require("../format");

const router = express.Router();
const DOMAIN = "skrynia.ua";
const QUOTA = 10 * 1024 * 1024 * 1024;

const uploadsDir = path.join(__dirname, "..", "..", "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) =>
      cb(null, crypto.randomBytes(8).toString("hex") + path.extname(file.originalname))
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 }
});

const FOLDERS = [
  { key: "inbox", name: "Вхідні" },
  { key: "sent", name: "Надіслані" },
  { key: "drafts", name: "Чернетки" },
  { key: "starred", name: "Важливі" },
  { key: "spam", name: "Спам" },
  { key: "trash", name: "Кошик" }
];

const MONTHS = ["січ", "лют", "бер", "кві", "тра", "чер", "лип", "сер", "вер", "жов", "лис", "гру"];

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.redirect("/login");
  req.user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.session.userId);
  if (!req.user) return req.session.destroy(() => res.redirect("/login"));
  next();
}

function parseDate(s) {
  return new Date(s.replace(" ", "T") + "Z");
}

function shortTime(s) {
  const d = parseDate(s);
  const now = new Date();
  const dayStart = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((dayStart(now) - dayStart(d)) / 86400000);
  if (days === 0) return d.toTimeString().slice(0, 5);
  if (days === 1) return "Вчора";
  const year = d.getFullYear() === now.getFullYear() ? "" : ` ${d.getFullYear()}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${year}`;
}

function longTime(s) {
  const d = parseDate(s);
  const now = new Date();
  const year = d.getFullYear() === now.getFullYear() ? "" : ` ${d.getFullYear()}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${year}, ${d.toTimeString().slice(0, 5)}`;
}

function quote(m) {
  const quoted = String(m.body).split("\n").map((line) => "> " + line).join("\n");
  return `\n\n${longTime(m.created_at)}, ${m.from_name} <${m.from_email}>:\n${quoted}`;
}

function setFlash(req, type, text, link) {
  req.session.flash = { type, text, link: link || null };
}

function saveAttachments(messageId, files) {
  const ins = db.prepare(
    "INSERT INTO attachments (message_id, original_name, stored_name, size) VALUES (?, ?, ?, ?)"
  );
  for (const f of files) ins.run(messageId, decodeName(f.originalname), f.filename, f.size);
}

function copyAttachments(fromId, toId) {
  const rows = db.prepare("SELECT * FROM attachments WHERE message_id = ?").all(fromId);
  const ins = db.prepare(
    "INSERT INTO attachments (message_id, original_name, stored_name, size) VALUES (?, ?, ?, ?)"
  );
  for (const r of rows) ins.run(toId, r.original_name, r.stored_name, r.size);
}

router.get("/mail", requireAuth, (req, res) => res.redirect("/mail/inbox"));

router.get("/mail/:folder/:id?", requireAuth, (req, res) => {
  const folderKey = req.params.folder;
  if (!FOLDERS.some((f) => f.key === folderKey)) return res.redirect("/mail/inbox");

  const q = String(req.query.q || "").trim();
  const userId = req.user.id;

  let sel = null;
  let compose = { open: false, to: "", subject: "", body: "", draftId: null };

  if (req.params.id) {
    const msg = db
      .prepare("SELECT * FROM messages WHERE id = ? AND owner_id = ?")
      .get(req.params.id, userId);
    const matches =
      msg &&
      (folderKey === "starred"
        ? msg.starred === 1 && msg.folder !== "trash"
        : msg.folder === folderKey);
    if (matches) {
      if (msg.folder === "drafts") {
        compose = { open: true, to: msg.to_email, subject: msg.subject, body: msg.body, draftId: msg.id };
      } else {
        if (msg.unread) {
          db.prepare("UPDATE messages SET unread = 0 WHERE id = ?").run(msg.id);
          msg.unread = 0;
        }
        sel = msg;
      }
    }
  }

  const mode = req.query.compose;
  if (sel && mode === "reply") {
    const to = sel.folder === "sent" ? sel.to_email : sel.from_email;
    const subject = /^Re:/i.test(sel.subject) ? sel.subject : "Re: " + sel.subject;
    compose = { open: true, to, subject, body: quote(sel), draftId: null };
  } else if (sel && mode === "forward") {
    const subject = /^Fwd:/i.test(sel.subject) ? sel.subject : "Fwd: " + sel.subject;
    compose = { open: true, to: "", subject, body: quote(sel), draftId: null };
  }

  const params = [userId];
  let where;
  if (folderKey === "starred") {
    where = "owner_id = ? AND starred = 1 AND folder != 'trash'";
  } else {
    where = "owner_id = ? AND folder = ?";
    params.push(folderKey);
  }
  if (q) {
    where += " AND (from_name LIKE ? OR from_email LIKE ? OR to_email LIKE ? OR subject LIKE ? OR body LIKE ?)";
    const like = `%${q}%`;
    params.push(like, like, like, like, like);
  }
  const messages = db
    .prepare(`SELECT * FROM messages WHERE ${where} ORDER BY created_at DESC, id DESC`)
    .all(...params);

  const counts = {
    inbox: db.prepare("SELECT COUNT(*) c FROM messages WHERE owner_id = ? AND folder = 'inbox' AND unread = 1").get(userId).c,
    drafts: db.prepare("SELECT COUNT(*) c FROM messages WHERE owner_id = ? AND folder = 'drafts'").get(userId).c,
    spam: db.prepare("SELECT COUNT(*) c FROM messages WHERE owner_id = ? AND folder = 'spam'").get(userId).c
  };

  const used = db
    .prepare("SELECT COALESCE(SUM(a.size), 0) s FROM attachments a JOIN messages m ON m.id = a.message_id WHERE m.owner_id = ?")
    .get(userId).s;

  const n = messages.length;
  let subtitle;
  if (q) {
    subtitle = `знайдено ${n}`;
  } else if (folderKey === "inbox" && counts.inbox > 0) {
    subtitle = `${counts.inbox} ${plural(counts.inbox, "непрочитаний", "непрочитані", "непрочитаних")}`;
  } else {
    subtitle = `${n} ${plural(n, "лист", "листи", "листів")}`;
  }

  const flash = req.session.flash || null;
  delete req.session.flash;

  res.render("mail", {
    user: req.user,
    userInitials: initials(req.user.name),
    folders: FOLDERS.map((f) => ({ ...f, count: counts[f.key] || 0 })),
    activeFolder: folderKey,
    folderName: FOLDERS.find((f) => f.key === folderKey).name,
    subtitle,
    q,
    messages: messages.map((m) => ({ ...m, time: shortTime(m.created_at), snip: snippet(m.body) })),
    sel: sel
      ? {
          ...sel,
          date: longTime(sel.created_at),
          fromInitials: initials(sel.from_name),
          files: db
            .prepare("SELECT * FROM attachments WHERE message_id = ?")
            .all(sel.id)
            .map((f) => ({ ...f, sizeLabel: fmtSize(f.size) }))
        }
      : null,
    compose,
    storage: {
      label: `${fmtSize(used)} із 10 ГБ`,
      percent: Math.min(100, Math.round((used / QUOTA) * 100))
    },
    flash
  });
});

router.post("/mail/send", requireAuth, (req, res) => {
  upload.array("files")(req, res, async (err) => {
    if (err) {
      setFlash(req, "err", err.code === "LIMIT_FILE_SIZE" ? "Файл завеликий — до 5 МБ" : "Не вдалося завантажити файли");
      return res.redirect("/mail/inbox");
    }
    const to = String(req.body.to || "").trim().toLowerCase();
    const subject = String(req.body.subject || "").trim() || "(без теми)";
    const body = String(req.body.body || "");
    const files = req.files || [];

    if (!isValidRecipient(to)) {
      files.forEach((f) => fs.unlink(f.path, () => {}));
      setFlash(req, "err", "Вкажіть коректну адресу отримувача");
      return res.redirect("/mail/inbox");
    }

    const insert = db.prepare(
      "INSERT INTO messages (owner_id, from_name, from_email, to_email, subject, body, folder, unread) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    const sentId = insert.run(req.user.id, req.user.name, req.user.email, to, subject, body, "sent", 0).lastInsertRowid;
    saveAttachments(sentId, files);

    if (req.body.draftId) {
      db.prepare("DELETE FROM messages WHERE id = ? AND owner_id = ? AND folder = 'drafts'").run(req.body.draftId, req.user.id);
    }

    if (to.endsWith("@" + DOMAIN)) {
      const recipient = db.prepare("SELECT * FROM users WHERE email = ?").get(to);
      if (recipient) {
        const inboxId = insert.run(recipient.id, req.user.name, req.user.email, to, subject, body, "inbox", 1).lastInsertRowid;
        copyAttachments(sentId, inboxId);
        setFlash(req, "ok", "Лист надіслано");
      } else {
        setFlash(req, "err", `Скриньки ${to} не існує`);
      }
    } else {
      try {
        const preview = await sendExternal({
          fromName: req.user.name,
          fromEmail: req.user.email,
          to,
          subject,
          text: body,
          attachments: files.map((f) => ({ filename: decodeName(f.originalname), path: f.path }))
        });
        setFlash(req, "ok", "Лист надіслано", preview);
      } catch (e) {
        setFlash(req, "err", "Не вдалося надіслати лист через SMTP");
      }
    }

    res.redirect("/mail/sent/" + sentId);
  });
});

router.post("/mail/draft", requireAuth, (req, res) => {
  upload.array("files")(req, res, () => {
    (req.files || []).forEach((f) => fs.unlink(f.path, () => {}));
    const to = String(req.body.to || "").trim();
    const subject = String(req.body.subject || "").trim();
    const body = String(req.body.body || "");
    if (req.body.draftId) {
      db.prepare("UPDATE messages SET to_email = ?, subject = ?, body = ? WHERE id = ? AND owner_id = ? AND folder = 'drafts'")
        .run(to, subject, body, req.body.draftId, req.user.id);
    } else {
      db.prepare("INSERT INTO messages (owner_id, from_name, from_email, to_email, subject, body, folder, unread) VALUES (?, ?, ?, ?, ?, ?, 'drafts', 0)")
        .run(req.user.id, req.user.name, req.user.email, to, subject, body);
    }
    setFlash(req, "ok", "Чернетку збережено");
    res.redirect("/mail/drafts");
  });
});

router.post("/mail/:id/trash", requireAuth, (req, res) => {
  db.prepare("UPDATE messages SET folder = 'trash' WHERE id = ? AND owner_id = ?").run(req.params.id, req.user.id);
  res.redirect("/mail/" + safeBack(req.body.back).split("/")[0]);
});

router.post("/mail/:id/delete", requireAuth, (req, res) => {
  const msg = db.prepare("SELECT * FROM messages WHERE id = ? AND owner_id = ? AND folder = 'trash'").get(req.params.id, req.user.id);
  if (msg) {
    const files = db.prepare("SELECT * FROM attachments WHERE message_id = ?").all(msg.id);
    db.prepare("DELETE FROM messages WHERE id = ?").run(msg.id);
    for (const f of files) {
      const still = db.prepare("SELECT COUNT(*) c FROM attachments WHERE stored_name = ?").get(f.stored_name).c;
      if (!still) fs.unlink(path.join(uploadsDir, f.stored_name), () => {});
    }
  }
  res.redirect("/mail/trash");
});

router.post("/mail/:id/spam", requireAuth, (req, res) => {
  const msg = db.prepare("SELECT * FROM messages WHERE id = ? AND owner_id = ?").get(req.params.id, req.user.id);
  if (msg) {
    const target = msg.folder === "spam" ? "inbox" : "spam";
    db.prepare("UPDATE messages SET folder = ? WHERE id = ?").run(target, msg.id);
  }
  res.redirect("/mail/" + safeBack(req.body.back).split("/")[0]);
});

router.post("/mail/:id/star", requireAuth, (req, res) => {
  db.prepare("UPDATE messages SET starred = 1 - starred WHERE id = ? AND owner_id = ?").run(req.params.id, req.user.id);
  res.redirect("/mail/" + safeBack(req.body.back));
});

router.get("/attachments/:id", requireAuth, (req, res) => {
  const file = db
    .prepare("SELECT a.* FROM attachments a JOIN messages m ON m.id = a.message_id WHERE a.id = ? AND m.owner_id = ?")
    .get(req.params.id, req.user.id);
  if (!file) return res.status(404).send("Не знайдено");
  res.download(path.join(uploadsDir, file.stored_name), file.original_name);
});

module.exports = router;
