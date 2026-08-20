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

date_default_timezone_set('America/Sao_Paulo');

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
    $pdo->exec("SET time_zone = '-03:00'");
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

function bearer_user(string $secret, ?PDO $pdo = null): ?array {
    $header = request_authorization_header();
    if (!preg_match('/Bearer\\s+(\\S+)/', $header, $m)) return null;
    $payload = verify_token($m[1], $secret);
    if (!$payload) return null;
    if ($pdo !== null && !user_session_is_valid($pdo, $payload)) return null;
    return [
        'id' => (int)$payload['id'],
        'username' => $payload['username'] ?? '',
        'role' => $payload['role'] ?? 'user',
        'clientId' => isset($payload['clientId']) && $payload['clientId'] !== null
            ? (int)$payload['clientId'] : null,
    ];
}

function user_session_is_valid(PDO $pdo, array $payload): bool {
    $userId = (int)($payload['id'] ?? 0);
    if ($userId <= 0) return false;
    try {
        $stmt = $pdo->prepare('SELECT session_version FROM users WHERE id = ? AND active = 1 LIMIT 1');
        $stmt->execute([$userId]);
        $row = $stmt->fetch();
        if (!$row) return false;
        $dbSv = (int)$row['session_version'];
        $tokenSv = (int)($payload['sessionVersion'] ?? 0);
        return $dbSv === $tokenSv;
    } catch (Throwable $e) {
        return true;
    }
}

function user_get_session_version(PDO $pdo, int $userId): int {
    try {
        $stmt = $pdo->prepare('SELECT session_version FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([$userId]);
        $row = $stmt->fetch();
        return $row ? (int)$row['session_version'] : 0;
    } catch (Throwable $e) {
        return 0;
    }
}

function user_force_logout(PDO $pdo, int $userId): bool {
    try {
        $pdo->prepare('UPDATE users SET session_version = session_version + 1, last_seen_at = NULL WHERE id = ?')
            ->execute([$userId]);
        return true;
    } catch (Throwable $e) {
        return false;
    }
}

function root_usage_metrics(PDO $pdo, int $days): array {
    $days = min(90, max(7, $days));

    $summaryStmt = $pdo->prepare(
        'SELECT
            SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) AS logins_today,
            SUM(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) THEN 1 ELSE 0 END) AS logins_week,
            COUNT(DISTINCT CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) THEN user_id END) AS unique_users
         FROM user_access_log
         WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)'
    );
    $summaryStmt->execute([$days, $days]);
    $summary = $summaryStmt->fetch() ?: [];

    $dayStmt = $pdo->query(
        'SELECT DATE(created_at) AS day, COUNT(*) AS count
         FROM user_access_log
         WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
         GROUP BY DATE(created_at)
         ORDER BY day ASC'
    );
    $dayMap = [];
    foreach ($dayStmt->fetchAll() as $row) {
        $dayMap[(string)$row['day']] = (int)$row['count'];
    }
    $loginsByDay = [];
    for ($i = 6; $i >= 0; $i--) {
        $d = (new DateTime('now', new DateTimeZone('America/Sao_Paulo')))
            ->modify("-{$i} day")
            ->format('Y-m-d');
        $loginsByDay[] = ['date' => $d, 'count' => $dayMap[$d] ?? 0];
    }

    $roleStmt = $pdo->prepare(
        'SELECT role, COUNT(*) AS count
         FROM user_access_log
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
         GROUP BY role
         ORDER BY count DESC'
    );
    $roleStmt->execute([$days]);
    $loginsByRole = array_map(
        fn($r) => ['role' => (string)$r['role'], 'count' => (int)$r['count']],
        $roleStmt->fetchAll()
    );

    $activeRoleStmt = $pdo->prepare(
        'SELECT role, COUNT(DISTINCT user_id) AS count
         FROM user_access_log
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
         GROUP BY role
         ORDER BY count DESC'
    );
    $activeRoleStmt->execute([$days]);
    $activeUsersByRole = array_map(
        fn($r) => ['role' => (string)$r['role'], 'count' => (int)$r['count']],
        $activeRoleStmt->fetchAll()
    );

    $hourStmt = $pdo->prepare(
        'SELECT HOUR(created_at) AS hour, COUNT(*) AS count
         FROM user_access_log
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
         GROUP BY HOUR(created_at)
         ORDER BY hour ASC'
    );
    $hourStmt->execute([$days]);
    $hourMap = array_fill(0, 24, 0);
    foreach ($hourStmt->fetchAll() as $row) {
        $hourMap[(int)$row['hour']] = (int)$row['count'];
    }
    $peakHours = [];
    for ($h = 0; $h < 24; $h++) {
        $peakHours[] = ['hour' => $h, 'count' => $hourMap[$h]];
    }

    return [
        'days' => $days,
        'summary' => [
            'loginsToday' => (int)($summary['logins_today'] ?? 0),
            'loginsWeek' => (int)($summary['logins_week'] ?? 0),
            'uniqueUsers' => (int)($summary['unique_users'] ?? 0),
        ],
        'loginsByDay' => $loginsByDay,
        'loginsByRole' => $loginsByRole,
        'activeUsersByRole' => $activeUsersByRole,
        'peakHours' => $peakHours,
    ];
}

function require_auth(string $secret, array $roles = []): array {
    global $pdo;
    $user = bearer_user($secret, $pdo);
    if (!$user) {
        http_response_code(401);
        echo json_encode(['error' => 'Não autenticado ou sessão encerrada']);
        exit;
    }
    if ($roles && !in_array($user['role'], $roles, true)) {
        http_response_code(403);
        echo json_encode(['error' => 'Sem permissão']);
        exit;
    }
    return $user;
}

function can_create(string $role): bool {
    return in_array($role, ['root', 'admin', 'user'], true);
}

function can_update(string $role): bool {
    return in_array($role, ['root', 'admin', 'user'], true);
}

function can_delete(string $role): bool {
    return in_array($role, ['root', 'admin', 'user'], true);
}

function can_manage_users(string $role): bool {
    return in_array($role, ['root', 'admin'], true);
}

function can_view_audit(string $role): bool {
    return in_array($role, ['root', 'admin'], true);
}

function user_touch_presence(PDO $pdo, int $userId): void {
    try {
        $now = (new DateTime('now', new DateTimeZone('America/Sao_Paulo')))->format('Y-m-d H:i:s');
        $pdo->prepare('UPDATE users SET last_seen_at = ? WHERE id = ?')->execute([$now, $userId]);
    } catch (Throwable $e) {
        // coluna pode não existir ainda
    }
}

function user_log_access(PDO $pdo, array $auth): void {
    try {
        $pdo->prepare(
            'INSERT INTO user_access_log (user_id, username, role, ip, user_agent) VALUES (?, ?, ?, ?, ?)'
        )->execute([
            (int)$auth['id'],
            (string)($auth['username'] ?? ''),
            (string)($auth['role'] ?? ''),
            client_ip(),
            substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 500),
        ]);
        user_touch_presence($pdo, (int)$auth['id']);
    } catch (Throwable $e) {
        // tabela pode não existir ainda
    }
}

function user_map_online_row(array $r): array {
    return [
        'id' => (string)$r['id'],
        'username' => $r['username'],
        'name' => $r['name'],
        'role' => $r['role'],
        'avatarUrl' => $r['avatar_url'] ?? null,
        'lastSeenAt' => $r['last_seen_at'],
    ];
}

function user_map_access_row(array $r): array {
    return [
        'id' => (string)$r['id'],
        'userId' => (string)$r['user_id'],
        'username' => $r['username'],
        'name' => $r['user_name'] ?? $r['username'],
        'role' => $r['role'],
        'avatarUrl' => $r['avatar_url'] ?? null,
        'ip' => $r['ip'],
        'userAgent' => $r['user_agent'] ?? null,
        'createdAt' => $r['created_at'],
    ];
}

function permissions_for_role(string $role): array {
    return [
        'canCreate' => can_create($role),
        'canUpdate' => can_update($role),
        'canDelete' => can_delete($role),
        'canManageUsers' => can_manage_users($role),
        'canViewAudit' => can_view_audit($role),
    ];
}

function require_create(string $secret): array {
    return require_auth($secret, ['root', 'admin', 'user']);
}

function require_update(string $secret): array {
    return require_auth($secret, ['root', 'admin', 'user']);
}

function require_delete(string $secret): array {
    return require_auth($secret, ['root', 'admin', 'user']);
}

function audit_log(
    PDO $pdo,
    ?array $auth,
    string $action,
    string $resource,
    ?string $resourceId = null,
    ?string $summary = null,
    bool $success = true,
    ?array $meta = null
): void {
    try {
        $pdo->prepare(
            'INSERT INTO audit_logs (user_id, username, role, action, resource, resource_id, summary, ip, user_agent, success, meta)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )->execute([
            $auth ? ($auth['id'] ?? null) : null,
            $auth ? ($auth['username'] ?? null) : null,
            $auth ? ($auth['role'] ?? null) : null,
            $action,
            $resource,
            $resourceId,
            $summary,
            client_ip(),
            substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 500),
            $success ? 1 : 0,
            $meta ? json_encode($meta, JSON_UNESCAPED_UNICODE) : null,
        ]);
    } catch (Throwable $e) {
        // Não interrompe a operação principal
    }
}

/** Monta meta com campos alterados (sem dados sensíveis). */
function audit_diff_meta(array $before, array $after, array $fields): ?array {
    $meta = [];
    foreach ($fields as $key => $label) {
        $old = $before[$key] ?? null;
        $new = $after[$key] ?? null;
        if ((string)$old !== (string)$new) {
            $meta[$label] = ['de' => $old, 'para' => $new];
        }
    }
    return $meta ?: null;
}

function audit_contract_label(array $row, ?int $id = null): string {
    $num = trim((string)($row['contract_number'] ?? ''));
    if ($num !== '') return $num;
    $cid = $id ?? (int)($row['id'] ?? 0);
    return '#' . $cid;
}

function map_audit_row(array $r): array {
    $meta = null;
    if (!empty($r['meta'])) {
        $decoded = json_decode($r['meta'], true);
        $meta = is_array($decoded) ? $decoded : null;
    }
    return [
        'id' => (string)$r['id'],
        'createdAt' => $r['created_at'],
        'userId' => $r['user_id'] ? (string)$r['user_id'] : null,
        'username' => $r['username'],
        'role' => $r['role'],
        'action' => $r['action'],
        'resource' => $r['resource'],
        'resourceId' => $r['resource_id'],
        'summary' => $r['summary'],
        'ip' => $r['ip'],
        'userAgent' => $r['user_agent'] ?? null,
        'success' => (bool)$r['success'],
        'meta' => $meta,
    ];
}

function audit_logs_query(PDO $pdo, array $filters): array {
    $sql = ' FROM audit_logs WHERE 1=1';
    $params = [];

    if (!empty($filters['userId'])) {
        $sql .= ' AND user_id = ?';
        $params[] = (int)$filters['userId'];
    }
    if (!empty($filters['action'])) {
        $sql .= ' AND action = ?';
        $params[] = (string)$filters['action'];
    }
    if (!empty($filters['resource'])) {
        $sql .= ' AND resource = ?';
        $params[] = (string)$filters['resource'];
    }
    if (!empty($filters['from'])) {
        $sql .= ' AND created_at >= ?';
        $params[] = (string)$filters['from'] . ' 00:00:00';
    }
    if (!empty($filters['to'])) {
        $sql .= ' AND created_at <= ?';
        $params[] = (string)$filters['to'] . ' 23:59:59';
    }
    if (!empty($filters['q'])) {
        $term = '%' . (string)$filters['q'] . '%';
        $sql .= ' AND (username LIKE ? OR summary LIKE ? OR resource LIKE ? OR resource_id LIKE ? OR ip LIKE ?)';
        array_push($params, $term, $term, $term, $term, $term);
    }

    $countStmt = $pdo->prepare('SELECT COUNT(*)' . $sql);
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    $limit = min(500, max(1, (int)($filters['limit'] ?? 50)));
    $offset = max(0, (int)($filters['offset'] ?? 0));

    $listStmt = $pdo->prepare('SELECT *' . $sql . ' ORDER BY created_at DESC LIMIT ' . $limit . ' OFFSET ' . $offset);
    $listStmt->execute($params);
    $items = array_map('map_audit_row', $listStmt->fetchAll());

    return [
        'items' => $items,
        'total' => $total,
        'limit' => $limit,
        'offset' => $offset,
    ];
}

function normalize_media_url(?string $path): ?string {
    if ($path === null || $path === '') {
        return null;
    }
    $trimmed = trim($path);
    if (preg_match('#^https?://#i', $trimmed)) {
        return $trimmed;
    }
    if (str_starts_with($trimmed, '/uploads/')) {
        return $trimmed;
    }
    if (str_starts_with($trimmed, 'uploads/')) {
        return '/' . $trimmed;
    }
    $bare = ltrim($trimmed, '/');
    if (preg_match('#^avatar_\d{14}_[a-f0-9]+\.(jpe?g|png|webp|gif)$#i', $bare)) {
        return '/uploads/avatars/' . $bare;
    }
    if (preg_match('#^animal_\d{14}_[a-f0-9]+\.(jpe?g|png|webp|gif)$#i', $bare)) {
        return '/uploads/animals/' . $bare;
    }
    if (preg_match('#^person_\d{14}_[a-f0-9]+\.(jpe?g|png|webp|gif|pdf)$#i', $bare)) {
        return '/uploads/persons/' . $bare;
    }
    return str_starts_with($trimmed, '/') ? $trimmed : '/' . $trimmed;
}

function map_user(array $row, ?PDO $pdo = null): array {
    $user = [
        'id' => (string)$row['id'],
        'username' => $row['username'],
        'email' => $row['email'],
        'name' => $row['name'],
        'avatarUrl' => normalize_media_url($row['avatar_url'] ?? null),
        'role' => $row['role'],
        'clientId' => $row['client_id'] ? (string)$row['client_id'] : null,
        'active' => (bool)$row['active'],
        'mustChangePassword' => (bool)$row['must_change_password'],
        'permissions' => permissions_for_role($row['role']),
    ];
    if ($pdo && !empty($row['client_id'])) {
        $stmt = $pdo->prepare('SELECT is_assessor, is_buyer, is_seller FROM clients WHERE id = ? LIMIT 1');
        $stmt->execute([(int)$row['client_id']]);
        $client = $stmt->fetch();
        if ($client) {
            $user['isAssessor'] = (bool)$client['is_assessor'];
            $user['isBuyer'] = (bool)$client['is_buyer'];
            $user['isSeller'] = (bool)$client['is_seller'];
        }
    }
    return $user;
}

const DEFAULT_CLIENT_ACCESS_PASSWORD = 'ariane2026';

function username_slug_part(string $value): string {
    $value = trim($value);
    if ($value === '') return '';
    if (function_exists('iconv')) {
        $converted = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
        if ($converted !== false) $value = $converted;
    }
    $value = strtolower($value);
    $value = preg_replace('/[^a-z0-9]+/', '', $value) ?? '';
    return $value;
}

function generate_username_from_name(PDO $pdo, string $fullName): string {
    $parts = preg_split('/\s+/u', trim($fullName)) ?: [];
    $parts = array_values(array_filter($parts, fn($p) => trim((string)$p) !== ''));
    $first = username_slug_part((string)($parts[0] ?? 'usuario'));
    $last = username_slug_part((string)($parts[count($parts) - 1] ?? 'acesso'));
    if ($first === '') $first = 'usuario';
    if ($last === '') $last = 'acesso';
    $base = $first === $last ? $first : "{$first}.{$last}";
    $candidate = $base;
    $n = 2;
    $stmt = $pdo->prepare('SELECT 1 FROM users WHERE username = ? LIMIT 1');
    while (true) {
        $stmt->execute([$candidate]);
        if (!$stmt->fetch()) return $candidate;
        $candidate = $base . $n;
        $n++;
    }
}

function get_client_access_user(PDO $pdo, int $clientId): ?array {
    $stmt = $pdo->prepare(
        'SELECT id, username, email, name, avatar_url, role, client_id, active, must_change_password, created_at
         FROM users WHERE client_id = ? AND role = ? ORDER BY id ASC LIMIT 1'
    );
    $stmt->execute([$clientId, 'cliente']);
    $row = $stmt->fetch();
    return $row ? map_user($row, $pdo) : null;
}

function client_party_match_sql(string $alias = 'c'): string {
    return "? IN ({$alias}.buyer_id, {$alias}.seller_id, {$alias}.assessor_id, {$alias}.witness1_id, {$alias}.witness2_id)";
}

function client_contract_access_sql(): string {
    return client_party_match_sql('c');
}

function bind_client_contract_access(array &$params, int $clientId): void {
    $params[] = $clientId;
}

/** Animais que a pessoa possui ou que aparecem em contratos dela (comprador/vendedor/etc.). */
function client_animal_access_sql(string $animalAlias = 'a'): string {
    return "(EXISTS (SELECT 1 FROM animal_owners ao WHERE ao.animal_id = {$animalAlias}.id AND ao.client_id = ?)
        OR EXISTS (
            SELECT 1 FROM contracts cx
            WHERE cx.animal_id = {$animalAlias}.id
              AND cx.status != 'cancelado'
              AND " . client_party_match_sql('cx') . "
        ))";
}

function bind_client_animal_access(array &$params, int $clientId): void {
    array_push($params, $clientId, $clientId);
}

function client_can_view_animal(PDO $pdo, int $animalId, int $clientId): bool {
    $stmt = $pdo->prepare('SELECT 1 FROM animal_owners WHERE animal_id = ? AND client_id = ? LIMIT 1');
    $stmt->execute([$animalId, $clientId]);
    if ($stmt->fetch()) return true;
    $stmt = $pdo->prepare(
        'SELECT 1 FROM contracts c
         WHERE c.animal_id = ? AND c.status != ?
           AND ' . client_party_match_sql('c') . '
         LIMIT 1'
    );
    $stmt->execute([$animalId, 'cancelado', $clientId]);
    return (bool)$stmt->fetch();
}

