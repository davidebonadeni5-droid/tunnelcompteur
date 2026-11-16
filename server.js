'use strict';
/*
 * Tunnel Compteur — compteur partagé des « tunnels » (digressions) : serveur HTTP + SQLite + synchro temps réel (SSE).
 * Aucune dépendance npm : node:http, node:sqlite (Node ≥ 22.5).
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT) || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'tunnel.db');
const PUBLIC = path.join(__dirname, 'public');
const TOKEN = process.env.ADMIN_TOKEN || ''; // si défini, requis pour toute écriture
const MAX_BODY = 256 * 1024;

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users(
    id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0, overrides TEXT NOT NULL DEFAULT '{}');
  CREATE TABLE IF NOT EXISTS scores(
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week TEXT NOT NULL, day INTEGER NOT NULL CHECK(day BETWEEN 0 AND 6),
    value INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(user_id, week, day));
  CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);
// Migration : nombre total de tournées payées par participant (toutes semaines confondues)
if (!db.prepare('PRAGMA table_info(users)').all().some(c => c.name === 'paid'))
  db.exec('ALTER TABLE users ADD COLUMN paid INTEGER NOT NULL DEFAULT 0');

/* ---------- Dates (fuseau du serveur, réglable via TZ) ---------- */
const todayIdx = (d = new Date()) => (d.getDay() + 6) % 7;
function weekId(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return t.getUTCFullYear() + '-W' + String(Math.ceil(((t - y) / 864e5 + 1) / 7)).padStart(2, '0');
}

/* ---------- Réglages par défaut ---------- */
const STEPS = [['🙊','Premier tunnel','On t’a vu partir…'],['👀','Regards appuyés',''],['⏱️','Chrono activé','La prochaine fois, on minute'],['🚧','Panneau « Déviation »',''],
  ['🎤','Micro coupé',''],['🐌','Réunion rallongée',''],['🌀','Spirale du hors-sujet',''],['🧭','Boussole perdue',''],['📢','Monologue officiel',''],['🎓','Conférence TED',''],
  ['🚇','Ligne de métro privée',''],['🕳️','Terrier de lapin',''],['☕','Café pour le voisin','Petit acompte'],['⚠️','Dernier avertissement','Ça sent le croissant'],
  ['🐇','Lapin blanc',''],['🗺️','Carte au trésor',''],['🎢','Montagnes russes',''],['📚','Encyclopédie vivante',''],['🔔','Alerte boulangerie','']];
const FINAL = ['🥐', 'Tournée de croissants', 'Pour toute l’équipe !'];
const baseRewards = n => [...STEPS.slice(0, n - 1), FINAL].map(([icon, label, desc], i) => ({ icon, label, desc, threshold: i + 1, color: i === n - 1 ? '#FFB800' : '' }));
const DEFAULT_SETTINGS = {
  thresholdMode: 'step', step: 1, tiers: 15,
  rewards: baseRewards(15),
  daily: { enabled: true, goal: 3, icon: '🚨', label: 'Journée tunnel' },
  team: { mode: 'avg', icon: '🥐', label: 'Petit-déjeuner géant pour tout le monde' },
  showRanking: true,
  afterFinal: 'cycle' // après la tournée : 'cycle' = on repart au palier 1, 'stop' = bloqué jusqu'au lundi
};

