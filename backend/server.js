import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
process.env.TZ = 'America/Sao_Paulo';

const APP_TIMEZONE = 'America/Sao_Paulo';

function todayBrasiliaISO() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const animalsUploadsDir = path.join(__dirname, 'uploads', 'animals');
const avatarsUploadsDir = path.join(__dirname, 'uploads', 'avatars');
const personsUploadsDir = path.join(__dirname, 'uploads', 'persons');
fs.mkdirSync(animalsUploadsDir, { recursive: true });
fs.mkdirSync(avatarsUploadsDir, { recursive: true });
fs.mkdirSync(personsUploadsDir, { recursive: true });

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'ariane_mvp_dev_secret';

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

function uploadKind(req) {
  return String(req.query.kind || req.body?.kind || 'animal').toLowerCase();
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const kind = uploadKind(req);
      if (kind === 'avatar') return cb(null, avatarsUploadsDir);
      if (kind === 'person-doc') return cb(null, personsUploadsDir);
      return cb(null, animalsUploadsDir);
    },
    filename: (req, file, cb) => {
      const kind = uploadKind(req);
      const prefix = kind === 'avatar' ? 'avatar' : kind === 'person-doc' ? 'person' : 'animal';
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const kind = uploadKind(req);
    const images = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const ok =
      kind === 'person-doc'
        ? [...images, 'application/pdf'].includes(file.mimetype)
        : images.includes(file.mimetype);
    cb(ok ? null : new Error(kind === 'person-doc' ? 'Use JPG, PNG, WEBP, GIF ou PDF' : 'Formato inválido. Use JPG, PNG, WEBP ou GIF'), ok);
  },
});

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

pool.on('connection', (conn) => {
  conn.query("SET time_zone = '-03:00'");
});

console.log('✅ Pool MySQL configurado (fuso: America/Sao_Paulo)');

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      clientId: user.client_id ?? null,
      sessionVersion: Number(user.session_version ?? 0),
    },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}

async function userGetSessionVersion(userId) {
  try {
    const [rows] = await pool.execute('SELECT session_version FROM users WHERE id = ? LIMIT 1', [userId]);
    return Number(rows[0]?.session_version ?? 0);
  } catch {
    return 0;
  }
}

async function userSessionIsValid(payload) {
  try {
    const [rows] = await pool.execute(
      'SELECT session_version FROM users WHERE id = ? AND active = 1 LIMIT 1',
      [Number(payload.id)]
    );
    if (!rows.length) return false;
    return Number(rows[0].session_version ?? 0) === Number(payload.sessionVersion ?? 0);
  } catch {
    return true;
  }
}

async function userForceLogout(userId) {
  await pool.execute(
    'UPDATE users SET session_version = session_version + 1, last_seen_at = NULL WHERE id = ?',
    [userId]
  );
}

async function rootUsageMetrics(days = 30) {
  const period = Math.min(90, Math.max(7, Number(days) || 30));

  const [[summary]] = await pool.execute(
    `SELECT
       SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) AS logins_today,
       SUM(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) THEN 1 ELSE 0 END) AS logins_week,
       COUNT(DISTINCT CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) THEN user_id END) AS unique_users
     FROM user_access_log
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)`,
    [period, period]
  );

  const [dayRows] = await pool.execute(
    `SELECT DATE(created_at) AS day, COUNT(*) AS count
     FROM user_access_log
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
     GROUP BY DATE(created_at)
     ORDER BY day ASC`
  );
  const dayMap = Object.fromEntries(dayRows.map((r) => [String(r.day), Number(r.count)]));
  const loginsByDay = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    loginsByDay.push({ date: key, count: dayMap[key] ?? 0 });
  }

  const [roleRows] = await pool.execute(
    `SELECT role, COUNT(*) AS count
     FROM user_access_log
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     GROUP BY role
     ORDER BY count DESC`,
    [period]
  );

  const [activeRoleRows] = await pool.execute(
    `SELECT role, COUNT(DISTINCT user_id) AS count
     FROM user_access_log
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     GROUP BY role
     ORDER BY count DESC`,
    [period]
  );

  const [hourRows] = await pool.execute(
    `SELECT HOUR(created_at) AS hour, COUNT(*) AS count
     FROM user_access_log
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     GROUP BY HOUR(created_at)
     ORDER BY hour ASC`,
    [period]
  );
  const hourMap = Array.from({ length: 24 }, () => 0);
  for (const row of hourRows) hourMap[Number(row.hour)] = Number(row.count);
  const peakHours = hourMap.map((count, hour) => ({ hour, count }));

  return {
    days: period,
    summary: {
      loginsToday: Number(summary?.logins_today ?? 0),
      loginsWeek: Number(summary?.logins_week ?? 0),
      uniqueUsers: Number(summary?.unique_users ?? 0),
    },
    loginsByDay,
    loginsByRole: roleRows.map((r) => ({ role: r.role, count: Number(r.count) })),
    activeUsersByRole: activeRoleRows.map((r) => ({ role: r.role, count: Number(r.count) })),
    peakHours,
  };
}

function auth(requiredRoles = []) {
  return async (req, res, next) => {
    try {
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : null;
      if (!token) {
        return res.status(401).json({ error: 'Não autenticado' });
      }
      const payload = jwt.verify(token, JWT_SECRET);
      const valid = await userSessionIsValid(payload);
      if (!valid) {
        return res.status(401).json({ error: 'Sessão encerrada. Faça login novamente.' });
      }
      req.user = {
        id: Number(payload.id),
        username: payload.username,
        role: payload.role,
        clientId: payload.clientId ? Number(payload.clientId) : null,
      };
      if (requiredRoles.length && !requiredRoles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Sem permissão' });
      }
      next();
    } catch {
      return res.status(401).json({ error: 'Token inválido ou expirado' });
    }
  };
}

function normalizeMediaUrl(path) {
  if (!path) return null;
  const trimmed = String(path).trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/uploads/')) return trimmed;
  if (trimmed.startsWith('uploads/')) return `/${trimmed}`;
  const bare = trimmed.replace(/^\/+/, '');
  if (/^avatar_\d{14}_[a-f0-9]+\.(jpe?g|png|webp|gif)$/i.test(bare)) {
    return `/uploads/avatars/${bare}`;
  }
  if (/^animal_\d{14}_[a-f0-9]+\.(jpe?g|png|webp|gif)$/i.test(bare)) {
    return `/uploads/animals/${bare}`;
  }
  if (/^person_\d{14}_[a-f0-9]+\.(jpe?g|png|webp|gif|pdf)$/i.test(bare)) {
    return `/uploads/persons/${bare}`;
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function mapUser(row) {
  return {
    id: String(row.id),
    username: row.username,
    email: row.email,
    name: row.name,
    avatarUrl: normalizeMediaUrl(row.avatar_url),
    role: row.role,
    clientId: row.client_id ? String(row.client_id) : null,
    active: Boolean(row.active),
    mustChangePassword: Boolean(row.must_change_password),
    permissions: permissionsForRole(row.role),
  };
}

async function enrichUserWithClientProfile(user) {
  if (!user.clientId) return user;
  const [rows] = await pool.execute(
    'SELECT is_assessor, is_buyer, is_seller FROM clients WHERE id = ? LIMIT 1',
    [user.clientId]
  );
  if (rows[0]) {
    user.isAssessor = Boolean(rows[0].is_assessor);
    user.isBuyer = Boolean(rows[0].is_buyer);
    user.isSeller = Boolean(rows[0].is_seller);
  }
  return user;
}

async function clientIsAssessor(clientId) {
  if (!clientId) return false;
  const [rows] = await pool.execute('SELECT is_assessor FROM clients WHERE id = ? LIMIT 1', [clientId]);
  return rows[0] ? Boolean(rows[0].is_assessor) : false;
}

const DEFAULT_CLIENT_ACCESS_PASSWORD = 'ariane2026';

function usernameSlugPart(value) {
  let v = String(value || '').trim();
  if (!v) return '';
  v = v.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  v = v.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return v;
}

async function generateUsernameFromName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  let first = usernameSlugPart(parts[0] || 'usuario');
  let last = usernameSlugPart(parts[parts.length - 1] || 'acesso');
  if (!first) first = 'usuario';
  if (!last) last = 'acesso';
  const base = first === last ? first : `${first}.${last}`;
  let candidate = base;
  let n = 2;
  while (true) {
    const [rows] = await pool.execute('SELECT 1 FROM users WHERE username = ? LIMIT 1', [candidate]);
    if (!rows.length) return candidate;
    candidate = `${base}${n}`;
    n += 1;
  }
}

async function getClientAccessUser(clientId) {
  const [rows] = await pool.execute(
    `SELECT id, username, email, name, avatar_url, role, client_id, active, must_change_password, created_at
     FROM users WHERE client_id = ? AND role = 'cliente' ORDER BY id ASC LIMIT 1`,
    [clientId]
  );
  return rows.length ? mapUser(rows[0]) : null;
}

const clientPartyMatchSql = (alias = 'c') =>
  `? IN (${alias}.buyer_id, ${alias}.seller_id, ${alias}.assessor_id, ${alias}.witness1_id, ${alias}.witness2_id)`;

const CLIENT_CONTRACT_ACCESS_SQL = clientPartyMatchSql('c');

const CLIENT_ANIMAL_ACCESS_SQL = `(
  EXISTS (SELECT 1 FROM animal_owners ao WHERE ao.animal_id = a.id AND ao.client_id = ?)
  OR EXISTS (
    SELECT 1 FROM contracts cx
    WHERE cx.animal_id = a.id
      AND cx.status != 'cancelado'
      AND ${clientPartyMatchSql('cx')}
  )
)`;

function bindClientContractAccessParams(clientId) {
  return [clientId];
}

function bindClientAnimalAccessParams(clientId) {
  return [clientId, clientId];
}

function dashboardEmptyClienteStats() {
  return {
    clients: 1,
    buyers: 0,
    sellers: 0,
    assessors: 0,
    witnesses: 0,
    avalistas: 0,
    animals: 0,
    activeAnimals: 0,
    contracts: 0,
    contractsActive: 0,
    contractsAwaiting: 0,
    chargesPending: 0,
    chargesOverdue: 0,
    chargesPaid: 0,
    users: 0,
  };
}

async function clientCanViewAnimal(animalId, clientId) {
  const [ownerRows] = await pool.execute(
    'SELECT 1 FROM animal_owners WHERE animal_id = ? AND client_id = ? LIMIT 1',
    [animalId, clientId]
  );
  if (ownerRows.length) return true;
  const [contractRows] = await pool.execute(
    `SELECT 1 FROM contracts c
     WHERE c.animal_id = ? AND c.status != 'cancelado'
       AND ${clientPartyMatchSql('c')}
     LIMIT 1`,
    [animalId, clientId]
  );
  return contractRows.length > 0;
}

function canManageUsers(role) {
  return role === 'root' || role === 'admin';
}

function canCreate(role) {
  return ['root', 'admin', 'user'].includes(role);
}

function canUpdate(role) {
  return ['root', 'admin', 'user'].includes(role);
}

function canDelete(role) {
  return ['root', 'admin', 'user'].includes(role);
}

function canViewAudit(role) {
  return role === 'root' || role === 'admin';
}

function permissionsForRole(role) {
  return {
    canCreate: canCreate(role),
    canUpdate: canUpdate(role),
    canDelete: canDelete(role),
    canManageUsers: canManageUsers(role),
    canViewAudit: canViewAudit(role),
  };
}

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').slice(0, 64);
}

async function auditLog(req, auth, action, resource, resourceId = null, summary = null, success = true, meta = null) {
  try {
    await pool.execute(
      `INSERT INTO audit_logs (user_id, username, role, action, resource, resource_id, summary, ip, user_agent, success, meta)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        auth?.id ?? null,
        auth?.username ?? null,
        auth?.role ?? null,
        action,
        resource,
        resourceId,
        summary,
        clientIp(req),
        String(req.headers['user-agent'] || '').slice(0, 500),
        success ? 1 : 0,
        meta ? JSON.stringify(meta) : null,
      ]
    );
  } catch (e) {
    /* não interrompe operação principal */
  }
}

async function userTouchPresence(userId) {
  try {
    const mysqlNow = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await pool.execute('UPDATE users SET last_seen_at = ? WHERE id = ?', [mysqlNow, userId]);
  } catch {
    /* coluna pode não existir */
  }
}

async function userLogAccess(req, auth) {
  try {
    await pool.execute(
      'INSERT INTO user_access_log (user_id, username, role, ip, user_agent) VALUES (?, ?, ?, ?, ?)',
      [
        auth.id,
        auth.username,
        auth.role,
        clientIp(req),
        String(req.headers['user-agent'] || '').slice(0, 500),
      ]
    );
    await userTouchPresence(auth.id);
  } catch {
    /* tabela pode não existir */
  }
}

function mapOnlineUser(r) {
  return {
    id: String(r.id),
    username: r.username,
    name: r.name,
    role: r.role,
    avatarUrl: r.avatar_url || null,
    lastSeenAt: r.last_seen_at,
  };
}

function mapAccessLogRow(r) {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    username: r.username,
    name: r.user_name || r.username,
    role: r.role,
    avatarUrl: r.avatar_url || null,
    ip: r.ip,
    userAgent: r.user_agent || null,
    createdAt: r.created_at,
  };
}

function mapAuditRow(r) {
  let meta = null;
  if (r.meta) {
    try {
      meta = typeof r.meta === 'string' ? JSON.parse(r.meta) : r.meta;
    } catch {
      meta = null;
    }
  }
  return {
    id: String(r.id),
    createdAt: r.created_at,
    userId: r.user_id ? String(r.user_id) : null,
    username: r.username,
    role: r.role,
    action: r.action,
    resource: r.resource,
    resourceId: r.resource_id,
    summary: r.summary,
    ip: r.ip,
    userAgent: r.user_agent || null,
    success: Boolean(r.success),
    meta,
  };
}

async function fetchAuditLogs(filters = {}) {
  let sql = ' FROM audit_logs WHERE 1=1';
  const params = [];
  if (filters.userId) {
    sql += ' AND user_id = ?';
    params.push(Number(filters.userId));
  }
  if (filters.action) {
    sql += ' AND action = ?';
    params.push(String(filters.action));
  }
  if (filters.resource) {
    sql += ' AND resource = ?';
    params.push(String(filters.resource));
  }
  if (filters.from) {
    sql += ' AND created_at >= ?';
    params.push(`${String(filters.from)} 00:00:00`);
  }
  if (filters.to) {
    sql += ' AND created_at <= ?';
    params.push(`${String(filters.to)} 23:59:59`);
  }
  if (filters.q) {
    const term = `%${String(filters.q)}%`;
    sql += ' AND (username LIKE ? OR summary LIKE ? OR resource LIKE ? OR resource_id LIKE ? OR ip LIKE ?)';
    params.push(term, term, term, term, term);
  }

  const [countRows] = await pool.execute(`SELECT COUNT(*) AS total${sql}`, params);
  const total = Number(countRows[0]?.total || 0);

  const limit = Math.min(500, Math.max(1, Number(filters.limit) || 50));
  const offset = Math.max(0, Number(filters.offset) || 0);

  const [rows] = await pool.execute(
    `SELECT *${sql} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
    params
  );

  return {
    items: rows.map(mapAuditRow),
    total,
    limit,
    offset,
  };
}

function canWriteData(role) {
  return canCreate(role);
}

// Health
app.get('/api/health', async (_req, res) => {
  try {
    const [rows] = await pool.execute('SELECT 1 AS test');
    res.json({ status: 'ok', database: 'connected', test: rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/clicksign-widget', (_req, res) => {
  try {
    const { base } = loadClicksignConfig();
    res.json({ endpoint: base || 'https://app.clicksign.com' });
  } catch {
    res.json({ endpoint: process.env.CLICKSIGN_BASE_URL || 'https://app.clicksign.com' });
  }
});

function clicksignParseSignerAliases(raw) {
  if (!raw) return {};
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function clicksignPersistSignerAliases(contractId, newAliases) {
  if (!newAliases || !Object.keys(newAliases).length) return;
  try {
    const [rows] = await pool.execute(
      'SELECT clicksign_signer_aliases FROM contracts WHERE id = ?',
      [contractId]
    );
    const aliases = clicksignParseSignerAliases(rows[0]?.clicksign_signer_aliases);
    for (const [oldId, newId] of Object.entries(newAliases)) {
      const o = String(oldId || '').trim();
      const n = String(newId || '').trim();
      if (o && n) aliases[o] = n;
    }
    await pool.execute('UPDATE contracts SET clicksign_signer_aliases = ? WHERE id = ?', [
      JSON.stringify(aliases),
      contractId,
    ]);
  } catch {
    // coluna ainda não migrada
  }
}

async function clicksignResolveSignerKey(key) {
  const trimmed = String(key || '').trim();
  if (!trimmed) {
    const err = new Error('Link de assinatura inválido');
    err.status = 400;
    throw err;
  }

  try {
    const [rows] = await pool.execute(
      `SELECT id, clicksign_envelope_id, clicksign_signer_aliases
       FROM contracts
       WHERE clicksign_envelope_id IS NOT NULL AND clicksign_status = 'running'`
    );
    for (const row of rows) {
      const aliases = clicksignParseSignerAliases(row.clicksign_signer_aliases);
      if (aliases[trimmed]) {
        return {
          signerKey: String(aliases[trimmed]),
          replaced: true,
          contractId: String(row.id),
        };
      }
    }
  } catch {
    /* coluna pode não existir */
  }

  const [rows] = await pool.execute(
    `SELECT id, clicksign_envelope_id
     FROM contracts
     WHERE clicksign_envelope_id IS NOT NULL AND clicksign_status = 'running'`
  );
  for (const row of rows) {
    const envelopeId = String(row.clicksign_envelope_id || '').trim();
    if (!envelopeId) continue;
    try {
      const signersRes = await clicksignRequest('GET', `/api/v3/envelopes/${envelopeId}/signers`);
      for (const cs of signersRes?.data || []) {
        if (String(cs.id) === trimmed) {
          return { signerKey: trimmed, replaced: false, contractId: String(row.id) };
        }
      }
    } catch {
      continue;
    }
  }

  const err = new Error(
    'Este link de assinatura expirou (geralmente após atualização de e-mail). ' +
      'Peça um novo link pelo WhatsApp ou abra o e-mail mais recente da Clicksign.'
  );
  err.status = 404;
  throw err;
}

app.get('/api/clicksign-signer/:key', async (req, res) => {
  try {
    const resolved = await clicksignResolveSignerKey(req.params.key);
    res.json({ success: true, ...resolved });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ error: error.message || 'Falha ao validar link de assinatura' });
  }
});

// Auth
app.post('/api/login', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    const login = (username || email || '').trim();

    if (!login || !password) {
      return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    }

    const [rows] = await pool.execute(
      `SELECT id, username, email, password_hash, name, avatar_url, role, client_id, active, must_change_password
       FROM users
       WHERE (username = ? OR email = ?) AND active = 1
       LIMIT 1`,
      [login, login.toLowerCase()]
    );

    if (!rows.length) {
      await auditLog(req, null, 'login_failed', 'auth', null, `Tentativa: ${login}`, false);
      return res.status(401).json({ error: 'Usuário ou senha incorretos' });
    }

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      await auditLog(req, null, 'login_failed', 'auth', null, `Tentativa: ${login}`, false);
      return res.status(401).json({ error: 'Usuário ou senha incorretos' });
    }

    user.session_version = await userGetSessionVersion(user.id);
    const token = signToken(user);
    await auditLog(req, { id: user.id, username: user.username, role: user.role }, 'login', 'auth', String(user.id), 'Login realizado');
    await userLogAccess(req, { id: user.id, username: user.username, role: user.role });
    res.json({ success: true, token, user: await enrichUserWithClientProfile(mapUser(user)) });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

app.get('/api/me', auth(), async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, username, email, name, avatar_url, role, client_id, active, must_change_password
       FROM users WHERE id = ? LIMIT 1`,
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json({ user: await enrichUserWithClientProfile(mapUser(rows[0])) });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
});

app.get('/api/me/modules', auth(), async (req, res) => {
  try {
    if (!req.user.clientId) {
      return res.json({ subscriptionType: 'assessoria', subscriptionSuspended: false, modules: [] });
    }
    const cid = req.user.clientId;
    const [rows] = await pool.execute(
      'SELECT subscription_type, subscription_suspended FROM clients WHERE id = ? LIMIT 1',
      [cid]
    );
    const c = rows[0] || {};
    res.json({
      subscriptionType: c.subscription_type ?? 'assessoria',
      subscriptionSuspended: Boolean(c.subscription_suspended),
      modules: await fetchClientModules(cid),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao carregar módulos' });
  }
});

app.put('/api/me', auth(), async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
    if (name.length > 150) return res.status(400).json({ error: 'Nome muito longo' });

    const [existing] = await pool.execute(
      'SELECT id, avatar_url FROM users WHERE id = ? LIMIT 1',
      [req.user.id]
    );
    if (!existing.length) return res.status(404).json({ error: 'Usuário não encontrado' });

    let avatarUrl = existing[0].avatar_url || null;
    if (Object.prototype.hasOwnProperty.call(req.body, 'avatarUrl')) {
      const raw = req.body.avatarUrl;
      avatarUrl = raw ? String(raw) : null;
    }

    if (
      avatarUrl &&
      !/^(https?:\/\/|\/uploads\/(avatars|animals)\/)[A-Za-z0-9._/-]+$/i.test(avatarUrl)
    ) {
      return res.status(400).json({ error: 'URL de avatar inválida' });
    }

    await pool.execute('UPDATE users SET name = ?, avatar_url = ? WHERE id = ?', [
      name,
      avatarUrl,
      req.user.id,
    ]);

    const [rows] = await pool.execute(
      `SELECT id, username, email, name, avatar_url, role, client_id, active, must_change_password
       FROM users WHERE id = ? LIMIT 1`,
      [req.user.id]
    );
    res.json({ success: true, user: await enrichUserWithClientProfile(mapUser(rows[0])) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar perfil' });
  }
});

app.put('/api/change-password', auth(), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres' });
    }

    const [rows] = await pool.execute(
      'SELECT id, password_hash FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Usuário não encontrado' });

    const ok = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: 'Senha atual incorreta' });

    const hash = await bcrypt.hash(newPassword, 12);
    await pool.execute(
      'UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?',
      [hash, req.user.id]
    );
    res.json({ success: true, message: 'Senha alterada com sucesso' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao alterar senha' });
  }
});

// Upload de foto (animais ou avatar)
app.post('/api/upload', auth(), (req, res) => {
  const kind = String(req.query.kind || 'animal').toLowerCase();
  if (kind !== 'avatar' && !['root', 'admin', 'user'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Sem permissão para upload' });
  }

  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Erro no upload' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }
    const subdir = kind === 'avatar' ? 'avatars' : kind === 'person-doc' ? 'persons' : 'animals';
    res.json({
      success: true,
      url: `/uploads/${subdir}/${req.file.filename}`,
      fileName: req.file.originalname,
    });
  });
});

// Dashboard stats
app.get('/api/dashboard', auth(), async (req, res) => {
  try {
    const isCliente = req.user.role === 'cliente';

    if (isCliente) {
      if (!req.user.clientId) {
        return res.json(dashboardEmptyClienteStats());
      }
      const cid = req.user.clientId;
      const animalParams = bindClientAnimalAccessParams(cid);
      const [[animals]] = await pool.execute(
        `SELECT COUNT(*) AS total FROM animals a WHERE ${CLIENT_ANIMAL_ACCESS_SQL}`,
        animalParams
      );
      const [[activeAnimals]] = await pool.execute(
        `SELECT COUNT(*) AS total FROM animals a
         WHERE a.status = 'ativo' AND ${CLIENT_ANIMAL_ACCESS_SQL}`,
        animalParams
      );
      const contractParams = bindClientContractAccessParams(cid);
      const [[contracts]] = await pool.execute(
        `SELECT COUNT(*) AS total FROM contracts c
         WHERE ${CLIENT_CONTRACT_ACCESS_SQL} AND c.status != 'cancelado'`,
        contractParams
      );
      const [[contractsActive]] = await pool.execute(
        `SELECT COUNT(*) AS total FROM contracts c
         WHERE ${CLIENT_CONTRACT_ACCESS_SQL} AND c.status = 'ativo'`,
        contractParams
      );
      const [[contractsAwaiting]] = await pool.execute(
        `SELECT COUNT(*) AS total FROM contracts c
         WHERE ${CLIENT_CONTRACT_ACCESS_SQL} AND c.status = 'aguardando_assinatura'`,
        contractParams
      );
      const [[chargesPending]] = await pool.execute(
        `SELECT COUNT(*) AS total FROM charges ch
         INNER JOIN contracts c ON c.id = ch.contract_id
         WHERE ch.client_id = ? AND ch.status = 'pendente' AND c.status != 'cancelado'`,
        [cid]
      );
      const [[chargesOverdue]] = await pool.execute(
        `SELECT COUNT(*) AS total FROM charges ch
         INNER JOIN contracts c ON c.id = ch.contract_id
         WHERE ch.client_id = ? AND c.status != 'cancelado'
           AND (ch.status = 'atrasado' OR (ch.status = 'pendente' AND ch.due_date < CURDATE()))`,
        [cid]
      );
      const [[chargesPaid]] = await pool.execute(
        `SELECT COUNT(*) AS total FROM charges ch
         INNER JOIN contracts c ON c.id = ch.contract_id
         WHERE ch.client_id = ? AND ch.status = 'pago' AND c.status != 'cancelado'`,
        [cid]
      );

      return res.json({
        clients: 1,
        buyers: 0,
        sellers: 0,
        assessors: 0,
        witnesses: 0,
        avalistas: 0,
        animals: animals.total,
        activeAnimals: activeAnimals.total,
        contracts: contracts.total,
        contractsActive: contractsActive.total,
        contractsAwaiting: contractsAwaiting.total,
        chargesPending: chargesPending.total,
        chargesOverdue: chargesOverdue.total,
        chargesPaid: chargesPaid.total,
        users: 0,
      });
    }

    const [[clients]] = await pool.execute('SELECT COUNT(*) AS total FROM clients WHERE active = 1');
    const [[buyers]] = await pool.execute(
      'SELECT COUNT(*) AS total FROM clients WHERE active = 1 AND is_buyer = 1'
    );
    const [[sellers]] = await pool.execute(
      'SELECT COUNT(*) AS total FROM clients WHERE active = 1 AND is_seller = 1'
    );
    const [[assessors]] = await pool.execute(
      'SELECT COUNT(*) AS total FROM clients WHERE active = 1 AND is_assessor = 1'
    );
    const [[witnesses]] = await pool.execute(
      'SELECT COUNT(*) AS total FROM clients WHERE active = 1 AND is_witness = 1'
    );
    const [[avalistas]] = await pool.execute(
      'SELECT COUNT(*) AS total FROM clients WHERE active = 1 AND is_avalista = 1'
    );
    const [[animals]] = await pool.execute('SELECT COUNT(*) AS total FROM animals');
    const [[activeAnimals]] = await pool.execute(
      "SELECT COUNT(*) AS total FROM animals WHERE status = 'ativo'"
    );
    const [[contracts]] = await pool.execute(
      "SELECT COUNT(*) AS total FROM contracts WHERE status != 'cancelado'"
    );
    const [[contractsActive]] = await pool.execute(
      "SELECT COUNT(*) AS total FROM contracts WHERE status = 'ativo'"
    );
    const [[contractsAwaiting]] = await pool.execute(
      "SELECT COUNT(*) AS total FROM contracts WHERE status = 'aguardando_assinatura'"
    );
    const [[chargesPending]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM charges ch
       INNER JOIN contracts c ON c.id = ch.contract_id
       WHERE ch.collector = 'assessoria' AND ch.status = 'pendente' AND c.status != 'cancelado'`
    );
    const [[chargesOverdue]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM charges ch
       INNER JOIN contracts c ON c.id = ch.contract_id
       WHERE ch.collector = 'assessoria' AND c.status != 'cancelado'
         AND (ch.status = 'atrasado' OR (ch.status = 'pendente' AND ch.due_date < CURDATE()))`
    );
    const [[chargesPaid]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM charges ch
       INNER JOIN contracts c ON c.id = ch.contract_id
       WHERE ch.collector = 'assessoria' AND ch.status = 'pago' AND c.status != 'cancelado'`
    );
    const [[users]] = await pool.execute('SELECT COUNT(*) AS total FROM users WHERE active = 1');

    const overdueWhere = chargeOverdueSql();
    const monthStart = `${todayBrasiliaISO().slice(0, 8)}01`;
    const [[overdueAmt]] = await pool.query(
      `SELECT COALESCE(SUM(ch.amount), 0) AS t FROM charges ch
       INNER JOIN contracts c ON c.id = ch.contract_id WHERE ${overdueWhere}`
    );
    const [[paidMonth]] = await pool.query(
      `SELECT COALESCE(SUM(ch.amount), 0) AS t FROM charges ch
       INNER JOIN contracts c ON c.id = ch.contract_id
       WHERE ch.collector = 'assessoria' AND ch.status = 'pago' AND c.status != 'cancelado'
         AND COALESCE(ch.paid_at, ch.updated_at) >= ?`,
      [monthStart]
    );
    const [[auctionsOpen]] = await pool.query(
      "SELECT COUNT(*) AS t FROM auctions WHERE status IN ('agendado','em_andamento')"
    );
    const [[dueSoon]] = await pool.query(
      `SELECT COUNT(*) AS t FROM charges ch
       INNER JOIN contracts c ON c.id = ch.contract_id
       WHERE c.status != 'cancelado' AND ch.status = 'pendente'
         AND ch.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)`
    );

    let subscriptionsSuspended = 0;
    let coveringsPending = 0;
    try {
      const [[susp]] = await pool.query(
        'SELECT COUNT(*) AS t FROM clients WHERE active = 1 AND subscription_suspended = 1'
      );
      subscriptionsSuspended = Number(susp.t);
      const [[cov]] = await pool.query(
        "SELECT COUNT(*) AS t FROM breeding_coverings WHERE abccmm_status = 'pendente'"
      );
      coveringsPending = Number(cov.t);
    } catch {
      /* migrations opcionais */
    }

    res.json({
      clients: clients.total,
      buyers: buyers.total,
      sellers: sellers.total,
      assessors: assessors.total,
      witnesses: witnesses.total,
      avalistas: avalistas.total,
      animals: animals.total,
      activeAnimals: activeAnimals.total,
      contracts: contracts.total,
      contractsActive: contractsActive.total,
      contractsAwaiting: contractsAwaiting.total,
      chargesPending: chargesPending.total,
      chargesOverdue: chargesOverdue.total,
      chargesPaid: chargesPaid.total,
      users: canManageUsers(req.user.role) ? users.total : undefined,
      overdueAmount: Math.round(Number(overdueAmt.t) * 100) / 100,
      assessoriaPaidMonth: Math.round(Number(paidMonth.t) * 100) / 100,
      auctionsOpen: Number(auctionsOpen.t),
      subscriptionsSuspended,
      chargesDueSoon: Number(dueSoon.t),
      coveringsPending,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao carregar dashboard' });
  }
});

function mapClient(r) {
  return {
    ...r,
    id: String(r.id),
    active: Boolean(r.active),
    is_seller: Boolean(r.is_seller),
    is_buyer: Boolean(r.is_buyer ?? 1),
    is_assessor: Boolean(r.is_assessor),
    is_witness: Boolean(r.is_witness),
    is_avalista: Boolean(r.is_avalista),
    rg: r.rg ?? null,
    rg_issuer: r.rg_issuer ?? null,
    birth_date: r.birth_date ?? null,
    nickname: r.nickname ?? null,
    marital_status: r.marital_status ?? null,
    profession: r.profession ?? null,
    mother_name: r.mother_name ?? null,
    father_name: r.father_name ?? null,
    zip_code: r.zip_code ?? null,
    address_number: r.address_number ?? null,
    country: r.country ?? 'Brasil',
    relationship_notes: r.relationship_notes ?? null,
    problems_notes: r.problems_notes ?? null,
    property_name: r.property_name ?? null,
    subscription_type: r.subscription_type ?? 'assessoria',
    subscription_suspended: Boolean(r.subscription_suspended ?? 0),
    adhesion_fee: r.adhesion_fee != null ? Number(r.adhesion_fee) : null,
    monthly_fee: r.monthly_fee != null ? Number(r.monthly_fee) : null,
    adhesion_paid_at: r.adhesion_paid_at ?? null,
  };
}

const CLIENT_MODULE_CODES = ['plantel', 'reproducao', 'sanitario', 'contratos', 'leiloes', 'estoque', 'hospedagem', 'financeiro_haras'];

function normalizeClientModuleCode(code) {
  return CLIENT_MODULE_CODES.includes(code) ? code : null;
}

async function fetchClientModules(clientId) {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM client_modules WHERE client_id = ? ORDER BY module_code ASC',
      [clientId]
    );
    return rows.map((r) => ({
      code: r.module_code,
      active: Boolean(r.active),
      monthlyFee: r.monthly_fee != null ? Number(r.monthly_fee) : null,
      activatedAt: r.activated_at,
      notes: r.notes,
    }));
  } catch {
    return [];
  }
}

