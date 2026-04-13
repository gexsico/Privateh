/* ═══════════════════════════════════════════════
   WHISPER — script.js
   Vanilla JS — no frameworks
═══════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── STATE ────────────────────────────────────
  let currentUser = null;
  let socket = null;
  let panicMode = false;
  let deleteClickCount = 0;
  let deleteClickTimer = null;
  let typingTimer = null;
  let lastSender = null;

  const USERS = ['Bebo', 'ansh'];

  // ─── DOM REFS ─────────────────────────────────
  const loginScreen   = document.getElementById('login-screen');
  const chatScreen    = document.getElementById('chat-screen');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const loginBtn      = document.getElementById('login-btn');
  const loginError    = document.getElementById('login-error');

  const myUsernameEl  = document.getElementById('my-username');
  const onlineList    = document.getElementById('online-list');
  const chatWithName  = document.getElementById('chat-with-name');
  const messagesList  = document.getElementById('messages-list');
  const messagesContainer = document.getElementById('messages-container');
  const emptyState    = document.getElementById('empty-state');
  const messageInput  = document.getElementById('message-input');
  const sendBtn       = document.getElementById('send-btn');
  const typingIndicator = document.getElementById('typing-indicator');

  const panicBtn      = document.getElementById('panic-btn');
  const deleteBtn     = document.getElementById('delete-btn');
  const logoutBtn     = document.getElementById('logout-btn');

  const confirmOverlay = document.getElementById('confirm-overlay');
  const confirmOk      = document.getElementById('confirm-ok');
  const confirmCancel  = document.getElementById('confirm-cancel');

  const panicOverlay  = document.getElementById('panic-overlay');
  const pageTitle     = document.getElementById('page-title');

  // ─── LOGIN ────────────────────────────────────
  function showError(msg) {
    loginError.textContent = msg;
    loginError.classList.remove('hidden');
  }

  function hideError() {
    loginError.classList.add('hidden');
  }

  loginBtn.addEventListener('click', doLogin);
  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doLogin();
  });
  usernameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') passwordInput.focus();
  });

  async function doLogin() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    hideError();

    if (!username || !password) {
      showError('⚠ please fill in both fields');
      return;
    }

    loginBtn.textContent = 'entering…';
    loginBtn.disabled = true;

    try {
      const res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (data.success) {
        currentUser = data.username;
        initChat();
      } else {
        showError('⚠ wrong credentials');
        loginBtn.textContent = 'enter →';
        loginBtn.disabled = false;
      }
    } catch (e) {
      showError('⚠ connection error');
      loginBtn.textContent = 'enter →';
      loginBtn.disabled = false;
    }
  }

  // ─── INIT CHAT ────────────────────────────────
  function initChat() {
    loginScreen.classList.remove('active');
    chatScreen.classList.add('active');

    myUsernameEl.textContent = currentUser;

    const other = USERS.find(u => u !== currentUser);
    chatWithName.textContent = other || '—';

    socket = io();

    socket.on('connect', () => {
      socket.emit('join', currentUser);
    });

    socket.on('history', (msgs) => {
      messagesList.innerHTML = '';
      lastSender = null;
      msgs.forEach(msg => renderMessage(msg));
      scrollToBottom();
    });

    socket.on('new_message', (msg) => {
      renderMessage(msg);
      scrollToBottom();
    });

    socket.on('online_users', (users) => {
      updateOnlineList(users);
    });

    socket.on('messages_cleared', () => {
      messagesList.innerHTML = '';
      lastSender = null;
      showEmpty(true);
    });
  }

  // ─── RENDER MESSAGE ───────────────────────────
  function renderMessage(msg) {
    showEmpty(false);

    const isMe = msg.username === currentUser;
    const isNewGroup = msg.username !== lastSender;
    lastSender = msg.username;

    const row = document.createElement('div');
    row.className = `message-row ${isMe ? 'me' : 'them'}${isNewGroup ? ' new-group' : ''}`;
    row.dataset.id = msg.id;

    if (isNewGroup) {
      const meta = document.createElement('div');
      meta.className = 'message-meta';
      meta.innerHTML = `<span class="meta-name">${escHtml(msg.username)}</span><span>${formatTime(msg.timestamp)}</span>`;
      row.appendChild(meta);
    }

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = msg.text;
    row.appendChild(bubble);

    messagesList.appendChild(row);
  }

  // ─── SEND MESSAGE ─────────────────────────────
  sendBtn.addEventListener('click', sendMessage);

  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize textarea
  messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 140) + 'px';

    // Typing indicator
    if (socket) {
      clearTimeout(typingTimer);
      socket.emit('typing', currentUser);
      typingTimer = setTimeout(() => socket.emit('stop_typing', currentUser), 1500);
    }
  });

  function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !socket) return;

    socket.emit('send_message', { text });
    messageInput.value = '';
    messageInput.style.height = 'auto';
  }

  // ─── ONLINE USERS ─────────────────────────────
  function updateOnlineList(users) {
    onlineList.innerHTML = '';
    users.forEach(u => {
      if (u !== currentUser) {
        const el = document.createElement('div');
        el.className = 'online-user-item';
        el.textContent = u;
        onlineList.appendChild(el);
      }
    });
  }

  // ─── SCROLL ───────────────────────────────────
  function scrollToBottom() {
    if (!panicMode) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  // ─── EMPTY STATE ──────────────────────────────
  function showEmpty(show) {
    if (show) {
      emptyState.style.display = 'block';
    } else {
      emptyState.style.display = 'none';
    }
  }

  // ─── PANIC MODE ───────────────────────────────
  panicBtn.addEventListener('click', togglePanic);

  function togglePanic() {
    panicMode = !panicMode;

    if (panicMode) {
      // Activate panic
      messagesContainer.classList.add('panic-blur');
      panicOverlay.classList.remove('hidden');
      panicOverlay.classList.add('active');
      pageTitle.textContent = 'Study Notes';
      panicBtn.innerHTML = '<span class="btn-icon">👁</span> restore view';
      messagesContainer.style.overflow = 'hidden';
    } else {
      // Restore
      messagesContainer.classList.remove('panic-blur');
      panicOverlay.classList.add('hidden');
      panicOverlay.classList.remove('active');
      pageTitle.textContent = 'whisper — private chat';
      panicBtn.innerHTML = '<span class="btn-icon">👁</span> panic mode';
      messagesContainer.style.overflow = 'auto';
      scrollToBottom();
    }
  }

  // ─── DELETE ALL ───────────────────────────────
  deleteBtn.addEventListener('click', handleDeleteClick);

  function handleDeleteClick() {
    deleteClickCount++;

    if (deleteClickTimer) clearTimeout(deleteClickTimer);

    if (deleteClickCount === 3) {
      // Triple click — instant delete
      deleteClickCount = 0;
      if (socket) socket.emit('delete_all');
      return;
    }

    // Single click → show confirm after short pause (to detect triple)
    deleteClickTimer = setTimeout(() => {
      if (deleteClickCount === 1) {
        showConfirm();
      }
      deleteClickCount = 0;
    }, 400);
  }

  function showConfirm() {
    confirmOverlay.classList.remove('hidden');
  }

  function hideConfirm() {
    confirmOverlay.classList.add('hidden');
  }

  confirmCancel.addEventListener('click', hideConfirm);
  confirmOverlay.addEventListener('click', (e) => {
    if (e.target === confirmOverlay) hideConfirm();
  });

  confirmOk.addEventListener('click', () => {
    hideConfirm();
    if (socket) socket.emit('delete_all');
  });

  // ─── LOGOUT ───────────────────────────────────
  logoutBtn.addEventListener('click', () => {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    currentUser = null;
    panicMode = false;
    messagesList.innerHTML = '';
    lastSender = null;
    usernameInput.value = '';
    passwordInput.value = '';
    loginBtn.textContent = 'enter →';
    loginBtn.disabled = false;
    pageTitle.textContent = 'whisper — private chat';
    messagesContainer.classList.remove('panic-blur');
    panicOverlay.classList.add('hidden');
    chatScreen.classList.remove('active');
    loginScreen.classList.add('active');
    showEmpty(true);
  });

  // ─── HELPERS ─────────────────────────────────
  function escHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatTime(iso) {
    const d = new Date(iso);
    let h = d.getHours(), m = d.getMinutes();
    const ampm = h >= 12 ? 'pm' : 'am';
    h = h % 12 || 12;
    return `${h}:${String(m).padStart(2,'0')} ${ampm}`;
  }

  // Init: show empty state
  showEmpty(true);

})();
