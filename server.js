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
  for (; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l) continue;
    if (l.toLowerCase() === "log:") continue;
    if (l.startsWith("[") && l.indexOf("]") > 0) {
      const closeIdx = l.indexOf("]");
      const ts = l.slice(1, closeIdx);
      const rest = l.slice(closeIdx + 1).trim();
      log.push({ timestamp: ts, entry: rest });
    } else {
      log.push({ timestamp: null, entry: l });
    }
  }

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
    log: log,
    settings: {}
  };

  return doc;
}

// Serializador a .pntn (v1.1) — genera log **resumido** a partir de activity + events
function serializePntn(doc) {
  const version = "1.1";
  const title = doc.title || "Documento";
  const authors = (doc.authors && doc.authors.length) ? doc.authors.join(", ") : "Anónimo";
  const created = doc.created_at || new Date().toISOString();
  const content = doc.content || "";

  // build summarized log:
  // doc.activity: { user: { edits, joins, disconnects, lastTs } }
  const activity = doc.activity || {};
  const events = doc.events || []; // raw join/disconnect events (optional)

  const logLines = [];

  // Include raw events first (join/disconnect explicit messages), keep order
  events.forEach(ev => {
    if (ev && ev.timestamp && ev.entry) {
      logLines.push({ ts: ev.timestamp, text: ev.entry });
    }
  });

  // Then include per-user summarized lines (edits / joins / disconnects)
  Object.keys(activity).forEach(user => {
    const a = activity[user];
    const parts = [];
    if (a.edits && a.edits > 0) parts.push(`${a.edits} edición${a.edits > 1 ? "es" : ""}`);
    if (a.joins && a.joins > 0) parts.push(`${a.joins} entrada${a.joins > 1 ? "s" : ""}`);
    if (a.disconnects && a.disconnects > 0) parts.push(`${a.disconnects} desconexión${a.disconnects > 1 ? "es" : ""}`);
    const lastTs = a.lastTs || created;
    if (parts.length > 0) {
      const dateOnly = (new Date(lastTs)).toISOString().slice(0,10);
      logLines.push({ ts: dateOnly, text: `${user} realizó: ${parts.join(", ")}` });
    }
  });

  // sort logLines by ts (descending recent first)
  logLines.sort((a,b) => (a.ts > b.ts ? -1 : a.ts < b.ts ? 1 : 0));

  // Flatten into final lines
  const finalLog = logLines.map(l => `[${l.ts}] ${l.text}`);

  // build the textual .pntn
  const lines = [];
  lines.push(`#PNTN-DOC v${version}`);
  lines.push(`title: ${title}`);
  lines.push(`authors: ${authors}`);
  lines.push(`created: ${created}`);
  if (doc.expires_at) lines.push(`expires_at: ${doc.expires_at}`);
  lines.push(`---`);
  lines.push(content);
  lines.push(`---`);
  lines.push(`log:`);
  if (finalLog.length === 0) {
    lines.push(`(no hay actividad registrada)`);
  } else {
    finalLog.forEach(l => lines.push(l));
  }

  return lines.join("\n");
}

// Documentos en memoria
// Estructura: { docId: { version, title, authors:[], created_at, expires_at, content, activity:{}, events:[], participants: Map(socketId->username), settings }}
const documents = new Map();

