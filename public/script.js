const form = document.getElementById("uploadForm");
const resultDiv = document.getElementById("result");
const fileInput = document.querySelector('input[name="file"]');
const formatSelect = document.querySelector('select[name="format"]');
const previewDiv = document.getElementById("preview"); // div para mostrar preview


// Calcular longitud del texto extra para usar en CSS (en ch)
(function setupLogoReveal() {
  const logoEl = document.querySelector('.logo');
  if (!logoEl) return;
  const extra = logoEl.querySelector('.extra');
  if (!extra) return;

  // calcula longitud visible (número de caracteres)
  const len = extra.textContent.trim().length || 6;
  // fijar CSS variable en el elemento con unidad ch
  logoEl.style.setProperty('--len', `${len}ch`);

  // opcional: para touch devices, también activar el hover al tocar
  let touchTimeout;
  logoEl.addEventListener('touchstart', (e) => {
    logoEl.classList.add('hovered');
    clearTimeout(touchTimeout);
    touchTimeout = setTimeout(() => logoEl.classList.remove('hovered'), 1200);
  });
})();



// Detectar tipo de archivo y actualizar opciones de formato
fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  previewDiv.innerHTML = ""; // limpiar preview
  if (!file) return;

  const ext = file.name.split('.').pop().toLowerCase();
  formatSelect.innerHTML = '<option value="">Selecciona formato de salida</option>';

  // ✅ Imágenes
  if (["jpg", "jpeg", "png", "webp"].includes(ext)) {
    // Mostrar preview
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

    // Opciones de conversión para imágenes
    ["jpg", "png", "webp"].forEach(f => {
      if (ext !== f) { // evitar convertir a mismo formato
        const option = document.createElement("option");
        option.value = f;
        option.textContent = f.toUpperCase();
        formatSelect.appendChild(option);
      }
    });
  }

  // ✅ PDF
  else if (ext === "pdf") {
    ["txt", "docx"].forEach(f => {
      const option = document.createElement("option");
      option.value = f;
      option.textContent = f.toUpperCase();
      formatSelect.appendChild(option);
    });
  }

  // ✅ DOCX
  else if (ext === "docx") {
    ["txt", "pdf"].forEach(f => {
      const option = document.createElement("option");
      option.value = f;
      option.textContent = f.toUpperCase();
      formatSelect.appendChild(option);
    });
  }

  // ✅ TXT
  else if (ext === "txt") {
    ["pdf"].forEach(f => {
      const option = document.createElement("option");
      option.value = f;
      option.textContent = f.toUpperCase();
      formatSelect.appendChild(option);
    });
  }

  else {
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
    resultDiv.innerHTML = `<a href="${data.downloadUrl}" download>⬇️ Descargar archivo convertido</a>`;
  } else {
    resultDiv.textContent = data.error;
  }
});
