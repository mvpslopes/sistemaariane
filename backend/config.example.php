<?php
/**
 * Copie este arquivo para config.local.php no servidor e preencha os dados.
 * config.local.php NÃO deve ir para o git.
 */
return [
    'db_host' => 'localhost',
    'db_port' => 3306,
    'db_user' => 'u179630068_ariane_usermvp',
    'db_password' => 'SUA_SENHA_AQUI',
    'db_name' => 'u179630068_mvp_ariane',
    'jwt_secret' => 'altere_este_segredo_jwt',

    // Clicksign (NÃO versionar o token real — use config.local.php)
    'clicksign_access_token' => '',
    'clicksign_base_url' => 'https://app.clicksign.com', // sandbox: https://sandbox.clicksign.com
];
