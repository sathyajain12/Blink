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

// ── Migrations ────────────────────────────────────────────────────────────

let _migrated = false;

async function runMigrations(env) {
  if (_migrated) return;
  _migrated = true;
  const tables = [
    `CREATE TABLE IF NOT EXISTS message_reactions (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      emoji TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(message_id, user_id, emoji)
    )`,
    `CREATE TABLE IF NOT EXISTS pinned_messages (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      pinned_by TEXT NOT NULL,
      pinned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(channel_id, message_id)
    )`,
    `CREATE TABLE IF NOT EXISTS invite_links (
      code TEXT PRIMARY KEY,
      created_by TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS dm_read_receipts (
      channel_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      last_read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (channel_id, user_id)
    )`,
  ];
  for (const t of tables) { try { await env.DB.prepare(t).run(); } catch {} }

  const alters = [
    'ALTER TABLE messages ADD COLUMN reply_to_id TEXT',
    'ALTER TABLE messages ADD COLUMN edited_at TIMESTAMP',
    'ALTER TABLE messages ADD COLUMN is_deleted INTEGER DEFAULT 0',
  ];
  for (const a of alters) { try { await env.DB.prepare(a).run(); } catch {} }
}

// ── Password / JWT ────────────────────────────────────────────────────────

async function hashPassword(password) {
  const enc = new TextEncoder();
  const km = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, km, 256);
  const hex = (b) => Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
  return hex(salt) + ':' + hex(bits);
}

async function verifyPassword(password, stored) {
  const [saltHex, hashHex] = stored.split(':');
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map(b => parseInt(b, 16)));
  const enc = new TextEncoder();
  const km = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, km, 256);
  return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('') === hashHex;
}

function b64url(s) { return btoa(s).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_'); }

async function signJWT(payload, secret) {
  const enc = new TextEncoder();
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000) }));
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${header}.${body}`));
  const sigStr = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${header}.${body}.${sigStr}`;
}

function decodeJWT(token) {
  try {
    const [, payload] = token.split('.');
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch { return null; }
}

function getAuth(request) {
  const auth = request.headers.get('Authorization') || '';
  return decodeJWT(auth.replace('Bearer ', ''));
}

function requireAdmin(request) {
  const user = getAuth(request);
  if (!user || (user.role !== 'OWNER' && user.role !== 'ADMIN'))
    return corsResponse(JSON.stringify({ error: 'Forbidden' }), 403);
  return null;
}

// ── Main Handler ──────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });

    await runMigrations(env);

    if (pathname === '/api/auth/register' && request.method === 'POST') return handleRegister(request, env);
    if (pathname === '/api/auth/login' && request.method === 'POST') return handleLogin(request, env);
    if (pathname === '/api/auth/google' && request.method === 'POST') return handleGoogleAuth(request, env);

    if (pathname === '/api/users/profile' && request.method === 'PUT') return handleUpdateProfile(request, env);
    if (pathname === '/api/users' && request.method === 'GET') return handleGetUsers(request, env);

    if (pathname === '/api/channels' && request.method === 'POST') return handleCreateChannel(request, env);
    if (pathname === '/api/channels' && request.method === 'GET') return handleChannels(request, env);

    if (pathname === '/api/dm' && request.method === 'POST') return handleCreateDM(request, env);
    if (pathname === '/api/dm' && request.method === 'GET') return handleGetDMs(request, env);

    if (pathname === '/api/unread' && request.method === 'GET') return handleGetUnread(request, env);

    if (pathname.startsWith('/api/ws')) return handleWebSocket(request, env);

    if (pathname.startsWith('/api/messages/') && request.method === 'PUT') return handleEditMessage(request, env);
    if (pathname.startsWith('/api/messages/') && request.method === 'DELETE') return handleDeleteMessage(request, env);
    if (pathname.startsWith('/api/messages/')) return handleMessages(request, env);

    if (pathname.startsWith('/api/pinned/') && request.method === 'POST') return handlePinMessage(request, env);
    if (pathname.startsWith('/api/pinned/') && request.method === 'DELETE') return handleUnpinMessage(request, env);
    if (pathname.startsWith('/api/pinned/')) return handleGetPinned(request, env);

    if (pathname.startsWith('/api/admin/users/') && request.method === 'DELETE')
      return handleDeleteUser(pathname.split('/').pop(), env, request);
    if (pathname.startsWith('/api/admin/users')) return handleAdminUsers(request, env);
    if (pathname.startsWith('/api/admin')) return handleAdmin(request, env);

    if (pathname === '/api/link-preview' && request.method === 'GET') return handleLinkPreview(request, env);
    if (pathname === '/api/search' && request.method === 'GET') return handleSearch(request, env);
    if (pathname === '/api/invite' && request.method === 'POST') return handleCreateInvite(request, env);
    if (pathname.startsWith('/api/invite/') && request.method === 'GET') return handleJoinInvite(request, env);
    if (pathname.startsWith('/api/read-receipt/') && request.method === 'PUT') return handleUpdateReadReceipt(request, env);
    if (pathname.startsWith('/api/read-receipt/') && request.method === 'GET') return handleGetReadReceipt(request, env);

    return new Response('Blink API', { status: 200 });
  }
};

