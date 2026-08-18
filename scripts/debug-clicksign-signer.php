<?php
$config = require __DIR__ . '/../backend/config.local.php';
$token = $config['clicksign_access_token'];
$base = rtrim($config['clicksign_base_url'], '/');
$signerId = $argv[1] ?? 'd608b592-c080-47f4-8751-8058629f310d';

$pdo = new PDO(
    sprintf('mysql:host=%s;dbname=%s', $config['db_host'], $config['db_name']),
    $config['db_user'],
    $config['db_password']
);

function cs_get(string $base, string $token, string $path): array {
    $ch = curl_init($base . $path);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: ' . $token,
            'Accept: application/vnd.api+json',
        ],
    ]);
    $body = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['code' => $code, 'json' => json_decode($body ?: 'null', true)];
}

$contractId = (int) ($argv[2] ?? 12);
$row = $pdo->query("SELECT id, clicksign_envelope_id, clicksign_status, clicksign_document_id FROM contracts WHERE id={$contractId}")->fetch(PDO::FETCH_ASSOC);
echo "Contract: " . json_encode($row, JSON_UNESCAPED_UNICODE) . PHP_EOL;

$envId = $row['clicksign_envelope_id'] ?? '';
if (!$envId) {
    exit("Sem envelope\n");
}

$env = cs_get($base, $token, "/api/v3/envelopes/{$envId}");
echo 'Envelope HTTP ' . $env['code'] . ' status=' . ($env['json']['data']['attributes']['status'] ?? '?') . PHP_EOL;

$signers = cs_get($base, $token, "/api/v3/envelopes/{$envId}/signers");
echo 'Signers HTTP ' . $signers['code'] . PHP_EOL;
foreach ($signers['json']['data'] ?? [] as $s) {
    $id = $s['id'] ?? '';
    $email = $s['attributes']['email'] ?? '';
    $name = $s['attributes']['name'] ?? '';
    echo " - {$id} | {$email} | {$name}" . PHP_EOL;
    if ($id === $signerId) {
        echo "MATCH:\n" . json_encode($s, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . PHP_EOL;
    }
}

$reqs = cs_get($base, $token, "/api/v3/envelopes/{$envId}/requirements");
echo 'Requirements HTTP ' . $reqs['code'] . PHP_EOL;
foreach ($reqs['json']['data'] ?? [] as $r) {
    $sid = $r['relationships']['signer']['data']['id'] ?? '';
    if ($sid === $signerId) {
        echo 'REQ: ' . json_encode($r['attributes'], JSON_UNESCAPED_UNICODE) . PHP_EOL;
    }
}
