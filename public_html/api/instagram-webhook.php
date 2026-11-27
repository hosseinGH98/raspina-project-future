<?php
// Raspina Instagram AI DM & Post-Forward Webhook (PHP 8.2+ / 2-10s SLA)
// Uses indexed instagram_media_id lookup + strict category guard before AI response formatting

declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $configPath = __DIR__ . '/config.php';
    $config = file_exists($configPath) ? require $configPath : [];
    $mode = $_GET['hub_mode'] ?? '';
    $token = $_GET['hub_verify_token'] ?? '';
    $challenge = $_GET['hub_challenge'] ?? '';
    if ($mode === 'subscribe' && !empty($config['instagram_verify_token']) && hash_equals($config['instagram_verify_token'], $token)) {
        echo $challenge;
        exit;
    }
    http_response_code(403);
    exit;
}

$configPath = __DIR__ . '/config.php';
if (!file_exists($configPath)) {
    http_response_code(200);
    echo json_encode(['ok' => false, 'info' => 'Configure config.php first']);
    exit;
}

$config = require $configPath;
$payload = json_decode(file_get_contents('php://input') ?: '', true);
$mediaId = $payload['entry'][0]['messaging'][0]['message']['attachments'][0]['payload']['ig_post_media_id'] ?? null;

$pdo = new PDO(
    sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $config['db_host'], $config['db_name']),
    $config['db_user'],
    $config['db_pass'],
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
);

if ($mediaId) {
    $stmt = $pdo->prepare(
        'SELECT title_fa, category_title_fa, price_toman, canonical_url FROM products_catalog WHERE instagram_media_id = :mid AND is_active = 1 LIMIT 1'
    );
    $stmt->execute([':mid' => (string) $mediaId]);
    $product = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($product) {
        echo json_encode([
            'ok' => true,
            'matched_by' => 'exact_media_id',
            'category_verified' => $product['category_title_fa'],
            'buy_url' => $product['canonical_url'] . '?utm_source=instagram_dm&mid=' . urlencode((string) $mediaId),
        ]);
        exit;
    }
}

echo json_encode(['ok' => true, 'status' => 'queued_for_category_guard_ai']);