function dashboard_empty_cliente_stats(): array {
    return [
        'clients' => 1,
        'buyers' => 0,
        'sellers' => 0,
        'assessors' => 0,
        'witnesses' => 0,
        'avalistas' => 0,
        'animals' => 0,
        'activeAnimals' => 0,
        'contracts' => 0,
        'contractsActive' => 0,
        'contractsAwaiting' => 0,
        'chargesPending' => 0,
        'chargesOverdue' => 0,
        'chargesPaid' => 0,
        'users' => 0,
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

// Config pública do widget Clicksign (sem token)
if ($resource === 'clicksign-widget' && $method === 'GET') {
    $base = rtrim((string)($config['clicksign_base_url'] ?? 'https://app.clicksign.com'), '/');
    json_out(['endpoint' => $base ?: 'https://app.clicksign.com']);
}

// Resolve link de assinatura (redireciona IDs antigos após troca de e-mail)
if ($resource === 'clicksign-signer' && $method === 'GET' && $id) {
    try {
        $resolved = clicksign_resolve_signer_key($config, $pdo, (string)$id);
        json_out(['success' => true, ...$resolved]);
    } catch (InvalidArgumentException $e) {
        json_out(['error' => $e->getMessage()], 404);
    } catch (Throwable $e) {
        json_out(['error' => 'Falha ao validar link de assinatura'], 500);
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
        audit_log($pdo, null, 'login_failed', 'auth', null, "Tentativa: {$login}", false);
        json_out(['error' => 'Usuário ou senha incorretos'], 401);
    }

    $sessionVersion = user_get_session_version($pdo, (int)$user['id']);
    $token = sign_token([
        'id' => (int)$user['id'],
        'username' => $user['username'],
        'role' => $user['role'],
        'clientId' => $user['client_id'] ? (int)$user['client_id'] : null,
        'sessionVersion' => $sessionVersion,
    ], $config['jwt_secret']);

    $authUser = [
        'id' => (int)$user['id'],
        'username' => $user['username'],
        'role' => $user['role'],
    ];
    audit_log($pdo, $authUser, 'login', 'auth', (string)$user['id'], 'Login realizado');
    user_log_access($pdo, $authUser);

    json_out(['success' => true, 'token' => $token, 'user' => map_user($user, $pdo)]);
}

// Upload de foto (animais ou avatar)
if ($resource === 'upload' && $method === 'POST') {
    $kind = strtolower(trim((string)($_POST['kind'] ?? $_GET['kind'] ?? 'animal')));
    if ($kind === 'avatar') {
        $auth = require_auth($config['jwt_secret']);
    } else {
        $auth = require_create($config['jwt_secret']);
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

// Me — módulos do haras (portal cliente)
if ($resource === 'me' && $id === 'modules' && $method === 'GET') {
    $auth = require_auth($config['jwt_secret']);
    if (!$auth['clientId']) {
        json_out([
            'subscriptionType' => 'assessoria',
            'subscriptionSuspended' => false,
            'modules' => [],
        ]);
    }
    $cid = (int)$auth['clientId'];
    $stmt = $pdo->prepare(
        'SELECT subscription_type, subscription_suspended FROM clients WHERE id = ? LIMIT 1'
    );
    $stmt->execute([$cid]);
    $client = $stmt->fetch();
    json_out([
        'subscriptionType' => $client['subscription_type'] ?? 'assessoria',
        'subscriptionSuspended' => (bool)($client['subscription_suspended'] ?? 0),
        'modules' => fetch_client_modules($pdo, $cid),
    ]);
}

// Me
if ($resource === 'me' && !$id && $method === 'GET') {
    $auth = require_auth($config['jwt_secret']);
    $stmt = $pdo->prepare(
        'SELECT id, username, email, name, avatar_url, role, client_id, active, must_change_password FROM users WHERE id = ?'
    );
    $stmt->execute([$auth['id']]);
    $user = $stmt->fetch();
    if (!$user) json_out(['error' => 'Usuário não encontrado'], 404);
    json_out(['user' => map_user($user, $pdo)]);
}

if ($resource === 'me' && !$id && $method === 'PUT') {
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
    json_out(['success' => true, 'user' => map_user($stmt->fetch(), $pdo)]);
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
    if ($auth['role'] === 'cliente') {
        if (!$auth['clientId']) {
            json_out(dashboard_empty_cliente_stats());
        }
        try {
            $cid = (int)$auth['clientId'];
            $stmt = $pdo->prepare(
                "SELECT COUNT(*) AS total FROM animals a
                 WHERE " . client_animal_access_sql('a')
            );
            $params = [];
            bind_client_animal_access($params, $cid);
            $stmt->execute($params);
            $animals = (int)$stmt->fetch()['total'];

            $stmt = $pdo->prepare(
                "SELECT COUNT(*) AS total FROM animals a
                 WHERE a.status = 'ativo' AND " . client_animal_access_sql('a')
            );
            $params = [];
            bind_client_animal_access($params, $cid);
            $stmt->execute($params);
            $activeAnimals = (int)$stmt->fetch()['total'];

            $stmt = $pdo->prepare(
                "SELECT COUNT(*) AS total FROM contracts c
                 WHERE " . client_contract_access_sql() . " AND c.status != 'cancelado'"
            );
            $params = [];
            bind_client_contract_access($params, $cid);
            $stmt->execute($params);
            $contracts = (int)$stmt->fetch()['total'];

            $stmt = $pdo->prepare(
                "SELECT COUNT(*) AS total FROM contracts c
                 WHERE " . client_contract_access_sql() . " AND c.status = 'ativo'"
            );
            $params = [];
            bind_client_contract_access($params, $cid);
            $stmt->execute($params);
            $contractsActive = (int)$stmt->fetch()['total'];

            $stmt = $pdo->prepare(
                "SELECT COUNT(*) AS total FROM contracts c
                 WHERE " . client_contract_access_sql() . " AND c.status = 'aguardando_assinatura'"
            );
            $params = [];
            bind_client_contract_access($params, $cid);
            $stmt->execute($params);
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
        } catch (Throwable $e) {
            json_out(['error' => 'Erro ao carregar dashboard', 'detail' => $e->getMessage()], 500);
        }
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
         WHERE ch.collector = 'assessoria' AND ch.status = 'pendente' AND c.status != 'cancelado'"
    )->fetch()['t'];
    $chargesOverdue = (int)$pdo->query(
        "SELECT COUNT(*) AS t FROM charges ch
         INNER JOIN contracts c ON c.id = ch.contract_id
         WHERE ch.collector = 'assessoria' AND c.status != 'cancelado'
           AND (ch.status = 'atrasado' OR (ch.status = 'pendente' AND ch.due_date < CURDATE()))"
    )->fetch()['t'];
    $chargesPaid = (int)$pdo->query(
        "SELECT COUNT(*) AS t FROM charges ch
         INNER JOIN contracts c ON c.id = ch.contract_id
         WHERE ch.collector = 'assessoria' AND ch.status = 'pago' AND c.status != 'cancelado'"
    )->fetch()['t'];
    $users = in_array($auth['role'], ['root', 'admin'], true)
        ? (int)$pdo->query('SELECT COUNT(*) AS t FROM users WHERE active = 1')->fetch()['t']
        : null;

    $overdueWhere = charge_overdue_sql();
    $overdueAmount = (float)$pdo->query(
        "SELECT COALESCE(SUM(ch.amount), 0) AS t FROM charges ch
         INNER JOIN contracts c ON c.id = ch.contract_id WHERE {$overdueWhere}"
    )->fetch()['t'];

    $monthStart = date('Y-m-01');
    $assessoriaPaidMonth = (float)$pdo->query(
        "SELECT COALESCE(SUM(ch.amount), 0) AS t FROM charges ch
         INNER JOIN contracts c ON c.id = ch.contract_id
         WHERE ch.collector = 'assessoria' AND ch.status = 'pago' AND c.status != 'cancelado'
           AND COALESCE(ch.paid_at, ch.updated_at) >= '{$monthStart}'"
    )->fetch()['t'];

    $auctionsOpen = (int)$pdo->query(
        "SELECT COUNT(*) AS t FROM auctions WHERE status IN ('agendado','em_andamento')"
    )->fetch()['t'];

    $subscriptionsSuspended = 0;
    try {
        $subscriptionsSuspended = (int)$pdo->query(
            'SELECT COUNT(*) AS t FROM clients WHERE active = 1 AND subscription_suspended = 1'
        )->fetch()['t'];
    } catch (Throwable $e) {
        /* migration opcional */
    }

    $chargesDueSoon = (int)$pdo->query(
        "SELECT COUNT(*) AS t FROM charges ch
         INNER JOIN contracts c ON c.id = ch.contract_id
         WHERE c.status != 'cancelado' AND ch.status = 'pendente'
           AND ch.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)"
    )->fetch()['t'];

    $coveringsPending = 0;
    try {
        $coveringsPending = (int)$pdo->query(
            "SELECT COUNT(*) AS t FROM breeding_coverings WHERE abccmm_status = 'pendente'"
        )->fetch()['t'];
    } catch (Throwable $e) {
        /* migration opcional */
    }

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
        'overdueAmount' => round($overdueAmount, 2),
        'assessoriaPaidMonth' => round($assessoriaPaidMonth, 2),
        'auctionsOpen' => $auctionsOpen,
        'subscriptionsSuspended' => $subscriptionsSuspended,
        'chargesDueSoon' => $chargesDueSoon,
        'coveringsPending' => $coveringsPending,
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
        'subscription_type' => $r['subscription_type'] ?? 'assessoria',
        'subscription_suspended' => (bool)($r['subscription_suspended'] ?? 0),
        'adhesion_fee' => isset($r['adhesion_fee']) && $r['adhesion_fee'] !== null ? (float)$r['adhesion_fee'] : null,
        'monthly_fee' => isset($r['monthly_fee']) && $r['monthly_fee'] !== null ? (float)$r['monthly_fee'] : null,
        'adhesion_paid_at' => $r['adhesion_paid_at'] ?? null,
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
    $birth = trim((string)($body['birth_date'] ?? ''));
    if ($birth === '') {
        $missing[] = 'Data de nascimento';
    } elseif (!preg_match('/^(\d{4})-(\d{2})-(\d{2})/', $birth, $bm)) {
        return 'Data de nascimento inválida';
    } elseif (!checkdate((int)$bm[2], (int)$bm[3], (int)$bm[1])) {
        return 'Data de nascimento inválida';
    }
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

function normalize_collector(?string $value): string {
    return $value === 'seller' ? 'seller' : 'assessoria';
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
            'collector' => normalize_collector($r['collector'] ?? null),
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
    return array_map(fn($r) => [
        'amount' => $r['amount'],
        'dueDate' => $r['dueDate'],
        'collector' => $r['collector'],
    ], $rows);
}

function map_charge_row(array $c, ?string $today = null): array {
    $today = $today ?? date('Y-m-d');
    $status = $c['status'];
    if ($status === 'pendente' && $c['due_date'] < $today) $status = 'atrasado';
    return [
        'id' => (string)$c['id'],
        'contract_id' => (string)$c['contract_id'],
        'client_id' => (string)$c['client_id'],
        'client_name' => $c['client_name'] ?? null,
        'animal_name' => $c['animal_name'] ?? null,
        'installment_no' => (int)$c['installment_no'],
        'amount' => (float)$c['amount'],
        'due_date' => $c['due_date'],
        'payment_method' => $c['payment_method'],
        'collector' => normalize_collector($c['collector'] ?? null),
        'status' => $status,
        'paid_at' => $c['paid_at'],
        'notes' => $c['notes'],
        'assessoria_commission_amount' => isset($c['assessoria_commission_amount'])
            ? (float)$c['assessoria_commission_amount']
            : null,
        'assessoria_commission_status' => $c['assessoria_commission_status'] ?? null,
        'assessoria_payout_id' => !empty($c['assessoria_payout_id'])
            ? (string)$c['assessoria_payout_id']
            : null,
    ];
}

function charge_list_select_sql(): string {
    return "SELECT ch.*, a.name AS animal_name, c.status AS contract_status, cl.name AS client_name,
            (SELECT p.amount FROM payouts p
             WHERE p.charge_id = ch.id AND p.beneficiary_role = 'assessoria' LIMIT 1) AS assessoria_commission_amount,
            (SELECT p.status FROM payouts p
             WHERE p.charge_id = ch.id AND p.beneficiary_role = 'assessoria' LIMIT 1) AS assessoria_commission_status,
            (SELECT p.id FROM payouts p
             WHERE p.charge_id = ch.id AND p.beneficiary_role = 'assessoria' LIMIT 1) AS assessoria_payout_id
            FROM charges ch
            INNER JOIN contracts c ON c.id = ch.contract_id
            INNER JOIN animals a ON a.id = c.animal_id
            INNER JOIN clients cl ON cl.id = ch.client_id";
}

function register_seller_commission(PDO $pdo, int $chargeId, float $amount, ?string $notes, bool $markChargePaid): array {
    if ($amount <= 0) {
        throw new InvalidArgumentException('Informe o valor recebido pela assessoria');
    }
    $stmt = $pdo->prepare(
        'SELECT ch.*, c.contract_number, c.installments
         FROM charges ch
         INNER JOIN contracts c ON c.id = ch.contract_id
         WHERE ch.id = ?'
    );
    $stmt->execute([$chargeId]);
    $charge = $stmt->fetch();
    if (!$charge) {
        throw new InvalidArgumentException('Cobrança não encontrada');
    }

    $payoutStmt = $pdo->prepare(
        "SELECT * FROM payouts WHERE charge_id = ? AND beneficiary_role = 'assessoria' LIMIT 1"
    );
    $payoutStmt->execute([$chargeId]);
    $payout = $payoutStmt->fetch();
    if (!$payout) {
        throw new InvalidArgumentException('Repasse da assessoria não encontrado para esta parcela');
    }

    $noteLine = trim((string)$notes);
    if ($noteLine === '') {
        $noteLine = 'Comissão repassada pelo vendedor';
    }

    $pdo->prepare(
        "UPDATE payouts SET amount = ?, status = 'pago', paid_at = NOW(), notes = ? WHERE id = ?"
    )->execute([$amount, $noteLine, (int)$payout['id']]);

    if ($markChargePaid) {
        $chargeNotes = trim((string)($charge['notes'] ?? ''));
        $mergedNotes = $chargeNotes !== '' ? $chargeNotes . "\n" . $noteLine : $noteLine;
        $pdo->prepare("UPDATE charges SET status = 'pago', paid_at = NOW(), notes = ? WHERE id = ?")
            ->execute([$mergedNotes, $chargeId]);
        $pdo->prepare(
            "UPDATE payouts SET status = 'pendente' WHERE charge_id = ? AND beneficiary_role != 'assessoria' AND status = 'aguardando'"
        )->execute([$chargeId]);
    } else {
        $chargeNotes = trim((string)($charge['notes'] ?? ''));
        $mergedNotes = $chargeNotes !== '' ? $chargeNotes . "\n" . $noteLine : $noteLine;
        $pdo->prepare('UPDATE charges SET notes = ? WHERE id = ?')->execute([$mergedNotes, $chargeId]);
    }

    return [
        'charge' => $charge,
        'payout' => $payout,
        'amount' => $amount,
        'notes' => $noteLine,
    ];
}

function reverse_payout(PDO $pdo, int $payoutId, ?string $notes = null): array {
    $stmt = $pdo->prepare(
        'SELECT p.*, ch.status AS charge_status, a.name AS animal_name, c.contract_number
         FROM payouts p
         INNER JOIN charges ch ON ch.id = p.charge_id
         INNER JOIN contracts c ON c.id = p.contract_id
         INNER JOIN animals a ON a.id = c.animal_id
         WHERE p.id = ?'
    );
    $stmt->execute([$payoutId]);
    $payout = $stmt->fetch();
    if (!$payout) {
        throw new InvalidArgumentException('Repasse não encontrado');
    }
    if (($payout['status'] ?? '') !== 'pago') {
        throw new InvalidArgumentException('Só é possível estornar repasse já marcado como pago');
    }

    $newStatus = ($payout['charge_status'] ?? '') === 'pago' ? 'pendente' : 'aguardando';
    $noteLine = trim((string)$notes) ?: 'Estorno de repasse';
    $existingNotes = trim((string)($payout['notes'] ?? ''));
    $mergedNotes = $existingNotes !== '' ? $existingNotes . "\n" . $noteLine : $noteLine;

    $pdo->prepare('UPDATE payouts SET status = ?, paid_at = NULL, notes = ? WHERE id = ?')
        ->execute([$newStatus, $mergedNotes, $payoutId]);

    return [
        'payout' => $payout,
        'newStatus' => $newStatus,
        'notes' => $mergedNotes,
    ];
}

function generate_charges(PDO $pdo, int $contractId, int $buyerId, float $total, int $n, string $firstDue, string $method, ?array $schedule = null): void {
    $n = max(1, min(50, $n));
    $rows = $schedule ?? build_equal_schedule($total, $n, $firstDue);
    // Repasses dependem das cobranças — remove antes para evitar falha de FK
    $pdo->prepare('DELETE FROM payouts WHERE contract_id = ?')->execute([$contractId]);
    $pdo->prepare('DELETE FROM charges WHERE contract_id = ?')->execute([$contractId]);
    $ins = $pdo->prepare(
        'INSERT INTO charges (contract_id, client_id, installment_no, amount, due_date, payment_method, collector, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    foreach (array_values($rows) as $i => $row) {
        $ins->execute([
            $contractId,
            $buyerId,
            $i + 1,
            $row['amount'],
            $row['dueDate'],
            $method,
            normalize_collector($row['collector'] ?? null),
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
    if ($code === 204 || trim((string)$raw) === '') {
        return [];
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
function clicksign_normalize_birthday($value): ?string {
    if ($value instanceof DateTimeInterface) {
        return $value->format('Y-m-d');
    }
    $birth = trim((string)$value);
    if ($birth === '') return null;
    if (preg_match('/^(\d{4})-(\d{2})-(\d{2})/', $birth, $m)) {
        return $m[1] . '-' . $m[2] . '-' . $m[3];
    }
    if (preg_match('/^(\d{2})\/(\d{2})\/(\d{4})$/', $birth, $m)) {
        return $m[3] . '-' . $m[2] . '-' . $m[1];
    }
    return null;
}

function clicksign_format_cpf(string $digits): string {
    return substr($digits, 0, 3) . '.' . substr($digits, 3, 3) . '.' . substr($digits, 6, 3) . '-' . substr($digits, 9, 2);
}

/** @return array{0: array, 1: ?string} attributes + aviso se faltar CPF/nascimento */
function clicksign_signer_attributes(array $s): array {
    $attrs = [
        'name' => $s['name'],
        'email' => $s['email'],
    ];
    $docType = strtoupper(trim((string)($s['document_type'] ?? '')));
    $docDigits = preg_replace('/\D+/', '', (string)($s['document'] ?? '')) ?? '';
    $hasCpf = ($docType === 'CPF' || $docType === '') && strlen($docDigits) === 11;
    // Clicksign documentation = CPF. Formato com máscara conforme docs.
    if ($hasCpf) {
        $attrs['has_documentation'] = true;
        $attrs['documentation'] = clicksign_format_cpf($docDigits);
    }
    $birthday = clicksign_normalize_birthday($s['birth_date'] ?? null);
    if ($birthday !== null) {
        $attrs['birthday'] = $birthday;
    }
    $warning = null;
    if (!$hasCpf || $birthday === null) {
        $missing = [];
        if (!$hasCpf) $missing[] = 'CPF';
        if ($birthday === null) $missing[] = 'data de nascimento';
        $warning = ucfirst((string)($s['label'] ?? 'signatário')) . ' sem ' . implode(' e ', $missing) . ' no cadastro';
    }
    return [$attrs, $warning];
}

function clicksign_names_match(?string $a, ?string $b): bool {
    $na = preg_replace('/\s+/', ' ', mb_strtoupper(trim((string)($a ?? ''))));
    $nb = preg_replace('/\s+/', ' ', mb_strtoupper(trim((string)($b ?? ''))));
    return $na !== '' && $na === $nb;
}

/** Partes do contrato na ordem de envio à Clicksign. */
function clicksign_contract_parties(array $contract): array {
    return [
        [
            'name' => trim((string)($contract['seller_name'] ?? '')),
            'email' => trim((string)($contract['seller_email'] ?? '')),
            'document' => $contract['seller_document'] ?? null,
            'document_type' => $contract['seller_document_type'] ?? null,
            'birth_date' => $contract['seller_birth_date'] ?? null,
            'role' => 'seller',
            'label' => 'Vendedor',
            'partyRole' => 'seller',
        ],
        [
            'name' => trim((string)($contract['buyer_name'] ?? '')),
            'email' => trim((string)($contract['buyer_email'] ?? '')),
            'document' => $contract['buyer_document'] ?? null,
            'document_type' => $contract['buyer_document_type'] ?? null,
            'birth_date' => $contract['buyer_birth_date'] ?? null,
            'role' => 'buyer',
            'label' => 'Comprador',
            'partyRole' => 'buyer',
        ],
        [
            'name' => trim((string)($contract['witness1_name'] ?? '')),
            'email' => trim((string)($contract['witness1_email'] ?? '')),
            'document' => $contract['witness1_document'] ?? null,
            'document_type' => $contract['witness1_document_type'] ?? null,
            'birth_date' => $contract['witness1_birth_date'] ?? null,
            'role' => 'witness',
            'label' => 'Testemunha 1',
            'partyRole' => 'witness1',
        ],
        [
            'name' => trim((string)($contract['witness2_name'] ?? '')),
            'email' => trim((string)($contract['witness2_email'] ?? '')),
            'document' => $contract['witness2_document'] ?? null,
            'document_type' => $contract['witness2_document_type'] ?? null,
            'birth_date' => $contract['witness2_birth_date'] ?? null,
            'role' => 'witness',
            'label' => 'Testemunha 2',
            'partyRole' => 'witness2',
        ],
    ];
}

function clicksign_collect_signed_emails(array $config, string $envelopeId, string $documentId): array {
    $signedEmails = [];
    if ($documentId !== '') {
        try {
            $eventsRes = clicksign_request(
                $config,
                'GET',
                "/api/v3/envelopes/{$envelopeId}/documents/{$documentId}/events?filter%5Bname%5D=sign"
            );
            foreach (($eventsRes['data'] ?? []) as $ev) {
                $email = strtolower(trim((string)($ev['attributes']['data']['user']['email'] ?? '')));
                if ($email !== '') $signedEmails[$email] = true;
            }
        } catch (Throwable $e) {
            /* fallback */
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
                if ($email !== '') $signedEmails[$email] = true;
            }
        } catch (Throwable $e) {
            /* segue */
        }
    }
    return $signedEmails;
}

function clicksign_find_cs_signer_for_party(array $party, array $csSigners, array $usedIds): ?array {
    $targetEmail = strtolower(trim((string)($party['email'] ?? '')));
    foreach ($csSigners as $cs) {
        $id = (string)($cs['id'] ?? '');
        if ($id === '' || !empty($usedIds[$id])) continue;
        $email = strtolower(trim((string)($cs['attributes']['email'] ?? '')));
        if ($targetEmail !== '' && $email === $targetEmail) {
            return $cs;
        }
    }
    foreach ($csSigners as $cs) {
        $id = (string)($cs['id'] ?? '');
        if ($id === '' || !empty($usedIds[$id])) continue;
        $csName = (string)($cs['attributes']['name'] ?? '');
        if (clicksign_names_match($party['name'] ?? '', $csName)) {
            return $cs;
        }
    }
    return null;
}

function clicksign_add_signer_with_requirements(
    array $config,
    string $envelopeId,
    string $documentId,
    array $signer
): string {
    [$signerAttrs, ] = clicksign_signer_attributes($signer);
    $signerRes = clicksign_request($config, 'POST', "/api/v3/envelopes/{$envelopeId}/signers", [
        'data' => [
            'type' => 'signers',
            'attributes' => $signerAttrs,
        ],
    ]);
    $signerId = (string)($signerRes['data']['id'] ?? '');
    if ($signerId === '') {
        throw new RuntimeException('Falha ao cadastrar signatário: ' . ($signer['label'] ?? ''));
    }
    clicksign_request($config, 'POST', "/api/v3/envelopes/{$envelopeId}/requirements", [
        'data' => [
            'type' => 'requirements',
            'attributes' => ['action' => 'agree', 'role' => $signer['role']],
            'relationships' => [
                'document' => ['data' => ['type' => 'documents', 'id' => $documentId]],
                'signer' => ['data' => ['type' => 'signers', 'id' => $signerId]],
            ],
        ],
    ]);
    clicksign_request($config, 'POST', "/api/v3/envelopes/{$envelopeId}/requirements", [
        'data' => [
            'type' => 'requirements',
            'attributes' => ['action' => 'provide_evidence', 'auth' => 'email'],
            'relationships' => [
                'document' => ['data' => ['type' => 'documents', 'id' => $documentId]],
                'signer' => ['data' => ['type' => 'signers', 'id' => $signerId]],
            ],
        ],
    ]);
    return $signerId;
}

/** Requisitos em envelope já em andamento (POST /requirements retorna 403). */
function clicksign_add_bulk_requirements(
    array $config,
    string $envelopeId,
    string $documentId,
    string $signerId,
    string $role
): void {
    clicksign_request($config, 'POST', "/api/v3/envelopes/{$envelopeId}/bulk_requirements", [
        'atomic:operations' => [
            [
                'op' => 'add',
                'data' => [
                    'type' => 'requirements',
                    'attributes' => ['action' => 'agree', 'role' => $role],
                    'relationships' => [
                        'document' => ['data' => ['type' => 'documents', 'id' => $documentId]],
                        'signer' => ['data' => ['type' => 'signers', 'id' => $signerId]],
                    ],
                ],
            ],
            [
                'op' => 'add',
                'data' => [
                    'type' => 'requirements',
                    'attributes' => ['action' => 'provide_evidence', 'auth' => 'email'],
                    'relationships' => [
                        'document' => ['data' => ['type' => 'documents', 'id' => $documentId]],
                        'signer' => ['data' => ['type' => 'signers', 'id' => $signerId]],
                    ],
                ],
            ],
        ],
    ]);
}

function clicksign_create_signer_on_running_envelope(
    array $config,
    string $envelopeId,
    string $documentId,
    array $signer
): string {
    [$signerAttrs, ] = clicksign_signer_attributes($signer);
    $signerRes = clicksign_request($config, 'POST', "/api/v3/envelopes/{$envelopeId}/signers", [
        'data' => [
            'type' => 'signers',
            'attributes' => $signerAttrs,
        ],
    ]);
    $signerId = (string)($signerRes['data']['id'] ?? '');
    if ($signerId === '') {
        throw new RuntimeException('Falha ao cadastrar signatário: ' . ($signer['label'] ?? ''));
    }
    clicksign_add_bulk_requirements($config, $envelopeId, $documentId, $signerId, (string)$signer['role']);
    return $signerId;
}

function clicksign_notify_signer(array $config, string $envelopeId, string $signerId): void {
    clicksign_request(
        $config,
        'POST',
        "/api/v3/envelopes/{$envelopeId}/signers/" . rawurlencode($signerId) . '/notifications',
        ['data' => ['type' => 'notifications', 'attributes' => []]]
    );
}

/** @return array<string, array{agree:bool,evidence:bool}> */
function clicksign_requirements_by_signer(array $config, string $envelopeId): array {
    $map = [];
    try {
        $reqsRes = clicksign_request($config, 'GET', "/api/v3/envelopes/{$envelopeId}/requirements?include=signer");
    } catch (Throwable $e) {
        return $map;
    }
    foreach (($reqsRes['data'] ?? []) as $req) {
        $signerId = (string)($req['relationships']['signer']['data']['id'] ?? '');
        if ($signerId === '') continue;
        if (!isset($map[$signerId])) {
            $map[$signerId] = ['agree' => false, 'evidence' => false];
        }
        $action = (string)($req['attributes']['action'] ?? '');
        if ($action === 'agree') $map[$signerId]['agree'] = true;
        if ($action === 'provide_evidence') $map[$signerId]['evidence'] = true;
    }
    return $map;
}

function clicksign_signer_is_ready(?array $reqStatus): bool {
    return is_array($reqStatus) && !empty($reqStatus['agree']) && !empty($reqStatus['evidence']);
}

/**
 * Atualiza signatários pendentes na Clicksign com dados do cadastro.
 * Quem já assinou não é alterado. Envelope finalizado (closed) bloqueia alteração.
 * @return array{updated:list,unchanged:list,skipped:list,warnings:list,aliases:array<string,string>}
 */
function clicksign_sync_signer_emails(
    array $config,
    PDO $pdo,
    array $contract,
    ?string $onlyPartyRole = null
): array {
    $contractId = (int)($contract['id'] ?? 0);
    $envelopeId = trim((string)($contract['clicksign_envelope_id'] ?? ''));
    $documentId = trim((string)($contract['clicksign_document_id'] ?? ''));
    if ($envelopeId === '' || $documentId === '') {
        throw new InvalidArgumentException('Contrato ainda não foi enviado à Clicksign');
    }
    $env = clicksign_request($config, 'GET', "/api/v3/envelopes/{$envelopeId}");
    $status = (string)($env['data']['attributes']['status'] ?? ($contract['clicksign_status'] ?? ''));
    if ($status === 'closed') {
        throw new InvalidArgumentException('Contrato já finalizado — não é possível alterar signatários');
    }
    if ($status !== 'running') {
        throw new InvalidArgumentException('Só é possível atualizar signatários enquanto o envelope está em processo');
    }

    $signersRes = clicksign_request($config, 'GET', "/api/v3/envelopes/{$envelopeId}/signers");
    $csSigners = is_array($signersRes['data'] ?? null) ? $signersRes['data'] : [];
    $signedEmails = clicksign_collect_signed_emails($config, $envelopeId, $documentId);
    $reqBySigner = clicksign_requirements_by_signer($config, $envelopeId);

    $updated = [];
    $unchanged = [];
    $skipped = [];
    $warnings = [];
    $aliases = [];
    $usedIds = [];

    foreach (clicksign_contract_parties($contract) as $party) {
        $partyRole = (string)($party['partyRole'] ?? '');
        if ($onlyPartyRole !== null && $partyRole !== $onlyPartyRole) {
            continue;
        }

        $label = (string)($party['label'] ?? 'Signatário');
        $newEmail = strtolower(trim((string)($party['email'] ?? '')));
        if ($newEmail === '' || !filter_var($party['email'], FILTER_VALIDATE_EMAIL)) {
            $skipped[] = ['label' => $label, 'partyRole' => $partyRole, 'reason' => 'E-mail inválido no cadastro'];
            continue;
        }

        $cs = clicksign_find_cs_signer_for_party($party, $csSigners, $usedIds);
        if (!$cs) {
            $skipped[] = ['label' => $label, 'partyRole' => $partyRole, 'reason' => 'Signatário não encontrado na Clicksign'];
            continue;
        }

        $csId = (string)($cs['id'] ?? '');
        $oldEmail = strtolower(trim((string)($cs['attributes']['email'] ?? '')));
        $usedIds[$csId] = true;

        if (!empty($signedEmails[$oldEmail]) || !empty($signedEmails[$newEmail])) {
            $skipped[] = ['label' => $label, 'partyRole' => $partyRole, 'reason' => 'Já assinou — dados não podem ser alterados'];
            continue;
        }

        $ready = clicksign_signer_is_ready($reqBySigner[$csId] ?? null);
        $emailChanged = $oldEmail !== $newEmail;

        if (!$emailChanged && $ready) {
            $unchanged[] = ['label' => $label, 'partyRole' => $partyRole, 'email' => $party['email']];
            continue;
        }

        $signerId = $csId;
        $fromEmail = $cs['attributes']['email'] ?? $oldEmail;

        if ($emailChanged) {
            clicksign_request($config, 'DELETE', "/api/v3/envelopes/{$envelopeId}/signers/{$csId}");
            $signerId = clicksign_create_signer_on_running_envelope($config, $envelopeId, $documentId, $party);
            $aliases[$csId] = $signerId;
            $usedIds[$signerId] = true;
        } elseif (!$ready) {
            clicksign_add_bulk_requirements($config, $envelopeId, $documentId, $csId, (string)$party['role']);
        }

        try {
            clicksign_notify_signer($config, $envelopeId, $signerId);
        } catch (Throwable $e) {
            $warnings[] = "{$label}: dados atualizados, mas falha ao enviar notificação";
        }

        $updated[] = [
            'label' => $label,
            'partyRole' => $partyRole,
            'from' => $fromEmail,
            'to' => $party['email'],
            'oldSignerId' => $csId,
            'newSignerId' => $signerId,
            'repaired' => !$emailChanged && !$ready,
        ];
    }

    if ($aliases && $contractId > 0) {
        clicksign_persist_signer_aliases($pdo, $contractId, $aliases);
    }

    return compact('updated', 'unchanged', 'skipped', 'warnings', 'aliases');
}

/**
 * Lista divergência de e-mail cadastro × Clicksign (somente leitura).
 * @return array{drift:list,unchanged:list,skipped:list,warnings:list}
 */
function clicksign_detect_email_drift(array $config, array $contract): array {
    $envelopeId = trim((string)($contract['clicksign_envelope_id'] ?? ''));
    $documentId = trim((string)($contract['clicksign_document_id'] ?? ''));
    if ($envelopeId === '' || $documentId === '') {
        throw new InvalidArgumentException('Contrato ainda não foi enviado à Clicksign');
    }
    $env = clicksign_request($config, 'GET', "/api/v3/envelopes/{$envelopeId}");
    $status = (string)($env['data']['attributes']['status'] ?? ($contract['clicksign_status'] ?? ''));
    if ($status !== 'running') {
        throw new InvalidArgumentException('Só é possível verificar e-mails enquanto o envelope está em processo');
    }

    $signersRes = clicksign_request($config, 'GET', "/api/v3/envelopes/{$envelopeId}/signers");
    $csSigners = is_array($signersRes['data'] ?? null) ? $signersRes['data'] : [];
    $signedEmails = clicksign_collect_signed_emails($config, $envelopeId, $documentId);
    $reqBySigner = clicksign_requirements_by_signer($config, $envelopeId);

    $drift = [];
    $unchanged = [];
    $skipped = [];
    $warnings = [];
    $usedIds = [];

    foreach (clicksign_contract_parties($contract) as $party) {
        $label = (string)($party['label'] ?? 'Signatário');
        $newEmail = strtolower(trim((string)($party['email'] ?? '')));
        if ($newEmail === '' || !filter_var($party['email'], FILTER_VALIDATE_EMAIL)) {
            $skipped[] = ['label' => $label, 'reason' => 'E-mail inválido no cadastro'];
            continue;
        }

        $cs = clicksign_find_cs_signer_for_party($party, $csSigners, $usedIds);
        if (!$cs) {
            $drift[] = [
                'label' => $label,
                'from' => null,
                'to' => $party['email'],
                'reason' => 'Signatário não encontrado na Clicksign',
            ];
            continue;
        }

        $csId = (string)($cs['id'] ?? '');
        $oldEmail = strtolower(trim((string)($cs['attributes']['email'] ?? '')));
        $usedIds[$csId] = true;

        if (!clicksign_signer_is_ready($reqBySigner[$csId] ?? null)) {
            $warnings[] = "{$label}: signatário incompleto na Clicksign — use Atualizar dados do signatário";
        }

        if (!empty($signedEmails[$oldEmail]) || !empty($signedEmails[$newEmail])) {
            if ($oldEmail !== $newEmail && empty($signedEmails[$newEmail])) {
                $skipped[] = ['label' => $label, 'reason' => 'Já assinou — e-mail não pode ser alterado'];
            } else {
                $unchanged[] = ['label' => $label, 'email' => $party['email']];
            }
            continue;
        }

        if ($oldEmail === $newEmail) {
            $unchanged[] = ['label' => $label, 'email' => $party['email']];
            continue;
        }

        $drift[] = [
            'label' => $label,
            'partyRole' => $party['partyRole'] ?? null,
            'from' => $cs['attributes']['email'] ?? $oldEmail,
            'to' => $party['email'],
            'reason' => 'E-mail divergente do cadastro',
        ];
    }

    return compact('drift', 'unchanged', 'skipped', 'warnings');
}

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
    $title = trim((string)($contract['template_title'] ?? '')) ?: 'CONTRATO PARTICULAR DE COMPRA E VENDA DE SEMOVENTE COM RESERVA DE DOMÍNIO';

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
            'document' => $contract['seller_document'] ?? null,
            'document_type' => $contract['seller_document_type'] ?? null,
            'birth_date' => $contract['seller_birth_date'] ?? null,
            'role' => 'seller',
            'label' => 'vendedor',
        ],
        [
            'name' => trim((string)($contract['buyer_name'] ?? '')),
            'email' => trim((string)($contract['buyer_email'] ?? '')),
            'document' => $contract['buyer_document'] ?? null,
            'document_type' => $contract['buyer_document_type'] ?? null,
            'birth_date' => $contract['buyer_birth_date'] ?? null,
            'role' => 'buyer',
            'label' => 'comprador',
        ],
        [
            'name' => trim((string)($contract['witness1_name'] ?? '')),
            'email' => trim((string)($contract['witness1_email'] ?? '')),
            'document' => $contract['witness1_document'] ?? null,
            'document_type' => $contract['witness1_document_type'] ?? null,
            'birth_date' => $contract['witness1_birth_date'] ?? null,
            'role' => 'witness',
            'label' => 'testemunha 1',
        ],
        [
            'name' => trim((string)($contract['witness2_name'] ?? '')),
            'email' => trim((string)($contract['witness2_email'] ?? '')),
            'document' => $contract['witness2_document'] ?? null,
            'document_type' => $contract['witness2_document_type'] ?? null,
            'birth_date' => $contract['witness2_birth_date'] ?? null,
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

    $warnings = [];
    foreach ($signers as $s) {
        [$signerAttrs, $signerWarning] = clicksign_signer_attributes($s);
        if ($signerWarning !== null) $warnings[] = $signerWarning;

        $signerRes = clicksign_request($config, 'POST', "/api/v3/envelopes/{$envelopeId}/signers", [
            'data' => [
                'type' => 'signers',
                'attributes' => $signerAttrs,
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
                    // Widget iframe (embedded.min) exige auth email/sms/whatsapp.
                    // embedded_signature só funciona com o fluxo noWidget (sem iframe).
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
        'warnings' => $warnings,
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

function clicksign_parse_signer_aliases(?string $raw): array {
    if ($raw === null || $raw === '') return [];
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function clicksign_persist_signer_aliases(PDO $pdo, int $contractId, array $newAliases): void {
    if (!$newAliases) return;
    try {
        $stmt = $pdo->prepare('SELECT clicksign_signer_aliases FROM contracts WHERE id = ?');
        $stmt->execute([$contractId]);
        $row = $stmt->fetch();
        $aliases = clicksign_parse_signer_aliases($row['clicksign_signer_aliases'] ?? null);
        foreach ($newAliases as $old => $new) {
            $old = trim((string)$old);
            $new = trim((string)$new);
            if ($old !== '' && $new !== '') $aliases[$old] = $new;
        }
        $pdo->prepare('UPDATE contracts SET clicksign_signer_aliases = ? WHERE id = ?')
            ->execute([json_encode($aliases), $contractId]);
    } catch (Throwable $e) {
        // coluna ainda não migrada
    }
}

/**
 * Valida ou redireciona um ID de signatário (links antigos após troca de e-mail).
 * @return array{signerKey:string,replaced:bool,contractId?:string}
 */
function clicksign_resolve_signer_key(array $config, PDO $pdo, string $key): array {
    $key = trim($key);
    if ($key === '') {
        throw new InvalidArgumentException('Link de assinatura inválido');
    }

    try {
        $stmt = $pdo->query(
            "SELECT id, clicksign_envelope_id, clicksign_signer_aliases
             FROM contracts
             WHERE clicksign_envelope_id IS NOT NULL
               AND clicksign_status = 'running'"
        );
        foreach ($stmt->fetchAll() as $row) {
            $aliases = clicksign_parse_signer_aliases($row['clicksign_signer_aliases'] ?? null);
            if (!empty($aliases[$key])) {
                return [
                    'signerKey' => (string)$aliases[$key],
                    'replaced' => true,
                    'contractId' => (string)$row['id'],
                ];
            }
        }
    } catch (Throwable $e) {
        // coluna pode não existir
    }

    try {
        $stmt = $pdo->query(
            "SELECT id, clicksign_envelope_id
             FROM contracts
             WHERE clicksign_envelope_id IS NOT NULL
               AND clicksign_status = 'running'"
        );
        foreach ($stmt->fetchAll() as $row) {
            $envelopeId = trim((string)($row['clicksign_envelope_id'] ?? ''));
            if ($envelopeId === '') continue;
            try {
                $signersRes = clicksign_request($config, 'GET', "/api/v3/envelopes/{$envelopeId}/signers");
                foreach (($signersRes['data'] ?? []) as $cs) {
                    if ((string)($cs['id'] ?? '') === $key) {
                        return [
                            'signerKey' => $key,
                            'replaced' => false,
                            'contractId' => (string)$row['id'],
                        ];
                    }
                }
            } catch (Throwable $e) {
                continue;
            }
        }
    } catch (Throwable $e) {
        /* segue */
    }

    throw new InvalidArgumentException(
        'Este link de assinatura expirou (geralmente após atualização de e-mail). ' .
        'Peça um novo link pelo WhatsApp ou abra o e-mail mais recente da Clicksign.'
    );
}

/** URL pública no nosso sistema (assinatura incorporada Clicksign). */
function clicksign_sign_url(array $config, ?string $signerId, ?array $csSigner = null): ?string {
    if (is_array($csSigner)) {
        $attrs = $csSigner['attributes'] ?? [];
        foreach (['url', 'sign_url', 'signing_url'] as $key) {
            if (!empty($attrs[$key]) && is_string($attrs[$key])) {
                return $attrs[$key];
            }
        }
        $links = $csSigner['links'] ?? [];
        foreach (['sign', 'signing_url', 'url'] as $key) {
            if (!empty($links[$key]) && is_string($links[$key]) && !str_contains($links[$key], '/api/v3/')) {
                return $links[$key];
            }
        }
    }
    $id = trim((string)$signerId);
    if ($id === '') return null;
    $base = rtrim((string)($config['clicksign_base_url'] ?? 'https://app.clicksign.com'), '/');
    if ($base !== '') {
        return $base . '/notarial/widget/signatures/' . rawurlencode($id) . '/redirect';
    }
    $host = trim((string)($_SERVER['HTTP_HOST'] ?? ''));
    if ($host === '') {
        return '/assinar/' . rawurlencode($id);
    }
    return 'https://' . $host . '/assinar/' . rawurlencode($id);
}

function clicksign_notify(array $config, array $contract, ?string $signerId = null): void {
    $envelopeId = trim((string)($contract['clicksign_envelope_id'] ?? ''));
    if ($envelopeId === '') {
        throw new InvalidArgumentException('Contrato ainda não foi enviado à Clicksign');
    }
    if (($contract['status'] ?? '') === 'cancelado') {
        throw new InvalidArgumentException('Contrato cancelado');
    }
    $env = clicksign_request($config, 'GET', "/api/v3/envelopes/{$envelopeId}");
    $status = (string)($env['data']['attributes']['status'] ?? ($contract['clicksign_status'] ?? ''));
    if ($status !== 'running') {
        throw new InvalidArgumentException('Só é possível reenviar notificações enquanto o envelope está em processo');
    }
    $payload = [
        'data' => [
            'type' => 'notifications',
            'attributes' => new stdClass(),
        ],
    ];
    $sid = trim((string)$signerId);
    if ($sid !== '') {
        clicksign_request(
            $config,
            'POST',
            "/api/v3/envelopes/{$envelopeId}/signers/" . rawurlencode($sid) . '/notifications',
            $payload
        );
        return;
    }
    clicksign_request($config, 'POST', "/api/v3/envelopes/{$envelopeId}/notifications", $payload);
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
    $reqBySigner = clicksign_requirements_by_signer($config, $envelopeId);

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
        [
            'role' => 'seller',
            'label' => 'Vendedor',
            'name' => $contract['seller_name'] ?? null,
            'email' => $contract['seller_email'] ?? null,
            'phone' => $contract['seller_phone'] ?? null,
            'whatsapp' => $contract['seller_whatsapp'] ?? null,
        ],
        [
            'role' => 'buyer',
            'label' => 'Comprador',
            'name' => $contract['buyer_name'] ?? null,
            'email' => $contract['buyer_email'] ?? null,
            'phone' => $contract['buyer_phone'] ?? null,
            'whatsapp' => $contract['buyer_whatsapp'] ?? null,
        ],
        [
            'role' => 'witness1',
            'label' => 'Testemunha 1',
            'name' => $contract['witness1_name'] ?? null,
            'email' => $contract['witness1_email'] ?? null,
            'phone' => $contract['witness1_phone'] ?? null,
            'whatsapp' => $contract['witness1_whatsapp'] ?? null,
        ],
        [
            'role' => 'witness2',
            'label' => 'Testemunha 2',
            'name' => $contract['witness2_name'] ?? null,
            'email' => $contract['witness2_email'] ?? null,
            'phone' => $contract['witness2_phone'] ?? null,
            'whatsapp' => $contract['witness2_whatsapp'] ?? null,
        ],
    ];

    $byEmail = [];
    foreach ($csSigners as $s) {
        $email = strtolower(trim((string)($s['attributes']['email'] ?? '')));
        if ($email !== '') $byEmail[$email] = $s;
    }

    $partyRoles = ['seller', 'buyer', 'witness1', 'witness2'];
    $signers = [];
    $usedCsIds = [];
    $partyIndex = 0;
    foreach ($parties as $p) {
        $partyRole = $partyRoles[$partyIndex] ?? ('party' . $partyIndex);
        $partyIndex++;
        $cadastroEmail = trim((string)($p['email'] ?? ''));
        $email = strtolower($cadastroEmail);
        $partyForMatch = [
            'name' => $p['name'] ?? '',
            'email' => $cadastroEmail,
            'label' => $p['label'] ?? '',
        ];
        $cs = clicksign_find_cs_signer_for_party($partyForMatch, $csSigners, $usedCsIds);
        if ($cs) {
            $usedCsIds[(string)($cs['id'] ?? '')] = true;
        }
        $csEmail = $cs ? strtolower(trim((string)($cs['attributes']['email'] ?? ''))) : '';
        $csName = $cs ? trim((string)($cs['attributes']['name'] ?? '')) : '';
        $name = trim((string)($p['name'] ?? '')) ?: ($csName !== '' ? $csName : '—');
        $signed = ($csEmail !== '' && !empty($signedEmails[$csEmail]))
            || ($email !== '' && !empty($signedEmails[$email]));
        // Se o envelope já fechou e não achamos evento, considera assinado
        if (!$signed && $status === 'closed' && $email !== '') $signed = true;
        $signerId = $cs['id'] ?? null;
        $signerKey = $signerId ? (string)$signerId : null;
        $ready = $signerKey && clicksign_signer_is_ready($reqBySigner[$signerKey] ?? null);
        $hasEmailDrift = !$signed && $status === 'running' && $cadastroEmail !== ''
            && $cs !== null && $csEmail !== '' && strtolower($cadastroEmail) !== $csEmail;
        $signers[] = [
            'role' => $p['role'],
            'partyRole' => $partyRole,
            'label' => $p['label'],
            'name' => $name,
            'email' => $cadastroEmail ?: ($cs ? ($cs['attributes']['email'] ?? null) : null),
            'clicksignEmail' => $cs ? ($cs['attributes']['email'] ?? null) : null,
            'phone' => $p['phone'] ?? null,
            'whatsapp' => $p['whatsapp'] ?? null,
            'signerId' => $signerKey,
            'signUrl' => ($signed || !$ready) ? null : clicksign_sign_url($config, $signerKey, $cs),
            'signed' => $signed,
            'status' => $signed ? 'assinado' : ($ready ? 'pendente' : 'invalido'),
            'statusLabel' => $signed ? 'Assinado' : ($ready ? 'Pendente' : 'Reenvio necessário'),
            'signedAt' => $signedAtByEmail[$csEmail] ?? ($signedAtByEmail[$email] ?? null),
            'needsResend' => !$signed && !$ready,
            'emailDrift' => $hasEmailDrift,
            'canUpdate' => !$signed && $status === 'running',
        ];
    }

    // Signatários extras da Clicksign que não bateram com as partes
    foreach ($csSigners as $s) {
        $csId = (string)($s['id'] ?? '');
        if ($csId !== '' && !empty($usedCsIds[$csId])) continue;
        $email = strtolower(trim((string)($s['attributes']['email'] ?? '')));
        $signed = ($email !== '' && !empty($signedEmails[$email])) || $status === 'closed';
        $signerId = $s['id'] ?? null;
        $signerKey = $signerId ? (string)$signerId : null;
        $ready = $signerKey && clicksign_signer_is_ready($reqBySigner[$signerKey] ?? null);
        $signers[] = [
            'role' => 'other',
            'label' => 'Signatário',
            'name' => trim((string)($s['attributes']['name'] ?? '')) ?: '—',
            'email' => $s['attributes']['email'] ?? null,
            'clicksignEmail' => $s['attributes']['email'] ?? null,
            'phone' => $s['attributes']['phone_number'] ?? null,
            'whatsapp' => null,
            'signerId' => $signerKey,
            'signUrl' => ($signed || !$ready) ? null : clicksign_sign_url($config, $signerKey, $s),
            'signed' => $signed,
            'status' => $signed ? 'assinado' : ($ready ? 'pendente' : 'invalido'),
            'statusLabel' => $signed ? 'Assinado' : ($ready ? 'Pendente' : 'Reenvio necessário'),
            'signedAt' => $signedAtByEmail[$email] ?? null,
            'needsResend' => !$signed && !$ready,
            'emailDrift' => false,
            'canUpdate' => false,
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
        'emailDrift' => array_reduce(
            $signers,
            static fn (bool $carry, array $s): bool => $carry || !empty($s['emailDrift']),
            false
        ),
        'needsResend' => array_reduce(
            $signers,
            static fn (bool $carry, array $s): bool => $carry || !empty($s['needsResend']),
            false
        ),
    ];
}

function clicksign_persist_progress(PDO $pdo, int $contractId, int $signedCount, int $totalCount, ?string $status = null): void {
    try {
        if ($status !== null) {
            $pdo->prepare(
                'UPDATE contracts SET clicksign_signed_count=?, clicksign_total_count=?, clicksign_status=? WHERE id=?'
            )->execute([$signedCount, $totalCount, $status, $contractId]);
        } else {
            $pdo->prepare(
                'UPDATE contracts SET clicksign_signed_count=?, clicksign_total_count=? WHERE id=?'
            )->execute([$signedCount, $totalCount, $contractId]);
        }
    } catch (Throwable $e) {
        // colunas ainda não migradas
    }
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
        'seller_birth_date' => $r['seller_birth_date'] ?? null,
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
        'buyer_birth_date' => $r['buyer_birth_date'] ?? null,
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
        'witness1_phone' => $r['witness1_phone'] ?? null,
        'witness1_whatsapp' => $r['witness1_whatsapp'] ?? null,
        'witness1_document' => $r['witness1_document'] ?? null,
        'witness1_document_type' => $r['witness1_document_type'] ?? null,
        'witness1_birth_date' => $r['witness1_birth_date'] ?? null,
        'witness2_id' => !empty($r['witness2_id']) ? (string)$r['witness2_id'] : null,
        'witness2_name' => $r['witness2_name'] ?? null,
        'witness2_email' => $r['witness2_email'] ?? null,
        'witness2_phone' => $r['witness2_phone'] ?? null,
        'witness2_whatsapp' => $r['witness2_whatsapp'] ?? null,
        'witness2_document' => $r['witness2_document'] ?? null,
        'witness2_document_type' => $r['witness2_document_type'] ?? null,
        'witness2_birth_date' => $r['witness2_birth_date'] ?? null,
        'via_label' => $r['via_label'] ?? 'VIA DAS PARTES — VENDEDOR E COMPRADOR',
        'clicksign_envelope_id' => $r['clicksign_envelope_id'] ?? null,
        'clicksign_document_id' => $r['clicksign_document_id'] ?? null,
        'clicksign_status' => $r['clicksign_status'] ?? null,
        'clicksign_sent_at' => $r['clicksign_sent_at'] ?? null,
        'clicksign_signed_count' => isset($r['clicksign_signed_count']) ? (int)$r['clicksign_signed_count'] : null,
        'clicksign_total_count' => isset($r['clicksign_total_count']) ? (int)$r['clicksign_total_count'] : null,
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

const AUCTION_EXPENSE_CATEGORIES = ['locacao', 'equipe', 'marketing', 'leiloeiro', 'transporte', 'outros'];

function normalize_auction_expense_category(?string $cat): string {
    $cat = $cat ?? 'outros';
    return in_array($cat, AUCTION_EXPENSE_CATEGORIES, true) ? $cat : 'outros';
}

function map_auction_expense_row(array $r): array {
    return [
        'id' => (string)$r['id'],
        'auction_id' => (string)$r['auction_id'],
        'category' => $r['category'],
        'description' => $r['description'],
        'amount' => (float)$r['amount'],
        'expense_date' => $r['expense_date'],
        'created_at' => $r['created_at'] ?? null,
    ];
}

function fetch_auction_finance(PDO $pdo, int $auctionId): array {
    $stmt = $pdo->prepare('SELECT id FROM auctions WHERE id = ?');
    $stmt->execute([$auctionId]);
    if (!$stmt->fetch()) {
        throw new InvalidArgumentException('Leilão não encontrado');
    }

    $lotsStmt = $pdo->prepare(
        "SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN status = 'arrematado' THEN 1 ELSE 0 END) AS sold
         FROM auction_lots WHERE auction_id = ?"
    );
    $lotsStmt->execute([$auctionId]);
    $lots = $lotsStmt->fetch() ?: ['total' => 0, 'sold' => 0];

    $contractsStmt = $pdo->prepare(
        "SELECT c.id, c.contract_number, c.total_amount, c.status, c.sale_type,
                an.name AS animal_name, b.name AS buyer_name, l.lot_number
         FROM contracts c
         LEFT JOIN animals an ON an.id = c.animal_id
         LEFT JOIN clients b ON b.id = c.buyer_id
         LEFT JOIN auction_lots l ON l.id = c.lot_id
         WHERE c.auction_id = ? AND c.status != 'cancelado'
         ORDER BY c.id ASC"
    );
    $contractsStmt->execute([$auctionId]);
    $contracts = $contractsStmt->fetchAll();

    $revenueTotal = 0.0;
    $revenueByStatus = [
        'rascunho' => 0.0,
        'aguardando_assinatura' => 0.0,
        'ativo' => 0.0,
        'concluido' => 0.0,
    ];
    $assessoriaEstimated = 0.0;
    $contractRows = [];

    $pctStmt = $pdo->prepare(
        "SELECT COALESCE(SUM(pct), 0) AS pct
         FROM contract_payout_rules
         WHERE contract_id = ? AND beneficiary_role = 'assessoria'"
    );

    foreach ($contracts as $c) {
        $amount = (float)$c['total_amount'];
        $status = (string)$c['status'];
        $revenueTotal += $amount;
        if (isset($revenueByStatus[$status])) {
            $revenueByStatus[$status] += $amount;
        }
        $pctStmt->execute([(int)$c['id']]);
        $assessoriaPct = (float)($pctStmt->fetch()['pct'] ?? 0);
        $assessoriaEstimated += $amount * $assessoriaPct / 100;

        $contractRows[] = [
            'id' => (string)$c['id'],
            'contract_number' => $c['contract_number'],
            'animal_name' => $c['animal_name'],
            'buyer_name' => $c['buyer_name'],
            'lot_number' => $c['lot_number'],
            'total_amount' => $amount,
            'status' => $status,
            'assessoria_pct' => $assessoriaPct,
            'assessoria_amount' => round($amount * $assessoriaPct / 100, 2),
        ];
    }

    $expStmt = $pdo->prepare(
        'SELECT * FROM auction_expenses WHERE auction_id = ? ORDER BY COALESCE(expense_date, created_at) DESC, id DESC'
    );
    $expStmt->execute([$auctionId]);
    $expenses = array_map('map_auction_expense_row', $expStmt->fetchAll());

    $expensesTotal = 0.0;
    $expensesByCategory = [];
    foreach ($expenses as $e) {
        $expensesTotal += $e['amount'];
        $cat = $e['category'];
        if (!isset($expensesByCategory[$cat])) $expensesByCategory[$cat] = 0.0;
        $expensesByCategory[$cat] += $e['amount'];
    }

    $resultNet = $assessoriaEstimated - $expensesTotal;

    return [
        'auction_id' => (string)$auctionId,
        'lots_total' => (int)$lots['total'],
        'lots_sold' => (int)$lots['sold'],
        'revenue_total' => round($revenueTotal, 2),
        'revenue_by_status' => array_map(fn($v) => round($v, 2), $revenueByStatus),
        'assessoria_estimated' => round($assessoriaEstimated, 2),
        'expenses_total' => round($expensesTotal, 2),
        'expenses_by_category' => array_map(fn($v) => round($v, 2), $expensesByCategory),
        'result_net' => round($resultNet, 2),
        'contracts' => $contractRows,
        'expenses' => $expenses,
    ];
}

function client_is_assessor(PDO $pdo, ?int $clientId): bool {
    if (!$clientId) return false;
    $stmt = $pdo->prepare('SELECT is_assessor FROM clients WHERE id = ? LIMIT 1');
    $stmt->execute([$clientId]);
    $row = $stmt->fetch();
    return $row ? (bool)$row['is_assessor'] : false;
}

function fetch_assessor_auctions(PDO $pdo, int $assessorClientId): array {
    $stmt = $pdo->prepare(
        "SELECT a.*,
            COUNT(DISTINCT c.id) AS contracts_count,
            COALESCE(SUM(c.total_amount), 0) AS sales_total
         FROM auctions a
         INNER JOIN contracts c ON c.auction_id = a.id AND c.assessor_id = ? AND c.status != 'cancelado'
         GROUP BY a.id
         ORDER BY COALESCE(a.auction_date, a.created_at) DESC, a.id DESC"
    );
    $stmt->execute([$assessorClientId]);
    $rows = $stmt->fetchAll();

    $out = [];
    $commissionStmt = $pdo->prepare(
        "SELECT COALESCE(SUM(c.total_amount * rules.pct / 100), 0) AS commission
         FROM contracts c
         INNER JOIN (
           SELECT contract_id, COALESCE(SUM(pct), 0) AS pct
           FROM contract_payout_rules
           WHERE beneficiary_role = 'assessor'
             AND (beneficiary_client_id IS NULL OR beneficiary_client_id = ?)
           GROUP BY contract_id
         ) rules ON rules.contract_id = c.id
         WHERE c.auction_id = ? AND c.assessor_id = ? AND c.status != 'cancelado'"
    );
    foreach ($rows as $r) {
        $auctionId = (int)$r['id'];
        $commissionStmt->execute([$assessorClientId, $auctionId, $assessorClientId]);
        $commissionEstimated = (float)($commissionStmt->fetch()['commission'] ?? 0);
        $salesTotal = (float)$r['sales_total'];
        $mapped = map_auction_row($r);
        $mapped['contracts_count'] = (int)$r['contracts_count'];
        $mapped['sales_total'] = round($salesTotal, 2);
        $mapped['commission_estimated'] = round($commissionEstimated, 2);
        $out[] = $mapped;
    }
    return $out;
}

function fetch_assessor_auction_finance(PDO $pdo, int $auctionId, int $assessorClientId): array {
    $accessStmt = $pdo->prepare(
        "SELECT 1 FROM contracts WHERE auction_id = ? AND assessor_id = ? AND status != 'cancelado' LIMIT 1"
    );
    $accessStmt->execute([$auctionId, $assessorClientId]);
    if (!$accessStmt->fetch()) {
        throw new InvalidArgumentException('Evento não encontrado ou sem acesso');
    }

    $auctionStmt = $pdo->prepare('SELECT * FROM auctions WHERE id = ?');
    $auctionStmt->execute([$auctionId]);
    $auction = $auctionStmt->fetch();
    if (!$auction) {
        throw new InvalidArgumentException('Leilão não encontrado');
    }

    $contractsStmt = $pdo->prepare(
        "SELECT c.id, c.contract_number, c.total_amount, c.status,
                an.name AS animal_name, b.name AS buyer_name, l.lot_number
         FROM contracts c
         LEFT JOIN animals an ON an.id = c.animal_id
         LEFT JOIN clients b ON b.id = c.buyer_id
         LEFT JOIN auction_lots l ON l.id = c.lot_id
         WHERE c.auction_id = ? AND c.assessor_id = ? AND c.status != 'cancelado'
         ORDER BY c.id ASC"
    );
    $contractsStmt->execute([$auctionId, $assessorClientId]);
    $contracts = $contractsStmt->fetchAll();

    $pctStmt = $pdo->prepare(
        "SELECT COALESCE(SUM(pct), 0) AS pct
         FROM contract_payout_rules
         WHERE contract_id = ? AND beneficiary_role = 'assessor'
           AND (beneficiary_client_id IS NULL OR beneficiary_client_id = ?)"
    );

    $salesTotal = 0.0;
    $commissionEstimated = 0.0;
    $contractRows = [];
    foreach ($contracts as $c) {
        $amount = (float)$c['total_amount'];
        $salesTotal += $amount;
        $pctStmt->execute([(int)$c['id'], $assessorClientId]);
        $commissionPct = (float)($pctStmt->fetch()['pct'] ?? 0);
        $commissionAmount = round($amount * $commissionPct / 100, 2);
        $commissionEstimated += $commissionAmount;
        $contractRows[] = [
            'id' => (string)$c['id'],
            'contract_number' => $c['contract_number'],
            'animal_name' => $c['animal_name'],
            'buyer_name' => $c['buyer_name'],
            'lot_number' => $c['lot_number'],
            'total_amount' => $amount,
            'status' => $c['status'],
            'commission_pct' => $commissionPct,
            'commission_amount' => $commissionAmount,
        ];
    }

    $payoutsStmt = $pdo->prepare(
        "SELECT p.id, p.contract_id, p.installment_no, p.amount, p.status, p.paid_at,
                ch.due_date AS charge_due_date, an.name AS animal_name
         FROM payouts p
         INNER JOIN contracts c ON c.id = p.contract_id
         INNER JOIN charges ch ON ch.id = p.charge_id
         INNER JOIN animals an ON an.id = c.animal_id
         WHERE c.auction_id = ? AND c.status != 'cancelado'
           AND p.beneficiary_role = 'assessor' AND p.beneficiary_client_id = ?
         ORDER BY ch.due_date ASC, p.installment_no ASC, p.id ASC"
    );
    $payoutsStmt->execute([$auctionId, $assessorClientId]);
    $payoutRows = $payoutsStmt->fetchAll();

    $commissionPaid = 0.0;
    $commissionPending = 0.0;
    $commissionWaiting = 0.0;
    $payouts = [];
    foreach ($payoutRows as $p) {
        $amount = (float)$p['amount'];
        $status = (string)$p['status'];
        if ($status === 'pago') $commissionPaid += $amount;
        elseif ($status === 'pendente') $commissionPending += $amount;
        elseif ($status === 'aguardando') $commissionWaiting += $amount;
        $payouts[] = [
            'id' => (string)$p['id'],
            'contract_id' => (string)$p['contract_id'],
            'installment_no' => (int)$p['installment_no'],
            'amount' => $amount,
            'status' => $status,
            'paid_at' => $p['paid_at'],
            'charge_due_date' => $p['charge_due_date'],
            'animal_name' => $p['animal_name'],
        ];
    }

    return [
        'auction_id' => (string)$auctionId,
        'auction_name' => $auction['name'],
        'auction_date' => $auction['auction_date'],
        'location' => $auction['location'],
        'auction_status' => $auction['status'],
        'contracts_count' => count($contractRows),
        'sales_total' => round($salesTotal, 2),
        'commission_estimated' => round($commissionEstimated, 2),
        'commission_paid' => round($commissionPaid, 2),
        'commission_pending' => round($commissionPending, 2),
        'commission_waiting' => round($commissionWaiting, 2),
        'contracts' => $contractRows,
        'payouts' => $payouts,
    ];
}

const CLIENT_MODULE_CODES = ['plantel', 'reproducao', 'sanitario', 'contratos', 'leiloes'];

function normalize_client_module_code(?string $code): ?string {
    $code = $code ?? '';
    return in_array($code, CLIENT_MODULE_CODES, true) ? $code : null;
}

function fetch_client_modules(PDO $pdo, int $clientId): array {
    try {
        $stmt = $pdo->prepare('SELECT * FROM client_modules WHERE client_id = ? ORDER BY module_code ASC');
        $stmt->execute([$clientId]);
        return array_map(function ($r) {
            return [
                'code' => $r['module_code'],
                'active' => (bool)$r['active'],
                'monthlyFee' => $r['monthly_fee'] !== null ? (float)$r['monthly_fee'] : null,
                'activatedAt' => $r['activated_at'],
                'notes' => $r['notes'],
            ];
        }, $stmt->fetchAll());
    } catch (Throwable $e) {
        return [];
    }
}

function charge_open_sql(string $chAlias = 'ch', string $cAlias = 'c'): string {
    return "{$cAlias}.status != 'cancelado' AND {$chAlias}.status IN ('pendente','atrasado')";
}

function charge_overdue_sql(string $chAlias = 'ch', string $cAlias = 'c'): string {
    return "{$cAlias}.status != 'cancelado' AND {$chAlias}.status IN ('pendente','atrasado')
        AND ({$chAlias}.status = 'atrasado' OR {$chAlias}.due_date < CURDATE())";
}

function fetch_receivables_dashboard(PDO $pdo): array {
    $openWhere = charge_open_sql();
    $overdueWhere = charge_overdue_sql();

    $totals = $pdo->query(
        "SELECT
            COALESCE(SUM(CASE WHEN {$openWhere} THEN ch.amount ELSE 0 END), 0) AS open_total,
            COALESCE(SUM(CASE WHEN {$overdueWhere} THEN ch.amount ELSE 0 END), 0) AS overdue_total,
            COALESCE(SUM(CASE WHEN {$openWhere} THEN 1 ELSE 0 END), 0) AS open_count,
            COALESCE(SUM(CASE WHEN {$overdueWhere} THEN 1 ELSE 0 END), 0) AS overdue_count
         FROM charges ch
         INNER JOIN contracts c ON c.id = ch.contract_id"
    )->fetch() ?: [];

    $aging = $pdo->query(
        "SELECT
            COALESCE(SUM(CASE WHEN ch.status = 'pendente' AND ch.due_date >= CURDATE() THEN ch.amount ELSE 0 END), 0) AS current,
            COALESCE(SUM(CASE WHEN {$overdueWhere} AND DATEDIFF(CURDATE(), ch.due_date) BETWEEN 1 AND 30 THEN ch.amount ELSE 0 END), 0) AS d1_30,
            COALESCE(SUM(CASE WHEN {$overdueWhere} AND DATEDIFF(CURDATE(), ch.due_date) BETWEEN 31 AND 60 THEN ch.amount ELSE 0 END), 0) AS d31_60,
            COALESCE(SUM(CASE WHEN {$overdueWhere} AND DATEDIFF(CURDATE(), ch.due_date) BETWEEN 61 AND 90 THEN ch.amount ELSE 0 END), 0) AS d61_90,
            COALESCE(SUM(CASE WHEN {$overdueWhere} AND DATEDIFF(CURDATE(), ch.due_date) > 90 THEN ch.amount ELSE 0 END), 0) AS d90_plus
         FROM charges ch
         INNER JOIN contracts c ON c.id = ch.contract_id"
    )->fetch() ?: [];

    $byCollector = $pdo->query(
        "SELECT ch.collector,
            COALESCE(SUM(CASE WHEN {$openWhere} THEN ch.amount ELSE 0 END), 0) AS open_amount,
            COALESCE(SUM(CASE WHEN {$overdueWhere} THEN ch.amount ELSE 0 END), 0) AS overdue_amount,
            COALESCE(SUM(CASE WHEN {$overdueWhere} THEN 1 ELSE 0 END), 0) AS overdue_count
         FROM charges ch
         INNER JOIN contracts c ON c.id = ch.contract_id
         GROUP BY ch.collector"
    )->fetchAll();

    $collectorMap = ['assessoria' => ['open' => 0, 'overdue' => 0, 'overdueCount' => 0], 'seller' => ['open' => 0, 'overdue' => 0, 'overdueCount' => 0]];
    foreach ($byCollector as $row) {
        $key = $row['collector'] === 'seller' ? 'seller' : 'assessoria';
        $collectorMap[$key] = [
            'open' => round((float)$row['open_amount'], 2),
            'overdue' => round((float)$row['overdue_amount'], 2),
            'overdueCount' => (int)$row['overdue_count'],
        ];
    }

    $debtorsStmt = $pdo->query(
        "SELECT cl.id, cl.name, cl.whatsapp, cl.phone,
            COUNT(*) AS charges_count,
            COALESCE(SUM(ch.amount), 0) AS overdue_amount,
            MIN(ch.due_date) AS oldest_due
         FROM charges ch
         INNER JOIN contracts c ON c.id = ch.contract_id
         INNER JOIN clients cl ON cl.id = ch.client_id
         WHERE {$overdueWhere}
         GROUP BY cl.id, cl.name, cl.whatsapp, cl.phone
         ORDER BY overdue_amount DESC, oldest_due ASC
         LIMIT 15"
    );
    $topDebtors = array_map(function ($r) {
        return [
            'clientId' => (string)$r['id'],
            'clientName' => $r['name'],
            'whatsapp' => $r['whatsapp'],
            'phone' => $r['phone'],
            'chargesCount' => (int)$r['charges_count'],
            'overdueAmount' => round((float)$r['overdue_amount'], 2),
            'oldestDue' => $r['oldest_due'],
        ];
    }, $debtorsStmt->fetchAll());

    $itemsStmt = $pdo->query(
        "SELECT ch.id, ch.amount, ch.due_date, ch.status, ch.collector, ch.installment_no,
                cl.name AS client_name, cl.whatsapp, an.name AS animal_name, c.contract_number,
                DATEDIFF(CURDATE(), ch.due_date) AS days_overdue
         FROM charges ch
         INNER JOIN contracts c ON c.id = ch.contract_id
         INNER JOIN clients cl ON cl.id = ch.client_id
         LEFT JOIN animals an ON an.id = c.animal_id
         WHERE {$overdueWhere}
         ORDER BY ch.due_date ASC, ch.amount DESC
         LIMIT 50"
    );
    $overdueItems = array_map(function ($r) {
        return [
            'id' => (string)$r['id'],
            'amount' => (float)$r['amount'],
            'dueDate' => $r['due_date'],
            'status' => $r['status'],
            'collector' => $r['collector'],
            'installmentNo' => (int)$r['installment_no'],
            'clientName' => $r['client_name'],
            'whatsapp' => $r['whatsapp'],
            'animalName' => $r['animal_name'],
            'contractNumber' => $r['contract_number'],
            'daysOverdue' => (int)$r['days_overdue'],
        ];
    }, $itemsStmt->fetchAll());

    return [
        'openTotal' => round((float)($totals['open_total'] ?? 0), 2),
        'overdueTotal' => round((float)($totals['overdue_total'] ?? 0), 2),
        'openCount' => (int)($totals['open_count'] ?? 0),
        'overdueCount' => (int)($totals['overdue_count'] ?? 0),
        'aging' => [
            'current' => round((float)($aging['current'] ?? 0), 2),
            'd1_30' => round((float)($aging['d1_30'] ?? 0), 2),
            'd31_60' => round((float)($aging['d31_60'] ?? 0), 2),
            'd61_90' => round((float)($aging['d61_90'] ?? 0), 2),
            'd90_plus' => round((float)($aging['d90_plus'] ?? 0), 2),
        ],
        'byCollector' => $collectorMap,
        'topDebtors' => $topDebtors,
        'overdueItems' => $overdueItems,
    ];
}

function collection_events_table_exists(PDO $pdo): bool {
    static $exists = null;
    if ($exists !== null) {
        return $exists;
    }
    try {
        $stmt = $pdo->query("SHOW TABLES LIKE 'charge_collection_events'");
        $exists = (bool)$stmt->fetch();
    } catch (Throwable $e) {
        $exists = false;
    }
    return $exists;
}

function map_collection_event_row(array $r): array {
    return [
        'id' => (string)$r['id'],
        'chargeId' => (string)$r['charge_id'],
        'userId' => $r['user_id'] ? (string)$r['user_id'] : null,
        'userName' => $r['user_name'] ?? null,
        'note' => $r['note'],
        'outcome' => $r['outcome'],
        'promisedDate' => $r['promised_date'] ?? null,
        'channel' => $r['channel'],
        'createdAt' => $r['created_at'],
    ];
}

function fetch_charge_collection_events(PDO $pdo, int $chargeId): array {
    if (!collection_events_table_exists($pdo)) {
        return [];
    }
    $stmt = $pdo->prepare(
        'SELECT * FROM charge_collection_events WHERE charge_id = ? ORDER BY created_at DESC, id DESC'
    );
    $stmt->execute([$chargeId]);
    return array_map('map_collection_event_row', $stmt->fetchAll());
}

function create_charge_collection_event(PDO $pdo, int $chargeId, array $auth, array $body): array {
    if (!collection_events_table_exists($pdo)) {
        throw new InvalidArgumentException(
            'Histórico de cobrança não disponível. Execute migration-charge-collection-events.sql no banco.'
        );
    }
    $note = trim((string)($body['note'] ?? ''));
    if ($note === '') {
        throw new InvalidArgumentException('Informe a anotação da cobrança');
    }
    $outcome = (string)($body['outcome'] ?? 'other');
    if (!in_array($outcome, ['sent', 'answered', 'no_answer', 'promised', 'paid', 'other'], true)) {
        $outcome = 'other';
    }
    $channel = (string)($body['channel'] ?? 'whatsapp');
    if (!in_array($channel, ['whatsapp', 'phone', 'email', 'other'], true)) {
        $channel = 'whatsapp';
    }
    $promisedDate = !empty($body['promisedDate']) ? (string)$body['promisedDate'] : null;

    $check = $pdo->prepare('SELECT id FROM charges WHERE id = ? LIMIT 1');
    $check->execute([$chargeId]);
    if (!$check->fetch()) {
        throw new InvalidArgumentException('Cobrança não encontrada');
    }

    $userId = isset($auth['id']) ? (int)$auth['id'] : null;
    $userName = null;
    if ($userId) {
        $uStmt = $pdo->prepare('SELECT name FROM users WHERE id = ? LIMIT 1');
        $uStmt->execute([$userId]);
        $userName = $uStmt->fetchColumn() ?: null;
    }

    $stmt = $pdo->prepare(
        'INSERT INTO charge_collection_events (charge_id, user_id, user_name, note, outcome, promised_date, channel)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $chargeId,
        $userId,
        $userName,
        $note,
        $outcome,
        $promisedDate,
        $channel,
    ]);
    $id = (int)$pdo->lastInsertId();
    $row = $pdo->prepare('SELECT * FROM charge_collection_events WHERE id = ?');
    $row->execute([$id]);
    return map_collection_event_row($row->fetch());
}

function fetch_receivables_analytical(PDO $pdo, array $filters): array {
    $status = (string)($filters['status'] ?? 'overdue_and_upcoming');
    $from = !empty($filters['from']) ? (string)$filters['from'] : null;
    $to = !empty($filters['to']) ? (string)$filters['to'] : null;
    $clientId = isset($filters['clientId']) ? (int)$filters['clientId'] : 0;
    $q = trim((string)($filters['q'] ?? ''));

    $collectionCountSql = collection_events_table_exists($pdo)
        ? '(SELECT COUNT(*) FROM charge_collection_events e WHERE e.charge_id = ch.id)'
        : '0';

    $sql = "SELECT ch.id, ch.installment_no, ch.amount, ch.due_date, ch.status, ch.collector,
                   ch.payment_method, ch.paid_at, ch.notes,
                   cl.id AS client_id, cl.name AS client_name, cl.document, cl.document_type,
                   cl.phone, cl.whatsapp, cl.email,
                   c.contract_number, c.status AS contract_status, c.installments,
                   an.name AS animal_name,
                   DATEDIFF(CURDATE(), ch.due_date) AS days_overdue,
                   {$collectionCountSql} AS collection_count
            FROM charges ch
            INNER JOIN contracts c ON c.id = ch.contract_id
            INNER JOIN clients cl ON cl.id = ch.client_id
            LEFT JOIN animals an ON an.id = c.animal_id
            WHERE 1=1";
    $params = [];

    switch ($status) {
        case 'overdue':
            $sql .= ' AND c.status != \'cancelado\' AND ' . charge_overdue_sql();
            break;
        case 'upcoming':
            $sql .= " AND c.status != 'cancelado' AND ch.status = 'pendente' AND ch.due_date >= CURDATE()";
            break;
        case 'cancelled':
            $sql .= " AND (ch.status = 'cancelado' OR c.status = 'cancelado')";
            break;
        case 'paid':
            $sql .= " AND c.status != 'cancelado' AND ch.status = 'pago'";
            break;
        case 'all':
            break;
        case 'overdue_and_upcoming':
        default:
            $sql .= ' AND c.status != \'cancelado\' AND ' . charge_open_sql();
            break;
    }

    if ($from) {
        $sql .= ' AND ch.due_date >= ?';
        $params[] = $from;
    }
    if ($to) {
        $sql .= ' AND ch.due_date <= ?';
        $params[] = $to;
    }
    if ($clientId > 0) {
        $sql .= ' AND ch.client_id = ?';
        $params[] = $clientId;
    }
    if ($q !== '') {
        $sql .= ' AND (cl.name LIKE ? OR an.name LIKE ? OR c.contract_number LIKE ? OR CAST(ch.id AS CHAR) LIKE ?)';
        $like = '%' . $q . '%';
        array_push($params, $like, $like, $like, $like);
    }

    $sql .= ' ORDER BY cl.name ASC, ch.due_date ASC, ch.installment_no ASC LIMIT 2000';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    $clientsMap = [];
    $summary = [
        'originalTotal' => 0.0,
        'paidTotal' => 0.0,
        'openTotal' => 0.0,
        'itemCount' => 0,
        'clientCount' => 0,
    ];

    foreach ($rows as $r) {
        $cid = (string)$r['client_id'];
        if (!isset($clientsMap[$cid])) {
            $clientsMap[$cid] = [
                'clientId' => $cid,
                'clientName' => $r['client_name'],
                'document' => $r['document'],
                'documentType' => $r['document_type'],
                'phone' => $r['phone'],
                'whatsapp' => $r['whatsapp'],
                'email' => $r['email'],
                'originalTotal' => 0.0,
                'paidTotal' => 0.0,
                'openTotal' => 0.0,
                'items' => [],
            ];
        }

        $amount = (float)$r['amount'];
        $paidAmount = $r['status'] === 'pago' ? $amount : 0.0;
        $openAmount = in_array($r['status'], ['pendente', 'atrasado'], true) ? $amount : 0.0;
        $installments = max(1, (int)$r['installments']);
        $animal = trim((string)($r['animal_name'] ?? ''));
        $contractNo = trim((string)($r['contract_number'] ?? ''));
        $description = 'PARCELA ' . (int)$r['installment_no'] . ' de ' . $installments;
        if ($animal !== '') {
            $description .= ' — ' . $animal;
        }
        if ($contractNo !== '') {
            $description .= ' — Contrato ' . $contractNo;
        }

        $displayStatus = $r['status'];
        if ($displayStatus === 'pendente' && (int)$r['days_overdue'] > 0) {
            $displayStatus = 'atrasado';
        }

        $item = [
            'id' => (string)$r['id'],
            'installmentNo' => (int)$r['installment_no'],
            'installments' => $installments,
            'description' => $description,
            'animalName' => $animal ?: null,
            'contractNumber' => $contractNo ?: null,
            'contractStatus' => $r['contract_status'],
            'amount' => round($amount, 2),
            'paidAmount' => round($paidAmount, 2),
            'dueDate' => $r['due_date'],
            'daysOverdue' => max(0, (int)$r['days_overdue']),
            'status' => $displayStatus,
            'collector' => normalize_collector($r['collector'] ?? null),
            'paymentMethod' => $r['payment_method'],
            'paidAt' => $r['paid_at'],
            'notes' => $r['notes'],
            'collectionCount' => (int)$r['collection_count'],
        ];

        $clientsMap[$cid]['items'][] = $item;
        $clientsMap[$cid]['originalTotal'] += $amount;
        $clientsMap[$cid]['paidTotal'] += $paidAmount;
        $clientsMap[$cid]['openTotal'] += $openAmount;

        $summary['originalTotal'] += $amount;
        $summary['paidTotal'] += $paidAmount;
        $summary['openTotal'] += $openAmount;
        $summary['itemCount'] += 1;
    }

    $clients = array_values(array_map(function ($c) {
        $c['originalTotal'] = round($c['originalTotal'], 2);
        $c['paidTotal'] = round($c['paidTotal'], 2);
        $c['openTotal'] = round($c['openTotal'], 2);
        return $c;
    }, $clientsMap));

    $summary['originalTotal'] = round($summary['originalTotal'], 2);
    $summary['paidTotal'] = round($summary['paidTotal'], 2);
    $summary['openTotal'] = round($summary['openTotal'], 2);
    $summary['clientCount'] = count($clients);

    return [
        'summary' => $summary,
        'clients' => $clients,
        'historyAvailable' => collection_events_table_exists($pdo),
    ];
}

function fetch_company_finance(PDO $pdo): array {
    $monthStart = date('Y-m-01');
    $yearStart = date('Y-01-01');

    $assessoriaPaidMonth = (float)$pdo->query(
        "SELECT COALESCE(SUM(ch.amount), 0) AS t FROM charges ch
         INNER JOIN contracts c ON c.id = ch.contract_id
         WHERE ch.collector = 'assessoria' AND ch.status = 'pago' AND c.status != 'cancelado'
           AND COALESCE(ch.paid_at, ch.updated_at) >= '{$monthStart}'"
    )->fetch()['t'];

    $assessoriaPaidYear = (float)$pdo->query(
        "SELECT COALESCE(SUM(ch.amount), 0) AS t FROM charges ch
         INNER JOIN contracts c ON c.id = ch.contract_id
         WHERE ch.collector = 'assessoria' AND ch.status = 'pago' AND c.status != 'cancelado'
           AND COALESCE(ch.paid_at, ch.updated_at) >= '{$yearStart}'"
    )->fetch()['t'];

    $openWhere = charge_open_sql();
    $overdueWhere = charge_overdue_sql();
    $assessoriaOpen = (float)$pdo->query(
        "SELECT COALESCE(SUM(ch.amount), 0) AS t FROM charges ch
         INNER JOIN contracts c ON c.id = ch.contract_id
         WHERE ch.collector = 'assessoria' AND {$openWhere}"
    )->fetch()['t'];
    $assessoriaOverdue = (float)$pdo->query(
        "SELECT COALESCE(SUM(ch.amount), 0) AS t FROM charges ch
         INNER JOIN contracts c ON c.id = ch.contract_id
         WHERE ch.collector = 'assessoria' AND {$overdueWhere}"
    )->fetch()['t'];

    $auctionRevenue = (float)$pdo->query(
        "SELECT COALESCE(SUM(c.total_amount), 0) AS t FROM contracts c
         WHERE c.auction_id IS NOT NULL AND c.status != 'cancelado'"
    )->fetch()['t'];

    $auctionExpenses = 0.0;
    try {
        $auctionExpenses = (float)$pdo->query('SELECT COALESCE(SUM(amount), 0) AS t FROM auction_expenses')->fetch()['t'];
    } catch (Throwable $e) {
        /* tabela opcional */
    }

    $auctionCommission = (float)$pdo->query(
        "SELECT COALESCE(SUM(c.total_amount * rules.pct / 100), 0) AS t
         FROM contracts c
         INNER JOIN (
           SELECT contract_id, COALESCE(SUM(pct), 0) AS pct
           FROM contract_payout_rules WHERE beneficiary_role = 'assessoria'
           GROUP BY contract_id
         ) rules ON rules.contract_id = c.id
         WHERE c.auction_id IS NOT NULL AND c.status != 'cancelado'"
    )->fetch()['t'];

    $payoutsPending = (float)$pdo->query(
        "SELECT COALESCE(SUM(p.amount), 0) AS t FROM payouts p
         INNER JOIN contracts c ON c.id = p.contract_id
         WHERE c.status != 'cancelado' AND p.status IN ('pendente','aguardando')"
    )->fetch()['t'];

    $saasMonthly = 0.0;
    $saasClients = 0;
    try {
        $saasMonthly = (float)$pdo->query(
            "SELECT COALESCE(SUM(COALESCE(cm.monthly_fee, c.monthly_fee, 0)), 0) AS t
             FROM client_modules cm
             INNER JOIN clients c ON c.id = cm.client_id
             WHERE cm.active = 1 AND c.active = 1 AND c.subscription_suspended = 0"
        )->fetch()['t'];
        $saasClients = (int)$pdo->query(
            "SELECT COUNT(DISTINCT cm.client_id) AS t FROM client_modules cm
             INNER JOIN clients c ON c.id = cm.client_id
             WHERE cm.active = 1 AND c.active = 1"
        )->fetch()['t'];
    } catch (Throwable $e) {
        /* migration opcional */
    }

    $monthlySeries = [];
    for ($i = 5; $i >= 0; $i--) {
        $start = date('Y-m-01', strtotime("-{$i} months"));
        $end = date('Y-m-t', strtotime($start));
        $label = date('m/Y', strtotime($start));
        $paid = (float)$pdo->query(
            "SELECT COALESCE(SUM(ch.amount), 0) AS t FROM charges ch
             INNER JOIN contracts c ON c.id = ch.contract_id
             WHERE ch.collector = 'assessoria' AND ch.status = 'pago' AND c.status != 'cancelado'
               AND DATE(COALESCE(ch.paid_at, ch.updated_at)) BETWEEN '{$start}' AND '{$end}'"
        )->fetch()['t'];
        $monthlySeries[] = ['label' => $label, 'assessoriaPaid' => round($paid, 2)];
    }

    return [
        'assessoria' => [
            'paidMonth' => round($assessoriaPaidMonth, 2),
            'paidYear' => round($assessoriaPaidYear, 2),
            'open' => round($assessoriaOpen, 2),
            'overdue' => round($assessoriaOverdue, 2),
        ],
        'auctions' => [
            'revenue' => round($auctionRevenue, 2),
            'expenses' => round($auctionExpenses, 2),
            'commissionEstimated' => round($auctionCommission, 2),
            'resultEstimated' => round($auctionCommission - $auctionExpenses, 2),
        ],
        'payoutsPending' => round($payoutsPending, 2),
        'saas' => [
            'monthlyEstimated' => round($saasMonthly, 2),
            'activeClients' => $saasClients,
        ],
        'monthlySeries' => $monthlySeries,
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
            require_create($config['jwt_secret']);
            $docType = $body['docType'] ?? 'outro';
            $allowed = ['rg','identidade','cnh','comprovante_residencia','selfie','outro'];
            if (!in_array($docType, $allowed, true)) json_out(['error' => 'Tipo de documento inválido'], 400);
            if (empty($body['fileUrl'])) json_out(['error' => 'Arquivo é obrigatório'], 400);
            $authW = require_create($config['jwt_secret']);
            $pdo->prepare(
                'INSERT INTO client_documents (client_id, doc_type, file_url, file_name, notes, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)'
            )->execute([
                $cid, $docType, $body['fileUrl'], $body['fileName'] ?? null, $body['notes'] ?? null, $authW['id'],
            ]);
            json_out(['success' => true, 'id' => (string)$pdo->lastInsertId()]);
        }
        if ($method === 'DELETE' && $subId) {
            require_delete($config['jwt_secret']);
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
            require_create($config['jwt_secret']);
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
            require_update($config['jwt_secret']);
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
            require_delete($config['jwt_secret']);
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
            require_create($config['jwt_secret']);
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
            require_update($config['jwt_secret']);
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
            require_delete($config['jwt_secret']);
            $stmt = $pdo->prepare('DELETE FROM client_bank_accounts WHERE id = ? AND client_id = ?');
            $stmt->execute([(int)$subId, $cid]);
            if ($stmt->rowCount() === 0) json_out(['error' => 'Conta não encontrada'], 404);
            json_out(['success' => true]);
        }
    }

    if ($id && $action === 'modules') {
        require_update($config['jwt_secret']);
        $cid = (int)$id;
        if ($method === 'GET' && !$subId) {
            $stmt = $pdo->prepare(
                'SELECT subscription_type, subscription_suspended, adhesion_fee, monthly_fee, adhesion_paid_at
                 FROM clients WHERE id = ? LIMIT 1'
            );
            $stmt->execute([$cid]);
            $client = $stmt->fetch();
            if (!$client) json_out(['error' => 'Cliente não encontrado'], 404);
            json_out([
                'subscriptionType' => $client['subscription_type'] ?? 'assessoria',
                'subscriptionSuspended' => (bool)($client['subscription_suspended'] ?? 0),
                'adhesionFee' => $client['adhesion_fee'] !== null ? (float)$client['adhesion_fee'] : null,
                'monthlyFee' => $client['monthly_fee'] !== null ? (float)$client['monthly_fee'] : null,
                'adhesionPaidAt' => $client['adhesion_paid_at'],
                'modules' => fetch_client_modules($pdo, $cid),
            ]);
        }
        if ($method === 'PUT' && !$subId) {
            try {
                $curStmt = $pdo->prepare(
                    'SELECT subscription_type, subscription_suspended, adhesion_fee, monthly_fee, adhesion_paid_at FROM clients WHERE id = ?'
                );
                $curStmt->execute([$cid]);
                $cur = $curStmt->fetch();
                if (!$cur) json_out(['error' => 'Cliente não encontrado'], 404);

                $pdo->beginTransaction();
                $subType = array_key_exists('subscriptionType', $body) || array_key_exists('subscription_type', $body)
                    ? ($body['subscriptionType'] ?? $body['subscription_type'] ?? 'assessoria')
                    : $cur['subscription_type'];
                if (!in_array($subType, ['assessoria', 'avulso'], true)) $subType = 'assessoria';
                $suspended = array_key_exists('subscriptionSuspended', $body) || array_key_exists('subscription_suspended', $body)
                    ? (!empty($body['subscriptionSuspended']) || !empty($body['subscription_suspended']) ? 1 : 0)
                    : (int)$cur['subscription_suspended'];
                $adhesionFee = array_key_exists('adhesionFee', $body)
                    ? ($body['adhesionFee'] !== null && $body['adhesionFee'] !== '' ? (float)$body['adhesionFee'] : null)
                    : $cur['adhesion_fee'];
                $monthlyFee = array_key_exists('monthlyFee', $body)
                    ? ($body['monthlyFee'] !== null && $body['monthlyFee'] !== '' ? (float)$body['monthlyFee'] : null)
                    : $cur['monthly_fee'];
                $adhesionPaidAt = array_key_exists('adhesionPaidAt', $body)
                    ? ($body['adhesionPaidAt'] ?: null)
                    : $cur['adhesion_paid_at'];

                $pdo->prepare(
                    'UPDATE clients SET subscription_type=?, subscription_suspended=?, adhesion_fee=?, monthly_fee=?, adhesion_paid_at=? WHERE id=?'
                )->execute([$subType, $suspended, $adhesionFee, $monthlyFee, $adhesionPaidAt, $cid]);
                if (isset($body['modules']) && is_array($body['modules'])) {
                    foreach ($body['modules'] as $m) {
                        if (!is_array($m)) continue;
                        $code = normalize_client_module_code($m['code'] ?? ($m['moduleCode'] ?? null));
                        if (!$code) continue;
                        $active = !empty($m['active']) ? 1 : 0;
                        $fee = array_key_exists('monthlyFee', $m)
                            ? ($m['monthlyFee'] !== null && $m['monthlyFee'] !== '' ? (float)$m['monthlyFee'] : null)
                            : null;
                        $pdo->prepare(
                            'INSERT INTO client_modules (client_id, module_code, active, monthly_fee, activated_at)
                             VALUES (?, ?, ?, ?, ?)
                             ON DUPLICATE KEY UPDATE active=VALUES(active), monthly_fee=VALUES(monthly_fee),
                               activated_at=IF(VALUES(active)=1 AND activated_at IS NULL, CURDATE(), activated_at),
                               updated_at=CURRENT_TIMESTAMP'
                        )->execute([$cid, $code, $active, $fee, $active ? date('Y-m-d') : null]);
                    }
                }
                $pdo->commit();
                json_out(['success' => true]);
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                json_out(['error' => 'Erro ao salvar módulos. Migration aplicada?'], 500);
            }
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
            require_create($config['jwt_secret']);
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
            require_update($config['jwt_secret']);
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
            require_delete($config['jwt_secret']);
            $stmt = $pdo->prepare('DELETE FROM client_contacts WHERE id = ? AND client_id = ?');
            $stmt->execute([(int)$subId, $cid]);
            if ($stmt->rowCount() === 0) json_out(['error' => 'Contato não encontrado'], 404);
            json_out(['success' => true]);
        }
    }

    if ($id && $action === 'access-user') {
        $auth = require_auth($config['jwt_secret']);
        $cid = (int)$id;
        if ($auth['role'] === 'cliente' && (int)$auth['clientId'] !== $cid) {
            json_out(['error' => 'Sem permissão'], 403);
        }

        if ($method === 'GET' && !$subId) {
            $user = get_client_access_user($pdo, $cid);
            json_out(['user' => $user]);
        }

        if ($method === 'POST' && !$subId) {
            require_create($config['jwt_secret']);
            $stmt = $pdo->prepare('SELECT * FROM clients WHERE id = ?');
            $stmt->execute([$cid]);
            $client = $stmt->fetch();
            if (!$client) json_out(['error' => 'Pessoa não encontrada'], 404);
            if (get_client_access_user($pdo, $cid)) {
                json_out(['error' => 'Esta pessoa já possui usuário de acesso'], 409);
            }
            $name = trim((string)$client['name']);
            if ($name === '') json_out(['error' => 'Nome é obrigatório para criar usuário'], 400);
            $username = generate_username_from_name($pdo, $name);
            $email = trim((string)($client['email'] ?? '')) ?: null;
            $hash = password_hash(DEFAULT_CLIENT_ACCESS_PASSWORD, PASSWORD_BCRYPT, ['cost' => 12]);
            try {
                $ins = $pdo->prepare(
                    'INSERT INTO users (username, email, password_hash, name, role, client_id, active, must_change_password)
                     VALUES (?, ?, ?, ?, ?, ?, 1, 0)'
                );
                $ins->execute([$username, $email, $hash, $name, 'cliente', $cid]);
                $userId = (int)$pdo->lastInsertId();
                $stmt = $pdo->prepare(
                    'SELECT id, username, email, name, avatar_url, role, client_id, active, must_change_password, created_at
                     FROM users WHERE id = ?'
                );
                $stmt->execute([$userId]);
                json_out([
                    'success' => true,
                    'user' => map_user($stmt->fetch(), $pdo),
                    'defaultPassword' => DEFAULT_CLIENT_ACCESS_PASSWORD,
                    'message' => 'Usuário de acesso criado com sucesso',
                ]);
            } catch (PDOException $e) {
                if ($e->getCode() == 23000) json_out(['error' => 'Usuário ou e-mail já existe'], 409);
                json_out(['error' => 'Erro ao criar usuário de acesso'], 500);
            }
        }

        if ($method === 'PUT' && $subId === 'password') {
            require_update($config['jwt_secret']);
            $password = (string)($body['password'] ?? '');
            if (strlen($password) < 6) json_out(['error' => 'A senha deve ter pelo menos 6 caracteres'], 400);
            $user = get_client_access_user($pdo, $cid);
            if (!$user) json_out(['error' => 'Esta pessoa ainda não possui usuário de acesso'], 404);
            $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
            $pdo->prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?')
                ->execute([$hash, (int)$user['id']]);
            json_out(['success' => true, 'message' => 'Senha atualizada']);
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
        $auth = require_create($config['jwt_secret']);
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
            $newId = (string)$pdo->lastInsertId();
            audit_log($pdo, $auth, 'create', 'clients', $newId, "Pessoa criada: {$name}");
            json_out(['success' => true, 'id' => $newId]);
        } catch (PDOException $e) {
            if ($e->getCode() == 23000) json_out(['error' => 'Documento já cadastrado'], 409);
            json_out(['error' => 'Erro ao criar cliente'], 500);
        }
    }

    if ($method === 'PUT' && $id && !$action) {
        $auth = require_update($config['jwt_secret']);
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
            audit_log($pdo, $auth, 'update', 'clients', (string)$id, "Pessoa atualizada: {$name}");
            json_out(['success' => true]);
        } catch (PDOException $e) {
            if ($e->getCode() == 23000) json_out(['error' => 'Documento já cadastrado'], 409);
            json_out(['error' => 'Erro ao atualizar cliente'], 500);
        }
    }

    if ($method === 'DELETE' && $id && !$action) {
        $auth = require_delete($config['jwt_secret']);
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
            audit_log($pdo, $auth, 'delete', 'clients', (string)$clientId, 'Pessoa excluída');
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
            $sql .= ' AND ' . client_animal_access_sql('a');
            bind_client_animal_access($params, (int)$auth['clientId']);
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
            if (!client_can_view_animal($pdo, (int)$id, (int)$auth['clientId'])) {
                json_out(['error' => 'Sem permissão'], 403);
            }
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
        $auth = require_create($config['jwt_secret']);
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
            audit_log($pdo, $auth, 'create', 'animals', (string)$animalId, "Animal criado: {$name}", true, [
                'registrationNo' => $body['registration_no'] ?? null,
                'chipNo' => $body['chip_no'] ?? null,
                'status' => $body['status'] ?? 'ativo',
            ]);
            json_out(['success' => true, 'id' => (string)$animalId]);
        } catch (PDOException $e) {
            $pdo->rollBack();
            if ($e->getCode() == 23000) json_out(['error' => 'Chip já cadastrado'], 409);
            json_out(['error' => 'Erro ao criar animal'], 500);
        }
    }

    if ($method === 'PUT' && $id) {
        $auth = require_update($config['jwt_secret']);
        $existingStmt = $pdo->prepare('SELECT * FROM animals WHERE id = ?');
        $existingStmt->execute([(int)$id]);
        $existing = $existingStmt->fetch();
        if (!$existing) json_out(['error' => 'Animal não encontrado'], 404);
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
            $after = array_merge($existing, [
                'name' => $name,
                'registration_no' => $body['registration_no'] ?? $existing['registration_no'],
                'chip_no' => $body['chip_no'] ?? $existing['chip_no'],
                'status' => $body['status'] ?? $existing['status'],
            ]);
            $summary = ($body['status'] ?? $existing['status']) !== $existing['status']
                ? "Animal {$name} — status: {$existing['status']} → " . ($body['status'] ?? $existing['status'])
                : "Animal {$name} atualizado";
            audit_log(
                $pdo,
                $auth,
                ($body['status'] ?? $existing['status']) !== $existing['status'] ? 'status_change' : 'update',
                'animals',
                (string)$id,
                $summary,
                true,
                audit_diff_meta($existing, $after, [
                    'name' => 'nome',
                    'status' => 'status',
                    'chip_no' => 'chip',
                    'registration_no' => 'registro',
                ])
            );
            json_out(['success' => true]);
        } catch (PDOException $e) {
            $pdo->rollBack();
            if ($e->getCode() == 23000) json_out(['error' => 'Chip já cadastrado'], 409);
            json_out(['error' => 'Erro ao atualizar animal'], 500);
        }
    }

    if ($method === 'DELETE' && $id) {
        $auth = require_delete($config['jwt_secret']);
        $animalId = (int)$id;
        try {
            $stmt = $pdo->prepare('SELECT name, photo_url FROM animals WHERE id = ?');
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

            audit_log($pdo, $auth, 'delete', 'animals', (string)$animalId, 'Animal excluído: ' . ($row['name'] ?? ''));
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
            $newId = (string)$pdo->lastInsertId();
            audit_log($pdo, $auth, 'create', 'users', $newId, "Usuário criado: {$name} (@{$username})", true, [
                'role' => $role,
                'active' => !(isset($body['active']) && $body['active'] === false),
            ]);
            json_out(['success' => true, 'id' => $newId]);
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
            $after = [
                'username' => trim($body['username'] ?? $target['username']),
                'name' => trim($body['name'] ?? $target['name']),
                'role' => $nextRole,
                'active' => isset($body['active']) && $body['active'] === false ? 0 : 1,
            ];
            $passwordChanged = !empty($body['password']);
            $summary = $passwordChanged
                ? 'Usuário ' . $after['name'] . ' (@' . $after['username'] . ') — senha redefinida'
                : 'Usuário ' . $after['name'] . ' (@' . $after['username'] . ') atualizado';
            $meta = audit_diff_meta($target, $after, [
                'name' => 'nome',
                'role' => 'perfil',
                'active' => 'ativo',
            ]);
            if ($passwordChanged) {
                $meta = $meta ?? [];
                $meta['senhaRedefinida'] = true;
            }
            audit_log($pdo, $auth, $passwordChanged ? 'status_change' : 'update', 'users', (string)$id, $summary, true, $meta);
            json_out(['success' => true]);
        } catch (PDOException $e) {
            if ($e->getCode() == 23000) json_out(['error' => 'Usuário ou e-mail já existe'], 409);
            json_out(['error' => 'Erro ao atualizar usuário'], 500);
        }
    }

    if ($method === 'DELETE' && $id) {
        $auth = require_auth($config['jwt_secret'], ['root', 'admin']);
        $stmt = $pdo->prepare('SELECT id, role, username, name FROM users WHERE id = ?');
        $stmt->execute([(int)$id]);
        $target = $stmt->fetch();
        if (!$target) json_out(['error' => 'Usuário não encontrado'], 404);
        if ((int)$target['id'] === (int)$auth['id']) {
            json_out(['error' => 'Você não pode excluir o próprio usuário'], 403);
        }
        if ($auth['role'] === 'admin' && in_array($target['role'], ['root', 'admin'], true)) {
            json_out(['error' => 'Sem permissão para excluir este usuário'], 403);
        }
        $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([(int)$id]);
        audit_log(
            $pdo,
            $auth,
            'delete',
            'users',
            (string)$id,
            'Usuário excluído: ' . $target['name'] . ' (@' . $target['username'] . ')',
            true,
            ['role' => $target['role']]
        );
        json_out(['success' => true, 'message' => 'Usuário excluído']);
    }
}

// Contracts
if ($resource === 'contracts') {
    $contractSelect = "SELECT c.*,
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
      WHERE 1=1";

    if ($method === 'GET' && !$id) {
        $auth = require_auth($config['jwt_secret']);
        $sql = $contractSelect;
        $params = [];
        if ($auth['role'] === 'cliente') {
            if (!$auth['clientId']) json_out([]);
            $sql .= ' AND ' . client_contract_access_sql();
            bind_client_contract_access($params, (int)$auth['clientId']);
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

    if ($id === 'clicksign-progress' && $method === 'POST') {
        $auth = require_auth($config['jwt_secret']);
        $idsRaw = is_array($body['ids'] ?? null) ? $body['ids'] : [];
        $refresh = !empty($body['refresh']) && in_array($auth['role'], ['root', 'admin', 'user'], true);
        $ids = [];
        foreach (array_slice($idsRaw, 0, 15) as $rawId) {
            $n = (int)$rawId;
            if ($n > 0) $ids[] = $n;
        }
        if (!$ids) {
            json_out(['items' => []]);
        }

        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $sql = $contractSelect . " AND c.id IN ($placeholders)";
        $params = $ids;
        if ($auth['role'] === 'cliente') {
            if (!$auth['clientId']) json_out(['items' => []]);
            $sql .= ' AND ' . client_contract_access_sql();
            bind_client_contract_access($params, (int)$auth['clientId']);
        }
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();
        $items = [];

        foreach ($rows as $r) {
            $contractId = (int)$r['id'];
            $mapped = map_contract_row($r);
            if (empty($mapped['clicksign_envelope_id'])) continue;

            $signed = (int)($r['clicksign_signed_count'] ?? 0);
            $total = (int)($r['clicksign_total_count'] ?? 0);
            $shouldRefresh = $refresh && ($mapped['status'] ?? '') === 'aguardando_assinatura';

            $clicksignStatus = null;
            $newStatus = null;
            if ($shouldRefresh) {
                try {
                    $statusInfo = clicksign_fetch_status($config, $mapped);
                    $signed = (int)($statusInfo['signedCount'] ?? 0);
                    $total = (int)($statusInfo['totalCount'] ?? 0);
                    clicksign_persist_progress($pdo, $contractId, $signed, $total, $statusInfo['status'] ?? null);
                    $clicksignStatus = $statusInfo['status'] ?? null;
                    if (($statusInfo['status'] ?? '') === 'closed' && ($r['status'] ?? '') === 'aguardando_assinatura') {
                        $pdo->prepare("UPDATE contracts SET status='ativo' WHERE id=?")->execute([$contractId]);
                        $newStatus = 'ativo';
                    }
                } catch (Throwable $e) {
                    // mantém cache local
                }
            } elseif ($total <= 0) {
                $total = 4;
            }

            if ($total > 0) {
                $item = [
                    'contractId' => (string)$contractId,
                    'signedCount' => $signed,
                    'totalCount' => $total,
                    'pendingCount' => max(0, $total - $signed),
                ];
                if ($clicksignStatus !== null) {
                    $item['clicksignStatus'] = $clicksignStatus;
                }
                if ($newStatus !== null) {
                    $item['status'] = $newStatus;
                }
                $items[] = $item;
            }
        }

        json_out(['items' => $items]);
    }

    if ($method === 'GET' && $id && !$action) {
        $auth = require_auth($config['jwt_secret']);
        $stmt = $pdo->prepare($contractSelect . ' AND c.id = ?');
        $stmt->execute([(int)$id]);
        $r = $stmt->fetch();
        if (!$r) json_out(['error' => 'Contrato não encontrado'], 404);
        if ($auth['role'] === 'cliente') {
            $cid = (int)$auth['clientId'];
            if ((int)$r['buyer_id'] !== $cid
                && (int)$r['seller_id'] !== $cid
                && (int)($r['assessor_id'] ?? 0) !== $cid
                && (int)($r['witness1_id'] ?? 0) !== $cid
                && (int)($r['witness2_id'] ?? 0) !== $cid) {
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
        $charges = array_map('map_charge_row', $ch->fetchAll());
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
        $auth = require_create($config['jwt_secret']);
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
        $n = max(1, min(50, $n));
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
            audit_log($pdo, $auth, 'create', 'contracts', (string)$contractId, "Contrato {$contractNumber} criado", true, [
                'contractNumber' => $contractNumber,
                'animalId' => $animalId,
                'buyerId' => $buyerId,
                'sellerId' => $sellerId,
                'totalAmount' => $total,
                'auctionId' => $auctionId,
            ]);
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
        $auth = require_update($config['jwt_secret']);
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
            $set('installments', max(1, min(50, (int)$body['installments'])));
        }

        if (!$fields) json_out(['error' => 'Nada para atualizar'], 400);

        $nextTotal = array_key_exists('totalAmount', $body) && $body['totalAmount'] !== null
            ? (float)$body['totalAmount'] : (float)$existing['total_amount'];
        $nextBuyer = !empty($body['buyerId']) ? (int)$body['buyerId'] : (int)$existing['buyer_id'];
        $nextMethod = !empty($body['paymentMethod']) ? $body['paymentMethod'] : $existing['payment_method'];
        $nextFirstDue = !empty($body['firstDueDate']) ? $body['firstDueDate'] : $existing['first_due_date'];
        $nextInstallments = array_key_exists('installments', $body) && $body['installments'] !== null
            ? max(1, min(50, (int)$body['installments']))
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
            $label = audit_contract_label($existing, (int)$id);
            $nextStatus = array_key_exists('status', $body) ? (string)$body['status'] : (string)$existing['status'];
            $summary = $isCancelling
                ? "Contrato {$label} cancelado"
                : (array_key_exists('status', $body) && $body['status'] !== $existing['status']
                    ? "Contrato {$label} — status: {$existing['status']} → {$nextStatus}"
                    : "Contrato {$label} atualizado");
            $afterRow = array_merge($existing, [
                'status' => $nextStatus,
                'total_amount' => $nextTotal,
                'notes' => array_key_exists('notes', $body) ? $body['notes'] : $existing['notes'],
            ]);
            $meta = audit_diff_meta($existing, $afterRow, [
                'status' => 'status',
                'total_amount' => 'valorTotal',
                'payment_method' => 'formaPagamento',
                'installments' => 'parcelas',
                'notes' => 'observacoes',
            ]);
            if ($shouldRecalc) {
                $meta = $meta ?? [];
                $meta['parcelasRecalculadas'] = true;
            }
            audit_log(
                $pdo,
                $auth,
                $isCancelling ? 'status_change' : 'update',
                'contracts',
                (string)$id,
                $summary,
                true,
                $meta
            );
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
            clicksign_persist_progress(
                $pdo,
                (int)$id,
                (int)($statusInfo['signedCount'] ?? 0),
                (int)($statusInfo['totalCount'] ?? 0),
                $statusInfo['status'] ?? null
            );
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

    if ($method === 'POST' && $id && $action === 'clicksign' && $subId === 'sync-emails') {
        $auth = require_update($config['jwt_secret']);
        $stmt = $pdo->prepare($contractSelect . ' AND c.id = ?');
        $stmt->execute([(int)$id]);
        $r = $stmt->fetch();
        if (!$r) json_out(['error' => 'Contrato não encontrado'], 404);
        try {
            $mapped = map_contract_row($r);
            $partyRole = trim((string)($body['partyRole'] ?? ''));
            $result = clicksign_sync_signer_emails(
                $config,
                $pdo,
                $mapped,
                $partyRole !== '' ? $partyRole : null
            );
            $statusInfo = clicksign_fetch_status($config, $mapped);
            clicksign_persist_progress(
                $pdo,
                (int)$id,
                (int)($statusInfo['signedCount'] ?? 0),
                (int)($statusInfo['totalCount'] ?? 0),
                $statusInfo['status'] ?? null
            );
            $summary = count($result['updated']) . ' signatário(s) atualizado(s)';
            json_out([
                'success' => true,
                'message' => $result['updated'] ? $summary : 'Dados já estão alinhados com o cadastro',
                'updated' => $result['updated'],
                'unchanged' => $result['unchanged'],
                'skipped' => $result['skipped'],
                'warnings' => $result['warnings'],
                'tracking' => $statusInfo,
            ]);
        } catch (InvalidArgumentException $e) {
            json_out(['error' => $e->getMessage()], 400);
        } catch (Throwable $e) {
            json_out(['error' => 'Falha ao atualizar signatários: ' . $e->getMessage()], 500);
        }
    }

    if ($method === 'POST' && $id && $action === 'clicksign' && $subId === 'cancel') {
        $auth = require_update($config['jwt_secret']);
        $stmt = $pdo->prepare($contractSelect . ' AND c.id = ?');
        $stmt->execute([(int)$id]);
        $r = $stmt->fetch();
        if (!$r) json_out(['error' => 'Contrato não encontrado'], 404);
        $envelopeId = trim((string)($r['clicksign_envelope_id'] ?? ''));
        if ($envelopeId === '') {
            json_out(['error' => 'Contrato ainda não foi enviado à Clicksign'], 400);
        }
        try {
            try {
                clicksign_request($config, 'PATCH', "/api/v3/envelopes/{$envelopeId}", [
                    'data' => [
                        'id' => $envelopeId,
                        'type' => 'envelopes',
                        'attributes' => ['status' => 'canceled'],
                    ],
                ]);
            } catch (Throwable $e) {
                // Envelope pode já estar fechado/cancelado na Clicksign; seguimos limpando localmente.
            }
            $newStatus = ($r['status'] ?? '') === 'aguardando_assinatura' ? 'ativo' : $r['status'];
            $pdo->prepare(
                'UPDATE contracts SET clicksign_envelope_id=NULL, clicksign_document_id=NULL, clicksign_status=NULL, clicksign_sent_at=NULL, clicksign_signed_count=NULL, clicksign_total_count=NULL, status=? WHERE id=?'
            )->execute([$newStatus, (int)$id]);
            audit_log(
                $pdo,
                $auth,
                'clicksign_cancel',
                'contracts',
                (string)$id,
                'Envio Clicksign cancelado — contrato ' . audit_contract_label($r, (int)$id),
                true,
                ['envelopeId' => $envelopeId]
            );
            json_out(['success' => true, 'message' => 'Envio cancelado. Você já pode enviar novamente.']);
        } catch (Throwable $e) {
            json_out(['error' => 'Falha ao cancelar envio: ' . $e->getMessage()], 500);
        }
    }

    if ($method === 'POST' && $id && $action === 'clicksign' && $subId === 'notify') {
        $auth = require_update($config['jwt_secret']);
        $stmt = $pdo->prepare($contractSelect . ' AND c.id = ?');
        $stmt->execute([(int)$id]);
        $r = $stmt->fetch();
        if (!$r) json_out(['error' => 'Contrato não encontrado'], 404);
        try {
            $signerId = isset($body['signerId']) ? trim((string)$body['signerId']) : '';
            clicksign_notify($config, map_contract_row($r), $signerId !== '' ? $signerId : null);
            audit_log(
                $pdo,
                $auth,
                'clicksign_notify',
                'contracts',
                (string)$id,
                $signerId !== ''
                    ? 'Reenvio Clicksign a signatário — contrato ' . audit_contract_label($r, (int)$id)
                    : 'Reenvio Clicksign a todos — contrato ' . audit_contract_label($r, (int)$id),
                true,
                $signerId !== '' ? ['signerId' => $signerId] : null
            );
            json_out([
                'success' => true,
                'message' => $signerId !== ''
                    ? 'Notificação reenviada ao signatário'
                    : 'Notificações reenviadas aos signatários pendentes',
            ]);
        } catch (InvalidArgumentException $e) {
            json_out(['error' => $e->getMessage()], 400);
        } catch (Throwable $e) {
            json_out(['error' => 'Falha ao reenviar notificação: ' . $e->getMessage()], 500);
        }
    }

    if ($method === 'POST' && $id && $action === 'clicksign' && !$subId) {
        $auth = require_update($config['jwt_secret']);
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
                'UPDATE contracts SET clicksign_envelope_id=?, clicksign_document_id=?, clicksign_status=?, clicksign_sent_at=NOW(), clicksign_signed_count=0, clicksign_total_count=4, status=? WHERE id=?'
            )->execute([
                $sent['envelopeId'],
                $sent['documentId'],
                $sent['status'],
                'aguardando_assinatura',
                (int)$id,
            ]);
            audit_log(
                $pdo,
                $auth,
                'clicksign_send',
                'contracts',
                (string)$id,
                'Contrato ' . audit_contract_label($r, (int)$id) . ' enviado à Clicksign',
                true,
                [
                    'envelopeId' => $sent['envelopeId'],
                    'documentId' => $sent['documentId'],
                    'status' => $sent['status'],
                ]
            );
            json_out([
                'success' => true,
                'envelopeId' => $sent['envelopeId'],
                'documentId' => $sent['documentId'],
                'status' => $sent['status'],
                'warnings' => $sent['warnings'] ?? [],
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
            $partyLabels = [
                'seller' => 'Vendedor',
                'buyer' => 'Comprador',
                'assessor' => 'Assessor',
                'witness1' => 'Testemunha 1',
                'witness2' => 'Testemunha 2',
            ];
            audit_log(
                $pdo,
                $auth,
                'sign',
                'contracts',
                (string)$id,
                'Assinatura registrada — ' . ($partyLabels[$partyRole] ?? $partyRole) . ' (' . $signerName . ')',
                true,
                [
                    'partyRole' => $partyRole,
                    'signerName' => $signerName,
                    'contractActivated' => $all,
                ]
            );
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
        $sql = charge_list_select_sql() . " WHERE 1=1";
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
        if (!empty($_GET['collector']) && in_array($_GET['collector'], ['assessoria', 'seller'], true)) {
            $sql .= ' AND ch.collector = ?';
            $params[] = $_GET['collector'];
        }
        $sql .= ' ORDER BY ch.due_date ASC, ch.installment_no ASC';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $today = date('Y-m-d');
        $rows = array_map(fn($c) => map_charge_row($c, $today), $stmt->fetchAll());
        json_out($rows);
    }

    if ($method === 'POST' && $id === 'bulk-update') {
        $auth = require_update($config['jwt_secret']);
        $clientId = isset($body['clientId']) ? (int)$body['clientId'] : 0;
        if ($clientId <= 0) {
            json_out(['error' => 'clientId é obrigatório'], 400);
        }
        $collector = normalize_collector($body['collector'] ?? 'seller');
        if (!in_array($collector, ['assessoria', 'seller'], true)) {
            json_out(['error' => 'Cobrador inválido'], 400);
        }
        $onlyAssessoria = !array_key_exists('onlyAssessoria', $body) || !empty($body['onlyAssessoria']);
        $onlyOpen = !array_key_exists('onlyOpen', $body) || !empty($body['onlyOpen']);
        $notesAppend = isset($body['notes']) ? trim((string)$body['notes']) : '';
        if (!$notesAppend) {
            $notesAppend = 'Cobrança transferida ao vendedor — assessoria não receberá mais esta parcela';
        }

        $sql = "UPDATE charges ch
                INNER JOIN contracts c ON c.id = ch.contract_id
                SET ch.collector = ?,
                    ch.notes = CASE
                        WHEN ch.notes IS NULL OR TRIM(ch.notes) = '' THEN ?
                        WHEN ch.notes LIKE CONCAT('%', ?, '%') THEN ch.notes
                        ELSE CONCAT(ch.notes, '\n', ?)
                    END
                WHERE ch.client_id = ? AND c.status != 'cancelado'";
        $params = [$collector, $notesAppend, $notesAppend, $notesAppend, $clientId];
        if ($onlyAssessoria) {
            $sql .= " AND ch.collector = 'assessoria'";
        }
        if ($onlyOpen) {
            $sql .= " AND ch.status IN ('pendente', 'atrasado')";
        } else {
            $sql .= " AND ch.status != 'cancelado'";
        }
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $updated = $stmt->rowCount();

        $clientStmt = $pdo->prepare('SELECT name FROM clients WHERE id = ? LIMIT 1');
        $clientStmt->execute([$clientId]);
        $clientName = $clientStmt->fetchColumn() ?: ('#' . $clientId);
        audit_log(
            $pdo,
            $auth,
            'bulk_update',
            'charges',
            (string)$clientId,
            "{$updated} cobrança(s) de {$clientName} passaram para {$collector}",
            true,
            [
                'clientId' => $clientId,
                'collector' => $collector,
                'onlyAssessoria' => $onlyAssessoria,
                'onlyOpen' => $onlyOpen,
                'updated' => $updated,
            ]
        );
        json_out(['success' => true, 'updated' => $updated]);
    }

    if ($method === 'PUT' && $id) {
        $auth = require_update($config['jwt_secret']);
        $existingStmt = $pdo->prepare(
            'SELECT ch.*, a.name AS animal_name, c.contract_number, c.installments
             FROM charges ch
             INNER JOIN contracts c ON c.id = ch.contract_id
             INNER JOIN animals a ON a.id = c.animal_id
             WHERE ch.id = ?'
        );
        $existingStmt->execute([(int)$id]);
        $existing = $existingStmt->fetch();
        if (!$existing) json_out(['error' => 'Cobrança não encontrada'], 404);
        $sets = [];
        $params = [];
        if (array_key_exists('status', $body)) {
            $status = $body['status'] ?? '';
            if (!in_array($status, ['pendente', 'pago', 'atrasado', 'cancelado'], true)) {
                json_out(['error' => 'Status inválido'], 400);
            }
            $sets[] = 'status=?';
            $params[] = $status;
            $sets[] = 'paid_at=?';
            $params[] = $status === 'pago' ? date('Y-m-d H:i:s') : null;
        }
        if (array_key_exists('collector', $body)) {
            $sets[] = 'collector=?';
            $params[] = normalize_collector($body['collector'] ?? null);
        }
        if (array_key_exists('notes', $body)) {
            $sets[] = 'notes=?';
            $params[] = $body['notes'];
        }
        if (!$sets) {
            json_out(['error' => 'Nenhum campo para atualizar'], 400);
        }
        $params[] = (int)$id;
        $pdo->prepare('UPDATE charges SET ' . implode(', ', $sets) . ' WHERE id=?')->execute($params);

        if (array_key_exists('status', $body)) {
            $status = $body['status'];
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
        }
        $contractLabel = trim((string)($existing['contract_number'] ?? '')) ?: ('#' . $existing['contract_id']);
        $parcelLabel = (int)$existing['installment_no'] . '/' . (int)$existing['installments'];
        $summary = array_key_exists('status', $body)
            ? "Cobrança {$parcelLabel} — contrato {$contractLabel}: {$existing['status']} → {$body['status']}"
            : "Cobrança {$parcelLabel} — contrato {$contractLabel} atualizada";
        $after = $existing;
        if (array_key_exists('status', $body)) $after['status'] = $body['status'];
        if (array_key_exists('collector', $body)) $after['collector'] = normalize_collector($body['collector'] ?? null);
        audit_log(
            $pdo,
            $auth,
            array_key_exists('status', $body) && $body['status'] !== $existing['status'] ? 'status_change' : 'update',
            'charges',
            (string)$id,
            $summary,
            true,
            audit_diff_meta($existing, $after, [
                'status' => 'status',
                'collector' => 'cobrador',
            ])
        );
        json_out(['success' => true]);
    }

    if ($method === 'GET' && $id && $action === 'collection-events') {
        require_auth($config['jwt_secret']);
        if (!ctype_digit((string)$id)) {
            json_out(['error' => 'Cobrança inválida'], 400);
        }
        json_out(fetch_charge_collection_events($pdo, (int)$id));
    }

    if ($method === 'POST' && $id && $action === 'collection-events') {
        $auth = require_update($config['jwt_secret']);
        if (!ctype_digit((string)$id)) {
            json_out(['error' => 'Cobrança inválida'], 400);
        }
        try {
            $event = create_charge_collection_event($pdo, (int)$id, $auth, $body);
            json_out($event);
        } catch (InvalidArgumentException $e) {
            json_out(['error' => $e->getMessage()], 400);
        } catch (Throwable $e) {
            json_out(['error' => 'Erro ao salvar histórico'], 500);
        }
    }

    if ($method === 'POST' && $id && $action === 'register-commission') {
        $auth = require_update($config['jwt_secret']);
        try {
            $amount = (float)($body['amount'] ?? 0);
            $notes = isset($body['notes']) ? (string)$body['notes'] : null;
            $markChargePaid = !array_key_exists('markChargePaid', $body) || !empty($body['markChargePaid']);
            $result = register_seller_commission($pdo, (int)$id, $amount, $notes, $markChargePaid);
            $charge = $result['charge'];
            $contractLabel = trim((string)($charge['contract_number'] ?? '')) ?: ('#' . $charge['contract_id']);
            $parcelLabel = (int)$charge['installment_no'] . '/' . (int)$charge['installments'];
            audit_log(
                $pdo,
                $auth,
                'register_commission',
                'charges',
                (string)$id,
                "Comissão R$ " . number_format($amount, 2, ',', '.') . " registrada — parcela {$parcelLabel}, contrato {$contractLabel}",
                true,
                [
                    'amount' => $amount,
                    'notes' => $result['notes'],
                    'markChargePaid' => $markChargePaid,
                    'payoutId' => (string)$result['payout']['id'],
                ]
            );
            json_out(['success' => true]);
        } catch (InvalidArgumentException $e) {
            json_out(['error' => $e->getMessage()], 400);
        } catch (Throwable $e) {
            json_out(['error' => 'Erro ao registrar comissão'], 500);
        }
    }
}

// Auctions
if ($resource === 'auctions') {
    if ($method === 'GET' && !$id) {
        $auth = require_auth($config['jwt_secret']);
        if ($auth['role'] === 'cliente') {
            $clientId = $auth['clientId'] ?? null;
            if (!$clientId || !client_is_assessor($pdo, (int)$clientId)) {
                json_out([]);
            }
            json_out(fetch_assessor_auctions($pdo, (int)$clientId));
        }
        $rows = $pdo->query(
            "SELECT a.*, (SELECT COUNT(*) FROM auction_lots l WHERE l.auction_id = a.id) AS lots_count
             FROM auctions a
             ORDER BY COALESCE(a.auction_date, a.created_at) DESC, a.id DESC"
        )->fetchAll();
        json_out(array_map('map_auction_row', $rows));
    }

    if ($method === 'GET' && $id && $action === 'assessor-finance') {
        $auth = require_auth($config['jwt_secret']);
        $clientId = $auth['clientId'] ?? null;
        if ($auth['role'] !== 'cliente' || !$clientId || !client_is_assessor($pdo, (int)$clientId)) {
            json_out(['error' => 'Acesso negado'], 403);
        }
        try {
            json_out(fetch_assessor_auction_finance($pdo, (int)$id, (int)$clientId));
        } catch (InvalidArgumentException $e) {
            json_out(['error' => $e->getMessage()], 404);
        }
    }

    if ($method === 'GET' && $id && $action === 'finance') {
        require_auth($config['jwt_secret']);
        try {
            json_out(fetch_auction_finance($pdo, (int)$id));
        } catch (InvalidArgumentException $e) {
            json_out(['error' => $e->getMessage()], 404);
        }
    }

    if ($resource === 'auctions' && $id && $action === 'expenses') {
        $auctionId = (int)$id;
        if ($method === 'POST' && !$subId) {
            $auth = require_create($config['jwt_secret']);
            $stmt = $pdo->prepare('SELECT id FROM auctions WHERE id = ?');
            $stmt->execute([$auctionId]);
            if (!$stmt->fetch()) json_out(['error' => 'Leilão não encontrado'], 404);
            $amount = (float)($body['amount'] ?? 0);
            if ($amount <= 0) json_out(['error' => 'Informe um valor maior que zero'], 400);
            $category = normalize_auction_expense_category($body['category'] ?? null);
            $pdo->prepare(
                'INSERT INTO auction_expenses (auction_id, category, description, amount, expense_date, created_by)
                 VALUES (?, ?, ?, ?, ?, ?)'
            )->execute([
                $auctionId,
                $category,
                trim((string)($body['description'] ?? '')) ?: null,
                $amount,
                !empty($body['expenseDate']) ? $body['expenseDate'] : null,
                $auth['id'],
            ]);
            $newId = (string)$pdo->lastInsertId();
            audit_log($pdo, $auth, 'create', 'auction_expenses', $newId, "Despesa leilão #{$auctionId}");
            json_out(['success' => true, 'id' => $newId]);
        }

        if ($method === 'PUT' && $subId) {
            $auth = require_update($config['jwt_secret']);
            $expenseId = (int)$subId;
            $stmt = $pdo->prepare('SELECT id FROM auction_expenses WHERE id = ? AND auction_id = ?');
            $stmt->execute([$expenseId, $auctionId]);
            if (!$stmt->fetch()) json_out(['error' => 'Despesa não encontrada'], 404);
            $fields = [];
            $params = [];
            if (array_key_exists('category', $body)) {
                $fields[] = 'category=?';
                $params[] = normalize_auction_expense_category($body['category'] ?? null);
            }
            if (array_key_exists('description', $body)) {
                $fields[] = 'description=?';
                $params[] = trim((string)($body['description'])) ?: null;
            }
            if (array_key_exists('amount', $body)) {
                $amount = (float)$body['amount'];
                if ($amount <= 0) json_out(['error' => 'Valor inválido'], 400);
                $fields[] = 'amount=?';
                $params[] = $amount;
            }
            if (array_key_exists('expenseDate', $body)) {
                $fields[] = 'expense_date=?';
                $params[] = $body['expenseDate'] ?: null;
            }
            if (!$fields) json_out(['error' => 'Nada para atualizar'], 400);
            $params[] = $expenseId;
            $pdo->prepare('UPDATE auction_expenses SET ' . implode(',', $fields) . ' WHERE id=?')->execute($params);
            audit_log($pdo, $auth, 'update', 'auction_expenses', (string)$expenseId, "Despesa leilão #{$auctionId}");
            json_out(['success' => true]);
        }

        if ($method === 'DELETE' && $subId) {
            $auth = require_update($config['jwt_secret']);
            $expenseId = (int)$subId;
            $stmt = $pdo->prepare('DELETE FROM auction_expenses WHERE id = ? AND auction_id = ?');
            $stmt->execute([$expenseId, $auctionId]);
            if ($stmt->rowCount() === 0) json_out(['error' => 'Despesa não encontrada'], 404);
            audit_log($pdo, $auth, 'delete', 'auction_expenses', (string)$expenseId, "Despesa leilão #{$auctionId}");
            json_out(['success' => true]);
        }
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
        $auth = require_create($config['jwt_secret']);
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
        $newId = (string)$pdo->lastInsertId();
        audit_log($pdo, $auth, 'create', 'auctions', $newId, "Leilão criado: {$name}", true, [
            'status' => $status,
            'auctionDate' => $body['auctionDate'] ?? null,
        ]);
        json_out(['success' => true, 'id' => $newId]);
    }

    if ($method === 'PUT' && $id && !$action) {
        $auth = require_update($config['jwt_secret']);
        $existingStmt = $pdo->prepare('SELECT * FROM auctions WHERE id = ?');
        $existingStmt->execute([(int)$id]);
        $existing = $existingStmt->fetch();
        if (!$existing) json_out(['error' => 'Leilão não encontrado'], 404);
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
        $after = $existing;
        if (array_key_exists('name', $body)) $after['name'] = trim($body['name']);
        if (array_key_exists('auctionDate', $body)) $after['auction_date'] = $body['auctionDate'] ?: null;
        if (array_key_exists('location', $body)) $after['location'] = $body['location'] ?: null;
        if (array_key_exists('organizer', $body)) $after['organizer'] = $body['organizer'] ?: null;
        if (array_key_exists('status', $body)) $after['status'] = $body['status'];
        if (array_key_exists('notes', $body)) $after['notes'] = $body['notes'] ?: null;
        $auctionName = trim((string)($after['name'] ?? $existing['name']));
        $summary = array_key_exists('status', $body) && $body['status'] !== $existing['status']
            ? "Leilão {$auctionName} — status: {$existing['status']} → {$body['status']}"
            : "Leilão {$auctionName} atualizado";
        audit_log(
            $pdo,
            $auth,
            array_key_exists('status', $body) && $body['status'] !== $existing['status'] ? 'status_change' : 'update',
            'auctions',
            (string)$id,
            $summary,
            true,
            audit_diff_meta($existing, $after, [
                'name' => 'nome',
                'status' => 'status',
                'auction_date' => 'data',
                'location' => 'local',
                'organizer' => 'organizador',
            ])
        );
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
        $auth = require_create($config['jwt_secret']);
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
            $lotLabel = $body['lotNumber'] ?? $lotId;
            audit_log($pdo, $auth, 'create', 'auction_lots', (string)$lotId, "Lote #{$lotLabel} criado no leilão #{$auctionId}", true, [
                'auctionId' => $auctionId,
                'animalId' => $animalId,
                'lotNumber' => $body['lotNumber'] ?? null,
            ]);
            json_out(['success' => true, 'id' => (string)$lotId]);
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            json_out(['error' => 'Erro ao criar lote'], 500);
        }
    }

    if ($method === 'PUT' && $id) {
        $auth = require_update($config['jwt_secret']);
        $existingStmt = $pdo->prepare('SELECT * FROM auction_lots WHERE id = ?');
        $existingStmt->execute([(int)$id]);
        $existing = $existingStmt->fetch();
        if (!$existing) json_out(['error' => 'Lote não encontrado'], 404);
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
            $after = $existing;
            if (array_key_exists('lotNumber', $body)) $after['lot_number'] = $body['lotNumber'] ?: null;
            if (array_key_exists('minPrice', $body)) {
                $after['min_price'] = ($body['minPrice'] !== '' && $body['minPrice'] !== null) ? (float)$body['minPrice'] : null;
            }
            if (array_key_exists('status', $body)) $after['status'] = $body['status'];
            $lotLabel = $after['lot_number'] ?? $existing['lot_number'] ?? $id;
            $summary = array_key_exists('status', $body) && $body['status'] !== $existing['status']
                ? "Lote #{$lotLabel} — status: {$existing['status']} → {$body['status']}"
                : "Lote #{$lotLabel} atualizado (leilão #{$existing['auction_id']})";
            audit_log(
                $pdo,
                $auth,
                array_key_exists('status', $body) && $body['status'] !== $existing['status'] ? 'status_change' : 'update',
                'auction_lots',
                (string)$id,
                $summary,
                true,
                audit_diff_meta($existing, $after, [
                    'lot_number' => 'numeroLote',
                    'status' => 'status',
                    'min_price' => 'precoMinimo',
                ])
            );
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
        require_update($config['jwt_secret']);
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

    if ($method === 'POST' && $id && $action === 'reverse') {
        $auth = require_update($config['jwt_secret']);
        try {
            $notes = isset($body['notes']) ? (string)$body['notes'] : null;
            $result = reverse_payout($pdo, (int)$id, $notes);
            $payout = $result['payout'];
            $contractLabel = trim((string)($payout['contract_number'] ?? '')) ?: ('#' . $payout['contract_id']);
            $parcelLabel = (int)$payout['installment_no'];
            audit_log(
                $pdo,
                $auth,
                'reverse_payout',
                'payouts',
                (string)$id,
                "Estorno do repasse — parcela #{$parcelLabel}, contrato {$contractLabel}",
                true,
                [
                    'previousStatus' => 'pago',
                    'newStatus' => $result['newStatus'],
                    'notes' => $result['notes'],
                ]
            );
            json_out(['success' => true, 'status' => $result['newStatus']]);
        } catch (InvalidArgumentException $e) {
            json_out(['error' => $e->getMessage()], 400);
        } catch (Throwable $e) {
            json_out(['error' => 'Erro ao estornar repasse'], 500);
        }
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
        $auth = require_create($config['jwt_secret']);
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
                $body['title'] ?? 'CONTRATO PARTICULAR DE COMPRA E VENDA DE SEMOVENTE COM RESERVA DE DOMÍNIO',
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
        require_update($config['jwt_secret']);
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
        require_create($config['jwt_secret']);
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

// Audit logs (admin/root)
if ($resource === 'audit-logs' && $method === 'GET') {
    require_auth($config['jwt_secret'], ['root', 'admin']);
    json_out(audit_logs_query($pdo, [
        'userId' => $_GET['userId'] ?? null,
        'action' => $_GET['action'] ?? null,
        'resource' => $_GET['resource'] ?? null,
        'from' => $_GET['from'] ?? null,
        'to' => $_GET['to'] ?? null,
        'q' => trim((string)($_GET['q'] ?? '')),
        'limit' => $_GET['limit'] ?? 50,
        'offset' => $_GET['offset'] ?? 0,
    ]));
}

if ($resource === 'receivables-dashboard' && $method === 'GET') {
    $auth = require_auth($config['jwt_secret']);
    if ($auth['role'] === 'cliente') {
        json_out(['error' => 'Acesso negado'], 403);
    }
    json_out(fetch_receivables_dashboard($pdo));
}

if ($resource === 'receivables-analytical' && $method === 'GET') {
    $auth = require_auth($config['jwt_secret']);
    if ($auth['role'] === 'cliente') {
        json_out(['error' => 'Acesso negado'], 403);
    }
    json_out(fetch_receivables_analytical($pdo, [
        'status' => $_GET['status'] ?? 'overdue_and_upcoming',
        'from' => $_GET['from'] ?? null,
        'to' => $_GET['to'] ?? null,
        'clientId' => $_GET['clientId'] ?? null,
        'q' => $_GET['q'] ?? '',
    ]));
}

if ($resource === 'company-finance' && $method === 'GET') {
    $auth = require_auth($config['jwt_secret']);
    if ($auth['role'] === 'cliente') {
        json_out(['error' => 'Acesso negado'], 403);
    }
    json_out(fetch_company_finance($pdo));
}

if ($resource === 'subscriptions' && $method === 'GET') {
    require_update($config['jwt_secret']);
    try {
        $rows = $pdo->query(
            "SELECT c.*,
                (SELECT cp.name FROM client_properties cp WHERE cp.client_id = c.id ORDER BY cp.id ASC LIMIT 1) AS property_name
             FROM clients c
             WHERE c.active = 1
             ORDER BY c.name ASC"
        )->fetchAll();
        $out = [];
        foreach ($rows as $r) {
            $mapped = map_client($r);
            $mapped['modules'] = fetch_client_modules($pdo, (int)$r['id']);
            $out[] = $mapped;
        }
        json_out($out);
    } catch (Throwable $e) {
        json_out(['error' => 'Erro ao listar assinaturas'], 500);
    }
}

function map_breeding_covering(array $r): array {
    return [
        'id' => (string)$r['id'],
        'mareAnimalId' => (string)$r['mare_animal_id'],
        'mareName' => $r['mare_name'] ?? null,
        'stallionAnimalId' => $r['stallion_animal_id'] ? (string)$r['stallion_animal_id'] : null,
        'stallionName' => $r['stallion_name'] ?? ($r['stallion_animal_name'] ?? null),
        'method' => $r['method'],
        'coveringDate' => $r['covering_date'],
        'season' => $r['season'],
        'veterinarian' => $r['veterinarian'],
        'abccmmStatus' => $r['abccmm_status'],
        'notes' => $r['notes'],
        'createdAt' => $r['created_at'] ?? null,
    ];
}

if ($resource === 'search' && $method === 'GET') {
    $auth = require_auth($config['jwt_secret']);
    $q = trim($_GET['q'] ?? '');
    if (mb_strlen($q) < 2) {
        json_out(['people' => [], 'animals' => [], 'contracts' => [], 'auctions' => []]);
    }
    $like = '%' . $q . '%';
    $isCliente = $auth['role'] === 'cliente';
    $cid = $auth['clientId'] ? (int)$auth['clientId'] : 0;

    $people = [];
    if (!$isCliente) {
        $stmt = $pdo->prepare(
            'SELECT id, name, document, city, state FROM clients
             WHERE active = 1 AND (name LIKE ? OR document LIKE ? OR email LIKE ?)
             ORDER BY name ASC LIMIT 8'
        );
        $stmt->execute([$like, $like, $like]);
        $people = array_map(function ($r) {
            return [
                'id' => (string)$r['id'],
                'name' => $r['name'],
                'subtitle' => trim(($r['city'] ?? '') . ' ' . ($r['state'] ?? '')) ?: ($r['document'] ?? ''),
                'to' => '/app/pessoas',
            ];
        }, $stmt->fetchAll());
    }

    $animalSql = "SELECT a.id, a.name, a.registration_no, a.breed FROM animals a WHERE (a.name LIKE ? OR a.registration_no LIKE ? OR a.chip_no LIKE ?)";
    $animalParams = [$like, $like, $like];
    if ($isCliente && $cid) {
        $animalSql .= ' AND ' . client_animal_access_sql('a');
        bind_client_animal_access($animalParams, $cid);
    }
    $animalSql .= ' ORDER BY a.name ASC LIMIT 8';
    $stmt = $pdo->prepare($animalSql);
    $stmt->execute($animalParams);
    $animals = array_map(function ($r) {
        return [
            'id' => (string)$r['id'],
            'name' => $r['name'],
            'subtitle' => $r['registration_no'] ?: ($r['breed'] ?? 'Animal'),
            'to' => '/app/animais/' . $r['id'],
        ];
    }, $stmt->fetchAll());

    $contractSql = "SELECT c.id, c.contract_number, c.status, an.name AS animal_name,
                           sb.name AS seller_name, bb.name AS buyer_name
                    FROM contracts c
                    LEFT JOIN animals an ON an.id = c.animal_id
                    LEFT JOIN clients sb ON sb.id = c.seller_id
                    LEFT JOIN clients bb ON bb.id = c.buyer_id
                    WHERE c.status != 'cancelado'
                      AND (an.name LIKE ? OR c.contract_number LIKE ? OR sb.name LIKE ? OR bb.name LIKE ?)";
    $contractParams = [$like, $like, $like, $like];
    if ($isCliente && $cid) {
        $contractSql .= ' AND ' . client_contract_access_sql();
        bind_client_contract_access($contractParams, $cid);
    }
    $contractSql .= ' ORDER BY c.created_at DESC LIMIT 8';
    $stmt = $pdo->prepare($contractSql);
    $stmt->execute($contractParams);
    $contracts = array_map(function ($r) {
        return [
            'id' => (string)$r['id'],
            'name' => $r['contract_number'] ? 'Contrato ' . $r['contract_number'] : 'Contrato',
            'subtitle' => ($r['animal_name'] ?? 'Animal') . ' · ' . ($r['seller_name'] ?? '') . ' → ' . ($r['buyer_name'] ?? ''),
            'to' => '/app/contratos',
        ];
    }, $stmt->fetchAll());

    $auctions = [];
    if (!$isCliente) {
        $stmt = $pdo->prepare(
            "SELECT id, name, auction_date, status FROM auctions
             WHERE name LIKE ? OR location LIKE ?
             ORDER BY auction_date DESC LIMIT 6"
        );
        $stmt->execute([$like, $like]);
        $auctions = array_map(function ($r) {
            return [
                'id' => (string)$r['id'],
                'name' => $r['name'],
                'subtitle' => $r['auction_date'] ?? $r['status'],
                'to' => '/app/leiloes',
            ];
        }, $stmt->fetchAll());
    }

    json_out(compact('people', 'animals', 'contracts', 'auctions'));
}

function parse_daily_report_date(?string $raw): ?string {
    $raw = trim((string)$raw);
    if ($raw === '') return null;
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $raw)) return $raw;
    if (preg_match('/^(\d{2})\/(\d{2})\/(\d{4})$/', $raw, $m)) {
        return sprintf('%04d-%02d-%02d', (int)$m[3], (int)$m[2], (int)$m[1]);
    }
    return null;
}

function map_daily_report(array $r): array {
    $data = $r['data'] ?? null;
    $dataLabel = $data;
    if ($data && preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)$data)) {
        $dt = DateTime::createFromFormat('Y-m-d', (string)$data);
        if ($dt) $dataLabel = $dt->format('d/m/Y');
    }
    return [
        'id' => (string)$r['id'],
        'userId' => isset($r['user_id']) && $r['user_id'] ? (string)$r['user_id'] : null,
        'data' => $data,
        'dataLabel' => $dataLabel,
        'colaboradora' => $r['colaboradora'],
        'numAtendimentos' => $r['num_atendimentos'],
        'todosClientesRespondidos' => (bool)$r['todos_clientes_respondidos'],
        'clientesPendentes' => $r['clientes_pendentes'] ?? '',
        'ocorrencias' => [
            'clienteIrritado' => (bool)$r['cliente_irritado'],
            'cobrancaIndevida' => (bool)$r['cobranca_indevida'],
            'questionamentoFinanceiro' => (bool)$r['questionamento_financeiro'],
            'contestacaoRegras' => (bool)$r['contestacao_regras'],
            'escaladoGestao' => (bool)$r['escalado_gestao'],
            'nenhumaCritica' => (bool)$r['nenhuma_critica'],
        ],
        'suporteGestao' => (bool)$r['suporte_gestao'],
        'suporteColegas' => (bool)$r['suporte_colegas'],
        'motivoSuporte' => $r['motivo_suporte'] ?? '',
        'autoavaliacao' => $r['autoavaliacao'],
        'compromissosAmanha' => $r['compromissos_amanha'] ?? '',
        'declaracao' => (bool)$r['declaracao'],
        'timestamp' => $r['created_at'] ?? null,
        'createdAt' => $r['created_at'] ?? null,
    ];
}

function daily_report_can_manage_all(array $auth): bool {
    return in_array($auth['role'], ['root', 'admin'], true);
}

function groq_assistant_chat(array $config, string $systemPrompt, array $messages): string {
    $key = trim((string)($config['groq_api_key'] ?? ''));
    if ($key === '') {
        throw new RuntimeException('Assistente IA não configurado no servidor (groq_api_key)');
    }
    $model = trim((string)($config['groq_model'] ?? 'llama-3.3-70b-versatile')) ?: 'llama-3.3-70b-versatile';

    $payload = json_encode([
        'model' => $model,
        'messages' => array_merge([['role' => 'system', 'content' => $systemPrompt]], $messages),
        'temperature' => 0.35,
        'max_tokens' => 900,
    ], JSON_UNESCAPED_UNICODE);

    $ctx = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/json\r\nAuthorization: Bearer {$key}\r\n",
            'content' => $payload,
            'timeout' => 45,
            'ignore_errors' => true,
        ],
    ]);

    $raw = @file_get_contents('https://api.groq.com/openai/v1/chat/completions', false, $ctx);
    if ($raw === false) {
        throw new RuntimeException('Falha ao contactar o serviço de IA');
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        throw new RuntimeException('Resposta inválida do serviço de IA');
    }
    if (!empty($data['error']['message'])) {
        throw new RuntimeException('IA: ' . $data['error']['message']);
    }
    $reply = trim((string)($data['choices'][0]['message']['content'] ?? ''));
    if ($reply === '') {
        throw new RuntimeException('Resposta vazia do assistente');
    }
    return $reply;
}

function audit_ai_assistant_query(PDO $pdo, array $auth, string $question, bool $success, ?string $error = null): void {
    $preview = mb_strlen($question) > 120 ? mb_substr($question, 0, 117) . '...' : $question;
    $summary = ($success ? 'Assistente IA: ' : 'Assistente IA (falhou): ') . $preview;
    $meta = ['pergunta' => mb_substr($question, 0, 500)];
    if ($error !== null && $error !== '') {
        $meta['erro'] = $error;
    }
    audit_log(
        $pdo,
        $auth,
        'assistant_query',
        'ai_assistant',
        (string)($auth['id'] ?? ''),
        $summary,
        $success,
        $meta
    );
}

if ($resource === 'ai-assistant' && $method === 'POST') {
    $auth = require_auth($config['jwt_secret']);

    $incoming = is_array($body['messages'] ?? null) ? $body['messages'] : [];
    $messages = [];
    foreach (array_slice($incoming, -16) as $m) {
        if (!is_array($m)) continue;
        $role = $m['role'] ?? '';
        $content = trim((string)($m['content'] ?? ''));
        if (!in_array($role, ['user', 'assistant'], true) || $content === '') continue;
        if (mb_strlen($content) > 4000) $content = mb_substr($content, 0, 4000);
        $messages[] = ['role' => $role, 'content' => $content];
    }
    if (!$messages || end($messages)['role'] !== 'user') {
        json_out(['error' => 'Envie uma mensagem válida'], 400);
    }

    $context = trim((string)($body['context'] ?? ''));
    if (mb_strlen($context) > 28000) $context = mb_substr($context, 0, 28000);

    $userName = trim((string)($body['userName'] ?? ''));
    $userRole = trim((string)($body['userRole'] ?? $auth['role'] ?? ''));

    $system = implode("\n", [
        'Você é o Assistente Ariane, copiloto do sistema Gestão de Haras (assessoria equestre).',
        'Responda SEMPRE em português do Brasil, de forma clara, cordial e objetiva.',
        'Use SOMENTE o contexto abaixo sobre o sistema. Não invente dados de clientes, valores, contratos ou prazos.',
        'Se a pergunta não estiver no contexto, diga que não tem essa informação e sugira Suporte técnico ou a equipe da assessoria.',
        'Não dê conselho jurídico ou financeiro.',
        'Quando orientar o usuário a abrir uma tela, inclua NO FINAL da resposta exatamente um botão no formato: [LINK:/app/rota|Texto do botão]',
        'Exemplo: [LINK:/app/registro-diario|Abrir registro diário]',
        'Usuário logado: ' . ($userName !== '' ? $userName : 'equipe') . ' (perfil: ' . $userRole . ').',
        '',
        '--- CONTEXTO ---',
        $context !== '' ? $context : '(sem contexto adicional)',
    ]);

    $userQuestion = end($messages)['content'];

    try {
        $reply = groq_assistant_chat($config, $system, $messages);
        audit_ai_assistant_query($pdo, $auth, $userQuestion, true);
        json_out(['reply' => $reply]);
    } catch (Throwable $e) {
        $msg = $e->getMessage();
        $status = str_contains($msg, 'não configurado') ? 503 : 502;
        audit_ai_assistant_query($pdo, $auth, $userQuestion, false, $msg);
        json_out(['error' => $msg], $status);
    }
}

if ($resource === 'daily-reports') {
    $auth = require_auth($config['jwt_secret']);
    if (!in_array($auth['role'], ['root', 'admin', 'user'], true)) {
        json_out(['error' => 'Acesso negado'], 403);
    }

    if ($method === 'GET' && $id === 'today') {
        try {
            $today = (new DateTime('now', new DateTimeZone('America/Sao_Paulo')))->format('Y-m-d');
            $stmt = $pdo->prepare('SELECT * FROM daily_reports WHERE user_id = ? AND data = ? LIMIT 1');
            $stmt->execute([(int)$auth['id'], $today]);
            $row = $stmt->fetch();
            json_out([
                'submitted' => (bool)$row,
                'report' => $row ? map_daily_report($row) : null,
            ]);
        } catch (Throwable $e) {
            json_out(['error' => 'Tabela de registro diário não disponível — rode database/migration-daily-reports.sql'], 500);
        }
    }

    if ($method === 'GET' && $id && is_numeric($id)) {
        try {
            $stmt = $pdo->prepare('SELECT * FROM daily_reports WHERE id = ? LIMIT 1');
            $stmt->execute([(int)$id]);
            $row = $stmt->fetch();
            if (!$row) json_out(['error' => 'Registro não encontrado'], 404);
            if (!daily_report_can_manage_all($auth) && (int)$row['user_id'] !== (int)$auth['id']) {
                json_out(['error' => 'Acesso negado'], 403);
            }
            json_out(map_daily_report($row));
        } catch (Throwable $e) {
            json_out(['error' => 'Erro ao carregar registro'], 500);
        }
    }

    if ($method === 'GET' && !$id) {
        try {
            $sql = 'SELECT * FROM daily_reports WHERE 1=1';
            $params = [];
            if (!daily_report_can_manage_all($auth)) {
                $sql .= ' AND user_id = ?';
                $params[] = (int)$auth['id'];
            } elseif (!empty($_GET['userId'])) {
                $sql .= ' AND user_id = ?';
                $params[] = (int)$_GET['userId'];
            }
            $q = trim((string)($_GET['q'] ?? ''));
            if ($q !== '' && daily_report_can_manage_all($auth)) {
                $sql .= ' AND colaboradora LIKE ?';
                $params[] = '%' . $q . '%';
            }
            if (!empty($_GET['from'])) {
                $from = parse_daily_report_date((string)$_GET['from']);
                if ($from) {
                    $sql .= ' AND data >= ?';
                    $params[] = $from;
                }
            }
            if (!empty($_GET['to'])) {
                $to = parse_daily_report_date((string)$_GET['to']);
                if ($to) {
                    $sql .= ' AND data <= ?';
                    $params[] = $to;
                }
            }
            $limit = min(500, max(1, (int)($_GET['limit'] ?? 200)));
            $sql .= ' ORDER BY data DESC, id DESC LIMIT ' . $limit;
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            json_out(array_map('map_daily_report', $stmt->fetchAll()));
        } catch (Throwable $e) {
            json_out(['error' => 'Tabela de registro diário não disponível — rode database/migration-daily-reports.sql'], 500);
        }
    }

    if ($method === 'POST' && !$id) {
        $reportDate = parse_daily_report_date($body['reportDate'] ?? $body['data'] ?? '');
        if (!$reportDate) {
            $reportDate = (new DateTime('now', new DateTimeZone('America/Sao_Paulo')))->format('Y-m-d');
        }
        $numAtendimentos = trim((string)($body['numAtendimentos'] ?? $body['num_atendimentos'] ?? ''));
        $autoavaliacao = trim((string)($body['autoavaliacao'] ?? ''));
        $declaracao = !empty($body['declaracao']);
        if ($numAtendimentos === '') json_out(['error' => 'Informe o número de atendimentos'], 400);
        if ($autoavaliacao === '') json_out(['error' => 'Informe a autoavaliação'], 400);
        if (!$declaracao) json_out(['error' => 'Confirme a declaração para finalizar'], 400);

        $allowedBands = ['Até 10', '11 a 20', '21 a 30', 'Acima de 30'];
        if (!in_array($numAtendimentos, $allowedBands, true)) {
            json_out(['error' => 'Faixa de atendimentos inválida'], 400);
        }
        $allowedRatings = ['Excelente', 'Bom', 'Regular', 'Precisa melhorar'];
        if (!in_array($autoavaliacao, $allowedRatings, true)) {
            json_out(['error' => 'Autoavaliação inválida'], 400);
        }

        $oc = is_array($body['ocorrencias'] ?? null) ? $body['ocorrencias'] : [];
        $todosOk = !empty($body['todosClientesRespondidos']);
        $pendentes = trim((string)($body['clientesPendentes'] ?? ''));
        if (!$todosOk && $pendentes === '') {
            json_out(['error' => 'Descreva o motivo dos clientes pendentes'], 400);
        }
        $suporteGestao = !empty($body['suporteGestao']);
        $suporteColegas = !empty($body['suporteColegas']);
        $motivoSuporte = trim((string)($body['motivoSuporte'] ?? ''));
        if (($suporteGestao || $suporteColegas) && $motivoSuporte === '') {
            json_out(['error' => 'Informe o motivo do suporte acionado'], 400);
        }

        $userId = (int)$auth['id'];
        $stmtUser = $pdo->prepare('SELECT name FROM users WHERE id = ? LIMIT 1');
        $stmtUser->execute([$userId]);
        $userRow = $stmtUser->fetch();
        $colaboradora = trim((string)($userRow['name'] ?? $body['colaboradora'] ?? ''));
        if ($colaboradora === '') json_out(['error' => 'Nome do usuário indisponível'], 400);

        try {
            $dup = $pdo->prepare('SELECT id FROM daily_reports WHERE user_id = ? AND data = ? LIMIT 1');
            $dup->execute([$userId, $reportDate]);
            if ($dup->fetch()) {
                json_out(['error' => 'Você já registrou o atendimento desta data'], 409);
            }

            $pdo->prepare(
                'INSERT INTO daily_reports (
                    user_id, data, colaboradora, num_atendimentos, todos_clientes_respondidos, clientes_pendentes,
                    cliente_irritado, cobranca_indevida, questionamento_financeiro, contestacao_regras, escalado_gestao, nenhuma_critica,
                    suporte_gestao, suporte_colegas, motivo_suporte, autoavaliacao, compromissos_amanha, declaracao
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            )->execute([
                $userId,
                $reportDate,
                $colaboradora,
                $numAtendimentos,
                $todosOk ? 1 : 0,
                $todosOk ? null : ($pendentes ?: null),
                !empty($oc['clienteIrritado']) ? 1 : 0,
                !empty($oc['cobrancaIndevida']) ? 1 : 0,
                !empty($oc['questionamentoFinanceiro']) ? 1 : 0,
                !empty($oc['contestacaoRegras']) ? 1 : 0,
                !empty($oc['escaladoGestao']) ? 1 : 0,
                !empty($oc['nenhumaCritica']) ? 1 : 0,
                $suporteGestao ? 1 : 0,
                $suporteColegas ? 1 : 0,
                $motivoSuporte ?: null,
                $autoavaliacao,
                trim((string)($body['compromissosAmanha'] ?? '')) ?: null,
                1,
            ]);
            $newId = (string)$pdo->lastInsertId();
            audit_log($pdo, $auth, 'create', 'daily_reports', $newId, "Registro diário: {$colaboradora} · {$reportDate}");
            json_out(['success' => true, 'id' => $newId]);
        } catch (PDOException $e) {
            if ($e->getCode() == 23000) json_out(['error' => 'Você já registrou o atendimento desta data'], 409);
            json_out(['error' => 'Erro ao salvar registro diário'], 500);
        } catch (Throwable $e) {
            json_out(['error' => 'Tabela de registro diário não disponível — rode database/migration-daily-reports.sql'], 500);
        }
    }

    if ($method === 'DELETE' && $id && is_numeric($id)) {
        if (!in_array($auth['role'], ['root', 'admin', 'user'], true)) {
            json_out(['error' => 'Sem permissão'], 403);
        }
        try {
            $stmt = $pdo->prepare('SELECT * FROM daily_reports WHERE id = ? LIMIT 1');
            $stmt->execute([(int)$id]);
            $row = $stmt->fetch();
            if (!$row) json_out(['error' => 'Registro não encontrado'], 404);
            if (!daily_report_can_manage_all($auth) && (int)$row['user_id'] !== (int)$auth['id']) {
                json_out(['error' => 'Você não pode excluir este registro'], 403);
            }
            $pdo->prepare('DELETE FROM daily_reports WHERE id = ?')->execute([(int)$id]);
            audit_log($pdo, $auth, 'delete', 'daily_reports', (string)$id, 'Registro diário excluído');
            json_out(['success' => true]);
        } catch (Throwable $e) {
            json_out(['error' => 'Erro ao excluir registro'], 500);
        }
    }
}

function chat_role_label(string $role): string {
    return match ($role) {
        'root' => 'Root',
        'admin' => 'Admin',
        'user' => 'Operador',
        'cliente' => 'Cliente',
        default => $role,
    };
}

function chat_can_message(array $auth, array $target): bool {
    if ((int)($auth['id'] ?? 0) === (int)($target['id'] ?? 0)) {
        return false;
    }
    if (empty($target['active'])) {
        return false;
    }
    if (in_array($auth['role'] ?? '', ['root', 'admin', 'user'], true)) {
        return true;
    }
    if (($auth['role'] ?? '') === 'cliente') {
        return in_array($target['role'] ?? '', ['root', 'admin', 'user'], true);
    }
    return false;
}

function chat_require_participant(PDO $pdo, int $threadId, int $userId): void {
    $stmt = $pdo->prepare('SELECT 1 FROM chat_participants WHERE thread_id = ? AND user_id = ? LIMIT 1');
    $stmt->execute([$threadId, $userId]);
    if (!$stmt->fetch()) {
        json_out(['error' => 'Conversa não encontrada'], 404);
    }
}

function chat_dm_key(int $a, int $b): string {
    return min($a, $b) . '_' . max($a, $b);
}

function chat_map_user_row(array $r): array {
    return [
        'id' => (string)$r['id'],
        'name' => $r['name'],
        'username' => $r['username'],
        'role' => $r['role'],
        'avatarUrl' => $r['avatar_url'] ?? null,
    ];
}

function chat_other_participant(PDO $pdo, int $threadId, int $userId): ?array {
    $stmt = $pdo->prepare(
        'SELECT u.id, u.name, u.username, u.role, u.avatar_url
         FROM chat_participants cp
         INNER JOIN users u ON u.id = cp.user_id
         WHERE cp.thread_id = ? AND cp.user_id != ?
         LIMIT 1'
    );
    $stmt->execute([$threadId, $userId]);
    $row = $stmt->fetch();
    return $row ? chat_map_user_row($row) : null;
}

function chat_peer_last_read_at(PDO $pdo, int $threadId, int $viewerId): ?string {
    $stmt = $pdo->prepare(
        'SELECT cp.last_read_at
         FROM chat_participants cp
         WHERE cp.thread_id = ? AND cp.user_id != ?
         LIMIT 1'
    );
    $stmt->execute([$threadId, $viewerId]);
    $row = $stmt->fetch();
    $at = $row['last_read_at'] ?? null;
    return $at ? (string)$at : null;
}

function chat_map_message(array $r, int $viewerId): array {
    return [
        'id' => (string)$r['id'],
        'threadId' => (string)$r['thread_id'],
        'senderUserId' => (string)$r['sender_user_id'],
        'senderName' => $r['sender_name'] ?? '',
        'body' => $r['body'],
        'createdAt' => $r['created_at'],
        'mine' => (int)$r['sender_user_id'] === $viewerId,
    ];
}

function chat_find_or_create_thread(PDO $pdo, int $userId, int $otherUserId): int {
    $dmKey = chat_dm_key($userId, $otherUserId);
    $stmt = $pdo->prepare('SELECT id FROM chat_threads WHERE dm_key = ? LIMIT 1');
    $stmt->execute([$dmKey]);
    $existing = $stmt->fetch();
    if ($existing) {
        return (int)$existing['id'];
    }

    $pdo->prepare('INSERT INTO chat_threads (thread_type, dm_key) VALUES (\'direct\', ?)')->execute([$dmKey]);
    $threadId = (int)$pdo->lastInsertId();
    $ins = $pdo->prepare('INSERT INTO chat_participants (thread_id, user_id) VALUES (?, ?)');
    $ins->execute([$threadId, $userId]);
    $ins->execute([$threadId, $otherUserId]);
    return $threadId;
}

if ($resource === 'presence' && $id === 'heartbeat' && $method === 'POST') {
    $auth = require_auth($config['jwt_secret']);
    user_touch_presence($pdo, (int)$auth['id']);
    json_out(['success' => true]);
}

if ($resource === 'root') {
    $auth = require_auth($config['jwt_secret'], ['root']);

    try {
        if ($id === 'online' && $method === 'GET') {
            $minutes = min(30, max(1, (int)($_GET['minutes'] ?? 5)));
            $stmt = $pdo->prepare(
                'SELECT id, username, name, avatar_url, role, last_seen_at
                 FROM users
                 WHERE active = 1
                   AND last_seen_at IS NOT NULL
                   AND last_seen_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
                 ORDER BY last_seen_at DESC
                 LIMIT 200'
            );
            $stmt->execute([$minutes]);
            json_out([
                'items' => array_map('user_map_online_row', $stmt->fetchAll()),
                'onlineMinutes' => $minutes,
            ]);
        }

        if ($id === 'access-log' && $method === 'GET') {
            $page = max(1, (int)($_GET['page'] ?? 1));
            $limit = min(100, max(1, (int)($_GET['limit'] ?? 50)));
            $offset = ($page - 1) * $limit;

            $countStmt = $pdo->query('SELECT COUNT(*) AS total FROM user_access_log');
            $total = (int)$countStmt->fetch()['total'];

            $stmt = $pdo->prepare(
                'SELECT l.*, u.name AS user_name, u.avatar_url
                 FROM user_access_log l
                 LEFT JOIN users u ON u.id = l.user_id
                 ORDER BY l.created_at DESC
                 LIMIT ? OFFSET ?'
            );
            $stmt->bindValue(1, $limit, PDO::PARAM_INT);
            $stmt->bindValue(2, $offset, PDO::PARAM_INT);
            $stmt->execute();
            json_out([
                'items' => array_map('user_map_access_row', $stmt->fetchAll()),
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
            ]);
        }

        if ($id === 'usage-metrics' && $method === 'GET') {
            $days = (int)($_GET['days'] ?? 30);
            json_out(root_usage_metrics($pdo, $days));
        }

        if ($id === 'force-logout' && $action && is_numeric($action) && $method === 'POST') {
            $targetId = (int)$action;
            if ($targetId <= 0) {
                json_out(['error' => 'Usuário inválido'], 400);
            }
            $stmt = $pdo->prepare('SELECT id, username, name, role FROM users WHERE id = ? LIMIT 1');
            $stmt->execute([$targetId]);
            $target = $stmt->fetch();
            if (!$target) {
                json_out(['error' => 'Usuário não encontrado'], 404);
            }
            if (!user_force_logout($pdo, $targetId)) {
                json_out(['error' => 'Não foi possível encerrar a sessão — rode database/migration-user-session.sql'], 500);
            }
            audit_log(
                $pdo,
                $auth,
                'status_change',
                'users',
                (string)$targetId,
                'Sessão encerrada remotamente: ' . ($target['name'] ?? $target['username'])
            );
            json_out(['success' => true]);
        }
    } catch (Throwable $e) {
        json_out(['error' => 'Painel Root indisponível — rode database/migration-user-presence.sql'], 500);
    }

    json_out(['error' => 'Rota Root inválida'], 404);
}

if ($resource === 'chat') {
    $auth = require_auth($config['jwt_secret']);
    $authId = (int)$auth['id'];

    try {
        if ($id === 'contacts' && $method === 'GET') {
            $q = trim($_GET['q'] ?? '');
            $sql = 'SELECT id, username, name, avatar_url, role, active FROM users WHERE active = 1 AND id != ?';
            $params = [$authId];
            if ($q !== '') {
                $sql .= ' AND (name LIKE ? OR username LIKE ?)';
                $like = "%$q%";
                array_push($params, $like, $like);
            }
            $sql .= ' ORDER BY name ASC LIMIT 200';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $items = [];
            foreach ($stmt->fetchAll() as $row) {
                if (!chat_can_message($auth, $row)) {
                    continue;
                }
                $items[] = chat_map_user_row($row);
            }
            json_out(['items' => $items]);
        }

        if ($id === 'unread-count' && $method === 'GET') {
            $stmt = $pdo->prepare(
                'SELECT COUNT(*) AS total
                 FROM chat_messages cm
                 INNER JOIN chat_participants cp ON cp.thread_id = cm.thread_id AND cp.user_id = ?
                 WHERE cm.sender_user_id != ?
                   AND cm.created_at > COALESCE(cp.last_read_at, \'1970-01-01 00:00:00\')'
            );
            $stmt->execute([$authId, $authId]);
            json_out(['count' => (int)$stmt->fetch()['total']]);
        }

        if ($id === 'threads' && $method === 'GET' && !$action) {
            $stmt = $pdo->prepare(
                'SELECT t.id, t.last_message_at,
                        (SELECT body FROM chat_messages WHERE thread_id = t.id ORDER BY created_at DESC LIMIT 1) AS last_body,
                        (SELECT COUNT(*) FROM chat_messages cm
                         WHERE cm.thread_id = t.id AND cm.sender_user_id != ?
                           AND cm.created_at > COALESCE(cp.last_read_at, \'1970-01-01 00:00:00\')) AS unread_count
                 FROM chat_threads t
                 INNER JOIN chat_participants cp ON cp.thread_id = t.id AND cp.user_id = ?
                 ORDER BY COALESCE(t.last_message_at, t.created_at) DESC
                 LIMIT 100'
            );
            $stmt->execute([$authId, $authId]);
            $items = [];
            foreach ($stmt->fetchAll() as $row) {
                $threadId = (int)$row['id'];
                $peer = chat_other_participant($pdo, $threadId, $authId);
                if (!$peer) {
                    continue;
                }
                $items[] = [
                    'id' => (string)$threadId,
                    'peer' => $peer,
                    'lastMessage' => $row['last_body'] ? (string)$row['last_body'] : null,
                    'lastMessageAt' => $row['last_message_at'],
                    'unreadCount' => (int)$row['unread_count'],
                ];
            }
            json_out(['items' => $items]);
        }

        if ($id === 'threads' && $method === 'POST' && !$action) {
            $otherId = (int)($body['userId'] ?? 0);
            if ($otherId <= 0) {
                json_out(['error' => 'Informe o usuário'], 400);
            }
            $stmt = $pdo->prepare('SELECT id, username, name, avatar_url, role, active FROM users WHERE id = ? LIMIT 1');
            $stmt->execute([$otherId]);
            $target = $stmt->fetch();
            if (!$target) {
                json_out(['error' => 'Usuário não encontrado'], 404);
            }
            if (!chat_can_message($auth, $target)) {
                json_out(['error' => 'Sem permissão para conversar com este usuário'], 403);
            }
            $threadId = chat_find_or_create_thread($pdo, $authId, $otherId);
            json_out([
                'thread' => [
                    'id' => (string)$threadId,
                    'peer' => chat_map_user_row($target),
                    'lastMessage' => null,
                    'lastMessageAt' => null,
                    'unreadCount' => 0,
                ],
            ]);
        }

        if ($id === 'threads' && $action && is_numeric($action) && $subId === 'messages' && $method === 'GET') {
            $threadId = (int)$action;
            chat_require_participant($pdo, $threadId, $authId);
            $limit = min(100, max(1, (int)($_GET['limit'] ?? 50)));
            $before = trim($_GET['before'] ?? '');
            $sql = 'SELECT cm.*, u.name AS sender_name
                    FROM chat_messages cm
                    INNER JOIN users u ON u.id = cm.sender_user_id
                    WHERE cm.thread_id = ?';
            $params = [$threadId];
            if ($before !== '' && is_numeric($before)) {
                $sql .= ' AND cm.id < ?';
                $params[] = (int)$before;
            }
            $sql .= ' ORDER BY cm.created_at DESC LIMIT ' . $limit;
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $rows = array_reverse($stmt->fetchAll());
            json_out([
                'items' => array_map(fn($r) => chat_map_message($r, $authId), $rows),
                'peer' => chat_other_participant($pdo, $threadId, $authId),
                'peerLastReadAt' => chat_peer_last_read_at($pdo, $threadId, $authId),
            ]);
        }

        if ($id === 'threads' && $action && is_numeric($action) && $subId === 'messages' && $method === 'POST') {
            $threadId = (int)$action;
            chat_require_participant($pdo, $threadId, $authId);
            $text = trim((string)($body['body'] ?? ''));
            if ($text === '') {
                json_out(['error' => 'Mensagem vazia'], 400);
            }
            if (mb_strlen($text) > 4000) {
                $text = mb_substr($text, 0, 4000);
            }
            $pdo->prepare(
                'INSERT INTO chat_messages (thread_id, sender_user_id, body) VALUES (?, ?, ?)'
            )->execute([$threadId, $authId, $text]);
            $msgId = (int)$pdo->lastInsertId();
            $now = (new DateTime('now', new DateTimeZone('America/Sao_Paulo')))->format('Y-m-d H:i:s');
            $pdo->prepare('UPDATE chat_threads SET last_message_at = ? WHERE id = ?')->execute([$now, $threadId]);
            $pdo->prepare('UPDATE chat_participants SET last_read_at = ? WHERE thread_id = ? AND user_id = ?')
                ->execute([$now, $threadId, $authId]);

            $preview = mb_strlen($text) > 120 ? mb_substr($text, 0, 117) . '...' : $text;
            audit_log($pdo, $auth, 'create', 'chat', (string)$threadId, 'Mensagem enviada: ' . $preview);

            $stmt = $pdo->prepare(
                'SELECT cm.*, u.name AS sender_name FROM chat_messages cm
                 INNER JOIN users u ON u.id = cm.sender_user_id WHERE cm.id = ? LIMIT 1'
            );
            $stmt->execute([$msgId]);
            json_out(['message' => chat_map_message($stmt->fetch(), $authId)]);
        }

        if ($id === 'threads' && $action && is_numeric($action) && $subId === 'read' && $method === 'PUT') {
            $threadId = (int)$action;
            chat_require_participant($pdo, $threadId, $authId);
            $now = (new DateTime('now', new DateTimeZone('America/Sao_Paulo')))->format('Y-m-d H:i:s');
            $pdo->prepare('UPDATE chat_participants SET last_read_at = ? WHERE thread_id = ? AND user_id = ?')
                ->execute([$now, $threadId, $authId]);
            json_out([
                'success' => true,
                'peerLastReadAt' => chat_peer_last_read_at($pdo, $threadId, $authId),
            ]);
        }
    } catch (Throwable $e) {
        json_out(['error' => 'Chat indisponível — rode database/migration-chat.sql'], 500);
    }

    json_out(['error' => 'Rota de chat inválida'], 404);
}

if ($resource === 'breeding-coverings') {
    $auth = require_auth($config['jwt_secret']);
    if ($auth['role'] === 'cliente') {
        json_out(['error' => 'Acesso negado'], 403);
    }

    if ($method === 'GET' && !$id) {
        try {
            $q = trim($_GET['q'] ?? '');
            $sql = "SELECT bc.*,
                        mare.name AS mare_name,
                        stallion.name AS stallion_animal_name
                     FROM breeding_coverings bc
                     INNER JOIN animals mare ON mare.id = bc.mare_animal_id
                     LEFT JOIN animals stallion ON stallion.id = bc.stallion_animal_id
                     WHERE 1=1";
            $params = [];
            if ($q !== '') {
                $sql .= ' AND (mare.name LIKE ? OR bc.stallion_name LIKE ? OR stallion.name LIKE ? OR bc.season LIKE ?)';
                $like = "%$q%";
                array_push($params, $like, $like, $like, $like);
            }
            $sql .= ' ORDER BY bc.covering_date DESC, bc.id DESC LIMIT 200';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            json_out(array_map('map_breeding_covering', $stmt->fetchAll()));
        } catch (Throwable $e) {
            json_out(['error' => 'Tabela de reprodução não disponível — rode a migration'], 500);
        }
    }

    if ($method === 'POST' && !$id) {
        require_create($config['jwt_secret']);
        $mareId = (int)($body['mareAnimalId'] ?? $body['mare_animal_id'] ?? 0);
        if ($mareId <= 0) json_out(['error' => 'Égua é obrigatória'], 400);
        $methodVal = $body['method'] ?? 'ia';
        if (!in_array($methodVal, ['ia', 'monta_natural', 'te'], true)) $methodVal = 'ia';
        $date = trim($body['coveringDate'] ?? $body['covering_date'] ?? '');
        if ($date === '') json_out(['error' => 'Data da cobertura é obrigatória'], 400);
        $stallionId = (int)($body['stallionAnimalId'] ?? $body['stallion_animal_id'] ?? 0);
        $stallionName = trim($body['stallionName'] ?? $body['stallion_name'] ?? '') ?: null;
        $abccmm = $body['abccmmStatus'] ?? $body['abccmm_status'] ?? 'pendente';
        if (!in_array($abccmm, ['pendente', 'comunicado', 'confirmado'], true)) $abccmm = 'pendente';
        try {
            $pdo->prepare(
                'INSERT INTO breeding_coverings (mare_animal_id, stallion_animal_id, stallion_name, method, covering_date, season, veterinarian, abccmm_status, notes, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            )->execute([
                $mareId,
                $stallionId > 0 ? $stallionId : null,
                $stallionName,
                $methodVal,
                $date,
                $body['season'] ?? null,
                $body['veterinarian'] ?? null,
                $abccmm,
                $body['notes'] ?? null,
                $auth['id'],
            ]);
            json_out(['success' => true, 'id' => (string)$pdo->lastInsertId()]);
        } catch (Throwable $e) {
            json_out(['error' => 'Erro ao registrar cobertura'], 500);
        }
    }

    if ($method === 'PUT' && $id) {
        require_update($config['jwt_secret']);
        $stmt = $pdo->prepare('SELECT * FROM breeding_coverings WHERE id = ?');
        $stmt->execute([(int)$id]);
        $cur = $stmt->fetch();
        if (!$cur) json_out(['error' => 'Cobertura não encontrada'], 404);
        $methodVal = $body['method'] ?? $cur['method'];
        if (!in_array($methodVal, ['ia', 'monta_natural', 'te'], true)) $methodVal = $cur['method'];
        $abccmm = $body['abccmmStatus'] ?? $body['abccmm_status'] ?? $cur['abccmm_status'];
        if (!in_array($abccmm, ['pendente', 'comunicado', 'confirmado'], true)) $abccmm = $cur['abccmm_status'];
        $stallionId = array_key_exists('stallionAnimalId', $body)
            ? ((int)($body['stallionAnimalId'] ?? 0) ?: null)
            : $cur['stallion_animal_id'];
        try {
            $pdo->prepare(
                'UPDATE breeding_coverings SET mare_animal_id=?, stallion_animal_id=?, stallion_name=?, method=?, covering_date=?, season=?, veterinarian=?, abccmm_status=?, notes=? WHERE id=?'
            )->execute([
                (int)($body['mareAnimalId'] ?? $cur['mare_animal_id']),
                $stallionId,
                array_key_exists('stallionName', $body) ? ($body['stallionName'] ?: null) : $cur['stallion_name'],
                $methodVal,
                $body['coveringDate'] ?? $cur['covering_date'],
                array_key_exists('season', $body) ? ($body['season'] ?: null) : $cur['season'],
                array_key_exists('veterinarian', $body) ? ($body['veterinarian'] ?: null) : $cur['veterinarian'],
                $abccmm,
                array_key_exists('notes', $body) ? ($body['notes'] ?: null) : $cur['notes'],
                (int)$id,
            ]);
            json_out(['success' => true]);
        } catch (Throwable $e) {
            json_out(['error' => 'Erro ao atualizar cobertura'], 500);
        }
    }

    if ($method === 'DELETE' && $id) {
        require_delete($config['jwt_secret']);
        $stmt = $pdo->prepare('DELETE FROM breeding_coverings WHERE id = ?');
        $stmt->execute([(int)$id]);
        if ($stmt->rowCount() === 0) json_out(['error' => 'Cobertura não encontrada'], 404);
        json_out(['success' => true]);
    }
}

json_out(['error' => 'Rota não encontrada'], 404);