function getSettings() {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('main');
  if (!row) return structuredClone(DEFAULT_SETTINGS);
  try { return sanitizeSettings(JSON.parse(row.value)); } catch { return structuredClone(DEFAULT_SETTINGS); }
}
const str = (v, max, def = '') => (typeof v === 'string' ? v.trim().slice(0, max) : def) || def;
const int = (v, min, max, def) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };
const color = (v, def = '') => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : def);
function sanitizeSettings(s) {
  const d = DEFAULT_SETTINGS;
  s = s && typeof s === 'object' ? s : {};
  const rw = Array.isArray(s.rewards) ? s.rewards : [];
  const tiers = int(s.tiers ?? (rw.length || d.tiers), 3, 20, d.tiers);
  let prev = 0;
  const rewards = baseRewards(tiers).map((def, i) => {
    const r = rw[i] || {};
    const thr = Math.max(prev + 1, int(r.threshold, 1, 100000, def.threshold)); prev = thr;
    return { icon: str(r.icon, 8, def.icon), label: str(r.label, 60, def.label), desc: str(r.desc, 120, ''),
      threshold: thr, color: color(r.color, '') };
  });
  const daily = s.daily || {}, team = s.team || {};
  return {
    thresholdMode: s.thresholdMode === 'custom' ? 'custom' : 'step',
    step: int(s.step, 1, 10000, d.step), tiers,
    rewards,
    daily: { enabled: daily.enabled !== false, goal: int(daily.goal, 1, 100000, d.daily.goal),
      icon: str(daily.icon, 8, d.daily.icon), label: str(daily.label, 60, d.daily.label) },
    team: { mode: ['avg', 'min', 'max'].includes(team.mode) ? team.mode : 'avg',
      icon: str(team.icon, 8, d.team.icon), label: str(team.label, 60, d.team.label) },
    showRanking: s.showRanking !== false,
    afterFinal: s.afterFinal === 'stop' ? 'stop' : 'cycle'
  };
}
function sanitizeOverrides(o) {
  const out = {};
  if (!o || typeof o !== 'object') return out;
  for (let i = 0; i < 20; i++) {
    const r = o[i] || o[String(i)];
    if (!r) continue;
    const icon = str(r.icon, 8), label = str(r.label, 60);
    if (icon || label) out[i] = { icon, label };
  }
  return out;
}

/* ---------- Tournées ---------- */
// Nombre de tournées gagnées pour un total hebdomadaire (même règle que le front)
function roundsFor(total, s) {
  const goal = s.thresholdMode === 'step' ? s.tiers * s.step : s.rewards[s.rewards.length - 1].threshold;
  return s.afterFinal === 'stop' ? (total >= goal ? 1 : 0) : Math.floor(total / goal);
}

/* ---------- Lecture de l'état ---------- */
function state() {
  const week = weekId(), settings = getSettings();
  const users = db.prepare('SELECT * FROM users ORDER BY position, rowid').all().map(u => ({
    id: u.id, name: u.name, color: u.color, overrides: JSON.parse(u.overrides || '{}'), days: [0, 0, 0, 0, 0, 0, 0],
    paid: u.paid || 0, pastRounds: 0
  }));
  const byId = Object.fromEntries(users.map(u => [u.id, u]));
  for (const r of db.prepare('SELECT user_id, day, value FROM scores WHERE week = ?').all(week)) {
    if (byId[r.user_id]) byId[r.user_id].days[r.day] = r.value;
  }
  // Tournées gagnées les semaines précédentes : restent dues tant qu'elles ne sont pas payées
  for (const r of db.prepare('SELECT user_id, SUM(value) AS t FROM scores WHERE week <> ? GROUP BY user_id, week').all(week)) {
    if (byId[r.user_id]) byId[r.user_id].pastRounds += roundsFor(Number(r.t), settings);
  }
  const history = db.prepare(`SELECT week, SUM(value) AS total FROM scores WHERE week <> ?
    GROUP BY week ORDER BY week DESC LIMIT 8`).all(week).map(r => ({ week: r.week, total: Number(r.total) }));
  return { week, today: todayIdx(), users, settings, history, rev, boot: BOOT, server: true };
}

/* ---------- Écritures ---------- */
let rev = 0;
const uid = () => crypto.randomBytes(5).toString('hex');
const BOOT = uid();
const tx = fn => { db.exec('BEGIN'); try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } };
const userExists = id => !!db.prepare('SELECT 1 FROM users WHERE id = ?').get(id);
function setScore(userId, day, value) {
  db.prepare(`INSERT INTO scores(user_id, week, day, value) VALUES(?,?,?,?)
    ON CONFLICT(user_id, week, day) DO UPDATE SET value = excluded.value`).run(userId, weekId(), day, value);
}
function getScore(userId, day) {
  const r = db.prepare('SELECT value FROM scores WHERE user_id = ? AND week = ? AND day = ?').get(userId, weekId(), day);
  return r ? r.value : 0;
}
function seedDemo() {
  tx(() => {
    db.exec('DELETE FROM scores; DELETE FROM users;');
    const ti = todayIdx();
    [['Davide', '#00F0FF', 13], ['Mathieu', '#c77dff', 9], ['Bryan', '#2dff9a', 5], ['Victor', '#ff6bd6', 2], ['Maeva', '#ffd166', 0], ['Anton', '#4cc9f0', 0]].forEach(([name, c, total], p) => {
      const id = uid();
      db.prepare('INSERT INTO users(id, name, color, position) VALUES(?,?,?,?)').run(id, name, c, p);
      let left = total;
      for (let i = 0; i <= ti; i++) {
        const v = i === ti ? left : Math.min(left, Math.floor(total / (ti + 1) * (0.7 + ((i * 37) % 6) / 10)));
        setScore(id, i, v); left -= v;
      }
    });
  });
}
if (!db.prepare('SELECT 1 FROM users LIMIT 1').get() && !db.prepare('SELECT 1 FROM settings LIMIT 1').get()) seedDemo();