function chargeOpenSql(chAlias = 'ch', cAlias = 'c') {
  return `${cAlias}.status != 'cancelado' AND ${chAlias}.status IN ('pendente','atrasado')`;
}

function chargeOverdueSql(chAlias = 'ch', cAlias = 'c') {
  return `${cAlias}.status != 'cancelado' AND ${chAlias}.status IN ('pendente','atrasado')
    AND (${chAlias}.status = 'atrasado' OR ${chAlias}.due_date < CURDATE())`;
}

async function fetchReceivablesDashboard() {
  const openWhere = chargeOpenSql();
  const overdueWhere = chargeOverdueSql();

  const [[totals]] = await pool.query(
    `SELECT
      COALESCE(SUM(CASE WHEN ${openWhere} THEN ch.amount ELSE 0 END), 0) AS open_total,
      COALESCE(SUM(CASE WHEN ${overdueWhere} THEN ch.amount ELSE 0 END), 0) AS overdue_total,
      COALESCE(SUM(CASE WHEN ${openWhere} THEN 1 ELSE 0 END), 0) AS open_count,
      COALESCE(SUM(CASE WHEN ${overdueWhere} THEN 1 ELSE 0 END), 0) AS overdue_count
     FROM charges ch
     INNER JOIN contracts c ON c.id = ch.contract_id`
  );

  const [[aging]] = await pool.query(
    `SELECT
      COALESCE(SUM(CASE WHEN ch.status = 'pendente' AND ch.due_date >= CURDATE() THEN ch.amount ELSE 0 END), 0) AS current,
      COALESCE(SUM(CASE WHEN ${overdueWhere} AND DATEDIFF(CURDATE(), ch.due_date) BETWEEN 1 AND 30 THEN ch.amount ELSE 0 END), 0) AS d1_30,
      COALESCE(SUM(CASE WHEN ${overdueWhere} AND DATEDIFF(CURDATE(), ch.due_date) BETWEEN 31 AND 60 THEN ch.amount ELSE 0 END), 0) AS d31_60,
      COALESCE(SUM(CASE WHEN ${overdueWhere} AND DATEDIFF(CURDATE(), ch.due_date) BETWEEN 61 AND 90 THEN ch.amount ELSE 0 END), 0) AS d61_90,
      COALESCE(SUM(CASE WHEN ${overdueWhere} AND DATEDIFF(CURDATE(), ch.due_date) > 90 THEN ch.amount ELSE 0 END), 0) AS d90_plus
     FROM charges ch
     INNER JOIN contracts c ON c.id = ch.contract_id`
  );

  const [byCollector] = await pool.query(
    `SELECT ch.collector,
      COALESCE(SUM(CASE WHEN ${openWhere} THEN ch.amount ELSE 0 END), 0) AS open_amount,
      COALESCE(SUM(CASE WHEN ${overdueWhere} THEN ch.amount ELSE 0 END), 0) AS overdue_amount,
      COALESCE(SUM(CASE WHEN ${overdueWhere} THEN 1 ELSE 0 END), 0) AS overdue_count
     FROM charges ch
     INNER JOIN contracts c ON c.id = ch.contract_id
     GROUP BY ch.collector`
  );

  const collectorMap = {
    assessoria: { open: 0, overdue: 0, overdueCount: 0 },
    seller: { open: 0, overdue: 0, overdueCount: 0 },
  };
  for (const row of byCollector) {
    const key = row.collector === 'seller' ? 'seller' : 'assessoria';
    collectorMap[key] = {
      open: Math.round(Number(row.open_amount) * 100) / 100,
      overdue: Math.round(Number(row.overdue_amount) * 100) / 100,
      overdueCount: Number(row.overdue_count),
    };
  }

  const [debtors] = await pool.query(
    `SELECT cl.id, cl.name, cl.whatsapp, cl.phone,
      COUNT(*) AS charges_count,
      COALESCE(SUM(ch.amount), 0) AS overdue_amount,
      MIN(ch.due_date) AS oldest_due
     FROM charges ch
     INNER JOIN contracts c ON c.id = ch.contract_id
     INNER JOIN clients cl ON cl.id = ch.client_id
     WHERE ${overdueWhere}
     GROUP BY cl.id, cl.name, cl.whatsapp, cl.phone
     ORDER BY overdue_amount DESC, oldest_due ASC
     LIMIT 15`
  );

  const [overdueRows] = await pool.query(
    `SELECT ch.id, ch.amount, ch.due_date, ch.status, ch.collector, ch.installment_no,
            cl.name AS client_name, cl.whatsapp, an.name AS animal_name, c.contract_number,
            DATEDIFF(CURDATE(), ch.due_date) AS days_overdue
     FROM charges ch
     INNER JOIN contracts c ON c.id = ch.contract_id
     INNER JOIN clients cl ON cl.id = ch.client_id
     LEFT JOIN animals an ON an.id = c.animal_id
     WHERE ${overdueWhere}
     ORDER BY ch.due_date ASC, ch.amount DESC
     LIMIT 50`
  );

  return {
    openTotal: Math.round(Number(totals.open_total) * 100) / 100,
    overdueTotal: Math.round(Number(totals.overdue_total) * 100) / 100,
    openCount: Number(totals.open_count),
    overdueCount: Number(totals.overdue_count),
    aging: {
      current: Math.round(Number(aging.current) * 100) / 100,
      d1_30: Math.round(Number(aging.d1_30) * 100) / 100,
      d31_60: Math.round(Number(aging.d31_60) * 100) / 100,
      d61_90: Math.round(Number(aging.d61_90) * 100) / 100,
      d90_plus: Math.round(Number(aging.d90_plus) * 100) / 100,
    },
    byCollector: collectorMap,
    topDebtors: debtors.map((r) => ({
      clientId: String(r.id),
      clientName: r.name,
      whatsapp: r.whatsapp,
      phone: r.phone,
      chargesCount: Number(r.charges_count),
      overdueAmount: Math.round(Number(r.overdue_amount) * 100) / 100,
      oldestDue: r.oldest_due,
    })),
    overdueItems: overdueRows.map((r) => ({
      id: String(r.id),
      amount: Number(r.amount),
      dueDate: r.due_date,
      status: r.status,
      collector: r.collector,
      installmentNo: Number(r.installment_no),
      clientName: r.client_name,
      whatsapp: r.whatsapp,
      animalName: r.animal_name,
      contractNumber: r.contract_number,
      daysOverdue: Number(r.days_overdue),
    })),
  };
}

let collectionEventsTableExistsCache = null;

async function collectionEventsTableExists() {
  if (collectionEventsTableExistsCache !== null) return collectionEventsTableExistsCache;
  try {
    const [rows] = await pool.query("SHOW TABLES LIKE 'charge_collection_events'");
    collectionEventsTableExistsCache = rows.length > 0;
  } catch {
    collectionEventsTableExistsCache = false;
  }
  return collectionEventsTableExistsCache;
}

function mapCollectionEventRow(r) {
  return {
    id: String(r.id),
    chargeId: String(r.charge_id),
    userId: r.user_id ? String(r.user_id) : null,
    userName: r.user_name ?? null,
    note: r.note,
    outcome: r.outcome,
    promisedDate: r.promised_date ?? null,
    channel: r.channel,
    createdAt: r.created_at,
  };
}

const COLLECTION_WHATSAPP_SETTING_KEY = 'collection_whatsapp';

function defaultCollectionWhatsappSettings() {
  return {
    template:
      'Olá {nome}, tudo bem?\n\nIdentificamos {parcelas} parcela(s) em atraso, totalizando {valor}.{vencimento_linha}{compra_linha}\n{dados_bancarios_linha}\nPodemos conversar para regularizar?\n\nAtenciosamente,\nAriane Andrade Assessoria',
    bankDetails: '',
  };
}

async function systemSettingsTableExists() {
  try {
    const [rows] = await pool.query("SHOW TABLES LIKE 'system_settings'");
    return rows.length > 0;
  } catch {
    return false;
  }
}

async function systemSettingGet(key, fallback = null) {
  if (!(await systemSettingsTableExists())) return fallback;
  try {
    const [rows] = await pool.execute(
      'SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1',
      [key]
    );
    if (!rows.length) return fallback;
    const decoded = JSON.parse(String(rows[0].setting_value || '{}'));
    return decoded && typeof decoded === 'object' ? decoded : fallback;
  } catch {
    return fallback;
  }
}

async function systemSettingSet(key, value) {
  if (!(await systemSettingsTableExists())) {
    const err = new Error('Tabela system_settings não encontrada. Execute database/migration-system-settings.sql');
    err.status = 500;
    throw err;
  }
  const json = JSON.stringify(value);
  await pool.execute(
    `INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [key, json]
  );
}

async function fetchCollectionWhatsappSettings() {
  const stored = await systemSettingGet(COLLECTION_WHATSAPP_SETTING_KEY, defaultCollectionWhatsappSettings());
  const defaults = defaultCollectionWhatsappSettings();
  return {
    template: String(stored?.template || defaults.template),
    bankDetails: String(stored?.bankDetails ?? ''),
  };
}

async function fetchReceivablesAnalytical(filters = {}) {
  const status = filters.status || 'overdue_and_upcoming';
  const from = filters.from || null;
  const to = filters.to || null;
  const clientId = filters.clientId ? Number(filters.clientId) : 0;
  const q = String(filters.q || '').trim();
  const hasHistory = await collectionEventsTableExists();
  const collectionCountSql = hasHistory
    ? '(SELECT COUNT(*) FROM charge_collection_events e WHERE e.charge_id = ch.id)'
    : '0';

  let sql = `SELECT ch.id, ch.installment_no, ch.amount, ch.due_date, ch.status, ch.collector,
                    ch.payment_method, ch.paid_at, ch.notes,
                    cl.id AS client_id, cl.name AS client_name, cl.document, cl.document_type,
                    cl.phone, cl.whatsapp, cl.email,
                    c.contract_number, c.status AS contract_status, c.installments,
                    an.name AS animal_name,
                    DATEDIFF(CURDATE(), ch.due_date) AS days_overdue,
                    ${collectionCountSql} AS collection_count
             FROM charges ch
             INNER JOIN contracts c ON c.id = ch.contract_id
             INNER JOIN clients cl ON cl.id = ch.client_id
             LEFT JOIN animals an ON an.id = c.animal_id
             WHERE 1=1`;
  const params = [];

  switch (status) {
    case 'overdue':
      sql += ` AND c.status != 'cancelado' AND ${chargeOverdueSql()}`;
      break;
    case 'upcoming':
      sql += " AND c.status != 'cancelado' AND ch.status = 'pendente' AND ch.due_date >= CURDATE()";
      break;
    case 'cancelled':
      sql += " AND (ch.status = 'cancelado' OR c.status = 'cancelado')";
      break;
    case 'paid':
      sql += " AND c.status != 'cancelado' AND ch.status = 'pago'";
      break;
    case 'all':
      break;
    default:
      sql += ` AND c.status != 'cancelado' AND ${chargeOpenSql()}`;
      break;
  }

  if (from) {
    sql += ' AND ch.due_date >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND ch.due_date <= ?';
    params.push(to);
  }
  if (clientId > 0) {
    sql += ' AND ch.client_id = ?';
    params.push(clientId);
  }
  if (q) {
    sql += ' AND (cl.name LIKE ? OR an.name LIKE ? OR c.contract_number LIKE ? OR CAST(ch.id AS CHAR) LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }

  sql += ' ORDER BY cl.name ASC, ch.due_date ASC, ch.installment_no ASC LIMIT 2000';

  const [rows] = await pool.execute(sql, params);
  const clientsMap = {};
  const summary = { originalTotal: 0, paidTotal: 0, openTotal: 0, itemCount: 0, clientCount: 0 };

  for (const r of rows) {
    const cid = String(r.client_id);
    if (!clientsMap[cid]) {
      clientsMap[cid] = {
        clientId: cid,
        clientName: r.client_name,
        document: r.document,
        documentType: r.document_type,
        phone: r.phone,
        whatsapp: r.whatsapp,
        email: r.email,
        originalTotal: 0,
        paidTotal: 0,
        openTotal: 0,
        items: [],
      };
    }

    const amount = Number(r.amount);
    const paidAmount = r.status === 'pago' ? amount : 0;
    const openAmount = ['pendente', 'atrasado'].includes(r.status) ? amount : 0;
    const installments = Math.max(1, Number(r.installments));
    const animal = String(r.animal_name || '').trim();
    const contractNo = String(r.contract_number || '').trim();
    let description = `PARCELA ${r.installment_no} de ${installments}`;
    if (animal) description += ` — ${animal}`;
    if (contractNo) description += ` — Contrato ${contractNo}`;

    let displayStatus = r.status;
    if (displayStatus === 'pendente' && Number(r.days_overdue) > 0) displayStatus = 'atrasado';

    clientsMap[cid].items.push({
      id: String(r.id),
      installmentNo: Number(r.installment_no),
      installments,
      description,
      animalName: animal || null,
      contractNumber: contractNo || null,
      contractStatus: r.contract_status,
      amount: Math.round(amount * 100) / 100,
      paidAmount: Math.round(paidAmount * 100) / 100,
      dueDate: r.due_date,
      daysOverdue: Math.max(0, Number(r.days_overdue)),
      status: displayStatus,
      collector: normalizeCollector(r.collector),
      paymentMethod: r.payment_method,
      paidAt: r.paid_at,
      notes: r.notes,
      collectionCount: Number(r.collection_count),
    });

    clientsMap[cid].originalTotal += amount;
    clientsMap[cid].paidTotal += paidAmount;
    clientsMap[cid].openTotal += openAmount;
    summary.originalTotal += amount;
    summary.paidTotal += paidAmount;
    summary.openTotal += openAmount;
    summary.itemCount += 1;
  }

  const clients = Object.values(clientsMap).map((c) => ({
    ...c,
    originalTotal: Math.round(c.originalTotal * 100) / 100,
    paidTotal: Math.round(c.paidTotal * 100) / 100,
    openTotal: Math.round(c.openTotal * 100) / 100,
  }));

  return {
    summary: {
      ...summary,
      originalTotal: Math.round(summary.originalTotal * 100) / 100,
      paidTotal: Math.round(summary.paidTotal * 100) / 100,
      openTotal: Math.round(summary.openTotal * 100) / 100,
      clientCount: clients.length,
    },
    clients,
    historyAvailable: hasHistory,
  };
}

async function fetchCompanyFinance() {
  const monthStart = `${todayBrasiliaISO().slice(0, 8)}01`;
  const yearStart = `${todayBrasiliaISO().slice(0, 4)}-01-01`;
  const openWhere = chargeOpenSql();
  const overdueWhere = chargeOverdueSql();

  const [[paidMonth]] = await pool.query(
    `SELECT COALESCE(SUM(ch.amount), 0) AS t FROM charges ch
     INNER JOIN contracts c ON c.id = ch.contract_id
     WHERE ch.collector = 'assessoria' AND ch.status = 'pago' AND c.status != 'cancelado'
       AND COALESCE(ch.paid_at, ch.updated_at) >= ?`,
    [monthStart]
  );
  const [[paidYear]] = await pool.query(
    `SELECT COALESCE(SUM(ch.amount), 0) AS t FROM charges ch
     INNER JOIN contracts c ON c.id = ch.contract_id
     WHERE ch.collector = 'assessoria' AND ch.status = 'pago' AND c.status != 'cancelado'
       AND COALESCE(ch.paid_at, ch.updated_at) >= ?`,
    [yearStart]
  );
  const [[assessoriaOpen]] = await pool.query(
    `SELECT COALESCE(SUM(ch.amount), 0) AS t FROM charges ch
     INNER JOIN contracts c ON c.id = ch.contract_id
     WHERE ch.collector = 'assessoria' AND ${openWhere}`
  );
  const [[assessoriaOverdue]] = await pool.query(
    `SELECT COALESCE(SUM(ch.amount), 0) AS t FROM charges ch
     INNER JOIN contracts c ON c.id = ch.contract_id
     WHERE ch.collector = 'assessoria' AND ${overdueWhere}`
  );
  const [[auctionRevenue]] = await pool.query(
    `SELECT COALESCE(SUM(c.total_amount), 0) AS t FROM contracts c
     WHERE c.auction_id IS NOT NULL AND c.status != 'cancelado'`
  );

  let auctionExpenses = 0;
  try {
    const [[exp]] = await pool.query('SELECT COALESCE(SUM(amount), 0) AS t FROM auction_expenses');
    auctionExpenses = Number(exp.t);
  } catch {
    /* tabela opcional */
  }

  const [[auctionCommission]] = await pool.query(
    `SELECT COALESCE(SUM(c.total_amount * rules.pct / 100), 0) AS t
     FROM contracts c
     INNER JOIN (
       SELECT contract_id, COALESCE(SUM(pct), 0) AS pct
       FROM contract_payout_rules WHERE beneficiary_role = 'assessoria'
       GROUP BY contract_id
     ) rules ON rules.contract_id = c.id
     WHERE c.auction_id IS NOT NULL AND c.status != 'cancelado'`
  );
  const [[payoutsPending]] = await pool.query(
    `SELECT COALESCE(SUM(p.amount), 0) AS t FROM payouts p
     INNER JOIN contracts c ON c.id = p.contract_id
     WHERE c.status != 'cancelado' AND p.status IN ('pendente','aguardando')`
  );

  let saasMonthly = 0;
  let saasClients = 0;
  try {
    const [[saas]] = await pool.query(
      `SELECT COALESCE(SUM(COALESCE(cm.monthly_fee, c.monthly_fee, 0)), 0) AS t
       FROM client_modules cm
       INNER JOIN clients c ON c.id = cm.client_id
       WHERE cm.active = 1 AND c.active = 1 AND c.subscription_suspended = 0`
    );
    const [[saasCount]] = await pool.query(
      `SELECT COUNT(DISTINCT cm.client_id) AS t FROM client_modules cm
       INNER JOIN clients c ON c.id = cm.client_id
       WHERE cm.active = 1 AND c.active = 1`
    );
    saasMonthly = Number(saas.t);
    saasClients = Number(saasCount.t);
  } catch {
    /* migration opcional */
  }

  const monthlySeries = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const endDate = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
    const label = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    const [[paid]] = await pool.query(
      `SELECT COALESCE(SUM(ch.amount), 0) AS t FROM charges ch
       INNER JOIN contracts c ON c.id = ch.contract_id
       WHERE ch.collector = 'assessoria' AND ch.status = 'pago' AND c.status != 'cancelado'
         AND DATE(COALESCE(ch.paid_at, ch.updated_at)) BETWEEN ? AND ?`,
      [start, end]
    );
    monthlySeries.push({ label, assessoriaPaid: Math.round(Number(paid.t) * 100) / 100 });
  }

  const commission = Number(auctionCommission.t);
  return {
    assessoria: {
      paidMonth: Math.round(Number(paidMonth.t) * 100) / 100,
      paidYear: Math.round(Number(paidYear.t) * 100) / 100,
      open: Math.round(Number(assessoriaOpen.t) * 100) / 100,
      overdue: Math.round(Number(assessoriaOverdue.t) * 100) / 100,
    },
    auctions: {
      revenue: Math.round(Number(auctionRevenue.t) * 100) / 100,
      expenses: Math.round(auctionExpenses * 100) / 100,
      commissionEstimated: Math.round(commission * 100) / 100,
      resultEstimated: Math.round((commission - auctionExpenses) * 100) / 100,
    },
    payoutsPending: Math.round(Number(payoutsPending.t) * 100) / 100,
    saas: {
      monthlyEstimated: Math.round(saasMonthly * 100) / 100,
      activeClients: saasClients,
    },
    monthlySeries,
  };
}

function clientExtraFields(body) {
  return {
    rg: body.rg || null,
    rg_issuer: body.rg_issuer || null,
    birth_date: body.birth_date || null,
    nickname: body.nickname || null,
    marital_status: body.marital_status || null,
    profession: body.profession || null,
    mother_name: body.mother_name || null,
    father_name: body.father_name || null,
    zip_code: body.zip_code || null,
    address_number: body.address_number || null,
    country: body.country || 'Brasil',
    relationship_notes: body.relationship_notes || null,
    problems_notes: body.problems_notes || null,
  };
}

function validateRequiredClient(body) {
  const missing = [];
  if (!String(body.name || '').trim()) missing.push('Nome completo');
  const digits = String(body.document || '').replace(/\D/g, '');
  const docType = body.document_type || 'CPF';
  if (!digits) missing.push('CPF/CNPJ');
  else if (docType === 'CNPJ' ? digits.length !== 14 : digits.length !== 11) {
    return docType === 'CNPJ' ? 'CNPJ inválido — informe 14 dígitos' : 'CPF inválido — informe 11 dígitos';
  }
  const email = String(body.email || '').trim();
  if (!email) missing.push('E-mail');
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'E-mail inválido';
  if (!String(body.phone || '').trim()) missing.push('Telefone');
  const birth = String(body.birth_date || '').trim();
  if (!birth) missing.push('Data de nascimento');
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(birth)) return 'Data de nascimento inválida';
  else {
    const [y, m, d] = birth.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
      return 'Data de nascimento inválida';
    }
  }
  if (String(body.zip_code || '').replace(/\D/g, '').length !== 8) missing.push('CEP');
  if (!String(body.address || '').trim()) missing.push('Endereço (logradouro)');
  if (!String(body.city || '').trim()) missing.push('Cidade');
  if (!String(body.state || '').trim()) missing.push('UF');
  if (missing.length) return `Preencha os campos obrigatórios: ${missing.join(', ')}`;
  return null;
}

/** Parcelas iguais, mensais, com a diferença de centavos na última. */
function buildEqualSchedule(total, n, firstDue) {
  const base = Math.floor((total / n) * 100) / 100;
  const due = new Date(`${String(firstDue).slice(0, 10)}T12:00:00`);
  const rows = [];
  let sum = 0;
  for (let i = 1; i <= n; i++) {
    const amount = i === n ? Math.round((total - sum) * 100) / 100 : base;
    sum += amount;
    const y = due.getFullYear();
    const m = String(due.getMonth() + 1).padStart(2, '0');
    const d = String(due.getDate()).padStart(2, '0');
    rows.push({ amount, dueDate: `${y}-${m}-${d}` });
    due.setMonth(due.getMonth() + 1);
  }
  return rows;
}

function normalizeCollector(value) {
  return value === 'seller' ? 'seller' : 'assessoria';
}

function mapChargeRow(c, today = todayBrasiliaISO()) {
  let status = c.status;
  if (status === 'pendente' && c.due_date < today) status = 'atrasado';
  return {
    id: String(c.id),
    contract_id: String(c.contract_id),
    client_id: String(c.client_id),
    client_name: c.client_name ?? null,
    animal_name: c.animal_name ?? null,
    installment_no: Number(c.installment_no),
    amount: Number(c.amount),
    due_date: c.due_date,
    payment_method: c.payment_method,
    collector: normalizeCollector(c.collector),
    status,
    paid_at: c.paid_at,
    notes: c.notes,
    assessoria_commission_amount:
      c.assessoria_commission_amount != null ? Number(c.assessoria_commission_amount) : null,
    assessoria_commission_status: c.assessoria_commission_status ?? null,
    assessoria_payout_id: c.assessoria_payout_id ? String(c.assessoria_payout_id) : null,
  };
}

const CHARGE_LIST_SELECT_SQL = `SELECT ch.*, a.name AS animal_name, c.status AS contract_status, cl.name AS client_name,
  (SELECT p.amount FROM payouts p
   WHERE p.charge_id = ch.id AND p.beneficiary_role = 'assessoria' LIMIT 1) AS assessoria_commission_amount,
  (SELECT p.status FROM payouts p
   WHERE p.charge_id = ch.id AND p.beneficiary_role = 'assessoria' LIMIT 1) AS assessoria_commission_status,
  (SELECT p.id FROM payouts p
   WHERE p.charge_id = ch.id AND p.beneficiary_role = 'assessoria' LIMIT 1) AS assessoria_payout_id
  FROM charges ch
  INNER JOIN contracts c ON c.id = ch.contract_id
  INNER JOIN animals a ON a.id = c.animal_id
  INNER JOIN clients cl ON cl.id = ch.client_id`;

async function registerSellerCommission(chargeId, amount, notes, markChargePaid = true) {
  if (!amount || amount <= 0) {
    const err = new Error('Informe o valor recebido pela assessoria');
    err.status = 400;
    throw err;
  }
  const [[charge]] = await pool.execute(
    `SELECT ch.*, c.contract_number, c.installments
     FROM charges ch
     INNER JOIN contracts c ON c.id = ch.contract_id
     WHERE ch.id = ?`,
    [chargeId]
  );
  if (!charge) {
    const err = new Error('Cobrança não encontrada');
    err.status = 404;
    throw err;
  }
  const [payoutRows] = await pool.execute(
    `SELECT * FROM payouts WHERE charge_id = ? AND beneficiary_role = 'assessoria' LIMIT 1`,
    [chargeId]
  );
  const payout = payoutRows[0];
  if (!payout) {
    const err = new Error('Repasse da assessoria não encontrado para esta parcela');
    err.status = 400;
    throw err;
  }

  const noteLine = String(notes || '').trim() || 'Comissão repassada pelo vendedor';
  await pool.execute(
    `UPDATE payouts SET amount = ?, status = 'pago', paid_at = NOW(), notes = ? WHERE id = ?`,
    [amount, noteLine, payout.id]
  );

  const chargeNotes = String(charge.notes || '').trim();
  const mergedNotes = chargeNotes ? `${chargeNotes}\n${noteLine}` : noteLine;

  if (markChargePaid) {
    await pool.execute(`UPDATE charges SET status = 'pago', paid_at = NOW(), notes = ? WHERE id = ?`, [
      mergedNotes,
      chargeId,
    ]);
    await pool.execute(
      `UPDATE payouts SET status = 'pendente'
       WHERE charge_id = ? AND beneficiary_role != 'assessoria' AND status = 'aguardando'`,
      [chargeId]
    );
  } else {
    await pool.execute('UPDATE charges SET notes = ? WHERE id = ?', [mergedNotes, chargeId]);
  }

  return { charge, payout, amount, notes: noteLine };
}

async function reversePayout(payoutId, notes = null) {
  const [[payout]] = await pool.execute(
    `SELECT p.*, ch.status AS charge_status, a.name AS animal_name, c.contract_number
     FROM payouts p
     INNER JOIN charges ch ON ch.id = p.charge_id
     INNER JOIN contracts c ON c.id = p.contract_id
     INNER JOIN animals a ON a.id = c.animal_id
     WHERE p.id = ?`,
    [payoutId]
  );
  if (!payout) {
    const err = new Error('Repasse não encontrado');
    err.status = 404;
    throw err;
  }
  if (payout.status !== 'pago') {
    const err = new Error('Só é possível estornar repasse já marcado como pago');
    err.status = 400;
    throw err;
  }

  const newStatus = payout.charge_status === 'pago' ? 'pendente' : 'aguardando';
  const noteLine = String(notes || '').trim() || 'Estorno de repasse';
  const existingNotes = String(payout.notes || '').trim();
  const mergedNotes = existingNotes ? `${existingNotes}\n${noteLine}` : noteLine;

  await pool.execute('UPDATE payouts SET status = ?, paid_at = NULL, notes = ? WHERE id = ?', [
    newStatus,
    mergedNotes,
    payoutId,
  ]);

  return { payout, newStatus, notes: mergedNotes };
}

/** Cronograma manual vindo do formulário. Retorna null quando não foi informado. */
function normalizeSchedule(raw, n, total) {
  if (!Array.isArray(raw) || !raw.length) return null;
  if (raw.length !== n) {
    const err = new Error('O cronograma informado não bate com a quantidade de parcelas');
    err.status = 400;
    throw err;
  }
  const rows = raw
    .map((r, i) => ({
      order: Number(r.installmentNo ?? i + 1),
      amount: Math.round(Number(r.amount) * 100) / 100,
      dueDate: String(r.dueDate || '').slice(0, 10),
      collector: normalizeCollector(r.collector),
    }))
    .sort((a, b) => a.order - b.order);

  if (rows.some((r) => !(r.amount > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(r.dueDate))) {
    const err = new Error('Informe valor e vencimento válidos em todas as parcelas');
    err.status = 400;
    throw err;
  }
  const sum = rows.reduce((s, r) => s + r.amount, 0);
  if (Math.abs(sum - total) > 0.02) {
    const err = new Error('A soma das parcelas deve ser igual ao valor total do contrato');
    err.status = 400;
    throw err;
  }
  return rows.map(({ amount, dueDate, collector }) => ({ amount, dueDate, collector }));
}

async function generateCharges(conn, contractId, buyerId, total, n, firstDue, method, schedule = null) {
  n = Math.max(1, Math.min(50, n));
  const rows = schedule || buildEqualSchedule(total, n, firstDue);
  // Repasses dependem das cobranças — remove antes para evitar falha de FK
  await conn.execute('DELETE FROM payouts WHERE contract_id = ?', [contractId]);
  await conn.execute('DELETE FROM charges WHERE contract_id = ?', [contractId]);
  for (let i = 0; i < rows.length; i++) {
    await conn.execute(
      `INSERT INTO charges (contract_id, client_id, installment_no, amount, due_date, payment_method, collector, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pendente')`,
      [
        contractId,
        buyerId,
        i + 1,
        rows[i].amount,
        rows[i].dueDate,
        method,
        normalizeCollector(rows[i].collector),
      ]
    );
  }
}

/** Contratos já cancelados: inativa cobranças/repasses abertos (corrige registros antigos). */
async function syncCancelledContractFinance(conn = pool) {
  await conn.execute(
    `UPDATE charges ch
     INNER JOIN contracts c ON c.id = ch.contract_id
     SET ch.status = 'cancelado'
     WHERE c.status = 'cancelado' AND ch.status NOT IN ('pago', 'cancelado')`
  );
  await conn.execute(
    `UPDATE payouts p
     INNER JOIN contracts c ON c.id = p.contract_id
     SET p.status = 'cancelado'
     WHERE c.status = 'cancelado' AND p.status NOT IN ('pago', 'cancelado')`
  );
}

