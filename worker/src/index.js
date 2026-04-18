/**
 * Blink Backend - Cloudflare Worker + Durable Objects
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function corsResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// ── Password hashing (PBKDF2) ──────────────────────────────────────────────

async function hashPassword(password) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  const toHex = (buf) => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  return toHex(salt) + ':' + toHex(bits);
}

async function verifyPassword(password, stored) {
  const [saltHex, hashHex] = stored.split(':');
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map(b => parseInt(b, 16)));
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  const newHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
  return newHex === hashHex;
}

// ── JWT (HMAC-SHA256) ──────────────────────────────────────────────────────

function b64url(str) {
  return btoa(str).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function signJWT(payload, secret) {
  const enc = new TextEncoder();
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000) }));
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${header}.${body}`));
  const sigStr = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${header}.${body}.${sigStr}`;
}

// ── Main handler ──────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (url.pathname === '/api/auth/register' && request.method === 'POST') {
      return handleRegister(request, env);
    }

    if (url.pathname === '/api/auth/login' && request.method === 'POST') {
      return handleLogin(request, env);
    }

    if (url.pathname === '/api/auth/google' && request.method === 'POST') {
      return handleGoogleAuth(request, env);
    }

    if (url.pathname === '/api/channels' && request.method === 'GET') {
      return handleChannels(request, env);
    }

    if (url.pathname.startsWith('/api/ws')) {
      return handleWebSocket(request, env);
    }

    if (url.pathname.startsWith('/api/messages')) {
      return handleMessages(request, env);
    }

    if (url.pathname.startsWith('/api/admin/users/') && request.method === 'DELETE') {
      const userId = url.pathname.split('/').pop();
      return handleDeleteUser(userId, env);
    }

    if (url.pathname.startsWith('/api/admin/users')) {
      return handleAdminUsers(request, env);
    }

    if (url.pathname.startsWith('/api/admin')) {
      return handleAdmin(request, env);
    }

    return new Response('Blink API', { status: 200 });
  }
};

// ── Auth handlers ─────────────────────────────────────────────────────────

async function handleRegister(request, env) {
  let body;
  try { body = await request.json(); } catch {
    return corsResponse(JSON.stringify({ error: 'Invalid JSON' }), 400);
  }

  const { email, password, full_name } = body;
  if (!email || !password || !full_name) {
    return corsResponse(JSON.stringify({ error: 'email, password and full_name are required' }), 400);
  }
  if (password.length < 6) {
    return corsResponse(JSON.stringify({ error: 'Password must be at least 6 characters' }), 400);
  }

  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) {
    return corsResponse(JSON.stringify({ error: 'Email already registered' }), 409);
  }

  const id = crypto.randomUUID();
  const password_hash = await hashPassword(password);

  await env.DB.prepare(
    'INSERT INTO users (id, email, password_hash, full_name) VALUES (?, ?, ?, ?)'
  ).bind(id, email, password_hash, full_name).run();

  await env.DB.prepare(
    'INSERT OR IGNORE INTO channel_members (channel_id, user_id, role) SELECT id, ?, ? FROM channels'
  ).bind(id, 'MEMBER').run();

  await env.DB.prepare(
    "INSERT INTO activity_logs (user_id, action, details) VALUES (?, 'USER_JOINED', ?)"
  ).bind(id, `${full_name} joined the workspace`).run();

  const token = await signJWT({ id, email, full_name, role: 'MEMBER' }, env.JWT_SECRET);
  return corsResponse(JSON.stringify({ token, user: { id, email, full_name, role: 'MEMBER' } }), 201);
}

async function handleLogin(request, env) {
  let body;
  try { body = await request.json(); } catch {
    return corsResponse(JSON.stringify({ error: 'Invalid JSON' }), 400);
  }

  const { email, password } = body;
  if (!email || !password) {
    return corsResponse(JSON.stringify({ error: 'email and password are required' }), 400);
  }

  const user = await env.DB.prepare(
    'SELECT id, email, password_hash, full_name, role FROM users WHERE email = ?'
  ).bind(email).first();

  if (!user) {
    return corsResponse(JSON.stringify({ error: 'Invalid email or password' }), 401);
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return corsResponse(JSON.stringify({ error: 'Invalid email or password' }), 401);
  }

  await env.DB.prepare('UPDATE users SET status = ?, last_active = CURRENT_TIMESTAMP WHERE id = ?')
    .bind('ONLINE', user.id).run();

  await env.DB.prepare(
    "INSERT INTO activity_logs (user_id, action, details) VALUES (?, 'USER_LOGIN', ?)"
  ).bind(user.id, `${user.full_name} signed in`).run();

  const token = await signJWT(
    { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
    env.JWT_SECRET
  );
  return corsResponse(JSON.stringify({
    token,
    user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role }
  }));
}

// ── Google OAuth handler ──────────────────────────────────────────────────

async function handleGoogleAuth(request, env) {
  let body;
  try { body = await request.json(); } catch {
    return corsResponse(JSON.stringify({ error: 'Invalid JSON' }), 400);
  }

  const { credential } = body;
  if (!credential) {
    return corsResponse(JSON.stringify({ error: 'Missing credential' }), 400);
  }

  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
  const payload = await res.json();

  if (!res.ok || payload.error) {
    return corsResponse(JSON.stringify({ error: 'Invalid Google token' }), 401);
  }

  if (payload.aud !== env.GOOGLE_CLIENT_ID) {
    return corsResponse(JSON.stringify({ error: 'Token audience mismatch' }), 401);
  }

  const { email, name } = payload;

  let user = await env.DB.prepare(
    'SELECT id, email, full_name, role FROM users WHERE email = ?'
  ).bind(email).first();

  if (!user) {
    const id = crypto.randomUUID();
    await env.DB.prepare(
      'INSERT INTO users (id, email, password_hash, full_name) VALUES (?, ?, ?, ?)'
    ).bind(id, email, '', name).run();

    await env.DB.prepare(
      'INSERT OR IGNORE INTO channel_members (channel_id, user_id, role) SELECT id, ?, ? FROM channels'
    ).bind(id, 'MEMBER').run();

    await env.DB.prepare(
      "INSERT INTO activity_logs (user_id, action, details) VALUES (?, 'USER_JOINED', ?)"
    ).bind(id, `${name} joined via Google`).run();

    user = { id, email, full_name: name, role: 'MEMBER' };
  }

  await env.DB.prepare('UPDATE users SET status = ?, last_active = CURRENT_TIMESTAMP WHERE id = ?')
    .bind('ONLINE', user.id).run();

  const token = await signJWT(
    { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
    env.JWT_SECRET
  );
  return corsResponse(JSON.stringify({
    token,
    user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role }
  }));
}

// ── Channel handler ───────────────────────────────────────────────────────

async function handleChannels(_request, env) {
  const { results } = await env.DB.prepare(
    'SELECT id, name, description, type FROM channels ORDER BY name ASC'
  ).all();
  return corsResponse(JSON.stringify(results));
}

// ── WebSocket handler ─────────────────────────────────────────────────────

async function handleWebSocket(request, env) {
  const upgradeHeader = request.headers.get('Upgrade');
  if (!upgradeHeader || upgradeHeader !== 'websocket') {
    return new Response('Expected Upgrade: websocket', { status: 426 });
  }
  const url = new URL(request.url);
  const roomId = url.searchParams.get('room') || 'general';
  const id = env.CHAT_ROOM.idFromName(roomId);
  const room = env.CHAT_ROOM.get(id);
  return room.fetch(request);
}

// ── Message handler ───────────────────────────────────────────────────────

async function handleMessages(request, env) {
  const { pathname } = new URL(request.url);
  const channelId = pathname.split('/').pop() || 'general';
  const { results } = await env.DB.prepare(
    'SELECT m.id, m.channel_id, m.user_id, m.content, m.type, m.timestamp, u.full_name FROM messages m JOIN users u ON m.user_id = u.id WHERE m.channel_id = ? ORDER BY m.timestamp ASC LIMIT 100'
  ).bind(channelId).all();
  return corsResponse(JSON.stringify(results));
}

// ── Admin handlers ────────────────────────────────────────────────────────

async function handleAdmin(_request, env) {
  const totalUsers = await env.DB.prepare('SELECT COUNT(*) as count FROM users').first('count');
  const totalMessages = await env.DB.prepare('SELECT COUNT(*) as count FROM messages').first('count');
  const activeToday = await env.DB.prepare(
    "SELECT COUNT(*) as count FROM users WHERE last_active >= datetime('now', '-1 day')"
  ).first('count');

  const { results: activities } = await env.DB.prepare(
    'SELECT al.action, al.details, al.timestamp, u.full_name FROM activity_logs al LEFT JOIN users u ON al.user_id = u.id ORDER BY al.timestamp DESC LIMIT 20'
  ).all();

  return corsResponse(JSON.stringify({
    stats: { totalUsers, totalMessages, activeToday, filesUploaded: 0 },
    activities,
  }));
}

async function handleDeleteUser(userId, env) {
  await env.DB.prepare('DELETE FROM activity_logs WHERE user_id = ?').bind(userId).run();
  await env.DB.prepare('DELETE FROM files WHERE uploader_id = ?').bind(userId).run();
  await env.DB.prepare('DELETE FROM messages WHERE user_id = ?').bind(userId).run();
  await env.DB.prepare('DELETE FROM channel_members WHERE user_id = ?').bind(userId).run();
  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
  return corsResponse(JSON.stringify({ success: true }));
}

async function handleAdminUsers(_request, env) {
  const { results } = await env.DB.prepare(
    'SELECT id, email, full_name, role, status, last_active, created_at FROM users ORDER BY created_at DESC'
  ).all();
  return corsResponse(JSON.stringify(results));
}

// ── Durable Object: ChatRoom ──────────────────────────────────────────────

export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = [];
  }

  async fetch(request) {
    const [client, server] = Object.values(new WebSocketPair());
    await this.handleSession(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async handleSession(webSocket) {
    webSocket.accept();
    const session = { webSocket, channelId: null };
    this.sessions.push(session);

    webSocket.addEventListener('message', async (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data.type === 'join') {
          session.channelId = data.channelId;
        }
        if (data.type === 'typing') {
          this.broadcast({
            type: 'typing',
            userId: data.userId,
            userName: data.userName,
            channelId: data.channelId,
          }, data.channelId, webSocket);
        }

        if (data.type === 'message') {
          const messageId = crypto.randomUUID();
          const timestamp = new Date().toISOString();

          await this.env.DB.prepare(
            'INSERT INTO messages (id, channel_id, user_id, content, type) VALUES (?, ?, ?, ?, ?)'
          ).bind(messageId, data.channelId, data.userId, data.content, 'TEXT').run();

          this.broadcast({
            type: 'new_message',
            message: {
              id: messageId,
              channel_id: data.channelId,
              user_id: data.userId,
              content: data.content,
              full_name: data.userName,
              timestamp,
            }
          }, data.channelId);
        }
      } catch (e) {
        console.error('WS Error:', e);
      }
    });

    webSocket.addEventListener('close', () => {
      this.sessions = this.sessions.filter(s => s !== session);
    });
  }

  broadcast(message, channelId, exclude = null) {
    const data = JSON.stringify(message);
    this.sessions.forEach(session => {
      if (session.channelId === channelId && session.webSocket !== exclude) {
        try {
          session.webSocket.send(data);
        } catch {
          this.sessions = this.sessions.filter(s => s !== session);
        }
      }
    });
  }
}
