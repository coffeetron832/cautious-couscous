const express = require("express");
const fs = require("fs-extra");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const nodemailer = require("nodemailer");

const app = express();
const PORT = 8080;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

const usersFile = path.join(__dirname, "data/users.json");
const mailsFile = path.join(__dirname, "data/mails.json");

fs.ensureFileSync(usersFile);
fs.ensureFileSync(mailsFile);

// Helper para leer/escribir archivos
const readJSON = (file) => (fs.existsSync(file) ? fs.readJSONSync(file) : []);
const writeJSON = (file, data) => fs.writeJSONSync(file, data, { spaces: 2 });

// === Configuración Nodemailer ===
// Usa variables de entorno para no exponer tu correo en el código
const transporter = nodemailer.createTransport({
  service: "gmail", // también puede ser "outlook", "yahoo", "smtp.ethereal.email", etc.
  auth: {
    user: process.env.MAIL_USER, // tu correo real
    pass: process.env.MAIL_PASS  // tu contraseña de aplicación
  }
});

// Registro de usuario
app.post("/api/register", (req, res) => {
  const { username, password } = req.body;
  const users = readJSON(usersFile);

  if (users.find((u) => u.username === username)) {
    return res.status(400).json({ error: "Usuario ya existe" });
  }

  users.push({ username, password });
  writeJSON(usersFile, users);

  res.json({ message: "Cuenta creada", email: `${username}@mailp.com` });
});

// Login
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const users = readJSON(usersFile);

  const user = users.find(
    (u) => u.username === username && u.password === password
  );

  if (!user) {
    return res.status(401).json({ error: "Credenciales inválidas" });
  }

  res.json({ message: "Login exitoso", email: `${username}@mailp.com` });
});

// Bandeja de entrada
app.get("/api/inbox/:username", (req, res) => {
  const { username } = req.params;
  const mails = readJSON(mailsFile);

  const inbox = mails.filter((m) => m.to === `${username}@mailp.com`);
  res.json(inbox);
});

// Enviar correo interno
app.post("/api/send", (req, res) => {
  const { from, to, subject, body } = req.body;
  const mails = readJSON(mailsFile);

  const mail = { id: Date.now(), from, to, subject, body, date: new Date() };
  mails.push(mail);
  writeJSON(mailsFile, mails);

  res.json({ message: "Correo interno enviado", mail });
});

// Enviar correo externo con Nodemailer
app.post("/api/send-external", async (req, res) => {
  const { from, to, subject, body } = req.body;

  try {
    const info = await transporter.sendMail({
      from: `"MailPonton" <${from}>`,
      to,
      subject,
      text: body
    });

    res.json({ message: "Correo externo enviado", info });
  } catch (err) {
    console.error("Error enviando correo externo:", err);
    res.status(500).json({ error: "No se pudo enviar el correo externo" });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