/** Regras de repasse (% por beneficiário) → parcelas vinculadas a cada cobrança */
async function generatePayouts(conn, contractId, rules) {
  await conn.execute('DELETE FROM payouts WHERE contract_id = ?', [contractId]);
  await conn.execute('DELETE FROM contract_payout_rules WHERE contract_id = ?', [contractId]);
  if (!Array.isArray(rules) || rules.length === 0) return;

  const cleaned = [];
  for (const r of rules) {
    const pct = Number(r.pct);
    const role = r.beneficiaryRole || r.beneficiary_role;
    if (!['assessoria', 'seller', 'assessor', 'outro'].includes(role)) continue;
    if (!(pct > 0)) continue;
    cleaned.push({
      role,
      clientId: r.beneficiaryClientId || r.beneficiary_client_id || null,
      label: r.label || null,
      pct,
    });
  }
  if (!cleaned.length) return;

  const sumPct = cleaned.reduce((s, r) => s + r.pct, 0);
  if (sumPct > 100.01) {
    const err = new Error('A soma dos percentuais de repasse não pode passar de 100%');
    err.status = 400;
    throw err;
  }

  const ruleIds = [];
  for (let i = 0; i < cleaned.length; i++) {
    const r = cleaned[i];
    const [ins] = await conn.execute(
      `INSERT INTO contract_payout_rules
       (contract_id, beneficiary_role, beneficiary_client_id, label, pct, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [contractId, r.role, r.clientId ? Number(r.clientId) : null, r.label, r.pct, i]
    );
    ruleIds.push({ ...r, id: ins.insertId });
  }

  const [charges] = await conn.execute(
    'SELECT id, installment_no, amount FROM charges WHERE contract_id = ? ORDER BY installment_no ASC',
    [contractId]
  );
  for (const ch of charges) {
    let allocated = 0;
    for (let i = 0; i < ruleIds.length; i++) {
      const r = ruleIds[i];
      let amount =
        i === ruleIds.length - 1 && Math.abs(sumPct - 100) < 0.01
          ? Math.round((Number(ch.amount) - allocated) * 100) / 100
          : Math.round(Number(ch.amount) * (r.pct / 100) * 100) / 100;
      allocated += amount;
      await conn.execute(
        `INSERT INTO payouts
         (contract_id, charge_id, rule_id, installment_no, beneficiary_role, beneficiary_client_id, label, pct, amount, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'aguardando')`,
        [
          contractId,
          ch.id,
          r.id,
          ch.installment_no,
          r.role,
          r.clientId ? Number(r.clientId) : null,
          r.label,
          r.pct,
          amount,
        ]
      );
    }
  }
}

function mapContract(r) {
  return {
    id: String(r.id),
    animal_id: String(r.animal_id),
    animal_name: r.animal_name || null,
    animal_chip: r.animal_chip || null,
    animal_color: r.animal_color || null,
    animal_birth_date: r.animal_birth_date || null,
    animal_sex: r.animal_sex || null,
    animal_notes: r.animal_notes || null,
    sale_type: r.sale_type,
    share_pct: r.share_pct != null ? Number(r.share_pct) : null,
    seller_id: String(r.seller_id),
    seller_name: r.seller_name || null,
    seller_document: r.seller_document || null,
    seller_document_type: r.seller_document_type || null,
    seller_birth_date: r.seller_birth_date || null,
    seller_email: r.seller_email || null,
    seller_phone: r.seller_phone || null,
    seller_whatsapp: r.seller_whatsapp || null,
    seller_address: [r.seller_address, r.seller_address_number].filter(Boolean).join(', nº ') || null,
    seller_city: r.seller_city || null,
    seller_state: r.seller_state || null,
    buyer_id: String(r.buyer_id),
    buyer_name: r.buyer_name || null,
    buyer_document: r.buyer_document || null,
    buyer_document_type: r.buyer_document_type || null,
    buyer_birth_date: r.buyer_birth_date || null,
    buyer_email: r.buyer_email || null,
    buyer_phone: r.buyer_phone || null,
    buyer_whatsapp: r.buyer_whatsapp || null,
    buyer_address: [r.buyer_address, r.buyer_address_number].filter(Boolean).join(', nº ') || null,
    buyer_city: r.buyer_city || null,
    buyer_state: r.buyer_state || null,
    assessor_id: r.assessor_id ? String(r.assessor_id) : null,
    assessor_name: r.assessor_name || null,
    auction_id: r.auction_id ? String(r.auction_id) : null,
    auction_name: r.auction_name || null,
    auction_date: r.auction_date || null,
    lot_id: r.lot_id ? String(r.lot_id) : null,
    template_id: r.template_id ? String(r.template_id) : null,
    template_name: r.template_name || null,
    template_title: r.template_title || null,
    template_body: r.template_body || null,
    contract_number: r.contract_number || null,
    lot_label: r.lot_label || null,
    animal_category: r.animal_category || null,
    quantity: r.quantity != null ? Number(r.quantity) : 1,
    commission_total_pct: r.commission_total_pct != null ? Number(r.commission_total_pct) : null,
    commission_buyer_pct: r.commission_buyer_pct != null ? Number(r.commission_buyer_pct) : null,
    commission_seller_pct: r.commission_seller_pct != null ? Number(r.commission_seller_pct) : null,
    witness1_id: r.witness1_id ? String(r.witness1_id) : null,
    witness1_name: r.witness1_name || null,
    witness1_email: r.witness1_email || null,
    witness1_phone: r.witness1_phone || null,
    witness1_whatsapp: r.witness1_whatsapp || null,
    witness1_document: r.witness1_document || null,
    witness1_document_type: r.witness1_document_type || null,
    witness1_birth_date: r.witness1_birth_date || null,
    witness2_id: r.witness2_id ? String(r.witness2_id) : null,
    witness2_name: r.witness2_name || null,
    witness2_email: r.witness2_email || null,
    witness2_phone: r.witness2_phone || null,
    witness2_whatsapp: r.witness2_whatsapp || null,
    witness2_document: r.witness2_document || null,
    witness2_document_type: r.witness2_document_type || null,
    witness2_birth_date: r.witness2_birth_date || null,
    via_label: r.via_label || 'VIA DAS PARTES — VENDEDOR E COMPRADOR',
    clicksign_envelope_id: r.clicksign_envelope_id || null,
    clicksign_document_id: r.clicksign_document_id || null,
    clicksign_status: r.clicksign_status || null,
    clicksign_sent_at: r.clicksign_sent_at || null,
    clicksign_signed_count:
      r.clicksign_signed_count != null ? Number(r.clicksign_signed_count) : null,
    clicksign_total_count:
      r.clicksign_total_count != null ? Number(r.clicksign_total_count) : null,
    total_amount: Number(r.total_amount),
    payment_method: r.payment_method,
    installments: Number(r.installments),
    first_due_date: r.first_due_date,
    status: r.status,
    notes: r.notes,
    created_at: r.created_at || null,
  };
}

function mapTemplate(r) {
  return {
    id: String(r.id),
    name: r.name,
    code: r.code,
    title: r.title,
    body_text: r.body_text,
    is_default: Boolean(r.is_default),
    active: Boolean(r.active),
    notes: r.notes,
    created_at: r.created_at || null,
  };
}

function mapAuction(r) {
  return {
    id: String(r.id),
    name: r.name,
    auction_date: r.auction_date,
    location: r.location,
    organizer: r.organizer,
    status: r.status,
    notes: r.notes,
    lots_count: r.lots_count != null ? Number(r.lots_count) : undefined,
    created_at: r.created_at || null,
  };
}

function mapLot(r) {
  return {
    id: String(r.id),
    auction_id: String(r.auction_id),
    animal_id: String(r.animal_id),
    animal_name: r.animal_name || null,
    lot_number: r.lot_number,
    seller_id: String(r.seller_id),
    seller_name: r.seller_name || null,
    sellers: r.sellers || undefined,
    min_price: r.min_price != null ? Number(r.min_price) : null,
    conditions_text: r.conditions_text,
    status: r.status,
    contract_id: r.contract_id ? String(r.contract_id) : null,
    created_at: r.created_at || null,
  };
}

const AUCTION_EXPENSE_CATEGORIES = ['locacao', 'equipe', 'marketing', 'leiloeiro', 'transporte', 'outros'];

function normalizeAuctionExpenseCategory(cat) {
  return AUCTION_EXPENSE_CATEGORIES.includes(cat) ? cat : 'outros';
}

function mapAuctionExpense(r) {
  return {
    id: String(r.id),
    auction_id: String(r.auction_id),
    category: r.category,
    description: r.description,
    amount: Number(r.amount),
    expense_date: r.expense_date,
    created_at: r.created_at || null,
  };
}

async function fetchAuctionFinance(auctionId) {
  const [[auction]] = await pool.execute('SELECT id FROM auctions WHERE id = ?', [auctionId]);
  if (!auction) {
    const err = new Error('Leilão não encontrado');
    err.status = 404;
    throw err;
  }

  const [[lots]] = await pool.execute(
    `SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'arrematado' THEN 1 ELSE 0 END) AS sold
     FROM auction_lots WHERE auction_id = ?`,
    [auctionId]
  );

  const [contracts] = await pool.execute(
    `SELECT c.id, c.contract_number, c.total_amount, c.status,
            an.name AS animal_name, b.name AS buyer_name, l.lot_number
     FROM contracts c
     LEFT JOIN animals an ON an.id = c.animal_id
     LEFT JOIN clients b ON b.id = c.buyer_id
     LEFT JOIN auction_lots l ON l.id = c.lot_id
     WHERE c.auction_id = ? AND c.status != 'cancelado'
     ORDER BY c.id ASC`,
    [auctionId]
  );

  let revenueTotal = 0;
  const revenueByStatus = {
    rascunho: 0,
    aguardando_assinatura: 0,
    ativo: 0,
    concluido: 0,
  };
  let assessoriaEstimated = 0;
  const contractRows = [];

  for (const c of contracts) {
    const amount = Number(c.total_amount);
    revenueTotal += amount;
    if (revenueByStatus[c.status] !== undefined) revenueByStatus[c.status] += amount;

    const [[pctRow]] = await pool.execute(
      `SELECT COALESCE(SUM(pct), 0) AS pct FROM contract_payout_rules
       WHERE contract_id = ? AND beneficiary_role = 'assessoria'`,
      [c.id]
    );
    const assessoriaPct = Number(pctRow?.pct || 0);
    assessoriaEstimated += (amount * assessoriaPct) / 100;

    contractRows.push({
      id: String(c.id),
      contract_number: c.contract_number,
      animal_name: c.animal_name,
      buyer_name: c.buyer_name,
      lot_number: c.lot_number,
      total_amount: amount,
      status: c.status,
      assessoria_pct: assessoriaPct,
      assessoria_amount: Math.round((amount * assessoriaPct) / 100 * 100) / 100,
    });
  }

  const [expenseRows] = await pool.execute(
    `SELECT * FROM auction_expenses WHERE auction_id = ?
     ORDER BY COALESCE(expense_date, created_at) DESC, id DESC`,
    [auctionId]
  );
  const expenses = expenseRows.map(mapAuctionExpense);

  let expensesTotal = 0;
  const expensesByCategory = {};
  for (const e of expenses) {
    expensesTotal += e.amount;
    expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + e.amount;
  }

  return {
    auction_id: String(auctionId),
    lots_total: Number(lots?.total || 0),
    lots_sold: Number(lots?.sold || 0),
    revenue_total: Math.round(revenueTotal * 100) / 100,
    revenue_by_status: Object.fromEntries(
      Object.entries(revenueByStatus).map(([k, v]) => [k, Math.round(v * 100) / 100])
    ),
    assessoria_estimated: Math.round(assessoriaEstimated * 100) / 100,
    expenses_total: Math.round(expensesTotal * 100) / 100,
    expenses_by_category: Object.fromEntries(
      Object.entries(expensesByCategory).map(([k, v]) => [k, Math.round(v * 100) / 100])
    ),
    result_net: Math.round((assessoriaEstimated - expensesTotal) * 100) / 100,
    contracts: contractRows,
    expenses,
  };
}

async function fetchAssessorAuctions(assessorClientId) {
  const [rows] = await pool.execute(
    `SELECT a.*,
        COUNT(DISTINCT c.id) AS contracts_count,
        COALESCE(SUM(c.total_amount), 0) AS sales_total
     FROM auctions a
     INNER JOIN contracts c ON c.auction_id = a.id AND c.assessor_id = ? AND c.status != 'cancelado'
     GROUP BY a.id
     ORDER BY COALESCE(a.auction_date, a.created_at) DESC, a.id DESC`,
    [assessorClientId]
  );

  const out = [];
  for (const r of rows) {
    const auctionId = Number(r.id);
    const [[commissionRow]] = await pool.execute(
      `SELECT COALESCE(SUM(c.total_amount * rules.pct / 100), 0) AS commission
       FROM contracts c
       INNER JOIN (
         SELECT contract_id, COALESCE(SUM(pct), 0) AS pct
         FROM contract_payout_rules
         WHERE beneficiary_role = 'assessor'
           AND (beneficiary_client_id IS NULL OR beneficiary_client_id = ?)
         GROUP BY contract_id
       ) rules ON rules.contract_id = c.id
       WHERE c.auction_id = ? AND c.assessor_id = ? AND c.status != 'cancelado'`,
      [assessorClientId, auctionId, assessorClientId]
    );
    const salesTotal = Number(r.sales_total || 0);
    out.push({
      ...mapAuction(r),
      contracts_count: Number(r.contracts_count || 0),
      sales_total: Math.round(salesTotal * 100) / 100,
      commission_estimated: Math.round(Number(commissionRow?.commission || 0) * 100) / 100,
    });
  }
  return out;
}

async function fetchAssessorAuctionFinance(auctionId, assessorClientId) {
  const [[access]] = await pool.execute(
    `SELECT 1 AS ok FROM contracts
     WHERE auction_id = ? AND assessor_id = ? AND status != 'cancelado' LIMIT 1`,
    [auctionId, assessorClientId]
  );
  if (!access) {
    const err = new Error('Evento não encontrado ou sem acesso');
    err.status = 404;
    throw err;
  }

  const [[auction]] = await pool.execute('SELECT * FROM auctions WHERE id = ?', [auctionId]);
  if (!auction) {
    const err = new Error('Leilão não encontrado');
    err.status = 404;
    throw err;
  }

  const [contracts] = await pool.execute(
    `SELECT c.id, c.contract_number, c.total_amount, c.status,
            an.name AS animal_name, b.name AS buyer_name, l.lot_number
     FROM contracts c
     LEFT JOIN animals an ON an.id = c.animal_id
     LEFT JOIN clients b ON b.id = c.buyer_id
     LEFT JOIN auction_lots l ON l.id = c.lot_id
     WHERE c.auction_id = ? AND c.assessor_id = ? AND c.status != 'cancelado'
     ORDER BY c.id ASC`,
    [auctionId, assessorClientId]
  );

  let salesTotal = 0;
  let commissionEstimated = 0;
  const contractRows = [];
  for (const c of contracts) {
    const amount = Number(c.total_amount);
    salesTotal += amount;
    const [[pctRow]] = await pool.execute(
      `SELECT COALESCE(SUM(pct), 0) AS pct FROM contract_payout_rules
       WHERE contract_id = ? AND beneficiary_role = 'assessor'
         AND (beneficiary_client_id IS NULL OR beneficiary_client_id = ?)`,
      [c.id, assessorClientId]
    );
    const commissionPct = Number(pctRow?.pct || 0);
    const commissionAmount = Math.round((amount * commissionPct) / 100 * 100) / 100;
    commissionEstimated += commissionAmount;
    contractRows.push({
      id: String(c.id),
      contract_number: c.contract_number,
      animal_name: c.animal_name,
      buyer_name: c.buyer_name,
      lot_number: c.lot_number,
      total_amount: amount,
      status: c.status,
      commission_pct: commissionPct,
      commission_amount: commissionAmount,
    });
  }

  const [payoutRows] = await pool.execute(
    `SELECT p.id, p.contract_id, p.installment_no, p.amount, p.status, p.paid_at,
            ch.due_date AS charge_due_date, an.name AS animal_name
     FROM payouts p
     INNER JOIN contracts c ON c.id = p.contract_id
     INNER JOIN charges ch ON ch.id = p.charge_id
     INNER JOIN animals an ON an.id = c.animal_id
     WHERE c.auction_id = ? AND c.status != 'cancelado'
       AND p.beneficiary_role = 'assessor' AND p.beneficiary_client_id = ?
     ORDER BY ch.due_date ASC, p.installment_no ASC, p.id ASC`,
    [auctionId, assessorClientId]
  );

  let commissionPaid = 0;
  let commissionPending = 0;
  let commissionWaiting = 0;
  const payouts = payoutRows.map((p) => {
    const amount = Number(p.amount);
    if (p.status === 'pago') commissionPaid += amount;
    else if (p.status === 'pendente') commissionPending += amount;
    else if (p.status === 'aguardando') commissionWaiting += amount;
    return {
      id: String(p.id),
      contract_id: String(p.contract_id),
      installment_no: Number(p.installment_no),
      amount,
      status: p.status,
      paid_at: p.paid_at,
      charge_due_date: p.charge_due_date,
      animal_name: p.animal_name,
    };
  });

  return {
    auction_id: String(auctionId),
    auction_name: auction.name,
    auction_date: auction.auction_date,
    location: auction.location,
    auction_status: auction.status,
    contracts_count: contractRows.length,
    sales_total: Math.round(salesTotal * 100) / 100,
    commission_estimated: Math.round(commissionEstimated * 100) / 100,
    commission_paid: Math.round(commissionPaid * 100) / 100,
    commission_pending: Math.round(commissionPending * 100) / 100,
    commission_waiting: Math.round(commissionWaiting * 100) / 100,
    contracts: contractRows,
    payouts,
  };
}

/** Normaliza sellerId | sellerIds | sellers → lista com principal. */
function normalizeLotSellers(body) {
  let list = [];
  if (Array.isArray(body.sellers) && body.sellers.length) {
    list = body.sellers
      .map((s, i) => ({
        clientId: Number(s.clientId ?? s.client_id ?? s),
        sharePct: s.sharePct != null ? Number(s.sharePct) : null,
        isPrimary: !!s.isPrimary || !!s.is_primary,
        order: i,
      }))
      .filter((s) => s.clientId > 0);
  } else if (Array.isArray(body.sellerIds) && body.sellerIds.length) {
    list = body.sellerIds
      .map((id, i) => ({ clientId: Number(id), sharePct: null, isPrimary: i === 0, order: i }))
      .filter((s) => s.clientId > 0);
  } else if (body.sellerId) {
    list = [{ clientId: Number(body.sellerId), sharePct: 100, isPrimary: true, order: 0 }];
  }

  // unique
  const seen = new Set();
  list = list.filter((s) => {
    if (seen.has(s.clientId)) return false;
    seen.add(s.clientId);
    return true;
  });
  if (!list.length) return null;

  if (!list.some((s) => s.isPrimary)) list[0].isPrimary = true;
  list.forEach((s) => {
    if (!s.isPrimary) s.isPrimary = false;
  });
  // only one primary
  let primarySeen = false;
  list = list.map((s) => {
    if (s.isPrimary && !primarySeen) {
      primarySeen = true;
      return s;
    }
    return { ...s, isPrimary: false };
  });

  const n = list.length;
  const equal = Math.round((100 / n) * 100) / 100;
  list = list.map((s, i) => ({
    ...s,
    sharePct:
      s.sharePct != null && !Number.isNaN(s.sharePct)
        ? s.sharePct
        : i === n - 1
          ? Math.round((100 - equal * (n - 1)) * 100) / 100
          : equal,
  }));
  return list;
}

async function upsertLotSellers(conn, lotId, sellers) {
  await conn.execute('DELETE FROM auction_lot_sellers WHERE lot_id = ?', [lotId]);
  for (const s of sellers) {
    await conn.execute(
      `INSERT INTO auction_lot_sellers (lot_id, client_id, share_pct, is_primary)
       VALUES (?, ?, ?, ?)`,
      [lotId, s.clientId, s.sharePct, s.isPrimary ? 1 : 0]
    );
  }
}

async function attachLotSellers(poolOrConn, lots) {
  if (!lots?.length) return [];
  const ids = lots.map((l) => l.id);
  let rows = [];
  try {
    const [r] = await poolOrConn.execute(
      `SELECT als.lot_id, als.client_id, als.share_pct, als.is_primary, c.name AS client_name
       FROM auction_lot_sellers als
       INNER JOIN clients c ON c.id = als.client_id
       WHERE als.lot_id IN (${ids.map(() => '?').join(',')})
       ORDER BY als.is_primary DESC, c.name ASC`,
      ids
    );
    rows = r;
  } catch {
    /* migration ainda não aplicada */
  }
  const byLot = {};
  for (const row of rows) {
    (byLot[row.lot_id] ||= []).push({
      clientId: String(row.client_id),
      clientName: row.client_name,
      sharePct: Number(row.share_pct),
      isPrimary: !!row.is_primary,
    });
  }
  return lots.map((l) => {
    const sellers =
      byLot[l.id] ||
      (l.seller_id
        ? [
            {
              clientId: String(l.seller_id),
              clientName: l.seller_name || '',
              sharePct: 100,
              isPrimary: true,
            },
          ]
        : []);
    const primary = sellers.find((s) => s.isPrimary) || sellers[0];
    return mapLot({
      ...l,
      seller_id: primary?.clientId || l.seller_id,
      seller_name: sellers.map((s) => s.clientName).filter(Boolean).join(', ') || l.seller_name,
      sellers,
    });
  });
}

function mapPayout(r) {
  return {
    id: String(r.id),
    contract_id: String(r.contract_id),
    charge_id: String(r.charge_id),
    installment_no: Number(r.installment_no),
    beneficiary_role: r.beneficiary_role,
    beneficiary_client_id: r.beneficiary_client_id ? String(r.beneficiary_client_id) : null,
    beneficiary_name: r.beneficiary_name || null,
    label: r.label,
    pct: Number(r.pct),
    amount: Number(r.amount),
    status: r.status,
    paid_at: r.paid_at,
    notes: r.notes,
    animal_name: r.animal_name || null,
    charge_status: r.charge_status || null,
    charge_due_date: r.charge_due_date || null,
  };
}

// Clients
app.get('/api/clients', auth(), async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const roleFilter = (req.query.role || '').trim();
    let sql = `SELECT c.*, (
        SELECT cp.name FROM client_properties cp
        WHERE cp.client_id = c.id
        ORDER BY cp.is_primary DESC, cp.id ASC
        LIMIT 1
      ) AS property_name
      FROM clients c WHERE 1=1`;
    const params = [];

    if (req.user.role === 'cliente') {
      if (!req.user.clientId) return res.json([]);
      sql += ' AND c.id = ?';
      params.push(req.user.clientId);
    }

    if (q) {
      sql += ` AND (
        c.name LIKE ? OR c.document LIKE ? OR c.email LIKE ? OR c.phone LIKE ?
        OR EXISTS (
          SELECT 1 FROM client_properties cp
          WHERE cp.client_id = c.id AND cp.name LIKE ?
        )
      )`;
      const like = `%${q}%`;
      params.push(like, like, like, like, like);
    }
    if (roleFilter === 'seller') sql += ' AND c.is_seller = 1';
    if (roleFilter === 'buyer') sql += ' AND c.is_buyer = 1';
    if (roleFilter === 'assessor') sql += ' AND c.is_assessor = 1';
    if (roleFilter === 'witness') sql += ' AND c.is_witness = 1';
    if (roleFilter === 'avalista') sql += ' AND c.is_avalista = 1';

    sql += ' ORDER BY c.name ASC';
    const [rows] = await pool.execute(sql, params);
    res.json(rows.map(mapClient));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao listar clientes' });
  }
});

app.get('/api/clients/:id/access-user', auth(), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (req.user.role === 'cliente' && req.user.clientId !== id) {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    const user = await getClientAccessUser(id);
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar usuário de acesso' });
  }
});

app.post('/api/clients/:id/access-user', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.execute('SELECT * FROM clients WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Pessoa não encontrada' });
    const client = rows[0];
    if (await getClientAccessUser(id)) {
      return res.status(409).json({ error: 'Esta pessoa já possui usuário de acesso' });
    }
    const name = String(client.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório para criar usuário' });
    const username = await generateUsernameFromName(name);
    const email = String(client.email || '').trim() || null;
    const hash = await bcrypt.hash(DEFAULT_CLIENT_ACCESS_PASSWORD, 12);
    const [result] = await pool.execute(
      `INSERT INTO users (username, email, password_hash, name, role, client_id, active, must_change_password)
       VALUES (?, ?, ?, ?, 'cliente', ?, 1, 0)`,
      [username, email, hash, name, id]
    );
    const [created] = await pool.execute(
      `SELECT id, username, email, name, avatar_url, role, client_id, active, must_change_password, created_at
       FROM users WHERE id = ?`,
      [result.insertId]
    );
    res.json({
      success: true,
      user: mapUser(created[0]),
      defaultPassword: DEFAULT_CLIENT_ACCESS_PASSWORD,
      message: 'Usuário de acesso criado com sucesso',
    });
  } catch (error) {
    console.error(error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Usuário ou e-mail já existe' });
    }
    res.status(500).json({ error: 'Erro ao criar usuário de acesso' });
  }
});

app.put('/api/clients/:id/access-user/password', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const password = String(req.body?.password || '');
    if (password.length < 6) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' });
    }
    const user = await getClientAccessUser(id);
    if (!user) {
      return res.status(404).json({ error: 'Esta pessoa ainda não possui usuário de acesso' });
    }
    const hash = await bcrypt.hash(password, 12);
    await pool.execute('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?', [
      hash,
      Number(user.id),
    ]);
    res.json({ success: true, message: 'Senha atualizada' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar senha' });
  }
});

app.get('/api/clients/:id', auth(), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (req.user.role === 'cliente' && req.user.clientId !== id) {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    const [rows] = await pool.execute('SELECT * FROM clients WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Cliente não encontrado' });
    res.json(mapClient(rows[0]));
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar cliente' });
  }
});

app.post('/api/clients', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const {
      name, document_type = 'CPF', document, email, phone, whatsapp,
      city, state, address, notes, active = true,
      is_seller = false, is_buyer = true, is_assessor = false, is_witness = false, is_avalista = false,
    } = req.body;
    const extra = clientExtraFields(req.body);

    const validationError = validateRequiredClient(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    const [result] = await pool.execute(
      `INSERT INTO clients
       (name, document_type, document, rg, rg_issuer, birth_date, nickname, marital_status, profession,
        mother_name, father_name, email, phone, whatsapp, city, state, address, address_number, zip_code, country,
        notes, relationship_notes, problems_notes, active, is_seller, is_buyer, is_assessor, is_witness, is_avalista, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        document_type || 'CPF',
        document || null,
        extra.rg, extra.rg_issuer, extra.birth_date, extra.nickname, extra.marital_status, extra.profession,
        extra.mother_name, extra.father_name,
        email || null,
        phone || null,
        whatsapp || null,
        city || null,
        state || null,
        address || null,
        extra.address_number,
        extra.zip_code, extra.country,
        notes || null,
        extra.relationship_notes, extra.problems_notes,
        active ? 1 : 0,
        is_seller ? 1 : 0,
        is_buyer ? 1 : 0,
        is_assessor ? 1 : 0,
        is_witness ? 1 : 0,
        is_avalista ? 1 : 0,
        req.user.id,
      ]
    );
    res.json({ success: true, id: String(result.insertId) });
  } catch (error) {
    console.error(error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Documento já cadastrado' });
    }
    res.status(500).json({ error: 'Erro ao criar cliente' });
  }
});

app.put('/api/clients/:id', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      name, document_type, document, email, phone, whatsapp,
      city, state, address, notes, active,
      is_seller, is_buyer, is_assessor, is_witness, is_avalista,
    } = req.body;
    const extra = clientExtraFields(req.body);

    const validationError = validateRequiredClient(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    await pool.execute(
      `UPDATE clients SET
        name=?, document_type=?, document=?, rg=?, rg_issuer=?, birth_date=?, nickname=?, marital_status=?, profession=?,
        mother_name=?, father_name=?, email=?, phone=?, whatsapp=?,
        city=?, state=?, address=?, address_number=?, zip_code=?, country=?, notes=?, relationship_notes=?, problems_notes=?,
        active=?, is_seller=?, is_buyer=?, is_assessor=?, is_witness=?, is_avalista=?
       WHERE id=?`,
      [
        name.trim(),
        document_type || 'CPF',
        document || null,
        extra.rg, extra.rg_issuer, extra.birth_date, extra.nickname, extra.marital_status, extra.profession,
        extra.mother_name, extra.father_name,
        email || null,
        phone || null,
        whatsapp || null,
        city || null,
        state || null,
        address || null,
        extra.address_number,
        extra.zip_code, extra.country,
        notes || null,
        extra.relationship_notes, extra.problems_notes,
        active === false ? 0 : 1,
        is_seller ? 1 : 0,
        is_buyer ? 1 : 0,
        is_assessor ? 1 : 0,
        is_witness ? 1 : 0,
        is_avalista ? 1 : 0,
        id,
      ]
    );
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Documento já cadastrado' });
    }
    res.status(500).json({ error: 'Erro ao atualizar cliente' });
  }
});

app.delete('/api/clients/:id', auth(['root', 'admin', 'user']), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const id = Number(req.params.id);
    await conn.beginTransaction();
    // Remove vínculos de propriedade (FK RESTRICT impede DELETE direto)
    await conn.execute('DELETE FROM animal_owners WHERE client_id = ?', [id]);
    const [result] = await conn.execute('DELETE FROM clients WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    await conn.commit();
    res.json({ success: true, message: 'Cliente excluído' });
  } catch (error) {
    await conn.rollback();
    console.error(error);
    res.status(500).json({ error: 'Erro ao excluir cliente' });
  } finally {
    conn.release();
  }
});

const DOC_TYPES = ['rg', 'identidade', 'cnh', 'comprovante_residencia', 'selfie', 'outro'];

app.get('/api/clients/:id/documents', auth(), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (req.user.role === 'cliente' && req.user.clientId !== id) {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    const [rows] = await pool.execute(
      'SELECT * FROM client_documents WHERE client_id = ? ORDER BY created_at DESC',
      [id]
    );
    res.json(
      rows.map((r) => ({
        id: String(r.id),
        client_id: String(r.client_id),
        doc_type: r.doc_type,
        file_url: r.file_url,
        file_name: r.file_name,
        notes: r.notes,
        created_at: r.created_at,
      }))
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao listar documentos' });
  }
});

app.post('/api/clients/:id/documents', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { docType = 'outro', fileUrl, fileName, notes } = req.body;
    if (!fileUrl) return res.status(400).json({ error: 'Arquivo é obrigatório' });
    if (!DOC_TYPES.includes(docType)) return res.status(400).json({ error: 'Tipo de documento inválido' });
    const [result] = await pool.execute(
      `INSERT INTO client_documents (client_id, doc_type, file_url, file_name, notes, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, docType, fileUrl, fileName || null, notes || null, req.user.id]
    );
    res.json({ success: true, id: String(result.insertId) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao salvar documento' });
  }
});

app.delete('/api/clients/:id/documents/:docId', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const [result] = await pool.execute(
      'DELETE FROM client_documents WHERE id = ? AND client_id = ?',
      [Number(req.params.docId), Number(req.params.id)]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Documento não encontrado' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir documento' });
  }
});

app.get('/api/clients/:id/properties', auth(), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (req.user.role === 'cliente' && req.user.clientId !== id) {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    const [rows] = await pool.execute(
      'SELECT * FROM client_properties WHERE client_id = ? ORDER BY is_primary DESC, name ASC',
      [id]
    );
    res.json(rows.map((r) => ({ ...r, id: String(r.id), client_id: String(r.client_id), is_primary: Boolean(r.is_primary) })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao listar propriedades' });
  }
});

app.post('/api/clients/:id/properties', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const b = req.body;
    if (!String(b.name || '').trim()) return res.status(400).json({ error: 'Nome da propriedade é obrigatório' });
    const [result] = await pool.execute(
      `INSERT INTO client_properties
       (client_id, name, cnpj, state_registration, zip_code, state, city, address, phone, property_type, is_primary, manager_name, manager_phone, manager_email, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, String(b.name).trim(), b.cnpj || null, b.state_registration || null, b.zip_code || null,
        b.state || null, b.city || null, b.address || null, b.phone || null, b.property_type || null,
        b.is_primary ? 1 : 0, b.manager_name || null, b.manager_phone || null, b.manager_email || null, b.notes || null,
      ]
    );
    res.json({ success: true, id: String(result.insertId) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar propriedade' });
  }
});

app.put('/api/clients/:id/properties/:propId', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const b = req.body;
    if (!String(b.name || '').trim()) return res.status(400).json({ error: 'Nome da propriedade é obrigatório' });
    await pool.execute(
      `UPDATE client_properties SET
        name=?, cnpj=?, state_registration=?, zip_code=?, state=?, city=?, address=?, phone=?, property_type=?,
        is_primary=?, manager_name=?, manager_phone=?, manager_email=?, notes=?
       WHERE id=? AND client_id=?`,
      [
        String(b.name).trim(), b.cnpj || null, b.state_registration || null, b.zip_code || null,
        b.state || null, b.city || null, b.address || null, b.phone || null, b.property_type || null,
        b.is_primary ? 1 : 0, b.manager_name || null, b.manager_phone || null, b.manager_email || null, b.notes || null,
        Number(req.params.propId), Number(req.params.id),
      ]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar propriedade' });
  }
});

