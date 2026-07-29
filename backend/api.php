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
        'sale_type' => $r['sale_type'],
        'share_pct' => $r['share_pct'] !== null ? (float)$r['share_pct'] : null,
        'seller_id' => (string)$r['seller_id'],
        'seller_name' => $r['seller_name'] ?? null,
        'buyer_id' => (string)$r['buyer_id'],
        'buyer_name' => $r['buyer_name'] ?? null,
        'assessor_id' => $r['assessor_id'] ? (string)$r['assessor_id'] : null,
        'assessor_name' => $r['assessor_name'] ?? null,
        'total_amount' => (float)$r['total_amount'],
        'payment_method' => $r['payment_method'],
        'installments' => (int)$r['installments'],
        'first_due_date' => $r['first_due_date'],
        'status' => $r['status'],
        'notes' => $r['notes'],
        'created_at' => $r['created_at'] ?? null,
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
                'INSERT INTO clients (name, document_type, document, email, phone, whatsapp, city, state, address, notes, active, is_seller, is_buyer, is_assessor, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
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
                'UPDATE clients SET name=?, document_type=?, document=?, email=?, phone=?, whatsapp=?, city=?, state=?, address=?, notes=?, active=?, is_seller=?, is_buyer=?, is_assessor=? WHERE id=?'
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
    $contractSelect = "SELECT c.*, a.name AS animal_name,
        s.name AS seller_name, b.name AS buyer_name, ass.name AS assessor_name
      FROM contracts c
      INNER JOIN animals a ON a.id = c.animal_id
      INNER JOIN clients s ON s.id = c.seller_id
      INNER JOIN clients b ON b.id = c.buyer_id
      LEFT JOIN clients ass ON ass.id = c.assessor_id
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
        try {
            $pdo->beginTransaction();
            $ins = $pdo->prepare(
                'INSERT INTO contracts (animal_id, sale_type, share_pct, seller_id, buyer_id, assessor_id, total_amount, payment_method, installments, first_due_date, status, notes, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $ins->execute([
                $animalId, $saleType, $sharePct, $sellerId, $buyerId, $assessorId,
                $total, $methodPay, $n, $firstDue, 'aguardando_assinatura',
                $body['notes'] ?? null, $auth['id'],
            ]);
            $contractId = (int)$pdo->lastInsertId();
            generate_charges($pdo, $contractId, $buyerId, $total, $n, $firstDue, $methodPay);
            $pdo->commit();
            json_out(['success' => true, 'id' => (string)$contractId]);
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
        if (!in_array($partyRole, ['seller', 'buyer', 'assessor'], true) || $signerName === '' || !$accepted) {
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
        json_out(['success' => true]);
    }
}

json_out(['error' => 'Rota não encontrada'], 404);