// ── Auth ──────────────────────────────────────────────────────────────────

async function handleRegister(request, env) {
  let body; try { body = await request.json(); } catch { return corsResponse(JSON.stringify({ error: 'Invalid JSON' }), 400); }
  const { email, password, full_name } = body;
  if (!email || !password || !full_name) return corsResponse(JSON.stringify({ error: 'email, password and full_name are required' }), 400);
  if (password.length < 6) return corsResponse(JSON.stringify({ error: 'Password must be at least 6 characters' }), 400);

  if (await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first())
    return corsResponse(JSON.stringify({ error: 'Email already registered' }), 409);

  const id = crypto.randomUUID();
  const password_hash = await hashPassword(password);
  const count = await env.DB.prepare('SELECT COUNT(*) as c FROM users').first('c');
  const role = count === 0 ? 'OWNER' : 'MEMBER';

  await env.DB.prepare('INSERT INTO users (id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)').bind(id, email, password_hash, full_name, role).run();
  await env.DB.prepare("INSERT OR IGNORE INTO channel_members (channel_id, user_id, role) SELECT id, ?, 'MEMBER' FROM channels WHERE type != 'DM'").bind(id).run();
  await env.DB.prepare("INSERT INTO activity_logs (user_id, action, details) VALUES (?, 'USER_JOINED', ?)").bind(id, `${full_name} joined the workspace`).run();

  const token = await signJWT({ id, email, full_name, role }, env.JWT_SECRET);
  return corsResponse(JSON.stringify({ token, user: { id, email, full_name, role } }), 201);
}

async function handleLogin(request, env) {
  let body; try { body = await request.json(); } catch { return corsResponse(JSON.stringify({ error: 'Invalid JSON' }), 400); }
  const { email, password } = body;
  if (!email || !password) return corsResponse(JSON.stringify({ error: 'email and password are required' }), 400);

  const user = await env.DB.prepare('SELECT id, email, password_hash, full_name, role FROM users WHERE email = ?').bind(email).first();
  if (!user || !(await verifyPassword(password, user.password_hash)))
    return corsResponse(JSON.stringify({ error: 'Invalid email or password' }), 401);

  await env.DB.prepare('UPDATE users SET status = ?, last_active = CURRENT_TIMESTAMP WHERE id = ?').bind('ONLINE', user.id).run();
  await env.DB.prepare("INSERT INTO activity_logs (user_id, action, details) VALUES (?, 'USER_LOGIN', ?)").bind(user.id, `${user.full_name} signed in`).run();

  const token = await signJWT({ id: user.id, email: user.email, full_name: user.full_name, role: user.role }, env.JWT_SECRET);
  return corsResponse(JSON.stringify({ token, user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role } }));
}

