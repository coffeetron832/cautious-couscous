const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const sharp = require("sharp");
const mammoth = require("mammoth");
const cors = require("cors");
const { Document, Packer, Paragraph } = require("docx");
const { PDFDocument } = require("pdf-lib");
const pdfParse = require("pdf-parse"); // 👈 librería para leer texto de PDFs

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
  const outputName = `${Date.now()}_converted.${format}`;
  const outputPath = path.join("converted", outputName);

  try {
    // ✅ Conversión de imágenes
    if ([".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
      let img = sharp(file.path).rotate(); // rota según EXIF
      if (format === "jpg") {
        await img.jpeg({ quality: 100 }).toFile(outputPath);
      } else if (format === "png") {
        await img.png({ compressionLevel: 0 }).toFile(outputPath);
      } else if (format === "webp") {
        await img.webp({ quality: 100 }).toFile(outputPath);
      }
    }

    // ✅ PDF → TXT
    else if (ext === ".pdf" && format === "txt") {
      const dataBuffer = await fs.readFile(file.path);
      const pdfData = await pdfParse(dataBuffer);
      await fs.writeFile(outputPath, pdfData.text, "utf8");
    }

    // ✅ DOCX → TXT
    else if (ext === ".docx" && format === "txt") {
      const { value } = await mammoth.extractRawText({ path: file.path });
      await fs.writeFile(outputPath, value, "utf8");
    }

    // ✅ PDF → DOCX
    else if (ext === ".pdf" && format === "docx") {
      const dataBuffer = await fs.readFile(file.path);
      const pdfData = await pdfParse(dataBuffer);

      const doc = new Document({
        sections: [
          {
            properties: {},
            children: [new Paragraph(pdfData.text)],
          },
        ],
      });

      const buffer = await Packer.toBuffer(doc);
      await fs.writeFile(outputPath, buffer);
    }

    // ✅ DOCX → PDF
    else if (ext === ".docx" && format === "pdf") {
      const { value } = await mammoth.extractRawText({ path: file.path });
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      page.drawText(value, { x: 50, y: 700, size: 12 });
      const pdfBytesOut = await pdfDoc.save();
      await fs.writeFile(outputPath, pdfBytesOut);
    }

    // ✅ TXT → PDF
    else if (ext === ".txt" && format === "pdf") {
      const text = await fs.readFile(file.path, "utf-8");
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      page.drawText(text, { x: 50, y: 700, size: 12 });
      const pdfBytesOut = await pdfDoc.save();
      await fs.writeFile(outputPath, pdfBytesOut);
    }

    else {
      return res.status(400).json({ error: "Conversión no soportada" });
    }

    res.json({
      message: "Archivo convertido",
      downloadUrl: `/converted/${outputName}`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error en la conversión" });
  }
});

// Limpieza automática
const CLEAN_INTERVAL = 5 * 60 * 1000; // 5 minutos
const TEMP_FOLDERS = ["./uploads", "./converted"];

setInterval(() => {
  const now = Date.now();
  TEMP_FOLDERS.forEach((folder) => {
    fs.readdir(folder, (err, files) => {
      if (err) return console.error(err);
      files.forEach((file) => {
        const filePath = path.join(folder, file);
        fs.stat(filePath, (err, stats) => {
          if (err) return console.error(err);
          const age = now - stats.birthtimeMs;
          if (age > CLEAN_INTERVAL) {
            fs.unlink(filePath)
              .then(() => console.log(`Archivo eliminado: ${filePath}`))
              .catch((err) => console.error(err));
          }
        });
      });
    });
  });
}, CLEAN_INTERVAL);

app.listen(PORT, () =>
  console.log(`Servidor corriendo en http://localhost:${PORT}`)
);
