<?php
/**
 * Diagnóstico temporário de conexão MySQL.
 * Abra no navegador e DEPOIS APAGUE este arquivo.
 * Usa apenas config.local.php (não versionado).
 */
header('Content-Type: application/json; charset=utf-8');

$configFile = __DIR__ . '/config.local.php';
if (!file_exists($configFile)) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => 'config.local.php não encontrado',
        'hint' => 'Copie config.example.php para config.local.php e preencha as credenciais.',
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

$config = require $configFile;

$result = [
    'config_file' => 'config.local.php encontrado',
    'db_host' => $config['db_host'],
    'db_port' => $config['db_port'],
    'db_user' => $config['db_user'],
    'db_name' => $config['db_name'],
    'password_length' => strlen($config['db_password'] ?? ''),
    'password_starts_with' => substr($config['db_password'] ?? '', 0, 1),
];

$hosts = array_unique([$config['db_host'], 'localhost', '127.0.0.1']);

foreach ($hosts as $host) {
    try {
        $pdo = new PDO(
            sprintf(
                'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
                $host,
                $config['db_port'],
                $config['db_name']
            ),
            $config['db_user'],
            $config['db_password'],
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
        );
        $tables = $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
        $users = 0;
        if (in_array('users', $tables, true)) {
            $users = (int)$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
        }
        $result['ok'] = true;
        $result['connected_host'] = $host;
        $result['tables'] = $tables;
        $result['users_count'] = $users;
        echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        exit;
    } catch (PDOException $e) {
        $result['attempts'][] = [
            'host' => $host,
            'error' => $e->getMessage(),
            'code' => $e->getCode(),
        ];
    }
}

$result['ok'] = false;
http_response_code(500);
echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