async function handleGoogleAuth(request, env) {
  let body; try { body = await request.json(); } catch { return corsResponse(JSON.stringify({ error: 'Invalid JSON' }), 400); }
  const { credential } = body;
  if (!credential) return corsResponse(JSON.stringify({ error: 'Missing credential' }), 400);

  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
  const payload = await res.json();
  if (!res.ok || payload.error) return corsResponse(JSON.stringify({ error: 'Invalid Google token' }), 401);
  if (payload.aud !== env.GOOGLE_CLIENT_ID) return corsResponse(JSON.stringify({ error: 'Token audience mismatch' }), 401);

  const { email, name, picture } = payload;
  let user = await env.DB.prepare('SELECT id, email, full_name, role, avatar_url FROM users WHERE email = ?').bind(email).first();

  if (!user) {
    const id = crypto.randomUUID();
    await env.DB.prepare('INSERT INTO users (id, email, password_hash, full_name, avatar_url) VALUES (?, ?, ?, ?, ?)').bind(id, email, '', name, picture || null).run();
    await env.DB.prepare("INSERT OR IGNORE INTO channel_members (channel_id, user_id, role) SELECT id, ?, 'MEMBER' FROM channels WHERE type != 'DM'").bind(id).run();
    await env.DB.prepare("INSERT INTO activity_logs (user_id, action, details) VALUES (?, 'USER_JOINED', ?)").bind(id, `${name} joined via Google`).run();
    user = { id, email, full_name: name, role: 'MEMBER', avatar_url: picture || null };
  }

  await env.DB.prepare('UPDATE users SET status = ?, last_active = CURRENT_TIMESTAMP WHERE id = ?').bind('ONLINE', user.id).run();
  const token = await signJWT({ id: user.id, email: user.email, full_name: user.full_name, role: user.role }, env.JWT_SECRET);
  return corsResponse(JSON.stringify({ token, user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role, avatar_url: user.avatar_url } }));
}

// ── Users ─────────────────────────────────────────────────────────────────

async function handleGetUsers(request, env) {
  const user = getAuth(request);
  if (!user) return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);
  const { results } = await env.DB.prepare(
    'SELECT id, full_name, avatar_url, status FROM users WHERE id != ? ORDER BY full_name ASC'
  ).bind(user.id).all();
  return corsResponse(JSON.stringify(results));
}

async function handleUpdateProfile(request, env) {
  const user = getAuth(request);
  if (!user) return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);
  let body; try { body = await request.json(); } catch { return corsResponse(JSON.stringify({ error: 'Invalid JSON' }), 400); }
  const { full_name, avatar_url } = body;
  if (full_name) await env.DB.prepare('UPDATE users SET full_name = ? WHERE id = ?').bind(full_name, user.id).run();
  if (avatar_url !== undefined) await env.DB.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').bind(avatar_url, user.id).run();
  return corsResponse(JSON.stringify({ success: true }));
}

// ── Channels ──────────────────────────────────────────────────────────────

async function handleChannels(request, env) {
  const { results } = await env.DB.prepare(
    "SELECT id, name, description, type FROM channels WHERE type != 'DM' ORDER BY name ASC"
  ).all();
  return corsResponse(JSON.stringify(results));
}

async function handleCreateChannel(request, env) {
  const user = getAuth(request);
  if (!user) return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);
  let body; try { body = await request.json(); } catch { return corsResponse(JSON.stringify({ error: 'Invalid JSON' }), 400); }
  const { name, description } = body;
  if (!name) return corsResponse(JSON.stringify({ error: 'name required' }), 400);

  const id = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!id) return corsResponse(JSON.stringify({ error: 'Invalid channel name' }), 400);
  if (await env.DB.prepare('SELECT id FROM channels WHERE id = ?').bind(id).first())
    return corsResponse(JSON.stringify({ error: 'Channel already exists' }), 409);

  await env.DB.prepare("INSERT INTO channels (id, name, description, type) VALUES (?, ?, ?, 'PUBLIC')").bind(id, name, description || '').run();
  await env.DB.prepare("INSERT OR IGNORE INTO channel_members (channel_id, user_id, role) SELECT ?, id, 'MEMBER' FROM users").bind(id).run();
  return corsResponse(JSON.stringify({ id, name, description: description || '' }), 201);
}

