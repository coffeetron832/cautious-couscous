const socket = io();
const editor = document.getElementById("editor");

// Obtener el ID del documento desde la URL
const docId = window.location.pathname.split("/").pop();
socket.emit("joinDoc", docId);

// Recibir actualizaciones del servidor
socket.on("update", (content) => {
  if (editor.value !== content) {
    editor.value = content;
  }
});

// Enviar cambios al servidor
editor.addEventListener("input", () => {
  socket.emit("edit", editor.value);
});

// Mostrar link del documento actual
document.addEventListener("DOMContentLoaded", () => {
  const linkElement = document.getElementById("docLink");
  if (linkElement) {
    linkElement.textContent = window.location.href;
  }
});

// ====================
// Exportar a .pntn
// ====================
const downloadBtn = document.getElementById("downloadPntn");
if (downloadBtn) {
  downloadBtn.addEventListener("click", () => {
    const blob = new Blob([editor.value], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `documento-${docId}.pntn`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

// ====================
// Importar desde .pntn
// ====================
const uploadForm = document.getElementById("uploadForm");
if (uploadForm) {
  uploadForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById("uploadPntn");
    if (!fileInput.files.length) return alert("Selecciona un archivo .pntn");

    const file = fileInput.files[0];
    const text = await file.text();

    // Reemplazar contenido actual y sincronizar
    editor.value = text;
    socket.emit("edit", text);
  });
}
