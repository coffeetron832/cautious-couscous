const form = document.getElementById("uploadForm");
const resultDiv = document.getElementById("result");

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