app.delete('/api/clients/:id/properties/:propId', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const [result] = await pool.execute(
      'DELETE FROM client_properties WHERE id = ? AND client_id = ?',
      [Number(req.params.propId), Number(req.params.id)]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Propriedade não encontrada' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir propriedade' });
  }
});

app.get('/api/clients/:id/bank-accounts', auth(), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (req.user.role === 'cliente' && req.user.clientId !== id) {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    const [rows] = await pool.execute(
      'SELECT * FROM client_bank_accounts WHERE client_id = ? ORDER BY is_primary DESC, id ASC',
      [id]
    );
    res.json(rows.map((r) => ({ ...r, id: String(r.id), client_id: String(r.client_id), is_primary: Boolean(r.is_primary) })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao listar contas' });
  }
});

app.post('/api/clients/:id/bank-accounts', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const b = req.body;
    if (!String(b.bank_name || '').trim()) return res.status(400).json({ error: 'Banco é obrigatório' });
    const accountType = ['corrente', 'poupanca', 'pagamento', 'outro'].includes(b.account_type)
      ? b.account_type
      : 'corrente';
    const [result] = await pool.execute(
      `INSERT INTO client_bank_accounts
       (client_id, account_type, bank_name, agency, account_number, holder_name, holder_document, is_primary, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, accountType, String(b.bank_name).trim(), b.agency || null, b.account_number || null,
        b.holder_name || null, b.holder_document || null, b.is_primary ? 1 : 0, b.notes || null,
      ]
    );
    res.json({ success: true, id: String(result.insertId) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar conta' });
  }
});

app.put('/api/clients/:id/bank-accounts/:accId', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const b = req.body;
    if (!String(b.bank_name || '').trim()) return res.status(400).json({ error: 'Banco é obrigatório' });
    const accountType = ['corrente', 'poupanca', 'pagamento', 'outro'].includes(b.account_type)
      ? b.account_type
      : 'corrente';
    await pool.execute(
      `UPDATE client_bank_accounts SET
        account_type=?, bank_name=?, agency=?, account_number=?, holder_name=?, holder_document=?, is_primary=?, notes=?
       WHERE id=? AND client_id=?`,
      [
        accountType, String(b.bank_name).trim(), b.agency || null, b.account_number || null,
        b.holder_name || null, b.holder_document || null, b.is_primary ? 1 : 0, b.notes || null,
        Number(req.params.accId), Number(req.params.id),
      ]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar conta' });
  }
});

app.delete('/api/clients/:id/bank-accounts/:accId', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const [result] = await pool.execute(
      'DELETE FROM client_bank_accounts WHERE id = ? AND client_id = ?',
      [Number(req.params.accId), Number(req.params.id)]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Conta não encontrada' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir conta' });
  }
});

app.get('/api/clients/:id/contacts', auth(), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (req.user.role === 'cliente' && req.user.clientId !== id) {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    const [rows] = await pool.execute(
      'SELECT * FROM client_contacts WHERE client_id = ? ORDER BY name ASC',
      [id]
    );
    res.json(rows.map((r) => ({ ...r, id: String(r.id), client_id: String(r.client_id) })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao listar contatos' });
  }
});

app.post('/api/clients/:id/contacts', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const b = req.body;
    if (!String(b.name || '').trim()) return res.status(400).json({ error: 'Nome do contato é obrigatório' });
    const [result] = await pool.execute(
      `INSERT INTO client_contacts (client_id, name, role_label, phone, email, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, String(b.name).trim(), b.role_label || null, b.phone || null, b.email || null, b.notes || null]
    );
    res.json({ success: true, id: String(result.insertId) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar contato' });
  }
});

app.put('/api/clients/:id/contacts/:contactId', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const b = req.body;
    if (!String(b.name || '').trim()) return res.status(400).json({ error: 'Nome do contato é obrigatório' });
    await pool.execute(
      `UPDATE client_contacts SET name=?, role_label=?, phone=?, email=?, notes=?
       WHERE id=? AND client_id=?`,
      [
        String(b.name).trim(), b.role_label || null, b.phone || null, b.email || null, b.notes || null,
        Number(req.params.contactId), Number(req.params.id),
      ]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar contato' });
  }
});

app.delete('/api/clients/:id/contacts/:contactId', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const [result] = await pool.execute(
      'DELETE FROM client_contacts WHERE id = ? AND client_id = ?',
      [Number(req.params.contactId), Number(req.params.id)]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Contato não encontrado' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir contato' });
  }
});

// Animals
app.get('/api/animals', auth(), async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    let sql = `
      SELECT a.*,
        (SELECT GROUP_CONCAT(c.name SEPARATOR ', ')
           FROM animal_owners ao
           INNER JOIN clients c ON c.id = ao.client_id
          WHERE ao.animal_id = a.id) AS owners
      FROM animals a
      WHERE 1=1`;
    const params = [];

    if (req.user.role === 'cliente') {
      if (!req.user.clientId) return res.json([]);
      sql += ` AND ${CLIENT_ANIMAL_ACCESS_SQL}`;
      params.push(...bindClientAnimalAccessParams(req.user.clientId));
    }

    if (q) {
      sql += ' AND (a.name LIKE ? OR a.registration_no LIKE ? OR a.chip_no LIKE ? OR a.breed LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like, like, like);
    }

    sql += ' ORDER BY a.name ASC';
    const [rows] = await pool.execute(sql, params);
    res.json(
      rows.map((r) => ({
        ...r,
        id: String(r.id),
        created_by: r.created_by ? String(r.created_by) : null,
      }))
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao listar animais' });
  }
});

app.get('/api/animals/:id', auth(), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.execute('SELECT * FROM animals WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Animal não encontrado' });

    if (req.user.role === 'cliente') {
      const allowed = await clientCanViewAnimal(id, req.user.clientId);
      if (!allowed) return res.status(403).json({ error: 'Sem permissão' });
    }

    const [owners] = await pool.execute(
      `SELECT ao.id, ao.client_id, ao.share_pct, ao.is_primary, c.name AS client_name
       FROM animal_owners ao
       INNER JOIN clients c ON c.id = ao.client_id
       WHERE ao.animal_id = ?
       ORDER BY ao.is_primary DESC, c.name ASC`,
      [id]
    );

    const [genealogy] = await pool.execute(
      'SELECT * FROM animal_genealogy WHERE animal_id = ?',
      [id]
    );

    const animal = rows[0];
    res.json({
      ...animal,
      id: String(animal.id),
      owners: owners.map((o) => ({
        id: String(o.id),
        clientId: String(o.client_id),
        clientName: o.client_name,
        sharePct: Number(o.share_pct),
        isPrimary: Boolean(o.is_primary),
      })),
      genealogy: genealogy[0]
        ? {
            sireId: genealogy[0].sire_id ? String(genealogy[0].sire_id) : null,
            damId: genealogy[0].dam_id ? String(genealogy[0].dam_id) : null,
            sireName: genealogy[0].sire_name,
            damName: genealogy[0].dam_name,
          }
        : null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar animal' });
  }
});

async function upsertAnimalOwners(conn, animalId, owners) {
  await conn.execute('DELETE FROM animal_owners WHERE animal_id = ?', [animalId]);
  if (!owners?.length) return;
  for (const owner of owners) {
    const clientId = Number(owner.clientId);
    if (!clientId) continue;
    await conn.execute(
      `INSERT INTO animal_owners (animal_id, client_id, share_pct, is_primary)
       VALUES (?, ?, ?, ?)`,
      [
        animalId,
        clientId,
        owner.sharePct ?? 100,
        owner.isPrimary ? 1 : 0,
      ]
    );
  }
}

async function upsertGenealogy(conn, animalId, genealogy) {
  if (!genealogy) return;
  await conn.execute(
    `INSERT INTO animal_genealogy (animal_id, sire_id, dam_id, sire_name, dam_name)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       sire_id=VALUES(sire_id), dam_id=VALUES(dam_id),
       sire_name=VALUES(sire_name), dam_name=VALUES(dam_name)`,
    [
      animalId,
      genealogy.sireId || null,
      genealogy.damId || null,
      genealogy.sireName || null,
      genealogy.damName || null,
    ]
  );
}

app.post('/api/animals', auth(['root', 'admin', 'user']), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const {
      name, registration_no, chip_no, sex, breed, association = 'NENHUMA',
      birth_date, color, resenha, status = 'ativo', ownership_type = 'unico',
      notes, photo_url, owners = [], genealogy,
    } = req.body;

    if (!name?.trim()) {
      conn.release();
      return res.status(400).json({ error: 'Nome é obrigatório' });
    }

    await conn.beginTransaction();
    const [result] = await conn.execute(
      `INSERT INTO animals
       (name, registration_no, chip_no, sex, breed, association, birth_date, color,
        resenha, status, ownership_type, notes, photo_url, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        registration_no || null,
        chip_no || null,
        sex || null,
        breed || null,
        association || 'NENHUMA',
        birth_date || null,
        color || null,
        resenha || null,
        status || 'ativo',
        ownership_type || 'unico',
        notes || null,
        photo_url || null,
        req.user.id,
      ]
    );

    const animalId = result.insertId;
    await upsertAnimalOwners(conn, animalId, owners);
    await upsertGenealogy(conn, animalId, genealogy);
    await conn.commit();
    res.json({ success: true, id: String(animalId) });
  } catch (error) {
    await conn.rollback();
    console.error(error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Chip já cadastrado' });
    }
    res.status(500).json({ error: 'Erro ao criar animal' });
  } finally {
    conn.release();
  }
});

app.put('/api/animals/:id', auth(['root', 'admin', 'user']), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const id = Number(req.params.id);
    const {
      name, registration_no, chip_no, sex, breed, association,
      birth_date, color, resenha, status, ownership_type,
      notes, photo_url, owners, genealogy,
    } = req.body;

    if (!name?.trim()) {
      conn.release();
      return res.status(400).json({ error: 'Nome é obrigatório' });
    }

    await conn.beginTransaction();
    await conn.execute(
      `UPDATE animals SET
        name=?, registration_no=?, chip_no=?, sex=?, breed=?, association=?,
        birth_date=?, color=?, resenha=?, status=?, ownership_type=?, notes=?, photo_url=?
       WHERE id=?`,
      [
        name.trim(),
        registration_no || null,
        chip_no || null,
        sex || null,
        breed || null,
        association || 'NENHUMA',
        birth_date || null,
        color || null,
        resenha || null,
        status || 'ativo',
        ownership_type || 'unico',
        notes || null,
        photo_url || null,
        id,
      ]
    );

    if (Array.isArray(owners)) {
      await upsertAnimalOwners(conn, id, owners);
    }
    if (genealogy) {
      await upsertGenealogy(conn, id, genealogy);
    }

    await conn.commit();
    res.json({ success: true });
  } catch (error) {
    await conn.rollback();
    console.error(error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Chip já cadastrado' });
    }
    res.status(500).json({ error: 'Erro ao atualizar animal' });
  } finally {
    conn.release();
  }
});

app.delete('/api/animals/:id', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [[row]] = await pool.execute('SELECT photo_url FROM animals WHERE id = ?', [id]);
    if (!row) {
      return res.status(404).json({ error: 'Animal não encontrado' });
    }

    await pool.execute('DELETE FROM animals WHERE id = ?', [id]);

    const photo = row.photo_url || '';
    if (/^\/uploads\/animals\/[A-Za-z0-9._-]+$/.test(photo)) {
      const file = path.join(__dirname, photo);
      if (fs.existsSync(file)) {
        try {
          fs.unlinkSync(file);
        } catch (_) {
          /* ignore */
        }
      }
    }

    res.json({ success: true, message: 'Animal excluído' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao excluir animal' });
  }
});

// Users
app.get('/api/users', auth(['root', 'admin']), async (req, res) => {
  try {
    let sql = `SELECT id, username, email, name, avatar_url, role, client_id, active, must_change_password, created_at
               FROM users WHERE 1=1`;
    const params = [];
    if (req.user.role === 'admin') {
      sql += " AND role IN ('admin','user','cliente')";
    }
    sql += ' ORDER BY name ASC';
    const [rows] = await pool.execute(sql, params);
    res.json(rows.map(mapUser));
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar usuários' });
  }
});

app.post('/api/users', auth(['root', 'admin']), async (req, res) => {
  try {
    const { username, email, password, name, role = 'user', clientId, active = true } = req.body;

    if (!username?.trim() || !password || !name?.trim()) {
      return res.status(400).json({ error: 'Usuário, nome e senha são obrigatórios' });
    }

    if (!['root', 'admin', 'user', 'cliente'].includes(role)) {
      return res.status(400).json({ error: 'Perfil inválido' });
    }

    if (req.user.role === 'admin' && (role === 'root' || role === 'admin')) {
      return res.status(403).json({ error: 'Admin não pode criar root/admin' });
    }

    if (role === 'cliente' && !clientId) {
      return res.status(400).json({ error: 'Cliente é obrigatório para perfil cliente' });
    }

    const hash = await bcrypt.hash(password, 12);
    const [result] = await pool.execute(
      `INSERT INTO users (username, email, password_hash, name, role, client_id, active, must_change_password)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        username.trim(),
        email || null,
        hash,
        name.trim(),
        role,
        role === 'cliente' ? Number(clientId) : null,
        active ? 1 : 0,
      ]
    );
    res.json({ success: true, id: String(result.insertId) });
  } catch (error) {
    console.error(error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Usuário ou e-mail já existe' });
    }
    res.status(500).json({ error: 'Erro ao criar usuário' });
  }
});

app.put('/api/users/:id', auth(['root', 'admin']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { username, email, password, name, role, clientId, active } = req.body;

    const [existing] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ error: 'Usuário não encontrado' });

    const target = existing[0];
    if (req.user.role === 'admin' && (target.role === 'root' || target.role === 'admin')) {
      return res.status(403).json({ error: 'Sem permissão para editar este usuário' });
    }

    const nextRole = role || target.role;
    if (req.user.role === 'admin' && (nextRole === 'root' || nextRole === 'admin')) {
      return res.status(403).json({ error: 'Admin não pode definir perfil root/admin' });
    }

    let hash = target.password_hash;
    if (password) {
      hash = await bcrypt.hash(password, 12);
    }

    await pool.execute(
      `UPDATE users SET username=?, email=?, password_hash=?, name=?, role=?, client_id=?, active=?
       WHERE id=?`,
      [
        username?.trim() || target.username,
        email !== undefined ? email || null : target.email,
        hash,
        name?.trim() || target.name,
        nextRole,
        nextRole === 'cliente' ? Number(clientId || target.client_id) : null,
        active === false ? 0 : 1,
        id,
      ]
    );
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Usuário ou e-mail já existe' });
    }
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
});

app.delete('/api/users/:id', auth(['root', 'admin']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await pool.execute('SELECT id, role, username, name FROM users WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ error: 'Usuário não encontrado' });

    const target = existing[0];
    if (target.id === req.user.id) {
      return res.status(403).json({ error: 'Você não pode excluir o próprio usuário' });
    }
    if (req.user.role === 'admin' && (target.role === 'root' || target.role === 'admin')) {
      return res.status(403).json({ error: 'Sem permissão para excluir este usuário' });
    }

    await pool.execute('DELETE FROM users WHERE id = ?', [id]);
    res.json({ success: true, message: 'Usuário excluído' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao excluir usuário' });
  }
});

const contractSelect = `SELECT c.*,
    a.name AS animal_name, a.chip_no AS animal_chip, a.color AS animal_color,
    a.birth_date AS animal_birth_date, a.sex AS animal_sex,
    a.notes AS animal_notes,
    s.name AS seller_name, s.document AS seller_document, s.document_type AS seller_document_type,
    s.birth_date AS seller_birth_date,
    s.email AS seller_email, s.phone AS seller_phone, s.whatsapp AS seller_whatsapp,
    s.address AS seller_address, s.address_number AS seller_address_number,
    s.city AS seller_city, s.state AS seller_state,
    b.name AS buyer_name, b.document AS buyer_document, b.document_type AS buyer_document_type,
    b.birth_date AS buyer_birth_date,
    b.email AS buyer_email, b.phone AS buyer_phone, b.whatsapp AS buyer_whatsapp,
    b.address AS buyer_address, b.address_number AS buyer_address_number,
    b.city AS buyer_city, b.state AS buyer_state,
    ass.name AS assessor_name,
    w1.name AS witness1_name, w1.email AS witness1_email,
    w1.phone AS witness1_phone, w1.whatsapp AS witness1_whatsapp,
    w1.document AS witness1_document, w1.document_type AS witness1_document_type,
    w1.birth_date AS witness1_birth_date,
    w2.name AS witness2_name, w2.email AS witness2_email,
    w2.phone AS witness2_phone, w2.whatsapp AS witness2_whatsapp,
    w2.document AS witness2_document, w2.document_type AS witness2_document_type,
    w2.birth_date AS witness2_birth_date,
    au.name AS auction_name, au.auction_date AS auction_date,
    t.name AS template_name,
    COALESCE(c.verso_title, t.title) AS template_title,
    COALESCE(c.verso_body, t.body_text) AS template_body
  FROM contracts c
  INNER JOIN animals a ON a.id = c.animal_id
  INNER JOIN clients s ON s.id = c.seller_id
  INNER JOIN clients b ON b.id = c.buyer_id
  LEFT JOIN clients ass ON ass.id = c.assessor_id
  LEFT JOIN clients w1 ON w1.id = c.witness1_id
  LEFT JOIN clients w2 ON w2.id = c.witness2_id
  LEFT JOIN auctions au ON au.id = c.auction_id
  LEFT JOIN contract_templates t ON t.id = c.template_id
  WHERE 1=1`;

app.get('/api/contracts', auth(), async (req, res) => {
  try {
    let sql = contractSelect;
    const params = [];
    if (req.user.role === 'cliente') {
      if (!req.user.clientId) return res.json([]);
      sql += ` AND ${CLIENT_CONTRACT_ACCESS_SQL}`;
      params.push(...bindClientContractAccessParams(req.user.clientId));
    }
    if (req.query.animalId) {
      sql += ' AND c.animal_id = ?';
      params.push(Number(req.query.animalId));
    }
    if (req.query.status) {
      sql += ' AND c.status = ?';
      params.push(req.query.status);
    }
    sql += ' ORDER BY c.created_at DESC';
    const [rows] = await pool.execute(sql, params);
    res.json(rows.map(mapContract));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao listar contratos' });
  }
});

async function clicksignPersistProgress(contractId, signedCount, totalCount, status = null) {
  try {
    if (status != null) {
      await pool.execute(
        'UPDATE contracts SET clicksign_signed_count=?, clicksign_total_count=?, clicksign_status=? WHERE id=?',
        [signedCount, totalCount, status, contractId]
      );
    } else {
      await pool.execute(
        'UPDATE contracts SET clicksign_signed_count=?, clicksign_total_count=? WHERE id=?',
        [signedCount, totalCount, contractId]
      );
    }
  } catch {
    /* colunas ainda não migradas */
  }
}

app.post('/api/contracts/clicksign-progress', auth(), async (req, res) => {
  try {
    const idsRaw = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const refresh = !!req.body?.refresh && ['root', 'admin', 'user'].includes(req.user.role);
    const ids = idsRaw.map((v) => Number(v)).filter((n) => n > 0).slice(0, 15);
    if (!ids.length) return res.json({ items: [] });

    const placeholders = ids.map(() => '?').join(',');
    let sql = `${contractSelect} AND c.id IN (${placeholders})`;
    const params = [...ids];
    if (req.user.role === 'cliente') {
      if (!req.user.clientId) return res.json({ items: [] });
      sql += ` AND ${CLIENT_CONTRACT_ACCESS_SQL}`;
      params.push(...bindClientContractAccessParams(req.user.clientId));
    }
    const [rows] = await pool.execute(sql, params);
    const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
    const publicOrigin = host ? `${proto}://${host}` : null;
    const items = [];

    for (const r of rows) {
      const contract = mapContract(r);
      if (!contract.clicksign_envelope_id) continue;
      let signed = Number(r.clicksign_signed_count || 0);
      let total = Number(r.clicksign_total_count || 0);
      const shouldRefresh = refresh && contract.status === 'aguardando_assinatura';

      let clicksignStatus = null;
      let newStatus = null;
      if (shouldRefresh) {
        try {
          const statusInfo = await clicksignFetchStatus(contract, publicOrigin);
          signed = Number(statusInfo.signedCount || 0);
          total = Number(statusInfo.totalCount || 0);
          await clicksignPersistProgress(Number(r.id), signed, total, statusInfo.status);
          await pool.execute('UPDATE contracts SET clicksign_status=? WHERE id=?', [statusInfo.status, r.id]);
          clicksignStatus = statusInfo.status || null;
          if (statusInfo.status === 'closed' && contract.status === 'aguardando_assinatura') {
            await pool.execute("UPDATE contracts SET status='ativo' WHERE id=?", [r.id]);
            newStatus = 'ativo';
          }
        } catch (e) {
          console.error('clicksign-progress refresh:', e.message);
        }
      } else if (total <= 0) {
        total = 4;
      }

      if (total > 0) {
        const item = {
          contractId: String(r.id),
          signedCount: signed,
          totalCount: total,
          pendingCount: Math.max(0, total - signed),
        };
        if (clicksignStatus !== null) item.clicksignStatus = clicksignStatus;
        if (newStatus !== null) item.status = newStatus;
        items.push(item);
      }
    }

    res.json({ items });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao carregar progresso de assinaturas' });
  }
});

app.get('/api/contracts/:id', auth(), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.execute(`${contractSelect} AND c.id = ?`, [id]);
    if (!rows.length) return res.status(404).json({ error: 'Contrato não encontrado' });
    const r = rows[0];
    if (req.user.role === 'cliente') {
      const cid = Number(req.user.clientId);
      if (
        Number(r.buyer_id) !== cid &&
        Number(r.seller_id) !== cid &&
        Number(r.assessor_id || 0) !== cid &&
        Number(r.witness1_id || 0) !== cid &&
        Number(r.witness2_id || 0) !== cid
      ) {
        return res.status(403).json({ error: 'Sem permissão' });
      }
    }
    const [signatures] = await pool.execute('SELECT * FROM contract_signatures WHERE contract_id = ?', [id]);
    const [charges] = await pool.execute(
      'SELECT * FROM charges WHERE contract_id = ? ORDER BY installment_no ASC',
      [id]
    );
    const [rules] = await pool.execute(
      `SELECT r.*, cl.name AS beneficiary_name FROM contract_payout_rules r
       LEFT JOIN clients cl ON cl.id = r.beneficiary_client_id
       WHERE r.contract_id = ? ORDER BY r.sort_order ASC, r.id ASC`,
      [id]
    );
    res.json({
      ...mapContract(r),
      signatures: signatures.map((s) => ({
        id: String(s.id),
        party_role: s.party_role,
        client_id: String(s.client_id),
        signer_name: s.signer_name,
        signed_at: s.signed_at,
        ip: s.ip,
      })),
      charges: charges.map((c) => mapChargeRow(c)),
      payoutRules: rules.map((x) => ({
        id: String(x.id),
        beneficiary_role: x.beneficiary_role,
        beneficiary_client_id: x.beneficiary_client_id ? String(x.beneficiary_client_id) : null,
        beneficiary_name: x.beneficiary_name || null,
        label: x.label,
        pct: Number(x.pct),
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar contrato' });
  }
});

app.post('/api/contracts', auth(['root', 'admin', 'user']), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const {
      animalId, sellerId, buyerId, assessorId, saleType: saleTypeRaw = 'inteiro', sharePct,
      totalAmount, paymentMethod = 'boleto', installments = 1, firstDueDate, notes,
      auctionId, lotId, payoutRules,
      templateId, lotLabel, animalCategory, quantity = 1,
      commissionTotalPct, commissionBuyerPct, commissionSellerPct,
      witness1Id, witness2Id, viaLabel,
    } = req.body;
    const n = Math.max(1, Math.min(50, Number(installments) || 1));
    const total = Number(totalAmount);
    if (!animalId || !sellerId || !buyerId || !(total > 0) || !firstDueDate) {
      return res.status(400).json({ error: 'Animal, vendedor, comprador, valor e 1º vencimento são obrigatórios' });
    }
    const saleType = String(saleTypeRaw || '').trim();
    if (!saleType) {
      return res.status(400).json({ error: 'Tipo de venda é obrigatório' });
    }
    let share = Number(sharePct);
    if (!(share > 0 && share <= 100)) {
      return res.status(400).json({ error: 'Informe o percentual de cotas (1–100)' });
    }

    let resolvedTemplateId = templateId ? Number(templateId) : null;
    if (!resolvedTemplateId) {
      const [[def]] = await conn.execute(
        'SELECT id FROM contract_templates WHERE is_default = 1 AND active = 1 LIMIT 1'
      );
      if (def) resolvedTemplateId = def.id;
    }

    await conn.beginTransaction();
    const [result] = await conn.execute(
      `INSERT INTO contracts
       (animal_id, sale_type, share_pct, seller_id, buyer_id, assessor_id, auction_id, lot_id,
        template_id, verso_title, verso_body, lot_label, animal_category, quantity,
        commission_total_pct, commission_buyer_pct, commission_seller_pct,
        witness1_id, witness2_id, via_label,
        total_amount, payment_method, installments, first_due_date, status, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aguardando_assinatura', ?, ?)`,
      [
        Number(animalId), saleType, share || null, Number(sellerId), Number(buyerId),
        assessorId ? Number(assessorId) : null,
        auctionId ? Number(auctionId) : null,
        lotId ? Number(lotId) : null,
        resolvedTemplateId,
        req.body.versoTitle || null,
        req.body.versoBody || null,
        lotLabel || null,
        animalCategory || null,
        quantity != null && quantity !== '' ? Number(quantity) : 1,
        commissionTotalPct != null && commissionTotalPct !== '' ? Number(commissionTotalPct) : null,
        commissionBuyerPct != null && commissionBuyerPct !== '' ? Number(commissionBuyerPct) : null,
        commissionSellerPct != null && commissionSellerPct !== '' ? Number(commissionSellerPct) : null,
        witness1Id ? Number(witness1Id) : null,
        witness2Id ? Number(witness2Id) : null,
        viaLabel || 'VIA DAS PARTES — VENDEDOR E COMPRADOR',
        total, paymentMethod, n, firstDueDate,
        notes || null, req.user.id,
      ]
    );
    const contractId = result.insertId;
    const year = new Date().getFullYear();
    const contractNumber = `${String(10000000 + contractId).slice(-8)}-${year}`;
    await conn.execute('UPDATE contracts SET contract_number = ? WHERE id = ?', [contractNumber, contractId]);
    await generateCharges(
      conn, contractId, Number(buyerId), total, n, firstDueDate, paymentMethod,
      normalizeSchedule(req.body.schedule, n, total)
    );
    await generatePayouts(conn, contractId, payoutRules || []);
    if (lotId) {
      await conn.execute(
        `UPDATE auction_lots SET status = 'arrematado', contract_id = ? WHERE id = ? AND status = 'disponivel'`,
        [contractId, Number(lotId)]
      );
    }
    await conn.commit();
    res.json({ success: true, id: String(contractId), contractNumber });
  } catch (error) {
    await conn.rollback();
    console.error(error);
    if (error.status === 400) return res.status(400).json({ error: error.message });
    res.status(500).json({ error: 'Erro ao criar contrato' });
  } finally {
    conn.release();
  }
});

app.put('/api/contracts/:id', auth(['root', 'admin', 'user']), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const id = Number(req.params.id);
    await conn.beginTransaction();
    const [[existing]] = await conn.execute('SELECT * FROM contracts WHERE id = ? FOR UPDATE', [id]);
    if (!existing) {
      await conn.rollback();
      return res.status(404).json({ error: 'Contrato não encontrado' });
    }
    if (existing.status === 'cancelado' || existing.status === 'concluido') {
      await conn.rollback();
      return res.status(400).json({ error: 'Contrato cancelado ou concluído não pode ser editado' });
    }

    const b = req.body;
    const fields = [];
    const params = [];
    const set = (col, val) => {
      fields.push(`${col}=?`);
      params.push(val);
    };

    if (b.status != null) {
      if (!['rascunho', 'aguardando_assinatura', 'ativo', 'concluido', 'cancelado'].includes(b.status)) {
        await conn.rollback();
        return res.status(400).json({ error: 'Status inválido' });
      }
      set('status', b.status);
    }
    if (b.notes !== undefined) set('notes', b.notes);
    if (b.saleType != null) {
      const saleType = String(b.saleType).trim();
      if (!saleType) {
        await conn.rollback();
        return res.status(400).json({ error: 'Tipo de venda é obrigatório' });
      }
      set('sale_type', saleType);
      if (b.sharePct != null) set('share_pct', Number(b.sharePct));
    } else if (b.sharePct != null) {
      set('share_pct', Number(b.sharePct));
    }
    if (b.sellerId != null) set('seller_id', Number(b.sellerId));
    if (b.buyerId != null) set('buyer_id', Number(b.buyerId));
    if (b.assessorId !== undefined) set('assessor_id', b.assessorId ? Number(b.assessorId) : null);
    if (b.templateId !== undefined) set('template_id', b.templateId ? Number(b.templateId) : null);
    if (b.versoTitle !== undefined) set('verso_title', b.versoTitle || null);
    if (b.versoBody !== undefined) set('verso_body', b.versoBody || null);
    if (b.lotLabel !== undefined) set('lot_label', b.lotLabel || null);
    if (b.animalCategory !== undefined) set('animal_category', b.animalCategory || null);
    if (b.quantity != null) set('quantity', Math.max(1, Number(b.quantity) || 1));
    if (b.commissionTotalPct !== undefined) {
      set('commission_total_pct', b.commissionTotalPct !== '' && b.commissionTotalPct != null ? Number(b.commissionTotalPct) : null);
    }
    if (b.commissionBuyerPct !== undefined) {
      set('commission_buyer_pct', b.commissionBuyerPct !== '' && b.commissionBuyerPct != null ? Number(b.commissionBuyerPct) : null);
    }
    if (b.commissionSellerPct !== undefined) {
      set('commission_seller_pct', b.commissionSellerPct !== '' && b.commissionSellerPct != null ? Number(b.commissionSellerPct) : null);
    }
    if (b.witness1Id !== undefined) set('witness1_id', b.witness1Id ? Number(b.witness1Id) : null);
    if (b.witness2Id !== undefined) set('witness2_id', b.witness2Id ? Number(b.witness2Id) : null);
    if (b.totalAmount != null) {
      const total = Number(b.totalAmount);
      if (!(total > 0)) {
        await conn.rollback();
        return res.status(400).json({ error: 'Valor inválido' });
      }
      set('total_amount', total);
    }
    if (b.paymentMethod != null) {
      if (!['pix', 'boleto', 'transferencia', 'outro'].includes(b.paymentMethod)) {
        await conn.rollback();
        return res.status(400).json({ error: 'Forma de pagamento inválida' });
      }
      set('payment_method', b.paymentMethod);
    }
    if (b.firstDueDate != null) set('first_due_date', b.firstDueDate);
    if (b.installments != null) {
      const n = Math.max(1, Math.min(50, Number(b.installments) || 1));
      set('installments', n);
    }

    if (!fields.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'Nada para atualizar' });
    }

    const nextTotal = b.totalAmount != null ? Number(b.totalAmount) : Number(existing.total_amount);
    const nextBuyer = b.buyerId != null ? Number(b.buyerId) : Number(existing.buyer_id);
    const nextMethod = b.paymentMethod != null ? b.paymentMethod : existing.payment_method;
    const nextFirstDue = b.firstDueDate != null ? b.firstDueDate : existing.first_due_date;
    const nextInstallments =
      b.installments != null
        ? Math.max(1, Math.min(50, Number(b.installments) || 1))
        : Number(existing.installments);

    const existingFirstDue = existing.first_due_date
      ? String(existing.first_due_date).slice(0, 10)
      : '';
    const nextFirstDueNorm = String(nextFirstDue).slice(0, 10);

    const [[chargeAgg]] = await conn.execute(
      `SELECT COALESCE(SUM(amount), 0) AS total_sum, COUNT(*) AS qty
       FROM charges WHERE contract_id = ?`,
      [id]
    );

    const schedule = normalizeSchedule(b.schedule, nextInstallments, nextTotal);

    const financeChanged =
      Math.abs(nextTotal - Number(existing.total_amount)) > 0.001 ||
      nextBuyer !== Number(existing.buyer_id) ||
      nextMethod !== existing.payment_method ||
      nextFirstDueNorm !== existingFirstDue ||
      nextInstallments !== Number(existing.installments);

    // Também recalcula se o formulário pediu ou se a soma das parcelas está desalinhada do valor
    const chargesOutOfSync =
      Math.abs(Number(chargeAgg.total_sum) - nextTotal) > 0.02 ||
      Number(chargeAgg.qty) !== nextInstallments;

    const isCancelling = b.status === 'cancelado';

    const shouldRecalc =
      !isCancelling &&
      (Boolean(schedule) || Boolean(b.recalcCharges) || financeChanged || chargesOutOfSync);

    if (shouldRecalc) {
      const [[paidOnly]] = await conn.execute(
        `SELECT COUNT(*) AS n FROM charges WHERE contract_id = ? AND status = 'pago'`,
        [id]
      );
      if (Number(paidOnly.n) > 0) {
        await conn.rollback();
        return res.status(400).json({
          error: 'Não é possível recalcular parcelas: já existem cobranças pagas neste contrato',
        });
      }
    }

    params.push(id);
    await conn.execute(`UPDATE contracts SET ${fields.join(',')} WHERE id=?`, params);

    if (isCancelling) {
      await conn.execute(
        `UPDATE charges SET status = 'cancelado'
         WHERE contract_id = ? AND status != 'pago'`,
        [id]
      );
      await conn.execute(
        `UPDATE payouts SET status = 'cancelado'
         WHERE contract_id = ? AND status != 'pago'`,
        [id]
      );
    }

    if (shouldRecalc) {
      const [ruleRows] = await conn.execute(
        `SELECT beneficiary_role, beneficiary_client_id, label, pct
         FROM contract_payout_rules WHERE contract_id = ? ORDER BY sort_order ASC, id ASC`,
        [id]
      );
      await generateCharges(
        conn, id, nextBuyer, nextTotal, nextInstallments, nextFirstDueNorm, nextMethod, schedule
      );
      await generatePayouts(
        conn,
        id,
        ruleRows.map((r) => ({
          beneficiaryRole: r.beneficiary_role,
          beneficiaryClientId: r.beneficiary_client_id,
          label: r.label,
          pct: Number(r.pct),
        }))
      );
    }

    await conn.commit();
    res.json({ success: true, chargesRecalculated: shouldRecalc });
  } catch (error) {
    await conn.rollback();
    console.error(error);
    if (error.status === 400) return res.status(400).json({ error: error.message });
    res.status(500).json({ error: 'Erro ao atualizar contrato' });
  } finally {
    conn.release();
  }
});

