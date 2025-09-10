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

    // Mostrar resultados
    document.getElementById("result").classList.remove("hidden");
    document.getElementById("link").textContent = `${window.location.origin}/receive.html?id=${data.fileId}`;
    document.getElementById("pin").textContent = data.pin;
  } catch (err) {
    alert("Error: " + err.message);
  }
});
