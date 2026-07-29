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
        'SELECT id, username, email, password_hash, name, role, client_id, active, must_change_password
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

// Upload de foto (animais)
if ($resource === 'upload' && $method === 'POST') {
    $auth = require_auth($config['jwt_secret'], ['root', 'admin', 'user']);

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

    $dir = __DIR__ . '/uploads/animals';
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
        json_out(['error' => 'Não foi possível criar pasta de uploads'], 500);
    }

    $filename = 'animal_' . date('YmdHis') . '_' . bin2hex(random_bytes(4)) . '.' . $allowed[$mime];
    $dest = $dir . '/' . $filename;
    if (!move_uploaded_file($file['tmp_name'], $dest)) {
        json_out(['error' => 'Erro ao salvar arquivo'], 500);
    }

    json_out([
        'success' => true,
        'url' => '/uploads/animals/' . $filename,
        'uploaded_by' => $auth['username'],
    ]);
}

// Me
if ($resource === 'me' && $method === 'GET') {
    $auth = require_auth($config['jwt_secret']);
    $stmt = $pdo->prepare(
        'SELECT id, username, email, name, role, client_id, active, must_change_password FROM users WHERE id = ?'
    );
    $stmt->execute([$auth['id']]);
    $user = $stmt->fetch();
    if (!$user) json_out(['error' => 'Usuário não encontrado'], 404);
    json_out(['user' => map_user($user)]);
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
        $stmt = $pdo->prepare(
            "SELECT COUNT(*) AS total FROM animals a
             INNER JOIN animal_owners ao ON ao.animal_id = a.id
             WHERE ao.client_id = ? AND a.status = 'ativo'"
        );
        $stmt->execute([$auth['clientId']]);
        $total = (int)$stmt->fetch()['total'];
        json_out(['clients' => 1, 'animals' => $total, 'activeAnimals' => $total, 'users' => 0]);
    }

    $clients = (int)$pdo->query('SELECT COUNT(*) AS t FROM clients WHERE active = 1')->fetch()['t'];
    $animals = (int)$pdo->query('SELECT COUNT(*) AS t FROM animals')->fetch()['t'];
    $activeAnimals = (int)$pdo->query("SELECT COUNT(*) AS t FROM animals WHERE status = 'ativo'")->fetch()['t'];
    $users = in_array($auth['role'], ['root', 'admin'], true)
        ? (int)$pdo->query('SELECT COUNT(*) AS t FROM users WHERE active = 1')->fetch()['t']
        : null;
    json_out([
        'clients' => $clients,
        'animals' => $animals,
        'activeAnimals' => $activeAnimals,
        'users' => $users,
    ]);
}

// Clients
if ($resource === 'clients') {
    if ($method === 'GET' && !$id) {
        $auth = require_auth($config['jwt_secret']);
        $q = trim($_GET['q'] ?? '');
        $sql = 'SELECT id, name, document_type, document, email, phone, whatsapp, city, state, address, notes, active, created_at FROM clients WHERE 1=1';
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
        $sql .= ' ORDER BY name ASC';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = array_map(function ($r) {
            $r['id'] = (string)$r['id'];
            $r['active'] = (bool)$r['active'];
            return $r;
        }, $stmt->fetchAll());
        json_out($rows);
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
        $r['id'] = (string)$r['id'];
        $r['active'] = (bool)$r['active'];
        json_out($r);
    }

    if ($method === 'POST') {
        $auth = require_auth($config['jwt_secret'], ['root', 'admin', 'user']);
        $name = trim($body['name'] ?? '');
        if ($name === '') json_out(['error' => 'Nome é obrigatório'], 400);
        try {
            $stmt = $pdo->prepare(
                'INSERT INTO clients (name, document_type, document, email, phone, whatsapp, city, state, address, notes, active, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
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
                'UPDATE clients SET name=?, document_type=?, document=?, email=?, phone=?, whatsapp=?, city=?, state=?, address=?, notes=?, active=? WHERE id=?'
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
            // Remove vínculos de propriedade (FK RESTRICT impede DELETE direto)
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
        $sql = 'SELECT id, username, email, name, role, client_id, active, must_change_password, created_at FROM users WHERE 1=1';
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

json_out(['error' => 'Rota não encontrada'], 404);
