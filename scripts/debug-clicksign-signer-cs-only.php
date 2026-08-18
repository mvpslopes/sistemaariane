<?php
$config = require __DIR__ . '/../backend/config.local.php';
$token = $config['clicksign_access_token'];
$base = rtrim($config['clicksign_base_url'], '/');
$targetSigner = $argv[1] ?? 'd608b592-c080-47f4-8751-8058629f310d';

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
    return ['code' => $code, 'json' => json_decode($body ?: 'null', true), 'raw' => $body];
}

$url = "/api/v3/envelopes?filter%5Bstatus%5D=running&page%5Bsize%5D=100";
$foundEnv = null;
while ($url) {
    $res = cs_get($base, $token, $url);
    if ($res['code'] !== 200) {
        echo "List envelopes failed HTTP {$res['code']}\n";
        exit(1);
    }
    foreach ($res['json']['data'] ?? [] as $env) {
        $envId = $env['id'] ?? '';
        $signers = cs_get($base, $token, "/api/v3/envelopes/{$envId}/signers");
        foreach ($signers['json']['data'] ?? [] as $s) {
            if (($s['id'] ?? '') === $targetSigner) {
                $foundEnv = $envId;
                echo "Envelope: {$envId}\n";
                echo "Envelope name: " . ($env['attributes']['name'] ?? '') . "\n";
                echo "Signer:\n" . json_encode($s, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
                $reqs = cs_get($base, $token, "/api/v3/envelopes/{$envId}/requirements");
                echo "Requirements for signer:\n";
                foreach ($reqs['json']['data'] ?? [] as $r) {
                    $sid = $r['relationships']['signer']['data']['id'] ?? '';
                    if ($sid === $targetSigner) {
                        echo json_encode($r['attributes'], JSON_UNESCAPED_UNICODE) . "\n";
                    }
                }
                break 3;
            }
        }
    }
    $next = $res['json']['links']['next'] ?? null;
    if ($next) {
        $url = parse_url($next, PHP_URL_PATH) . '?' . parse_url($next, PHP_URL_QUERY);
    } else {
        $url = null;
    }
}

if (!$foundEnv) {
    echo "Signer not found in running envelopes\n";
}
