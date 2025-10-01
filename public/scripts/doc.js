// public/scripts/doc.js
const socket = io();
const editor = document.getElementById("editor");
const docId = window.location.pathname.split("/").pop();

let assignedUser = null;
let authors = [];

// DOM elements
const linkElement = document.getElementById("docLink");
const userBadge = document.getElementById("userBadge");
const downloadBtn = document.getElementById("downloadPntn");
const uploadForm = document.getElementById("uploadForm");
const authorsList = document.getElementById("authorsList");

function updateAuthorsUI() {
  if (!authorsList) return;
  if (!authors || authors.length === 0) {
    authorsList.textContent = "";
    return;
  }
  authorsList.textContent = "Participantes: " + authors.join(", ");
}

// Mostrar link del documento actual
document.addEventListener("DOMContentLoaded", () => {
  if (linkElement) linkElement.textContent = window.location.href;
});

// Join doc
socket.emit("joinDoc", docId);

// Recibir asignación de usuario
socket.on("assignedUser", (name) => {
  assignedUser = name;
  if (userBadge) userBadge.textContent = `Eres: ${assignedUser}`;
});

// Recibir meta (autores, title, etc)
socket.on("docMeta", (meta) => {
  authors = meta.authors || [];
  updateAuthorsUI();
});

// Recibir actualizaciones del servidor (texto)
socket.on("update", (content) => {
  if (editor.value !== content) {
    // Para no romper la experiencia de quien está escribiendo, solo reemplazamos
    // si el cambio viene de otro usuario. Esto es simple y funciona bien para MVP.
    editor.value = content;
  }
});

// Enviar cambios al servidor (con pequeño debounce)
let debounceTimer = null;
editor.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const payload = { user: assignedUser || "anon", content: editor.value };
    socket.emit("edit", payload);
  }, 150); // 150ms debounce
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

// Opcional: recibir actualizaciones de meta (autores) en tiempo real si el servidor emite
socket.on("docMetaUpdate", (meta) => {
  authors = meta.authors || authors;
  updateAuthorsUI();
});
