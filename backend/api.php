<?php
/**
 * API PHP - MVP Sistema Haras / Assessoria Ariane
 * Hostinger (sem Node.js)
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$configFile = __DIR__ . '/config.local.php';
if (file_exists($configFile)) {
    $config = require $configFile;
} else {
    http_response_code(500);
    echo json_encode([
        'error' => 'Configuração ausente',
        'hint' => 'Copie config.example.php para config.local.php e preencha as credenciais do banco.',
    ]);
    exit;
}

try {
    $pdo = new PDO(
        sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
            $config['db_host'],
            $config['db_port'],
            $config['db_name']
        ),
        $config['db_user'],
        $config['db_password'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Erro ao conectar com banco de dados',
        'detail' => $e->getMessage(),
        'hint' => 'Confira no hPanel se o usuário MySQL está vinculado ao banco e se a senha está correta. Abra /db-check.php para diagnóstico.',
    ]);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = preg_replace('#^.*/api\\.php#', '', $path);
$path = trim($path, '/');
$parts = $path === '' ? [] : explode('/', $path);
$resource = $parts[0] ?? '';
$id = $parts[1] ?? null;
$action = $parts[2] ?? null;
$subId = $parts[3] ?? null;
$body = json_decode(file_get_contents('php://input'), true) ?? [];

function base64url_encode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode($data) {
    return base64_decode(strtr($data, '-_', '+/'));
}

function sign_token(array $payload, string $secret): string {
    $header = base64url_encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payload['exp'] = time() + 12 * 60 * 60;
    $body = base64url_encode(json_encode($payload));
    $sig = base64url_encode(hash_hmac('sha256', "$header.$body", $secret, true));
    return "$header.$body.$sig";
}

function verify_token(string $token, string $secret): ?array {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    [$header, $body, $sig] = $parts;
    $expected = base64url_encode(hash_hmac('sha256', "$header.$body", $secret, true));
    if (!hash_equals($expected, $sig)) return null;
    $payload = json_decode(base64url_decode($body), true);
    if (!$payload || ($payload['exp'] ?? 0) < time()) return null;
    return $payload;
}

function request_authorization_header(): string {
    $candidates = [
        $_SERVER['HTTP_AUTHORIZATION'] ?? '',
        $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '',
        $_SERVER['Authorization'] ?? '',
    ];
    foreach ($candidates as $h) {
        if (is_string($h) && $h !== '') return $h;
    }
    if (function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        if (is_array($headers)) {
            foreach ($headers as $k => $v) {
                if (strcasecmp((string)$k, 'Authorization') === 0 && is_string($v) && $v !== '') {
                    return $v;
                }
            }
        }
    }
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        if (is_array($headers)) {
            foreach ($headers as $k => $v) {
                if (strcasecmp((string)$k, 'Authorization') === 0 && is_string($v) && $v !== '') {
                    return $v;
                }
            }
        }
    }
    return '';
}

function bearer_user(string $secret): ?array {
    $header = request_authorization_header();
    if (!preg_match('/Bearer\\s+(\\S+)/', $header, $m)) return null;
    $payload = verify_token($m[1], $secret);
    if (!$payload) return null;
    return [
        'id' => (int)$payload['id'],
        'username' => $payload['username'] ?? '',
        'role' => $payload['role'] ?? 'user',
        'clientId' => isset($payload['clientId']) && $payload['clientId'] !== null
            ? (int)$payload['clientId'] : null,
    ];
}

function require_auth(string $secret, array $roles = []): array {
    $user = bearer_user($secret);
    if (!$user) {
        http_response_code(401);
        echo json_encode(['error' => 'Não autenticado']);
        exit;
    }
    if ($roles && !in_array($user['role'], $roles, true)) {
        http_response_code(403);
        echo json_encode(['error' => 'Sem permissão']);
        exit;
    }
    return $user;
}

function map_user(array $row): array {
    return [
        'id' => (string)$row['id'],
        'username' => $row['username'],
        'email' => $row['email'],
        'name' => $row['name'],
        'avatarUrl' => $row['avatar_url'] ?? null,
        'role' => $row['role'],
        'clientId' => $row['client_id'] ? (string)$row['client_id'] : null,
        'active' => (bool)$row['active'],
        'mustChangePassword' => (bool)$row['must_change_password'],
    ];
}

function json_out($data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data);
    exit;
}

// Health
if ($resource === 'health' && $method === 'GET') {
    try {
        $pdo->query('SELECT 1');
        $hasUsers = false;
        try {
            $cnt = (int)$pdo->query('SELECT COUNT(*) AS t FROM users')->fetch()['t'];
            $hasUsers = true;
        } catch (PDOException $e) {
            $cnt = null;
        }
        json_out([
            'status' => 'ok',
            'database' => 'connected',
            'users_table' => $hasUsers,
            'users_count' => $cnt,
        ]);
    } catch (PDOException $e) {
        json_out(['error' => 'Falha no health', 'detail' => $e->getMessage()], 500);
    }
}

// Login
if ($resource === 'login' && $method === 'POST') {
    $login = trim($body['username'] ?? $body['email'] ?? '');
    $password = $body['password'] ?? '';
    if ($login === '' || $password === '') {
        json_out(['error' => 'Usuário e senha são obrigatórios'], 400);
    }

    $stmt = $pdo->prepare(
        'SELECT id, username, email, password_hash, name, avatar_url, role, client_id, active, must_change_password
         FROM users WHERE (username = ? OR email = ?) AND active = 1 LIMIT 1'
    );
    $stmt->execute([$login, strtolower($login)]);
    $user = $stmt->fetch();
    if (!$user || !password_verify($password, $user['password_hash'])) {
        json_out(['error' => 'Usuário ou senha incorretos'], 401);
    }

    $token = sign_token([
        'id' => (int)$user['id'],
        'username' => $user['username'],
        'role' => $user['role'],
        'clientId' => $user['client_id'] ? (int)$user['client_id'] : null,
    ], $config['jwt_secret']);

    json_out(['success' => true, 'token' => $token, 'user' => map_user($user)]);
}

// Upload de foto (animais ou avatar)
if ($resource === 'upload' && $method === 'POST') {
    $kind = strtolower(trim((string)($_POST['kind'] ?? $_GET['kind'] ?? 'animal')));
    if ($kind === 'avatar') {
        $auth = require_auth($config['jwt_secret']);
    } else {
        $auth = require_auth($config['jwt_secret'], ['root', 'admin', 'user']);
        if (!in_array($kind, ['animal', 'person-doc'], true)) {
            $kind = 'animal';
        }
    }

    if (!isset($_FILES['file']) || !is_uploaded_file($_FILES['file']['tmp_name'])) {
        json_out(['error' => 'Nenhum arquivo enviado'], 400);
    }

    $file = $_FILES['file'];
    if (($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
        json_out(['error' => 'Falha no upload do arquivo'], 400);
    }

    $maxSize = $kind === 'person-doc' ? 8 * 1024 * 1024 : 5 * 1024 * 1024;
    if (($file['size'] ?? 0) > $maxSize) {
        json_out(['error' => 'Arquivo muito grande'], 400);
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($file['tmp_name']) ?: ($file['type'] ?? '');
    $allowed = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
    ];
    if ($kind === 'person-doc') {
        $allowed['application/pdf'] = 'pdf';
    }
    if (!isset($allowed[$mime])) {
        json_out(['error' => $kind === 'person-doc' ? 'Use JPG, PNG, WEBP, GIF ou PDF' : 'Formato inválido. Use JPG, PNG, WEBP ou GIF'], 400);
    }

    $subdir = $kind === 'avatar' ? 'avatars' : ($kind === 'person-doc' ? 'persons' : 'animals');
    $dir = __DIR__ . '/uploads/' . $subdir;
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
        json_out(['error' => 'Não foi possível criar pasta de uploads'], 500);
    }

    $prefix = $kind === 'avatar' ? 'avatar' : ($kind === 'person-doc' ? 'person' : 'animal');
    $filename = $prefix . '_' . date('YmdHis') . '_' . bin2hex(random_bytes(4)) . '.' . $allowed[$mime];
    $dest = $dir . '/' . $filename;
    if (!move_uploaded_file($file['tmp_name'], $dest)) {
        json_out(['error' => 'Erro ao salvar arquivo'], 500);
    }

    json_out([
        'success' => true,
        'url' => '/uploads/' . $subdir . '/' . $filename,
        'fileName' => $file['name'] ?? $filename,
        'uploaded_by' => $auth['username'],
    ]);
}

// Me
if ($resource === 'me' && $method === 'GET') {
    $auth = require_auth($config['jwt_secret']);
    $stmt = $pdo->prepare(
        'SELECT id, username, email, name, avatar_url, role, client_id, active, must_change_password FROM users WHERE id = ?'
    );
    $stmt->execute([$auth['id']]);
    $user = $stmt->fetch();
    if (!$user) json_out(['error' => 'Usuário não encontrado'], 404);
    json_out(['user' => map_user($user)]);
}

if ($resource === 'me' && $method === 'PUT') {
    $auth = require_auth($config['jwt_secret']);
    $name = trim((string)($body['name'] ?? ''));
    if ($name === '') {
        json_out(['error' => 'Nome é obrigatório'], 400);
    }
    if (mb_strlen($name) > 150) {
        json_out(['error' => 'Nome muito longo'], 400);
    }

    $stmt = $pdo->prepare('SELECT id, avatar_url FROM users WHERE id = ?');
    $stmt->execute([$auth['id']]);
    $current = $stmt->fetch();
    if (!$current) json_out(['error' => 'Usuário não encontrado'], 404);

    $avatarUrl = array_key_exists('avatarUrl', $body)
        ? ($body['avatarUrl'] !== null && $body['avatarUrl'] !== '' ? (string)$body['avatarUrl'] : null)
        : ($current['avatar_url'] ?? null);

    if ($avatarUrl !== null && !preg_match('#^(https?://|/uploads/(avatars|animals)/)[A-Za-z0-9._/-]+$#', $avatarUrl)) {
        json_out(['error' => 'URL de avatar inválida'], 400);
    }

    $upd = $pdo->prepare('UPDATE users SET name = ?, avatar_url = ? WHERE id = ?');
    $upd->execute([$name, $avatarUrl, $auth['id']]);

    $stmt = $pdo->prepare(
        'SELECT id, username, email, name, avatar_url, role, client_id, active, must_change_password FROM users WHERE id = ?'
    );
    $stmt->execute([$auth['id']]);
    json_out(['success' => true, 'user' => map_user($stmt->fetch())]);
}

// Change password
if ($resource === 'change-password' && $method === 'PUT') {
    $auth = require_auth($config['jwt_secret']);
    $current = $body['currentPassword'] ?? '';
    $new = $body['newPassword'] ?? '';
    if ($current === '' || $new === '') json_out(['error' => 'Todos os campos são obrigatórios'], 400);
    if (strlen($new) < 6) json_out(['error' => 'A nova senha deve ter pelo menos 6 caracteres'], 400);

    $stmt = $pdo->prepare('SELECT password_hash FROM users WHERE id = ?');
    $stmt->execute([$auth['id']]);
    $user = $stmt->fetch();
    if (!$user || !password_verify($current, $user['password_hash'])) {
        json_out(['error' => 'Senha atual incorreta'], 401);
    }
    $hash = password_hash($new, PASSWORD_BCRYPT, ['cost' => 12]);
    $upd = $pdo->prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?');
    $upd->execute([$hash, $auth['id']]);
    json_out(['success' => true, 'message' => 'Senha alterada com sucesso']);
}

// Dashboard
if ($resource === 'dashboard' && $method === 'GET') {
    $auth = require_auth($config['jwt_secret']);
    if ($auth['role'] === 'cliente' && $auth['clientId']) {
        $cid = (int)$auth['clientId'];
        $stmt = $pdo->prepare(
            "SELECT COUNT(*) AS total FROM animals a
             INNER JOIN animal_owners ao ON ao.animal_id = a.id
             WHERE ao.client_id = ?"
        );
        $stmt->execute([$cid]);
        $animals = (int)$stmt->fetch()['total'];

        $stmt = $pdo->prepare(
            "SELECT COUNT(*) AS total FROM animals a
             INNER JOIN animal_owners ao ON ao.animal_id = a.id
             WHERE ao.client_id = ? AND a.status = 'ativo'"
        );
        $stmt->execute([$cid]);
        $activeAnimals = (int)$stmt->fetch()['total'];

        $stmt = $pdo->prepare(
            "SELECT COUNT(*) AS total FROM contracts
             WHERE (buyer_id = ? OR seller_id = ? OR assessor_id = ?) AND status != 'cancelado'"
        );
        $stmt->execute([$cid, $cid, $cid]);
        $contracts = (int)$stmt->fetch()['total'];

        $stmt = $pdo->prepare(
            "SELECT COUNT(*) AS total FROM contracts
             WHERE (buyer_id = ? OR seller_id = ? OR assessor_id = ?) AND status = 'ativo'"
        );
        $stmt->execute([$cid, $cid, $cid]);
        $contractsActive = (int)$stmt->fetch()['total'];

        $stmt = $pdo->prepare(
            "SELECT COUNT(*) AS total FROM contracts
             WHERE (buyer_id = ? OR seller_id = ? OR assessor_id = ?) AND status = 'aguardando_assinatura'"
        );
        $stmt->execute([$cid, $cid, $cid]);
        $contractsAwaiting = (int)$stmt->fetch()['total'];

        $stmt = $pdo->prepare(
            "SELECT COUNT(*) AS total FROM charges ch
             INNER JOIN contracts c ON c.id = ch.contract_id
             WHERE ch.client_id = ? AND ch.status = 'pendente' AND c.status != 'cancelado'"
        );
        $stmt->execute([$cid]);
        $chargesPending = (int)$stmt->fetch()['total'];

        $stmt = $pdo->prepare(
            "SELECT COUNT(*) AS total FROM charges ch
             INNER JOIN contracts c ON c.id = ch.contract_id
             WHERE ch.client_id = ? AND c.status != 'cancelado'
               AND (ch.status = 'atrasado' OR (ch.status = 'pendente' AND ch.due_date < CURDATE()))"
        );
        $stmt->execute([$cid]);
        $chargesOverdue = (int)$stmt->fetch()['total'];

        $stmt = $pdo->prepare(
            "SELECT COUNT(*) AS total FROM charges ch
             INNER JOIN contracts c ON c.id = ch.contract_id
             WHERE ch.client_id = ? AND ch.status = 'pago' AND c.status != 'cancelado'"
        );
        $stmt->execute([$cid]);
        $chargesPaid = (int)$stmt->fetch()['total'];

        json_out([
            'clients' => 1,
            'buyers' => 0,
            'sellers' => 0,
            'assessors' => 0,
            'witnesses' => 0,
            'avalistas' => 0,
            'animals' => $animals,
            'activeAnimals' => $activeAnimals,
            'contracts' => $contracts,
            'contractsActive' => $contractsActive,
            'contractsAwaiting' => $contractsAwaiting,
            'chargesPending' => $chargesPending,
            'chargesOverdue' => $chargesOverdue,
            'chargesPaid' => $chargesPaid,
            'users' => 0,
        ]);
    }

    $clients = (int)$pdo->query('SELECT COUNT(*) AS t FROM clients WHERE active = 1')->fetch()['t'];
    $buyers = (int)$pdo->query('SELECT COUNT(*) AS t FROM clients WHERE active = 1 AND is_buyer = 1')->fetch()['t'];
    $sellers = (int)$pdo->query('SELECT COUNT(*) AS t FROM clients WHERE active = 1 AND is_seller = 1')->fetch()['t'];
    $assessors = (int)$pdo->query('SELECT COUNT(*) AS t FROM clients WHERE active = 1 AND is_assessor = 1')->fetch()['t'];
    $witnesses = (int)$pdo->query('SELECT COUNT(*) AS t FROM clients WHERE active = 1 AND is_witness = 1')->fetch()['t'];
    $avalistas = (int)$pdo->query('SELECT COUNT(*) AS t FROM clients WHERE active = 1 AND is_avalista = 1')->fetch()['t'];
    $animals = (int)$pdo->query('SELECT COUNT(*) AS t FROM animals')->fetch()['t'];
    $activeAnimals = (int)$pdo->query("SELECT COUNT(*) AS t FROM animals WHERE status = 'ativo'")->fetch()['t'];
    $contracts = (int)$pdo->query("SELECT COUNT(*) AS t FROM contracts WHERE status != 'cancelado'")->fetch()['t'];
    $contractsActive = (int)$pdo->query("SELECT COUNT(*) AS t FROM contracts WHERE status = 'ativo'")->fetch()['t'];
    $contractsAwaiting = (int)$pdo->query("SELECT COUNT(*) AS t FROM contracts WHERE status = 'aguardando_assinatura'")->fetch()['t'];
    $chargesPending = (int)$pdo->query(
        "SELECT COUNT(*) AS t FROM charges ch
         INNER JOIN contracts c ON c.id = ch.contract_id
         WHERE ch.status = 'pendente' AND c.status != 'cancelado'"
    )->fetch()['t'];
    $chargesOverdue = (int)$pdo->query(
        "SELECT COUNT(*) AS t FROM charges ch
         INNER JOIN contracts c ON c.id = ch.contract_id
         WHERE c.status != 'cancelado'
           AND (ch.status = 'atrasado' OR (ch.status = 'pendente' AND ch.due_date < CURDATE()))"
    )->fetch()['t'];
    $chargesPaid = (int)$pdo->query(
        "SELECT COUNT(*) AS t FROM charges ch
         INNER JOIN contracts c ON c.id = ch.contract_id
         WHERE ch.status = 'pago' AND c.status != 'cancelado'"
    )->fetch()['t'];
    $users = in_array($auth['role'], ['root', 'admin'], true)
        ? (int)$pdo->query('SELECT COUNT(*) AS t FROM users WHERE active = 1')->fetch()['t']
        : null;

    json_out([
        'clients' => $clients,
        'buyers' => $buyers,
        'sellers' => $sellers,
        'assessors' => $assessors,
        'witnesses' => $witnesses,
        'avalistas' => $avalistas,
        'animals' => $animals,
        'activeAnimals' => $activeAnimals,
        'contracts' => $contracts,
        'contractsActive' => $contractsActive,
        'contractsAwaiting' => $contractsAwaiting,
        'chargesPending' => $chargesPending,
        'chargesOverdue' => $chargesOverdue,
        'chargesPaid' => $chargesPaid,
        'users' => $users,
    ]);
}