// ── DMs ───────────────────────────────────────────────────────────────────

async function handleGetDMs(request, env) {
  const user = getAuth(request);
  if (!user) return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);
  const { results } = await env.DB.prepare(`
    SELECT c.id, u.id as other_user_id, u.full_name as other_user_name,
           u.avatar_url as other_user_avatar, u.status as other_user_status
    FROM channels c
    JOIN channel_members cm ON c.id = cm.channel_id AND cm.user_id = ?
    JOIN channel_members cm2 ON c.id = cm2.channel_id AND cm2.user_id != ?
    JOIN users u ON cm2.user_id = u.id
    WHERE c.type = 'DM'
    ORDER BY c.created_at DESC
  `).bind(user.id, user.id).all();
  return corsResponse(JSON.stringify(results.map(r => ({ ...r, type: 'DM' }))));
}

async function handleCreateDM(request, env) {
  const user = getAuth(request);
  if (!user) return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);
  let body; try { body = await request.json(); } catch { return corsResponse(JSON.stringify({ error: 'Invalid JSON' }), 400); }
  const { userId: otherUserId } = body;
  if (!otherUserId || otherUserId === user.id) return corsResponse(JSON.stringify({ error: 'Invalid userId' }), 400);

  const otherUser = await env.DB.prepare('SELECT id, full_name, avatar_url, status FROM users WHERE id = ?').bind(otherUserId).first();
  if (!otherUser) return corsResponse(JSON.stringify({ error: 'User not found' }), 404);

  const existing = await env.DB.prepare(`
    SELECT cm1.channel_id as id FROM channel_members cm1
    JOIN channel_members cm2 ON cm1.channel_id = cm2.channel_id
    JOIN channels c ON c.id = cm1.channel_id
    WHERE cm1.user_id = ? AND cm2.user_id = ? AND c.type = 'DM' LIMIT 1
  `).bind(user.id, otherUserId).first();

  if (existing) {
    return corsResponse(JSON.stringify({ id: existing.id, type: 'DM', other_user_id: otherUser.id, other_user_name: otherUser.full_name, other_user_avatar: otherUser.avatar_url, other_user_status: otherUser.status }));
  }

  const dmId = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO channels (id, name, type) VALUES (?, 'DM', 'DM')").bind(dmId).run();
  await env.DB.prepare('INSERT INTO channel_members (channel_id, user_id, role) VALUES (?, ?, ?)').bind(dmId, user.id, 'MEMBER').run();
  await env.DB.prepare('INSERT INTO channel_members (channel_id, user_id, role) VALUES (?, ?, ?)').bind(dmId, otherUserId, 'MEMBER').run();
  return corsResponse(JSON.stringify({ id: dmId, type: 'DM', other_user_id: otherUser.id, other_user_name: otherUser.full_name, other_user_avatar: otherUser.avatar_url, other_user_status: otherUser.status }), 201);
}

// ── Unread ────────────────────────────────────────────────────────────────

async function handleGetUnread(request, env) {
  const user = getAuth(request);
  if (!user) return corsResponse(JSON.stringify({}), 401);
  const url = new URL(request.url);
  const since = url.searchParams.get('since') || new Date(Date.now() - 3600000).toISOString();
  const { results } = await env.DB.prepare(`
    SELECT m.channel_id, COUNT(*) as count
    FROM messages m
    JOIN channel_members cm ON cm.channel_id = m.channel_id AND cm.user_id = ?
    WHERE m.timestamp > ? AND m.user_id != ? AND m.is_deleted = 0
    GROUP BY m.channel_id
  `).bind(user.id, since, user.id).all();
  const map = {};
  for (const r of results) map[r.channel_id] = r.count;
  return corsResponse(JSON.stringify(map));
}

// ── WebSocket ─────────────────────────────────────────────────────────────

