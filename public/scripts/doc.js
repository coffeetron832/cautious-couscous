// public/scripts/doc.js
const socket = io();
const editor = document.getElementById("editor");
const docId = window.location.pathname.split("/").pop();

// UI elements
const headerPre = document.getElementById("headerPre");
const linkElement = document.getElementById("docLink");
const usernameInput = document.getElementById("usernameInput");
const enterBtn = document.getElementById("enterBtn");
const userBadge = document.getElementById("userBadge");
const downloadBtn = document.getElementById("downloadPntn");
const uploadForm = document.getElementById("uploadForm");
const authorsList = document.getElementById("authorsList");

let myUsername = null;
let authors = [];

// Mostrar link del documento actual
document.addEventListener("DOMContentLoaded", () => {
  if (linkElement) linkElement.textContent = window.location.href;
  updateHeaderPlaceholder();
});

// Actualiza el header visual con meta
function updateHeaderPlaceholder(meta = {}) {
  const title = meta.title || "Documento sin título";
  const created = meta.created_at || "—";
  const authorsStr = (meta.authors && meta.authors.length) ? meta.authors.join(", ") : "";
  headerPre.textContent = `#PNTN-DOC v1.1
title: ${title}
authors: ${authorsStr}
created: ${created}
`;
}

// actualiza UI de participantes/authors (en vivo)
function updateAuthorsUI(list) {
  authors = list || authors;
  if (!authors || authors.length === 0) {
    authorsList.textContent = "Participantes: (ninguno)";
  } else {
    authorsList.textContent = "Participantes: " + authors.join(", ");
  }
}

// Antes de unirse: el usuario ingresa su nombre
enterBtn.addEventListener("click", () => {
  const name = (usernameInput.value || "").trim();
  if (!name) return alert("Por favor escribe tu nombre para unirte al documento.");
  myUsername = name;
  // habilitar editor y ocultar formulario
  usernameInput.disabled = true;
  enterBtn.disabled = true;
  userBadge.style.display = "inline-block";
  userBadge.textContent = `Eres: ${myUsername}`;
  editor.disabled = false;

  // Emitir join con docId y username
  socket.emit("joinDoc", { docId, username: myUsername });
});

// Escuchar meta inicial después de unirse
socket.on("docMeta", (meta) => {
  updateHeaderPlaceholder(meta);
  // authors maybe present
  if (meta.authors && meta.authors.length) {
    updateAuthorsUI(meta.authors);
  }
});

// Recibir lista de participantes en vivo
socket.on("participants", (list) => {
  updateAuthorsUI(list);
  // Update header authors line too (authors are historical list in meta sent on join)
  // We keep the header authors as the historical authors (docMeta), but for UX we show current participants separately.
});

// Recibir snapshot de actividad (opcional)
socket.on("activitySnapshot", (snapshot) => {
  // Puedes usar esto para mostrar indicadores de "quién está activo", etc.
  // Por ahora no renderizamos detalles aquí; la exportación .pntn tendrá el log resumido.
  // Ejemplo simple: se puede marcar en la UI si alguien hizo muchas ediciones (no implementado).
});

// Recibir actualizaciones del servidor (texto)
socket.on("update", (content) => {
  // Evitar pisar si el usuario está escribiendo: simple y efectivo para MVP
  if (document.activeElement === editor) {
    // si yo estoy escribiendo, no forzamos cambio inmediato
    return;
  }
  if (editor.value !== content) {
    editor.value = content;
  }
});

// Enviar cambios al servidor (con debounce y enviando usuario)
let debounceTimer = null;
editor.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (!myUsername) {
      // si no se unió con nombre, no enviamos (o enviamos como Anónimo)
      return;
    }
    const payload = { user: myUsername, content: editor.value };
    socket.emit("edit", payload);
  }, 180);
});

// Descargar .pntn (desde servidor /export/:id)
if (downloadBtn) {
  downloadBtn.addEventListener("click", async () => {
    try {
      const res = await fetch(`/export/${docId}`);
      if (!res.ok) throw new Error("Error al exportar .pntn");
      const text = await res.text();
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `documento-${docId}.pntn`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("No se pudo descargar .pntn: " + err.message);
    }
  });
}

// Importar .pntn via /import (server)
if (uploadForm) {
  uploadForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById("uploadPntn");
    if (!fileInput || !fileInput.files.length) {
      return alert("Selecciona un archivo .pntn para importar");
    }
    const file = fileInput.files[0];
    const form = new FormData();
    form.append("pntnfile", file);

    try {
      const res = await fetch("/import", {
        method: "POST",
        body: form
      });
      const json = await res.json();
      if (json.success && json.docId) {
        // Redirigir al nuevo documento importado
        window.location.href = `/doc/${json.docId}`;
      } else {
        throw new Error(json.error || "Import failed");
      }
    } catch (err) {
      alert("Error importando .pntn: " + err.message);
    }
  });
}

// Mostrar doc link en header
if (linkElement) linkElement.textContent = window.location.href;