function map_client(array $r): array {
    return [
        'id' => (string)$r['id'],
        'name' => $r['name'],
        'document_type' => $r['document_type'],
        'document' => $r['document'],
        'rg' => $r['rg'] ?? null,
        'rg_issuer' => $r['rg_issuer'] ?? null,
        'birth_date' => $r['birth_date'] ?? null,
        'nickname' => $r['nickname'] ?? null,
        'marital_status' => $r['marital_status'] ?? null,
        'profession' => $r['profession'] ?? null,
        'mother_name' => $r['mother_name'] ?? null,
        'father_name' => $r['father_name'] ?? null,
        'email' => $r['email'],
        'phone' => $r['phone'],
        'whatsapp' => $r['whatsapp'],
        'city' => $r['city'],
        'state' => $r['state'],
        'address' => $r['address'],
        'address_number' => $r['address_number'] ?? null,
        'zip_code' => $r['zip_code'] ?? null,
        'country' => $r['country'] ?? 'Brasil',
        'notes' => $r['notes'],
        'relationship_notes' => $r['relationship_notes'] ?? null,
        'problems_notes' => $r['problems_notes'] ?? null,
        'active' => (bool)$r['active'],
        'is_seller' => (bool)($r['is_seller'] ?? 0),
        'is_buyer' => (bool)($r['is_buyer'] ?? 1),
        'is_assessor' => (bool)($r['is_assessor'] ?? 0),
        'is_witness' => (bool)($r['is_witness'] ?? 0),
        'is_avalista' => (bool)($r['is_avalista'] ?? 0),
        'property_name' => $r['property_name'] ?? null,
        'created_at' => $r['created_at'] ?? null,
    ];
}

function validate_required_client(array $body): ?string {
    $missing = [];
    if (trim((string)($body['name'] ?? '')) === '') $missing[] = 'Nome completo';
    $digits = preg_replace('/\D+/', '', (string)($body['document'] ?? '')) ?? '';
    $docType = $body['document_type'] ?? 'CPF';
    if ($digits === '') {
        $missing[] = 'CPF/CNPJ';
    } elseif ($docType === 'CNPJ' ? strlen($digits) !== 14 : strlen($digits) !== 11) {
        return $docType === 'CNPJ'
            ? 'CNPJ inválido — informe 14 dígitos'
            : 'CPF inválido — informe 11 dígitos';
    }
    $email = trim((string)($body['email'] ?? ''));
    if ($email === '') {
        $missing[] = 'E-mail';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return 'E-mail inválido';
    }
    if (trim((string)($body['phone'] ?? '')) === '') $missing[] = 'Telefone';
    $cep = preg_replace('/\D+/', '', (string)($body['zip_code'] ?? '')) ?? '';
    if (strlen($cep) !== 8) $missing[] = 'CEP';
    if (trim((string)($body['address'] ?? '')) === '') $missing[] = 'Endereço (logradouro)';
    if (trim((string)($body['city'] ?? '')) === '') $missing[] = 'Cidade';
    if (trim((string)($body['state'] ?? '')) === '') $missing[] = 'UF';
    if ($missing) {
        return 'Preencha os campos obrigatórios: ' . implode(', ', $missing);
    }
    return null;
}

function client_ip(): string {
    return $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '';
}

/** Parcelas iguais, mensais, com a diferença de centavos na última. */
function build_equal_schedule(float $total, int $n, string $firstDue): array {
    $base = floor(($total / $n) * 100) / 100;
    $due = new DateTime(substr($firstDue, 0, 10));
    $rows = [];
    $sum = 0;
    for ($i = 1; $i <= $n; $i++) {
        $amount = $i === $n ? round($total - $sum, 2) : $base;
        $sum += $amount;
        $rows[] = ['amount' => $amount, 'dueDate' => $due->format('Y-m-d')];
        $due->modify('+1 month');
    }
    return $rows;
}

/** Cronograma manual vindo do formulário. Retorna null quando não foi informado. */
function normalize_schedule($raw, int $n, float $total): ?array {
    if (!is_array($raw) || !count($raw)) return null;
    if (count($raw) !== $n) {
        throw new InvalidArgumentException('O cronograma informado não bate com a quantidade de parcelas');
    }
    $rows = [];
    foreach (array_values($raw) as $i => $r) {
        $rows[] = [
            'order' => (int)($r['installmentNo'] ?? $i + 1),
            'amount' => round((float)($r['amount'] ?? 0), 2),
            'dueDate' => substr((string)($r['dueDate'] ?? ''), 0, 10),
        ];
    }
    usort($rows, fn($a, $b) => $a['order'] <=> $b['order']);

    $sum = 0;
    foreach ($rows as $r) {
        if (!($r['amount'] > 0) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $r['dueDate'])) {
            throw new InvalidArgumentException('Informe valor e vencimento válidos em todas as parcelas');
        }
        $sum += $r['amount'];
    }
    if (abs($sum - $total) > 0.02) {
        throw new InvalidArgumentException('A soma das parcelas deve ser igual ao valor total do contrato');
    }
    return array_map(fn($r) => ['amount' => $r['amount'], 'dueDate' => $r['dueDate']], $rows);
}

function generate_charges(PDO $pdo, int $contractId, int $buyerId, float $total, int $n, string $firstDue, string $method, ?array $schedule = null): void {
    $n = max(1, min(40, $n));
    $rows = $schedule ?? build_equal_schedule($total, $n, $firstDue);
    // Repasses dependem das cobranças — remove antes para evitar falha de FK
    $pdo->prepare('DELETE FROM payouts WHERE contract_id = ?')->execute([$contractId]);
    $pdo->prepare('DELETE FROM charges WHERE contract_id = ?')->execute([$contractId]);
    $ins = $pdo->prepare(
        'INSERT INTO charges (contract_id, client_id, installment_no, amount, due_date, payment_method, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    foreach (array_values($rows) as $i => $row) {
        $ins->execute([
            $contractId,
            $buyerId,
            $i + 1,
            $row['amount'],
            $row['dueDate'],
            $method,
            'pendente',
        ]);
    }
}

/** Contratos já cancelados: inativa cobranças/repasses abertos (corrige registros antigos). */
function sync_cancelled_contract_finance(PDO $pdo): void {
    $pdo->exec(
        "UPDATE charges ch
         INNER JOIN contracts c ON c.id = ch.contract_id
         SET ch.status = 'cancelado'
         WHERE c.status = 'cancelado' AND ch.status NOT IN ('pago', 'cancelado')"
    );
    $pdo->exec(
        "UPDATE payouts p
         INNER JOIN contracts c ON c.id = p.contract_id
         SET p.status = 'cancelado'
         WHERE c.status = 'cancelado' AND p.status NOT IN ('pago', 'cancelado')"
    );
}

function clicksign_config(array $config): array {
    $token = trim((string)($config['clicksign_access_token'] ?? ''));
    $base = rtrim((string)($config['clicksign_base_url'] ?? 'https://app.clicksign.com'), '/');
    if ($token === '') {
        throw new InvalidArgumentException('Clicksign não configurada. Defina clicksign_access_token em config.local.php');
    }
    return ['token' => $token, 'base' => $base];
}

function clicksign_request(array $config, string $method, string $path, ?array $payload = null): array {
    $cs = clicksign_config($config);
    $url = $cs['base'] . $path;
    $ch = curl_init($url);
    $headers = [
        'Authorization: ' . $cs['token'],
        'Accept: application/vnd.api+json',
        'Content-Type: application/vnd.api+json',
    ];
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => strtoupper($method),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => 120,
    ]);
    if ($payload !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload, JSON_UNESCAPED_UNICODE));
    }
    $raw = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    if ($raw === false) {
        throw new RuntimeException('Falha ao contatar Clicksign: ' . $err);
    }
    $json = json_decode($raw, true);
    if ($code < 200 || $code >= 300) {
        $msg = $json['errors'][0]['detail']
            ?? $json['errors'][0]['title']
            ?? $json['error']
            ?? ('Clicksign HTTP ' . $code);
        throw new InvalidArgumentException(is_string($msg) ? $msg : 'Erro na Clicksign');
    }
    return is_array($json) ? $json : [];
}

/**
 * Envia PDF para Clicksign: envelope + documento + 4 signatários + requisitos + ativação + notificação.
 * @return array{envelopeId:string,documentId:string,status:string}
 */
function clicksign_send_contract(array $config, array $contract, string $pdfBase64): array {
    if (strpos($pdfBase64, 'base64,') !== false) {
        $pdfBase64 = substr($pdfBase64, strpos($pdfBase64, 'base64,') + 7);
    }
    $pdfBase64 = preg_replace('/\s+/', '', $pdfBase64) ?? '';
    if ($pdfBase64 === '') {
        throw new InvalidArgumentException('PDF do contrato é obrigatório');
    }

    $number = $contract['contract_number'] ?: $contract['id'];
    $animal = trim((string)($contract['animal_name'] ?? '')) ?: 'Animal';
    $lot = trim((string)($contract['lot_label'] ?? ''));
    $sellerName = trim((string)($contract['seller_name'] ?? ''));
    $buyerName = trim((string)($contract['buyer_name'] ?? ''));
    $title = trim((string)($contract['template_title'] ?? '')) ?: 'Nota de Leilão e Contrato';

    $envelopeParts = [$title, (string)$number];
    if ($lot !== '' && $lot !== '—') $envelopeParts[] = 'Lote ' . $lot;
    $envelopeParts[] = $animal;
    if ($sellerName !== '') $envelopeParts[] = 'Vend. ' . $sellerName;
    if ($buyerName !== '') $envelopeParts[] = 'Comp. ' . $buyerName;
    $envelopeName = implode(' — ', $envelopeParts);
    if (function_exists('mb_strlen') && mb_strlen($envelopeName) > 180) {
        $envelopeName = mb_substr($envelopeName, 0, 177) . '...';
    } elseif (strlen($envelopeName) > 180) {
        $envelopeName = substr($envelopeName, 0, 177) . '...';
    }

    $slug = static function (string $s): string {
        $s = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s) ?: $s;
        $s = preg_replace('/[^A-Za-z0-9]+/', '-', $s) ?? '';
        $s = trim($s, '-');
        return $s !== '' ? $s : 'doc';
    };
    $pdfName = 'Contrato-' . $slug((string)$number);
    if ($lot !== '' && $lot !== '—') $pdfName .= '-Lote-' . $slug($lot);
    $pdfName .= '-' . $slug($animal);
    if ($sellerName !== '') $pdfName .= '-' . $slug($sellerName);
    if ($buyerName !== '') $pdfName .= '-' . $slug($buyerName);
    if (strlen($pdfName) > 120) $pdfName = substr($pdfName, 0, 120);
    $pdfFilename = rtrim($pdfName, '-') . '.pdf';

    $signers = [
        [
            'name' => trim((string)($contract['seller_name'] ?? '')),
            'email' => trim((string)($contract['seller_email'] ?? '')),
            'role' => 'seller',
            'label' => 'vendedor',
        ],
        [
            'name' => trim((string)($contract['buyer_name'] ?? '')),
            'email' => trim((string)($contract['buyer_email'] ?? '')),
            'role' => 'buyer',
            'label' => 'comprador',
        ],
        [
            'name' => trim((string)($contract['witness1_name'] ?? '')),
            'email' => trim((string)($contract['witness1_email'] ?? '')),
            'role' => 'witness',
            'label' => 'testemunha 1',
        ],
        [
            'name' => trim((string)($contract['witness2_name'] ?? '')),
            'email' => trim((string)($contract['witness2_email'] ?? '')),
            'role' => 'witness',
            'label' => 'testemunha 2',
        ],
    ];
    foreach ($signers as $s) {
        if ($s['name'] === '' || $s['email'] === '' || !filter_var($s['email'], FILTER_VALIDATE_EMAIL)) {
            throw new InvalidArgumentException(
                'Para enviar à Clicksign, cadastre nome e e-mail válidos do ' . $s['label']
            );
        }
    }

    $env = clicksign_request($config, 'POST', '/api/v3/envelopes', [
        'data' => [
            'type' => 'envelopes',
            'attributes' => [
                'name' => $envelopeName,
                'locale' => 'pt-BR',
                'auto_close' => true,
                'remind_interval' => 3,
            ],
        ],
    ]);
    $envelopeId = $env['data']['id'] ?? null;
    if (!$envelopeId) throw new RuntimeException('Clicksign não retornou o envelope');

    $doc = clicksign_request($config, 'POST', "/api/v3/envelopes/{$envelopeId}/documents", [
        'data' => [
            'type' => 'documents',
            'attributes' => [
                'filename' => $pdfFilename,
                'content_base64' => 'data:application/pdf;base64,' . $pdfBase64,
            ],
        ],
    ]);
    $documentId = $doc['data']['id'] ?? null;
    if (!$documentId) throw new RuntimeException('Clicksign não retornou o documento');

    foreach ($signers as $s) {
        $signerRes = clicksign_request($config, 'POST', "/api/v3/envelopes/{$envelopeId}/signers", [
            'data' => [
                'type' => 'signers',
                'attributes' => [
                    'name' => $s['name'],
                    'email' => $s['email'],
                ],
            ],
        ]);
        $signerId = $signerRes['data']['id'] ?? null;
        if (!$signerId) throw new RuntimeException('Falha ao cadastrar signatário: ' . $s['label']);

        clicksign_request($config, 'POST', "/api/v3/envelopes/{$envelopeId}/requirements", [
            'data' => [
                'type' => 'requirements',
                'attributes' => [
                    'action' => 'agree',
                    'role' => $s['role'],
                ],
                'relationships' => [
                    'document' => ['data' => ['type' => 'documents', 'id' => $documentId]],
                    'signer' => ['data' => ['type' => 'signers', 'id' => $signerId]],
                ],
            ],
        ]);
        clicksign_request($config, 'POST', "/api/v3/envelopes/{$envelopeId}/requirements", [
            'data' => [
                'type' => 'requirements',
                'attributes' => [
                    'action' => 'provide_evidence',
                    'auth' => 'email',
                ],
                'relationships' => [
                    'document' => ['data' => ['type' => 'documents', 'id' => $documentId]],
                    'signer' => ['data' => ['type' => 'signers', 'id' => $signerId]],
                ],
            ],
        ]);
    }

    clicksign_request($config, 'PATCH', "/api/v3/envelopes/{$envelopeId}", [
        'data' => [
            'id' => $envelopeId,
            'type' => 'envelopes',
            'attributes' => ['status' => 'running'],
        ],
    ]);

    clicksign_request($config, 'POST', "/api/v3/envelopes/{$envelopeId}/notifications", [
        'data' => [
            'type' => 'notifications',
            'attributes' => new stdClass(),
        ],
    ]);

    return [
        'envelopeId' => $envelopeId,
        'documentId' => $documentId,
        'status' => 'running',
    ];
}

function clicksign_status_label(string $status): string {
    $map = [
        'draft' => 'Rascunho',
        'running' => 'Em processo',
        'closed' => 'Finalizado',
        'canceled' => 'Cancelado',
        'cancelled' => 'Cancelado',
    ];
    return $map[$status] ?? ($status !== '' ? $status : 'Enviado');
}