async function handleWebSocket(request, env) {
  if (request.headers.get('Upgrade') !== 'websocket')
    return new Response('Expected Upgrade: websocket', { status: 426 });
  const roomId = new URL(request.url).searchParams.get('room') || 'general';
  const room = env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName(roomId));
  return room.fetch(request);
}

// ── Messages ──────────────────────────────────────────────────────────────

async function handleMessages(request, env) {
  const channelId = new URL(request.url).pathname.split('/').pop();
  const { results: messages } = await env.DB.prepare(`
    SELECT m.id, m.channel_id, m.user_id, m.content, m.type, m.timestamp,
           m.reply_to_id, m.edited_at, m.is_deleted,
           u.full_name, u.avatar_url,
           rm.content as reply_content, ru.full_name as reply_user_name
    FROM messages m
    JOIN users u ON m.user_id = u.id
    LEFT JOIN messages rm ON m.reply_to_id = rm.id
    LEFT JOIN users ru ON rm.user_id = ru.id
    WHERE m.channel_id = ? ORDER BY m.timestamp ASC LIMIT 100
  `).bind(channelId).all();

  if (!messages.length) return corsResponse(JSON.stringify([]));

  const ids = messages.map(m => `'${m.id.replace(/'/g, "''")}'`).join(',');
  const { results: reactions } = await env.DB.prepare(
    `SELECT message_id, emoji, user_id FROM message_reactions WHERE message_id IN (${ids})`
  ).all();

  const reactMap = {};
  for (const r of reactions) {
    if (!reactMap[r.message_id]) reactMap[r.message_id] = [];
    reactMap[r.message_id].push({ emoji: r.emoji, user_id: r.user_id });
  }
  return corsResponse(JSON.stringify(messages.map(m => ({ ...m, reactions: reactMap[m.id] || [] }))));
}

async function handleEditMessage(request, env) {
  const user = getAuth(request);
  if (!user) return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);
  const messageId = new URL(request.url).pathname.split('/').pop();
  let body; try { body = await request.json(); } catch { return corsResponse(JSON.stringify({ error: 'Invalid JSON' }), 400); }
  if (!body.content?.trim()) return corsResponse(JSON.stringify({ error: 'content required' }), 400);
  const editedAt = new Date().toISOString();
  await env.DB.prepare('UPDATE messages SET content = ?, edited_at = ? WHERE id = ? AND user_id = ?')
    .bind(body.content.trim(), editedAt, messageId, user.id).run();
  return corsResponse(JSON.stringify({ success: true, editedAt }));
}

async function handleDeleteMessage(request, env) {
  const user = getAuth(request);
  if (!user) return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);
  const messageId = new URL(request.url).pathname.split('/').pop();
  const msg = await env.DB.prepare('SELECT user_id FROM messages WHERE id = ?').bind(messageId).first();
  if (!msg) return corsResponse(JSON.stringify({ error: 'Not found' }), 404);
  if (msg.user_id !== user.id && user.role !== 'OWNER' && user.role !== 'ADMIN')
    return corsResponse(JSON.stringify({ error: 'Forbidden' }), 403);
  await env.DB.prepare('UPDATE messages SET is_deleted = 1 WHERE id = ?').bind(messageId).run();
  return corsResponse(JSON.stringify({ success: true }));
}

// ── Pinned Messages ───────────────────────────────────────────────────────

async function handleGetPinned(request, env) {
  const channelId = new URL(request.url).pathname.split('/').pop();
  const { results } = await env.DB.prepare(`
    SELECT pm.id, pm.message_id, pm.pinned_at, m.content, m.is_deleted,
           pu.full_name as pinned_by_name, mu.full_name as author_name
    FROM pinned_messages pm
    JOIN messages m ON pm.message_id = m.id
    JOIN users pu ON pm.pinned_by = pu.id
    JOIN users mu ON m.user_id = mu.id
    WHERE pm.channel_id = ? ORDER BY pm.pinned_at DESC LIMIT 10
  `).bind(channelId).all();
  return corsResponse(JSON.stringify(results));
}

