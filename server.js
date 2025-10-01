// server.js
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

// Helpers para generar nombres (fruta/animal + color opcional)
const FRUITS = [
  "Mango","Banano","Papaya","Guayaba","Fresa","Coco","Maracuyá","Uva","Piña","Melón"
];
const ANIMALS = [
  "Zorro","Lobo","Tortuga","Águila","Mono","Gato","Perro","Colibrí","Oso","Liebre"
];
const COLORS = [
  "Azul","Verde","Rojo","Amarillo","Naranja","Violeta","Gris","Café","Rosa","Cyan"
];

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateRandomName(existingSet = new Set()) {
  // Forma: Fruta-Azul o Zorro-Verde
  const source = Math.random() < 0.5 ? FRUITS : ANIMALS;
  let base = `${randomFrom(source)}-${randomFrom(COLORS)}`;
  // asegurar unicidad en el documento
  let suffix = 1;
  while (existingSet.has(base)) {
    base = `${base}-${suffix}`;
    suffix++;
  }
  return base;
}

// Parseador de .pntn v1.1 (formato de texto)
function parsePntn(text) {
  const lines = text.split(/\r?\n/);
  if (!lines[0] || !lines[0].startsWith("#PNTN-DOC")) {
    throw new Error("Formato .pntn inválido (cabecera faltante)");
  }

  // Leer cabecera hasta '---'
  let i = 1;
  const header = {};
  for (; i < lines.length; i++) {
    const l = lines[i].trim();
    if (l === "---") {
      i++;
      break;
    }
    if (!l) continue;
    const sepIdx = l.indexOf(":");
    if (sepIdx === -1) continue;
    const key = l.slice(0, sepIdx).trim();
    const value = l.slice(sepIdx + 1).trim();
    header[key.toLowerCase()] = value;
  }

  // Contenido hasta siguiente '---'
  const contentLines = [];
  for (; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      i++;
      break;
    }
    contentLines.push(lines[i]);
  }
  const content = contentLines.join("\n");

  // Log (opcional)
  const log = [];
  // remaining lines: look for "log:" and then entries
  for (; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l) continue;
    if (l.toLowerCase() === "log:") continue;
    // Expect lines like: [2025-09-26T15:40:00Z] Juancho hizo X
    if (l.startsWith("[") && l.indexOf("]") > 0) {
      const closeIdx = l.indexOf("]");
      const ts = l.slice(1, closeIdx);
      const rest = l.slice(closeIdx + 1).trim();
      log.push({ timestamp: ts, entry: rest });
    } else {
      // fallback: push raw
      log.push({ timestamp: null, entry: l });
    }
  }

  // Build doc object
  const doc = {
    version: header["#pntn-doc"] || header["version"] || "1.1",
    title: header["title"] || "Documento importado",
    authors: header["authors"]
      ? header["authors"].split(",").map(s => s.trim()).filter(Boolean)
      : header["author"]
        ? [header["author"].trim()]
        : [],
    created_at: header["created"] || new Date().toISOString(),
    expires_at: header["expires_at"] || null,
    content: content,
    log: log, // array of {timestamp, entry}
    settings: {}
  };

  return doc;
}

// Serializador a .pntn (v1.1)
function serializePntn(doc) {
  const version = "1.1";
  const title = doc.title || "Documento";
  const authors = (doc.authors && doc.authors.length) ? doc.authors.join(", ") : "Anónimo";
  const created = doc.created_at || new Date().toISOString();
  const content = doc.content || "";
  const log = doc.log || [];

  const lines = [];
  lines.push(`#PNTN-DOC v${version}`);
  lines.push(`title: ${title}`);
  lines.push(`authors: ${authors}`);
  lines.push(`created: ${created}`);
  if (doc.expires_at) {
    lines.push(`expires_at: ${doc.expires_at}`);
  }
  lines.push(`---`);
  lines.push(content);
  lines.push(`---`);
  lines.push(`log:`);
  log.forEach(l => {
    if (l.timestamp) {
      lines.push(`[${l.timestamp}] ${l.entry}`);
    } else {
      lines.push(l.entry);
    }
  });

  return lines.join("\n");
}

// Documentos en memoria
// Estructura: { docId: { version, title, authors:[], created_at, expires_at, content, log:[], settings }}
const documents = new Map();

// Crear documento nuevo
app.get("/new", (req, res) => {
  const id = uuidv4();
  const now = new Date().toISOString();
  documents.set(id, {
    version: "1.1",
    title: "Nuevo Documento",
    created_at: now,
    expires_at: null,
    authors: [],
    content: "",
    log: [],
    settings: { read_only: false, encrypted: false }
  });
  res.redirect(`/doc/${id}`);
});