function loadClicksignConfig() {
  let token = process.env.CLICKSIGN_ACCESS_TOKEN || '';
  let base = process.env.CLICKSIGN_BASE_URL || 'https://app.clicksign.com';
  try {
    const php = fs.readFileSync(path.join(__dirname, 'config.local.php'), 'utf8');
    const t = php.match(/'clicksign_access_token'\s*=>\s*'([^']*)'/);
    const b = php.match(/'clicksign_base_url'\s*=>\s*'([^']*)'/);
    if (!token && t?.[1]) token = t[1];
    if (b?.[1]) base = b[1];
  } catch {
    /* config.local.php opcional no Node */
  }
  if (!token) {
    const err = new Error('Clicksign não configurada. Defina clicksign_access_token em config.local.php');
    err.status = 400;
    throw err;
  }
  return { token, base: base.replace(/\/$/, '') };
}

async function clicksignRequest(method, pathUrl, payload) {
  const { token, base } = loadClicksignConfig();
  const res = await fetch(`${base}${pathUrl}`, {
    method,
    headers: {
      Authorization: token,
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
    },
    body: payload != null ? JSON.stringify(payload) : undefined,
  });
  if (res.status === 204) return {};
  const text = await res.text();
  let json = {};
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = {};
    }
  }
  if (!res.ok) {
    const msg =
      json?.errors?.[0]?.detail ||
      json?.errors?.[0]?.title ||
      json?.error ||
      `Clicksign HTTP ${res.status}`;
    const err = new Error(typeof msg === 'string' ? msg : 'Erro na Clicksign');
    err.status = 400;
    throw err;
  }
  return json;
}

function clicksignNormalizeBirthday(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const birth = String(value).trim();
  const iso = birth.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = birth.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
}

function clicksignFormatCpf(digits) {
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

/** @returns {[object, string|null]} */
function clicksignSignerAttributes(s) {
  const attrs = {
    name: s.name,
    email: s.email,
  };
  const docType = String(s.document_type || '').toUpperCase();
  const docDigits = String(s.document || '').replace(/\D+/g, '');
  const hasCpf = (docType === 'CPF' || docType === '') && docDigits.length === 11;
  if (hasCpf) {
    attrs.has_documentation = true;
    attrs.documentation = clicksignFormatCpf(docDigits);
  }
  const birthday = clicksignNormalizeBirthday(s.birth_date);
  if (birthday) attrs.birthday = birthday;

  let warning = null;
  if (!hasCpf || !birthday) {
    const missing = [];
    if (!hasCpf) missing.push('CPF');
    if (!birthday) missing.push('data de nascimento');
    const label = s.label || 'signatário';
    warning = `${label.charAt(0).toUpperCase()}${label.slice(1)} sem ${missing.join(' e ')} no cadastro`;
  }
  return [attrs, warning];
}

function clicksignNamesMatch(a, b) {
  const na = String(a || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
  const nb = String(b || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
  return na !== '' && na === nb;
}

function clicksignContractParties(contract) {
  return [
    {
      name: String(contract.seller_name || '').trim(),
      email: String(contract.seller_email || '').trim(),
      document: contract.seller_document,
      document_type: contract.seller_document_type,
      birth_date: contract.seller_birth_date,
      role: 'seller',
      label: 'Vendedor',
      partyRole: 'seller',
    },
    {
      name: String(contract.buyer_name || '').trim(),
      email: String(contract.buyer_email || '').trim(),
      document: contract.buyer_document,
      document_type: contract.buyer_document_type,
      birth_date: contract.buyer_birth_date,
      role: 'buyer',
      label: 'Comprador',
      partyRole: 'buyer',
    },
    {
      name: String(contract.witness1_name || '').trim(),
      email: String(contract.witness1_email || '').trim(),
      document: contract.witness1_document,
      document_type: contract.witness1_document_type,
      birth_date: contract.witness1_birth_date,
      role: 'witness',
      label: 'Testemunha 1',
      partyRole: 'witness1',
    },
    {
      name: String(contract.witness2_name || '').trim(),
      email: String(contract.witness2_email || '').trim(),
      document: contract.witness2_document,
      document_type: contract.witness2_document_type,
      birth_date: contract.witness2_birth_date,
      role: 'witness',
      label: 'Testemunha 2',
      partyRole: 'witness2',
    },
  ];
}

async function clicksignCollectSignedEmails(envelopeId, documentId) {
  const signedEmails = {};
  const collect = (events) => {
    for (const ev of events || []) {
      const email = String(
        ev?.attributes?.data?.user?.email || ev?.attributes?.data?.signer?.email || ''
      )
        .trim()
        .toLowerCase();
      if (email) signedEmails[email] = true;
    }
  };
  if (documentId) {
    try {
      const eventsRes = await clicksignRequest(
        'GET',
        `/api/v3/envelopes/${envelopeId}/documents/${documentId}/events?filter%5Bname%5D=sign`
      );
      collect(eventsRes?.data);
    } catch {
      /* fallback */
    }
  }
  if (!Object.keys(signedEmails).length) {
    try {
      const eventsRes = await clicksignRequest(
        'GET',
        `/api/v3/envelopes/${envelopeId}/events?filter%5Bname%5D=sign`
      );
      collect(eventsRes?.data);
    } catch {
      /* segue */
    }
  }
  return signedEmails;
}

function clicksignFindCsSignerForParty(party, csSigners, usedIds) {
  const targetEmail = String(party.email || '')
    .trim()
    .toLowerCase();
  for (const cs of csSigners) {
    const id = String(cs?.id || '');
    if (!id || usedIds[id]) continue;
    const email = String(cs?.attributes?.email || '')
      .trim()
      .toLowerCase();
    if (targetEmail && email === targetEmail) return cs;
  }
  for (const cs of csSigners) {
    const id = String(cs?.id || '');
    if (!id || usedIds[id]) continue;
    if (clicksignNamesMatch(party.name, cs?.attributes?.name)) return cs;
  }
  return null;
}

async function clicksignAddBulkRequirements(envelopeId, documentId, signerId, role) {
  await clicksignRequest('POST', `/api/v3/envelopes/${envelopeId}/bulk_requirements`, {
    'atomic:operations': [
      {
        op: 'add',
        data: {
          type: 'requirements',
          attributes: { action: 'agree', role },
          relationships: {
            document: { data: { type: 'documents', id: documentId } },
            signer: { data: { type: 'signers', id: signerId } },
          },
        },
      },
      {
        op: 'add',
        data: {
          type: 'requirements',
          attributes: { action: 'provide_evidence', auth: 'email' },
          relationships: {
            document: { data: { type: 'documents', id: documentId } },
            signer: { data: { type: 'signers', id: signerId } },
          },
        },
      },
    ],
  });
}

async function clicksignCreateSignerOnRunningEnvelope(envelopeId, documentId, signer) {
  const [signerAttrs] = clicksignSignerAttributes(signer);
  const signerRes = await clicksignRequest('POST', `/api/v3/envelopes/${envelopeId}/signers`, {
    data: { type: 'signers', attributes: signerAttrs },
  });
  const signerId = signerRes?.data?.id;
  if (!signerId) throw new Error(`Falha ao cadastrar signatário: ${signer.label}`);
  await clicksignAddBulkRequirements(envelopeId, documentId, String(signerId), signer.role);
  return String(signerId);
}

async function clicksignNotifySigner(envelopeId, signerId) {
  await clicksignRequest(
    'POST',
    `/api/v3/envelopes/${envelopeId}/signers/${encodeURIComponent(signerId)}/notifications`,
    { data: { type: 'notifications', attributes: {} } }
  );
}

async function clicksignRequirementsBySigner(envelopeId) {
  const map = {};
  try {
    const reqsRes = await clicksignRequest('GET', `/api/v3/envelopes/${envelopeId}/requirements?include=signer`);
    for (const req of reqsRes?.data || []) {
      const signerId = String(req?.relationships?.signer?.data?.id || '');
      if (!signerId) continue;
      if (!map[signerId]) map[signerId] = { agree: false, evidence: false };
      const action = String(req?.attributes?.action || '');
      if (action === 'agree') map[signerId].agree = true;
      if (action === 'provide_evidence') map[signerId].evidence = true;
    }
  } catch {
    /* segue */
  }
  return map;
}

function clicksignSignerIsReady(reqStatus) {
  return reqStatus && reqStatus.agree && reqStatus.evidence;
}

async function clicksignAddSignerWithRequirements(envelopeId, documentId, signer) {
  const [signerAttrs] = clicksignSignerAttributes(signer);
  const signerRes = await clicksignRequest('POST', `/api/v3/envelopes/${envelopeId}/signers`, {
    data: { type: 'signers', attributes: signerAttrs },
  });
  const signerId = signerRes?.data?.id;
  if (!signerId) throw new Error(`Falha ao cadastrar signatário: ${signer.label}`);
  await clicksignRequest('POST', `/api/v3/envelopes/${envelopeId}/requirements`, {
    data: {
      type: 'requirements',
      attributes: { action: 'agree', role: signer.role },
      relationships: {
        document: { data: { type: 'documents', id: documentId } },
        signer: { data: { type: 'signers', id: signerId } },
      },
    },
  });
  await clicksignRequest('POST', `/api/v3/envelopes/${envelopeId}/requirements`, {
    data: {
      type: 'requirements',
      attributes: { action: 'provide_evidence', auth: 'email' },
      relationships: {
        document: { data: { type: 'documents', id: documentId } },
        signer: { data: { type: 'signers', id: signerId } },
      },
    },
  });
  return String(signerId);
}

async function clicksignSyncSignerEmails(contract, onlyPartyRole = null) {
  const envelopeId = String(contract.clicksign_envelope_id || '').trim();
  const documentId = String(contract.clicksign_document_id || '').trim();
  if (!envelopeId || !documentId) {
    const err = new Error('Contrato ainda não foi enviado à Clicksign');
    err.status = 400;
    throw err;
  }
  const env = await clicksignRequest('GET', `/api/v3/envelopes/${envelopeId}`);
  const status = env?.data?.attributes?.status || contract.clicksign_status || '';
  if (status === 'closed') {
    const err = new Error('Contrato já finalizado — não é possível alterar signatários');
    err.status = 400;
    throw err;
  }
  if (status !== 'running') {
    const err = new Error('Só é possível atualizar signatários enquanto o envelope está em processo');
    err.status = 400;
    throw err;
  }
  const signersRes = await clicksignRequest('GET', `/api/v3/envelopes/${envelopeId}/signers`);
  const csSigners = Array.isArray(signersRes?.data) ? signersRes.data : [];
  const signedEmails = await clicksignCollectSignedEmails(envelopeId, documentId);
  const reqBySigner = await clicksignRequirementsBySigner(envelopeId);

  const updated = [];
  const unchanged = [];
  const skipped = [];
  const warnings = [];
  const aliases = {};
  const usedIds = {};

  for (const party of clicksignContractParties(contract)) {
    const partyRole = party.partyRole || '';
    if (onlyPartyRole && partyRole !== onlyPartyRole) continue;

    const label = party.label;
    const newEmail = String(party.email || '')
      .trim()
      .toLowerCase();
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(party.email)) {
      skipped.push({ label, partyRole, reason: 'E-mail inválido no cadastro' });
      continue;
    }
    const cs = clicksignFindCsSignerForParty(party, csSigners, usedIds);
    if (!cs) {
      skipped.push({ label, partyRole, reason: 'Signatário não encontrado na Clicksign' });
      continue;
    }
    const csId = String(cs.id);
    const oldEmail = String(cs.attributes?.email || '')
      .trim()
      .toLowerCase();
    usedIds[csId] = true;

    if (signedEmails[oldEmail] || signedEmails[newEmail]) {
      skipped.push({ label, partyRole, reason: 'Já assinou — dados não podem ser alterados' });
      continue;
    }

    const ready = clicksignSignerIsReady(reqBySigner[csId]);
    const emailChanged = oldEmail !== newEmail;

    if (!emailChanged && ready) {
      unchanged.push({ label, partyRole, email: party.email });
      continue;
    }

    let signerId = csId;
    const fromEmail = cs.attributes?.email || oldEmail;

    if (emailChanged) {
      await clicksignRequest('DELETE', `/api/v3/envelopes/${envelopeId}/signers/${csId}`);
      signerId = await clicksignCreateSignerOnRunningEnvelope(envelopeId, documentId, party);
      aliases[csId] = signerId;
      usedIds[signerId] = true;
    } else if (!ready) {
      await clicksignAddBulkRequirements(envelopeId, documentId, csId, party.role);
    }

    try {
      await clicksignNotifySigner(envelopeId, signerId);
    } catch {
      warnings.push(`${label}: dados atualizados, mas falha ao enviar notificação`);
    }

    updated.push({
      label,
      partyRole,
      from: fromEmail,
      to: party.email,
      oldSignerId: csId,
      newSignerId: signerId,
      repaired: !emailChanged && !ready,
    });
  }

  return { updated, unchanged, skipped, warnings, aliases };
}

async function clicksignSendContract(contract, pdfBase64Raw) {
  let pdfBase64 = String(pdfBase64Raw || '');
  if (pdfBase64.includes('base64,')) pdfBase64 = pdfBase64.split('base64,').pop() || '';
  pdfBase64 = pdfBase64.replace(/\s+/g, '');
  if (!pdfBase64) {
    const err = new Error('PDF do contrato é obrigatório');
    err.status = 400;
    throw err;
  }

  const number = contract.contract_number || contract.id;
  const animal = String(contract.animal_name || '').trim() || 'Animal';
  const lot = String(contract.lot_label || '').trim();
  const sellerName = String(contract.seller_name || '').trim();
  const buyerName = String(contract.buyer_name || '').trim();
  const title = String(contract.template_title || '').trim() || 'CONTRATO PARTICULAR DE COMPRA E VENDA DE SEMOVENTE COM RESERVA DE DOMÍNIO';

  const envelopeParts = [title, String(number)];
  if (lot && lot !== '—') envelopeParts.push(`Lote ${lot}`);
  envelopeParts.push(animal);
  if (sellerName) envelopeParts.push(`Vend. ${sellerName}`);
  if (buyerName) envelopeParts.push(`Comp. ${buyerName}`);
  let envelopeName = envelopeParts.join(' — ');
  if (envelopeName.length > 180) envelopeName = `${envelopeName.slice(0, 177)}...`;

  const slug = (s) => {
    const t = String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return t || 'doc';
  };
  let pdfName = `Contrato-${slug(number)}`;
  if (lot && lot !== '—') pdfName += `-Lote-${slug(lot)}`;
  pdfName += `-${slug(animal)}`;
  if (sellerName) pdfName += `-${slug(sellerName)}`;
  if (buyerName) pdfName += `-${slug(buyerName)}`;
  if (pdfName.length > 120) pdfName = pdfName.slice(0, 120);
  const pdfFilename = `${pdfName.replace(/-+$/, '')}.pdf`;

  const signers = [
    {
      name: (contract.seller_name || '').trim(),
      email: (contract.seller_email || '').trim(),
      document: contract.seller_document,
      document_type: contract.seller_document_type,
      birth_date: contract.seller_birth_date,
      role: 'seller',
      label: 'vendedor',
    },
    {
      name: (contract.buyer_name || '').trim(),
      email: (contract.buyer_email || '').trim(),
      document: contract.buyer_document,
      document_type: contract.buyer_document_type,
      birth_date: contract.buyer_birth_date,
      role: 'buyer',
      label: 'comprador',
    },
    {
      name: (contract.witness1_name || '').trim(),
      email: (contract.witness1_email || '').trim(),
      document: contract.witness1_document,
      document_type: contract.witness1_document_type,
      birth_date: contract.witness1_birth_date,
      role: 'witness',
      label: 'testemunha 1',
    },
    {
      name: (contract.witness2_name || '').trim(),
      email: (contract.witness2_email || '').trim(),
      document: contract.witness2_document,
      document_type: contract.witness2_document_type,
      birth_date: contract.witness2_birth_date,
      role: 'witness',
      label: 'testemunha 2',
    },
  ];
  for (const s of signers) {
    if (!s.name || !s.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email)) {
      const err = new Error(`Para enviar à Clicksign, cadastre nome e e-mail válidos do ${s.label}`);
      err.status = 400;
      throw err;
    }
  }

  const env = await clicksignRequest('POST', '/api/v3/envelopes', {
    data: {
      type: 'envelopes',
      attributes: {
        name: envelopeName,
        locale: 'pt-BR',
        auto_close: true,
        remind_interval: 3,
      },
    },
  });
  const envelopeId = env?.data?.id;
  if (!envelopeId) throw new Error('Clicksign não retornou o envelope');

  const doc = await clicksignRequest('POST', `/api/v3/envelopes/${envelopeId}/documents`, {
    data: {
      type: 'documents',
      attributes: {
        filename: pdfFilename,
        content_base64: `data:application/pdf;base64,${pdfBase64}`,
      },
    },
  });
  const documentId = doc?.data?.id;
  if (!documentId) throw new Error('Clicksign não retornou o documento');

  const warnings = [];
  for (const s of signers) {
    const [signerAttrs, signerWarning] = clicksignSignerAttributes(s);
    if (signerWarning) warnings.push(signerWarning);

    const signerRes = await clicksignRequest('POST', `/api/v3/envelopes/${envelopeId}/signers`, {
      data: {
        type: 'signers',
        attributes: signerAttrs,
      },
    });
    const signerId = signerRes?.data?.id;
    if (!signerId) throw new Error(`Falha ao cadastrar signatário: ${s.label}`);

    await clicksignRequest('POST', `/api/v3/envelopes/${envelopeId}/requirements`, {
      data: {
        type: 'requirements',
        attributes: { action: 'agree', role: s.role },
        relationships: {
          document: { data: { type: 'documents', id: documentId } },
          signer: { data: { type: 'signers', id: signerId } },
        },
      },
    });
    await clicksignRequest('POST', `/api/v3/envelopes/${envelopeId}/requirements`, {
      data: {
        type: 'requirements',
        // Widget iframe (embedded.min) exige auth email/sms/whatsapp.
        // embedded_signature só funciona com o fluxo noWidget (sem iframe).
        attributes: { action: 'provide_evidence', auth: 'email' },
        relationships: {
          document: { data: { type: 'documents', id: documentId } },
          signer: { data: { type: 'signers', id: signerId } },
        },
      },
    });
  }

  await clicksignRequest('PATCH', `/api/v3/envelopes/${envelopeId}`, {
    data: {
      id: envelopeId,
      type: 'envelopes',
      attributes: { status: 'running' },
    },
  });
  await clicksignRequest('POST', `/api/v3/envelopes/${envelopeId}/notifications`, {
    data: { type: 'notifications', attributes: {} },
  });

  return { envelopeId, documentId, status: 'running', warnings };
}

function clicksignStatusLabel(status) {
  const map = {
    draft: 'Rascunho',
    running: 'Em processo',
    closed: 'Finalizado',
    canceled: 'Cancelado',
    cancelled: 'Cancelado',
  };
  return map[status] || status || 'Enviado';
}

function clicksignSignUrl(signerId, csSigner = null, publicOrigin = null) {
  if (csSigner) {
    const attrs = csSigner.attributes || {};
    for (const key of ['url', 'sign_url', 'signing_url']) {
      if (attrs[key] && typeof attrs[key] === 'string') return attrs[key];
    }
    const links = csSigner.links || {};
    for (const key of ['sign', 'signing_url', 'url']) {
      if (
        links[key] &&
        typeof links[key] === 'string' &&
        !String(links[key]).includes('/api/v3/')
      ) {
        return links[key];
      }
    }
  }
  const id = String(signerId || '').trim();
  if (!id) return null;
  const origin = String(publicOrigin || '').replace(/\/$/, '');
  if (origin) return `${origin}/assinar/${encodeURIComponent(id)}`;
  return `/assinar/${encodeURIComponent(id)}`;
}

async function clicksignNotify(contract, signerId = null) {
  const envelopeId = String(contract.clicksign_envelope_id || '').trim();
  if (!envelopeId) {
    const err = new Error('Contrato ainda não foi enviado à Clicksign');
    err.status = 400;
    throw err;
  }
  if (contract.status === 'cancelado') {
    const err = new Error('Contrato cancelado');
    err.status = 400;
    throw err;
  }
  const env = await clicksignRequest('GET', `/api/v3/envelopes/${envelopeId}`);
  const status = env?.data?.attributes?.status || contract.clicksign_status || '';
  if (status !== 'running') {
    const err = new Error('Só é possível reenviar notificações enquanto o envelope está em processo');
    err.status = 400;
    throw err;
  }
  const payload = { data: { type: 'notifications', attributes: {} } };
  const sid = String(signerId || '').trim();
  if (sid) {
    await clicksignRequest(
      'POST',
      `/api/v3/envelopes/${envelopeId}/signers/${encodeURIComponent(sid)}/notifications`,
      payload
    );
    return;
  }
  await clicksignRequest('POST', `/api/v3/envelopes/${envelopeId}/notifications`, payload);
}

async function clicksignFetchStatus(contract, publicOrigin = null) {
  const envelopeId = String(contract.clicksign_envelope_id || '').trim();
  const documentId = String(contract.clicksign_document_id || '').trim();
  if (!envelopeId) {
    const err = new Error('Contrato ainda não foi enviado à Clicksign');
    err.status = 400;
    throw err;
  }

  const env = await clicksignRequest('GET', `/api/v3/envelopes/${envelopeId}`);
  const status = env?.data?.attributes?.status || contract.clicksign_status || 'running';

  const signersRes = await clicksignRequest('GET', `/api/v3/envelopes/${envelopeId}/signers`);
  const csSigners = Array.isArray(signersRes?.data) ? signersRes.data : [];

  const signedEmails = {};
  const signedAtByEmail = {};
  const collectSignEvents = (events) => {
    for (const ev of events || []) {
      const email = String(
        ev?.attributes?.data?.user?.email ||
          ev?.attributes?.data?.signer?.email ||
          ''
      )
        .trim()
        .toLowerCase();
      if (!email) continue;
      signedEmails[email] = true;
      if (!signedAtByEmail[email]) signedAtByEmail[email] = ev?.attributes?.created || null;
    }
  };

  if (documentId) {
    try {
      const eventsRes = await clicksignRequest(
        'GET',
        `/api/v3/envelopes/${envelopeId}/documents/${documentId}/events?filter%5Bname%5D=sign`
      );
      collectSignEvents(eventsRes?.data);
    } catch {
      /* fallback */
    }
  }
  if (!Object.keys(signedEmails).length) {
    try {
      const eventsRes = await clicksignRequest(
        'GET',
        `/api/v3/envelopes/${envelopeId}/events?filter%5Bname%5D=sign`
      );
      collectSignEvents(eventsRes?.data);
    } catch {
      /* segue sem eventos */
    }
  }

  const parties = [
    {
      role: 'seller',
      label: 'Vendedor',
      name: contract.seller_name,
      email: contract.seller_email,
      phone: contract.seller_phone,
      whatsapp: contract.seller_whatsapp,
    },
    {
      role: 'buyer',
      label: 'Comprador',
      name: contract.buyer_name,
      email: contract.buyer_email,
      phone: contract.buyer_phone,
      whatsapp: contract.buyer_whatsapp,
    },
    {
      role: 'witness1',
      label: 'Testemunha 1',
      name: contract.witness1_name,
      email: contract.witness1_email,
      phone: contract.witness1_phone,
      whatsapp: contract.witness1_whatsapp,
    },
    {
      role: 'witness2',
      label: 'Testemunha 2',
      name: contract.witness2_name,
      email: contract.witness2_email,
      phone: contract.witness2_phone,
      whatsapp: contract.witness2_whatsapp,
    },
  ];

  const byEmail = {};
  for (const s of csSigners) {
    const email = String(s?.attributes?.email || '')
      .trim()
      .toLowerCase();
    if (email) byEmail[email] = s;
  }

  const signers = [];
  const used = {};
  for (const p of parties) {
    const email = String(p.email || '')
      .trim()
      .toLowerCase();
    const cs = email ? byEmail[email] : null;
    if (cs) used[email] = true;
    const name = String(p.name || '').trim() || String(cs?.attributes?.name || '').trim() || '—';
    let signed = Boolean(email && signedEmails[email]);
    if (!signed && status === 'closed' && email) signed = true;
    const signerId = cs?.id ? String(cs.id) : null;
    signers.push({
      role: p.role,
      label: p.label,
      name,
      email: p.email || cs?.attributes?.email || null,
      phone: p.phone || null,
      whatsapp: p.whatsapp || null,
      signerId,
      signUrl: signed ? null : clicksignSignUrl(signerId, cs, publicOrigin),
      signed,
      status: signed ? 'assinado' : 'pendente',
      statusLabel: signed ? 'Assinado' : 'Pendente',
      signedAt: signedAtByEmail[email] || null,
    });
  }

  for (const s of csSigners) {
    const email = String(s?.attributes?.email || '')
      .trim()
      .toLowerCase();
    if (!email || used[email]) continue;
    const signed = Boolean(signedEmails[email]) || status === 'closed';
    const signerId = s?.id ? String(s.id) : null;
    signers.push({
      role: 'other',
      label: 'Signatário',
      name: String(s?.attributes?.name || '').trim() || '—',
      email: s?.attributes?.email || null,
      phone: s?.attributes?.phone_number || null,
      whatsapp: null,
      signerId,
      signUrl: signed ? null : clicksignSignUrl(signerId, s, publicOrigin),
      signed,
      status: signed ? 'assinado' : 'pendente',
      statusLabel: signed ? 'Assinado' : 'Pendente',
      signedAt: signedAtByEmail[email] || null,
    });
  }

  return {
    envelopeId,
    documentId: documentId || null,
    status,
    statusLabel: clicksignStatusLabel(status),
    signedCount: signers.filter((s) => s.signed).length,
    totalCount: signers.length,
    signers,
    signedFileUrl: null,
    emailDrift: signers.some(
      (s) => !s.signed && (s.role === 'other' || !s.signerId)
    ),
  };
}

async function clicksignGetSignedFileUrl(contract) {
  const envelopeId = String(contract.clicksign_envelope_id || '').trim();
  const documentId = String(contract.clicksign_document_id || '').trim();
  if (!envelopeId || !documentId) return null;
  const doc = await clicksignRequest(
    'GET',
    `/api/v3/envelopes/${envelopeId}/documents/${documentId}`
  );
  const files = doc?.data?.links?.files || doc?.links?.files || {};
  return (
    files.signed ||
    files.signed_file_url ||
    files['signed-file'] ||
    null
  );
}

app.get('/api/contracts/:id/clicksign', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.execute(`${contractSelect} AND c.id = ?`, [id]);
    if (!rows.length) return res.status(404).json({ error: 'Contrato não encontrado' });
    const contract = mapContract(rows[0]);
    if (!contract.clicksign_envelope_id) {
      return res.status(400).json({ error: 'Contrato ainda não foi enviado à Clicksign' });
    }
    const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
    const publicOrigin = host ? `${proto}://${host}` : null;
    const statusInfo = await clicksignFetchStatus(contract, publicOrigin);
    if (statusInfo.status === 'closed') {
      try {
        statusInfo.signedFileUrl = await clicksignGetSignedFileUrl(contract);
      } catch (e) {
        console.error('Clicksign signed file:', e.message);
      }
    }
    await pool.execute('UPDATE contracts SET clicksign_status=? WHERE id=?', [statusInfo.status, id]);
    await clicksignPersistProgress(id, statusInfo.signedCount || 0, statusInfo.totalCount || 0, statusInfo.status);
    if (statusInfo.status === 'closed' && contract.status === 'aguardando_assinatura') {
      await pool.execute("UPDATE contracts SET status='ativo' WHERE id=?", [id]);
    }
    res.json({ success: true, ...statusInfo });
  } catch (error) {
    console.error(error);
    const status = error.status || 500;
    res.status(status).json({ error: error.message || 'Falha ao consultar Clicksign' });
  }
});

app.get('/api/contracts/:id/clicksign/signed-pdf', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.execute(`${contractSelect} AND c.id = ?`, [id]);
    if (!rows.length) return res.status(404).json({ error: 'Contrato não encontrado' });
    const contract = mapContract(rows[0]);
    if (!contract.clicksign_envelope_id || !contract.clicksign_document_id) {
      return res.status(400).json({ error: 'Contrato sem documento na Clicksign' });
    }
    const url = await clicksignGetSignedFileUrl(contract);
    if (!url) {
      return res.status(404).json({
        error: 'Cópia assinada ainda não disponível. Aguarde a finalização de todas as assinaturas.',
      });
    }
    res.json({ success: true, url });
  } catch (error) {
    console.error(error);
    const status = error.status || 500;
    res.status(status).json({ error: error.message || 'Falha ao obter PDF assinado' });
  }
});