async function handlePinMessage(request, env) {
  const user = getAuth(request);
  if (!user) return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);
  const channelId = new URL(request.url).pathname.split('/').pop();
  let body; try { body = await request.json(); } catch { return corsResponse(JSON.stringify({ error: 'Invalid JSON' }), 400); }
  await env.DB.prepare('INSERT OR IGNORE INTO pinned_messages (id, channel_id, message_id, pinned_by) VALUES (?, ?, ?, ?)')
    .bind(crypto.randomUUID(), channelId, body.messageId, user.id).run();
  return corsResponse(JSON.stringify({ success: true }));
}

async function handleUnpinMessage(request, env) {
  const user = getAuth(request);
  if (!user) return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);
  const messageId = new URL(request.url).pathname.split('/').pop();
  await env.DB.prepare('DELETE FROM pinned_messages WHERE message_id = ?').bind(messageId).run();
  return corsResponse(JSON.stringify({ success: true }));
}

// ── Admin ─────────────────────────────────────────────────────────────────

async function handleAdmin(request, env) {
  const deny = requireAdmin(request);
  if (deny) return deny;
  const totalUsers = await env.DB.prepare('SELECT COUNT(*) as c FROM users').first('c');
  const totalMessages = await env.DB.prepare('SELECT COUNT(*) as c FROM messages').first('c');
  const activeToday = await env.DB.prepare("SELECT COUNT(*) as c FROM users WHERE last_active >= datetime('now', '-1 day')").first('c');
  const { results: activities } = await env.DB.prepare(
    'SELECT al.action, al.details, al.timestamp, u.full_name FROM activity_logs al LEFT JOIN users u ON al.user_id = u.id ORDER BY al.timestamp DESC LIMIT 20'
  ).all();
  return corsResponse(JSON.stringify({ stats: { totalUsers, totalMessages, activeToday, filesUploaded: 0 }, activities }));
}

async function handleDeleteUser(userId, env, request) {
  const deny = requireAdmin(request);
  if (deny) return deny;
  await env.DB.prepare('DELETE FROM message_reactions WHERE user_id = ?').bind(userId).run();
  await env.DB.prepare('DELETE FROM activity_logs WHERE user_id = ?').bind(userId).run();
  await env.DB.prepare('DELETE FROM files WHERE uploader_id = ?').bind(userId).run();
  await env.DB.prepare('DELETE FROM messages WHERE user_id = ?').bind(userId).run();
  await env.DB.prepare('DELETE FROM channel_members WHERE user_id = ?').bind(userId).run();
  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
  return corsResponse(JSON.stringify({ success: true }));
}

async function handleAdminUsers(request, env) {
  const deny = requireAdmin(request);
  if (deny) return deny;
  const { results } = await env.DB.prepare(
    'SELECT id, email, full_name, role, status, last_active, created_at FROM users ORDER BY created_at DESC'
  ).all();
  return corsResponse(JSON.stringify(results));
}

// ── Link Preview ─────────────────────────────────────────────────────────

async function handleLinkPreview(request, env) {
  const rawUrl = new URL(request.url).searchParams.get('url') || '';
  if (!rawUrl) return corsResponse(JSON.stringify({ error: 'URL required' }), 400);
  try {
    const res = await fetch(rawUrl, { headers: { 'User-Agent': 'BlinkBot/1.0 (link preview)' } });
    const html = await res.text();
    const get = (prop) => {
      const m = html.match(new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))
        || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, 'i'));
      return m?.[1]?.trim() || '';
    };
    const title = get('og:title') || (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '').trim();
    const description = get('og:description');
    const image = get('og:image');
    const siteName = get('og:site_name') || new URL(rawUrl).hostname;
    return corsResponse(JSON.stringify({ title, description, image, siteName, url: rawUrl }));
  } catch {
    return corsResponse(JSON.stringify({ error: 'Failed to fetch preview' }), 500);
  }
}

// ── Search ────────────────────────────────────────────────────────────────

