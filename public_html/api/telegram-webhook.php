<?php
// Raspina Telegram Storefront Bot Webhook (PHP 8.2+ / Zero-SSH Shared Hosting)
// Flow: /start -> Categories -> Category Products (title, price, direct website buy link)

declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');

$configPath = __DIR__ . '/config.php';
if (!file_exists($configPath)) {
    http_response_code(200);
    echo json_encode(['ok' => false, 'info' => 'Configure config.php first']);
    exit;
}

$config = require $configPath;
$update = json_decode(file_get_contents('php://input') ?: '', true);
if (!is_array($update)) {
    http_response_code(400);
    exit;
}

$pdo = new PDO(
    sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $config['db_host'], $config['db_name']),
    $config['db_user'],
    $config['db_pass'],
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
);

$chatId = $update['message']['chat']['id'] ?? ($update['callback_query']['message']['chat']['id'] ?? null);
$callbackData = $update['callback_query']['data'] ?? null;

if ($chatId && $callbackData && str_starts_with($callbackData, 'cat:')) {
    $catSlug = substr($callbackData, 4);
    $stmt = $pdo->prepare(
        'SELECT title_fa, price_toman, canonical_url FROM products_catalog WHERE category_slug = :slug AND is_active = 1 LIMIT 10'
    );
    $stmt->execute([':slug' => $catSlug]);
    $products = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $lines = [];
    foreach ($products as $item) {
        $lines[] = sprintf(
            "%s\nقیمت: %s تومان\nخرید مستقیم: %s?utm_source=telegram_bot",
            $item['title_fa'],
            number_format((int) $item['price_toman']),
            $item['canonical_url']
        );
    }

    $reply = $lines ? implode("\n\n", $lines) : 'در این دسته‌بندی محصول فعالی یافت نشد.';
    // Send via Telegram sendMessage API using $config['telegram_bot_token']
    echo json_encode(['ok' => true, 'chat_id' => $chatId, 'preview_text' => $reply]);
    exit;
}

$cats = $pdo->query('SELECT DISTINCT category_slug, category_title_fa FROM products_catalog WHERE is_active = 1')->fetchAll(PDO::FETCH_ASSOC);
echo json_encode(['ok' => true, 'categories' => $cats]);
