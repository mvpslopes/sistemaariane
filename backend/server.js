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
fs.mkdirSync(animalsUploadsDir, { recursive: true });
fs.mkdirSync(avatarsUploadsDir, { recursive: true });

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'ariane_mvp_dev_secret';

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const kind = String(req.query.kind || req.body?.kind || 'animal').toLowerCase();
      cb(null, kind === 'avatar' ? avatarsUploadsDir : animalsUploadsDir);
    },
    filename: (req, file, cb) => {
      const kind = String(req.query.kind || 'animal').toLowerCase();
      const prefix = kind === 'avatar' ? 'avatar' : 'animal';
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype);
    cb(ok ? null : new Error('Formato inválido. Use JPG, PNG, WEBP ou GIF'), ok);
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
  };
}

function canManageUsers(role) {
  return role === 'root' || role === 'admin';
}

function canWriteData(role) {
  return ['root', 'admin', 'user'].includes(role);
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
      return res.status(401).json({ error: 'Usuário ou senha incorretos' });
    }

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Usuário ou senha incorretos' });
    }

    const token = signToken(user);
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
    const subdir = kind === 'avatar' ? 'avatars' : 'animals';
    res.json({
      success: true,
      url: `/uploads/${subdir}/${req.file.filename}`,
    });
  });
});

