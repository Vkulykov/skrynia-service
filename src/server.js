require("dotenv").config();
const path = require("path");
const express = require("express");
const session = require("express-session");
const authRoutes = require("./routes/auth");
const mailRoutes = require("./routes/mail");

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "..", "public")));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "skrynia-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 }
  })
);

app.get("/", (req, res) => {
  if (req.session.userId) return res.redirect("/mail");
  res.render("landing");
});

app.use(authRoutes);
app.use(mailRoutes);

app.use((req, res) => res.status(404).redirect("/"));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Skrynia працює на http://localhost:${port}`);
});
