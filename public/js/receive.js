// Obtener ID del archivo desde la URL
const urlParams = new URLSearchParams(window.location.search);
const fileId = urlParams.get("id");

if (!fileId) {
  alert("Falta el ID del archivo en el enlace");
}

document.getElementById("verifyForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const pin = document.getElementById("pinInput").value;

  try {
    const res = await fetch("/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId, pin })
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Error verificando PIN");

    // Mostrar archivo listo para descarga
    document.getElementById("result").classList.remove("hidden");
    document.getElementById("fileInfo").textContent = `Archivo listo: ${data.filename}`;
    
    const downloadLink = document.getElementById("downloadLink");
    downloadLink.href = `/download/${fileId}`;
    downloadLink.classList.remove("hidden");

  } catch (err) {
    alert("Error: " + err.message);
  }
});