// Dashboard stats
app.get('/api/dashboard', auth(), async (req, res) => {
  try {
    const isCliente = req.user.role === 'cliente';

    if (isCliente && req.user.clientId) {
      const cid = req.user.clientId;
      const [[animals]] = await pool.execute(
        `SELECT COUNT(*) AS total FROM animals a
         INNER JOIN animal_owners ao ON ao.animal_id = a.id
         WHERE ao.client_id = ?`,
        [cid]
      );
      const [[activeAnimals]] = await pool.execute(
        `SELECT COUNT(*) AS total FROM animals a
         INNER JOIN animal_owners ao ON ao.animal_id = a.id
         WHERE ao.client_id = ? AND a.status = 'ativo'`,
        [cid]
      );
      const [[contracts]] = await pool.execute(
        `SELECT COUNT(*) AS total FROM contracts
         WHERE buyer_id = ? OR seller_id = ? OR assessor_id = ?`,
        [cid, cid, cid]
      );
      const [[contractsActive]] = await pool.execute(
        `SELECT COUNT(*) AS total FROM contracts
         WHERE (buyer_id = ? OR seller_id = ? OR assessor_id = ?) AND status = 'ativo'`,
        [cid, cid, cid]
      );
      const [[contractsAwaiting]] = await pool.execute(
        `SELECT COUNT(*) AS total FROM contracts
         WHERE (buyer_id = ? OR seller_id = ? OR assessor_id = ?) AND status = 'aguardando_assinatura'`,
        [cid, cid, cid]
      );
      const [[chargesPending]] = await pool.execute(
        `SELECT COUNT(*) AS total FROM charges WHERE client_id = ? AND status = 'pendente'`,
        [cid]
      );
      const [[chargesOverdue]] = await pool.execute(
        `SELECT COUNT(*) AS total FROM charges
         WHERE client_id = ? AND (status = 'atrasado' OR (status = 'pendente' AND due_date < CURDATE()))`,
        [cid]
      );
      const [[chargesPaid]] = await pool.execute(
        `SELECT COUNT(*) AS total FROM charges WHERE client_id = ? AND status = 'pago'`,
        [cid]
      );

      return res.json({
        clients: 1,
        buyers: 0,
        sellers: 0,
        assessors: 0,
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
    const [[animals]] = await pool.execute('SELECT COUNT(*) AS total FROM animals');
    const [[activeAnimals]] = await pool.execute(
      "SELECT COUNT(*) AS total FROM animals WHERE status = 'ativo'"
    );
    const [[contracts]] = await pool.execute('SELECT COUNT(*) AS total FROM contracts');
    const [[contractsActive]] = await pool.execute(
      "SELECT COUNT(*) AS total FROM contracts WHERE status = 'ativo'"
    );
    const [[contractsAwaiting]] = await pool.execute(
      "SELECT COUNT(*) AS total FROM contracts WHERE status = 'aguardando_assinatura'"
    );
    const [[chargesPending]] = await pool.execute(
      "SELECT COUNT(*) AS total FROM charges WHERE status = 'pendente'"
    );
    const [[chargesOverdue]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM charges
       WHERE status = 'atrasado' OR (status = 'pendente' AND due_date < CURDATE())`
    );
    const [[chargesPaid]] = await pool.execute(
      "SELECT COUNT(*) AS total FROM charges WHERE status = 'pago'"
    );
    const [[users]] = await pool.execute('SELECT COUNT(*) AS total FROM users WHERE active = 1');

    res.json({
      clients: clients.total,
      buyers: buyers.total,
      sellers: sellers.total,
      assessors: assessors.total,
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
  };
}

async function generateCharges(conn, contractId, buyerId, total, n, firstDue, method) {
  n = Math.max(1, Math.min(40, n));
  const base = Math.floor((total / n) * 100) / 100;
  await conn.execute('DELETE FROM charges WHERE contract_id = ?', [contractId]);
  let sum = 0;
  const due = new Date(firstDue + 'T12:00:00');
  for (let i = 1; i <= n; i++) {
    const amount = i === n ? Math.round((total - sum) * 100) / 100 : base;
    sum += amount;
    const dueStr = due.toISOString().slice(0, 10);
    await conn.execute(
      `INSERT INTO charges (contract_id, client_id, installment_no, amount, due_date, payment_method, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pendente')`,
      [contractId, buyerId, i, amount, dueStr, method]
    );
    due.setMonth(due.getMonth() + 1);
  }
}

function mapContract(r) {
  return {
    id: String(r.id),
    animal_id: String(r.animal_id),
    animal_name: r.animal_name || null,
    sale_type: r.sale_type,
    share_pct: r.share_pct != null ? Number(r.share_pct) : null,
    seller_id: String(r.seller_id),
    seller_name: r.seller_name || null,
    buyer_id: String(r.buyer_id),
    buyer_name: r.buyer_name || null,
    assessor_id: r.assessor_id ? String(r.assessor_id) : null,
    assessor_name: r.assessor_name || null,
    total_amount: Number(r.total_amount),
    payment_method: r.payment_method,
    installments: Number(r.installments),
    first_due_date: r.first_due_date,
    status: r.status,
    notes: r.notes,
    created_at: r.created_at || null,
  };
}

// Clients
app.get('/api/clients', auth(), async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const roleFilter = (req.query.role || '').trim();
    let sql = `SELECT * FROM clients WHERE 1=1`;
    const params = [];

    if (req.user.role === 'cliente') {
      if (!req.user.clientId) return res.json([]);
      sql += ' AND id = ?';
      params.push(req.user.clientId);
    }

    if (q) {
      sql += ' AND (name LIKE ? OR document LIKE ? OR email LIKE ? OR phone LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like, like, like);
    }
    if (roleFilter === 'seller') sql += ' AND is_seller = 1';
    if (roleFilter === 'buyer') sql += ' AND is_buyer = 1';
    if (roleFilter === 'assessor') sql += ' AND is_assessor = 1';

    sql += ' ORDER BY name ASC';
    const [rows] = await pool.execute(sql, params);
    res.json(rows.map(mapClient));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao listar clientes' });
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
      is_seller = false, is_buyer = true, is_assessor = false,
    } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: 'Nome é obrigatório' });

    const [result] = await pool.execute(
      `INSERT INTO clients
       (name, document_type, document, email, phone, whatsapp, city, state, address, notes, active, is_seller, is_buyer, is_assessor, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        document_type || 'CPF',
        document || null,
        email || null,
        phone || null,
        whatsapp || null,
        city || null,
        state || null,
        address || null,
        notes || null,
        active ? 1 : 0,
        is_seller ? 1 : 0,
        is_buyer ? 1 : 0,
        is_assessor ? 1 : 0,
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
      is_seller, is_buyer, is_assessor,
    } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: 'Nome é obrigatório' });

    await pool.execute(
      `UPDATE clients SET
        name=?, document_type=?, document=?, email=?, phone=?, whatsapp=?,
        city=?, state=?, address=?, notes=?, active=?, is_seller=?, is_buyer=?, is_assessor=?
       WHERE id=?`,
      [
        name.trim(),
        document_type || 'CPF',
        document || null,
        email || null,
        phone || null,
        whatsapp || null,
        city || null,
        state || null,
        address || null,
        notes || null,
        active === false ? 0 : 1,
        is_seller ? 1 : 0,
        is_buyer ? 1 : 0,
        is_assessor ? 1 : 0,
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
      sql += ` AND EXISTS (
        SELECT 1 FROM animal_owners ao2
        WHERE ao2.animal_id = a.id AND ao2.client_id = ?
      )`;
      params.push(req.user.clientId);
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
      const [own] = await pool.execute(
        'SELECT 1 FROM animal_owners WHERE animal_id = ? AND client_id = ?',
        [id, req.user.clientId]
      );
      if (!own.length) return res.status(403).json({ error: 'Sem permissão' });
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
    await conn.execute(
      `INSERT INTO animal_owners (animal_id, client_id, share_pct, is_primary)
       VALUES (?, ?, ?, ?)`,
      [
        animalId,
        Number(owner.clientId),
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

const contractSelect = `SELECT c.*, a.name AS animal_name,
    s.name AS seller_name, b.name AS buyer_name, ass.name AS assessor_name
  FROM contracts c
  INNER JOIN animals a ON a.id = c.animal_id
  INNER JOIN clients s ON s.id = c.seller_id
  INNER JOIN clients b ON b.id = c.buyer_id
  LEFT JOIN clients ass ON ass.id = c.assessor_id
  WHERE 1=1`;

app.get('/api/contracts', auth(), async (req, res) => {
  try {
    let sql = contractSelect;
    const params = [];
    if (req.user.role === 'cliente') {
      if (!req.user.clientId) return res.json([]);
      sql += ' AND (c.buyer_id = ? OR c.seller_id = ? OR c.assessor_id = ?)';
      params.push(req.user.clientId, req.user.clientId, req.user.clientId);
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
      if (Number(r.buyer_id) !== cid && Number(r.seller_id) !== cid && Number(r.assessor_id || 0) !== cid) {
        return res.status(403).json({ error: 'Sem permissão' });
      }
    }
    const [signatures] = await pool.execute('SELECT * FROM contract_signatures WHERE contract_id = ?', [id]);
    const [charges] = await pool.execute(
      'SELECT * FROM charges WHERE contract_id = ? ORDER BY installment_no ASC',
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
      charges: charges.map((c) => ({
        id: String(c.id),
        contract_id: String(c.contract_id),
        client_id: String(c.client_id),
        installment_no: Number(c.installment_no),
        amount: Number(c.amount),
        due_date: c.due_date,
        payment_method: c.payment_method,
        status: c.status,
        paid_at: c.paid_at,
        notes: c.notes,
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
      animalId, sellerId, buyerId, assessorId, saleType = 'inteiro', sharePct,
      totalAmount, paymentMethod = 'boleto', installments = 1, firstDueDate, notes,
    } = req.body;
    const n = Math.max(1, Math.min(40, Number(installments) || 1));
    const total = Number(totalAmount);
    if (!animalId || !sellerId || !buyerId || !(total > 0) || !firstDueDate) {
      return res.status(400).json({ error: 'Animal, vendedor, comprador, valor e 1º vencimento são obrigatórios' });
    }
    let share = sharePct;
    if (saleType === 'inteiro') share = 100;
    if (['fracao', 'condominio'].includes(saleType) && !(share > 0 && share <= 100)) {
      return res.status(400).json({ error: 'Informe o percentual da fração (1–100)' });
    }

    await conn.beginTransaction();
    const [result] = await conn.execute(
      `INSERT INTO contracts
       (animal_id, sale_type, share_pct, seller_id, buyer_id, assessor_id, total_amount, payment_method, installments, first_due_date, status, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aguardando_assinatura', ?, ?)`,
      [
        Number(animalId), saleType, share || null, Number(sellerId), Number(buyerId),
        assessorId ? Number(assessorId) : null, total, paymentMethod, n, firstDueDate,
        notes || null, req.user.id,
      ]
    );
    const contractId = result.insertId;
    await generateCharges(conn, contractId, Number(buyerId), total, n, firstDueDate, paymentMethod);
    await conn.commit();
    res.json({ success: true, id: String(contractId) });
  } catch (error) {
    await conn.rollback();
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar contrato' });
  } finally {
    conn.release();
  }
});

app.put('/api/contracts/:id', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status, notes } = req.body;
    const fields = [];
    const params = [];
    if (status) {
      fields.push('status=?');
      params.push(status);
    }
    if (notes !== undefined) {
      fields.push('notes=?');
      params.push(notes);
    }
    if (!fields.length) return res.status(400).json({ error: 'Nada para atualizar' });
    params.push(id);
    await pool.execute(`UPDATE contracts SET ${fields.join(',')} WHERE id=?`, params);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar contrato' });
  }
});

