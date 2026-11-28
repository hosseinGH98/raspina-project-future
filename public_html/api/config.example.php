<?php
/**
 * Raspina CRM configuration template.
 *
 * 1. Copy this file to `config.php` in the SAME directory (config.php is blocked by .htaccess).
 * 2. Fill the database credentials from cPanel → MySQL Databases.
 * 3. Generate long random secrets (32+ chars) for webhook_hmac_secret, telegram_webhook_secret,
 *    instagram_app_secret and setup_token. Never reuse passwords.
 * 4. Keep file permissions at 600/640 if the host allows it.
 *
 * This file must never be committed with real values.
 */
declare(strict_types=1);

return [
    // Database (created in cPanel, user must be granted privileges on this database only)
    'db_host' => 'localhost',
    'db_name' => 'cpaneluser_raspina',
    'db_user' => 'cpaneluser_raspina',
    'db_pass' => '',

    // Application
    'timezone' => 'Asia/Tehran',

    // One-time administrator setup token used by api/setup.php (min 24 chars, random).
    'setup_token' => '',

    // Storefront → CRM webhook signing secret (same value configured on the 3 websites).
    'webhook_hmac_secret' => '',

    // Telegram bot: BotFather token + the secret_token passed to setWebhook.
    'telegram_bot_token' => '',
    'telegram_webhook_secret' => '',

    // Meta / Instagram: app secret, webhook verify token, and the Instagram Professional account.
    'instagram_app_secret' => '',
    'instagram_verify_token' => '',
    'instagram_page_access_token' => '',
    'instagram_page_id' => '',

    // Optional AI endpoint (OpenAI-compatible). The current bot uses deterministic,
    // catalog-grounded replies and never lets the model invent prices; leave empty to disable.
    'ai_api_key' => '',
    'ai_api_endpoint' => '',
    'ai_model' => '',
];
