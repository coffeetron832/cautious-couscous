// server.js
app.get('/', (req, res) => {
res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


app.get('/new', (req, res) => {
const id = generateId();
res.redirect(`/doc/${id}`);
});


app.get('/doc/:id', (req, res) => {
res.sendFile(path.join(__dirname, 'public', 'doc.html'));
});


// Socket.IO
io.on('connection', (socket) => {
let currentDocId = null;


socket.on('joinDoc', (docId) => {
currentDocId = docId;
socket.join(docId);


ensureDocExists(docId);


// enviar estado inicial
const doc = documents.get(docId);
socket.emit('update', doc.content);


// opcional: informar número de participantes
const clients = io.sockets.adapter.rooms.get(docId);
const count = clients ? clients.size : 0;
io.to(docId).emit('meta', { clients: count });
});


socket.on('edit', (newContent) => {
if (!currentDocId) return;
const doc = documents.get(currentDocId);
if (!doc) return;


doc.content = newContent;
doc.lastUpdated = new Date();
scheduleDocExpiry(currentDocId);


// difundir a los demás en la misma sala
socket.to(currentDocId).emit('update', newContent);
});


socket.on('disconnect', () => {
if (!currentDocId) return;


const clients = io.sockets.adapter.rooms.get(currentDocId);
const count = clients ? clients.size : 0;
io.to(currentDocId).emit('meta', { clients: count });
});
});


server.listen(PORT, () => {
console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
