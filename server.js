import express from "express";
import multer from "multer";
import { randomBytes } from "crypto";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 8080;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === CONFIGURACIÓN ===
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// Asegurar carpeta uploads
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Configuración de Multer para guardar archivos en /uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// "DB" temporal
let filesDB = {}; 
// { fileId: { filename, pin, expiresAt, attempts } }

// === Función para generar PIN alfanumérico ===
function generatePIN(length = 6) {
  return randomBytes(length)
    .toString("hex")
    .slice(0, length)
    .toUpperCase(); // Ejemplo: "A7F2C9"
}

// === RUTAS ===

// Subir archivo
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No se subió ningún archivo" });
  }

  const fileId = randomBytes(6).toString("hex");
  const pin = generatePIN(6);

  filesDB[fileId] = {
    filename: req.file.filename,
    pin,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutos
    attempts: 0
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

  // Verificar expiración
  if (Date.now() > fileEntry.expiresAt) {
    delete filesDB[fileId];
    return res.status(410).json({ error: "Archivo expirado" });
  }

  // Verificar intentos
  fileEntry.attempts++;
  if (fileEntry.attempts > 2) {
    delete filesDB[fileId];
    return res.status(403).json({ error: "Demasiados intentos fallidos. Archivo bloqueado." });
  }

  res.json({ success: true, fileId, filename: fileEntry.filename });
});

// Descargar archivo
app.get("/download/:id", (req, res) => {
  const fileId = req.params.id;
  const fileEntry = filesDB[fileId];

  if (!fileEntry) return res.status(404).send("Archivo no encontrado");
  if (Date.now() > fileEntry.expiresAt) {
    delete filesDB[fileId];
    return res.status(410).send("Archivo expirado");
  }

  const filePath = path.join(uploadDir, fileEntry.filename);
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