/**
 * Consulta envelope + signatários + eventos de assinatura na Clicksign.
 * @return array{status:string,statusLabel:string,signedCount:int,totalCount:int,signers:list<array>}
 */
function clicksign_fetch_status(array $config, array $contract): array {
    $envelopeId = trim((string)($contract['clicksign_envelope_id'] ?? ''));
    $documentId = trim((string)($contract['clicksign_document_id'] ?? ''));
    if ($envelopeId === '') {
        throw new InvalidArgumentException('Contrato ainda não foi enviado à Clicksign');
    }

    $env = clicksign_request($config, 'GET', "/api/v3/envelopes/{$envelopeId}");
    $status = (string)($env['data']['attributes']['status'] ?? ($contract['clicksign_status'] ?? 'running'));

    $signersRes = clicksign_request($config, 'GET', "/api/v3/envelopes/{$envelopeId}/signers");
    $csSigners = is_array($signersRes['data'] ?? null) ? $signersRes['data'] : [];

    $signedEmails = [];
    $signedAtByEmail = [];
    if ($documentId !== '') {
        try {
            $eventsRes = clicksign_request(
                $config,
                'GET',
                "/api/v3/envelopes/{$envelopeId}/documents/{$documentId}/events?filter%5Bname%5D=sign"
            );
            foreach (($eventsRes['data'] ?? []) as $ev) {
                $email = strtolower(trim((string)($ev['attributes']['data']['user']['email'] ?? '')));
                if ($email === '') continue;
                $signedEmails[$email] = true;
                if (empty($signedAtByEmail[$email])) {
                    $signedAtByEmail[$email] = $ev['attributes']['created'] ?? null;
                }
            }
        } catch (Throwable $e) {
            // fallback abaixo
        }
    }
    if (!$signedEmails) {
        try {
            $eventsRes = clicksign_request(
                $config,
                'GET',
                "/api/v3/envelopes/{$envelopeId}/events?filter%5Bname%5D=sign"
            );
            foreach (($eventsRes['data'] ?? []) as $ev) {
                $email = strtolower(trim((string)($ev['attributes']['data']['user']['email']
                    ?? $ev['attributes']['data']['signer']['email']
                    ?? '')));
                if ($email === '') continue;
                $signedEmails[$email] = true;
                if (empty($signedAtByEmail[$email])) {
                    $signedAtByEmail[$email] = $ev['attributes']['created'] ?? null;
                }
            }
        } catch (Throwable $e) {
            // segue sem eventos
        }
    }

    $parties = [
        ['role' => 'seller', 'label' => 'Vendedor', 'name' => $contract['seller_name'] ?? null, 'email' => $contract['seller_email'] ?? null],
        ['role' => 'buyer', 'label' => 'Comprador', 'name' => $contract['buyer_name'] ?? null, 'email' => $contract['buyer_email'] ?? null],
        ['role' => 'witness1', 'label' => 'Testemunha 1', 'name' => $contract['witness1_name'] ?? null, 'email' => $contract['witness1_email'] ?? null],
        ['role' => 'witness2', 'label' => 'Testemunha 2', 'name' => $contract['witness2_name'] ?? null, 'email' => $contract['witness2_email'] ?? null],
    ];

    $byEmail = [];
    foreach ($csSigners as $s) {
        $email = strtolower(trim((string)($s['attributes']['email'] ?? '')));
        if ($email !== '') $byEmail[$email] = $s;
    }

    $signers = [];
    $used = [];
    foreach ($parties as $p) {
        $email = strtolower(trim((string)($p['email'] ?? '')));
        $cs = $email !== '' ? ($byEmail[$email] ?? null) : null;
        if ($cs) $used[$email] = true;
        $name = trim((string)($p['name'] ?? '')) ?: trim((string)($cs['attributes']['name'] ?? '')) ?: '—';
        $signed = $email !== '' && !empty($signedEmails[$email]);
        // Se o envelope já fechou e não achamos evento, considera assinado
        if (!$signed && $status === 'closed' && $email !== '') $signed = true;
        $signers[] = [
            'role' => $p['role'],
            'label' => $p['label'],
            'name' => $name,
            'email' => $p['email'] ?: ($cs['attributes']['email'] ?? null),
            'signed' => $signed,
            'status' => $signed ? 'assinado' : 'pendente',
            'statusLabel' => $signed ? 'Assinado' : 'Pendente',
            'signedAt' => $signedAtByEmail[$email] ?? null,
        ];
    }

    // Signatários extras da Clicksign que não bateram com as partes
    foreach ($csSigners as $s) {
        $email = strtolower(trim((string)($s['attributes']['email'] ?? '')));
        if ($email === '' || !empty($used[$email])) continue;
        $signed = !empty($signedEmails[$email]) || $status === 'closed';
        $signers[] = [
            'role' => 'other',
            'label' => 'Signatário',
            'name' => trim((string)($s['attributes']['name'] ?? '')) ?: '—',
            'email' => $s['attributes']['email'] ?? null,
            'signed' => $signed,
            'status' => $signed ? 'assinado' : 'pendente',
            'statusLabel' => $signed ? 'Assinado' : 'Pendente',
            'signedAt' => $signedAtByEmail[$email] ?? null,
        ];
    }

    $signedCount = 0;
    foreach ($signers as $s) {
        if (!empty($s['signed'])) $signedCount++;
    }

    return [
        'envelopeId' => $envelopeId,
        'documentId' => $documentId ?: null,
        'status' => $status,
        'statusLabel' => clicksign_status_label($status),
        'signedCount' => $signedCount,
        'totalCount' => count($signers),
        'signers' => $signers,
        'signedFileUrl' => null,
    ];
}

function clicksign_get_signed_file_url(array $config, array $contract): ?string {
    $envelopeId = trim((string)($contract['clicksign_envelope_id'] ?? ''));
    $documentId = trim((string)($contract['clicksign_document_id'] ?? ''));
    if ($envelopeId === '' || $documentId === '') return null;
    $doc = clicksign_request($config, 'GET', "/api/v3/envelopes/{$envelopeId}/documents/{$documentId}");
    $files = $doc['data']['links']['files'] ?? $doc['links']['files'] ?? [];
    if (!is_array($files)) return null;
    foreach (['signed', 'signed_file_url', 'signed-file'] as $key) {
        if (!empty($files[$key]) && is_string($files[$key])) return $files[$key];
    }
    return null;
}

function map_contract_row(array $r): array {
    return [
        'id' => (string)$r['id'],
        'animal_id' => (string)$r['animal_id'],
        'animal_name' => $r['animal_name'] ?? null,
        'animal_chip' => $r['animal_chip'] ?? null,
        'animal_color' => $r['animal_color'] ?? null,
        'animal_birth_date' => $r['animal_birth_date'] ?? null,
        'animal_sex' => $r['animal_sex'] ?? null,
        'animal_notes' => $r['animal_notes'] ?? null,
        'sale_type' => $r['sale_type'],
        'share_pct' => $r['share_pct'] !== null ? (float)$r['share_pct'] : null,
        'seller_id' => (string)$r['seller_id'],
        'seller_name' => $r['seller_name'] ?? null,
        'seller_document' => $r['seller_document'] ?? null,
        'seller_document_type' => $r['seller_document_type'] ?? null,
        'seller_email' => $r['seller_email'] ?? null,
        'seller_phone' => $r['seller_phone'] ?? null,
        'seller_whatsapp' => $r['seller_whatsapp'] ?? null,
        'seller_address' => trim(implode(', nº ', array_filter([$r['seller_address'] ?? null, $r['seller_address_number'] ?? null]))) ?: null,
        'seller_city' => $r['seller_city'] ?? null,
        'seller_state' => $r['seller_state'] ?? null,
        'buyer_id' => (string)$r['buyer_id'],
        'buyer_name' => $r['buyer_name'] ?? null,
        'buyer_document' => $r['buyer_document'] ?? null,
        'buyer_document_type' => $r['buyer_document_type'] ?? null,
        'buyer_email' => $r['buyer_email'] ?? null,
        'buyer_phone' => $r['buyer_phone'] ?? null,
        'buyer_whatsapp' => $r['buyer_whatsapp'] ?? null,
        'buyer_address' => trim(implode(', nº ', array_filter([$r['buyer_address'] ?? null, $r['buyer_address_number'] ?? null]))) ?: null,
        'buyer_city' => $r['buyer_city'] ?? null,
        'buyer_state' => $r['buyer_state'] ?? null,
        'assessor_id' => $r['assessor_id'] ? (string)$r['assessor_id'] : null,
        'assessor_name' => $r['assessor_name'] ?? null,
        'auction_id' => !empty($r['auction_id']) ? (string)$r['auction_id'] : null,
        'auction_name' => $r['auction_name'] ?? null,
        'auction_date' => $r['auction_date'] ?? null,
        'lot_id' => !empty($r['lot_id']) ? (string)$r['lot_id'] : null,
        'template_id' => !empty($r['template_id']) ? (string)$r['template_id'] : null,
        'template_name' => $r['template_name'] ?? null,
        'template_title' => $r['template_title'] ?? null,
        'template_body' => $r['template_body'] ?? null,
        'contract_number' => $r['contract_number'] ?? null,
        'lot_label' => $r['lot_label'] ?? null,
        'animal_category' => $r['animal_category'] ?? null,
        'quantity' => $r['quantity'] !== null ? (float)$r['quantity'] : 1,
        'commission_total_pct' => $r['commission_total_pct'] !== null ? (float)$r['commission_total_pct'] : null,
        'commission_buyer_pct' => $r['commission_buyer_pct'] !== null ? (float)$r['commission_buyer_pct'] : null,
        'commission_seller_pct' => $r['commission_seller_pct'] !== null ? (float)$r['commission_seller_pct'] : null,
        'witness1_id' => !empty($r['witness1_id']) ? (string)$r['witness1_id'] : null,
        'witness1_name' => $r['witness1_name'] ?? null,
        'witness1_email' => $r['witness1_email'] ?? null,
        'witness2_id' => !empty($r['witness2_id']) ? (string)$r['witness2_id'] : null,
        'witness2_name' => $r['witness2_name'] ?? null,
        'witness2_email' => $r['witness2_email'] ?? null,
        'via_label' => $r['via_label'] ?? 'VIA DAS PARTES — VENDEDOR E COMPRADOR',
        'clicksign_envelope_id' => $r['clicksign_envelope_id'] ?? null,
        'clicksign_document_id' => $r['clicksign_document_id'] ?? null,
        'clicksign_status' => $r['clicksign_status'] ?? null,
        'clicksign_sent_at' => $r['clicksign_sent_at'] ?? null,
        'total_amount' => (float)$r['total_amount'],
        'payment_method' => $r['payment_method'],
        'installments' => (int)$r['installments'],
        'first_due_date' => $r['first_due_date'],
        'status' => $r['status'],
        'notes' => $r['notes'],
        'created_at' => $r['created_at'] ?? null,
    ];
}

function map_template_row(array $r): array {
    return [
        'id' => (string)$r['id'],
        'name' => $r['name'],
        'code' => $r['code'],
        'title' => $r['title'],
        'body_text' => $r['body_text'],
        'is_default' => (bool)$r['is_default'],
        'active' => (bool)$r['active'],
        'notes' => $r['notes'],
        'created_at' => $r['created_at'] ?? null,
    ];
}

function generate_payouts(PDO $pdo, int $contractId, $rules): void {
    $pdo->prepare('DELETE FROM payouts WHERE contract_id = ?')->execute([$contractId]);
    $pdo->prepare('DELETE FROM contract_payout_rules WHERE contract_id = ?')->execute([$contractId]);
    if (!is_array($rules) || count($rules) === 0) return;

    $cleaned = [];
    foreach ($rules as $r) {
        $pct = (float)($r['pct'] ?? 0);
        $role = $r['beneficiaryRole'] ?? ($r['beneficiary_role'] ?? '');
        if (!in_array($role, ['assessoria', 'seller', 'assessor', 'outro'], true)) continue;
        if ($pct <= 0) continue;
        $cleaned[] = [
            'role' => $role,
            'clientId' => $r['beneficiaryClientId'] ?? ($r['beneficiary_client_id'] ?? null),
            'label' => $r['label'] ?? null,
            'pct' => $pct,
        ];
    }
    if (!$cleaned) return;

    $sumPct = array_sum(array_column($cleaned, 'pct'));
    if ($sumPct > 100.01) {
        throw new InvalidArgumentException('A soma dos percentuais de repasse não pode passar de 100%');
    }

    $ruleIds = [];
    $insRule = $pdo->prepare(
        'INSERT INTO contract_payout_rules (contract_id, beneficiary_role, beneficiary_client_id, label, pct, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    foreach ($cleaned as $i => $r) {
        $insRule->execute([
            $contractId,
            $r['role'],
            $r['clientId'] ? (int)$r['clientId'] : null,
            $r['label'],
            $r['pct'],
            $i,
        ]);
        $r['id'] = (int)$pdo->lastInsertId();
        $ruleIds[] = $r;
    }

    $ch = $pdo->prepare('SELECT id, installment_no, amount FROM charges WHERE contract_id = ? ORDER BY installment_no ASC');
    $ch->execute([$contractId]);
    $charges = $ch->fetchAll();
    $insPay = $pdo->prepare(
        'INSERT INTO payouts (contract_id, charge_id, rule_id, installment_no, beneficiary_role, beneficiary_client_id, label, pct, amount, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    foreach ($charges as $charge) {
        $allocated = 0.0;
        $count = count($ruleIds);
        foreach ($ruleIds as $i => $r) {
            if ($i === $count - 1 && abs($sumPct - 100) < 0.01) {
                $amount = round((float)$charge['amount'] - $allocated, 2);
            } else {
                $amount = round((float)$charge['amount'] * ($r['pct'] / 100), 2);
            }
            $allocated += $amount;
            $insPay->execute([
                $contractId,
                (int)$charge['id'],
                $r['id'],
                (int)$charge['installment_no'],
                $r['role'],
                $r['clientId'] ? (int)$r['clientId'] : null,
                $r['label'],
                $r['pct'],
                $amount,
                'aguardando',
            ]);
        }
    }
}

function map_auction_row(array $r): array {
    return [
        'id' => (string)$r['id'],
        'name' => $r['name'],
        'auction_date' => $r['auction_date'],
        'location' => $r['location'],
        'organizer' => $r['organizer'],
        'status' => $r['status'],
        'notes' => $r['notes'],
        'lots_count' => isset($r['lots_count']) ? (int)$r['lots_count'] : null,
        'created_at' => $r['created_at'] ?? null,
    ];
}

function map_lot_row(array $r): array {
    return [
        'id' => (string)$r['id'],
        'auction_id' => (string)$r['auction_id'],
        'animal_id' => (string)$r['animal_id'],
        'animal_name' => $r['animal_name'] ?? null,
        'lot_number' => $r['lot_number'],
        'seller_id' => (string)$r['seller_id'],
        'seller_name' => $r['seller_name'] ?? null,
        'sellers' => $r['sellers'] ?? null,
        'min_price' => $r['min_price'] !== null ? (float)$r['min_price'] : null,
        'conditions_text' => $r['conditions_text'],
        'status' => $r['status'],
        'contract_id' => $r['contract_id'] ? (string)$r['contract_id'] : null,
        'created_at' => $r['created_at'] ?? null,
    ];
}

function normalize_lot_sellers(array $body): ?array {
    $list = [];
    if (!empty($body['sellers']) && is_array($body['sellers'])) {
        foreach ($body['sellers'] as $i => $s) {
            if (!is_array($s)) {
                $cid = (int)$s;
                if ($cid > 0) $list[] = ['clientId' => $cid, 'sharePct' => null, 'isPrimary' => $i === 0];
                continue;
            }
            $cid = (int)($s['clientId'] ?? $s['client_id'] ?? 0);
            if ($cid <= 0) continue;
            $list[] = [
                'clientId' => $cid,
                'sharePct' => isset($s['sharePct']) ? (float)$s['sharePct'] : (isset($s['share_pct']) ? (float)$s['share_pct'] : null),
                'isPrimary' => !empty($s['isPrimary']) || !empty($s['is_primary']),
            ];
        }
    } elseif (!empty($body['sellerIds']) && is_array($body['sellerIds'])) {
        foreach ($body['sellerIds'] as $i => $id) {
            $cid = (int)$id;
            if ($cid > 0) $list[] = ['clientId' => $cid, 'sharePct' => null, 'isPrimary' => $i === 0];
        }
    } elseif (!empty($body['sellerId'])) {
        $list[] = ['clientId' => (int)$body['sellerId'], 'sharePct' => 100.0, 'isPrimary' => true];
    }

    $seen = [];
    $unique = [];
    foreach ($list as $s) {
        if (isset($seen[$s['clientId']])) continue;
        $seen[$s['clientId']] = true;
        $unique[] = $s;
    }
    if (!$unique) return null;

    $hasPrimary = false;
    foreach ($unique as &$s) {
        if ($s['isPrimary'] && !$hasPrimary) {
            $hasPrimary = true;
        } else {
            $s['isPrimary'] = false;
        }
    }
    unset($s);
    if (!$hasPrimary) $unique[0]['isPrimary'] = true;

    $n = count($unique);
    $equal = round(100 / $n, 2);
    foreach ($unique as $i => &$s) {
        if ($s['sharePct'] === null) {
            $s['sharePct'] = $i === $n - 1
                ? round(100 - $equal * ($n - 1), 2)
                : $equal;
        }
    }
    unset($s);
    return $unique;
}