async function handleSearch(request, env) {
  const auth = getAuth(request);
  if (!auth) return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  const channelId = searchParams.get('channelId');
  if (!q) return corsResponse(JSON.stringify([]));
  if (channelId) {
    const { results } = await env.DB.prepare(`
      SELECT m.id, m.channel_id, m.content, m.timestamp, u.full_name, u.avatar_url
      FROM messages m JOIN users u ON m.user_id = u.id
      WHERE m.channel_id = ? AND m.content LIKE ? AND m.is_deleted = 0
      ORDER BY m.timestamp DESC LIMIT 50
    `).bind(channelId, `%${q}%`).all();
    return corsResponse(JSON.stringify(results));
  }
  const { results } = await env.DB.prepare(`
    SELECT m.id, m.channel_id, m.content, m.timestamp, u.full_name, u.avatar_url,
           c.name as channel_name, c.type as channel_type
    FROM messages m
    JOIN users u ON m.user_id = u.id
    JOIN channels c ON m.channel_id = c.id
    JOIN channel_members cm ON cm.channel_id = m.channel_id AND cm.user_id = ?
    WHERE m.content LIKE ? AND m.is_deleted = 0
    ORDER BY m.timestamp DESC LIMIT 50
  `).bind(auth.id, `%${q}%`).all();
  return corsResponse(JSON.stringify(results));
}

// ── Invite Links ──────────────────────────────────────────────────────────

async function handleCreateInvite(request, env) {
  const user = getAuth(request);
  if (!user) return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);
  const code = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare('INSERT INTO invite_links (code, created_by, expires_at) VALUES (?, ?, ?)')
    .bind(code, user.id, expiresAt).run();
  return corsResponse(JSON.stringify({ code, expiresAt }));
}

async function handleJoinInvite(request, env) {
  const user = getAuth(request);
  if (!user) return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);
  const code = new URL(request.url).pathname.split('/').pop();
  const invite = await env.DB.prepare('SELECT code, expires_at FROM invite_links WHERE code = ?').bind(code).first();
  if (!invite) return corsResponse(JSON.stringify({ error: 'Invalid invite link' }), 404);
  if (new Date(invite.expires_at) < new Date()) return corsResponse(JSON.stringify({ error: 'Invite link expired' }), 410);
  await env.DB.prepare("INSERT OR IGNORE INTO channel_members (channel_id, user_id, role) SELECT id, ?, 'MEMBER' FROM channels WHERE type != 'DM'").bind(user.id).run();
  return corsResponse(JSON.stringify({ success: true }));
}

// ── Read Receipts ─────────────────────────────────────────────────────────

async function handleUpdateReadReceipt(request, env) {
  const user = getAuth(request);
  if (!user) return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);
  const channelId = new URL(request.url).pathname.split('/').pop();
  await env.DB.prepare('INSERT OR REPLACE INTO dm_read_receipts (channel_id, user_id, last_read_at) VALUES (?, ?, CURRENT_TIMESTAMP)')
    .bind(channelId, user.id).run();
  return corsResponse(JSON.stringify({ success: true }));
}

