// === SUBIR ARCHIVO ===
document.getElementById("uploadForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const fileInput = document.getElementById("fileInput");
  if (!fileInput.files.length) return alert("Selecciona un archivo primero");

  const formData = new FormData();
  formData.append("file", fileInput.files[0]);

  try {
    const res = await fetch("/upload", {
      method: "POST",
      body: formData
    });

    if (!res.ok) throw new Error("Error subiendo archivo");

    const data = await res.json();

    // Mostrar PIN generado
    document.getElementById("uploadResult").classList.remove("hidden");
    document.getElementById("generatedPin").textContent = data.pin;

  } catch (err) {
    alert("Error: " + err.message);
  }
});

// === RECIBIR ARCHIVO ===
document.getElementById("verifyForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const pin = document.getElementById("pinInput").value;

  try {
    const res = await fetch("/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error verificando PIN");

    // Mostrar archivo listo para descarga
    document.getElementById("downloadResult").classList.remove("hidden");
    document.getElementById("fileInfo").textContent = `Archivo listo: ${data.filename}`;

    const downloadLink = document.getElementById("downloadLink");
    downloadLink.href = `/download/${data.fileId}`;
    downloadLink.classList.remove("hidden");

  } catch (err) {
    alert("Error: " + err.message);
  }
});
