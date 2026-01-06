<?php
/**
 * API PHP para Sistema Ariane
 * Use esta versão se a Hostinger não suportar Node.js
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Tratar requisições OPTIONS (CORS preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Configuração do banco de dados
$db_host = 'localhost';
$db_port = 3306;
$db_user = 'u179630068_ariane_user';
$db_password = '6hA;F:&u9vA';
$db_name = 'u179630068_sistema_ariane';

// Conectar ao banco
try {
    $pdo = new PDO(
        "mysql:host=$db_host;port=$db_port;dbname=$db_name;charset=utf8mb4",
        $db_user,
        $db_password,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]
    );
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Erro ao conectar com banco de dados: ' . $e->getMessage()]);
    exit;
}

// Obter a rota
$request_uri = $_SERVER['REQUEST_URI'];
$path = parse_url($request_uri, PHP_URL_PATH);
$path_parts = explode('/', trim($path, '/'));

// Rotas
$route = end($path_parts);
$method = $_SERVER['REQUEST_METHOD'];

// Health check
if ($route === 'health' && $method === 'GET') {
    try {
        $stmt = $pdo->query('SELECT 1 as test');
        $result = $stmt->fetch();
        echo json_encode(['status' => 'ok', 'database' => 'connected', 'test' => $result]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// Login
if ($route === 'login' && $method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $email = strtolower($data['email'] ?? '');
    $password = $data['password'] ?? '';

    if (empty($email) || empty($password)) {
        http_response_code(400);
        echo json_encode(['error' => 'Email e senha são obrigatórios']);
        exit;
    }

    try {
        $stmt = $pdo->prepare('SELECT id, name, email FROM users WHERE email = ? AND password = ?');
        $stmt->execute([$email, $password]);
        $user = $stmt->fetch();

        if (!$user) {
            http_response_code(401);
            echo json_encode(['error' => 'Email ou senha incorretos']);
            exit;
        }

        echo json_encode([
            'success' => true,
            'user' => [
                'id' => (string)$user['id'],
                'name' => $user['name'],
                'email' => $user['email']
            ]
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Erro ao fazer login']);
    }
    exit;
}

// Listar registros
if ($route === 'reports' && $method === 'GET') {
    $colaboradora = $_GET['colaboradora'] ?? null;

    try {
        if ($colaboradora) {
            $stmt = $pdo->prepare("
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
                WHERE colaboradora = ?
                ORDER BY timestamp DESC
            ");
            $stmt->execute([$colaboradora]);
        } else {
            $stmt = $pdo->query("
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
                ORDER BY timestamp DESC
            ");
        }

        $reports = $stmt->fetchAll();
        
        $formatted = array_map(function($row) {
            return [
                'id' => (string)$row['id'],
                'data' => $row['data'],
                'colaboradora' => $row['colaboradora'],
                'numAtendimentos' => $row['numAtendimentos'],
                'todosClientesRespondidos' => (bool)$row['todosClientesRespondidos'],
                'clientesPendentes' => $row['clientesPendentes'] ?? '',
                'ocorrencias' => [
                    'clienteIrritado' => (bool)$row['clienteIrritado'],
                    'cobrancaIndevida' => (bool)$row['cobrancaIndevida'],
                    'questionamentoFinanceiro' => (bool)$row['questionamentoFinanceiro'],
                    'contestacaoRegras' => (bool)$row['contestacaoRegras'],
                    'escaladoGestao' => (bool)$row['escaladoGestao'],
                    'nenhumaCritica' => (bool)$row['nenhumaCritica']
                ],
                'suporteGestao' => (bool)$row['suporteGestao'],
                'suporteColegas' => (bool)$row['suporteColegas'],
                'motivoSuporte' => $row['motivoSuporte'] ?? '',
                'autoavaliacao' => $row['autoavaliacao'],
                'compromissosAmanha' => $row['compromissosAmanha'] ?? '',
                'declaracao' => (bool)$row['declaracao'],
                'timestamp' => date('c', $row['timestamp'] / 1000)
            ];
        }, $reports);

        echo json_encode($formatted);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Erro ao buscar registros']);
    }
    exit;
}

// Criar registro
if ($route === 'reports' && $method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);

    // Converter data de DD/MM/YYYY para YYYY-MM-DD
    $dataParts = explode('/', $data['data']);
    $dataFormatted = $dataParts[2] . '-' . $dataParts[1] . '-' . $dataParts[0];

    try {
        $stmt = $pdo->prepare("
            INSERT INTO daily_reports (
                data, colaboradora, num_atendimentos, todos_clientes_respondidos,
                clientes_pendentes, cliente_irritado, cobranca_indevida,
                questionamento_financeiro, contestacao_regras, escalado_gestao,
                nenhuma_critica, suporte_gestao, suporte_colegas, motivo_suporte,
                autoavaliacao, compromissos_amanha, declaracao
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");

        $stmt->execute([
            $dataFormatted,
            $data['colaboradora'],
            $data['numAtendimentos'],
            $data['todosClientesRespondidos'] ? 1 : 0,
            $data['clientesPendentes'] ?? null,
            $data['ocorrencias']['clienteIrritado'] ? 1 : 0,
            $data['ocorrencias']['cobrancaIndevida'] ? 1 : 0,
            $data['ocorrencias']['questionamentoFinanceiro'] ? 1 : 0,
            $data['ocorrencias']['contestacaoRegras'] ? 1 : 0,
            $data['ocorrencias']['escaladoGestao'] ? 1 : 0,
            $data['ocorrencias']['nenhumaCritica'] ? 1 : 0,
            $data['suporteGestao'] ? 1 : 0,
            $data['suporteColegas'] ? 1 : 0,
            $data['motivoSuporte'] ?? null,
            $data['autoavaliacao'],
            $data['compromissosAmanha'] ?? null,
            $data['declaracao'] ? 1 : 0
        ]);

        echo json_encode([
            'success' => true,
            'id' => (string)$pdo->lastInsertId(),
            'message' => 'Registro salvo com sucesso'
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Erro ao salvar registro: ' . $e->getMessage()]);
    }
    exit;
}

// Alterar senha
if ($route === 'change-password' && $method === 'PUT') {
    $data = json_decode(file_get_contents('php://input'), true);
    $userId = $data['userId'] ?? null;
    $currentPassword = $data['currentPassword'] ?? '';
    $newPassword = $data['newPassword'] ?? '';

    if (empty($userId) || empty($currentPassword) || empty($newPassword)) {
        http_response_code(400);
        echo json_encode(['error' => 'Todos os campos são obrigatórios']);
        exit;
    }

    if (strlen($newPassword) < 6) {
        http_response_code(400);
        echo json_encode(['error' => 'A nova senha deve ter pelo menos 6 caracteres']);
        exit;
    }

    try {
        // Verificar senha atual
        $stmt = $pdo->prepare('SELECT id, password FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        $user = $stmt->fetch();

        if (!$user) {
            http_response_code(404);
            echo json_encode(['error' => 'Usuário não encontrado']);
            exit;
        }

        if ($user['password'] !== $currentPassword) {
            http_response_code(401);
            echo json_encode(['error' => 'Senha atual incorreta']);
            exit;
        }

        // Atualizar senha
        $stmt = $pdo->prepare('UPDATE users SET password = ? WHERE id = ?');
        $stmt->execute([$newPassword, $userId]);

        echo json_encode([
            'success' => true,
            'message' => 'Senha alterada com sucesso'
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Erro ao alterar senha']);
    }
    exit;
}

// Deletar registro
if ($route === 'reports' && $method === 'DELETE') {
    $data = json_decode(file_get_contents('php://input'), true);
    $reportId = $data['id'] ?? $_GET['id'] ?? null;
    $colaboradora = $data['colaboradora'] ?? null;

    if (empty($reportId)) {
        http_response_code(400);
        echo json_encode(['error' => 'ID do registro é obrigatório']);
        exit;
    }

    try {
        // Verificar se o registro existe e se pertence à colaboradora (ou se é Ariane)
        $stmt = $pdo->prepare('SELECT id, colaboradora FROM daily_reports WHERE id = ?');
        $stmt->execute([$reportId]);
        $report = $stmt->fetch();

        if (!$report) {
            http_response_code(404);
            echo json_encode(['error' => 'Registro não encontrado']);
            exit;
        }

        // Verificar permissão: apenas o próprio autor ou Ariane pode deletar
        if ($colaboradora && $report['colaboradora'] !== $colaboradora && $colaboradora !== 'Ariane') {
            http_response_code(403);
            echo json_encode(['error' => 'Você não tem permissão para deletar este registro']);
            exit;
        }

        // Deletar o registro
        $stmt = $pdo->prepare('DELETE FROM daily_reports WHERE id = ?');
        $stmt->execute([$reportId]);

        echo json_encode([
            'success' => true,
            'message' => 'Registro deletado com sucesso'
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Erro ao deletar registro']);
    }
    exit;
}

// Rota não encontrada
http_response_code(404);
echo json_encode(['error' => 'Rota não encontrada']);