function upsert_lot_sellers(PDO $pdo, int $lotId, array $sellers): void {
    $pdo->prepare('DELETE FROM auction_lot_sellers WHERE lot_id = ?')->execute([$lotId]);
    $ins = $pdo->prepare(
        'INSERT INTO auction_lot_sellers (lot_id, client_id, share_pct, is_primary) VALUES (?, ?, ?, ?)'
    );
    foreach ($sellers as $s) {
        $ins->execute([$lotId, $s['clientId'], $s['sharePct'], $s['isPrimary'] ? 1 : 0]);
    }
}

function attach_lot_sellers(PDO $pdo, array $lots): array {
    if (!$lots) return [];
    $ids = array_map(fn($l) => (int)$l['id'], $lots);
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $byLot = [];
    try {
        $stmt = $pdo->prepare(
            "SELECT als.lot_id, als.client_id, als.share_pct, als.is_primary, c.name AS client_name
             FROM auction_lot_sellers als
             INNER JOIN clients c ON c.id = als.client_id
             WHERE als.lot_id IN ($placeholders)
             ORDER BY als.is_primary DESC, c.name ASC"
        );
        $stmt->execute($ids);
        foreach ($stmt->fetchAll() as $row) {
            $byLot[(int)$row['lot_id']][] = [
                'clientId' => (string)$row['client_id'],
                'clientName' => $row['client_name'],
                'sharePct' => (float)$row['share_pct'],
                'isPrimary' => (bool)$row['is_primary'],
            ];
        }
    } catch (Throwable $e) {
        /* migration ainda não aplicada */
    }

    $out = [];
    foreach ($lots as $l) {
        $sellers = $byLot[(int)$l['id']] ?? null;
        if (!$sellers) {
            $sellers = [[
                'clientId' => (string)$l['seller_id'],
                'clientName' => $l['seller_name'] ?? '',
                'sharePct' => 100.0,
                'isPrimary' => true,
            ]];
        }
        $primary = null;
        foreach ($sellers as $s) {
            if (!empty($s['isPrimary'])) { $primary = $s; break; }
        }
        if (!$primary) $primary = $sellers[0];
        $names = array_values(array_filter(array_map(fn($s) => $s['clientName'] ?? '', $sellers)));
        $l['seller_id'] = $primary['clientId'];
        $l['seller_name'] = $names ? implode(', ', $names) : ($l['seller_name'] ?? null);
        $l['sellers'] = $sellers;
        $out[] = map_lot_row($l);
    }
    return $out;
}

function map_payout_row(array $r): array {
    return [
        'id' => (string)$r['id'],
        'contract_id' => (string)$r['contract_id'],
        'charge_id' => (string)$r['charge_id'],
        'installment_no' => (int)$r['installment_no'],
        'beneficiary_role' => $r['beneficiary_role'],
        'beneficiary_client_id' => $r['beneficiary_client_id'] ? (string)$r['beneficiary_client_id'] : null,
        'beneficiary_name' => $r['beneficiary_name'] ?? null,
        'label' => $r['label'],
        'pct' => (float)$r['pct'],
        'amount' => (float)$r['amount'],
        'status' => $r['status'],
        'paid_at' => $r['paid_at'],
        'notes' => $r['notes'],
        'animal_name' => $r['animal_name'] ?? null,
        'charge_status' => $r['charge_status'] ?? null,
        'charge_due_date' => $r['charge_due_date'] ?? null,
    ];
}

// Clients
if ($resource === 'clients') {
    if ($method === 'GET' && !$id) {
        $auth = require_auth($config['jwt_secret']);
        $q = trim($_GET['q'] ?? '');
        $roleFilter = trim($_GET['role'] ?? '');
        $sql = 'SELECT c.*, (
            SELECT cp.name FROM client_properties cp
            WHERE cp.client_id = c.id
            ORDER BY cp.is_primary DESC, cp.id ASC
            LIMIT 1
          ) AS property_name
          FROM clients c WHERE 1=1';
        $params = [];
        if ($auth['role'] === 'cliente') {
            if (!$auth['clientId']) json_out([]);
            $sql .= ' AND c.id = ?';
            $params[] = $auth['clientId'];
        }
        if ($q !== '') {
            $sql .= ' AND (
              c.name LIKE ? OR c.document LIKE ? OR c.email LIKE ? OR c.phone LIKE ?
              OR EXISTS (
                SELECT 1 FROM client_properties cp
                WHERE cp.client_id = c.id AND cp.name LIKE ?
              )
            )';
            $like = "%$q%";
            array_push($params, $like, $like, $like, $like, $like);
        }
        if ($roleFilter === 'seller') $sql .= ' AND c.is_seller = 1';
        if ($roleFilter === 'buyer') $sql .= ' AND c.is_buyer = 1';
        if ($roleFilter === 'assessor') $sql .= ' AND c.is_assessor = 1';
        if ($roleFilter === 'witness') $sql .= ' AND c.is_witness = 1';
        if ($roleFilter === 'avalista') $sql .= ' AND c.is_avalista = 1';
        $sql .= ' ORDER BY c.name ASC';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        json_out(array_map('map_client', $stmt->fetchAll()));
    }

    // Nested: documents / properties / bank-accounts / contacts
    if ($id && $action === 'documents') {
        $auth = require_auth($config['jwt_secret']);
        $cid = (int)$id;
        if ($auth['role'] === 'cliente' && (int)$auth['clientId'] !== $cid) {
            json_out(['error' => 'Sem permissão'], 403);
        }
        if ($method === 'GET' && !$subId) {
            $stmt = $pdo->prepare('SELECT * FROM client_documents WHERE client_id = ? ORDER BY created_at DESC');
            $stmt->execute([$cid]);
            json_out(array_map(function ($r) {
                return [
                    'id' => (string)$r['id'],
                    'client_id' => (string)$r['client_id'],
                    'doc_type' => $r['doc_type'],
                    'file_url' => $r['file_url'],
                    'file_name' => $r['file_name'],
                    'notes' => $r['notes'],
                    'created_at' => $r['created_at'],
                ];
            }, $stmt->fetchAll()));
        }
        if ($method === 'POST' && !$subId) {
            require_auth($config['jwt_secret'], ['root', 'admin', 'user']);
            $docType = $body['docType'] ?? 'outro';
            $allowed = ['rg','identidade','cnh','comprovante_residencia','selfie','outro'];
            if (!in_array($docType, $allowed, true)) json_out(['error' => 'Tipo de documento inválido'], 400);
            if (empty($body['fileUrl'])) json_out(['error' => 'Arquivo é obrigatório'], 400);
            $authW = require_auth($config['jwt_secret'], ['root', 'admin', 'user']);
            $pdo->prepare(
                'INSERT INTO client_documents (client_id, doc_type, file_url, file_name, notes, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)'
            )->execute([
                $cid, $docType, $body['fileUrl'], $body['fileName'] ?? null, $body['notes'] ?? null, $authW['id'],
            ]);
            json_out(['success' => true, 'id' => (string)$pdo->lastInsertId()]);
        }
        if ($method === 'DELETE' && $subId) {
            require_auth($config['jwt_secret'], ['root', 'admin', 'user']);
            $stmt = $pdo->prepare('DELETE FROM client_documents WHERE id = ? AND client_id = ?');
            $stmt->execute([(int)$subId, $cid]);
            if ($stmt->rowCount() === 0) json_out(['error' => 'Documento não encontrado'], 404);
            json_out(['success' => true]);
        }
    }

    if ($id && $action === 'properties') {
        $auth = require_auth($config['jwt_secret']);
        $cid = (int)$id;
        if ($auth['role'] === 'cliente' && (int)$auth['clientId'] !== $cid) {
            json_out(['error' => 'Sem permissão'], 403);
        }
        if ($method === 'GET' && !$subId) {
            $stmt = $pdo->prepare('SELECT * FROM client_properties WHERE client_id = ? ORDER BY is_primary DESC, name ASC');
            $stmt->execute([$cid]);
            json_out(array_map(function ($r) {
                $r['id'] = (string)$r['id'];
                $r['client_id'] = (string)$r['client_id'];
                $r['is_primary'] = (bool)$r['is_primary'];
                return $r;
            }, $stmt->fetchAll()));
        }
        if ($method === 'POST' && !$subId) {
            require_auth($config['jwt_secret'], ['root', 'admin', 'user']);
            $name = trim($body['name'] ?? '');
            if ($name === '') json_out(['error' => 'Nome da propriedade é obrigatório'], 400);
            $pdo->prepare(
                'INSERT INTO client_properties (client_id, name, cnpj, state_registration, zip_code, state, city, address, phone, property_type, is_primary, manager_name, manager_phone, manager_email, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            )->execute([
                $cid, $name, $body['cnpj'] ?? null, $body['state_registration'] ?? null, $body['zip_code'] ?? null,
                $body['state'] ?? null, $body['city'] ?? null, $body['address'] ?? null, $body['phone'] ?? null,
                $body['property_type'] ?? null, !empty($body['is_primary']) ? 1 : 0,
                $body['manager_name'] ?? null, $body['manager_phone'] ?? null, $body['manager_email'] ?? null, $body['notes'] ?? null,
            ]);
            json_out(['success' => true, 'id' => (string)$pdo->lastInsertId()]);
        }
        if ($method === 'PUT' && $subId) {
            require_auth($config['jwt_secret'], ['root', 'admin', 'user']);
            $name = trim($body['name'] ?? '');
            if ($name === '') json_out(['error' => 'Nome da propriedade é obrigatório'], 400);
            $pdo->prepare(
                'UPDATE client_properties SET name=?, cnpj=?, state_registration=?, zip_code=?, state=?, city=?, address=?, phone=?, property_type=?, is_primary=?, manager_name=?, manager_phone=?, manager_email=?, notes=? WHERE id=? AND client_id=?'
            )->execute([
                $name, $body['cnpj'] ?? null, $body['state_registration'] ?? null, $body['zip_code'] ?? null,
                $body['state'] ?? null, $body['city'] ?? null, $body['address'] ?? null, $body['phone'] ?? null,
                $body['property_type'] ?? null, !empty($body['is_primary']) ? 1 : 0,
                $body['manager_name'] ?? null, $body['manager_phone'] ?? null, $body['manager_email'] ?? null, $body['notes'] ?? null,
                (int)$subId, $cid,
            ]);
            json_out(['success' => true]);
        }
        if ($method === 'DELETE' && $subId) {
            require_auth($config['jwt_secret'], ['root', 'admin', 'user']);
            $stmt = $pdo->prepare('DELETE FROM client_properties WHERE id = ? AND client_id = ?');
            $stmt->execute([(int)$subId, $cid]);
            if ($stmt->rowCount() === 0) json_out(['error' => 'Propriedade não encontrada'], 404);
            json_out(['success' => true]);
        }
    }

    if ($id && $action === 'bank-accounts') {
        $auth = require_auth($config['jwt_secret']);
        $cid = (int)$id;
        if ($auth['role'] === 'cliente' && (int)$auth['clientId'] !== $cid) {
            json_out(['error' => 'Sem permissão'], 403);
        }
        if ($method === 'GET' && !$subId) {
            $stmt = $pdo->prepare('SELECT * FROM client_bank_accounts WHERE client_id = ? ORDER BY is_primary DESC, id ASC');
            $stmt->execute([$cid]);
            json_out(array_map(function ($r) {
                $r['id'] = (string)$r['id'];
                $r['client_id'] = (string)$r['client_id'];
                $r['is_primary'] = (bool)$r['is_primary'];
                return $r;
            }, $stmt->fetchAll()));
        }
        if ($method === 'POST' && !$subId) {
            require_auth($config['jwt_secret'], ['root', 'admin', 'user']);
            $bank = trim($body['bank_name'] ?? '');
            if ($bank === '') json_out(['error' => 'Banco é obrigatório'], 400);
            $type = $body['account_type'] ?? 'corrente';
            if (!in_array($type, ['corrente','poupanca','pagamento','outro'], true)) $type = 'corrente';
            $pdo->prepare(
                'INSERT INTO client_bank_accounts (client_id, account_type, bank_name, agency, account_number, holder_name, holder_document, is_primary, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
            )->execute([
                $cid, $type, $bank, $body['agency'] ?? null, $body['account_number'] ?? null,
                $body['holder_name'] ?? null, $body['holder_document'] ?? null, !empty($body['is_primary']) ? 1 : 0, $body['notes'] ?? null,
            ]);
            json_out(['success' => true, 'id' => (string)$pdo->lastInsertId()]);
        }
        if ($method === 'PUT' && $subId) {
            require_auth($config['jwt_secret'], ['root', 'admin', 'user']);
            $bank = trim($body['bank_name'] ?? '');
            if ($bank === '') json_out(['error' => 'Banco é obrigatório'], 400);
            $type = $body['account_type'] ?? 'corrente';
            if (!in_array($type, ['corrente','poupanca','pagamento','outro'], true)) $type = 'corrente';
            $pdo->prepare(
                'UPDATE client_bank_accounts SET account_type=?, bank_name=?, agency=?, account_number=?, holder_name=?, holder_document=?, is_primary=?, notes=? WHERE id=? AND client_id=?'
            )->execute([
                $type, $bank, $body['agency'] ?? null, $body['account_number'] ?? null,
                $body['holder_name'] ?? null, $body['holder_document'] ?? null, !empty($body['is_primary']) ? 1 : 0, $body['notes'] ?? null,
                (int)$subId, $cid,
            ]);
            json_out(['success' => true]);
        }
        if ($method === 'DELETE' && $subId) {
            require_auth($config['jwt_secret'], ['root', 'admin', 'user']);
            $stmt = $pdo->prepare('DELETE FROM client_bank_accounts WHERE id = ? AND client_id = ?');
            $stmt->execute([(int)$subId, $cid]);
            if ($stmt->rowCount() === 0) json_out(['error' => 'Conta não encontrada'], 404);
            json_out(['success' => true]);
        }
    }

    if ($id && $action === 'contacts') {
        $auth = require_auth($config['jwt_secret']);
        $cid = (int)$id;
        if ($auth['role'] === 'cliente' && (int)$auth['clientId'] !== $cid) {
            json_out(['error' => 'Sem permissão'], 403);
        }
        if ($method === 'GET' && !$subId) {
            $stmt = $pdo->prepare('SELECT * FROM client_contacts WHERE client_id = ? ORDER BY name ASC');
            $stmt->execute([$cid]);
            json_out(array_map(function ($r) {
                $r['id'] = (string)$r['id'];
                $r['client_id'] = (string)$r['client_id'];
                return $r;
            }, $stmt->fetchAll()));
        }
        if ($method === 'POST' && !$subId) {
            require_auth($config['jwt_secret'], ['root', 'admin', 'user']);
            $name = trim($body['name'] ?? '');
            if ($name === '') json_out(['error' => 'Nome do contato é obrigatório'], 400);
            $pdo->prepare(
                'INSERT INTO client_contacts (client_id, name, role_label, phone, email, notes) VALUES (?, ?, ?, ?, ?, ?)'
            )->execute([
                $cid, $name, $body['role_label'] ?? null, $body['phone'] ?? null, $body['email'] ?? null, $body['notes'] ?? null,
            ]);
            json_out(['success' => true, 'id' => (string)$pdo->lastInsertId()]);
        }
        if ($method === 'PUT' && $subId) {
            require_auth($config['jwt_secret'], ['root', 'admin', 'user']);
            $name = trim($body['name'] ?? '');
            if ($name === '') json_out(['error' => 'Nome do contato é obrigatório'], 400);
            $pdo->prepare(
                'UPDATE client_contacts SET name=?, role_label=?, phone=?, email=?, notes=? WHERE id=? AND client_id=?'
            )->execute([
                $name, $body['role_label'] ?? null, $body['phone'] ?? null, $body['email'] ?? null, $body['notes'] ?? null,
                (int)$subId, $cid,
            ]);
            json_out(['success' => true]);
        }
        if ($method === 'DELETE' && $subId) {
            require_auth($config['jwt_secret'], ['root', 'admin', 'user']);
            $stmt = $pdo->prepare('DELETE FROM client_contacts WHERE id = ? AND client_id = ?');
            $stmt->execute([(int)$subId, $cid]);
            if ($stmt->rowCount() === 0) json_out(['error' => 'Contato não encontrado'], 404);
            json_out(['success' => true]);
        }
    }

    if ($method === 'GET' && $id && !$action) {
        $auth = require_auth($config['jwt_secret']);
        if ($auth['role'] === 'cliente' && (int)$auth['clientId'] !== (int)$id) {
            json_out(['error' => 'Sem permissão'], 403);
        }
        $stmt = $pdo->prepare('SELECT * FROM clients WHERE id = ?');
        $stmt->execute([(int)$id]);
        $r = $stmt->fetch();
        if (!$r) json_out(['error' => 'Cliente não encontrado'], 404);
        json_out(map_client($r));
    }

    if ($method === 'POST' && !$id) {
        $auth = require_auth($config['jwt_secret'], ['root', 'admin', 'user']);
        $name = trim($body['name'] ?? '');
        $requiredError = validate_required_client($body);
        if ($requiredError) json_out(['error' => $requiredError], 400);
        try {
            $stmt = $pdo->prepare(
                'INSERT INTO clients (name, document_type, document, rg, rg_issuer, birth_date, nickname, marital_status, profession, mother_name, father_name, email, phone, whatsapp, city, state, address, address_number, zip_code, country, notes, relationship_notes, problems_notes, active, is_seller, is_buyer, is_assessor, is_witness, is_avalista, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $stmt->execute([
                $name,
                $body['document_type'] ?? 'CPF',
                $body['document'] ?? null,
                $body['rg'] ?? null,
                $body['rg_issuer'] ?? null,
                $body['birth_date'] ?? null,
                $body['nickname'] ?? null,
                $body['marital_status'] ?? null,
                $body['profession'] ?? null,
                $body['mother_name'] ?? null,
                $body['father_name'] ?? null,
                $body['email'] ?? null,
                $body['phone'] ?? null,
                $body['whatsapp'] ?? null,
                $body['city'] ?? null,
                $body['state'] ?? null,
                $body['address'] ?? null,
                $body['address_number'] ?? null,
                $body['zip_code'] ?? null,
                $body['country'] ?? 'Brasil',
                $body['notes'] ?? null,
                $body['relationship_notes'] ?? null,
                $body['problems_notes'] ?? null,
                !empty($body['active']) || !isset($body['active']) ? 1 : 0,
                !empty($body['is_seller']) ? 1 : 0,
                isset($body['is_buyer']) ? (!empty($body['is_buyer']) ? 1 : 0) : 1,
                !empty($body['is_assessor']) ? 1 : 0,
                !empty($body['is_witness']) ? 1 : 0,
                !empty($body['is_avalista']) ? 1 : 0,
                $auth['id'],
            ]);
            json_out(['success' => true, 'id' => (string)$pdo->lastInsertId()]);
        } catch (PDOException $e) {
            if ($e->getCode() == 23000) json_out(['error' => 'Documento já cadastrado'], 409);
            json_out(['error' => 'Erro ao criar cliente'], 500);
        }
    }

    if ($method === 'PUT' && $id && !$action) {
        require_auth($config['jwt_secret'], ['root', 'admin', 'user']);
        $name = trim($body['name'] ?? '');
        $requiredError = validate_required_client($body);
        if ($requiredError) json_out(['error' => $requiredError], 400);
        try {
            $stmt = $pdo->prepare(
                'UPDATE clients SET name=?, document_type=?, document=?, rg=?, rg_issuer=?, birth_date=?, nickname=?, marital_status=?, profession=?, mother_name=?, father_name=?, email=?, phone=?, whatsapp=?, city=?, state=?, address=?, address_number=?, zip_code=?, country=?, notes=?, relationship_notes=?, problems_notes=?, active=?, is_seller=?, is_buyer=?, is_assessor=?, is_witness=?, is_avalista=? WHERE id=?'
            );
            $stmt->execute([
                $name,
                $body['document_type'] ?? 'CPF',
                $body['document'] ?? null,
                $body['rg'] ?? null,
                $body['rg_issuer'] ?? null,
                $body['birth_date'] ?? null,
                $body['nickname'] ?? null,
                $body['marital_status'] ?? null,
                $body['profession'] ?? null,
                $body['mother_name'] ?? null,
                $body['father_name'] ?? null,
                $body['email'] ?? null,
                $body['phone'] ?? null,
                $body['whatsapp'] ?? null,
                $body['city'] ?? null,
                $body['state'] ?? null,
                $body['address'] ?? null,
                $body['address_number'] ?? null,
                $body['zip_code'] ?? null,
                $body['country'] ?? 'Brasil',
                $body['notes'] ?? null,
                $body['relationship_notes'] ?? null,
                $body['problems_notes'] ?? null,
                isset($body['active']) && $body['active'] === false ? 0 : 1,
                !empty($body['is_seller']) ? 1 : 0,
                !empty($body['is_buyer']) ? 1 : 0,
                !empty($body['is_assessor']) ? 1 : 0,
                !empty($body['is_witness']) ? 1 : 0,
                !empty($body['is_avalista']) ? 1 : 0,
                (int)$id,
            ]);
            json_out(['success' => true]);
        } catch (PDOException $e) {
            if ($e->getCode() == 23000) json_out(['error' => 'Documento já cadastrado'], 409);
            json_out(['error' => 'Erro ao atualizar cliente'], 500);
        }
    }

    if ($method === 'DELETE' && $id && !$action) {
        require_auth($config['jwt_secret'], ['root', 'admin', 'user']);
        $clientId = (int)$id;
        try {
            $pdo->beginTransaction();
            $pdo->prepare('DELETE FROM animal_owners WHERE client_id = ?')->execute([$clientId]);
            $stmt = $pdo->prepare('DELETE FROM clients WHERE id = ?');
            $stmt->execute([$clientId]);
            if ($stmt->rowCount() === 0) {
                $pdo->rollBack();
                json_out(['error' => 'Cliente não encontrado'], 404);
            }
            $pdo->commit();
            json_out(['success' => true, 'message' => 'Cliente excluído']);
        } catch (PDOException $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            json_out(['error' => 'Erro ao excluir cliente'], 500);
        }
    }
}

