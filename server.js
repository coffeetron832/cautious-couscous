const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

// Middleware para manejar uploads de .pntn
const upload = multer({ dest: "uploads/" });

// Documentos en memoria
// Estructura: { docId: { content, meta, ... } }
const documents = new Map();

// Crear documento nuevo
app.get("/new", (req, res) => {
  const id = uuidv4();
  documents.set(id, {
    version: "1.0",
    title: "Nuevo Documento",
    created_at: new Date().toISOString(),
    expires_at: null,
    collaborators: [],
    content: [],
    settings: { read_only: false, encrypted: false }
  });
  res.redirect(`/doc/${id}`);
});

// Servir editor
app.get("/doc/:id", (req, res) => {
  res.sendFile(__dirname + "/public/doc.html");
});

// Descargar documento como .pntn
app.get("/export/:id", (req, res) => {
  const docId = req.params.id;
  if (!documents.has(docId)) {
    return res.status(404).send("Documento no encontrado");
  }

  const doc = documents.get(docId);
  const filename = `${doc.title.replace(/\s+/g, "_") || "documento"}.pntn`;

  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(doc, null, 2));
});

// Subir un archivo .pntn para restaurarlo
app.post("/import", upload.single("pntnfile"), (req, res) => {
  try {
    const raw = fs.readFileSync(req.file.path, "utf8");
    const doc = JSON.parse(raw);
    const id = uuidv4();
    documents.set(id, doc);

    // Eliminar el archivo temporal
    fs.unlinkSync(req.file.path);

    res.json({ success: true, docId: id });
  } catch (err) {
    console.error("Error importando .pntn:", err);
    res.status(400).json({ success: false, error: "Archivo inválido" });
  }
});

// Socket.io: colaboración en vivo
io.on("connection", (socket) => {
  let currentDoc = null;

  socket.on("joinDoc", (docId) => {
    currentDoc = docId;

    if (!documents.has(docId)) {
      documents.set(docId, {
        version: "1.0",
        title: "Documento sin título",
        created_at: new Date().toISOString(),
        expires_at: null,
        collaborators: [],
        content: [],
        settings: { read_only: false, encrypted: false }
      });
    }

    socket.join(docId);

    const doc = documents.get(docId);
    socket.emit("update", doc.content.map(b => b.text).join("\n"));
  });

  socket.on("edit", (content) => {
    if (!currentDoc) return;

    const doc = documents.get(currentDoc);
    doc.content.push({
      id: "b" + (doc.content.length + 1),
      author: "anon",
      timestamp: new Date().toISOString(),
      text: content
    });

    // Guardar último estado como texto plano
    documents.set(currentDoc, doc);

    socket.to(currentDoc).emit("update", content);
  });
});

server.listen(8080, () =>
  console.log("Servidor corriendo en http://localhost:8080")
);