app.post('/api/contracts/:id/clicksign/sync-emails', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.execute(`${contractSelect} AND c.id = ?`, [id]);
    if (!rows.length) return res.status(404).json({ error: 'Contrato não encontrado' });
    const contract = mapContract(rows[0]);
    const partyRole = String(req.body?.partyRole || '').trim();
    const result = await clicksignSyncSignerEmails(contract, partyRole || null);
    if (result.aliases && Object.keys(result.aliases).length) {
      await clicksignPersistSignerAliases(id, result.aliases);
    }
    const summary = `${result.updated.length} signatário(s) atualizado(s)`;
    await auditLog(
      req,
      req.user,
      'update',
      'contracts',
      String(id),
      `E-mails Clicksign sincronizados — ${contract.contract_number || id} — ${summary}`,
      true,
      { updated: result.updated }
    );
    const publicOrigin = `${req.protocol}://${req.get('host')}`;
    const tracking = await clicksignFetchStatus(contract, publicOrigin);
    await clicksignPersistProgress(
      id,
      Number(tracking.signedCount || 0),
      Number(tracking.totalCount || 0),
      tracking.status || null
    );
    res.json({
      success: true,
      message: result.updated.length ? summary : 'Dados já estão alinhados com o cadastro',
      ...result,
      tracking,
    });
  } catch (error) {
    console.error(error);
    const status = error.status || 500;
    res.status(status).json({ error: error.message || 'Falha ao atualizar e-mails' });
  }
});

app.post('/api/contracts/:id/clicksign/cancel', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.execute(`${contractSelect} AND c.id = ?`, [id]);
    if (!rows.length) return res.status(404).json({ error: 'Contrato não encontrado' });
    const contract = mapContract(rows[0]);
    const envelopeId = String(contract.clicksign_envelope_id || '').trim();
    if (!envelopeId) {
      return res.status(400).json({ error: 'Contrato ainda não foi enviado à Clicksign' });
    }
    try {
      await clicksignRequest('PATCH', `/api/v3/envelopes/${envelopeId}`, {
        data: { id: envelopeId, type: 'envelopes', attributes: { status: 'canceled' } },
      });
    } catch (e) {
      // Envelope pode já estar fechado/cancelado na Clicksign; seguimos limpando localmente.
    }
    const newStatus = contract.status === 'aguardando_assinatura' ? 'ativo' : contract.status;
    await pool.execute(
      `UPDATE contracts
       SET clicksign_envelope_id=NULL, clicksign_document_id=NULL, clicksign_status=NULL, clicksign_sent_at=NULL, clicksign_signed_count=NULL, clicksign_total_count=NULL, status=?
       WHERE id=?`,
      [newStatus, id]
    );
    res.json({ success: true, message: 'Envio cancelado. Você já pode enviar novamente.' });
  } catch (error) {
    console.error(error);
    const status = error.status || 500;
    res.status(status).json({ error: error.message || 'Falha ao cancelar envio' });
  }
});

app.post('/api/contracts/:id/clicksign/notify', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.execute(`${contractSelect} AND c.id = ?`, [id]);
    if (!rows.length) return res.status(404).json({ error: 'Contrato não encontrado' });
    const contract = mapContract(rows[0]);
    const signerId = req.body?.signerId ? String(req.body.signerId).trim() : '';
    await clicksignNotify(contract, signerId || null);
    res.json({
      success: true,
      message: signerId
        ? 'Notificação reenviada ao signatário'
        : 'Notificações reenviadas aos signatários pendentes',
    });
  } catch (error) {
    console.error(error);
    const status = error.status || 500;
    res.status(status).json({ error: error.message || 'Falha ao reenviar notificação' });
  }
});

app.post('/api/contracts/:id/clicksign', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.execute(`${contractSelect} AND c.id = ?`, [id]);
    if (!rows.length) return res.status(404).json({ error: 'Contrato não encontrado' });
    const contract = mapContract(rows[0]);
    if (['cancelado', 'concluido'].includes(contract.status)) {
      return res.status(400).json({ error: 'Contrato cancelado ou concluído não pode ser enviado' });
    }
    if (contract.clicksign_envelope_id && contract.clicksign_status === 'running') {
      return res.status(400).json({
        error: 'Este contrato já foi enviado à Clicksign',
        envelopeId: contract.clicksign_envelope_id,
      });
    }

    const sent = await clicksignSendContract(contract, req.body.pdfBase64 || '');
    await pool.execute(
      `UPDATE contracts
       SET clicksign_envelope_id=?, clicksign_document_id=?, clicksign_status=?, clicksign_sent_at=NOW(), clicksign_signed_count=0, clicksign_total_count=4, status='aguardando_assinatura'
       WHERE id=?`,
      [sent.envelopeId, sent.documentId, sent.status, id]
    );
    res.json({ success: true, ...sent });
  } catch (error) {
    console.error(error);
    const status = error.status || 500;
    res.status(status).json({ error: error.message || 'Falha ao enviar para Clicksign' });
  }
});

app.post('/api/contracts/:id/sign', auth(), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { partyRole, signerName, accepted } = req.body;
    if (
      !['seller', 'buyer', 'assessor', 'witness1', 'witness2'].includes(partyRole) ||
      !String(signerName || '').trim() ||
      !accepted
    ) {
      return res.status(400).json({ error: 'Informe o papel, o nome e confirme o aceite' });
    }
    const [[contract]] = await pool.execute('SELECT * FROM contracts WHERE id = ?', [id]);
    if (!contract) return res.status(404).json({ error: 'Contrato não encontrado' });
    if (contract.status === 'cancelado') return res.status(400).json({ error: 'Contrato cancelado' });

    let clientId = null;
    if (partyRole === 'seller') clientId = Number(contract.seller_id);
    if (partyRole === 'buyer') clientId = Number(contract.buyer_id);
    if (partyRole === 'assessor') clientId = contract.assessor_id ? Number(contract.assessor_id) : null;
    if (partyRole === 'witness1') clientId = contract.witness1_id ? Number(contract.witness1_id) : null;
    if (partyRole === 'witness2') clientId = contract.witness2_id ? Number(contract.witness2_id) : null;
    if (!clientId) return res.status(400).json({ error: 'Papel não se aplica a este contrato' });
    if (req.user.role === 'cliente' && Number(req.user.clientId) !== clientId) {
      return res.status(403).json({ error: 'Sem permissão para assinar neste papel' });
    }

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const ua = String(req.headers['user-agent'] || '').slice(0, 500);
    await pool.execute(
      `INSERT INTO contract_signatures (contract_id, party_role, client_id, signer_name, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE signer_name=VALUES(signer_name), signed_at=CURRENT_TIMESTAMP, ip=VALUES(ip), user_agent=VALUES(user_agent)`,
      [id, partyRole, clientId, String(signerName).trim(), String(ip).slice(0, 45), ua]
    );

    const need = ['seller', 'buyer'];
    if (contract.assessor_id) need.push('assessor');
    if (contract.witness1_id) need.push('witness1');
    if (contract.witness2_id) need.push('witness2');
    const [sigs] = await pool.execute('SELECT party_role FROM contract_signatures WHERE contract_id = ?', [id]);
    const have = sigs.map((s) => s.party_role);
    const all = need.every((r) => have.includes(r));
    if (all && ['rascunho', 'aguardando_assinatura'].includes(contract.status)) {
      await pool.execute("UPDATE contracts SET status = 'ativo' WHERE id = ?", [id]);
    }
    res.json({ success: true, activated: all });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao registrar assinatura' });
  }
});

app.get('/api/charges', auth(), async (req, res) => {
  try {
    await syncCancelledContractFinance();
    let sql = `${CHARGE_LIST_SELECT_SQL} WHERE 1=1`;
    const params = [];
    if (req.user.role === 'cliente') {
      if (!req.user.clientId) return res.json([]);
      sql += ' AND (ch.client_id = ? OR c.seller_id = ?)';
      params.push(req.user.clientId, req.user.clientId);
    }
    const statusFilter = req.query.status ? String(req.query.status) : '';
    if (statusFilter === 'cancelado') {
      sql += " AND ch.status = 'cancelado'";
    } else if (statusFilter === 'atrasado') {
      sql +=
        " AND c.status != 'cancelado' AND ch.status = 'pendente' AND ch.due_date < CURDATE()";
    } else if (statusFilter) {
      sql += " AND c.status != 'cancelado' AND ch.status = ?";
      params.push(statusFilter);
    } else {
      sql += " AND c.status != 'cancelado' AND ch.status != 'cancelado'";
    }
    if (req.query.contractId) {
      sql += ' AND ch.contract_id = ?';
      params.push(Number(req.query.contractId));
    }
    if (req.query.clientId) {
      sql += ' AND ch.client_id = ?';
      params.push(Number(req.query.clientId));
    }
    if (req.query.collector && ['assessoria', 'seller'].includes(String(req.query.collector))) {
      sql += ' AND ch.collector = ?';
      params.push(String(req.query.collector));
    }
    sql += ' ORDER BY ch.due_date ASC, ch.installment_no ASC';
    const [rows] = await pool.execute(sql, params);
    res.json(rows.map((c) => mapChargeRow(c)));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao listar cobranças' });
  }
});

app.post('/api/charges/bulk-update', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const clientId = Number(req.body.clientId || 0);
    if (!clientId) return res.status(400).json({ error: 'clientId é obrigatório' });
    const collector = normalizeCollector(req.body.collector || 'seller');
    if (!['assessoria', 'seller'].includes(collector)) {
      return res.status(400).json({ error: 'Cobrador inválido' });
    }
    const onlyAssessoria = req.body.onlyAssessoria !== false;
    const onlyOpen = req.body.onlyOpen !== false;
    const notesAppend =
      String(req.body.notes || '').trim() ||
      'Cobrança transferida ao vendedor — assessoria não receberá mais esta parcela';

    let sql = `UPDATE charges ch
               INNER JOIN contracts c ON c.id = ch.contract_id
               SET ch.collector = ?,
                   ch.notes = CASE
                     WHEN ch.notes IS NULL OR TRIM(ch.notes) = '' THEN ?
                     WHEN ch.notes LIKE CONCAT('%', ?, '%') THEN ch.notes
                     ELSE CONCAT(ch.notes, '\n', ?)
                   END
               WHERE ch.client_id = ? AND c.status != 'cancelado'`;
    const params = [collector, notesAppend, notesAppend, notesAppend, clientId];
    if (onlyAssessoria) sql += " AND ch.collector = 'assessoria'";
    if (onlyOpen) sql += " AND ch.status IN ('pendente', 'atrasado')";
    else sql += " AND ch.status != 'cancelado'";

    const [result] = await pool.execute(sql, params);
    res.json({ success: true, updated: result.affectedRows || 0 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar cobranças em lote' });
  }
});

app.put('/api/charges/:id', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status, collector, notes } = req.body;
    const sets = [];
    const params = [];

    if (status !== undefined) {
      if (!['pendente', 'pago', 'atrasado', 'cancelado'].includes(status)) {
        return res.status(400).json({ error: 'Status inválido' });
      }
      sets.push('status=?', 'paid_at=?');
      params.push(status, status === 'pago' ? new Date() : null);
    }
    if (collector !== undefined) {
      sets.push('collector=?');
      params.push(normalizeCollector(collector));
    }
    if (notes !== undefined) {
      sets.push('notes=?');
      params.push(notes || null);
    }
    if (!sets.length) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }
    params.push(id);
    await pool.execute(`UPDATE charges SET ${sets.join(', ')} WHERE id=?`, params);

    if (status !== undefined) {
      if (status === 'pago') {
        await pool.execute(
          `UPDATE payouts SET status = 'pendente' WHERE charge_id = ? AND status = 'aguardando'`,
          [id]
        );
      } else if (status === 'pendente' || status === 'atrasado') {
        await pool.execute(
          `UPDATE payouts SET status = 'aguardando', paid_at = NULL WHERE charge_id = ? AND status IN ('pendente','aguardando')`,
          [id]
        );
      } else if (status === 'cancelado') {
        await pool.execute(
          `UPDATE payouts SET status = 'cancelado' WHERE charge_id = ? AND status != 'pago'`,
          [id]
        );
      }
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar cobrança' });
  }
});

app.get('/api/charges/:id/collection-events', auth(), async (req, res) => {
  try {
    if (!(await collectionEventsTableExists())) return res.json([]);
    const chargeId = Number(req.params.id);
    const [rows] = await pool.execute(
      'SELECT * FROM charge_collection_events WHERE charge_id = ? ORDER BY created_at DESC, id DESC',
      [chargeId]
    );
    res.json(rows.map(mapCollectionEventRow));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao listar histórico' });
  }
});

app.post('/api/charges/:id/collection-events', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    if (!(await collectionEventsTableExists())) {
      return res.status(400).json({
        error: 'Histórico de cobrança não disponível. Execute migration-charge-collection-events.sql no banco.',
      });
    }
    const chargeId = Number(req.params.id);
    const note = String(req.body.note || '').trim();
    if (!note) return res.status(400).json({ error: 'Informe a anotação da cobrança' });
    const outcomes = ['sent', 'answered', 'no_answer', 'promised', 'paid', 'other'];
    const channels = ['whatsapp', 'phone', 'email', 'other'];
    const outcome = outcomes.includes(req.body.outcome) ? req.body.outcome : 'other';
    const channel = channels.includes(req.body.channel) ? req.body.channel : 'whatsapp';
    const promisedDate = req.body.promisedDate || null;

    const [[charge]] = await pool.execute('SELECT id FROM charges WHERE id = ? LIMIT 1', [chargeId]);
    if (!charge) return res.status(404).json({ error: 'Cobrança não encontrada' });

    const [[userRow]] = await pool.execute('SELECT name FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    const [result] = await pool.execute(
      `INSERT INTO charge_collection_events (charge_id, user_id, user_name, note, outcome, promised_date, channel)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [chargeId, req.user.id, userRow?.name || null, note, outcome, promisedDate, channel]
    );
    const [[row]] = await pool.execute('SELECT * FROM charge_collection_events WHERE id = ?', [result.insertId]);
    res.json(mapCollectionEventRow(row));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao salvar histórico' });
  }
});

app.post('/api/charges/:id/register-commission', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const amount = Number(req.body.amount || 0);
    const notes = req.body.notes != null ? String(req.body.notes) : null;
    const markChargePaid = req.body.markChargePaid !== false;
    await registerSellerCommission(id, amount, notes, markChargePaid);
    res.json({ success: true });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ error: error.message || 'Erro ao registrar comissão' });
  }
});

app.get('/api/auctions', auth(), async (req, res) => {
  try {
    if (req.user.role === 'cliente') {
      const clientId = req.user.clientId;
      if (!clientId || !(await clientIsAssessor(clientId))) return res.json([]);
      return res.json(await fetchAssessorAuctions(Number(clientId)));
    }
    const [rows] = await pool.execute(
      `SELECT a.*, (SELECT COUNT(*) FROM auction_lots l WHERE l.auction_id = a.id) AS lots_count
       FROM auctions a
       ORDER BY COALESCE(a.auction_date, a.created_at) DESC, a.id DESC`
    );
    res.json(rows.map(mapAuction));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao listar leilões' });
  }
});

app.get('/api/auctions/:id/assessor-finance', auth(), async (req, res) => {
  try {
    const clientId = req.user.clientId;
    if (req.user.role !== 'cliente' || !clientId || !(await clientIsAssessor(clientId))) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    res.json(await fetchAssessorAuctionFinance(Number(req.params.id), Number(clientId)));
  } catch (error) {
    if (error.status === 404) return res.status(404).json({ error: error.message });
    console.error(error);
    res.status(500).json({ error: 'Erro ao carregar evento' });
  }
});

app.get('/api/auctions/:id/finance', auth(), async (req, res) => {
  try {
    res.json(await fetchAuctionFinance(Number(req.params.id)));
  } catch (error) {
    if (error.status === 404) return res.status(404).json({ error: error.message });
    console.error(error);
    res.status(500).json({ error: 'Erro ao carregar financeiro do leilão' });
  }
});

app.post('/api/auctions/:id/expenses', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const auctionId = Number(req.params.id);
    const amount = Number(req.body.amount);
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Informe um valor maior que zero' });
    const [[auction]] = await pool.execute('SELECT id FROM auctions WHERE id = ?', [auctionId]);
    if (!auction) return res.status(404).json({ error: 'Leilão não encontrado' });
    const category = normalizeAuctionExpenseCategory(req.body.category);
    const [result] = await pool.execute(
      `INSERT INTO auction_expenses (auction_id, category, description, amount, expense_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        auctionId,
        category,
        String(req.body.description || '').trim() || null,
        amount,
        req.body.expenseDate || null,
        req.user.id,
      ]
    );
    res.json({ success: true, id: String(result.insertId) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao registrar despesa' });
  }
});

app.put('/api/auctions/:id/expenses/:expenseId', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const auctionId = Number(req.params.id);
    const expenseId = Number(req.params.expenseId);
    const [[row]] = await pool.execute(
      'SELECT id FROM auction_expenses WHERE id = ? AND auction_id = ?',
      [expenseId, auctionId]
    );
    if (!row) return res.status(404).json({ error: 'Despesa não encontrada' });
    const fields = [];
    const params = [];
    if (req.body.category !== undefined) {
      fields.push('category=?');
      params.push(normalizeAuctionExpenseCategory(req.body.category));
    }
    if (req.body.description !== undefined) {
      fields.push('description=?');
      params.push(String(req.body.description || '').trim() || null);
    }
    if (req.body.amount !== undefined) {
      const amount = Number(req.body.amount);
      if (!amount || amount <= 0) return res.status(400).json({ error: 'Valor inválido' });
      fields.push('amount=?');
      params.push(amount);
    }
    if (req.body.expenseDate !== undefined) {
      fields.push('expense_date=?');
      params.push(req.body.expenseDate || null);
    }
    if (!fields.length) return res.status(400).json({ error: 'Nada para atualizar' });
    params.push(expenseId);
    await pool.execute(`UPDATE auction_expenses SET ${fields.join(',')} WHERE id=?`, params);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar despesa' });
  }
});

app.delete('/api/auctions/:id/expenses/:expenseId', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const [result] = await pool.execute(
      'DELETE FROM auction_expenses WHERE id = ? AND auction_id = ?',
      [Number(req.params.expenseId), Number(req.params.id)]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Despesa não encontrada' });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao excluir despesa' });
  }
});

app.get('/api/auctions/:id', auth(), async (req, res) => {
  try {
    const [[row]] = await pool.execute('SELECT * FROM auctions WHERE id = ?', [Number(req.params.id)]);
    if (!row) return res.status(404).json({ error: 'Leilão não encontrado' });
    const [lots] = await pool.execute(
      `SELECT l.*, an.name AS animal_name, s.name AS seller_name
       FROM auction_lots l
       INNER JOIN animals an ON an.id = l.animal_id
       INNER JOIN clients s ON s.id = l.seller_id
       WHERE l.auction_id = ?
       ORDER BY l.lot_number ASC, l.id ASC`,
      [row.id]
    );
    res.json({ ...mapAuction(row), lots: await attachLotSellers(pool, lots) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao abrir leilão' });
  }
});

app.post('/api/auctions', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const { name, auctionDate, location, organizer, status = 'rascunho', notes } = req.body;
    if (!String(name || '').trim()) return res.status(400).json({ error: 'Nome do leilão é obrigatório' });
    const st = ['rascunho', 'agendado', 'em_andamento', 'encerrado', 'cancelado'].includes(status)
      ? status
      : 'rascunho';
    const [result] = await pool.execute(
      `INSERT INTO auctions (name, auction_date, location, organizer, status, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        String(name).trim(),
        auctionDate || null,
        location || null,
        organizer || null,
        st,
        notes || null,
        req.user.id,
      ]
    );
    res.json({ success: true, id: String(result.insertId) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar leilão' });
  }
});

app.put('/api/auctions/:id', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, auctionDate, location, organizer, status, notes } = req.body;
    const fields = [];
    const params = [];
    if (name !== undefined) {
      fields.push('name=?');
      params.push(String(name).trim());
    }
    if (auctionDate !== undefined) {
      fields.push('auction_date=?');
      params.push(auctionDate || null);
    }
    if (location !== undefined) {
      fields.push('location=?');
      params.push(location || null);
    }
    if (organizer !== undefined) {
      fields.push('organizer=?');
      params.push(organizer || null);
    }
    if (status !== undefined) {
      if (!['rascunho', 'agendado', 'em_andamento', 'encerrado', 'cancelado'].includes(status)) {
        return res.status(400).json({ error: 'Status inválido' });
      }
      fields.push('status=?');
      params.push(status);
    }
    if (notes !== undefined) {
      fields.push('notes=?');
      params.push(notes || null);
    }
    if (!fields.length) return res.status(400).json({ error: 'Nada para atualizar' });
    params.push(id);
    await pool.execute(`UPDATE auctions SET ${fields.join(',')} WHERE id=?`, params);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar leilão' });
  }
});

app.get('/api/auction-lots', auth(), async (req, res) => {
  try {
    let sql = `SELECT l.*, an.name AS animal_name, s.name AS seller_name
               FROM auction_lots l
               INNER JOIN animals an ON an.id = l.animal_id
               INNER JOIN clients s ON s.id = l.seller_id
               WHERE 1=1`;
    const params = [];
    if (req.query.auctionId) {
      sql += ' AND l.auction_id = ?';
      params.push(Number(req.query.auctionId));
    }
    if (req.query.status) {
      sql += ' AND l.status = ?';
      params.push(req.query.status);
    }
    sql += ' ORDER BY l.lot_number ASC, l.id ASC';
    const [rows] = await pool.execute(sql, params);
    res.json(await attachLotSellers(pool, rows));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao listar lotes' });
  }
});

app.post('/api/auction-lots', auth(['root', 'admin', 'user']), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { auctionId, animalId, lotNumber, minPrice, conditionsText } = req.body;
    const sellers = normalizeLotSellers(req.body);
    if (!auctionId || !animalId || !sellers?.length) {
      return res.status(400).json({ error: 'Leilão, animal e ao menos um vendedor são obrigatórios' });
    }
    const primary = sellers.find((s) => s.isPrimary) || sellers[0];
    await conn.beginTransaction();
    const [result] = await conn.execute(
      `INSERT INTO auction_lots (auction_id, animal_id, lot_number, seller_id, min_price, conditions_text, status)
       VALUES (?, ?, ?, ?, ?, ?, 'disponivel')`,
      [
        Number(auctionId),
        Number(animalId),
        lotNumber || null,
        primary.clientId,
        minPrice != null && minPrice !== '' ? Number(minPrice) : null,
        conditionsText || null,
      ]
    );
    const lotId = result.insertId;
    try {
      await upsertLotSellers(conn, lotId, sellers);
    } catch (e) {
      if (e.code !== 'ER_NO_SUCH_TABLE') throw e;
    }
    await conn.commit();
    res.json({ success: true, id: String(lotId) });
  } catch (error) {
    await conn.rollback();
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar lote' });
  } finally {
    conn.release();
  }
});

app.put('/api/auction-lots/:id', auth(['root', 'admin', 'user']), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const id = Number(req.params.id);
    const { lotNumber, minPrice, conditionsText, status } = req.body;
    const sellers = normalizeLotSellers(req.body);
    const fields = [];
    const params = [];
    if (lotNumber !== undefined) {
      fields.push('lot_number=?');
      params.push(lotNumber || null);
    }
    if (minPrice !== undefined) {
      fields.push('min_price=?');
      params.push(minPrice != null && minPrice !== '' ? Number(minPrice) : null);
    }
    if (conditionsText !== undefined) {
      fields.push('conditions_text=?');
      params.push(conditionsText || null);
    }
    if (sellers?.length) {
      const primary = sellers.find((s) => s.isPrimary) || sellers[0];
      fields.push('seller_id=?');
      params.push(primary.clientId);
    } else if (req.body.sellerId !== undefined) {
      fields.push('seller_id=?');
      params.push(Number(req.body.sellerId));
    }
    if (status !== undefined) {
      if (!['disponivel', 'arrematado', 'retirado'].includes(status)) {
        return res.status(400).json({ error: 'Status inválido' });
      }
      fields.push('status=?');
      params.push(status);
    }
    if (!fields.length && !sellers?.length) return res.status(400).json({ error: 'Nada para atualizar' });
    await conn.beginTransaction();
    if (fields.length) {
      params.push(id);
      await conn.execute(`UPDATE auction_lots SET ${fields.join(',')} WHERE id=?`, params);
    }
    if (sellers?.length) {
      try {
        await upsertLotSellers(conn, id, sellers);
      } catch (e) {
        if (e.code !== 'ER_NO_SUCH_TABLE') throw e;
      }
    }
    await conn.commit();
    res.json({ success: true });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ error: 'Erro ao atualizar lote' });
  } finally {
    conn.release();
  }
});

app.get('/api/payouts', auth(), async (req, res) => {
  try {
    await syncCancelledContractFinance();
    let sql = `SELECT p.*, cl.name AS beneficiary_name, a.name AS animal_name,
                      ch.status AS charge_status, ch.due_date AS charge_due_date
               FROM payouts p
               INNER JOIN contracts c ON c.id = p.contract_id
               INNER JOIN animals a ON a.id = c.animal_id
               INNER JOIN charges ch ON ch.id = p.charge_id
               LEFT JOIN clients cl ON cl.id = p.beneficiary_client_id
               WHERE 1=1`;
    const params = [];
    if (req.user.role === 'cliente') {
      if (!req.user.clientId) return res.json([]);
      sql += ' AND p.beneficiary_client_id = ?';
      params.push(req.user.clientId);
    }
    const statusFilter = req.query.status ? String(req.query.status) : '';
    if (statusFilter === 'cancelado') {
      sql += " AND p.status = 'cancelado'";
    } else if (statusFilter) {
      sql += " AND c.status != 'cancelado' AND p.status = ?";
      params.push(statusFilter);
    } else {
      sql += " AND c.status != 'cancelado' AND p.status != 'cancelado'";
    }
    if (req.query.contractId) {
      sql += ' AND p.contract_id = ?';
      params.push(Number(req.query.contractId));
    }
    sql += ' ORDER BY ch.due_date ASC, p.installment_no ASC, p.id ASC';
    const [rows] = await pool.execute(sql, params);
    res.json(rows.map(mapPayout));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao listar repasses' });
  }
});

app.put('/api/payouts/:id', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status, notes } = req.body;
    if (!['aguardando', 'pendente', 'pago', 'cancelado'].includes(status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }
    const paidAt = status === 'pago' ? new Date() : null;
    await pool.execute('UPDATE payouts SET status=?, paid_at=?, notes=? WHERE id=?', [
      status,
      paidAt,
      notes || null,
      id,
    ]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar repasse' });
  }
});

app.post('/api/payouts/:id/reverse', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const notes = req.body.notes != null ? String(req.body.notes) : null;
    const result = await reversePayout(id, notes);
    res.json({ success: true, status: result.newStatus });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ error: error.message || 'Erro ao estornar repasse' });
  }
});

// ——— Modelos de contrato (versos) ———
app.get('/api/contract-templates', auth(), async (req, res) => {
  try {
    let sql = 'SELECT * FROM contract_templates WHERE 1=1';
    const params = [];
    if (req.query.active === '1') {
      sql += ' AND active = 1';
    }
    sql += ' ORDER BY is_default DESC, name ASC';
    const [rows] = await pool.execute(sql, params);
    res.json(rows.map(mapTemplate));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao listar modelos' });
  }
});

app.get('/api/contract-templates/:id', auth(), async (req, res) => {
  try {
    const [[row]] = await pool.execute('SELECT * FROM contract_templates WHERE id = ?', [
      Number(req.params.id),
    ]);
    if (!row) return res.status(404).json({ error: 'Modelo não encontrado' });
    res.json(mapTemplate(row));
  } catch (error) {
    res.status(500).json({ error: 'Erro ao abrir modelo' });
  }
});

app.post('/api/contract-templates', auth(['root', 'admin', 'user']), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { name, code, title, bodyText, isDefault = false, active = true, notes } = req.body;
    if (!String(name || '').trim() || !String(bodyText || '').trim()) {
      return res.status(400).json({ error: 'Nome e texto do verso são obrigatórios' });
    }
    await conn.beginTransaction();
    if (isDefault) {
      await conn.execute('UPDATE contract_templates SET is_default = 0');
    }
    const [result] = await conn.execute(
      `INSERT INTO contract_templates (name, code, title, body_text, is_default, active, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(name).trim(),
        code || null,
        title || 'CONTRATO PARTICULAR DE COMPRA E VENDA DE SEMOVENTE COM RESERVA DE DOMÍNIO',
        bodyText,
        isDefault ? 1 : 0,
        active ? 1 : 0,
        notes || null,
        req.user.id,
      ]
    );
    await conn.commit();
    res.json({ success: true, id: String(result.insertId) });
  } catch (error) {
    await conn.rollback();
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar modelo' });
  } finally {
    conn.release();
  }
});

app.put('/api/contract-templates/:id', auth(['root', 'admin', 'user']), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const id = Number(req.params.id);
    const { name, code, title, bodyText, isDefault, active, notes } = req.body;
    await conn.beginTransaction();
    if (isDefault) {
      await conn.execute('UPDATE contract_templates SET is_default = 0');
    }
    const fields = [];
    const params = [];
    if (name !== undefined) {
      fields.push('name=?');
      params.push(String(name).trim());
    }
    if (code !== undefined) {
      fields.push('code=?');
      params.push(code || null);
    }
    if (title !== undefined) {
      fields.push('title=?');
      params.push(title);
    }
    if (bodyText !== undefined) {
      fields.push('body_text=?');
      params.push(bodyText);
    }
    if (isDefault !== undefined) {
      fields.push('is_default=?');
      params.push(isDefault ? 1 : 0);
    }
    if (active !== undefined) {
      fields.push('active=?');
      params.push(active ? 1 : 0);
    }
    if (notes !== undefined) {
      fields.push('notes=?');
      params.push(notes || null);
    }
    if (!fields.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'Nada para atualizar' });
    }
    params.push(id);
    await conn.execute(`UPDATE contract_templates SET ${fields.join(',')} WHERE id=?`, params);
    await conn.commit();
    res.json({ success: true });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ error: 'Erro ao atualizar modelo' });
  } finally {
    conn.release();
  }
});

app.get('/api/catalogs', auth(), async (req, res) => {
  try {
    const kind = String(req.query.kind || '').trim();
    if (!['breed', 'sale_type', 'animal_category', 'share_quota'].includes(kind)) {
      return res.status(400).json({ error: 'Informe kind válido (breed, sale_type, animal_category, share_quota)' });
    }
    const [rows] = await pool.execute(
      'SELECT * FROM catalogs WHERE kind = ? AND active = 1 ORDER BY name ASC',
      [kind]
    );
    res.json(
      rows.map((r) => ({
        id: String(r.id),
        kind: r.kind,
        name: r.name,
        code: r.code,
        active: Boolean(r.active),
      }))
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao listar catálogo' });
  }
});

app.post('/api/catalogs', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const kind = String(req.body.kind || '').trim();
    const name = String(req.body.name || '').trim();
    let code = req.body.code != null ? String(req.body.code).trim() : null;
    if (!['breed', 'sale_type', 'animal_category', 'share_quota'].includes(kind)) {
      return res.status(400).json({ error: 'Tipo de catálogo inválido' });
    }
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
    if ((kind === 'sale_type' || kind === 'animal_category' || kind === 'share_quota') && !code) {
      if (kind === 'share_quota') {
        const num = name.replace('%', '').replace(',', '.').trim();
        code = String(Number(num) || name)
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^0-9.]/g, '')
          .slice(0, 40) || '100';
      } else {
        code = name
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, '_')
          .replace(/^_|_$/g, '')
          .slice(0, 40) || 'CUSTOM';
        if (kind === 'sale_type') {
          code = code.toLowerCase();
        }
      }
    }
    const [result] = await pool.execute(
      'INSERT INTO catalogs (kind, name, code, active) VALUES (?, ?, ?, 1)',
      [kind, name, code || null]
    );
    res.json({
      success: true,
      id: String(result.insertId),
      kind,
      name,
      code,
    });
  } catch (error) {
    console.error(error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Este item já existe no catálogo' });
    }
    res.status(500).json({ error: 'Erro ao criar item do catálogo' });
  }
});