// Animals helpers
function upsert_owners(PDO $pdo, int $animalId, array $owners): void {
    $pdo->prepare('DELETE FROM animal_owners WHERE animal_id = ?')->execute([$animalId]);
    $ins = $pdo->prepare(
        'INSERT INTO animal_owners (animal_id, client_id, share_pct, is_primary) VALUES (?, ?, ?, ?)'
    );
    foreach ($owners as $owner) {
        $clientId = (int)($owner['clientId'] ?? 0);
        if (!$clientId) continue;
        $ins->execute([
            $animalId,
            $clientId,
            $owner['sharePct'] ?? 100,
            !empty($owner['isPrimary']) ? 1 : 0,
        ]);
    }
}

function upsert_genealogy(PDO $pdo, int $animalId, ?array $genealogy): void {
    if (!$genealogy) return;
    $stmt = $pdo->prepare(
        'INSERT INTO animal_genealogy (animal_id, sire_id, dam_id, sire_name, dam_name)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE sire_id=VALUES(sire_id), dam_id=VALUES(dam_id),
           sire_name=VALUES(sire_name), dam_name=VALUES(dam_name)'
    );
    $stmt->execute([
        $animalId,
        $genealogy['sireId'] ?? null,
        $genealogy['damId'] ?? null,
        $genealogy['sireName'] ?? null,
        $genealogy['damName'] ?? null,
    ]);
}

if ($resource === 'animals') {
    if ($method === 'GET' && !$id) {
        $auth = require_auth($config['jwt_secret']);
        $q = trim($_GET['q'] ?? '');
        $sql = "SELECT a.*,
            (SELECT GROUP_CONCAT(c.name SEPARATOR ', ')
               FROM animal_owners ao INNER JOIN clients c ON c.id = ao.client_id
              WHERE ao.animal_id = a.id) AS owners
            FROM animals a WHERE 1=1";
        $params = [];
        if ($auth['role'] === 'cliente') {
            if (!$auth['clientId']) json_out([]);
            $sql .= ' AND EXISTS (SELECT 1 FROM animal_owners ao2 WHERE ao2.animal_id = a.id AND ao2.client_id = ?)';
            $params[] = $auth['clientId'];
        }
        if ($q !== '') {
            $sql .= ' AND (a.name LIKE ? OR a.registration_no LIKE ? OR a.chip_no LIKE ? OR a.breed LIKE ?)';
            $like = "%$q%";
            array_push($params, $like, $like, $like, $like);
        }
        $sql .= ' ORDER BY a.name ASC';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = array_map(function ($r) {
            $r['id'] = (string)$r['id'];
            $r['created_by'] = $r['created_by'] ? (string)$r['created_by'] : null;
            return $r;
        }, $stmt->fetchAll());
        json_out($rows);
    }

    if ($method === 'GET' && $id) {
        $auth = require_auth($config['jwt_secret']);
        $stmt = $pdo->prepare('SELECT * FROM animals WHERE id = ?');
        $stmt->execute([(int)$id]);
        $animal = $stmt->fetch();
        if (!$animal) json_out(['error' => 'Animal não encontrado'], 404);

        if ($auth['role'] === 'cliente') {
            $chk = $pdo->prepare('SELECT 1 FROM animal_owners WHERE animal_id = ? AND client_id = ?');
            $chk->execute([(int)$id, $auth['clientId']]);
            if (!$chk->fetch()) json_out(['error' => 'Sem permissão'], 403);
        }

        $ownersStmt = $pdo->prepare(
            'SELECT ao.id, ao.client_id, ao.share_pct, ao.is_primary, c.name AS client_name
             FROM animal_owners ao INNER JOIN clients c ON c.id = ao.client_id
             WHERE ao.animal_id = ? ORDER BY ao.is_primary DESC, c.name ASC'
        );
        $ownersStmt->execute([(int)$id]);
        $owners = array_map(function ($o) {
            return [
                'id' => (string)$o['id'],
                'clientId' => (string)$o['client_id'],
                'clientName' => $o['client_name'],
                'sharePct' => (float)$o['share_pct'],
                'isPrimary' => (bool)$o['is_primary'],
            ];
        }, $ownersStmt->fetchAll());

        $genStmt = $pdo->prepare('SELECT * FROM animal_genealogy WHERE animal_id = ?');
        $genStmt->execute([(int)$id]);
        $gen = $genStmt->fetch();

        $animal['id'] = (string)$animal['id'];
        $animal['owners'] = $owners;
        $animal['genealogy'] = $gen ? [
            'sireId' => $gen['sire_id'] ? (string)$gen['sire_id'] : null,
            'damId' => $gen['dam_id'] ? (string)$gen['dam_id'] : null,
            'sireName' => $gen['sire_name'],
            'damName' => $gen['dam_name'],
        ] : null;
        json_out($animal);
    }

    if ($method === 'POST') {
        $auth = require_auth($config['jwt_secret'], ['root', 'admin', 'user']);
        $name = trim($body['name'] ?? '');
        if ($name === '') json_out(['error' => 'Nome é obrigatório'], 400);
        try {
            $pdo->beginTransaction();
            $stmt = $pdo->prepare(
                'INSERT INTO animals (name, registration_no, chip_no, sex, breed, association, birth_date, color, resenha, status, ownership_type, notes, photo_url, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $stmt->execute([
                $name,
                $body['registration_no'] ?? null,
                $body['chip_no'] ?? null,
                $body['sex'] ?? null,
                $body['breed'] ?? null,
                $body['association'] ?? 'NENHUMA',
                $body['birth_date'] ?? null,
                $body['color'] ?? null,
                $body['resenha'] ?? null,
                $body['status'] ?? 'ativo',
                $body['ownership_type'] ?? 'unico',
                $body['notes'] ?? null,
                $body['photo_url'] ?? null,
                $auth['id'],
            ]);
            $animalId = (int)$pdo->lastInsertId();
            upsert_owners($pdo, $animalId, $body['owners'] ?? []);
            upsert_genealogy($pdo, $animalId, $body['genealogy'] ?? null);
            $pdo->commit();
            json_out(['success' => true, 'id' => (string)$animalId]);
        } catch (PDOException $e) {
            $pdo->rollBack();
            if ($e->getCode() == 23000) json_out(['error' => 'Chip já cadastrado'], 409);
            json_out(['error' => 'Erro ao criar animal'], 500);
        }
    }

    if ($method === 'PUT' && $id) {
        require_auth($config['jwt_secret'], ['root', 'admin', 'user']);
        $name = trim($body['name'] ?? '');
        if ($name === '') json_out(['error' => 'Nome é obrigatório'], 400);
        try {
            $pdo->beginTransaction();
            $stmt = $pdo->prepare(
                'UPDATE animals SET name=?, registration_no=?, chip_no=?, sex=?, breed=?, association=?, birth_date=?, color=?, resenha=?, status=?, ownership_type=?, notes=?, photo_url=? WHERE id=?'
            );
            $stmt->execute([
                $name,
                $body['registration_no'] ?? null,
                $body['chip_no'] ?? null,
                $body['sex'] ?? null,
                $body['breed'] ?? null,
                $body['association'] ?? 'NENHUMA',
                $body['birth_date'] ?? null,
                $body['color'] ?? null,
                $body['resenha'] ?? null,
                $body['status'] ?? 'ativo',
                $body['ownership_type'] ?? 'unico',
                $body['notes'] ?? null,
                $body['photo_url'] ?? null,
                (int)$id,
            ]);
            if (isset($body['owners']) && is_array($body['owners'])) {
                upsert_owners($pdo, (int)$id, $body['owners']);
            }
            if (isset($body['genealogy'])) {
                upsert_genealogy($pdo, (int)$id, $body['genealogy']);
            }
            $pdo->commit();
            json_out(['success' => true]);
        } catch (PDOException $e) {
            $pdo->rollBack();
            if ($e->getCode() == 23000) json_out(['error' => 'Chip já cadastrado'], 409);
            json_out(['error' => 'Erro ao atualizar animal'], 500);
        }
    }

    if ($method === 'DELETE' && $id) {
        require_auth($config['jwt_secret'], ['root', 'admin', 'user']);
        $animalId = (int)$id;
        try {
            $stmt = $pdo->prepare('SELECT photo_url FROM animals WHERE id = ?');
            $stmt->execute([$animalId]);
            $row = $stmt->fetch();
            if (!$row) {
                json_out(['error' => 'Animal não encontrado'], 404);
            }

            $del = $pdo->prepare('DELETE FROM animals WHERE id = ?');
            $del->execute([$animalId]);

            // Remove arquivo de foto se for upload local
            $photo = $row['photo_url'] ?? '';
            if (is_string($photo) && preg_match('#^/uploads/animals/[A-Za-z0-9._-]+$#', $photo)) {
                $file = __DIR__ . $photo;
                if (is_file($file)) {
                    @unlink($file);
                }
            }

            json_out(['success' => true, 'message' => 'Animal excluído']);
        } catch (PDOException $e) {
            json_out(['error' => 'Erro ao excluir animal'], 500);
        }
    }
}

