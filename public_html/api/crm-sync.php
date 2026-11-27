<?php
// Raspina Shared-Hosting Site Sync Webhook Endpoint (PHP 8.2+ / PDO)
// Receives real-time order events from raspinashop.com, raspinaclothing.com, raspinaclothes.com

declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');

$configPath = __DIR__ . '/config.php';
if (!file_exists($configPath)) {
    http_response_code(503);
    echo json_encode(['ok' => false, 'error' => 'config.php not configured']);
    exit;
}

$config = require $configPath;
$rawBody = file_get_contents('php://input') ?: '';
$signature = $_SERVER['HTTP_X_RASPINA_SIGNATURE'] ?? '';

if (empty($config['webhook_hmac_secret']) || !hash_equals(
    hash_hmac('sha256', $rawBody, $config['webhook_hmac_secret']),
    $signature
)) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Invalid webhook signature']);
    exit;
}

$payload = json_decode($rawBody, true);
if (
    !is_array($payload) ||
    empty($payload['customer']['phone']) ||
    empty($payload['externalOrderId']) ||
    !isset($payload['totalToman'])
) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid payload']);
    exit;
}

$pdo = new PDO(
    sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $config['db_host'], $config['db_name']),
    $config['db_user'],
    $config['db_pass'],
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
);

$phone = preg_replace('/[^0-9+]/', '', (string) $payload['customer']['phone']);
$allowedSites = ['raspinashop', 'raspinaclothing', 'raspinaclothes', 'pos_hamedan', 'pos_tehran'];
$sourceSite = in_array($payload['sourceSite'] ?? '', $allowedSites, true) ? $payload['sourceSite'] : 'raspinashop';
$totalToman = max(0, (int) $payload['totalToman']);

$pdo->beginTransaction();
try {
    $stmt = $pdo->prepare('SELECT id, annual_spend_toman, lifetime_value_toman FROM customers WHERE phone_e164 = :phone LIMIT 1');
    $stmt->execute([':phone' => $phone]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        $customerId = bin2hex(random_bytes(16));
        $insert = $pdo->prepare(
            'INSERT INTO customers (id, phone_e164, full_name, rfm_segment, annual_spend_toman, lifetime_value_toman, last_purchase_at)
             VALUES (:id, :phone, :name, :seg, :annual, :clv, NOW())'
        );
        $insert->execute([
            ':id' => $customerId,
            ':phone' => $phone,
            ':name' => mb_substr((string) ($payload['customer']['fullName'] ?? 'مشتری راسپینا'), 0, 120),
            ':seg' => 'New',
            ':annual' => $totalToman,
            ':clv' => $totalToman,
        ]);
        $nextAnnual = $totalToman;
    } else {
        $customerId = $row['id'];
        $nextAnnual = (int) $row['annual_spend_toman'] + $totalToman;
        $nextClv = (int) $row['lifetime_value_toman'] + $totalToman;
        $upd = $pdo->prepare(
            'UPDATE customers SET annual_spend_toman = :annual, lifetime_value_toman = :clv, last_purchase_at = NOW() WHERE id = :id'
        );
        $upd->execute([':annual' => $nextAnnual, ':clv' => $nextClv, ':id' => $customerId]);
    }

    // Exact Raspina Loyalty Club Tier Thresholds: 0-5M Bronze(1), 5-15M Gold(1.5), 15-50M Platinum(2), >50M VIP Black(3)
    $tierCode = 'bronze';
    $multiplier = 1.0;
    $cashbackPct = 0.0;
    if ($nextAnnual >= 50000000) {
        $tierCode = 'vip_black';
        $multiplier = 3.0;
        $cashbackPct = 10.0;
    } elseif ($nextAnnual >= 15000000) {
        $tierCode = 'platinum';
        $multiplier = 2.0;
        $cashbackPct = 5.0;
    } elseif ($nextAnnual >= 5000000) {
        $tierCode = 'gold';
        $multiplier = 1.5;
    }

    $pointsEarned = (int) floor(($totalToman / 10000) * $multiplier);

    $orderId = bin2hex(random_bytes(16));
    $ordStmt = $pdo->prepare(
        'INSERT IGNORE INTO orders (id, customer_id, source_site, external_order_id, total_toman, ordered_at)
         VALUES (:id, :cid, :site, :ext, :tot, NOW())'
    );
    $ordStmt->execute([
        ':id' => $orderId,
        ':cid' => $customerId,
        ':site' => $sourceSite,
        ':ext' => mb_substr((string) $payload['externalOrderId'], 0, 64),
        ':tot' => $totalToman,
    ]);

    $accStmt = $pdo->prepare('SELECT id FROM loyalty_accounts WHERE customer_id = :cid LIMIT 1');
    $accStmt->execute([':cid' => $customerId]);
    $accId = $accStmt->fetchColumn();

    if (!$accId) {
        $accId = bin2hex(random_bytes(16));
        $ref = 'RASP-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 6));
        $insAcc = $pdo->prepare(
            'INSERT INTO loyalty_accounts (id, customer_id, tier_code, points_per_10k, points_balance, cashback_rate_pct, referral_code)
             VALUES (:id, :cid, :tier, :mult, :pts, :cb, :ref)'
        );
        $insAcc->execute([
            ':id' => $accId,
            ':cid' => $customerId,
            ':tier' => $tierCode,
            ':mult' => $multiplier,
            ':pts' => $pointsEarned,
            ':cb' => $cashbackPct,
            ':ref' => $ref,
        ]);
    } else {
        $updAcc = $pdo->prepare(
            'UPDATE loyalty_accounts SET tier_code = :tier, points_per_10k = :mult, points_balance = points_balance + :pts, cashback_rate_pct = :cb, tier_updated_at = NOW() WHERE id = :id'
        );
        $updAcc->execute([
            ':tier' => $tierCode,
            ':mult' => $multiplier,
            ':pts' => $pointsEarned,
            ':cb' => $cashbackPct,
            ':id' => $accId,
        ]);
    }

    // Auto-schedule 24h post-purchase NPS follow-up task
    $fuStmt = $pdo->prepare(
        'INSERT INTO follow_up_tasks (id, customer_id, order_id, stage_code, scheduled_for)
         VALUES (:id, :cid, :oid, :stage, DATE_ADD(NOW(), INTERVAL 24 HOUR))'
    );
    $fuStmt->execute([
        ':id' => bin2hex(random_bytes(16)),
        ':cid' => $customerId,
        ':oid' => $orderId,
        ':stage' => 'h24_nps',
    ]);

    $pdo->commit();

    echo json_encode([
        'ok' => true,
        'crmCustomerId' => $customerId,
        'tierCode' => $tierCode,
        'pointsEarned' => $pointsEarned,
        'receivedOrderId' => $payload['externalOrderId'],
    ]);
} catch (Throwable $e) {
    $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Database transaction failed']);
}
