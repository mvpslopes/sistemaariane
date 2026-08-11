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

console.log('✅ Pool MySQL configurado');

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      clientId: user.client_id ?? null,
    },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}

function auth(requiredRoles = []) {
  return (req, res, next) => {
    try {
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : null;
      if (!token) {
        return res.status(401).json({ error: 'Não autenticado' });
      }
      const payload = jwt.verify(token, JWT_SECRET);
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

function mapUser(row) {
  return {
    id: String(row.id),
    username: row.username,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatar_url || null,
    role: row.role,
    clientId: row.client_id ? String(row.client_id) : null,
    active: Boolean(row.active),
    mustChangePassword: Boolean(row.must_change_password),
    permissions: permissionsForRole(row.role),
  };
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
  return role === 'root' || role === 'admin';
}

function canDelete(role) {
  return role === 'root' || role === 'admin';
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
  } catch {
    /* não interrompe operação principal */
  }
}

function mapAuditRow(r) {
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
    success: Boolean(r.success),
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

    const token = signToken(user);
    await auditLog(req, { id: user.id, username: user.username, role: user.role }, 'login', 'auth', String(user.id), 'Login realizado');
    res.json({ success: true, token, user: mapUser(user) });
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
    res.json({ user: mapUser(rows[0]) });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar usuário' });
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
    res.json({ success: true, user: mapUser(rows[0]) });
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

function mapChargeRow(c, today = new Date().toISOString().slice(0, 10)) {
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
  };
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

app.put('/api/clients/:id/access-user/password', auth(['root', 'admin']), async (req, res) => {
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

app.put('/api/clients/:id', auth(['root', 'admin']), async (req, res) => {
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

app.delete('/api/clients/:id', auth(['root', 'admin']), async (req, res) => {
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

app.delete('/api/clients/:id/documents/:docId', auth(['root', 'admin']), async (req, res) => {
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

app.put('/api/clients/:id/properties/:propId', auth(['root', 'admin']), async (req, res) => {
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

app.delete('/api/clients/:id/properties/:propId', auth(['root', 'admin']), async (req, res) => {
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

app.put('/api/clients/:id/bank-accounts/:accId', auth(['root', 'admin']), async (req, res) => {
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

app.delete('/api/clients/:id/bank-accounts/:accId', auth(['root', 'admin']), async (req, res) => {
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

app.put('/api/clients/:id/contacts/:contactId', auth(['root', 'admin']), async (req, res) => {
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

app.delete('/api/clients/:id/contacts/:contactId', auth(['root', 'admin']), async (req, res) => {
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

app.put('/api/animals/:id', auth(['root', 'admin']), async (req, res) => {
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

app.delete('/api/animals/:id', auth(['root', 'admin']), async (req, res) => {
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

app.put('/api/contracts/:id', auth(['root', 'admin']), async (req, res) => {
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
  const json = await res.json().catch(() => ({}));
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
  const title = String(contract.template_title || '').trim() || 'Nota de Leilão e Contrato';

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

app.post('/api/contracts/:id/clicksign/cancel', auth(['root', 'admin']), async (req, res) => {
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
       SET clicksign_envelope_id=NULL, clicksign_document_id=NULL, clicksign_status=NULL, clicksign_sent_at=NULL, status=?
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

app.post('/api/contracts/:id/clicksign/notify', auth(['root', 'admin']), async (req, res) => {
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

app.post('/api/contracts/:id/clicksign', auth(['root', 'admin']), async (req, res) => {
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
       SET clicksign_envelope_id=?, clicksign_document_id=?, clicksign_status=?, clicksign_sent_at=NOW(), status='aguardando_assinatura'
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
    let sql = `SELECT ch.*, a.name AS animal_name, c.status AS contract_status, cl.name AS client_name
               FROM charges ch
               INNER JOIN contracts c ON c.id = ch.contract_id
               INNER JOIN animals a ON a.id = c.animal_id
               INNER JOIN clients cl ON cl.id = ch.client_id
               WHERE 1=1`;
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

app.put('/api/charges/:id', auth(['root', 'admin']), async (req, res) => {
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

app.get('/api/auctions', auth(), async (req, res) => {
  try {
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

app.put('/api/auctions/:id', auth(['root', 'admin']), async (req, res) => {
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

app.put('/api/auction-lots/:id', auth(['root', 'admin']), async (req, res) => {
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

app.put('/api/payouts/:id', auth(['root', 'admin']), async (req, res) => {
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
        title || 'NOTA DE LEILÃO E CONTRATO COM RESERVA DE DOMÍNIO',
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

app.put('/api/contract-templates/:id', auth(['root', 'admin']), async (req, res) => {
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
    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];
    if (req.query.userId) {
      sql += ' AND user_id = ?';
      params.push(Number(req.query.userId));
    }
    if (req.query.action) {
      sql += ' AND action = ?';
      params.push(String(req.query.action));
    }
    if (req.query.resource) {
      sql += ' AND resource = ?';
      params.push(String(req.query.resource));
    }
    if (req.query.from) {
      sql += ' AND created_at >= ?';
      params.push(`${String(req.query.from)} 00:00:00`);
    }
    if (req.query.to) {
      sql += ' AND created_at <= ?';
      params.push(`${String(req.query.to)} 23:59:59`);
    }
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
    sql += ` ORDER BY created_at DESC LIMIT ${limit}`;
    const [rows] = await pool.execute(sql, params);
    res.json(rows.map(mapAuditRow));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao listar auditoria' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 API MVP na porta ${PORT}`);
  console.log(`📡 http://localhost:${PORT}/api`);
});
