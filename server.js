const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const documents = new Map(); // { docId: content }

app.get("/new", (req, res) => {
  const id = uuidv4();
  res.redirect(`/doc/${id}`);
});

app.get("/doc/:id", (req, res) => {
  res.sendFile(__dirname + "/public/doc.html");
});

io.on("connection", (socket) => {
  let currentDoc = null;

  socket.on("joinDoc", (docId) => {
    currentDoc = docId;

    if (!documents.has(docId)) {
      documents.set(docId, "");
    }

    socket.join(docId);
    socket.emit("update", documents.get(docId));
  });

  socket.on("edit", (content) => {
    if (!currentDoc) return;
    documents.set(currentDoc, content);
    socket.to(currentDoc).emit("update", content);
  });
});

server.listen(8080, () =>
  console.log("Servidor en http://localhost:8080")
);
