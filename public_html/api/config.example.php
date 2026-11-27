<?php
// Copy this file to config.php in public_html/api/ and fill with your host credentials.
// Protected from HTTP download by public_html/.htaccess

declare(strict_types=1);

return [
    'db_host' => getenv('RASPINA_DB_HOST') ?: 'localhost',
    'db_name' => getenv('RASPINA_DB_NAME') ?: 'raspina_crm',
    'db_user' => getenv('RASPINA_DB_USER') ?: '',
    'db_pass' => getenv('RASPINA_DB_PASS') ?: '',
    'api_bearer_token' => getenv('RASPINA_API_BEARER_TOKEN') ?: '',
    'webhook_hmac_secret' => getenv('RASPINA_WEBHOOK_SECRET') ?: '',
    'telegram_bot_token' => getenv('TELEGRAM_BOT_TOKEN') ?: '',
    'instagram_access_token' => getenv('INSTAGRAM_ACCESS_TOKEN') ?: '',
    'instagram_verify_token' => getenv('INSTAGRAM_VERIFY_TOKEN') ?: '',
    'ai_api_key' => getenv('AI_API_KEY') ?: '',
    'ai_api_endpoint' => getenv('AI_API_ENDPOINT') ?: '',
];