app.get('/api/audit-logs', auth(['root', 'admin']), async (req, res) => {
  try {
    res.json(
      await fetchAuditLogs({
        userId: req.query.userId,
        action: req.query.action,
        resource: req.query.resource,
        from: req.query.from,
        to: req.query.to,
        q: String(req.query.q || '').trim(),
        limit: req.query.limit,
        offset: req.query.offset,
      })
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao listar auditoria' });
  }
});

app.get('/api/receivables-analytical', auth(), async (req, res) => {
  if (req.user.role === 'cliente') {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  try {
    res.json(
      await fetchReceivablesAnalytical({
        status: req.query.status,
        from: req.query.from,
        to: req.query.to,
        clientId: req.query.clientId,
        q: req.query.q,
      })
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao gerar relatório analítico' });
  }
});

app.get('/api/system-settings/collection-whatsapp', auth(), async (req, res) => {
  if (req.user.role === 'cliente') {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  try {
    res.json(await fetchCollectionWhatsappSettings());
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao carregar mensagem padrão' });
  }
});

app.put('/api/system-settings/collection-whatsapp', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    let template = String(req.body?.template || '').trim();
    const bankDetails = String(req.body?.bankDetails || '').trim();
    if (!template) template = defaultCollectionWhatsappSettings().template;
    await systemSettingSet(COLLECTION_WHATSAPP_SETTING_KEY, { template, bankDetails });
    res.json({ success: true, ...(await fetchCollectionWhatsappSettings()) });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ error: error.message || 'Erro ao salvar mensagem padrão' });
  }
});

app.get('/api/receivables-dashboard', auth(), async (req, res) => {
  if (req.user.role === 'cliente') {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  try {
    res.json(await fetchReceivablesDashboard());
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao carregar recebíveis' });
  }
});

app.get('/api/company-finance', auth(), async (req, res) => {
  if (req.user.role === 'cliente') {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  try {
    res.json(await fetchCompanyFinance());
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao carregar financeiro' });
  }
});

app.get('/api/subscriptions', auth(['root', 'admin', 'user']), async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.*,
        (SELECT cp.name FROM client_properties cp WHERE cp.client_id = c.id ORDER BY cp.id ASC LIMIT 1) AS property_name
       FROM clients c
       WHERE c.active = 1
       ORDER BY c.name ASC`
    );
    const out = [];
    for (const r of rows) {
      const mapped = mapClient(r);
      mapped.modules = await fetchClientModules(Number(r.id));
      out.push(mapped);
    }
    res.json(out);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao listar assinaturas' });
  }
});

app.get('/api/clients/:id/modules', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const cid = Number(req.params.id);
    const [rows] = await pool.execute(
      `SELECT subscription_type, subscription_suspended, adhesion_fee, monthly_fee, adhesion_paid_at
       FROM clients WHERE id = ? LIMIT 1`,
      [cid]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Cliente não encontrado' });
    const c = rows[0];
    res.json({
      subscriptionType: c.subscription_type ?? 'assessoria',
      subscriptionSuspended: Boolean(c.subscription_suspended),
      adhesionFee: c.adhesion_fee != null ? Number(c.adhesion_fee) : null,
      monthlyFee: c.monthly_fee != null ? Number(c.monthly_fee) : null,
      adhesionPaidAt: c.adhesion_paid_at,
      modules: await fetchClientModules(cid),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao carregar módulos' });
  }
});

app.put('/api/clients/:id/modules', auth(['root', 'admin', 'user']), async (req, res) => {
  const cid = Number(req.params.id);
  const body = req.body || {};
  const conn = await pool.getConnection();
  try {
    const [curRows] = await conn.execute(
      'SELECT subscription_type, subscription_suspended, adhesion_fee, monthly_fee, adhesion_paid_at FROM clients WHERE id = ?',
      [cid]
    );
    const cur = curRows[0];
    if (!cur) return res.status(404).json({ error: 'Cliente não encontrado' });

    await conn.beginTransaction();
    const subType = ['assessoria', 'avulso'].includes(body.subscriptionType)
      ? body.subscriptionType
      : cur.subscription_type ?? 'assessoria';
    const suspended = body.subscriptionSuspended != null ? (body.subscriptionSuspended ? 1 : 0) : Number(cur.subscription_suspended);
    const adhesionFee =
      body.adhesionFee !== undefined
        ? body.adhesionFee != null && body.adhesionFee !== ''
          ? Number(body.adhesionFee)
          : null
        : cur.adhesion_fee;
    const monthlyFee =
      body.monthlyFee !== undefined
        ? body.monthlyFee != null && body.monthlyFee !== ''
          ? Number(body.monthlyFee)
          : null
        : cur.monthly_fee;
    const adhesionPaidAt =
      body.adhesionPaidAt !== undefined ? body.adhesionPaidAt || null : cur.adhesion_paid_at;

    await conn.execute(
      `UPDATE clients SET subscription_type=?, subscription_suspended=?, adhesion_fee=?, monthly_fee=?, adhesion_paid_at=? WHERE id=?`,
      [subType, suspended, adhesionFee, monthlyFee, adhesionPaidAt, cid]
    );

    if (Array.isArray(body.modules)) {
      for (const m of body.modules) {
        if (!m || typeof m !== 'object') continue;
        const code = normalizeClientModuleCode(m.code);
        if (!code) continue;
        const active = m.active ? 1 : 0;
        const fee =
          m.monthlyFee !== undefined
            ? m.monthlyFee != null && m.monthlyFee !== ''
              ? Number(m.monthlyFee)
              : null
            : null;
        await conn.execute(
          `INSERT INTO client_modules (client_id, module_code, active, monthly_fee, activated_at)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE active=VALUES(active), monthly_fee=VALUES(monthly_fee),
             activated_at=IF(VALUES(active)=1 AND activated_at IS NULL, CURDATE(), activated_at),
             updated_at=CURRENT_TIMESTAMP`,
          [cid, code, active, fee, active ? todayBrasiliaISO() : null]
        );
      }
    }

    await conn.commit();
    res.json({ success: true });
  } catch (error) {
    await conn.rollback();
    console.error(error);
    res.status(500).json({ error: 'Erro ao salvar assinatura' });
  } finally {
    conn.release();
  }
});

function mapBreedingCovering(r) {
  return {
    id: String(r.id),
    mareAnimalId: String(r.mare_animal_id),
    mareName: r.mare_name ?? null,
    stallionAnimalId: r.stallion_animal_id ? String(r.stallion_animal_id) : null,
    stallionName: r.stallion_name ?? r.stallion_animal_name ?? null,
    method: r.method,
    coveringDate: r.covering_date,
    season: r.season,
    veterinarian: r.veterinarian,
    abccmmStatus: r.abccmm_status,
    notes: r.notes,
    createdAt: r.created_at ?? null,
  };
}

app.get('/api/search', auth(), async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) {
      return res.json({ people: [], animals: [], contracts: [], auctions: [] });
    }
    const like = `%${q}%`;
    const isCliente = req.user.role === 'cliente';
    const cid = req.user.clientId;

    let people = [];
    if (!isCliente) {
      const [rows] = await pool.execute(
        `SELECT id, name, document, city, state FROM clients
         WHERE active = 1 AND (name LIKE ? OR document LIKE ? OR email LIKE ?)
         ORDER BY name ASC LIMIT 8`,
        [like, like, like]
      );
      people = rows.map((r) => ({
        id: String(r.id),
        name: r.name,
        subtitle: [r.city, r.state].filter(Boolean).join('/') || r.document || '',
        to: '/app/pessoas',
      }));
    }

    let animalSql = `SELECT a.id, a.name, a.registration_no, a.breed FROM animals a
      WHERE (a.name LIKE ? OR a.registration_no LIKE ? OR a.chip_no LIKE ?)`;
    const animalParams = [like, like, like];
    if (isCliente && cid) {
      animalSql += ` AND ${CLIENT_ANIMAL_ACCESS_SQL}`;
      animalParams.push(...bindClientAnimalAccessParams(cid));
    }
    animalSql += ' ORDER BY a.name ASC LIMIT 8';
    const [animalRows] = await pool.execute(animalSql, animalParams);
    const animals = animalRows.map((r) => ({
      id: String(r.id),
      name: r.name,
      subtitle: r.registration_no || r.breed || 'Animal',
      to: `/app/animais/${r.id}`,
    }));

    let contractSql = `SELECT c.id, c.contract_number, an.name AS animal_name, sb.name AS seller_name, bb.name AS buyer_name
      FROM contracts c
      LEFT JOIN animals an ON an.id = c.animal_id
      LEFT JOIN clients sb ON sb.id = c.seller_id
      LEFT JOIN clients bb ON bb.id = c.buyer_id
      WHERE c.status != 'cancelado'
        AND (an.name LIKE ? OR c.contract_number LIKE ? OR sb.name LIKE ? OR bb.name LIKE ?)`;
    const contractParams = [like, like, like, like];
    if (isCliente && cid) {
      contractSql += ` AND ${CLIENT_CONTRACT_ACCESS_SQL}`;
      contractParams.push(...bindClientContractAccessParams(cid));
    }
    contractSql += ' ORDER BY c.created_at DESC LIMIT 8';
    const [contractRows] = await pool.execute(contractSql, contractParams);
    const contracts = contractRows.map((r) => ({
      id: String(r.id),
      name: r.contract_number ? `Contrato ${r.contract_number}` : 'Contrato',
      subtitle: `${r.animal_name || 'Animal'} · ${r.seller_name || ''} → ${r.buyer_name || ''}`,
      to: '/app/contratos',
    }));

    let auctions = [];
    if (!isCliente) {
      const [auctionRows] = await pool.execute(
        `SELECT id, name, auction_date, status FROM auctions
         WHERE name LIKE ? OR location LIKE ?
         ORDER BY auction_date DESC LIMIT 6`,
        [like, like]
      );
      auctions = auctionRows.map((r) => ({
        id: String(r.id),
        name: r.name,
        subtitle: r.auction_date || r.status,
        to: '/app/leiloes',
      }));
    }

    res.json({ people, animals, contracts, auctions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro na busca' });
  }
});

app.get('/api/breeding-coverings', auth(), async (req, res) => {
  if (req.user.role === 'cliente') return res.status(403).json({ error: 'Acesso negado' });
  try {
    const q = String(req.query.q || '').trim();
    let sql = `SELECT bc.*, mare.name AS mare_name, stallion.name AS stallion_animal_name
      FROM breeding_coverings bc
      INNER JOIN animals mare ON mare.id = bc.mare_animal_id
      LEFT JOIN animals stallion ON stallion.id = bc.stallion_animal_id WHERE 1=1`;
    const params = [];
    if (q) {
      sql += ' AND (mare.name LIKE ? OR bc.stallion_name LIKE ? OR stallion.name LIKE ? OR bc.season LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like, like, like);
    }
    sql += ' ORDER BY bc.covering_date DESC LIMIT 200';
    const [rows] = await pool.execute(sql, params);
    res.json(rows.map(mapBreedingCovering));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Tabela de reprodução não disponível — rode a migration' });
  }
});

app.post('/api/breeding-coverings', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const body = req.body || {};
    const mareId = Number(body.mareAnimalId || 0);
    if (!mareId) return res.status(400).json({ error: 'Égua é obrigatória' });
    const method = ['ia', 'monta_natural', 'te'].includes(body.method) ? body.method : 'ia';
    const date = String(body.coveringDate || '').trim();
    if (!date) return res.status(400).json({ error: 'Data da cobertura é obrigatória' });
    const abccmm = ['pendente', 'comunicado', 'confirmado'].includes(body.abccmmStatus)
      ? body.abccmmStatus
      : 'pendente';
    const stallionId = Number(body.stallionAnimalId || 0) || null;
    const [result] = await pool.execute(
      `INSERT INTO breeding_coverings (mare_animal_id, stallion_animal_id, stallion_name, method, covering_date, season, veterinarian, abccmm_status, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        mareId,
        stallionId,
        body.stallionName || null,
        method,
        date,
        body.season || null,
        body.veterinarian || null,
        abccmm,
        body.notes || null,
        req.user.id,
      ]
    );
    res.json({ success: true, id: String(result.insertId) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao registrar cobertura' });
  }
});

app.put('/api/breeding-coverings/:id', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [curRows] = await pool.execute('SELECT * FROM breeding_coverings WHERE id = ?', [id]);
    const cur = curRows[0];
    if (!cur) return res.status(404).json({ error: 'Cobertura não encontrada' });
    const body = req.body || {};
    const method = ['ia', 'monta_natural', 'te'].includes(body.method) ? body.method : cur.method;
    const abccmm = ['pendente', 'comunicado', 'confirmado'].includes(body.abccmmStatus)
      ? body.abccmmStatus
      : cur.abccmm_status;
    await pool.execute(
      `UPDATE breeding_coverings SET mare_animal_id=?, stallion_animal_id=?, stallion_name=?, method=?, covering_date=?, season=?, veterinarian=?, abccmm_status=?, notes=? WHERE id=?`,
      [
        Number(body.mareAnimalId || cur.mare_animal_id),
        body.stallionAnimalId != null ? Number(body.stallionAnimalId) || null : cur.stallion_animal_id,
        body.stallionName !== undefined ? body.stallionName || null : cur.stallion_name,
        method,
        body.coveringDate || cur.covering_date,
        body.season !== undefined ? body.season || null : cur.season,
        body.veterinarian !== undefined ? body.veterinarian || null : cur.veterinarian,
        abccmm,
        body.notes !== undefined ? body.notes || null : cur.notes,
        id,
      ]
    );
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar cobertura' });
  }
});

app.delete('/api/breeding-coverings/:id', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const [result] = await pool.execute('DELETE FROM breeding_coverings WHERE id = ?', [
      Number(req.params.id),
    ]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Cobertura não encontrada' });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao excluir cobertura' });
  }
});

function isHarasStaff(user) {
  return (user?.role || '') !== 'cliente';
}

async function requireHarasModule(req, res, code) {
  if (isHarasStaff(req.user)) return true;
  const cid = Number(req.user.clientId || 0);
  if (!cid) {
    res.status(403).json({ error: 'Acesso negado' });
    return false;
  }
  try {
    const [rows] = await pool.execute(
      'SELECT active FROM client_modules WHERE client_id = ? AND module_code = ? LIMIT 1',
      [cid, code]
    );
    if (!rows[0] || !rows[0].active) {
      res.status(403).json({ error: 'Este módulo não está ativo no seu plano' });
      return false;
    }
  } catch {
    res.status(403).json({ error: 'Módulo indisponível' });
    return false;
  }
  return true;
}

async function resolveHarasPropertyId(user, raw) {
  const propertyId = Number(raw || 0);
  if (propertyId <= 0) {
    const err = new Error('Selecione o haras');
    err.status = 400;
    throw err;
  }
  if (isHarasStaff(user)) {
    const [rows] = await pool.execute('SELECT id FROM client_properties WHERE id = ? LIMIT 1', [propertyId]);
    if (!rows[0]) {
      const err = new Error('Haras não encontrado');
      err.status = 400;
      throw err;
    }
    return propertyId;
  }
  const [rows] = await pool.execute(
    'SELECT id FROM client_properties WHERE id = ? AND client_id = ? LIMIT 1',
    [propertyId, Number(user.clientId || 0)]
  );
  if (!rows[0]) {
    const err = new Error('Haras não encontrado');
    err.status = 403;
    throw err;
  }
  return propertyId;
}

async function canAccessHarasProperty(user, propertyId) {
  if (isHarasStaff(user)) return true;
  const pid = Number(propertyId || 0);
  const cid = Number(user.clientId || 0);
  if (!pid || !cid) return false;
  const [rows] = await pool.execute(
    'SELECT 1 FROM client_properties WHERE id = ? AND client_id = ? LIMIT 1',
    [pid, cid]
  );
  return !!rows[0];
}

function applyHarasPropertyScope(alias, user, query, sql, params) {
  const propertyId = Number(query.propertyId || 0);
  const unassigned = isHarasStaff(user) && String(query.unassigned || '') === '1';
  if (!isHarasStaff(user)) {
    sql += ` AND ${alias}.property_id IN (SELECT id FROM client_properties WHERE client_id = ?)`;
    params.push(Number(user.clientId || 0));
  } else if (unassigned) {
    sql += ` AND ${alias}.property_id IS NULL`;
  }
  if (propertyId > 0) {
    sql += ` AND ${alias}.property_id = ?`;
    params.push(propertyId);
  }
  return { sql, params };
}

function harasPropertyFields(r) {
  return {
    propertyId: r.property_id ? String(r.property_id) : null,
    propertyName: r.property_name || null,
    propertyOwnerName: r.property_owner_name || null,
  };
}

function mapHarasVet(r) {
  return {
    id: String(r.id),
    ...harasPropertyFields(r),
    animalId: String(r.animal_id),
    animalName: r.animal_name || null,
    recordType: r.record_type,
    title: r.title,
    product: r.product,
    recordDate: r.record_date,
    nextDueDate: r.next_due_date,
    veterinarian: r.veterinarian,
    resultNotes: r.result_notes,
    cost: r.cost != null ? Number(r.cost) : null,
    notes: r.notes,
    createdAt: r.created_at || null,
  };
}

function mapHarasStock(r) {
  const quantity = Number(r.quantity);
  const minQuantity = Number(r.min_quantity);
  return {
    id: String(r.id),
    ...harasPropertyFields(r),
    name: r.name,
    category: r.category,
    unit: r.unit,
    quantity,
    minQuantity,
    unitCost: r.unit_cost != null ? Number(r.unit_cost) : null,
    location: r.location,
    notes: r.notes,
    lowStock: minQuantity > 0 && quantity <= minQuantity,
    createdAt: r.created_at || null,
  };
}

function mapHarasStockMove(r) {
  return {
    id: String(r.id),
    itemId: String(r.item_id),
    itemName: r.item_name || null,
    moveType: r.move_type,
    quantity: Number(r.quantity),
    reason: r.reason,
    animalId: r.animal_id ? String(r.animal_id) : null,
    animalName: r.animal_name || null,
    createdAt: r.created_at || null,
  };
}

function stayDaysJs(checkIn, checkOut) {
  if (!checkIn) return 1;
  const start = new Date(`${checkIn}T12:00:00`);
  const end = new Date(`${checkOut || new Date().toISOString().slice(0, 10)}T12:00:00`);
  const days = Math.round((end - start) / 86400000);
  return Math.max(1, days || 1);
}

async function harasEnsureStayIncome(pool, stayId, userId) {
  try {
    const [rows] = await pool.execute(
      `SELECT s.*, a.name AS animal_name
       FROM haras_stays s
       INNER JOIN animals a ON a.id = s.animal_id
       WHERE s.id = ?`,
      [stayId]
    );
    const stay = rows[0];
    if (!stay || stay.status !== 'encerrado' || !stay.check_out) return;
    const rate = Number(stay.daily_rate || 0);
    if (rate <= 0) return;
    const [existing] = await pool.execute('SELECT id FROM haras_finance_entries WHERE stay_id = ? LIMIT 1', [stayId]);
    if (existing[0]) return;
    const days = stayDaysJs(stay.check_in, stay.check_out);
    const amount = Math.round(days * rate * 100) / 100;
    if (amount <= 0) return;
    const desc = `Diárias — ${stay.animal_name} (${days} dia${days > 1 ? 's' : ''})`;
    await pool.execute(
      `INSERT INTO haras_finance_entries (property_id, entry_type, category, amount, entry_date, description, animal_id, stay_id, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['receita', 'diarias', amount, stay.check_out, desc, stay.animal_id, stayId, stay.property_id || null, null, userId]
    );
  } catch (error) {
    console.error(error);
  }
}

function mapHarasStay(r) {
  const days = stayDaysJs(r.check_in, r.check_out);
  const dailyRate = Number(r.daily_rate || 0);
  return {
    id: String(r.id),
    ...harasPropertyFields(r),
    animalId: String(r.animal_id),
    animalName: r.animal_name || null,
    ownerClientId: r.owner_client_id ? String(r.owner_client_id) : null,
    ownerName: r.owner_name || null,
    stall: r.stall,
    checkIn: r.check_in,
    checkOut: r.check_out,
    dailyRate,
    status: r.status,
    notes: r.notes,
    days,
    estimatedTotal: Math.round(days * dailyRate * 100) / 100,
    createdAt: r.created_at || null,
  };
}

function mapHarasFinance(r) {
  return {
    id: String(r.id),
    ...harasPropertyFields(r),
    entryType: r.entry_type,
    category: r.category,
    amount: Number(r.amount),
    entryDate: r.entry_date,
    description: r.description,
    animalId: r.animal_id ? String(r.animal_id) : null,
    animalName: r.animal_name || null,
    stayId: r.stay_id ? String(r.stay_id) : null,
    notes: r.notes,
    createdAt: r.created_at || null,
  };
}

const MIG_HARAS = 'Módulo indisponível — rode database/migration-haras-modules.sql';

app.get('/api/haras-properties', auth(), async (req, res) => {
  try {
    let sql = `SELECT p.id, p.client_id, p.name, p.city, p.state, p.is_primary, p.property_type, c.name AS owner_name
      FROM client_properties p INNER JOIN clients c ON c.id = p.client_id WHERE 1=1`;
    const params = [];
    if (!isHarasStaff(req.user)) {
      const cid = Number(req.user.clientId || 0);
      if (!cid) return res.json([]);
      sql += ' AND p.client_id = ?';
      params.push(cid);
    }
    sql += ' ORDER BY c.name ASC, p.is_primary DESC, p.name ASC';
    const [rows] = await pool.execute(sql, params);
    res.json(rows.map((r) => ({
      id: String(r.id),
      clientId: String(r.client_id),
      name: r.name,
      city: r.city,
      state: r.state,
      isPrimary: !!r.is_primary,
      propertyType: r.property_type,
      ownerName: r.owner_name,
    })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Não foi possível listar os haras' });
  }
});

app.get('/api/haras-vet', auth(), async (req, res) => {
  if (!(await requireHarasModule(req, res, 'sanitario'))) return;
  try {
    const q = String(req.query.q || '').trim();
    const type = String(req.query.type || '').trim();
    const animalId = Number(req.query.animalId || 0);
    let sql = `SELECT v.*, a.name AS animal_name, hp.name AS property_name, hpc.name AS property_owner_name
      FROM haras_vet_records v
      INNER JOIN animals a ON a.id = v.animal_id
      LEFT JOIN client_properties hp ON hp.id = v.property_id
      LEFT JOIN clients hpc ON hpc.id = hp.client_id WHERE 1=1`;
    const scoped = applyHarasPropertyScope('v', req.user, req.query, sql, []);
    sql = scoped.sql;
    const params = scoped.params;
    if (animalId > 0) {
      sql += ' AND v.animal_id = ?';
      params.push(animalId);
    }
    if (['vacina', 'vermifugo', 'exame', 'tratamento', 'outro'].includes(type)) {
      sql += ' AND v.record_type = ?';
      params.push(type);
    }
    if (q) {
      sql += ' AND (a.name LIKE ? OR v.title LIKE ? OR v.product LIKE ? OR v.veterinarian LIKE ? OR hp.name LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like, like, like, like);
    }
    sql += ' ORDER BY v.record_date DESC LIMIT 300';
    const [rows] = await pool.execute(sql, params);
    res.json(rows.map(mapHarasVet));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: MIG_HARAS });
  }
});

app.post('/api/haras-vet', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const body = req.body || {};
    const animalId = Number(body.animalId || 0);
    const title = String(body.title || '').trim();
    const recordDate = String(body.recordDate || '').trim();
    if (!animalId || !title || !recordDate) return res.status(400).json({ error: 'Animal, título e data são obrigatórios' });
    const propertyId = await resolveHarasPropertyId(req.user, body.propertyId);
    const recordType = ['vacina', 'vermifugo', 'exame', 'tratamento', 'outro'].includes(body.recordType)
      ? body.recordType
      : 'vacina';
    const [result] = await pool.execute(
      `INSERT INTO haras_vet_records (property_id, animal_id, record_type, title, product, record_date, next_due_date, veterinarian, result_notes, cost, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        propertyId, animalId, recordType, title, body.product || null, recordDate, body.nextDueDate || null,
        body.veterinarian || null, body.resultNotes || null,
        body.cost === '' || body.cost == null ? null : Number(body.cost),
        body.notes || null, req.user.id,
      ]
    );
    res.json({ success: true, id: String(result.insertId) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao salvar registro veterinário' });
  }
});

app.put('/api/haras-vet/:id', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [curRows] = await pool.execute('SELECT * FROM haras_vet_records WHERE id = ?', [id]);
    const cur = curRows[0];
    if (!cur) return res.status(404).json({ error: 'Registro não encontrado' });
    const b = req.body || {};
    const recordType = ['vacina', 'vermifugo', 'exame', 'tratamento', 'outro'].includes(b.recordType)
      ? b.recordType
      : cur.record_type;
    const propertyId = b.propertyId !== undefined
      ? await resolveHarasPropertyId(req.user, b.propertyId)
      : (cur.property_id || await resolveHarasPropertyId(req.user, 0));
    await pool.execute(
      `UPDATE haras_vet_records SET property_id=?, animal_id=?, record_type=?, title=?, product=?, record_date=?, next_due_date=?, veterinarian=?, result_notes=?, cost=?, notes=? WHERE id=?`,
      [
        propertyId, Number(b.animalId || cur.animal_id), recordType, b.title || cur.title,
        b.product !== undefined ? b.product || null : cur.product,
        b.recordDate || cur.record_date,
        b.nextDueDate !== undefined ? b.nextDueDate || null : cur.next_due_date,
        b.veterinarian !== undefined ? b.veterinarian || null : cur.veterinarian,
        b.resultNotes !== undefined ? b.resultNotes || null : cur.result_notes,
        b.cost !== undefined ? (b.cost === '' || b.cost == null ? null : Number(b.cost)) : cur.cost,
        b.notes !== undefined ? b.notes || null : cur.notes, id,
      ]
    );
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar registro' });
  }
});

app.delete('/api/haras-vet/:id', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const [result] = await pool.execute('DELETE FROM haras_vet_records WHERE id = ?', [Number(req.params.id)]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Registro não encontrado' });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao excluir registro' });
  }
});

app.get('/api/haras-stock', auth(), async (req, res) => {
  if (!(await requireHarasModule(req, res, 'estoque'))) return;
  try {
    const q = String(req.query.q || '').trim();
    const category = String(req.query.category || '').trim();
    let sql = `SELECT i.*, hp.name AS property_name, hpc.name AS property_owner_name
      FROM haras_stock_items i
      LEFT JOIN client_properties hp ON hp.id = i.property_id
      LEFT JOIN clients hpc ON hpc.id = hp.client_id WHERE 1=1`;
    const scoped = applyHarasPropertyScope('i', req.user, req.query, sql, []);
    sql = scoped.sql;
    const params = scoped.params;
    if (['medicamento', 'insumo', 'racao', 'material', 'outro'].includes(category)) {
      sql += ' AND i.category = ?';
      params.push(category);
    }
    if (q) {
      sql += ' AND (i.name LIKE ? OR i.location LIKE ? OR hp.name LIKE ?)';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    sql += ' ORDER BY i.name ASC LIMIT 300';
    const [rows] = await pool.execute(sql, params);
    res.json(rows.map(mapHarasStock));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: MIG_HARAS });
  }
});

app.get('/api/haras-stock/:id/moves', auth(), async (req, res) => {
  if (!(await requireHarasModule(req, res, 'estoque'))) return;
  try {
    const [itemRows] = await pool.execute('SELECT property_id FROM haras_stock_items WHERE id = ?', [Number(req.params.id)]);
    if (!itemRows[0]) return res.status(404).json({ error: 'Item não encontrado' });
    if (!(await canAccessHarasProperty(req.user, itemRows[0].property_id))) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    const [rows] = await pool.execute(
      `SELECT m.*, i.name AS item_name, a.name AS animal_name
       FROM haras_stock_moves m
       INNER JOIN haras_stock_items i ON i.id = m.item_id
       LEFT JOIN animals a ON a.id = m.animal_id
       WHERE m.item_id = ? ORDER BY m.created_at DESC LIMIT 100`,
      [Number(req.params.id)]
    );
    res.json(rows.map(mapHarasStockMove));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: MIG_HARAS });
  }
});

app.post('/api/haras-stock/:id/move', auth(['root', 'admin', 'user']), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const body = req.body || {};
    const moveType = ['entrada', 'saida', 'ajuste'].includes(body.moveType) ? body.moveType : 'entrada';
    const qty = Number(body.quantity || 0);
    if (qty <= 0) return res.status(400).json({ error: 'Quantidade deve ser maior que zero' });
    await conn.beginTransaction();
    const [rows] = await conn.execute('SELECT * FROM haras_stock_items WHERE id = ? FOR UPDATE', [Number(req.params.id)]);
    const item = rows[0];
    if (!item) {
      await conn.rollback();
      return res.status(404).json({ error: 'Item não encontrado' });
    }
    if (!(await canAccessHarasProperty(req.user, item.property_id))) {
      await conn.rollback();
      return res.status(403).json({ error: 'Acesso negado' });
    }
    const current = Number(item.quantity);
    let next = current;
    if (moveType === 'entrada') next = current + qty;
    else if (moveType === 'saida') next = current - qty;
    else next = qty;
    if (next < 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'Estoque insuficiente para esta saída' });
    }
    await conn.execute('UPDATE haras_stock_items SET quantity=? WHERE id=?', [next, item.id]);
    await conn.execute(
      'INSERT INTO haras_stock_moves (item_id, move_type, quantity, reason, animal_id, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [item.id, moveType, qty, body.reason || null, Number(body.animalId || 0) || null, req.user.id]
    );
    await conn.commit();
    res.json({ success: true, quantity: next });
  } catch (error) {
    await conn.rollback();
    console.error(error);
    res.status(500).json({ error: 'Erro ao registrar movimentação' });
  } finally {
    conn.release();
  }
});

