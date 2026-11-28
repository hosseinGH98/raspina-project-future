<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
raspina_set_exception_handler();
raspina_send_security_headers();

$config = raspina_config();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $mode = (string) ($_GET['hub_mode'] ?? '');
    $token = (string) ($_GET['hub_verify_token'] ?? '');
    $challenge = (string) ($_GET['hub_challenge'] ?? '');
    $expected = (string) ($config['instagram_verify_token'] ?? '');

    if ($expected !== '' && $mode === 'subscribe' && hash_equals($expected, $token)) {
        header('Content-Type: text/plain; charset=utf-8');
        echo $challenge;
        exit;
    }
    raspina_fail('verification_failed', 'تأیید وب‌هوک اینستاگرام ناموفق بود.', 403);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: GET, POST');
    raspina_fail('method_not_allowed', 'متد درخواست مجاز نیست.', 405);
}

$appSecret = (string) ($config['instagram_app_secret'] ?? '');
if ($appSecret === '') {
    raspina_fail('instagram_disabled', 'وب‌هوک اینستاگرام پیکربندی نشده است.', 503);
}

$raw = file_get_contents('php://input');
if ($raw === false || $raw === '' || strlen($raw) > 262_144) {
    raspina_fail('invalid_body', 'بدنه درخواست اینستاگرام معتبر نیست.', 400);
}

$signatureHeader = (string) ($_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '');
$expectedSignature = 'sha256=' . hash_hmac('sha256', $raw, $appSecret);
if ($signatureHeader === '' || !hash_equals($expectedSignature, $signatureHeader)) {
    raspina_fail('invalid_signature', 'امضای درخواست اینستاگرام معتبر نیست.', 403);
}

try {
    $payload = json_decode($raw, true, 20, JSON_THROW_ON_ERROR);
} catch (JsonException $e) {
    raspina_fail('invalid_json', 'بدنه JSON معتبر نیست.', 400);
}
if (!is_array($payload)) {
    raspina_fail('invalid_json', 'بدنه باید یک شیء باشد.', 400);
}

$messaging = $payload['entry'][0]['messaging'][0] ?? null;
if (!is_array($messaging)) {
    raspina_json(['ok' => true, 'status' => 'ignored']);
}

$senderId = (string) ($messaging['sender']['id'] ?? '');
$messageText = trim((string) ($messaging['message']['text'] ?? ''));
$attachment = $messaging['message']['attachments'][0] ?? null;
$mediaId = '';
if (is_array($attachment)) {
    $mediaId = (string) ($attachment['payload']['ig_post_media_id'] ?? '');
    if ($mediaId === '' && isset($attachment['payload']['url'])) {
        $url = (string) $attachment['payload']['url'];
        if (preg_match('#/(?:p|reel)/([A-Za-z0-9_-]{5,})#', $url, $matches) === 1) {
            $mediaId = $matches[1];
        }
    }
}

if ($senderId === '') {
    raspina_json(['ok' => true, 'status' => 'ignored']);
}

[$allowed] = raspina_rate_limit('instagram:' . $senderId, 30, 60);
if (!$allowed) {
    raspina_json(['ok' => true, 'status' => 'rate_limited']);
}

$pageToken = (string) ($config['instagram_page_access_token'] ?? '');
$pageId = (string) ($config['instagram_page_id'] ?? '');

function instagram_send_message(string $pageId, string $pageToken, string $recipientId, string $text): bool
{
    if ($pageId === '' || $pageToken === '') {
        return false;
    }

    $url = 'https://graph.facebook.com/v20.0/' . rawurlencode($pageId) . '/messages';
    $handle = curl_init($url);
    if ($handle === false) {
        return false;
    }

    curl_setopt_array($handle, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode([
            'recipient' => ['id' => $recipientId],
            'message' => ['text' => mb_substr($text, 0, 900)],
        ], JSON_UNESCAPED_UNICODE),
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $pageToken,
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 4,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);
    $response = curl_exec($handle);
    $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    curl_close($handle);

    if ($response === false || $status >= 400) {
        error_log('Raspina Instagram send failure: status=' . $status);
        return false;
    }
    return true;
}

function instagram_buy_url(string $url): string
{
    $separator = str_contains($url, '?') ? '&' : '?';
    return $url . $separator . 'utm_source=instagram_dm&utm_medium=direct&utm_campaign=ai_assistant';
}

try {
    $pdo = raspina_db();
} catch (Throwable $e) {
    raspina_json(['ok' => true, 'status' => 'database_unavailable']);
}

$product = null;

if ($mediaId !== '') {
    $stmt = $pdo->prepare(
        'SELECT title_fa, category_title_fa, price_toman, canonical_url, attributes_json
         FROM products_catalog
         WHERE instagram_media_id = :media AND is_active = 1
         LIMIT 1'
    );
    $stmt->execute([':media' => $mediaId]);
    $found = $stmt->fetch();
    if (is_array($found)) {
        $product = $found;
    }
}

if ($product === null && $messageText !== '') {
    // Strict category guard: only an explicit, allow-listed category can select a product.
    $categories = [
        'شومیز' => 'blouse',
        'بلوز' => 'blouse',
        'مانتو' => 'manteau',
        'عبا' => 'manteau',
        'شلوار' => 'pants',
        'ست' => 'set',
    ];
    foreach ($categories as $keyword => $slug) {
        if (!str_contains($messageText, $keyword)) {
            continue;
        }
        $stmt = $pdo->prepare(
            'SELECT title_fa, category_title_fa, price_toman, canonical_url, attributes_json
             FROM products_catalog
             WHERE category_slug = :slug AND is_active = 1
             ORDER BY updated_at DESC
             LIMIT 1'
        );
        $stmt->execute([':slug' => $slug]);
        $candidate = $stmt->fetch();
        if (is_array($candidate)) {
            $product = $candidate;
        }
        break;
    }
}

if ($product === null) {
    $reply = 'سلام وقت بخیر 🌸 برای اینکه قیمت و لینک دقیق همان مدل را بفرستم، لطفاً پست محصول را به دایرکت فوروارد کنید یا نام دقیق دسته (شومیز، مانتو، شلوار، ست) را بنویسید.';
    instagram_send_message($pageId, $pageToken, $senderId, $reply);
    raspina_json(['ok' => true, 'status' => 'clarification_sent']);
}

$attributes = json_decode((string) ($product['attributes_json'] ?? '{}'), true);
$sizes = is_array($attributes) && is_array($attributes['sizes'] ?? null)
    ? implode('، ', array_map('strval', $attributes['sizes']))
    : '';

$price = number_format((int) $product['price_toman']);
$reply = 'سلام وقت بخیر 🌸 مدل «' . $product['title_fa'] . '» از دسته ' . $product['category_title_fa']
    . ' با قیمت ' . $price . ' تومان'
    . ($sizes !== '' ? ' در سایزهای ' . $sizes : '')
    . ' موجود است. لینک خرید مستقیم از سایت راسپینا: '
    . instagram_buy_url((string) $product['canonical_url']);

instagram_send_message($pageId, $pageToken, $senderId, $reply);

raspina_json([
    'ok' => true,
    'status' => 'replied',
    'category_verified' => $product['category_title_fa'],
    'matched_by' => $mediaId !== '' ? 'exact_media_id' : 'strict_category_keyword',
]);