// Users
if ($resource === 'users') {
    if ($method === 'GET' && !$id) {
        $auth = require_auth($config['jwt_secret'], ['root', 'admin']);
        $sql = 'SELECT id, username, email, name, avatar_url, role, client_id, active, must_change_password, created_at FROM users WHERE 1=1';
        if ($auth['role'] === 'admin') {
            $sql .= " AND role IN ('admin','user','cliente')";
        }
        $sql .= ' ORDER BY name ASC';
        $rows = $pdo->query($sql)->fetchAll();
        json_out(array_map('map_user', $rows));
    }

    if ($method === 'POST') {
        $auth = require_auth($config['jwt_secret'], ['root', 'admin']);
        $username = trim($body['username'] ?? '');
        $name = trim($body['name'] ?? '');
        $password = $body['password'] ?? '';
        $role = $body['role'] ?? 'user';
        if ($username === '' || $name === '' || $password === '') {
            json_out(['error' => 'Usuário, nome e senha são obrigatórios'], 400);
        }
        if (!in_array($role, ['root', 'admin', 'user', 'cliente'], true)) {
            json_out(['error' => 'Perfil inválido'], 400);
        }
        if ($auth['role'] === 'admin' && in_array($role, ['root', 'admin'], true)) {
            json_out(['error' => 'Admin não pode criar root/admin'], 403);
        }
        if ($role === 'cliente' && empty($body['clientId'])) {
            json_out(['error' => 'Cliente é obrigatório para perfil cliente'], 400);
        }
        try {
            $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
            $stmt = $pdo->prepare(
                'INSERT INTO users (username, email, password_hash, name, role, client_id, active, must_change_password)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 1)'
            );
            $stmt->execute([
                $username,
                $body['email'] ?? null,
                $hash,
                $name,
                $role,
                $role === 'cliente' ? (int)$body['clientId'] : null,
                isset($body['active']) && $body['active'] === false ? 0 : 1,
            ]);
            json_out(['success' => true, 'id' => (string)$pdo->lastInsertId()]);
        } catch (PDOException $e) {
            if ($e->getCode() == 23000) json_out(['error' => 'Usuário ou e-mail já existe'], 409);
            json_out(['error' => 'Erro ao criar usuário'], 500);
        }
    }

    if ($method === 'PUT' && $id) {
        $auth = require_auth($config['jwt_secret'], ['root', 'admin']);
        $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
        $stmt->execute([(int)$id]);
        $target = $stmt->fetch();
        if (!$target) json_out(['error' => 'Usuário não encontrado'], 404);
        if ($auth['role'] === 'admin' && in_array($target['role'], ['root', 'admin'], true)) {
            json_out(['error' => 'Sem permissão para editar este usuário'], 403);
        }
        $nextRole = $body['role'] ?? $target['role'];
        if ($auth['role'] === 'admin' && in_array($nextRole, ['root', 'admin'], true)) {
            json_out(['error' => 'Admin não pode definir perfil root/admin'], 403);
        }
        $hash = $target['password_hash'];
        if (!empty($body['password'])) {
            $hash = password_hash($body['password'], PASSWORD_BCRYPT, ['cost' => 12]);
        }
        try {
            $upd = $pdo->prepare(
                'UPDATE users SET username=?, email=?, password_hash=?, name=?, role=?, client_id=?, active=? WHERE id=?'
            );
            $upd->execute([
                trim($body['username'] ?? $target['username']),
                array_key_exists('email', $body) ? ($body['email'] ?: null) : $target['email'],
                $hash,
                trim($body['name'] ?? $target['name']),
                $nextRole,
                $nextRole === 'cliente' ? (int)($body['clientId'] ?? $target['client_id']) : null,
                isset($body['active']) && $body['active'] === false ? 0 : 1,
                (int)$id,
            ]);
            json_out(['success' => true]);
        } catch (PDOException $e) {
            if ($e->getCode() == 23000) json_out(['error' => 'Usuário ou e-mail já existe'], 409);
            json_out(['error' => 'Erro ao atualizar usuário'], 500);
        }
    }
}

