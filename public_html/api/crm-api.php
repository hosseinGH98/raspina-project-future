<?php
// Raspina CRM & Loyalty Club REST API (PHP 8.2+ / Zero-SSH Shared Hosting)
// Handles authenticated CRUD actions from public_html SPA when connected to MySQL

declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');

$configPath = __DIR__ . '/config.php';
if (!file_exists($configPath)) {
    http_response_code(503);
    echo json_encode(['ok' => false, 'error' => 'config.php not configured']);
    exit;
}

$config = require $configPath;
$authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
$expectedToken = (string) ($config['api_bearer_token'] ?? '');

if ($expectedToken === '' || !hash_equals('Bearer ' . $expectedToken, $authHeader)) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Unauthorized']);
    exit;
}

$pdo = new PDO(
    sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $config['db_host'], $config['db_name']),
    $config['db_user'],
    $config['db_pass'],
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
);

$action = $_GET['action'] ?? 'customers';

if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'customers') {
    $stmt = $pdo->query(
        'SELECT c.id, c.full_name, c.phone_e164, c.city, c.annual_spend_toman, c.lifetime_value_toman,
                c.wallet_balance_toman, l.tier_code, l.points_balance
         FROM customers c
         LEFT JOIN loyalty_accounts l ON l.customer_id = c.id
         ORDER BY c.updated_at DESC
         LIMIT 100'
    );
    echo json_encode(['ok' => true, 'customers' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'award_points') {
    $body = json_decode(file_get_contents('php://input') ?: '', true);
    $customerId = (string) ($body['customerId'] ?? '');
    $points = max(1, (int) ($body['points'] ?? 0));
    $reason = mb_substr((string) ($body['reason'] ?? 'اعطای امتیاز کارشناس'), 0, 100);

    if ($customerId === '' || $points <= 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Invalid input']);
        exit;
    }

    $upd = $pdo->prepare('UPDATE loyalty_accounts SET points_balance = points_balance + :pts WHERE customer_id = :cid');
    $upd->execute([':pts' => $points, ':cid' => $customerId]);

    $aud = $pdo->prepare('INSERT INTO audit_logs (id, actor_role, action_text, target_ref) VALUES (:id, :role, :act, :tgt)');
    $aud->execute([
        ':id' => bin2hex(random_bytes(16)),
        ':role' => 'crm_api',
        ':act' => $reason,
        ':tgt' => $customerId,
    ]);

    echo json_encode(['ok' => true, 'pointsAdded' => $points]);
    exit;
}

http_response_code(404);
echo json_encode(['ok' => false, 'error' => 'Unknown action']);
