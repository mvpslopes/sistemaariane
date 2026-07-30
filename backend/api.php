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

function bearer_user(string $secret): ?array {
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
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
        $kind = 'animal';
    }

    if (!isset($_FILES['file']) || !is_uploaded_file($_FILES['file']['tmp_name'])) {
        json_out(['error' => 'Nenhum arquivo enviado'], 400);
    }

    $file = $_FILES['file'];
    if (($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
        json_out(['error' => 'Falha no upload do arquivo'], 400);
    }

    if (($file['size'] ?? 0) > 5 * 1024 * 1024) {
        json_out(['error' => 'Arquivo muito grande (máx. 5 MB)'], 400);
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($file['tmp_name']) ?: ($file['type'] ?? '');
    $allowed = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
    ];
    if (!isset($allowed[$mime])) {
        json_out(['error' => 'Formato inválido. Use JPG, PNG, WEBP ou GIF'], 400);
    }

    $subdir = $kind === 'avatar' ? 'avatars' : 'animals';
    $dir = __DIR__ . '/uploads/' . $subdir;
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
        json_out(['error' => 'Não foi possível criar pasta de uploads'], 500);
    }

    $prefix = $kind === 'avatar' ? 'avatar' : 'animal';
    $filename = $prefix . '_' . date('YmdHis') . '_' . bin2hex(random_bytes(4)) . '.' . $allowed[$mime];
    $dest = $dir . '/' . $filename;
    if (!move_uploaded_file($file['tmp_name'], $dest)) {
        json_out(['error' => 'Erro ao salvar arquivo'], 500);
    }

    json_out([
        'success' => true,
        'url' => '/uploads/' . $subdir . '/' . $filename,
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
             WHERE buyer_id = ? OR seller_id = ? OR assessor_id = ?"
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

        $stmt = $pdo->prepare("SELECT COUNT(*) AS total FROM charges WHERE client_id = ? AND status = 'pendente'");
        $stmt->execute([$cid]);
        $chargesPending = (int)$stmt->fetch()['total'];

        $stmt = $pdo->prepare(
            "SELECT COUNT(*) AS total FROM charges
             WHERE client_id = ? AND (status = 'atrasado' OR (status = 'pendente' AND due_date < CURDATE()))"
        );
        $stmt->execute([$cid]);
        $chargesOverdue = (int)$stmt->fetch()['total'];

        $stmt = $pdo->prepare("SELECT COUNT(*) AS total FROM charges WHERE client_id = ? AND status = 'pago'");
        $stmt->execute([$cid]);
        $chargesPaid = (int)$stmt->fetch()['total'];

        json_out([
            'clients' => 1,
            'buyers' => 0,
            'sellers' => 0,
            'assessors' => 0,
            'witnesses' => 0,
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
    $animals = (int)$pdo->query('SELECT COUNT(*) AS t FROM animals')->fetch()['t'];
    $activeAnimals = (int)$pdo->query("SELECT COUNT(*) AS t FROM animals WHERE status = 'ativo'")->fetch()['t'];
    $contracts = (int)$pdo->query('SELECT COUNT(*) AS t FROM contracts')->fetch()['t'];
    $contractsActive = (int)$pdo->query("SELECT COUNT(*) AS t FROM contracts WHERE status = 'ativo'")->fetch()['t'];
    $contractsAwaiting = (int)$pdo->query("SELECT COUNT(*) AS t FROM contracts WHERE status = 'aguardando_assinatura'")->fetch()['t'];
    $chargesPending = (int)$pdo->query("SELECT COUNT(*) AS t FROM charges WHERE status = 'pendente'")->fetch()['t'];
    $chargesOverdue = (int)$pdo->query(
        "SELECT COUNT(*) AS t FROM charges
         WHERE status = 'atrasado' OR (status = 'pendente' AND due_date < CURDATE())"
    )->fetch()['t'];
    $chargesPaid = (int)$pdo->query("SELECT COUNT(*) AS t FROM charges WHERE status = 'pago'")->fetch()['t'];
    $users = in_array($auth['role'], ['root', 'admin'], true)
        ? (int)$pdo->query('SELECT COUNT(*) AS t FROM users WHERE active = 1')->fetch()['t']
        : null;

    json_out([
        'clients' => $clients,
        'buyers' => $buyers,
        'sellers' => $sellers,
        'assessors' => $assessors,
        'witnesses' => $witnesses,
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
        'email' => $r['email'],
        'phone' => $r['phone'],
        'whatsapp' => $r['whatsapp'],
        'city' => $r['city'],
        'state' => $r['state'],
        'address' => $r['address'],
        'notes' => $r['notes'],
        'active' => (bool)$r['active'],
        'is_seller' => (bool)($r['is_seller'] ?? 0),
        'is_buyer' => (bool)($r['is_buyer'] ?? 1),
        'is_assessor' => (bool)($r['is_assessor'] ?? 0),
        'is_witness' => (bool)($r['is_witness'] ?? 0),
        'created_at' => $r['created_at'] ?? null,
    ];
}

function client_ip(): string {
    return $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '';
}

function generate_charges(PDO $pdo, int $contractId, int $buyerId, float $total, int $n, string $firstDue, string $method): void {
    $n = max(1, min(40, $n));
    $base = floor(($total / $n) * 100) / 100;
    $pdo->prepare('DELETE FROM charges WHERE contract_id = ?')->execute([$contractId]);
    $ins = $pdo->prepare(
        'INSERT INTO charges (contract_id, client_id, installment_no, amount, due_date, payment_method, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    $due = new DateTime($firstDue);
    $sum = 0;
    for ($i = 1; $i <= $n; $i++) {
        $amount = $i === $n ? round($total - $sum, 2) : $base;
        $sum += $amount;
        $ins->execute([
            $contractId,
            $buyerId,
            $i,
            $amount,
            $due->format('Y-m-d'),
            $method,
            'pendente',
        ]);
        $due->modify('+1 month');
    }
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
        'sale_type' => $r['sale_type'],
        'share_pct' => $r['share_pct'] !== null ? (float)$r['share_pct'] : null,
        'seller_id' => (string)$r['seller_id'],
        'seller_name' => $r['seller_name'] ?? null,
        'seller_document' => $r['seller_document'] ?? null,
        'seller_document_type' => $r['seller_document_type'] ?? null,
        'seller_email' => $r['seller_email'] ?? null,
        'seller_phone' => $r['seller_phone'] ?? null,
        'seller_whatsapp' => $r['seller_whatsapp'] ?? null,
        'seller_address' => $r['seller_address'] ?? null,
        'seller_city' => $r['seller_city'] ?? null,
        'seller_state' => $r['seller_state'] ?? null,
        'buyer_id' => (string)$r['buyer_id'],
        'buyer_name' => $r['buyer_name'] ?? null,
        'buyer_document' => $r['buyer_document'] ?? null,
        'buyer_document_type' => $r['buyer_document_type'] ?? null,
        'buyer_email' => $r['buyer_email'] ?? null,
        'buyer_phone' => $r['buyer_phone'] ?? null,
        'buyer_whatsapp' => $r['buyer_whatsapp'] ?? null,
        'buyer_address' => $r['buyer_address'] ?? null,
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
        'witness2_id' => !empty($r['witness2_id']) ? (string)$r['witness2_id'] : null,
        'witness2_name' => $r['witness2_name'] ?? null,
        'via_label' => $r['via_label'] ?? 'VIA - VENDEDOR / CONTRATO',
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
        'min_price' => $r['min_price'] !== null ? (float)$r['min_price'] : null,
        'conditions_text' => $r['conditions_text'],
        'status' => $r['status'],
        'contract_id' => $r['contract_id'] ? (string)$r['contract_id'] : null,
        'created_at' => $r['created_at'] ?? null,
    ];
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
        $sql = 'SELECT * FROM clients WHERE 1=1';
        $params = [];
        if ($auth['role'] === 'cliente') {
            if (!$auth['clientId']) json_out([]);
            $sql .= ' AND id = ?';
            $params[] = $auth['clientId'];
        }
        if ($q !== '') {
            $sql .= ' AND (name LIKE ? OR document LIKE ? OR email LIKE ? OR phone LIKE ?)';
            $like = "%$q%";
            array_push($params, $like, $like, $like, $like);
        }
        if ($roleFilter === 'seller') $sql .= ' AND is_seller = 1';
        if ($roleFilter === 'buyer') $sql .= ' AND is_buyer = 1';
        if ($roleFilter === 'assessor') $sql .= ' AND is_assessor = 1';
        if ($roleFilter === 'witness') $sql .= ' AND is_witness = 1';
        $sql .= ' ORDER BY name ASC';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        json_out(array_map('map_client', $stmt->fetchAll()));
    }

    if ($method === 'GET' && $id) {
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

    if ($method === 'POST') {
        $auth = require_auth($config['jwt_secret'], ['root', 'admin', 'user']);
        $name = trim($body['name'] ?? '');
        if ($name === '') json_out(['error' => 'Nome é obrigatório'], 400);
        try {
            $stmt = $pdo->prepare(
                'INSERT INTO clients (name, document_type, document, email, phone, whatsapp, city, state, address, notes, active, is_seller, is_buyer, is_assessor, is_witness, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $stmt->execute([
                $name,
                $body['document_type'] ?? 'CPF',
                $body['document'] ?? null,
                $body['email'] ?? null,
                $body['phone'] ?? null,
                $body['whatsapp'] ?? null,
                $body['city'] ?? null,
                $body['state'] ?? null,
                $body['address'] ?? null,
                $body['notes'] ?? null,
                !empty($body['active']) || !isset($body['active']) ? 1 : 0,
                !empty($body['is_seller']) ? 1 : 0,
                isset($body['is_buyer']) ? (!empty($body['is_buyer']) ? 1 : 0) : 1,
                !empty($body['is_assessor']) ? 1 : 0,
                !empty($body['is_witness']) ? 1 : 0,
                $auth['id'],
            ]);
            json_out(['success' => true, 'id' => (string)$pdo->lastInsertId()]);
        } catch (PDOException $e) {
            if ($e->getCode() == 23000) json_out(['error' => 'Documento já cadastrado'], 409);
            json_out(['error' => 'Erro ao criar cliente'], 500);
        }
    }

    if ($method === 'PUT' && $id) {
        require_auth($config['jwt_secret'], ['root', 'admin', 'user']);
        $name = trim($body['name'] ?? '');
        if ($name === '') json_out(['error' => 'Nome é obrigatório'], 400);
        try {
            $stmt = $pdo->prepare(
                'UPDATE clients SET name=?, document_type=?, document=?, email=?, phone=?, whatsapp=?, city=?, state=?, address=?, notes=?, active=?, is_seller=?, is_buyer=?, is_assessor=?, is_witness=? WHERE id=?'
            );
            $stmt->execute([
                $name,
                $body['document_type'] ?? 'CPF',
                $body['document'] ?? null,
                $body['email'] ?? null,
                $body['phone'] ?? null,
                $body['whatsapp'] ?? null,
                $body['city'] ?? null,
                $body['state'] ?? null,
                $body['address'] ?? null,
                $body['notes'] ?? null,
                isset($body['active']) && $body['active'] === false ? 0 : 1,
                !empty($body['is_seller']) ? 1 : 0,
                !empty($body['is_buyer']) ? 1 : 0,
                !empty($body['is_assessor']) ? 1 : 0,
                !empty($body['is_witness']) ? 1 : 0,
                (int)$id,
            ]);
            json_out(['success' => true]);
        } catch (PDOException $e) {
            if ($e->getCode() == 23000) json_out(['error' => 'Documento já cadastrado'], 409);
            json_out(['error' => 'Erro ao atualizar cliente'], 500);
        }
    }

    if ($method === 'DELETE' && $id) {
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
        $ins->execute([
            $animalId,
            (int)$owner['clientId'],
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
        s.name AS seller_name, s.document AS seller_document, s.document_type AS seller_document_type,
        s.email AS seller_email, s.phone AS seller_phone, s.whatsapp AS seller_whatsapp,
        s.address AS seller_address, s.city AS seller_city, s.state AS seller_state,
        b.name AS buyer_name, b.document AS buyer_document, b.document_type AS buyer_document_type,
        b.email AS buyer_email, b.phone AS buyer_phone, b.whatsapp AS buyer_whatsapp,
        b.address AS buyer_address, b.city AS buyer_city, b.state AS buyer_state,
        ass.name AS assessor_name,
        w1.name AS witness1_name, w2.name AS witness2_name,
        au.name AS auction_name, au.auction_date AS auction_date,
        t.name AS template_name, t.title AS template_title, t.body_text AS template_body
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
        if (!in_array($saleType, ['inteiro', 'fracao', 'condominio'], true)) {
            json_out(['error' => 'Tipo de venda inválido'], 400);
        }
        if (!in_array($methodPay, ['pix', 'boleto', 'transferencia', 'outro'], true)) {
            json_out(['error' => 'Forma de pagamento inválida'], 400);
        }
        $n = max(1, min(40, $n));
        if ($saleType === 'inteiro') $sharePct = 100;
        if (in_array($saleType, ['fracao', 'condominio'], true) && (!$sharePct || $sharePct <= 0 || $sharePct > 100)) {
            json_out(['error' => 'Informe o percentual da fração (1–100)'], 400);
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
        $viaLabel = $body['viaLabel'] ?? 'VIA - VENDEDOR / CONTRATO';

        try {
            if (!$templateId) {
                $def = $pdo->query('SELECT id FROM contract_templates WHERE is_default = 1 AND active = 1 LIMIT 1')->fetch();
                if ($def) $templateId = (int)$def['id'];
            }

            $pdo->beginTransaction();
            $ins = $pdo->prepare(
                'INSERT INTO contracts
                 (animal_id, sale_type, share_pct, seller_id, buyer_id, assessor_id, auction_id, lot_id,
                  template_id, lot_label, animal_category, quantity,
                  commission_total_pct, commission_buyer_pct, commission_seller_pct,
                  witness1_id, witness2_id, via_label,
                  total_amount, payment_method, installments, first_due_date, status, notes, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $ins->execute([
                $animalId, $saleType, $sharePct, $sellerId, $buyerId, $assessorId,
                $auctionId, $lotId,
                $templateId, $lotLabel, $animalCategory, $quantity,
                $commissionTotalPct, $commissionBuyerPct, $commissionSellerPct,
                $witness1Id, $witness2Id, $viaLabel,
                $total, $methodPay, $n, $firstDue, 'aguardando_assinatura',
                $body['notes'] ?? null, $auth['id'],
            ]);
            $contractId = (int)$pdo->lastInsertId();
            $contractNumber = sprintf('%08d-%d', (10000000 + $contractId) % 100000000, (int)date('Y'));
            $pdo->prepare('UPDATE contracts SET contract_number = ? WHERE id = ?')->execute([$contractNumber, $contractId]);
            generate_charges($pdo, $contractId, $buyerId, $total, $n, $firstDue, $methodPay);
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
        $status = $body['status'] ?? null;
        $notes = $body['notes'] ?? null;
        if ($status && !in_array($status, ['rascunho','aguardando_assinatura','ativo','concluido','cancelado'], true)) {
            json_out(['error' => 'Status inválido'], 400);
        }
        $fields = [];
        $params = [];
        if ($status) { $fields[] = 'status=?'; $params[] = $status; }
        if (array_key_exists('notes', $body)) { $fields[] = 'notes=?'; $params[] = $notes; }
        if (!$fields) json_out(['error' => 'Nada para atualizar'], 400);
        $params[] = (int)$id;
        $pdo->prepare('UPDATE contracts SET ' . implode(',', $fields) . ' WHERE id=?')->execute($params);
        json_out(['success' => true]);
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
        if (!empty($_GET['status'])) {
            $sql .= ' AND ch.status = ?';
            $params[] = $_GET['status'];
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
        $out['lots'] = array_map('map_lot_row', $lots->fetchAll());
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
        json_out(array_map('map_lot_row', $stmt->fetchAll()));
    }

    if ($method === 'POST' && !$id) {
        require_auth($config['jwt_secret'], ['root', 'admin', 'user']);
        $auctionId = (int)($body['auctionId'] ?? 0);
        $animalId = (int)($body['animalId'] ?? 0);
        $sellerId = (int)($body['sellerId'] ?? 0);
        if (!$auctionId || !$animalId || !$sellerId) {
            json_out(['error' => 'Leilão, animal e vendedor são obrigatórios'], 400);
        }
        $pdo->prepare(
            "INSERT INTO auction_lots (auction_id, animal_id, lot_number, seller_id, min_price, conditions_text, status)
             VALUES (?, ?, ?, ?, ?, ?, 'disponivel')"
        )->execute([
            $auctionId,
            $animalId,
            $body['lotNumber'] ?? null,
            $sellerId,
            isset($body['minPrice']) && $body['minPrice'] !== '' ? (float)$body['minPrice'] : null,
            $body['conditionsText'] ?? null,
        ]);
        json_out(['success' => true, 'id' => (string)$pdo->lastInsertId()]);
    }

    if ($method === 'PUT' && $id) {
        require_auth($config['jwt_secret'], ['root', 'admin', 'user']);
        $fields = [];
        $params = [];
        if (array_key_exists('lotNumber', $body)) { $fields[] = 'lot_number=?'; $params[] = $body['lotNumber'] ?: null; }
        if (array_key_exists('minPrice', $body)) {
            $fields[] = 'min_price=?';
            $params[] = ($body['minPrice'] !== '' && $body['minPrice'] !== null) ? (float)$body['minPrice'] : null;
        }
        if (array_key_exists('conditionsText', $body)) { $fields[] = 'conditions_text=?'; $params[] = $body['conditionsText'] ?: null; }
        if (array_key_exists('sellerId', $body)) { $fields[] = 'seller_id=?'; $params[] = (int)$body['sellerId']; }
        if (array_key_exists('status', $body)) {
            if (!in_array($body['status'], ['disponivel','arrematado','retirado'], true)) {
                json_out(['error' => 'Status inválido'], 400);
            }
            $fields[] = 'status=?';
            $params[] = $body['status'];
        }
        if (!$fields) json_out(['error' => 'Nada para atualizar'], 400);
        $params[] = (int)$id;
        $pdo->prepare('UPDATE auction_lots SET ' . implode(',', $fields) . ' WHERE id=?')->execute($params);
        json_out(['success' => true]);
    }
}

// Payouts / Repasses
if ($resource === 'payouts') {
    if ($method === 'GET' && !$id) {
        $auth = require_auth($config['jwt_secret']);
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
        if (!empty($_GET['status'])) {
            $sql .= ' AND p.status = ?';
            $params[] = $_GET['status'];
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

json_out(['error' => 'Rota não encontrada'], 404);
