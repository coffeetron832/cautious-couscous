const form = document.getElementById("uploadForm");
const resultDiv = document.getElementById("result");
const fileInput = document.querySelector('input[name="file"]');
const formatSelect = document.querySelector('select[name="format"]');

// Detectar tipo de archivo y actualizar opciones de formato
fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;

  const ext = file.name.split('.').pop().toLowerCase();
  formatSelect.innerHTML = '<option value="">Selecciona formato de salida</option>';

  // Opciones para imágenes
  if (["jpg", "jpeg", "png", "webp"].includes(ext)) {
    ["jpg", "png", "webp"].forEach(f => {
      const option = document.createElement("option");
      option.value = f;
      option.textContent = f.toUpperCase();
      formatSelect.appendChild(option);
    });
  }
  // Opciones para documentos
  else if (["pdf", "docx"].includes(ext)) {
    ["txt"].forEach(f => {
      const option = document.createElement("option");
      option.value = f;
      option.textContent = f.toUpperCase();
      formatSelect.appendChild(option);
    });
  } else {
    alert("Tipo de archivo no soportado");
    fileInput.value = "";
  }
});

// Manejo del formulario para subir y convertir
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  resultDiv.textContent = "Procesando...";

  const formData = new FormData(form);

  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData
  });

  const data = await res.json();
  if (res.ok) {
    resultDiv.innerHTML = `<a href="${data.downloadUrl}" download>Descargar archivo convertido</a>`;
  } else {
    resultDiv.textContent = data.error;
  }
});
