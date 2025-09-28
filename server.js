const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const sharp = require("sharp");
const pdfLib = require("pdf-lib");
const mammoth = require("mammoth");
const cors = require("cors");

const app = express();
const PORT = 8080;

app.use(cors());
app.use(express.static("public"));

fs.ensureDirSync("./uploads");
fs.ensureDirSync("./converted");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "./uploads"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Página principal
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public/index.html")));

// Subida y conversión
app.post("/api/upload", upload.single("file"), async (req, res) => {
  const { file } = req;
  const { format } = req.body;
  if (!file) return res.status(400).json({ error: "No se subió archivo" });

  const ext = path.extname(file.originalname).toLowerCase();
  const outputName = `${Date.now()}_converted.${format}`;
  const outputPath = path.join("converted", outputName);

  try {
    if ([".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
      // Imagen → Sharp
      await sharp(file.path).toFormat(format).toFile(outputPath);
    } else if (ext === ".pdf" && format === "txt") {
      // PDF → TXT simple
      const pdfBytes = await fs.readFile(file.path);
      const pdfDoc = await pdfLib.PDFDocument.load(pdfBytes);
      let text = "";
      const pages = pdfDoc.getPages();
      pages.forEach(p => { text += p.getTextContent?.() || ""; });
      await fs.writeFile(outputPath, text);
    } else if (ext === ".docx" && format === "txt") {
      // DOCX → TXT
      const { value } = await mammoth.extractRawText({ path: file.path });
      await fs.writeFile(outputPath, value);
    } else {
      return res.status(400).json({ error: "Conversión no soportada" });
    }

    res.json({ message: "Archivo convertido", outputPath });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error en la conversión" });
  }
});

app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));