async function handleGetReadReceipt(request, env) {
  const user = getAuth(request);
  if (!user) return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);
  const channelId = new URL(request.url).pathname.split('/').pop();
  const { results } = await env.DB.prepare(
    'SELECT user_id, last_read_at FROM dm_read_receipts WHERE channel_id = ?'
  ).bind(channelId).all();
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
    const session = { webSocket, channelId: null, userId: null };
    this.sessions.push(session);

    webSocket.addEventListener('message', async (msg) => {
      try {
        const data = JSON.parse(msg.data);

        if (data.type === 'join') {
          session.channelId = data.channelId;
          session.userId = data.userId;
        }

        if (data.type === 'typing') {
          this.broadcast({ type: 'typing', userId: data.userId, userName: data.userName, channelId: data.channelId }, data.channelId, webSocket);
        }

        if (data.type === 'message') {
          const messageId = crypto.randomUUID();
          const timestamp = new Date().toISOString();
          await this.env.DB.prepare(
            'INSERT INTO messages (id, channel_id, user_id, content, type, reply_to_id) VALUES (?, ?, ?, ?, ?, ?)'
          ).bind(messageId, data.channelId, data.userId, data.content, 'TEXT', data.replyToId || null).run();

          let replyContent = null, replyUserName = null;
          if (data.replyToId) {
            const rm = await this.env.DB.prepare(
              'SELECT m.content, u.full_name FROM messages m JOIN users u ON m.user_id = u.id WHERE m.id = ?'
            ).bind(data.replyToId).first();
            if (rm) { replyContent = rm.content; replyUserName = rm.full_name; }
          }

          this.broadcast({
            type: 'new_message',
            message: {
              id: messageId, channel_id: data.channelId, user_id: data.userId,
              content: data.content, full_name: data.userName, avatar_url: data.avatarUrl || null,
              timestamp, reply_to_id: data.replyToId || null,
              reply_content: replyContent, reply_user_name: replyUserName,
              is_deleted: 0, edited_at: null, reactions: [],
            }
          }, data.channelId);
        }

        if (data.type === 'edit_message') {
          const editedAt = new Date().toISOString();
          await this.env.DB.prepare('UPDATE messages SET content = ?, edited_at = ? WHERE id = ? AND user_id = ?')
            .bind(data.content, editedAt, data.messageId, data.userId).run();
          this.broadcast({ type: 'message_edited', messageId: data.messageId, content: data.content, editedAt, channelId: data.channelId }, data.channelId);
        }

        if (data.type === 'delete_message') {
          const row = await this.env.DB.prepare('SELECT user_id FROM messages WHERE id = ?').bind(data.messageId).first();
          if (row && (row.user_id === data.userId || data.userRole === 'OWNER' || data.userRole === 'ADMIN')) {
            await this.env.DB.prepare('UPDATE messages SET is_deleted = 1 WHERE id = ?').bind(data.messageId).run();
            this.broadcast({ type: 'message_deleted', messageId: data.messageId, channelId: data.channelId }, data.channelId);
          }
        }

        if (data.type === 'toggle_reaction') {
          const existing = await this.env.DB.prepare(
            'SELECT id FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?'
          ).bind(data.messageId, data.userId, data.emoji).first();

          if (existing) {
            await this.env.DB.prepare('DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?')
              .bind(data.messageId, data.userId, data.emoji).run();
          } else {
            await this.env.DB.prepare('INSERT INTO message_reactions (id, message_id, user_id, emoji) VALUES (?, ?, ?, ?)')
              .bind(crypto.randomUUID(), data.messageId, data.userId, data.emoji).run();
          }

          const { results: reactions } = await this.env.DB.prepare(
            'SELECT emoji, user_id FROM message_reactions WHERE message_id = ?'
          ).bind(data.messageId).all();
          this.broadcast({ type: 'reaction_updated', messageId: data.messageId, reactions, channelId: data.channelId }, data.channelId);
        }

        if (data.type === 'pin_message') {
          await this.env.DB.prepare('INSERT OR IGNORE INTO pinned_messages (id, channel_id, message_id, pinned_by) VALUES (?, ?, ?, ?)')
            .bind(crypto.randomUUID(), data.channelId, data.messageId, data.userId).run();
          this.broadcast({ type: 'message_pinned', messageId: data.messageId, channelId: data.channelId }, data.channelId);
        }

        if (data.type === 'unpin_message') {
          await this.env.DB.prepare('DELETE FROM pinned_messages WHERE message_id = ? AND channel_id = ?')
            .bind(data.messageId, data.channelId).run();
          this.broadcast({ type: 'message_unpinned', messageId: data.messageId, channelId: data.channelId }, data.channelId);
        }

      } catch (e) { console.error('WS Error:', e); }
    });

    webSocket.addEventListener('close', () => {
      this.sessions = this.sessions.filter(s => s !== session);
    });
  }

  broadcast(message, channelId, exclude = null) {
    const data = JSON.stringify(message);
    this.sessions.forEach(session => {
      if (session.channelId === channelId && session.webSocket !== exclude) {
        try { session.webSocket.send(data); } catch {
          this.sessions = this.sessions.filter(s => s !== session);
        }
      }
    });
  }
}