app.post('/api/contracts/:id/sign', auth(), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { partyRole, signerName, accepted } = req.body;
    if (!['seller', 'buyer', 'assessor'].includes(partyRole) || !String(signerName || '').trim() || !accepted) {
      return res.status(400).json({ error: 'Informe o papel, o nome e confirme o aceite' });
    }
    const [[contract]] = await pool.execute('SELECT * FROM contracts WHERE id = ?', [id]);
    if (!contract) return res.status(404).json({ error: 'Contrato não encontrado' });
    if (contract.status === 'cancelado') return res.status(400).json({ error: 'Contrato cancelado' });

    let clientId = null;
    if (partyRole === 'seller') clientId = Number(contract.seller_id);
    if (partyRole === 'buyer') clientId = Number(contract.buyer_id);
    if (partyRole === 'assessor') clientId = contract.assessor_id ? Number(contract.assessor_id) : null;
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
    if (req.query.status) {
      sql += ' AND ch.status = ?';
      params.push(req.query.status);
    }
    if (req.query.contractId) {
      sql += ' AND ch.contract_id = ?';
      params.push(Number(req.query.contractId));
    }
    if (req.query.clientId) {
      sql += ' AND ch.client_id = ?';
      params.push(Number(req.query.clientId));
    }
    sql += ' ORDER BY ch.due_date ASC, ch.installment_no ASC';
    const [rows] = await pool.execute(sql, params);
    const today = new Date().toISOString().slice(0, 10);
    res.json(
      rows.map((c) => {
        let status = c.status;
        if (status === 'pendente' && c.due_date < today) status = 'atrasado';
        return {
          id: String(c.id),
          contract_id: String(c.contract_id),
          client_id: String(c.client_id),
          client_name: c.client_name,
          animal_name: c.animal_name,
          installment_no: Number(c.installment_no),
          amount: Number(c.amount),
          due_date: c.due_date,
          payment_method: c.payment_method,
          status,
          paid_at: c.paid_at,
          notes: c.notes,
        };
      })
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao listar cobranças' });
  }
});

app.put('/api/charges/:id', auth(['root', 'admin', 'user']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status, notes } = req.body;
    if (!['pendente', 'pago', 'atrasado', 'cancelado'].includes(status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }
    const paidAt = status === 'pago' ? new Date() : null;
    await pool.execute('UPDATE charges SET status=?, paid_at=?, notes=? WHERE id=?', [
      status,
      paidAt,
      notes || null,
      id,
    ]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar cobrança' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 API MVP na porta ${PORT}`);
  console.log(`📡 http://localhost:${PORT}/api`);
});
