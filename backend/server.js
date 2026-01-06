import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Configuração do banco de dados
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Pool de conexões
let pool;

try {
  pool = mysql.createPool(dbConfig);
  console.log('✅ Conexão com banco de dados configurada');
} catch (error) {
  console.error('❌ Erro ao conectar com banco de dados:', error);
}

// Rota de teste
app.get('/api/health', async (req, res) => {
  try {
    if (!pool) {
      return res.status(500).json({ error: 'Banco de dados não configurado' });
    }
    const [rows] = await pool.execute('SELECT 1 as test');
    res.json({ status: 'ok', database: 'connected', test: rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rota de login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const [rows] = await pool.execute(
      'SELECT id, name, email FROM users WHERE email = ? AND password = ?',
      [email.toLowerCase(), password]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }

    const user = rows[0];
    res.json({
      success: true,
      user: {
        id: user.id.toString(),
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

// Rota para obter todos os registros
app.get('/api/reports', async (req, res) => {
  try {
    const { colaboradora } = req.query;

    let query = `
      SELECT 
        id,
        DATE_FORMAT(data, '%d/%m/%Y') as data,
        colaboradora,
        num_atendimentos as numAtendimentos,
        todos_clientes_respondidos as todosClientesRespondidos,
        clientes_pendentes as clientesPendentes,
        cliente_irritado as clienteIrritado,
        cobranca_indevida as cobrancaIndevida,
        questionamento_financeiro as questionamentoFinanceiro,
        contestacao_regras as contestacaoRegras,
        escalado_gestao as escaladoGestao,
        nenhuma_critica as nenhumaCritica,
        suporte_gestao as suporteGestao,
        suporte_colegas as suporteColegas,
        motivo_suporte as motivoSuporte,
        autoavaliacao,
        compromissos_amanha as compromissosAmanha,
        declaracao,
        UNIX_TIMESTAMP(timestamp) * 1000 as timestamp
      FROM daily_reports
    `;

    const params = [];

    if (colaboradora) {
      query += ' WHERE colaboradora = ?';
      params.push(colaboradora);
    }

    query += ' ORDER BY timestamp DESC';

    const [rows] = await pool.execute(query, params);

    const reports = rows.map(row => ({
      id: row.id.toString(),
      data: row.data,
      colaboradora: row.colaboradora,
      numAtendimentos: row.numAtendimentos,
      todosClientesRespondidos: Boolean(row.todosClientesRespondidos),
      clientesPendentes: row.clientesPendentes || '',
      ocorrencias: {
        clienteIrritado: Boolean(row.clienteIrritado),
        cobrancaIndevida: Boolean(row.cobrancaIndevida),
        questionamentoFinanceiro: Boolean(row.questionamentoFinanceiro),
        contestacaoRegras: Boolean(row.contestacaoRegras),
        escaladoGestao: Boolean(row.escaladoGestao),
        nenhumaCritica: Boolean(row.nenhumaCritica)
      },
      suporteGestao: Boolean(row.suporteGestao),
      suporteColegas: Boolean(row.suporteColegas),
      motivoSuporte: row.motivoSuporte || '',
      autoavaliacao: row.autoavaliacao,
      compromissosAmanha: row.compromissosAmanha || '',
      declaracao: Boolean(row.declaracao),
      timestamp: new Date(row.timestamp).toISOString()
    }));

    res.json(reports);
  } catch (error) {
    console.error('Erro ao buscar registros:', error);
    res.status(500).json({ error: 'Erro ao buscar registros' });
  }
});

// Rota para criar um registro
app.post('/api/reports', async (req, res) => {
  try {
    const {
      data,
      colaboradora,
      numAtendimentos,
      todosClientesRespondidos,
      clientesPendentes,
      ocorrencias,
      suporteGestao,
      suporteColegas,
      motivoSuporte,
      autoavaliacao,
      compromissosAmanha,
      declaracao
    } = req.body;

    // Converter data de DD/MM/YYYY para YYYY-MM-DD
    const dataParts = data.split('/');
    const dataFormatted = `${dataParts[2]}-${dataParts[1]}-${dataParts[0]}`;

    const [result] = await pool.execute(
      `INSERT INTO daily_reports (
        data, colaboradora, num_atendimentos, todos_clientes_respondidos,
        clientes_pendentes, cliente_irritado, cobranca_indevida,
        questionamento_financeiro, contestacao_regras, escalado_gestao,
        nenhuma_critica, suporte_gestao, suporte_colegas, motivo_suporte,
        autoavaliacao, compromissos_amanha, declaracao
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dataFormatted,
        colaboradora,
        numAtendimentos,
        todosClientesRespondidos ? 1 : 0,
        clientesPendentes || null,
        ocorrencias?.clienteIrritado ? 1 : 0,
        ocorrencias?.cobrancaIndevida ? 1 : 0,
        ocorrencias?.questionamentoFinanceiro ? 1 : 0,
        ocorrencias?.contestacaoRegras ? 1 : 0,
        ocorrencias?.escaladoGestao ? 1 : 0,
        ocorrencias?.nenhumaCritica ? 1 : 0,
        suporteGestao ? 1 : 0,
        suporteColegas ? 1 : 0,
        motivoSuporte || null,
        autoavaliacao,
        compromissosAmanha || null,
        declaracao ? 1 : 0
      ]
    );

    res.json({
      success: true,
      id: result.insertId.toString(),
      message: 'Registro salvo com sucesso'
    });
  } catch (error) {
    console.error('Erro ao salvar registro:', error);
    res.status(500).json({ error: 'Erro ao salvar registro' });
  }
});

// Rota para alterar senha
app.put('/api/change-password', async (req, res) => {
  try {
    const { userId, currentPassword, newPassword } = req.body;

    if (!userId || !currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres' });
    }

    // Verificar senha atual
    const [users] = await pool.execute(
      'SELECT id, password FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    if (users[0].password !== currentPassword) {
      return res.status(401).json({ error: 'Senha atual incorreta' });
    }

    // Atualizar senha
    await pool.execute(
      'UPDATE users SET password = ? WHERE id = ?',
      [newPassword, userId]
    );

    res.json({
      success: true,
      message: 'Senha alterada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    res.status(500).json({ error: 'Erro ao alterar senha' });
  }
});

// Rota para deletar registro
app.delete('/api/reports', async (req, res) => {
  try {
    const { id, colaboradora } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'ID do registro é obrigatório' });
    }

    // Verificar se o registro existe e se pertence à colaboradora
    const [reports] = await pool.execute(
      'SELECT id, colaboradora FROM daily_reports WHERE id = ?',
      [id]
    );

    if (reports.length === 0) {
      return res.status(404).json({ error: 'Registro não encontrado' });
    }

    const report = reports[0];

    // Verificar permissão: apenas o próprio autor ou Ariane pode deletar
    if (colaboradora && report.colaboradora !== colaboradora && colaboradora !== 'Ariane') {
      return res.status(403).json({ error: 'Você não tem permissão para deletar este registro' });
    }

    // Deletar o registro
    await pool.execute('DELETE FROM daily_reports WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Registro deletado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao deletar registro:', error);
    res.status(500).json({ error: 'Erro ao deletar registro' });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📡 API disponível em http://localhost:${PORT}/api`);
});