app.post('/api/haras-stock', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const body = req.body || {};
    const name = String(body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Nome do item é obrigatório' });
    const propertyId = await resolveHarasPropertyId(req.user, body.propertyId);
    const category = ['medicamento', 'insumo', 'racao', 'material', 'outro'].includes(body.category)
      ? body.category
      : 'insumo';
    const [result] = await pool.execute(
      `INSERT INTO haras_stock_items (property_id, name, category, unit, quantity, min_quantity, unit_cost, location, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        propertyId, name, category, body.unit || 'un', Number(body.quantity || 0), Number(body.minQuantity || 0),
        body.unitCost === '' || body.unitCost == null ? null : Number(body.unitCost),
        body.location || null, body.notes || null, req.user.id,
      ]
    );
    res.json({ success: true, id: String(result.insertId) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao cadastrar item' });
  }
});

app.put('/api/haras-stock/:id', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [curRows] = await pool.execute('SELECT * FROM haras_stock_items WHERE id = ?', [id]);
    const cur = curRows[0];
    if (!cur) return res.status(404).json({ error: 'Item não encontrado' });
    const b = req.body || {};
    const category = ['medicamento', 'insumo', 'racao', 'material', 'outro'].includes(b.category)
      ? b.category
      : cur.category;
    const propertyId = b.propertyId !== undefined
      ? await resolveHarasPropertyId(req.user, b.propertyId)
      : (cur.property_id || await resolveHarasPropertyId(req.user, 0));
    await pool.execute(
      'UPDATE haras_stock_items SET property_id=?, name=?, category=?, unit=?, min_quantity=?, unit_cost=?, location=?, notes=? WHERE id=?',
      [
        propertyId, b.name || cur.name, category, b.unit || cur.unit, Number(b.minQuantity ?? cur.min_quantity),
        b.unitCost !== undefined ? (b.unitCost === '' || b.unitCost == null ? null : Number(b.unitCost)) : cur.unit_cost,
        b.location !== undefined ? b.location || null : cur.location,
        b.notes !== undefined ? b.notes || null : cur.notes, id,
      ]
    );
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar item' });
  }
});

app.delete('/api/haras-stock/:id', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const [result] = await pool.execute('DELETE FROM haras_stock_items WHERE id = ?', [Number(req.params.id)]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Item não encontrado' });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao excluir item' });
  }
});

app.get('/api/haras-stays', auth(), async (req, res) => {
  if (!(await requireHarasModule(req, res, 'hospedagem'))) return;
  try {
    const q = String(req.query.q || '').trim();
    const status = String(req.query.status || '').trim();
    const animalId = Number(req.query.animalId || 0);
    let sql = `SELECT s.*, a.name AS animal_name, c.name AS owner_name, hp.name AS property_name, hpc.name AS property_owner_name
      FROM haras_stays s
      INNER JOIN animals a ON a.id = s.animal_id
      LEFT JOIN clients c ON c.id = s.owner_client_id
      LEFT JOIN client_properties hp ON hp.id = s.property_id
      LEFT JOIN clients hpc ON hpc.id = hp.client_id WHERE 1=1`;
    const scoped = applyHarasPropertyScope('s', req.user, req.query, sql, []);
    sql = scoped.sql;
    const params = scoped.params;
    if (animalId > 0) {
      sql += ' AND s.animal_id = ?';
      params.push(animalId);
    }
    if (status === 'hospedado' || status === 'encerrado') {
      sql += ' AND s.status = ?';
      params.push(status);
    }
    if (q) {
      sql += ' AND (a.name LIKE ? OR s.stall LIKE ? OR c.name LIKE ?)';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    sql += ' ORDER BY s.status ASC, s.check_in DESC LIMIT 300';
    const [rows] = await pool.execute(sql, params);
    res.json(rows.map(mapHarasStay));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: MIG_HARAS });
  }
});

app.post('/api/haras-stays', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const body = req.body || {};
    const animalId = Number(body.animalId || 0);
    const checkIn = String(body.checkIn || '').trim();
    if (!animalId || !checkIn) return res.status(400).json({ error: 'Animal e data de entrada são obrigatórios' });
    const propertyId = await resolveHarasPropertyId(req.user, body.propertyId);
    let ownerClientId = Number(body.ownerClientId || 0) || null;
    if (!ownerClientId) {
      const [own] = await pool.execute('SELECT client_id FROM client_properties WHERE id = ?', [propertyId]);
      ownerClientId = own[0]?.client_id || null;
    }
    const [open] = await pool.execute("SELECT id FROM haras_stays WHERE animal_id = ? AND status = 'hospedado' LIMIT 1", [animalId]);
    if (open[0]) return res.status(400).json({ error: 'Este animal já está hospedado' });
    const checkOut = body.checkOut || null;
    const [result] = await pool.execute(
      `INSERT INTO haras_stays (property_id, animal_id, owner_client_id, stall, check_in, check_out, daily_rate, status, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        propertyId, animalId, ownerClientId, body.stall || null, checkIn, checkOut || null,
        Number(body.dailyRate || 0), checkOut ? 'encerrado' : 'hospedado', body.notes || null, req.user.id,
      ]
    );
    const newId = Number(result.insertId);
    await harasEnsureStayIncome(pool, newId, req.user.id);
    res.json({ success: true, id: String(newId) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao registrar hospedagem' });
  }
});

app.put('/api/haras-stays/:id', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [curRows] = await pool.execute('SELECT * FROM haras_stays WHERE id = ?', [id]);
    const cur = curRows[0];
    if (!cur) return res.status(404).json({ error: 'Hospedagem não encontrada' });
    const b = req.body || {};
    const propertyId = b.propertyId !== undefined
      ? await resolveHarasPropertyId(req.user, b.propertyId)
      : (cur.property_id || await resolveHarasPropertyId(req.user, 0));
    const checkOut = b.checkOut !== undefined ? b.checkOut || null : cur.check_out;
    let status = b.status || cur.status;
    if (checkOut) status = 'encerrado';
    if (!['hospedado', 'encerrado'].includes(status)) status = cur.status;
    await pool.execute(
      'UPDATE haras_stays SET property_id=?, animal_id=?, owner_client_id=?, stall=?, check_in=?, check_out=?, daily_rate=?, status=?, notes=? WHERE id=?',
      [
        propertyId,
        Number(b.animalId || cur.animal_id),
        b.ownerClientId !== undefined ? Number(b.ownerClientId || 0) || null : cur.owner_client_id,
        b.stall !== undefined ? b.stall || null : cur.stall,
        b.checkIn || cur.check_in, checkOut, Number(b.dailyRate ?? cur.daily_rate),
        status, b.notes !== undefined ? b.notes || null : cur.notes, id,
      ]
    );
    await harasEnsureStayIncome(pool, id, req.user.id);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar hospedagem' });
  }
});

app.delete('/api/haras-stays/:id', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const [result] = await pool.execute('DELETE FROM haras_stays WHERE id = ?', [Number(req.params.id)]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Hospedagem não encontrada' });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao excluir hospedagem' });
  }
});

app.get('/api/haras-finance', auth(), async (req, res) => {
  if (!(await requireHarasModule(req, res, 'financeiro_haras'))) return;
  try {
    const q = String(req.query.q || '').trim();
    const type = String(req.query.type || '').trim();
    const from = String(req.query.from || '').trim();
    const to = String(req.query.to || '').trim();
    let sql = `SELECT e.*, a.name AS animal_name, hp.name AS property_name, hpc.name AS property_owner_name
      FROM haras_finance_entries e
      LEFT JOIN animals a ON a.id = e.animal_id
      LEFT JOIN client_properties hp ON hp.id = e.property_id
      LEFT JOIN clients hpc ON hpc.id = hp.client_id WHERE 1=1`;
    const scoped = applyHarasPropertyScope('e', req.user, req.query, sql, []);
    sql = scoped.sql;
    const params = scoped.params;
    if (type === 'receita' || type === 'despesa') {
      sql += ' AND e.entry_type = ?';
      params.push(type);
    }
    if (from) {
      sql += ' AND e.entry_date >= ?';
      params.push(from);
    }
    if (to) {
      sql += ' AND e.entry_date <= ?';
      params.push(to);
    }
    if (q) {
      sql += ' AND (e.description LIKE ? OR e.category LIKE ? OR a.name LIKE ? OR hp.name LIKE ?)';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }
    sql += ' ORDER BY e.entry_date DESC LIMIT 400';
    const [rows] = await pool.execute(sql, params);
    const items = rows.map(mapHarasFinance);
    const income = items.filter((i) => i.entryType === 'receita').reduce((s, i) => s + i.amount, 0);
    const expense = items.filter((i) => i.entryType === 'despesa').reduce((s, i) => s + i.amount, 0);
    res.json({
      items,
      totals: { income: Math.round(income * 100) / 100, expense: Math.round(expense * 100) / 100, balance: Math.round((income - expense) * 100) / 100 },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: MIG_HARAS });
  }
});

app.post('/api/haras-finance', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const b = req.body || {};
    const entryType = b.entryType === 'receita' ? 'receita' : 'despesa';
    const description = String(b.description || '').trim();
    const entryDate = String(b.entryDate || '').trim();
    const amount = Number(b.amount || 0);
    if (!description || !entryDate || amount <= 0) {
      return res.status(400).json({ error: 'Descrição, data e valor são obrigatórios' });
    }
    const propertyId = await resolveHarasPropertyId(req.user, b.propertyId);
    const [result] = await pool.execute(
      `INSERT INTO haras_finance_entries (property_id, entry_type, category, amount, entry_date, description, animal_id, stay_id, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        propertyId, entryType, b.category || 'outros', amount, entryDate, description,
        Number(b.animalId || 0) || null, Number(b.stayId || 0) || null, b.notes || null, req.user.id,
      ]
    );
    res.json({ success: true, id: String(result.insertId) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao lançar movimento' });
  }
});

app.put('/api/haras-finance/:id', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [curRows] = await pool.execute('SELECT * FROM haras_finance_entries WHERE id = ?', [id]);
    const cur = curRows[0];
    if (!cur) return res.status(404).json({ error: 'Lançamento não encontrado' });
    const b = req.body || {};
    const entryType = b.entryType === 'receita' || b.entryType === 'despesa' ? b.entryType : cur.entry_type;
    const propertyId = b.propertyId !== undefined
      ? await resolveHarasPropertyId(req.user, b.propertyId)
      : (cur.property_id || await resolveHarasPropertyId(req.user, 0));
    await pool.execute(
      'UPDATE haras_finance_entries SET property_id=?, entry_type=?, category=?, amount=?, entry_date=?, description=?, animal_id=?, stay_id=?, notes=? WHERE id=?',
      [
        propertyId, entryType, b.category || cur.category, Number(b.amount ?? cur.amount), b.entryDate || cur.entry_date,
        b.description || cur.description,
        b.animalId !== undefined ? Number(b.animalId || 0) || null : cur.animal_id,
        b.stayId !== undefined ? Number(b.stayId || 0) || null : cur.stay_id,
        b.notes !== undefined ? b.notes || null : cur.notes, id,
      ]
    );
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar lançamento' });
  }
});

app.delete('/api/haras-finance/:id', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const [result] = await pool.execute('DELETE FROM haras_finance_entries WHERE id = ?', [Number(req.params.id)]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Lançamento não encontrado' });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao excluir lançamento' });
  }
});

function mapDailyReportRow(r) {
  const data = r.data;
  let dataLabel = data;
  if (data && /^\d{4}-\d{2}-\d{2}$/.test(String(data))) {
    const [y, m, d] = String(data).split('-');
    dataLabel = `${d}/${m}/${y}`;
  }
  return {
    id: String(r.id),
    userId: r.user_id ? String(r.user_id) : null,
    data,
    dataLabel,
    colaboradora: r.colaboradora,
    numAtendimentos: r.num_atendimentos,
    todosClientesRespondidos: !!r.todos_clientes_respondidos,
    clientesPendentes: r.clientes_pendentes || '',
    ocorrencias: {
      clienteIrritado: !!r.cliente_irritado,
      cobrancaIndevida: !!r.cobranca_indevida,
      questionamentoFinanceiro: !!r.questionamento_financeiro,
      contestacaoRegras: !!r.contestacao_regras,
      escaladoGestao: !!r.escalado_gestao,
      nenhumaCritica: !!r.nenhuma_critica,
    },
    suporteGestao: !!r.suporte_gestao,
    suporteColegas: !!r.suporte_colegas,
    motivoSuporte: r.motivo_suporte || '',
    autoavaliacao: r.autoavaliacao,
    compromissosAmanha: r.compromissos_amanha || '',
    declaracao: !!r.declaracao,
    timestamp: r.created_at,
    createdAt: r.created_at,
  };
}

function parseDailyReportDate(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

function canManageAllDailyReports(user) {
  return user.role === 'root' || user.role === 'admin';
}

function todayIsoBr() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

app.get('/api/daily-reports/today', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const today = todayIsoBr();
    const [rows] = await pool.execute(
      'SELECT * FROM daily_reports WHERE user_id = ? AND data = ? LIMIT 1',
      [req.user.id, today]
    );
    const row = rows[0];
    res.json({ submitted: !!row, report: row ? mapDailyReportRow(row) : null });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Tabela de registro diário não disponível — rode database/migration-daily-reports.sql' });
  }
});

app.get('/api/daily-reports', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    let sql = 'SELECT * FROM daily_reports WHERE 1=1';
    const params = [];
    if (!canManageAllDailyReports(req.user)) {
      sql += ' AND user_id = ?';
      params.push(req.user.id);
    } else if (req.query.userId) {
      sql += ' AND user_id = ?';
      params.push(Number(req.query.userId));
    }
    const q = String(req.query.q || '').trim();
    if (q && canManageAllDailyReports(req.user)) {
      sql += ' AND colaboradora LIKE ?';
      params.push(`%${q}%`);
    }
    if (req.query.from) {
      const from = parseDailyReportDate(req.query.from);
      if (from) {
        sql += ' AND data >= ?';
        params.push(from);
      }
    }
    if (req.query.to) {
      const to = parseDailyReportDate(req.query.to);
      if (to) {
        sql += ' AND data <= ?';
        params.push(to);
      }
    }
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
    sql += ` ORDER BY data DESC, id DESC LIMIT ${limit}`;
    const [rows] = await pool.execute(sql, params);
    res.json(rows.map(mapDailyReportRow));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Tabela de registro diário não disponível — rode database/migration-daily-reports.sql' });
  }
});

app.get('/api/daily-reports/:id', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    if (req.params.id === 'today') return res.status(404).json({ error: 'Use /daily-reports/today' });
    const [rows] = await pool.execute('SELECT * FROM daily_reports WHERE id = ? LIMIT 1', [
      Number(req.params.id),
    ]);
    const row = rows[0];
    if (!row) return res.status(404).json({ error: 'Registro não encontrado' });
    if (!canManageAllDailyReports(req.user) && Number(row.user_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    res.json(mapDailyReportRow(row));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao carregar registro' });
  }
});

app.post('/api/daily-reports', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const body = req.body || {};
    let reportDate = parseDailyReportDate(body.reportDate || body.data);
    if (!reportDate) reportDate = todayIsoBr();
    const numAtendimentos = String(body.numAtendimentos || body.num_atendimentos || '').trim();
    const autoavaliacao = String(body.autoavaliacao || '').trim();
    const declaracao = !!body.declaracao;
    if (!numAtendimentos) return res.status(400).json({ error: 'Informe o número de atendimentos' });
    if (!autoavaliacao) return res.status(400).json({ error: 'Informe a autoavaliação' });
    if (!declaracao) return res.status(400).json({ error: 'Confirme a declaração para finalizar' });
    const allowedBands = ['Até 10', '11 a 20', '21 a 30', 'Acima de 30'];
    if (!allowedBands.includes(numAtendimentos)) {
      return res.status(400).json({ error: 'Faixa de atendimentos inválida' });
    }
    const allowedRatings = ['Excelente', 'Bom', 'Regular', 'Precisa melhorar'];
    if (!allowedRatings.includes(autoavaliacao)) {
      return res.status(400).json({ error: 'Autoavaliação inválida' });
    }
    const oc = body.ocorrencias && typeof body.ocorrencias === 'object' ? body.ocorrencias : {};
    const todosOk = !!body.todosClientesRespondidos;
    const pendentes = String(body.clientesPendentes || '').trim();
    if (!todosOk && !pendentes) {
      return res.status(400).json({ error: 'Descreva o motivo dos clientes pendentes' });
    }
    const suporteGestao = !!body.suporteGestao;
    const suporteColegas = !!body.suporteColegas;
    const motivoSuporte = String(body.motivoSuporte || '').trim();
    if ((suporteGestao || suporteColegas) && !motivoSuporte) {
      return res.status(400).json({ error: 'Informe o motivo do suporte acionado' });
    }
    const [userRows] = await pool.execute('SELECT name FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    const colaboradora = String(userRows[0]?.name || body.colaboradora || '').trim();
    if (!colaboradora) return res.status(400).json({ error: 'Nome do usuário indisponível' });

    const [dupRows] = await pool.execute(
      'SELECT id FROM daily_reports WHERE user_id = ? AND data = ? LIMIT 1',
      [req.user.id, reportDate]
    );
    if (dupRows[0]) {
      return res.status(409).json({ error: 'Você já registrou o atendimento desta data' });
    }

    const [result] = await pool.execute(
      `INSERT INTO daily_reports (
        user_id, data, colaboradora, num_atendimentos, todos_clientes_respondidos, clientes_pendentes,
        cliente_irritado, cobranca_indevida, questionamento_financeiro, contestacao_regras, escalado_gestao, nenhuma_critica,
        suporte_gestao, suporte_colegas, motivo_suporte, autoavaliacao, compromissos_amanha, declaracao
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        reportDate,
        colaboradora,
        numAtendimentos,
        todosOk ? 1 : 0,
        todosOk ? null : pendentes || null,
        oc.clienteIrritado ? 1 : 0,
        oc.cobrancaIndevida ? 1 : 0,
        oc.questionamentoFinanceiro ? 1 : 0,
        oc.contestacaoRegras ? 1 : 0,
        oc.escaladoGestao ? 1 : 0,
        oc.nenhumaCritica ? 1 : 0,
        suporteGestao ? 1 : 0,
        suporteColegas ? 1 : 0,
        motivoSuporte || null,
        autoavaliacao,
        String(body.compromissosAmanha || '').trim() || null,
        1,
      ]
    );
    res.json({ success: true, id: String(result.insertId) });
  } catch (error) {
    console.error(error);
    if (error && error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Você já registrou o atendimento desta data' });
    }
    res.status(500).json({ error: 'Erro ao salvar registro diário' });
  }
});

app.delete('/api/daily-reports/:id', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM daily_reports WHERE id = ? LIMIT 1', [
      Number(req.params.id),
    ]);
    const row = rows[0];
    if (!row) return res.status(404).json({ error: 'Registro não encontrado' });
    if (!canManageAllDailyReports(req.user) && Number(row.user_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'Você não pode excluir este registro' });
    }
    await pool.execute('DELETE FROM daily_reports WHERE id = ?', [Number(req.params.id)]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao excluir registro' });
  }
});

function loadGroqConfig() {
  let apiKey = process.env.GROQ_API_KEY || '';
  let model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  try {
    const php = fs.readFileSync(path.join(__dirname, 'config.local.php'), 'utf8');
    const k = php.match(/'groq_api_key'\s*=>\s*'([^']*)'/);
    const m = php.match(/'groq_model'\s*=>\s*'([^']*)'/);
    if (!apiKey && k?.[1]) apiKey = k[1];
    if (m?.[1]) model = m[1];
  } catch {
    /* optional */
  }
  if (!apiKey) {
    const err = new Error('Assistente IA não configurado (groq_api_key em config.local.php)');
    err.status = 503;
    throw err;
  }
  return { apiKey, model };
}

async function groqAssistantChat(systemPrompt, messages) {
  const { apiKey, model } = loadGroqConfig();
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      temperature: 0.35,
      max_tokens: 900,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || 'Falha no serviço de IA';
    const err = new Error(msg);
    err.status = 502;
    throw err;
  }
  const reply = String(data?.choices?.[0]?.message?.content || '').trim();
  if (!reply) {
    const err = new Error('Resposta vazia do assistente');
    err.status = 502;
    throw err;
  }
  return reply;
}

app.post('/api/ai-assistant', auth(), async (req, res) => {
  try {
    const body = req.body || {};
    const incoming = Array.isArray(body.messages) ? body.messages : [];
    const messages = [];
    for (const m of incoming.slice(-16)) {
      const role = m?.role;
      let content = String(m?.content || '').trim();
      if (!['user', 'assistant'].includes(role) || !content) continue;
      if (content.length > 4000) content = content.slice(0, 4000);
      messages.push({ role, content });
    }
    if (!messages.length || messages[messages.length - 1].role !== 'user') {
      return res.status(400).json({ error: 'Envie uma mensagem válida' });
    }

    let context = String(body.context || '').trim();
    if (context.length > 28000) context = context.slice(0, 28000);
    const userName = String(body.userName || req.user?.name || '').trim();
    const userRole = String(body.userRole || req.user?.role || '').trim();

    const system = [
      'Você é o Assistente Ariane, copiloto do sistema Gestão de Haras (assessoria equestre).',
      'Responda SEMPRE em português do Brasil, de forma clara, cordial e objetiva.',
      'Use SOMENTE o contexto abaixo sobre o sistema. Não invente dados de clientes, valores, contratos ou prazos.',
      'Se a pergunta não estiver no contexto, diga que não tem essa informação e sugira Suporte técnico ou a equipe da assessoria.',
      'Não dê conselho jurídico ou financeiro.',
      'Quando orientar o usuário a abrir uma tela, inclua NO FINAL da resposta exatamente um botão no formato: [LINK:/app/rota|Texto do botão]',
      `Usuário logado: ${userName || 'equipe'} (perfil: ${userRole || 'user'}).`,
      '',
      '--- CONTEXTO ---',
      context || '(sem contexto adicional)',
    ].join('\n');

    const reply = await groqAssistantChat(system, messages);
    const userQuestion = messages[messages.length - 1].content;
    const preview =
      userQuestion.length > 120 ? `${userQuestion.slice(0, 117)}...` : userQuestion;
    await auditLog(
      req,
      req.user,
      'assistant_query',
      'ai_assistant',
      String(req.user?.id || ''),
      `Assistente IA: ${preview}`,
      true,
      { pergunta: userQuestion.slice(0, 500) }
    );
    res.json({ reply });
  } catch (error) {
    console.error(error);
    const userQuestion = String(
      (Array.isArray(req.body?.messages) ? req.body.messages : [])
        .filter((m) => m?.role === 'user')
        .pop()?.content || ''
    ).trim();
    if (userQuestion && req.user) {
      const preview =
        userQuestion.length > 120 ? `${userQuestion.slice(0, 117)}...` : userQuestion;
      await auditLog(
        req,
        req.user,
        'assistant_query',
        'ai_assistant',
        String(req.user.id),
        `Assistente IA (falhou): ${preview}`,
        false,
        { pergunta: userQuestion.slice(0, 500), erro: error.message || 'Erro no assistente' }
      );
    }
    res.status(error.status || 500).json({ error: error.message || 'Erro no assistente' });
  }
});

function chatCanMessage(auth, target) {
  if (Number(auth?.id) === Number(target?.id)) return false;
  if (!target?.active) return false;
  if (['root', 'admin', 'user'].includes(auth?.role)) return true;
  if (auth?.role === 'cliente') return ['root', 'admin', 'user'].includes(target?.role);
  return false;
}

function chatMapUser(r) {
  return {
    id: String(r.id),
    name: r.name,
    username: r.username,
    role: r.role,
    avatarUrl: r.avatar_url || null,
  };
}

function chatMapMessage(r, viewerId) {
  return {
    id: String(r.id),
    threadId: String(r.thread_id),
    senderUserId: String(r.sender_user_id),
    senderName: r.sender_name || '',
    body: r.body,
    createdAt: r.created_at,
    mine: Number(r.sender_user_id) === viewerId,
  };
}

function chatDmKey(a, b) {
  const x = Math.min(a, b);
  const y = Math.max(a, b);
  return `${x}_${y}`;
}

async function chatRequireParticipant(threadId, userId) {
  const [rows] = await pool.execute(
    'SELECT 1 FROM chat_participants WHERE thread_id = ? AND user_id = ? LIMIT 1',
    [threadId, userId]
  );
  if (!rows.length) {
    const err = new Error('Conversa não encontrada');
    err.status = 404;
    throw err;
  }
}

async function chatOtherParticipant(threadId, userId) {
  const [rows] = await pool.execute(
    `SELECT u.id, u.name, u.username, u.role, u.avatar_url
     FROM chat_participants cp
     INNER JOIN users u ON u.id = cp.user_id
     WHERE cp.thread_id = ? AND cp.user_id != ?
     LIMIT 1`,
    [threadId, userId]
  );
  return rows[0] ? chatMapUser(rows[0]) : null;
}

async function chatPeerLastReadAt(threadId, viewerId) {
  const [rows] = await pool.execute(
    `SELECT cp.last_read_at
     FROM chat_participants cp
     WHERE cp.thread_id = ? AND cp.user_id != ?
     LIMIT 1`,
    [threadId, viewerId]
  );
  const at = rows[0]?.last_read_at;
  return at ? String(at) : null;
}

async function chatFindOrCreateThread(userId, otherUserId) {
  const dmKey = chatDmKey(userId, otherUserId);
  const [existing] = await pool.execute('SELECT id FROM chat_threads WHERE dm_key = ? LIMIT 1', [dmKey]);
  if (existing.length) return Number(existing[0].id);
  const [ins] = await pool.execute("INSERT INTO chat_threads (thread_type, dm_key) VALUES ('direct', ?)", [dmKey]);
  const threadId = ins.insertId;
  await pool.execute('INSERT INTO chat_participants (thread_id, user_id) VALUES (?, ?), (?, ?)', [
    threadId,
    userId,
    threadId,
    otherUserId,
  ]);
  return threadId;
}

app.post('/api/presence/heartbeat', auth(), async (req, res) => {
  try {
    await userTouchPresence(Number(req.user.id));
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar presença' });
  }
});

app.get('/api/root/online', auth(['root']), async (req, res) => {
  try {
    const minutes = Math.min(30, Math.max(1, Number(req.query.minutes) || 5));
    const [rows] = await pool.execute(
      `SELECT id, username, name, avatar_url, role, last_seen_at
       FROM users
       WHERE active = 1
         AND last_seen_at IS NOT NULL
         AND last_seen_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
       ORDER BY last_seen_at DESC
       LIMIT 200`,
      [minutes]
    );
    res.json({ items: rows.map(mapOnlineUser), onlineMinutes: minutes });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Painel Root indisponível — rode database/migration-user-presence.sql' });
  }
});

app.get('/api/root/access-log', auth(['root']), async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const [[countRow]] = await pool.execute('SELECT COUNT(*) AS total FROM user_access_log');
    const [rows] = await pool.execute(
      `SELECT l.*, u.name AS user_name, u.avatar_url
       FROM user_access_log l
       LEFT JOIN users u ON u.id = l.user_id
       ORDER BY l.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    res.json({
      items: rows.map(mapAccessLogRow),
      page,
      limit,
      total: Number(countRow?.total || 0),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Painel Root indisponível — rode database/migration-user-presence.sql' });
  }
});

app.get('/api/root/usage-metrics', auth(['root']), async (req, res) => {
  try {
    res.json(await rootUsageMetrics(req.query.days));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Métricas indisponíveis — rode database/migration-user-presence.sql' });
  }
});

app.post('/api/root/force-logout/:userId', auth(['root']), async (req, res) => {
  try {
    const targetId = Number(req.params.userId);
    if (!targetId) return res.status(400).json({ error: 'Usuário inválido' });
    const [users] = await pool.execute(
      'SELECT id, username, name, role FROM users WHERE id = ? LIMIT 1',
      [targetId]
    );
    const target = users[0];
    if (!target) return res.status(404).json({ error: 'Usuário não encontrado' });
    await userForceLogout(targetId);
    await auditLog(
      req,
      req.user,
      'status_change',
      'users',
      String(targetId),
      `Sessão encerrada remotamente: ${target.name || target.username}`
    );
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Não foi possível encerrar a sessão — rode database/migration-user-session.sql' });
  }
});

app.get('/api/chat/contacts', auth(), async (req, res) => {
  try {
    const authId = Number(req.user.id);
    const q = String(req.query.q || '').trim();
    let sql = 'SELECT id, username, name, avatar_url, role, active FROM users WHERE active = 1 AND id != ?';
    const params = [authId];
    if (q) {
      sql += ' AND (name LIKE ? OR username LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like);
    }
    sql += ' ORDER BY name ASC LIMIT 200';
    const [rows] = await pool.execute(sql, params);
    res.json({ items: rows.filter((r) => chatCanMessage(req.user, r)).map(chatMapUser) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Chat indisponível — rode database/migration-chat.sql' });
  }
});

app.get('/api/chat/unread-count', auth(), async (req, res) => {
  try {
    const authId = Number(req.user.id);
    const [rows] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM chat_messages cm
       INNER JOIN chat_participants cp ON cp.thread_id = cm.thread_id AND cp.user_id = ?
       WHERE cm.sender_user_id != ?
         AND cm.created_at > COALESCE(cp.last_read_at, '1970-01-01 00:00:00')`,
      [authId, authId]
    );
    res.json({ count: Number(rows[0]?.total || 0) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao contar mensagens' });
  }
});

app.get('/api/chat/threads', auth(), async (req, res) => {
  try {
    const authId = Number(req.user.id);
    const [rows] = await pool.execute(
      `SELECT t.id, t.last_message_at,
              (SELECT body FROM chat_messages WHERE thread_id = t.id ORDER BY created_at DESC LIMIT 1) AS last_body,
              (SELECT COUNT(*) FROM chat_messages cm
               WHERE cm.thread_id = t.id AND cm.sender_user_id != ?
                 AND cm.created_at > COALESCE(cp.last_read_at, '1970-01-01 00:00:00')) AS unread_count
       FROM chat_threads t
       INNER JOIN chat_participants cp ON cp.thread_id = t.id AND cp.user_id = ?
       ORDER BY COALESCE(t.last_message_at, t.created_at) DESC
       LIMIT 100`,
      [authId, authId]
    );
    const items = [];
    for (const row of rows) {
      const peer = await chatOtherParticipant(Number(row.id), authId);
      if (!peer) continue;
      items.push({
        id: String(row.id),
        peer,
        lastMessage: row.last_body || null,
        lastMessageAt: row.last_message_at,
        unreadCount: Number(row.unread_count || 0),
      });
    }
    res.json({ items });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Chat indisponível — rode database/migration-chat.sql' });
  }
});

app.post('/api/chat/threads', auth(), async (req, res) => {
  try {
    const authId = Number(req.user.id);
    const otherId = Number(req.body?.userId || 0);
    if (!otherId) return res.status(400).json({ error: 'Informe o usuário' });
    const [users] = await pool.execute(
      'SELECT id, username, name, avatar_url, role, active FROM users WHERE id = ? LIMIT 1',
      [otherId]
    );
    const target = users[0];
    if (!target) return res.status(404).json({ error: 'Usuário não encontrado' });
    if (!chatCanMessage(req.user, target)) {
      return res.status(403).json({ error: 'Sem permissão para conversar com este usuário' });
    }
    const threadId = await chatFindOrCreateThread(authId, otherId);
    res.json({
      thread: {
        id: String(threadId),
        peer: chatMapUser(target),
        lastMessage: null,
        lastMessageAt: null,
        unreadCount: 0,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao iniciar conversa' });
  }
});

app.get('/api/chat/threads/:threadId/messages', auth(), async (req, res) => {
  try {
    const authId = Number(req.user.id);
    const threadId = Number(req.params.threadId);
    await chatRequireParticipant(threadId, authId);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const before = String(req.query.before || '').trim();
    let sql = `SELECT cm.*, u.name AS sender_name
               FROM chat_messages cm
               INNER JOIN users u ON u.id = cm.sender_user_id
               WHERE cm.thread_id = ?`;
    const params = [threadId];
    if (before && /^\d+$/.test(before)) {
      sql += ' AND cm.id < ?';
      params.push(Number(before));
    }
    sql += ` ORDER BY cm.created_at DESC LIMIT ${limit}`;
    const [rows] = await pool.execute(sql, params);
    const peer = await chatOtherParticipant(threadId, authId);
    res.json({
      items: rows.reverse().map((r) => chatMapMessage(r, authId)),
      peer,
      peerLastReadAt: await chatPeerLastReadAt(threadId, authId),
    });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ error: error.message || 'Erro ao carregar mensagens' });
  }
});

app.post('/api/chat/threads/:threadId/messages', auth(), async (req, res) => {
  try {
    const authId = Number(req.user.id);
    const threadId = Number(req.params.threadId);
    await chatRequireParticipant(threadId, authId);
    let text = String(req.body?.body || '').trim();
    if (!text) return res.status(400).json({ error: 'Mensagem vazia' });
    if (text.length > 4000) text = text.slice(0, 4000);
    const [ins] = await pool.execute(
      'INSERT INTO chat_messages (thread_id, sender_user_id, body) VALUES (?, ?, ?)',
      [threadId, authId, text]
    );
    const now = new Date();
    const mysqlNow = now.toISOString().slice(0, 19).replace('T', ' ');
    await pool.execute('UPDATE chat_threads SET last_message_at = ? WHERE id = ?', [mysqlNow, threadId]);
    await pool.execute('UPDATE chat_participants SET last_read_at = ? WHERE thread_id = ? AND user_id = ?', [
      mysqlNow,
      threadId,
      authId,
    ]);
    const preview = text.length > 120 ? `${text.slice(0, 117)}...` : text;
    await auditLog(req, req.user, 'create', 'chat', String(threadId), `Mensagem enviada: ${preview}`);
    const [rows] = await pool.execute(
      `SELECT cm.*, u.name AS sender_name FROM chat_messages cm
       INNER JOIN users u ON u.id = cm.sender_user_id WHERE cm.id = ? LIMIT 1`,
      [ins.insertId]
    );
    res.json({ message: chatMapMessage(rows[0], authId) });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ error: error.message || 'Erro ao enviar mensagem' });
  }
});

app.put('/api/chat/threads/:threadId/read', auth(), async (req, res) => {
  try {
    const authId = Number(req.user.id);
    const threadId = Number(req.params.threadId);
    await chatRequireParticipant(threadId, authId);
    const mysqlNow = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await pool.execute('UPDATE chat_participants SET last_read_at = ? WHERE thread_id = ? AND user_id = ?', [
      mysqlNow,
      threadId,
      authId,
    ]);
    res.json({
      success: true,
      peerLastReadAt: await chatPeerLastReadAt(threadId, authId),
    });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ error: error.message || 'Erro ao marcar como lida' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 API MVP na porta ${PORT}`);
  console.log(`📡 http://localhost:${PORT}/api`);
});
