const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files
app.use(express.static(path.join(__dirname)));
app.use(express.json());

// ─── AUTH ───────────────────────────────────────────────────────────────────
const USERS = {
  Bebo: 'merabf',
  ansh:  'merigf'
};

// Track online sockets: socketId → username
const onlineUsers = {};

// Message store
let messages = [];

// ─── LOGIN ENDPOINT ─────────────────────────────────────────────────────────
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (USERS[username] && USERS[username] === password) {
    res.json({ success: true, username });
  } else {
    res.json({ success: false, message: 'Invalid username or password.' });
  }
});

// ─── SOCKET.IO ──────────────────────────────────────────────────────────────
io.on('connection', (socket) => {

  // User joins with their username
  socket.on('join', (username) => {
    onlineUsers[socket.id] = username;

    // Send message history to the newly joined user
    socket.emit('history', messages);

    // Broadcast online status
    io.emit('online_users', Object.values(onlineUsers));
  });

  // New message
  socket.on('send_message', (data) => {
    const username = onlineUsers[socket.id];
    if (!username) return;

    const msg = {
      id: Date.now() + Math.random().toString(36).slice(2),
      username,
      text: data.text,
      timestamp: new Date().toISOString()
    };

    messages.push(msg);
    io.emit('new_message', msg);
  });

  // Delete all messages
  socket.on('delete_all', () => {
    messages = [];
    io.emit('messages_cleared');
  });

  // Disconnect
  socket.on('disconnect', () => {
    delete onlineUsers[socket.id];
    io.emit('online_users', Object.values(onlineUsers));
  });
});

// ─── START ───────────────────────────────────────────────────────────────────
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`\n✅  Private chat running at http://localhost:${PORT}\n`);
});