// Crear documento nuevo
app.get("/new", (req, res) => {
  const id = uuidv4();
  const now = new Date().toISOString();
  documents.set(id, {
    version: "1.1",
    title: "Documento sin título",
    created_at: now,
    expires_at: null,
    authors: [],
    content: "",
    activity: {},
    events: [],
    participants: new Map(), // socketId -> username
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
    const docParsed = parsePntn(raw);
    const id = uuidv4();

    // Normalize internal structure
    documents.set(id, {
      version: docParsed.version || "1.1",
      title: docParsed.title || "Documento importado",
      created_at: docParsed.created_at || new Date().toISOString(),
      expires_at: docParsed.expires_at || null,
      authors: Array.isArray(docParsed.authors) ? docParsed.authors : [],
      content: docParsed.content || "",
      activity: {}, // reset activity on import (we keep parsed log only if needed)
      events: Array.isArray(docParsed.log) ? docParsed.log.map(l => ({ timestamp: l.timestamp, entry: l.entry })) : [],
      participants: new Map(),
      settings: docParsed.settings || {}
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
  // track current doc id and username in socket.data
  socket.data.currentDoc = null;
  socket.data.username = null;

  // joinDoc expects either: joinDoc(docId) or joinDoc({ docId, username })
  socket.on("joinDoc", (payload) => {
    let docId;
    let username;
    if (typeof payload === "string") {
      docId = payload;
    } else if (payload && typeof payload === "object") {
      docId = payload.docId;
      username = (payload.username || "").trim();
    }

    if (!docId) return socket.emit("errorMsg", "docId faltante al unir.");

    // ensure doc exists
    if (!documents.has(docId)) {
      const now = new Date().toISOString();
      documents.set(docId, {
        version: "1.1",
        title: "Documento sin título",
        created_at: now,
        expires_at: null,
        authors: [],
        content: "",
        activity: {},
        events: [],
        participants: new Map(),
        log: [],
        settings: { read_only: false, encrypted: false }
      });
    }

    const doc = documents.get(docId);

    // if username missing => fallback to "Anónimo-<short>"
    if (!username) {
      username = `Anónimo-${Math.random().toString(36).slice(2,7)}`;
    }

    // store in socket
    socket.data.currentDoc = docId;
    socket.data.username = username;

    // Add participant
    doc.participants.set(socket.id, username);

    // Add to authors historic
    if (!doc.authors.includes(username)) {
      doc.authors.push(username);
    }

    // Update activity: joins
    doc.activity = doc.activity || {};
    doc.activity[username] = doc.activity[username] || { edits: 0, joins: 0, disconnects: 0, lastTs: null };
    doc.activity[username].joins = (doc.activity[username].joins || 0) + 1;
    doc.activity[username].lastTs = new Date().toISOString();

    // Add an explicit event for join
    const ts = new Date().toISOString();
    doc.events = doc.events || [];
    doc.events.push({ timestamp: ts, entry: `${username} se unió al documento` });

    documents.set(docId, doc);

    socket.join(docId);

    // Emit participants list and meta to everyone in room
    const participants = Array.from(doc.participants.values());
    io.to(docId).emit("participants", participants);

    // Emit docMeta to the client that joined
    socket.emit("docMeta", {
      docId,
      title: doc.title,
      authors: doc.authors,
      created_at: doc.created_at,
      settings: doc.settings
    });

    // Send current content
    socket.emit("update", doc.content);
  });

  // recibir ediciones: payload should be { user, content }
  socket.on("edit", (payload) => {
    const currentDoc = socket.data.currentDoc;
    const username = (payload && payload.user) || socket.data.username || "Anónimo";
    const content = (payload && payload.content) || (typeof payload === "string" ? payload : "");

    if (!currentDoc) return;

    const doc = documents.get(currentDoc);
    if (!doc) return;

    // Update content
    doc.content = content;

    // Update activity counters
    doc.activity = doc.activity || {};
    doc.activity[username] = doc.activity[username] || { edits: 0, joins: 0, disconnects: 0, lastTs: null };
    doc.activity[username].edits = (doc.activity[username].edits || 0) + 1;
    doc.activity[username].lastTs = new Date().toISOString();

    // Persist change
    documents.set(currentDoc, doc);

    // Broadcast updated content and optionally broadcast updated summarized log/meta
    socket.to(currentDoc).emit("update", content);

    // Broadcast updated participants and a summarized activity snapshot (optional)
    const participants = Array.from(doc.participants.values());
    io.to(currentDoc).emit("participants", participants);

    // Also emit a small activity summary for UI (user -> counts)
    const activitySnapshot = {};
    Object.keys(doc.activity || {}).forEach(u => {
      activitySnapshot[u] = {
        edits: doc.activity[u].edits || 0,
        joins: doc.activity[u].joins || 0,
        disconnects: doc.activity[u].disconnects || 0,
        lastTs: doc.activity[u].lastTs || null
      };
    });
    io.to(currentDoc).emit("activitySnapshot", activitySnapshot);
  });

  socket.on("disconnect", () => {
    const currentDoc = socket.data.currentDoc;
    const username = socket.data.username;

    if (currentDoc && documents.has(currentDoc)) {
      const doc = documents.get(currentDoc);

      // Remove participant
      if (doc.participants && doc.participants.has(socket.id)) {
        doc.participants.delete(socket.id);
      }

      // Update activity disconnect
      if (username) {
        doc.activity = doc.activity || {};
        doc.activity[username] = doc.activity[username] || { edits: 0, joins: 0, disconnects: 0, lastTs: null };
        doc.activity[username].disconnects = (doc.activity[username].disconnects || 0) + 1;
        doc.activity[username].lastTs = new Date().toISOString();

        // Add an explicit event
        doc.events = doc.events || [];
        doc.events.push({ timestamp: new Date().toISOString(), entry: `${username} se desconectó` });
      }

      // Save
      documents.set(currentDoc, doc);

      // Emit updated participants
      const participants = Array.from(doc.participants.values());
      io.to(currentDoc).emit("participants", participants);

      // Emit activity snapshot
      const activitySnapshot = {};
      Object.keys(doc.activity || {}).forEach(u => {
        activitySnapshot[u] = {
          edits: doc.activity[u].edits || 0,
          joins: doc.activity[u].joins || 0,
          disconnects: doc.activity[u].disconnects || 0,
          lastTs: doc.activity[u].lastTs || null
        };
      });
      io.to(currentDoc).emit("activitySnapshot", activitySnapshot);
    }
  });
});

server.listen(8080, () =>
  console.log("Servidor corriendo en http://localhost:8080")
);
