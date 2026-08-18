<?php
$config = require __DIR__ . '/../backend/config.local.php';
$token = $config['clicksign_access_token'];
$base = rtrim($config['clicksign_base_url'], '/');

$envelopeId = '0f4d38b2-ebbb-4b8d-884f-9a7fb86de025';
$documentId = '6d50a060-aa81-471e-a084-fb25b0b5d31d';
$signerId = 'd608b592-c080-47f4-8751-8058629f310d';
$role = 'seller';

function cs_post($base, $token, $path, $payload) {
    $ch = curl_init($base . $path);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: ' . $token,
            'Accept: application/vnd.api+json',
            'Content-Type: application/vnd.api+json',
        ],
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
    ]);
    $body = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    echo "POST $path => HTTP $code\n";
    echo $body . "\n\n";
}

cs_post($base, $token, "/api/v3/envelopes/{$envelopeId}/requirements", [
    'data' => [
        'type' => 'requirements',
        'attributes' => ['action' => 'agree', 'role' => $role],
        'relationships' => [
            'document' => ['data' => ['type' => 'documents', 'id' => $documentId]],
            'signer' => ['data' => ['type' => 'signers', 'id' => $signerId]],
        ],
    ],
]);

cs_post($base, $token, "/api/v3/envelopes/{$envelopeId}/requirements", [
    'data' => [
        'type' => 'requirements',
        'attributes' => ['action' => 'provide_evidence', 'auth' => 'email'],
        'relationships' => [
            'document' => ['data' => ['type' => 'documents', 'id' => $documentId]],
            'signer' => ['data' => ['type' => 'signers', 'id' => $signerId]],
        ],
    ],
]);

cs_post($base, $token, "/api/v3/envelopes/{$envelopeId}/signers/{$signerId}/notifications", [
    'data' => ['type' => 'notifications', 'attributes' => new stdClass()],
]);