// Contracts
if ($resource === 'contracts') {
    $contractSelect = "SELECT c.*,
        a.name AS animal_name, a.chip_no AS animal_chip, a.color AS animal_color,
        a.birth_date AS animal_birth_date, a.sex AS animal_sex,
        a.notes AS animal_notes,
        s.name AS seller_name, s.document AS seller_document, s.document_type AS seller_document_type,
        s.email AS seller_email, s.phone AS seller_phone, s.whatsapp AS seller_whatsapp,
        s.address AS seller_address, s.address_number AS seller_address_number,
        s.city AS seller_city, s.state AS seller_state,
        b.name AS buyer_name, b.document AS buyer_document, b.document_type AS buyer_document_type,
        b.email AS buyer_email, b.phone AS buyer_phone, b.whatsapp AS buyer_whatsapp,
        b.address AS buyer_address, b.address_number AS buyer_address_number,
        b.city AS buyer_city, b.state AS buyer_state,
        ass.name AS assessor_name,
        w1.name AS witness1_name, w1.email AS witness1_email,
        w2.name AS witness2_name, w2.email AS witness2_email,
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
      WHERE 1=1";

    if ($method === 'GET' && !$id) {
        $auth = require_auth($config['jwt_secret']);
        $sql = $contractSelect;
        $params = [];
        if ($auth['role'] === 'cliente') {
            if (!$auth['clientId']) json_out([]);
            $sql .= ' AND (c.buyer_id = ? OR c.seller_id = ? OR c.assessor_id = ?)';
            array_push($params, $auth['clientId'], $auth['clientId'], $auth['clientId']);
        }
        if (!empty($_GET['animalId'])) {
            $sql .= ' AND c.animal_id = ?';
            $params[] = (int)$_GET['animalId'];
        }
        if (!empty($_GET['status'])) {
            $sql .= ' AND c.status = ?';
            $params[] = $_GET['status'];
        }
        $sql .= ' ORDER BY c.created_at DESC';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        json_out(array_map('map_contract_row', $stmt->fetchAll()));
    }

    if ($method === 'GET' && $id && !$action) {
        $auth = require_auth($config['jwt_secret']);
        $stmt = $pdo->prepare($contractSelect . ' AND c.id = ?');
        $stmt->execute([(int)$id]);
        $r = $stmt->fetch();
        if (!$r) json_out(['error' => 'Contrato não encontrado'], 404);
        if ($auth['role'] === 'cliente') {
            $cid = (int)$auth['clientId'];
            if ((int)$r['buyer_id'] !== $cid && (int)$r['seller_id'] !== $cid && (int)($r['assessor_id'] ?? 0) !== $cid) {
                json_out(['error' => 'Sem permissão'], 403);
            }
        }
        $sig = $pdo->prepare('SELECT * FROM contract_signatures WHERE contract_id = ?');
        $sig->execute([(int)$id]);
        $signatures = array_map(function ($s) {
            return [
                'id' => (string)$s['id'],
                'party_role' => $s['party_role'],
                'client_id' => (string)$s['client_id'],
                'signer_name' => $s['signer_name'],
                'signed_at' => $s['signed_at'],
                'ip' => $s['ip'],
            ];
        }, $sig->fetchAll());
        $ch = $pdo->prepare('SELECT * FROM charges WHERE contract_id = ? ORDER BY installment_no ASC');
        $ch->execute([(int)$id]);
        $charges = array_map(function ($c) {
            return [
                'id' => (string)$c['id'],
                'contract_id' => (string)$c['contract_id'],
                'client_id' => (string)$c['client_id'],
                'installment_no' => (int)$c['installment_no'],
                'amount' => (float)$c['amount'],
                'due_date' => $c['due_date'],
                'payment_method' => $c['payment_method'],
                'status' => $c['status'],
                'paid_at' => $c['paid_at'],
                'notes' => $c['notes'],
            ];
        }, $ch->fetchAll());
        $out = map_contract_row($r);
        $out['signatures'] = $signatures;
        $out['charges'] = $charges;
        $pr = $pdo->prepare(
            'SELECT r.*, cl.name AS beneficiary_name FROM contract_payout_rules r
             LEFT JOIN clients cl ON cl.id = r.beneficiary_client_id
             WHERE r.contract_id = ? ORDER BY r.sort_order ASC, r.id ASC'
        );
        $pr->execute([(int)$id]);
        $out['payoutRules'] = array_map(function ($x) {
            return [
                'id' => (string)$x['id'],
                'beneficiary_role' => $x['beneficiary_role'],
                'beneficiary_client_id' => $x['beneficiary_client_id'] ? (string)$x['beneficiary_client_id'] : null,
                'beneficiary_name' => $x['beneficiary_name'] ?? null,
                'label' => $x['label'],
                'pct' => (float)$x['pct'],
            ];
        }, $pr->fetchAll());
        json_out($out);
    }

    if ($method === 'POST' && !$id) {
        $auth = require_auth($config['jwt_secret'], ['root', 'admin', 'user']);
        $animalId = (int)($body['animalId'] ?? 0);
        $sellerId = (int)($body['sellerId'] ?? 0);
        $buyerId = (int)($body['buyerId'] ?? 0);
        $assessorId = !empty($body['assessorId']) ? (int)$body['assessorId'] : null;
        $saleType = $body['saleType'] ?? 'inteiro';
        $sharePct = $body['sharePct'] ?? null;
        $total = (float)($body['totalAmount'] ?? 0);
        $methodPay = $body['paymentMethod'] ?? 'boleto';
        $n = (int)($body['installments'] ?? 1);
        $firstDue = $body['firstDueDate'] ?? '';
        if (!$animalId || !$sellerId || !$buyerId || $total <= 0 || $firstDue === '') {
            json_out(['error' => 'Animal, vendedor, comprador, valor e 1º vencimento são obrigatórios'], 400);
        }
        if (trim((string)($saleType ?? '')) === '') {
            json_out(['error' => 'Tipo de venda é obrigatório'], 400);
        }
        $saleType = trim((string)$saleType);
        if (!in_array($methodPay, ['pix', 'boleto', 'transferencia', 'outro'], true)) {
            json_out(['error' => 'Forma de pagamento inválida'], 400);
        }
        $n = max(1, min(40, $n));
        $sharePct = isset($body['sharePct']) ? (float)$body['sharePct'] : (float)($sharePct ?? 0);
        if (!$sharePct || $sharePct <= 0 || $sharePct > 100) {
            json_out(['error' => 'Informe o percentual de cotas (1–100)'], 400);
        }
        $auctionId = !empty($body['auctionId']) ? (int)$body['auctionId'] : null;
        $lotId = !empty($body['lotId']) ? (int)$body['lotId'] : null;
        $templateId = !empty($body['templateId']) ? (int)$body['templateId'] : null;
        $lotLabel = $body['lotLabel'] ?? null;
        $animalCategory = $body['animalCategory'] ?? null;
        $quantity = array_key_exists('quantity', $body) && $body['quantity'] !== '' && $body['quantity'] !== null
            ? (float)$body['quantity'] : 1;
        $commissionTotalPct = array_key_exists('commissionTotalPct', $body) && $body['commissionTotalPct'] !== '' && $body['commissionTotalPct'] !== null
            ? (float)$body['commissionTotalPct'] : null;
        $commissionBuyerPct = array_key_exists('commissionBuyerPct', $body) && $body['commissionBuyerPct'] !== '' && $body['commissionBuyerPct'] !== null
            ? (float)$body['commissionBuyerPct'] : null;
        $commissionSellerPct = array_key_exists('commissionSellerPct', $body) && $body['commissionSellerPct'] !== '' && $body['commissionSellerPct'] !== null
            ? (float)$body['commissionSellerPct'] : null;
        $witness1Id = !empty($body['witness1Id']) ? (int)$body['witness1Id'] : null;
        $witness2Id = !empty($body['witness2Id']) ? (int)$body['witness2Id'] : null;
        $viaLabel = $body['viaLabel'] ?? 'VIA DAS PARTES — VENDEDOR E COMPRADOR';

        try {
            if (!$templateId) {
                $def = $pdo->query('SELECT id FROM contract_templates WHERE is_default = 1 AND active = 1 LIMIT 1')->fetch();
                if ($def) $templateId = (int)$def['id'];
            }

            $pdo->beginTransaction();
            $ins = $pdo->prepare(
                'INSERT INTO contracts
                 (animal_id, sale_type, share_pct, seller_id, buyer_id, assessor_id, auction_id, lot_id,
                  template_id, verso_title, verso_body, lot_label, animal_category, quantity,
                  commission_total_pct, commission_buyer_pct, commission_seller_pct,
                  witness1_id, witness2_id, via_label,
                  total_amount, payment_method, installments, first_due_date, status, notes, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $ins->execute([
                $animalId, $saleType, $sharePct, $sellerId, $buyerId, $assessorId,
                $auctionId, $lotId,
                $templateId,
                $body['versoTitle'] ?? null,
                $body['versoBody'] ?? null,
                $lotLabel, $animalCategory, $quantity,
                $commissionTotalPct, $commissionBuyerPct, $commissionSellerPct,
                $witness1Id, $witness2Id, $viaLabel,
                $total, $methodPay, $n, $firstDue, 'aguardando_assinatura',
                $body['notes'] ?? null, $auth['id'],
            ]);
            $contractId = (int)$pdo->lastInsertId();
            $contractNumber = sprintf('%08d-%d', (10000000 + $contractId) % 100000000, (int)date('Y'));
            $pdo->prepare('UPDATE contracts SET contract_number = ? WHERE id = ?')->execute([$contractNumber, $contractId]);
            generate_charges(
                $pdo, $contractId, $buyerId, $total, $n, $firstDue, $methodPay,
                normalize_schedule($body['schedule'] ?? null, $n, $total)
            );
            generate_payouts($pdo, $contractId, $body['payoutRules'] ?? []);
            if ($lotId) {
                $pdo->prepare(
                    "UPDATE auction_lots SET status = 'arrematado', contract_id = ? WHERE id = ? AND status = 'disponivel'"
                )->execute([$contractId, $lotId]);
            }
            $pdo->commit();
            json_out(['success' => true, 'id' => (string)$contractId, 'contractNumber' => $contractNumber]);
        } catch (InvalidArgumentException $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            json_out(['error' => $e->getMessage()], 400);
        } catch (PDOException $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            json_out(['error' => 'Erro ao criar contrato', 'detail' => $e->getMessage()], 500);
        }
    }

    if ($method === 'PUT' && $id && !$action) {
        require_auth($config['jwt_secret'], ['root', 'admin', 'user']);
        $stmt = $pdo->prepare('SELECT * FROM contracts WHERE id = ?');
        $stmt->execute([(int)$id]);
        $existing = $stmt->fetch();
        if (!$existing) json_out(['error' => 'Contrato não encontrado'], 404);
        if (in_array($existing['status'], ['cancelado', 'concluido'], true)) {
            json_out(['error' => 'Contrato cancelado ou concluído não pode ser editado'], 400);
        }

        $fields = [];
        $params = [];
        $set = function ($col, $val) use (&$fields, &$params) {
            $fields[] = "$col=?";
            $params[] = $val;
        };

        if (array_key_exists('status', $body) && $body['status'] !== null) {
            if (!in_array($body['status'], ['rascunho','aguardando_assinatura','ativo','concluido','cancelado'], true)) {
                json_out(['error' => 'Status inválido'], 400);
            }
            $set('status', $body['status']);
        }
        if (array_key_exists('notes', $body)) $set('notes', $body['notes']);
        if (array_key_exists('saleType', $body) && $body['saleType'] !== null) {
            $saleType = trim((string)$body['saleType']);
            if ($saleType === '') json_out(['error' => 'Tipo de venda é obrigatório'], 400);
            $set('sale_type', $saleType);
            if (array_key_exists('sharePct', $body)) $set('share_pct', (float)$body['sharePct']);
        } elseif (array_key_exists('sharePct', $body)) {
            $set('share_pct', (float)$body['sharePct']);
        }
        if (!empty($body['sellerId'])) $set('seller_id', (int)$body['sellerId']);
        if (!empty($body['buyerId'])) $set('buyer_id', (int)$body['buyerId']);
        if (array_key_exists('assessorId', $body)) {
            $set('assessor_id', !empty($body['assessorId']) ? (int)$body['assessorId'] : null);
        }
        if (array_key_exists('templateId', $body)) {
            $set('template_id', !empty($body['templateId']) ? (int)$body['templateId'] : null);
        }
        if (array_key_exists('versoTitle', $body)) $set('verso_title', $body['versoTitle'] ?: null);
        if (array_key_exists('versoBody', $body)) $set('verso_body', $body['versoBody'] ?: null);
        if (array_key_exists('lotLabel', $body)) $set('lot_label', $body['lotLabel'] ?: null);
        if (array_key_exists('animalCategory', $body)) $set('animal_category', $body['animalCategory'] ?: null);
        if (array_key_exists('quantity', $body) && $body['quantity'] !== null) {
            $set('quantity', max(1, (int)$body['quantity']));
        }
        if (array_key_exists('commissionTotalPct', $body)) {
            $set('commission_total_pct', $body['commissionTotalPct'] !== '' && $body['commissionTotalPct'] !== null ? (float)$body['commissionTotalPct'] : null);
        }
        if (array_key_exists('commissionBuyerPct', $body)) {
            $set('commission_buyer_pct', $body['commissionBuyerPct'] !== '' && $body['commissionBuyerPct'] !== null ? (float)$body['commissionBuyerPct'] : null);
        }
        if (array_key_exists('commissionSellerPct', $body)) {
            $set('commission_seller_pct', $body['commissionSellerPct'] !== '' && $body['commissionSellerPct'] !== null ? (float)$body['commissionSellerPct'] : null);
        }
        if (array_key_exists('witness1Id', $body)) {
            $set('witness1_id', !empty($body['witness1Id']) ? (int)$body['witness1Id'] : null);
        }
        if (array_key_exists('witness2Id', $body)) {
            $set('witness2_id', !empty($body['witness2Id']) ? (int)$body['witness2Id'] : null);
        }
        if (array_key_exists('totalAmount', $body) && $body['totalAmount'] !== null) {
            $total = (float)$body['totalAmount'];
            if ($total <= 0) json_out(['error' => 'Valor inválido'], 400);
            $set('total_amount', $total);
        }
        if (!empty($body['paymentMethod'])) {
            if (!in_array($body['paymentMethod'], ['pix', 'boleto', 'transferencia', 'outro'], true)) {
                json_out(['error' => 'Forma de pagamento inválida'], 400);
            }
            $set('payment_method', $body['paymentMethod']);
        }
        if (!empty($body['firstDueDate'])) $set('first_due_date', $body['firstDueDate']);
        if (array_key_exists('installments', $body) && $body['installments'] !== null) {
            $set('installments', max(1, min(40, (int)$body['installments'])));
        }

        if (!$fields) json_out(['error' => 'Nada para atualizar'], 400);

        $nextTotal = array_key_exists('totalAmount', $body) && $body['totalAmount'] !== null
            ? (float)$body['totalAmount'] : (float)$existing['total_amount'];
        $nextBuyer = !empty($body['buyerId']) ? (int)$body['buyerId'] : (int)$existing['buyer_id'];
        $nextMethod = !empty($body['paymentMethod']) ? $body['paymentMethod'] : $existing['payment_method'];
        $nextFirstDue = !empty($body['firstDueDate']) ? $body['firstDueDate'] : $existing['first_due_date'];
        $nextInstallments = array_key_exists('installments', $body) && $body['installments'] !== null
            ? max(1, min(40, (int)$body['installments']))
            : (int)$existing['installments'];

        $existingFirstDue = substr((string)$existing['first_due_date'], 0, 10);
        $nextFirstDueNorm = substr((string)$nextFirstDue, 0, 10);

        $agg = $pdo->prepare('SELECT COALESCE(SUM(amount),0) AS total_sum, COUNT(*) AS qty FROM charges WHERE contract_id = ?');
        $agg->execute([(int)$id]);
        $chargeAgg = $agg->fetch();

        $financeChanged =
            abs($nextTotal - (float)$existing['total_amount']) > 0.001
            || $nextBuyer !== (int)$existing['buyer_id']
            || $nextMethod !== $existing['payment_method']
            || $nextFirstDueNorm !== $existingFirstDue
            || $nextInstallments !== (int)$existing['installments'];

        $chargesOutOfSync =
            abs((float)$chargeAgg['total_sum'] - $nextTotal) > 0.02
            || (int)$chargeAgg['qty'] !== $nextInstallments;

        try {
            $schedule = normalize_schedule($body['schedule'] ?? null, $nextInstallments, $nextTotal);
        } catch (InvalidArgumentException $e) {
            json_out(['error' => $e->getMessage()], 400);
        }

        $isCancelling = array_key_exists('status', $body) && $body['status'] === 'cancelado';
        $shouldRecalc = !$isCancelling && ($schedule !== null || !empty($body['recalcCharges']) || $financeChanged || $chargesOutOfSync);

        if ($shouldRecalc) {
            $paid = $pdo->prepare("SELECT COUNT(*) FROM charges WHERE contract_id = ? AND status = 'pago'");
            $paid->execute([(int)$id]);
            if ((int)$paid->fetchColumn() > 0) {
                json_out(['error' => 'Não é possível recalcular parcelas: já existem cobranças pagas neste contrato'], 400);
            }
        }

        try {
            $pdo->beginTransaction();
            $params[] = (int)$id;
            $pdo->prepare('UPDATE contracts SET ' . implode(',', $fields) . ' WHERE id=?')->execute($params);

            if ($isCancelling) {
                $pdo->prepare(
                    "UPDATE charges SET status = 'cancelado' WHERE contract_id = ? AND status != 'pago'"
                )->execute([(int)$id]);
                $pdo->prepare(
                    "UPDATE payouts SET status = 'cancelado' WHERE contract_id = ? AND status != 'pago'"
                )->execute([(int)$id]);
            }

            if ($shouldRecalc) {
                $rulesStmt = $pdo->prepare(
                    'SELECT beneficiary_role, beneficiary_client_id, label, pct
                     FROM contract_payout_rules WHERE contract_id = ? ORDER BY sort_order ASC, id ASC'
                );
                $rulesStmt->execute([(int)$id]);
                $ruleRows = $rulesStmt->fetchAll();
                generate_charges(
                    $pdo, (int)$id, $nextBuyer, $nextTotal, $nextInstallments, $nextFirstDueNorm, $nextMethod, $schedule
                );
                generate_payouts($pdo, (int)$id, array_map(function ($r) {
                    return [
                        'beneficiaryRole' => $r['beneficiary_role'],
                        'beneficiaryClientId' => $r['beneficiary_client_id'],
                        'label' => $r['label'],
                        'pct' => (float)$r['pct'],
                    ];
                }, $ruleRows));
            }

            $pdo->commit();
            json_out(['success' => true, 'chargesRecalculated' => $shouldRecalc]);
        } catch (InvalidArgumentException $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            json_out(['error' => $e->getMessage()], 400);
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            json_out(['error' => 'Erro ao atualizar contrato'], 500);
        }
    }

    if ($method === 'GET' && $id && $action === 'clicksign' && $subId === 'signed-pdf') {
        require_auth($config['jwt_secret'], ['root', 'admin', 'user']);
        $stmt = $pdo->prepare($contractSelect . ' AND c.id = ?');
        $stmt->execute([(int)$id]);
        $r = $stmt->fetch();
        if (!$r) json_out(['error' => 'Contrato não encontrado'], 404);
        if (empty($r['clicksign_envelope_id']) || empty($r['clicksign_document_id'])) {
            json_out(['error' => 'Contrato sem documento na Clicksign'], 400);
        }
        try {
            $url = clicksign_get_signed_file_url($config, map_contract_row($r));
            if (!$url) {
                json_out([
                    'error' => 'Cópia assinada ainda não disponível. Aguarde a finalização de todas as assinaturas.',
                ], 404);
            }
            json_out(['success' => true, 'url' => $url]);
        } catch (InvalidArgumentException $e) {
            json_out(['error' => $e->getMessage()], 400);
        } catch (Throwable $e) {
            json_out(['error' => 'Falha ao obter PDF assinado: ' . $e->getMessage()], 500);
        }
    }

    if ($method === 'GET' && $id && $action === 'clicksign' && !$subId) {
        require_auth($config['jwt_secret'], ['root', 'admin', 'user']);
        $stmt = $pdo->prepare($contractSelect . ' AND c.id = ?');
        $stmt->execute([(int)$id]);
        $r = $stmt->fetch();
        if (!$r) json_out(['error' => 'Contrato não encontrado'], 404);
        if (empty($r['clicksign_envelope_id'])) {
            json_out(['error' => 'Contrato ainda não foi enviado à Clicksign'], 400);
        }
        try {
            $statusInfo = clicksign_fetch_status($config, map_contract_row($r));
            if (($statusInfo['status'] ?? '') === 'closed') {
                try {
                    $statusInfo['signedFileUrl'] = clicksign_get_signed_file_url($config, map_contract_row($r));
                } catch (Throwable $e) {
                    $statusInfo['signedFileUrl'] = null;
                }
            }
            $pdo->prepare('UPDATE contracts SET clicksign_status=? WHERE id=?')
                ->execute([$statusInfo['status'], (int)$id]);
            if ($statusInfo['status'] === 'closed' && ($r['status'] ?? '') === 'aguardando_assinatura') {
                $pdo->prepare("UPDATE contracts SET status='ativo' WHERE id=?")->execute([(int)$id]);
            }
            json_out(['success' => true] + $statusInfo);
        } catch (InvalidArgumentException $e) {
            json_out(['error' => $e->getMessage()], 400);
        } catch (Throwable $e) {
            json_out(['error' => 'Falha ao consultar Clicksign: ' . $e->getMessage()], 500);
        }
    }

    if ($method === 'POST' && $id && $action === 'clicksign') {
        require_auth($config['jwt_secret'], ['root', 'admin', 'user']);
        $stmt = $pdo->prepare($contractSelect . ' AND c.id = ?');
        $stmt->execute([(int)$id]);
        $r = $stmt->fetch();
        if (!$r) json_out(['error' => 'Contrato não encontrado'], 404);
        if (in_array($r['status'], ['cancelado', 'concluido'], true)) {
            json_out(['error' => 'Contrato cancelado ou concluído não pode ser enviado'], 400);
        }
        if (!empty($r['clicksign_envelope_id']) && ($r['clicksign_status'] ?? '') === 'running') {
            json_out([
                'error' => 'Este contrato já foi enviado à Clicksign',
                'envelopeId' => $r['clicksign_envelope_id'],
            ], 400);
        }
        $pdf = (string)($body['pdfBase64'] ?? '');
        try {
            $sent = clicksign_send_contract($config, map_contract_row($r), $pdf);
            $pdo->prepare(
                'UPDATE contracts SET clicksign_envelope_id=?, clicksign_document_id=?, clicksign_status=?, clicksign_sent_at=NOW(), status=? WHERE id=?'
            )->execute([
                $sent['envelopeId'],
                $sent['documentId'],
                $sent['status'],
                'aguardando_assinatura',
                (int)$id,
            ]);
            json_out([
                'success' => true,
                'envelopeId' => $sent['envelopeId'],
                'documentId' => $sent['documentId'],
                'status' => $sent['status'],
            ]);
        } catch (InvalidArgumentException $e) {
            json_out(['error' => $e->getMessage()], 400);
        } catch (Throwable $e) {
            json_out(['error' => 'Falha ao enviar para Clicksign: ' . $e->getMessage()], 500);
        }
    }

    if ($method === 'POST' && $id && $action === 'sign') {
        $auth = require_auth($config['jwt_secret']);
        $partyRole = $body['partyRole'] ?? '';
        $signerName = trim($body['signerName'] ?? '');
        $accepted = !empty($body['accepted']);
        if (!in_array($partyRole, ['seller', 'buyer', 'assessor', 'witness1', 'witness2'], true) || $signerName === '' || !$accepted) {
            json_out(['error' => 'Informe o papel, o nome e confirme o aceite'], 400);
        }
        $stmt = $pdo->prepare('SELECT * FROM contracts WHERE id = ?');
        $stmt->execute([(int)$id]);
        $contract = $stmt->fetch();
        if (!$contract) json_out(['error' => 'Contrato não encontrado'], 404);
        if ($contract['status'] === 'cancelado') json_out(['error' => 'Contrato cancelado'], 400);

        $clientId = null;
        if ($partyRole === 'seller') $clientId = (int)$contract['seller_id'];
        if ($partyRole === 'buyer') $clientId = (int)$contract['buyer_id'];
        if ($partyRole === 'assessor') $clientId = $contract['assessor_id'] ? (int)$contract['assessor_id'] : null;
        if ($partyRole === 'witness1') $clientId = !empty($contract['witness1_id']) ? (int)$contract['witness1_id'] : null;
        if ($partyRole === 'witness2') $clientId = !empty($contract['witness2_id']) ? (int)$contract['witness2_id'] : null;
        if (!$clientId) json_out(['error' => 'Papel não se aplica a este contrato'], 400);

        if ($auth['role'] === 'cliente' && (int)$auth['clientId'] !== $clientId) {
            json_out(['error' => 'Sem permissão para assinar neste papel'], 403);
        }

        try {
            $pdo->prepare(
                'INSERT INTO contract_signatures (contract_id, party_role, client_id, signer_name, ip, user_agent)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE signer_name=VALUES(signer_name), signed_at=CURRENT_TIMESTAMP, ip=VALUES(ip), user_agent=VALUES(user_agent)'
            )->execute([
                (int)$id, $partyRole, $clientId, $signerName, client_ip(), substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 500),
            ]);

            $need = ['seller', 'buyer'];
            if ($contract['assessor_id']) $need[] = 'assessor';
            if (!empty($contract['witness1_id'])) $need[] = 'witness1';
            if (!empty($contract['witness2_id'])) $need[] = 'witness2';
            $sig = $pdo->prepare('SELECT party_role FROM contract_signatures WHERE contract_id = ?');
            $sig->execute([(int)$id]);
            $have = array_column($sig->fetchAll(), 'party_role');
            $all = !array_diff($need, $have);
            if ($all && in_array($contract['status'], ['rascunho', 'aguardando_assinatura'], true)) {
                $pdo->prepare("UPDATE contracts SET status = 'ativo' WHERE id = ?")->execute([(int)$id]);
            }
            json_out(['success' => true, 'activated' => $all]);
        } catch (PDOException $e) {
            json_out(['error' => 'Erro ao registrar assinatura'], 500);
        }
    }
}

// Charges
if ($resource === 'charges') {
    if ($method === 'GET' && !$id) {
        $auth = require_auth($config['jwt_secret']);
        sync_cancelled_contract_finance($pdo);
        $sql = "SELECT ch.*, a.name AS animal_name, c.status AS contract_status, cl.name AS client_name
                FROM charges ch
                INNER JOIN contracts c ON c.id = ch.contract_id
                INNER JOIN animals a ON a.id = c.animal_id
                INNER JOIN clients cl ON cl.id = ch.client_id
                WHERE 1=1";
        $params = [];
        if ($auth['role'] === 'cliente') {
            if (!$auth['clientId']) json_out([]);
            $sql .= ' AND (ch.client_id = ? OR c.seller_id = ?)';
            array_push($params, $auth['clientId'], $auth['clientId']);
        }
        $statusFilter = isset($_GET['status']) ? (string)$_GET['status'] : '';
        if ($statusFilter === 'cancelado') {
            $sql .= " AND ch.status = 'cancelado'";
        } elseif ($statusFilter === 'atrasado') {
            $sql .= " AND c.status != 'cancelado' AND ch.status = 'pendente' AND ch.due_date < CURDATE()";
        } elseif ($statusFilter !== '') {
            $sql .= " AND c.status != 'cancelado' AND ch.status = ?";
            $params[] = $statusFilter;
        } else {
            $sql .= " AND c.status != 'cancelado' AND ch.status != 'cancelado'";
        }
        if (!empty($_GET['contractId'])) {
            $sql .= ' AND ch.contract_id = ?';
            $params[] = (int)$_GET['contractId'];
        }
        if (!empty($_GET['clientId'])) {
            $sql .= ' AND ch.client_id = ?';
            $params[] = (int)$_GET['clientId'];
        }
        $sql .= ' ORDER BY ch.due_date ASC, ch.installment_no ASC';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $today = date('Y-m-d');
        $rows = array_map(function ($c) use ($today) {
            $status = $c['status'];
            if ($status === 'pendente' && $c['due_date'] < $today) $status = 'atrasado';
            return [
                'id' => (string)$c['id'],
                'contract_id' => (string)$c['contract_id'],
                'client_id' => (string)$c['client_id'],
                'client_name' => $c['client_name'],
                'animal_name' => $c['animal_name'],
                'installment_no' => (int)$c['installment_no'],
                'amount' => (float)$c['amount'],
                'due_date' => $c['due_date'],
                'payment_method' => $c['payment_method'],
                'status' => $status,
                'paid_at' => $c['paid_at'],
                'notes' => $c['notes'],
            ];
        }, $stmt->fetchAll());
        json_out($rows);
    }

    if ($method === 'PUT' && $id) {
        require_auth($config['jwt_secret'], ['root', 'admin', 'user']);
        $status = $body['status'] ?? '';
        if (!in_array($status, ['pendente', 'pago', 'atrasado', 'cancelado'], true)) {
            json_out(['error' => 'Status inválido'], 400);
        }
        $paidAt = $status === 'pago' ? date('Y-m-d H:i:s') : null;
        $pdo->prepare('UPDATE charges SET status=?, paid_at=?, notes=? WHERE id=?')->execute([
            $status,
            $paidAt,
            $body['notes'] ?? null,
            (int)$id,
        ]);
        if ($status === 'pago') {
            $pdo->prepare("UPDATE payouts SET status = 'pendente' WHERE charge_id = ? AND status = 'aguardando'")
                ->execute([(int)$id]);
        } elseif ($status === 'pendente' || $status === 'atrasado') {
            $pdo->prepare("UPDATE payouts SET status = 'aguardando', paid_at = NULL WHERE charge_id = ? AND status IN ('pendente','aguardando')")
                ->execute([(int)$id]);
        } elseif ($status === 'cancelado') {
            $pdo->prepare("UPDATE payouts SET status = 'cancelado' WHERE charge_id = ? AND status != 'pago'")
                ->execute([(int)$id]);
        }
        json_out(['success' => true]);
    }
}

// Auctions
if ($resource === 'auctions') {
    if ($method === 'GET' && !$id) {
        require_auth($config['jwt_secret']);
        $rows = $pdo->query(
            "SELECT a.*, (SELECT COUNT(*) FROM auction_lots l WHERE l.auction_id = a.id) AS lots_count
             FROM auctions a
             ORDER BY COALESCE(a.auction_date, a.created_at) DESC, a.id DESC"
        )->fetchAll();
        json_out(array_map('map_auction_row', $rows));
    }

    if ($method === 'GET' && $id && !$action) {
        require_auth($config['jwt_secret']);
        $stmt = $pdo->prepare('SELECT * FROM auctions WHERE id = ?');
        $stmt->execute([(int)$id]);
        $r = $stmt->fetch();
        if (!$r) json_out(['error' => 'Leilão não encontrado'], 404);
        $lots = $pdo->prepare(
            'SELECT l.*, an.name AS animal_name, s.name AS seller_name
             FROM auction_lots l
             INNER JOIN animals an ON an.id = l.animal_id
             INNER JOIN clients s ON s.id = l.seller_id
             WHERE l.auction_id = ?
             ORDER BY l.lot_number ASC, l.id ASC'
        );
        $lots->execute([(int)$id]);
        $out = map_auction_row($r);
        $out['lots'] = attach_lot_sellers($pdo, $lots->fetchAll());
        json_out($out);
    }

    if ($method === 'POST' && !$id) {
        $auth = require_auth($config['jwt_secret'], ['root', 'admin', 'user']);
        $name = trim($body['name'] ?? '');
        if ($name === '') json_out(['error' => 'Nome do leilão é obrigatório'], 400);
        $status = $body['status'] ?? 'rascunho';
        if (!in_array($status, ['rascunho','agendado','em_andamento','encerrado','cancelado'], true)) {
            $status = 'rascunho';
        }
        $pdo->prepare(
            'INSERT INTO auctions (name, auction_date, location, organizer, status, notes, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        )->execute([
            $name,
            $body['auctionDate'] ?? null,
            $body['location'] ?? null,
            $body['organizer'] ?? null,
            $status,
            $body['notes'] ?? null,
            $auth['id'],
        ]);
        json_out(['success' => true, 'id' => (string)$pdo->lastInsertId()]);
    }

    if ($method === 'PUT' && $id && !$action) {
        require_auth($config['jwt_secret'], ['root', 'admin', 'user']);
        $fields = [];
        $params = [];
        if (array_key_exists('name', $body)) { $fields[] = 'name=?'; $params[] = trim($body['name']); }
        if (array_key_exists('auctionDate', $body)) { $fields[] = 'auction_date=?'; $params[] = $body['auctionDate'] ?: null; }
        if (array_key_exists('location', $body)) { $fields[] = 'location=?'; $params[] = $body['location'] ?: null; }
        if (array_key_exists('organizer', $body)) { $fields[] = 'organizer=?'; $params[] = $body['organizer'] ?: null; }
        if (array_key_exists('status', $body)) {
            if (!in_array($body['status'], ['rascunho','agendado','em_andamento','encerrado','cancelado'], true)) {
                json_out(['error' => 'Status inválido'], 400);
            }
            $fields[] = 'status=?';
            $params[] = $body['status'];
        }
        if (array_key_exists('notes', $body)) { $fields[] = 'notes=?'; $params[] = $body['notes'] ?: null; }
        if (!$fields) json_out(['error' => 'Nada para atualizar'], 400);
        $params[] = (int)$id;
        $pdo->prepare('UPDATE auctions SET ' . implode(',', $fields) . ' WHERE id=?')->execute($params);
        json_out(['success' => true]);
    }
}