/* ---------- Temps réel (Server-Sent Events) ---------- */
const clients = new Set();
function broadcast(event) {
  rev++;
  const st = state();
  const payload = `event: change\ndata: ${JSON.stringify({ event, state: st })}\n\n`;
  for (const res of clients) res.write(payload);
  return st;
}
// Diffuse le changement à tous les écrans et renvoie le nouvel état à l'auteur de la requête
const done = (res, code, event, extra = {}) => send(res, code, { ...extra, event, state: broadcast(event) });
setInterval(() => { for (const res of clients) res.write(': ping\n\n'); }, 25000).unref();
// Bascule de semaine / de jour : on prévient les écrans
let lastKey = weekId() + todayIdx();
setInterval(() => { const k = weekId() + todayIdx(); if (k !== lastKey) { lastKey = k; broadcast({ type: 'rollover' }); } }, 30000).unref();

/* ---------- HTTP ---------- */
function send(res, code, body, headers = {}) {
  const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(data);
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > MAX_BODY) { reject(Object.assign(new Error('Corps trop volumineux'), { code: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { if (!chunks.length) return resolve({}); try { resolve(JSON.parse(Buffer.concat(chunks))); } catch { reject(Object.assign(new Error('JSON invalide'), { code: 400 })); } });
    req.on('error', reject);
  });
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };
function serveStatic(req, res, pathname) {
  const file = path.normalize(path.join(PUBLIC, pathname === '/' ? 'index.html' : pathname));
  if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, { error: 'Interdit' });
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, { error: 'Introuvable' });
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
    res.end(data);
  });
}
const fail = (code, msg) => Object.assign(new Error(msg), { code });