// Servir editor
app.get("/doc/:id", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "doc.html"));
});

// Descargar documento como .pntn (texto con formato)
app.get("/export/:id", (req, res) => {
  const docId = req.params.id;
  if (!documents.has(docId)) {
    return res.status(404).send("Documento no encontrado");
  }

  const doc = documents.get(docId);
  const filename = `${(doc.title || "documento").replace(/\s+/g, "_")}.pntn`;
  const pntnText = serializePntn(doc);

  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.send(pntnText);
});

// Subir un archivo .pntn para restaurarlo
app.post("/import", upload.single("pntnfile"), (req, res) => {
  try {
    const raw = fs.readFileSync(req.file.path, "utf8");
    const doc = parsePntn(raw);
    const id = uuidv4();

    // Normalize internal structure
    documents.set(id, {
      version: doc.version || "1.1",
      title: doc.title || "Documento importado",
      created_at: doc.created_at || new Date().toISOString(),
      expires_at: doc.expires_at || null,
      authors: Array.isArray(doc.authors) ? doc.authors : [],
      content: doc.content || "",
      log: Array.isArray(doc.log) ? doc.log : [],
      settings: doc.settings || {}
    });

    // Eliminar el archivo temporal
    fs.unlinkSync(req.file.path);

    res.json({ success: true, docId: id });
  } catch (err) {
    console.error("Error importando .pntn:", err);
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(400).json({ success: false, error: "Archivo inválido" });
  }
});

// Socket.io: colaboración en vivo
io.on("connection", (socket) => {
  let currentDoc = null;
  let assignedUser = null;

  socket.on("joinDoc", (docId) => {
    currentDoc = docId;

    if (!documents.has(docId)) {
      const now = new Date().toISOString();
      documents.set(docId, {
        version: "1.1",
        title: "Documento sin título",
        created_at: now,
        expires_at: null,
        authors: [],
        content: "",
        log: [],
        settings: { read_only: false, encrypted: false }
      });
    }

    const doc = documents.get(docId);

    // Asignar usuario aleatorio si no tiene
    // build a Set of existing authors to avoid duplicates
    const existing = new Set(doc.authors || []);
    assignedUser = generateRandomName(existing);
    doc.authors = Array.from(new Set([...(doc.authors || []), assignedUser]));

    // Registrar en log la unión
    const ts = new Date().toISOString();
    doc.log = doc.log || [];
    doc.log.push({ timestamp: ts, entry: `${assignedUser} se unió al documento` });

    // guardar
    documents.set(docId, doc);

    socket.join(docId);

    // Enviar la asignación de usuario al cliente
    socket.emit("assignedUser", assignedUser);

    // Enviar meta y contenido inicial
    socket.emit("docMeta", {
      docId,
      title: doc.title,
      authors: doc.authors,
      created_at: doc.created_at,
      settings: doc.settings
    });

    // Enviamos contenido actual (texto plano)
    socket.emit("update", doc.content);
  });

  // recibir ediciones: puede ser (string) content o { user, content }
  socket.on("edit", (payload) => {
    if (!currentDoc) return;

    const doc = documents.get(currentDoc);
    let user = assignedUser || "anon";
    let content = "";

    if (typeof payload === "string") {
      content = payload;
    } else if (payload && typeof payload === "object") {
      content = payload.content ?? "";
      user = payload.user || user;
    }

    // Update content and log
    const ts = new Date().toISOString();
    doc.content = content;
    doc.authors = Array.from(new Set([...(doc.authors || []), user]));
    doc.log = doc.log || [];
    doc.log.push({ timestamp: ts, entry: `${user} editó el documento` });

    // Save
    documents.set(currentDoc, doc);

    // Broadcast to others in the doc room
    socket.to(currentDoc).emit("update", content);
  });

  socket.on("disconnect", () => {
    // opción: registrar en log la desconexión (no obligatorio)
    if (currentDoc && assignedUser) {
      const doc = documents.get(currentDoc);
      if (doc) {
        const ts = new Date().toISOString();
        doc.log = doc.log || [];
        doc.log.push({ timestamp: ts, entry: `${assignedUser} se desconectó` });
        documents.set(currentDoc, doc);
      }
    }
  });
});

server.listen(8080, () =>
  console.log("Servidor corriendo en http://localhost:8080")
);
