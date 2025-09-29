const form = document.getElementById("uploadForm");
const resultDiv = document.getElementById("result");
const fileInput = document.querySelector('input[name="file"]');
const formatSelect = document.querySelector('select[name="format"]');
const previewDiv = document.getElementById("preview"); // div para mostrar preview
const previewContainer = document.getElementById("preview-container");

// --- Crear/obtener botón de eliminar ---
let removeFileBtn = document.getElementById("removeFileBtn");
if (!removeFileBtn) {
  removeFileBtn = document.createElement("button");
  removeFileBtn.type = "button";
  removeFileBtn.id = "removeFileBtn";
  removeFileBtn.setAttribute("aria-label", "Quitar archivo");
  removeFileBtn.textContent = "✕";
  // estilo base (puedes mover esto a styles.css)
  removeFileBtn.style.display = "none";
  removeFileBtn.style.position = "absolute";
  removeFileBtn.style.top = "6px";
  removeFileBtn.style.right = "6px";
  removeFileBtn.style.background = "#e74c3c";
  removeFileBtn.style.color = "#fff";
  removeFileBtn.style.border = "none";
  removeFileBtn.style.borderRadius = "50%";
  removeFileBtn.style.width = "28px";
  removeFileBtn.style.height = "28px";
  removeFileBtn.style.cursor = "pointer";
  removeFileBtn.style.boxShadow = "0 2px 6px rgba(0,0,0,0.15)";
  // appendar en el contenedor correcto
  if (previewContainer) previewContainer.style.position = "relative";
  if (previewContainer) previewContainer.appendChild(removeFileBtn);
  else {
    // si no existe preview-container, envuelve previewDiv y añade botón
    const wrapper = document.createElement("div");
    wrapper.style.position = "relative";
    previewDiv.parentNode.insertBefore(wrapper, previewDiv);
    wrapper.appendChild(previewDiv);
    wrapper.appendChild(removeFileBtn);
  }
}

// --- Función para resetear preview y formulario ---
function resetPreview() {
  fileInput.value = "";
  previewDiv.innerHTML = "";
  formatSelect.innerHTML = '<option value="">Selecciona formato de salida</option>';
  resultDiv.textContent = "";
  removeFileBtn.style.display = "none";
}

// evento del botón ❌
removeFileBtn.addEventListener("click", resetPreview);

// Detectar tipo de archivo y actualizar opciones de formato
fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  previewDiv.innerHTML = ""; // limpiar preview
  if (!file) {
    removeFileBtn.style.display = "none";
    return;
  }

  // mostrar botón de eliminar
  removeFileBtn.style.display = "block";

  const ext = file.name.split(".").pop().toLowerCase();
  formatSelect.innerHTML = '<option value="">Selecciona formato de salida</option>';

  // ✅ Imágenes
  if (["jpg", "jpeg", "png", "webp"].includes(ext)) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.createElement("img");
      img.src = e.target.result;
      img.style.maxWidth = "200px";
      img.style.marginTop = "10px";
      img.style.border = "1px solid #ccc";
      img.style.borderRadius = "5px";
      previewDiv.appendChild(img);
    };
    reader.readAsDataURL(file);

    ["jpg", "png", "webp"].forEach((f) => {
      if (ext !== f) {
        const option = document.createElement("option");
        option.value = f;
        option.textContent = f.toUpperCase();
        formatSelect.appendChild(option);
      }
    });
  }

  // ✅ PDF
  else if (ext === "pdf") {
    const reader = new FileReader();
    reader.onload = (e) => {
      const embed = document.createElement("embed");
      embed.src = e.target.result;
      embed.type = "application/pdf";
      embed.width = "100%";
      embed.height = "400px";
      embed.style.border = "1px solid #ccc";
      previewDiv.appendChild(embed);
    };
    reader.readAsDataURL(file);

    ["txt", "docx"].forEach((f) => {
      const option = document.createElement("option");
      option.value = f;
      option.textContent = f.toUpperCase();
      formatSelect.appendChild(option);
    });
  }

  // ✅ DOCX
  else if (ext === "docx") {
    const info = document.createElement("p");
    info.textContent = "📄 Vista previa no disponible, pero el archivo está listo para conversión.";
    previewDiv.appendChild(info);

    ["txt", "pdf"].forEach((f) => {
      const option = document.createElement("option");
      option.value = f;
      option.textContent = f.toUpperCase();
      formatSelect.appendChild(option);
    });
  }

  // ✅ TXT
  else if (ext === "txt") {
    const reader = new FileReader();
    reader.onload = (e) => {
      const pre = document.createElement("pre");
      pre.textContent = e.target.result.split("\n").slice(0, 20).join("\n") + "\n...";
      pre.style.maxHeight = "200px";
      pre.style.overflow = "auto";
      pre.style.background = "#f5f5f5";
      pre.style.padding = "10px";
      pre.style.border = "1px solid #ccc";
      pre.style.borderRadius = "5px";
      previewDiv.appendChild(pre);
    };
    reader.readAsText(file);

    ["pdf"].forEach((f) => {
      const option = document.createElement("option");
      option.value = f;
      option.textContent = f.toUpperCase();
      formatSelect.appendChild(option);
    });
  }

  else {
    alert("Tipo de archivo no soportado");
    resetPreview();
  }
});

// Manejo del formulario para subir y convertir
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  // Si no hay archivo seleccionado, evitar enviar
  if (!fileInput.files || fileInput.files.length === 0) {
    alert("Primero selecciona un archivo.");
    return;
  }

  resultDiv.textContent = "Procesando...";

  const formData = new FormData(form);

  try {
    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    if (res.ok) {
      resultDiv.innerHTML = `<a href="${data.downloadUrl}" download>⬇️ Descargar archivo convertido</a>`;
    } else {
      resultDiv.textContent = data.error;
    }
  } catch (err) {
    resultDiv.textContent = "Error en la subida/conversión.";
    console.error(err);
  }
});
