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
