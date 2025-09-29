const form = document.getElementById("uploadForm");
const resultDiv = document.getElementById("result");
const fileInput = document.querySelector('input[name="file"]');
const formatSelect = document.querySelector('select[name="format"]');
const previewDiv = document.getElementById("preview"); 
let removeFileBtn; // botón dinámico

// Función para resetear vista previa y archivo
function resetPreview() {
  fileInput.value = "";
  previewDiv.innerHTML = "";
  formatSelect.innerHTML = '<option value="">Selecciona formato de salida</option>';
  if (removeFileBtn) {
    removeFileBtn.remove();
    removeFileBtn = null;
  }
}

// Detectar tipo de archivo y actualizar opciones de formato
fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  previewDiv.innerHTML = ""; // limpiar preview
  if (!file) return;

  const ext = file.name.split(".").pop().toLowerCase();
  formatSelect.innerHTML = '<option value="">Selecciona formato de salida</option>';

  // Crear botón ❌ si no existe
  if (!removeFileBtn) {
    removeFileBtn = document.createElement("button");
    removeFileBtn.type = "button";
    removeFileBtn.textContent = "✕";
    removeFileBtn.style.position = "absolute";
    removeFileBtn.style.top = "5px";
    removeFileBtn.style.right = "5px";
    removeFileBtn.style.background = "#f33";
    removeFileBtn.style.color = "#fff";
    removeFileBtn.style.border = "none";
    removeFileBtn.style.borderRadius = "50%";
    removeFileBtn.style.width = "24px";
    removeFileBtn.style.height = "24px";
    removeFileBtn.style.cursor = "pointer";
    removeFileBtn.style.boxShadow = "0 2px 5px rgba(0,0,0,0.3)";
    removeFileBtn.addEventListener("click", resetPreview);
    previewDiv.style.position = "relative"; // para posicionar el botón
    previewDiv.appendChild(removeFileBtn);
  }

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
      previewDiv.insertBefore(img, removeFileBtn);
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
      previewDiv.insertBefore(embed, removeFileBtn);
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
    previewDiv.insertBefore(info, removeFileBtn);

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
      previewDiv.insertBefore(pre, removeFileBtn);
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
    fileInput.value = "";
    if (removeFileBtn) {
      removeFileBtn.remove();
      removeFileBtn = null;
    }
  }
});

// Manejo del formulario para subir y convertir
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  resultDiv.textContent = "Procesando...";

  const formData = new FormData(form);

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
});
