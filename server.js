import express from "express";
import multer from "multer";
import { randomBytes } from "crypto";
import path from "path";
import fs from "fs";

const app = express();
const PORT = 8080;

// === CONFIGURACIÓN ===
app.use(express.static("public"));
app.use(express.json());

// Configuración de Multer para guardar archivos en /uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// "DB" temporal
let filesDB = {}; 
// { fileId: { filename, pin, expiresAt } }

// === RUTAS ===

// Subir archivo
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No se subió ningún archivo" });
  }

  const fileId = randomBytes(6).toString("hex");
  const pin = Math.floor(1000 + Math.random() * 9000).toString();

  filesDB[fileId] = {
    filename: req.file.filename,
    pin,
    expiresAt: Date.now() + 30 * 60 * 1000
  };

  console.log("📂 Archivo subido:", filesDB[fileId]);
  res.json({ fileId, pin });
});

// Verificar PIN
app.post("/verify", (req, res) => {
  const { pin } = req.body;

  const fileId = Object.keys(filesDB).find(id => filesDB[id].pin === pin);
  if (!fileId) return res.status(404).json({ error: "PIN inválido o archivo no encontrado" });

  const fileEntry = filesDB[fileId];
  if (Date.now() > fileEntry.expiresAt) return res.status(410).json({ error: "Archivo expirado" });

  res.json({ success: true, fileId, filename: fileEntry.filename });
});

// Descargar archivo
app.get("/download/:id", (req, res) => {
  const fileId = req.params.id;
  const fileEntry = filesDB[fileId];

  if (!fileEntry) return res.status(404).send("Archivo no encontrado");
  if (Date.now() > fileEntry.expiresAt) return res.status(410).send("Archivo expirado");

  const filePath = path.join("uploads", fileEntry.filename);
  res.download(filePath, (err) => {
    if (!err) {
      fs.unlink(filePath, () => console.log("🗑️ Archivo eliminado:", fileEntry.filename));
      delete filesDB[fileId];
    }
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
