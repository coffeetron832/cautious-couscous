import express from "express";
import multer from "multer";
import { randomBytes } from "crypto";
import path from "path";
import fs from "fs";

const app = express();
const PORT = 3000;

// Middleware para servir archivos estáticos (public/)
app.use(express.static("public"));
app.use(express.json());

// Configuración de subida con Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Carpeta donde se guardan los archivos
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// Base temporal en memoria (puedes migrar a MongoDB luego)
let filesDB = {}; 
// Estructura: { fileId: { filename, pin, expiresAt } }

// 📌 Ruta para subir archivo
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No se subió ningún archivo" });
  }

  // Generar un ID único para el archivo
  const fileId = randomBytes(6).toString("hex");
  // Generar un PIN de 4 dígitos
  const pin = Math.floor(1000 + Math.random() * 9000).toString();

  // Guardar en "DB" temporal
  filesDB[fileId] = {
    filename: req.file.filename,
    pin,
    expiresAt: Date.now() + 30 * 60 * 1000 // expira en 30 min
  };

  console.log("Archivo subido:", filesDB[fileId]);

  res.json({ fileId, pin });
});

// 📌 Ruta para verificar PIN
app.post("/verify", (req, res) => {
  const { pin } = req.body;

  // Buscar archivo en la "DB" por PIN
  const fileId = Object.keys(filesDB).find(id => filesDB[id].pin === pin);
  if (!fileId) return res.status(404).json({ error: "PIN inválido o archivo no encontrado" });

  const fileEntry = filesDB[fileId];
  if (Date.now() > fileEntry.expiresAt) return res.status(410).json({ error: "Archivo expirado" });

  res.json({ success: true, fileId, filename: fileEntry.filename });
});


// 📌 Ruta para descargar archivo
app.get("/download/:id", (req, res) => {
  const fileId = req.params.id;
  const fileEntry = filesDB[fileId];

  if (!fileEntry) return res.status(404).send("Archivo no encontrado");
  if (Date.now() > fileEntry.expiresAt) return res.status(410).send("Archivo expirado");

  const filePath = path.join("uploads", fileEntry.filename);
  res.download(filePath, (err) => {
    if (!err) {
      // Eliminar archivo después de descargar
      fs.unlink(filePath, () => console.log("Archivo eliminado:", fileEntry.filename));
      delete filesDB[fileId];
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
