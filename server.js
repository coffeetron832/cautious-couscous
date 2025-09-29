const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const sharp = require("sharp");
const mammoth = require("mammoth");
const cors = require("cors");
const pdfParse = require("pdf-parse");
const { Document, Packer, Paragraph } = require("docx");
const { PDFDocument, StandardFonts } = require("pdf-lib");

const app = express();
const PORT = 8080;

app.use(cors());
app.use(express.static("public"));

// Servir archivos convertidos
app.use("/converted", express.static(path.join(__dirname, "converted")));

fs.ensureDirSync("./uploads");
fs.ensureDirSync("./converted");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "./uploads"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Helpers
async function writeTextToPdfFile(text, outputPath) {
  const pdfDoc = await PDFDocument.create();
  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 12;
  const pageWidth = 595; // A4-like width in points
  const pageHeight = 842; // A4-like height in points
  const margin = 50;
  const maxWidth = pageWidth - margin * 2;

  // approximate max chars per line (rough)
  const approxCharWidth = fontSize * 0.6; // heuristic
  const maxChars = Math.floor(maxWidth / approxCharWidth);

  // split text into lines preserving existing newlines, and wrap long lines
  const rawLines = text.split(/\r?\n/);
  const lines = [];
  for (const rl of rawLines) {
    if (!rl) { lines.push(""); continue; }
    let remaining = rl;
    while (remaining.length > 0) {
      if (remaining.length <= maxChars) {
        lines.push(remaining);
        break;
      } else {
        // try to break at last space within maxChars
        let chunk = remaining.slice(0, maxChars);
        const lastSpace = chunk.lastIndexOf(" ");
        if (lastSpace > Math.floor(maxChars * 0.6)) {
          chunk = chunk.slice(0, lastSpace);
        }
        lines.push(chunk);
        remaining = remaining.slice(chunk.length).trim();
      }
    }
  }

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;
  const lineHeight = fontSize + 4;

  for (const line of lines) {
    if (y < margin + lineHeight) {
      // new page
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    page.drawText(line || " ", {
      x: margin,
      y: y,
      size: fontSize,
      font: helv,
    });
    y -= lineHeight;
  }

  const bytes = await pdfDoc.save();
  await fs.writeFile(outputPath, bytes);
}

// Página principal
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public/index.html"))
);

// Subida y conversión
app.post("/api/upload", upload.single("file"), async (req, res) => {
  const { file } = req;
  const { format } = req.body;
  if (!file) return res.status(400).json({ error: "No se subió archivo" });

  const ext = path.extname(file.originalname).toLowerCase();
  const baseName = path.basename(file.originalname, ext); // nombre base del archivo
  const outputName = `${baseName}_PontonConverter.${format}`;
  const outputPath = path.join("converted", outputName);

  try {
    // ✅ Conversión de imágenes sin pérdida y rotación automática
    if ([".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
      let img = sharp(file.path).rotate(); // rota según EXIF
      if (format === "jpg") {
        await img.jpeg({ quality: 100 }).toFile(outputPath);
      } else if (format === "png") {
        await img.png({ compressionLevel: 0 }).toFile(outputPath); // sin pérdida
      } else if (format === "webp") {
        await img.webp({ quality: 100 }).toFile(outputPath);
      }
    }

    // ✅ PDF → TXT (usando pdf-parse)
    else if (ext === ".pdf" && format === "txt") {
      const dataBuffer = await fs.readFile(file.path);
      const pdfData = await pdfParse(dataBuffer);
      const text = pdfData && pdfData.text ? pdfData.text : "";
      await fs.writeFile(outputPath, text, "utf8");
    }

    // ✅ DOCX → TXT (mammoth)
    else if (ext === ".docx" && format === "txt") {
      const { value } = await mammoth.extractRawText({ path: file.path });
      await fs.writeFile(outputPath, value || "", "utf8");
    }

    // ✅ PDF → DOCX (extraer texto con pdf-parse y crear docx)
    else if (ext === ".pdf" && format === "docx") {
      const dataBuffer = await fs.readFile(file.path);
      const pdfData = await pdfParse(dataBuffer);
      const text = pdfData && pdfData.text ? pdfData.text : "";

      // crear docx con el texto dividido en párrafos
      const paragraphs = (text.split(/\r?\n/).filter(Boolean)).map(line => new Paragraph(line));
      const doc = new Document({ sections: [{ properties: {}, children: paragraphs.length ? paragraphs : [new Paragraph("")] }] });
      const buffer = await Packer.toBuffer(doc);
      await fs.writeFile(outputPath, buffer);
    }

    // ✅ DOCX → PDF (extraer texto con mammoth y escribir PDF con paginación)
    else if (ext === ".docx" && format === "pdf") {
      const { value } = await mammoth.extractRawText({ path: file.path });
      const text = value || "";
      await writeTextToPdfFile(text, outputPath);
    }

    // ✅ TXT → PDF (leer txt y escribir PDF con paginación)
    else if (ext === ".txt" && format === "pdf") {
      const text = await fs.readFile(file.path, "utf-8");
      await writeTextToPdfFile(text, outputPath);
    }

    else {
      return res.status(400).json({ error: "Conversión no soportada" });
    }

    // Retornamos la ruta pública para descargar
    res.json({
      message: "Archivo convertido",
      downloadUrl: `/converted/${outputName}`
    });
  } catch (err) {
    console.error("Error en conversión:", err);
    res.status(500).json({ error: "Error en la conversión" });
  }
});

// Limpieza automática de archivos temporales
const CLEAN_INTERVAL = 5 * 60 * 1000; // 5 minutos
const TEMP_FOLDERS = ["./uploads", "./converted"];

setInterval(() => {
  const now = Date.now();
  TEMP_FOLDERS.forEach(folder => {
    fs.readdir(folder, (err, files) => {
      if (err) return console.error(err);
      files.forEach(file => {
        const filePath = path.join(folder, file);
        fs.stat(filePath, (err, stats) => {
          if (err) return console.error(err);
          const age = now - stats.birthtimeMs;
          if (age > CLEAN_INTERVAL) {
            fs.unlink(filePath)
              .then(() => console.log(`Archivo eliminado: ${filePath}`))
              .catch(err => console.error(err));
          }
        });
      });
    });
  });
}, CLEAN_INTERVAL);

app.listen(PORT, () =>
  console.log(`Servidor corriendo en http://localhost:${PORT}`)
);