// Auction lots
if ($resource === 'auction-lots') {
    if ($method === 'GET' && !$id) {
        require_auth($config['jwt_secret']);
        $sql = 'SELECT l.*, an.name AS animal_name, s.name AS seller_name
                FROM auction_lots l
                INNER JOIN animals an ON an.id = l.animal_id
                INNER JOIN clients s ON s.id = l.seller_id
                WHERE 1=1';
        $params = [];
        if (!empty($_GET['auctionId'])) {
            $sql .= ' AND l.auction_id = ?';
            $params[] = (int)$_GET['auctionId'];
        }
        if (!empty($_GET['status'])) {
            $sql .= ' AND l.status = ?';
            $params[] = $_GET['status'];
        }
        $sql .= ' ORDER BY l.lot_number ASC, l.id ASC';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        json_out(attach_lot_sellers($pdo, $stmt->fetchAll()));
    }

    if ($method === 'POST' && !$id) {
        require_auth($config['jwt_secret'], ['root', 'admin', 'user']);
        $auctionId = (int)($body['auctionId'] ?? 0);
        $animalId = (int)($body['animalId'] ?? 0);
        $sellers = normalize_lot_sellers($body);
        if (!$auctionId || !$animalId || !$sellers) {
            json_out(['error' => 'Leilão, animal e ao menos um vendedor são obrigatórios'], 400);
        }
        $primary = null;
        foreach ($sellers as $s) {
            if (!empty($s['isPrimary'])) { $primary = $s; break; }
        }
        if (!$primary) $primary = $sellers[0];
        try {
            $pdo->beginTransaction();
            $pdo->prepare(
                "INSERT INTO auction_lots (auction_id, animal_id, lot_number, seller_id, min_price, conditions_text, status)
                 VALUES (?, ?, ?, ?, ?, ?, 'disponivel')"
            )->execute([
                $auctionId,
                $animalId,
                $body['lotNumber'] ?? null,
                $primary['clientId'],
                isset($body['minPrice']) && $body['minPrice'] !== '' ? (float)$body['minPrice'] : null,
                $body['conditionsText'] ?? null,
            ]);
            $lotId = (int)$pdo->lastInsertId();
            try {
                upsert_lot_sellers($pdo, $lotId, $sellers);
            } catch (Throwable $e) {
                /* tabela pode não existir ainda */
            }
            $pdo->commit();
            json_out(['success' => true, 'id' => (string)$lotId]);
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            json_out(['error' => 'Erro ao criar lote'], 500);
        }
    }

    if ($method === 'PUT' && $id) {
        require_auth($config['jwt_secret'], ['root', 'admin', 'user']);
        $fields = [];
        $params = [];
        $sellers = normalize_lot_sellers($body);
        if (array_key_exists('lotNumber', $body)) { $fields[] = 'lot_number=?'; $params[] = $body['lotNumber'] ?: null; }
        if (array_key_exists('minPrice', $body)) {
            $fields[] = 'min_price=?';
            $params[] = ($body['minPrice'] !== '' && $body['minPrice'] !== null) ? (float)$body['minPrice'] : null;
        }
        if (array_key_exists('conditionsText', $body)) { $fields[] = 'conditions_text=?'; $params[] = $body['conditionsText'] ?: null; }
        if ($sellers) {
            $primary = null;
            foreach ($sellers as $s) {
                if (!empty($s['isPrimary'])) { $primary = $s; break; }
            }
            if (!$primary) $primary = $sellers[0];
            $fields[] = 'seller_id=?';
            $params[] = $primary['clientId'];
        } elseif (array_key_exists('sellerId', $body)) {
            $fields[] = 'seller_id=?';
            $params[] = (int)$body['sellerId'];
        }
        if (array_key_exists('status', $body)) {
            if (!in_array($body['status'], ['disponivel','arrematado','retirado'], true)) {
                json_out(['error' => 'Status inválido'], 400);
            }
            $fields[] = 'status=?';
            $params[] = $body['status'];
        }
        if (!$fields && !$sellers) json_out(['error' => 'Nada para atualizar'], 400);
        try {
            $pdo->beginTransaction();
            if ($fields) {
                $params[] = (int)$id;
                $pdo->prepare('UPDATE auction_lots SET ' . implode(',', $fields) . ' WHERE id=?')->execute($params);
            }
            if ($sellers) {
                try {
                    upsert_lot_sellers($pdo, (int)$id, $sellers);
                } catch (Throwable $e) {
                    /* ignore missing table */
                }
            }
            $pdo->commit();
            json_out(['success' => true]);
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            json_out(['error' => 'Erro ao atualizar lote'], 500);
        }
    }
}

// Payouts / Repasses
if ($resource === 'payouts') {
    if ($method === 'GET' && !$id) {
        $auth = require_auth($config['jwt_secret']);
        sync_cancelled_contract_finance($pdo);
        $sql = "SELECT p.*, cl.name AS beneficiary_name, a.name AS animal_name,
                       ch.status AS charge_status, ch.due_date AS charge_due_date
                FROM payouts p
                INNER JOIN contracts c ON c.id = p.contract_id
                INNER JOIN animals a ON a.id = c.animal_id
                INNER JOIN charges ch ON ch.id = p.charge_id
                LEFT JOIN clients cl ON cl.id = p.beneficiary_client_id
                WHERE 1=1";
        $params = [];
        if ($auth['role'] === 'cliente') {
            if (!$auth['clientId']) json_out([]);
            $sql .= ' AND p.beneficiary_client_id = ?';
            $params[] = $auth['clientId'];
        }
        $statusFilter = isset($_GET['status']) ? (string)$_GET['status'] : '';
        if ($statusFilter === 'cancelado') {
            $sql .= " AND p.status = 'cancelado'";
        } elseif ($statusFilter !== '') {
            $sql .= " AND c.status != 'cancelado' AND p.status = ?";
            $params[] = $statusFilter;
        } else {
            $sql .= " AND c.status != 'cancelado' AND p.status != 'cancelado'";
        }
        if (!empty($_GET['contractId'])) {
            $sql .= ' AND p.contract_id = ?';
            $params[] = (int)$_GET['contractId'];
        }
        $sql .= ' ORDER BY ch.due_date ASC, p.installment_no ASC, p.id ASC';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        json_out(array_map('map_payout_row', $stmt->fetchAll()));
    }

    if ($method === 'PUT' && $id) {
        require_auth($config['jwt_secret'], ['root', 'admin', 'user']);
        $status = $body['status'] ?? '';
        if (!in_array($status, ['aguardando', 'pendente', 'pago', 'cancelado'], true)) {
            json_out(['error' => 'Status inválido'], 400);
        }
        $paidAt = $status === 'pago' ? date('Y-m-d H:i:s') : null;
        $pdo->prepare('UPDATE payouts SET status=?, paid_at=?, notes=? WHERE id=?')->execute([
            $status,
            $paidAt,
            $body['notes'] ?? null,
            (int)$id,
        ]);
        json_out(['success' => true]);
    }
}

// Contract templates (modelos / verso)
if ($resource === 'contract-templates') {
    if ($method === 'GET' && !$id) {
        require_auth($config['jwt_secret']);
        $sql = 'SELECT * FROM contract_templates WHERE 1=1';
        $params = [];
        if (isset($_GET['active']) && $_GET['active'] === '1') {
            $sql .= ' AND active = 1';
        }
        $sql .= ' ORDER BY is_default DESC, name ASC';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        json_out(array_map('map_template_row', $stmt->fetchAll()));
    }

    if ($method === 'GET' && $id) {
        require_auth($config['jwt_secret']);
        $stmt = $pdo->prepare('SELECT * FROM contract_templates WHERE id = ?');
        $stmt->execute([(int)$id]);
        $row = $stmt->fetch();
        if (!$row) json_out(['error' => 'Modelo não encontrado'], 404);
        json_out(map_template_row($row));
    }

    if ($method === 'POST' && !$id) {
        $auth = require_auth($config['jwt_secret'], ['root', 'admin', 'user']);
        $name = trim($body['name'] ?? '');
        $bodyText = $body['bodyText'] ?? '';
        if ($name === '' || trim((string)$bodyText) === '') {
            json_out(['error' => 'Nome e texto do verso são obrigatórios'], 400);
        }
        $isDefault = !empty($body['isDefault']);
        $active = array_key_exists('active', $body) ? !empty($body['active']) : true;
        try {
            $pdo->beginTransaction();
            if ($isDefault) {
                $pdo->exec('UPDATE contract_templates SET is_default = 0');
            }
            $ins = $pdo->prepare(
                'INSERT INTO contract_templates (name, code, title, body_text, is_default, active, notes, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $ins->execute([
                $name,
                $body['code'] ?? null,
                $body['title'] ?? 'NOTA DE LEILÃO E CONTRATO COM RESERVA DE DOMÍNIO',
                $bodyText,
                $isDefault ? 1 : 0,
                $active ? 1 : 0,
                $body['notes'] ?? null,
                $auth['id'],
            ]);
            $newId = (int)$pdo->lastInsertId();
            $pdo->commit();
            json_out(['success' => true, 'id' => (string)$newId]);
        } catch (PDOException $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            json_out(['error' => 'Erro ao criar modelo'], 500);
        }
    }

    if ($method === 'PUT' && $id) {
        require_auth($config['jwt_secret'], ['root', 'admin', 'user']);
        try {
            $pdo->beginTransaction();
            if (!empty($body['isDefault'])) {
                $pdo->exec('UPDATE contract_templates SET is_default = 0');
            }
            $fields = [];
            $params = [];
            if (array_key_exists('name', $body)) {
                $fields[] = 'name=?';
                $params[] = trim((string)$body['name']);
            }
            if (array_key_exists('code', $body)) {
                $fields[] = 'code=?';
                $params[] = $body['code'] ?: null;
            }
            if (array_key_exists('title', $body)) {
                $fields[] = 'title=?';
                $params[] = $body['title'];
            }
            if (array_key_exists('bodyText', $body)) {
                $fields[] = 'body_text=?';
                $params[] = $body['bodyText'];
            }
            if (array_key_exists('isDefault', $body)) {
                $fields[] = 'is_default=?';
                $params[] = !empty($body['isDefault']) ? 1 : 0;
            }
            if (array_key_exists('active', $body)) {
                $fields[] = 'active=?';
                $params[] = !empty($body['active']) ? 1 : 0;
            }
            if (array_key_exists('notes', $body)) {
                $fields[] = 'notes=?';
                $params[] = $body['notes'] ?: null;
            }
            if (!$fields) {
                $pdo->rollBack();
                json_out(['error' => 'Nada para atualizar'], 400);
            }
            $params[] = (int)$id;
            $pdo->prepare('UPDATE contract_templates SET ' . implode(',', $fields) . ' WHERE id=?')->execute($params);
            $pdo->commit();
            json_out(['success' => true]);
        } catch (PDOException $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            json_out(['error' => 'Erro ao atualizar modelo'], 500);
        }
    }
}

// Catalogs (breed, sale_type)
if ($resource === 'catalogs') {
    if ($method === 'GET' && !$id) {
        require_auth($config['jwt_secret']);
        $kind = trim($_GET['kind'] ?? '');
        if (!in_array($kind, ['breed', 'sale_type', 'animal_category', 'share_quota'], true)) {
            json_out(['error' => 'Informe kind válido (breed, sale_type, animal_category, share_quota)'], 400);
        }
        $stmt = $pdo->prepare('SELECT * FROM catalogs WHERE kind = ? AND active = 1 ORDER BY name ASC');
        $stmt->execute([$kind]);
        json_out(array_map(function ($r) {
            return [
                'id' => (string)$r['id'],
                'kind' => $r['kind'],
                'name' => $r['name'],
                'code' => $r['code'],
                'active' => (bool)$r['active'],
            ];
        }, $stmt->fetchAll()));
    }

    if ($method === 'POST' && !$id) {
        require_auth($config['jwt_secret'], ['root', 'admin', 'user']);
        $kind = trim($body['kind'] ?? '');
        $name = trim($body['name'] ?? '');
        $code = isset($body['code']) ? trim((string)$body['code']) : null;
        if (!in_array($kind, ['breed', 'sale_type', 'animal_category', 'share_quota'], true)) {
            json_out(['error' => 'Tipo de catálogo inválido'], 400);
        }
        if ($name === '') json_out(['error' => 'Nome é obrigatório'], 400);
        if (in_array($kind, ['sale_type', 'animal_category', 'share_quota'], true) && (!$code || $code === '')) {
            if ($kind === 'share_quota') {
                $num = str_replace(['%', ','], ['', '.'], $name);
                $code = substr(preg_replace('/[^0-9.]/', '', $num) ?: '100', 0, 40);
            } else {
                $slug = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $name);
                $slug = preg_replace('/[^A-Za-z0-9]+/', '_', $slug ?? $name);
                $slug = trim($slug, '_');
                $code = substr($slug ?: 'CUSTOM', 0, 40);
                if ($kind === 'sale_type') $code = strtolower($code);
                else $code = strtoupper($code);
            }
        }
        try {
            $pdo->prepare('INSERT INTO catalogs (kind, name, code, active) VALUES (?, ?, ?, 1)')
                ->execute([$kind, $name, $code ?: null]);
            json_out([
                'success' => true,
                'id' => (string)$pdo->lastInsertId(),
                'kind' => $kind,
                'name' => $name,
                'code' => $code,
            ]);
        } catch (PDOException $e) {
            if ($e->getCode() == 23000) json_out(['error' => 'Este item já existe no catálogo'], 409);
            json_out(['error' => 'Erro ao criar item do catálogo'], 500);
        }
    }
}

json_out(['error' => 'Rota não encontrada'], 404);