async function api(req, res, url) {
  const m = req.method, p = url.pathname;
  if (m === 'GET' && p === '/api/state') return send(res, 200, state());
  if (m === 'GET' && p === '/api/health') return send(res, 200, { ok: true });
  if (m === 'GET' && p === '/api/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write(`retry: 3000\nevent: change\ndata: ${JSON.stringify({ event: { type: 'hello' }, state: state() })}\n\n`);
    clients.add(res); req.on('close', () => clients.delete(res));
    return;
  }
  if (m === 'GET' && p === '/api/export') {
    const s = state();
    return send(res, 200, { exportedAt: new Date().toISOString(), settings: s.settings,
      users: db.prepare('SELECT * FROM users').all(), scores: db.prepare('SELECT * FROM scores').all() },
      { 'Content-Disposition': 'attachment; filename="tunnel-compteur.json"' });
  }

  if (TOKEN && req.headers['x-admin-token'] !== TOKEN) throw fail(401, 'Jeton administrateur requis');
  const b = await readJson(req);
  let mu;
  if (m === 'POST' && p === '/api/users') {
    const name = str(b.name, 40); if (!name) throw fail(400, 'Nom requis');
    const id = uid(), pos = (db.prepare('SELECT MAX(position) AS p FROM users').get().p ?? -1) + 1;
    db.prepare('INSERT INTO users(id, name, color, position, overrides) VALUES(?,?,?,?,?)')
      .run(id, name, color(b.color, '#00F0FF'), pos, JSON.stringify(sanitizeOverrides(b.overrides)));
    return done(res, 201, { type: 'user-added', userId: id }, { id });
  }
  if ((mu = p.match(/^\/api\/users\/([a-z0-9]+)$/))) {
    const id = mu[1]; if (!userExists(id)) throw fail(404, 'Utilisateur introuvable');
    if (m === 'PATCH') {
      const cur = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      db.prepare('UPDATE users SET name = ?, color = ?, overrides = ? WHERE id = ?').run(
        str(b.name, 40, cur.name), color(b.color, cur.color),
        b.overrides !== undefined ? JSON.stringify(sanitizeOverrides(b.overrides)) : cur.overrides, id);
      return done(res, 200, { type: 'user-updated', userId: id });
    }
    if (m === 'DELETE') {
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
      return done(res, 200, { type: 'user-deleted', userId: id });
    }
  }
  if ((mu = p.match(/^\/api\/users\/([a-z0-9]+)\/score$/)) && m === 'POST') {
    const id = mu[1]; if (!userExists(id)) throw fail(404, 'Utilisateur introuvable');
    const day = int(b.day, 0, 6, todayIdx());
    const value = tx(() => {
      const before = getScore(id, day);
      const v = b.value !== undefined ? int(b.value, 0, 1e6, before) : Math.max(0, Math.min(1e6, before + int(b.delta, -1e6, 1e6, 0)));
      setScore(id, day, v); return { before, v };
    });
    return done(res, 200, { type: 'score', userId: id, day, delta: value.v - value.before }, { value: value.v });
  }
  if ((mu = p.match(/^\/api\/users\/([a-z0-9]+)\/paid$/)) && m === 'POST') {
    const id = mu[1]; if (!userExists(id)) throw fail(404, 'Utilisateur introuvable');
    const u = state().users.find(x => x.id === id);
    const earned = u.pastRounds + roundsFor(u.days.reduce((a, v) => a + v, 0), getSettings());
    const paid = Math.max(0, Math.min(earned, u.paid + int(b.delta, -1, 1, 1)));
    if (paid === u.paid) throw fail(409, paid ? 'Aucune tournée à payer' : 'Aucune tournée payée à annuler');
    db.prepare('UPDATE users SET paid = ? WHERE id = ?').run(paid, id);
    return done(res, 200, { type: 'paid', userId: id, delta: paid - u.paid });
  }
  if (m === 'PUT' && p === '/api/settings') {
    db.prepare(`INSERT INTO settings(key, value) VALUES('main', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
      .run(JSON.stringify(sanitizeSettings(b)));
    return done(res, 200, { type: 'settings' });
  }
  if (m === 'POST' && p === '/api/reset') {
    db.prepare('DELETE FROM scores WHERE week = ?').run(weekId());
    return done(res, 200, { type: 'reset' });
  }
  if (m === 'POST' && p === '/api/demo') { seedDemo(); return done(res, 200, { type: 'demo' }); }
  if (m === 'POST' && p === '/api/import') {
    if (!Array.isArray(b.users) || !Array.isArray(b.scores)) throw fail(400, 'Fichier d’export invalide');
    tx(() => {
      db.exec('DELETE FROM scores; DELETE FROM users;');
      const ids = new Set();
      b.users.slice(0, 500).forEach((u, i) => {
        const id = /^[a-z0-9]{1,20}$/.test(u.id) ? u.id : uid(); ids.add(id);
        db.prepare('INSERT INTO users(id, name, color, position, overrides, paid) VALUES(?,?,?,?,?,?)').run(
          id, str(u.name, 40, 'Sans nom'), color(u.color, '#00F0FF'), i,
          JSON.stringify(sanitizeOverrides(typeof u.overrides === 'string' ? JSON.parse(u.overrides || '{}') : u.overrides)),
          int(u.paid, 0, 1e6, 0));
      });
      for (const s of b.scores.slice(0, 200000)) {
        if (!ids.has(s.user_id) || !/^\d{4}-W\d{2}$/.test(s.week)) continue;
        db.prepare('INSERT OR REPLACE INTO scores(user_id, week, day, value) VALUES(?,?,?,?)')
          .run(s.user_id, s.week, int(s.day, 0, 6, 0), int(s.value, 0, 1e6, 0));
      }
      if (b.settings) db.prepare(`INSERT OR REPLACE INTO settings(key, value) VALUES('main', ?)`).run(JSON.stringify(sanitizeSettings(b.settings)));
    });
    return done(res, 200, { type: 'import' });
  }
  throw fail(404, 'Route inconnue');
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Méthode non autorisée' });
    serveStatic(req, res, decodeURIComponent(url.pathname));
  } catch (e) {
    if (!res.headersSent) send(res, e.code >= 400 && e.code < 600 ? e.code : 500, { error: e.code ? e.message : 'Erreur serveur' });
    if (!e.code) console.error(e);
  }
});
server.listen(PORT, () => console.log(`Tunnel Compteur sur http://localhost:${PORT} (base : ${DB_PATH})`));
const stop = () => { server.close(); for (const c of clients) c.end(); db.close(); process.exit(0); };
process.on('SIGTERM', stop); process.on('SIGINT', stop);
