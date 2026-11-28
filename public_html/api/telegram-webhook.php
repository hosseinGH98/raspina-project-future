<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
raspina_set_exception_handler();
raspina_send_security_headers();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    raspina_fail('method_not_allowed', 'متد درخواست مجاز نیست.', 405);
}

$config = raspina_config();
$botToken = (string) ($config['telegram_bot_token'] ?? '');
$webhookSecret = (string) ($config['telegram_webhook_secret'] ?? '');

if ($botToken === '' || $webhookSecret === '') {
    raspina_fail('telegram_disabled', 'ربات تلگرام پیکربندی نشده است.', 503);
}

$providedSecret = (string) ($_SERVER['HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN'] ?? '');
if (!hash_equals($webhookSecret, $providedSecret)) {
    raspina_fail('invalid_webhook_secret', 'امنیت وب‌هوک تلگرام تأیید نشد.', 401);
}

$raw = file_get_contents('php://input');
if ($raw === false || $raw === '' || strlen($raw) > 131_072) {
    raspina_fail('invalid_body', 'بدنه درخواست تلگرام معتبر نیست.', 400);
}

try {
    $update = json_decode($raw, true, 12, JSON_THROW_ON_ERROR);
} catch (JsonException $e) {
    raspina_fail('invalid_json', 'بدنه JSON معتبر نیست.', 400);
}
if (!is_array($update)) {
    raspina_fail('invalid_json', 'بدنه باید یک شیء باشد.', 400);
}

$message = is_array($update['message'] ?? null) ? $update['message'] : [];
$callback = is_array($update['callback_query'] ?? null) ? $update['callback_query'] : [];
$chatId = $message['chat']['id'] ?? ($callback['message']['chat']['id'] ?? null);
$callbackId = $callback['id'] ?? null;
$callbackData = (string) ($callback['data'] ?? '');
$text = trim((string) ($message['text'] ?? ''));

if (!is_int($chatId) && !is_string($chatId)) {
    raspina_json(['ok' => true]);
}

[$allowed] = raspina_rate_limit('telegram:' . $chatId, 40, 60);
if (!$allowed) {
    raspina_json(['ok' => true]);
}

function telegram_escape(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function telegram_buy_url(string $url): string
{
    $separator = str_contains($url, '?') ? '&' : '?';
    return $url . $separator . 'utm_source=telegram_bot&utm_medium=bot&utm_campaign=storefront';
}

function telegram_api(string $botToken, string $method, array $payload): bool
{
    $url = 'https://api.telegram.org/bot' . $botToken . '/' . $method;
    $handle = curl_init($url);
    if ($handle === false) {
        return false;
    }

    curl_setopt_array($handle, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 4,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);
    $response = curl_exec($handle);
    $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    $error = curl_error($handle);
    curl_close($handle);

    if ($response === false || $status >= 400) {
        error_log('Raspina Telegram API failure: status=' . $status . ' error=' . $error);
        return false;
    }
    return true;
}

try {
    $pdo = raspina_db();
} catch (Throwable $e) {
    raspina_json(['ok' => true]);
}

if ($callbackId !== null) {
    telegram_api($botToken, 'answerCallbackQuery', ['callback_query_id' => $callbackId]);
}

if ($chatId !== null && str_starts_with($callbackData, 'cat:')) {
    $categorySlug = substr($callbackData, 4);
    if (!preg_match('/^[a-z0-9_-]{2,64}$/', $categorySlug)) {
        raspina_json(['ok' => true]);
    }

    $stmt = $pdo->prepare(
        'SELECT title_fa, price_toman, canonical_url, attributes_json
         FROM products_catalog
         WHERE category_slug = :slug AND is_active = 1
         ORDER BY updated_at DESC
         LIMIT 8'
    );
    $stmt->execute([':slug' => $categorySlug]);
    $products = $stmt->fetchAll();

    if ($products === []) {
        telegram_api($botToken, 'sendMessage', [
            'chat_id' => $chatId,
            'text' => 'در این دسته‌بندی محصول فعالی موجود نیست.',
        ]);
        raspina_json(['ok' => true]);
    }

    $lines = [];
    foreach ($products as $product) {
        $price = number_format((int) $product['price_toman']);
        $lines[] = '<b>' . telegram_escape((string) $product['title_fa']) . "</b>\n"
            . 'قیمت: ' . $price . " تومان\n"
            . '<a href="' . telegram_escape(telegram_buy_url((string) $product['canonical_url'])) . '">خرید مستقیم از سایت</a>';
    }

    telegram_api($botToken, 'sendMessage', [
        'chat_id' => $chatId,
        'text' => implode("\n\n", $lines),
        'parse_mode' => 'HTML',
        'disable_web_page_preview' => true,
    ]);
    raspina_json(['ok' => true]);
}

// /start or any first message: show the live category keyboard.
$categories = $pdo->query(
    'SELECT category_slug, category_title_fa, COUNT(*) AS product_count
     FROM products_catalog
     WHERE is_active = 1
     GROUP BY category_slug, category_title_fa
     ORDER BY category_title_fa'
)->fetchAll();

if ($categories === []) {
    if ($chatId !== null) {
        telegram_api($botToken, 'sendMessage', [
            'chat_id' => $chatId,
            'text' => 'کاتالوگ راسپینا در حال به‌روزرسانی است؛ لطفاً کمی بعد تلاش کنید.',
        ]);
    }
    raspina_json(['ok' => true]);
}

$rows = [];
$row = [];
foreach ($categories as $category) {
    $row[] = [
        'text' => $category['category_title_fa'] . ' (' . (int) $category['product_count'] . ')',
        'callback_data' => 'cat:' . $category['category_slug'],
    ];
    if (count($row) === 2) {
        $rows[] = $row;
        $row = [];
    }
}
if ($row !== []) {
    $rows[] = $row;
}

if ($chatId !== null) {
    telegram_api($botToken, 'sendMessage', [
        'chat_id' => $chatId,
        'text' => "به فروشگاه راسپینا خوش آمدید 🌟\nیک دسته‌بندی را انتخاب کنید تا قیمت روز، سایزبندی و لینک خرید مستقیم را ببینید.",
        'reply_markup' => ['inline_keyboard' => $rows],
    ]);
}

raspina_json(['ok' => true]);
