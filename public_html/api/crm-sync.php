<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
raspina_set_exception_handler();
raspina_send_security_headers();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    raspina_fail('method_not_allowed', 'متد درخواست مجاز نیست.', 405);
}

[$allowed, $retryAfter] = raspina_rate_limit('webhook_order', 600, 60);
if (!$allowed) {
    header('Retry-After: ' . $retryAfter);
    raspina_fail('rate_limited', 'نرخ درخواست بیش از حد مجاز است.', 429);
}

$config = raspina_config();
$secret = (string) ($config['webhook_hmac_secret'] ?? '');
if ($secret === '') {
    raspina_fail('webhook_disabled', 'کلید امضای وب‌هوک تنظیم نشده است.', 503);
}

$contentType = strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? ''));
if (!str_contains($contentType, 'application/json')) {
    raspina_fail('unsupported_media_type', 'درخواست باید JSON باشد.', 415);
}

$raw = file_get_contents('php://input');
if ($raw === false || $raw === '') {
    raspina_fail('empty_body', 'بدنه درخواست خالی است.', 400);
}
if (strlen($raw) > 262_144) {
    raspina_fail('payload_too_large', 'حجم درخواست بیش از حد مجاز است.', 413);
}

$signature = strtolower(trim((string) ($_SERVER['HTTP_X_RASPINA_SIGNATURE'] ?? '')));
$timestamp = trim((string) ($_SERVER['HTTP_X_RASPINA_TIMESTAMP'] ?? ''));
$nonce = trim((string) ($_SERVER['HTTP_X_RASPINA_NONCE'] ?? ''));

if (!ctype_digit($timestamp) || abs(time() - (int) $timestamp) > 300) {
    raspina_fail('stale_request', 'زمان درخواست معتبر نیست (حداکثر ۵ دقیقه).', 401);
}
if (!preg_match('/^[A-Za-z0-9_-]{16,64}$/', $nonce)) {
    raspina_fail('invalid_nonce', 'شناسه یکتای درخواست معتبر نیست.', 400);
}

$expected = hash_hmac('sha256', $timestamp . "\n" . $raw, $secret);
if ($signature === '' || !hash_equals($expected, $signature)) {
    raspina_fail('invalid_signature', 'امضای وب‌هوک معتبر نیست.', 401);
}

try {
    $payload = json_decode($raw, true, 16, JSON_THROW_ON_ERROR);
} catch (JsonException $e) {
    raspina_fail('invalid_json', 'بدنه JSON معتبر نیست.', 400);
}
if (!is_array($payload)) {
    raspina_fail('invalid_json', 'بدنه JSON باید یک شیء باشد.', 400);
}

$orderExternalId = trim((string) ($payload['externalOrderId'] ?? ''));
$totalToman = (int) ($payload['totalToman'] ?? 0);
$customer = is_array($payload['customer'] ?? null) ? $payload['customer'] : [];
$phone = raspina_normalize_phone((string) ($customer['phone'] ?? ''));
$fullName = trim((string) ($customer['fullName'] ?? ''));
$itemsSummary = trim((string) ($payload['itemsSummary'] ?? ''));
$sourceSite = (string) ($payload['sourceSite'] ?? '');
$attribution = (string) ($payload['attributionChannel'] ?? 'direct_web');

$allowedSites = ['raspinashop', 'raspinaclothing', 'raspinaclothes', 'pos_hamedan', 'pos_tehran'];
$allowedAttribution = ['instagram_dm', 'telegram_bot', 'direct_web', 'store_walkin'];

if ($orderExternalId === '' || strlen($orderExternalId) > 64) {
    raspina_fail('invalid_order', 'کد سفارش معتبر نیست.', 422);
}
if ($phone === '') {
    raspina_fail('invalid_phone', 'شماره موبایل مشتری معتبر نیست.', 422);
}
if ($totalToman <= 0 || $totalToman > 5_000_000_000) {
    raspina_fail('invalid_amount', 'مبلغ سفارش معتبر نیست.', 422);
}
if (!in_array($sourceSite, $allowedSites, true)) {
    raspina_fail('invalid_source', 'سایت مبدأ معتبر نیست.', 422);
}
if (!in_array($attribution, $allowedAttribution, true)) {
    $attribution = 'direct_web';
}
if ($fullName === '') {
    $fullName = 'مشتری راسپینا';
}

$pdo = raspina_db();

try {
    $pdo->beginTransaction();

    // Replay protection: a nonce may be used only once per source.
    $nonceStmt = $pdo->prepare(
        'INSERT INTO webhook_events (id, source, nonce, created_at) VALUES (:id, :source, :nonce, NOW())'
    );
    try {
        $nonceStmt->execute([
            ':id' => bin2hex(random_bytes(16)),
            ':source' => $sourceSite,
            ':nonce' => $nonce,
        ]);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {
            $pdo->rollBack();
            raspina_json(['ok' => true, 'duplicate' => true, 'message' => 'درخواست تکراری نادیده گرفته شد.']);
        }
        throw $e;
    }

    // Idempotency: the same storefront order id must never be applied twice.
    $existingOrder = $pdo->prepare(
        'SELECT id FROM orders WHERE source_site = :site AND external_order_id = :ext LIMIT 1'
    );
    $existingOrder->execute([':site' => $sourceSite, ':ext' => $orderExternalId]);
    if ($existingOrder->fetchColumn() !== false) {
        $pdo->commit();
        raspina_json(['ok' => true, 'duplicate' => true, 'message' => 'این سفارش قبلاً در CRM ثبت شده است.']);
    }

    $customerStmt = $pdo->prepare(
        'SELECT id, annual_spend_toman, lifetime_value_toman FROM customers WHERE phone_e164 = :phone LIMIT 1 FOR UPDATE'
    );
    $customerStmt->execute([':phone' => $phone]);
    $existingCustomer = $customerStmt->fetch();

    if (is_array($existingCustomer)) {
        $customerId = (string) $existingCustomer['id'];
        $nextAnnual = (int) $existingCustomer['annual_spend_toman'] + $totalToman;
        $nextClv = (int) $existingCustomer['lifetime_value_toman'] + $totalToman;
        $updateCustomer = $pdo->prepare(
            'UPDATE customers
             SET annual_spend_toman = :annual, lifetime_value_toman = :clv, last_purchase_at = NOW(), updated_at = NOW()
             WHERE id = :id'
        );
        $updateCustomer->execute([':annual' => $nextAnnual, ':clv' => $nextClv, ':id' => $customerId]);
    } else {
        $customerId = bin2hex(random_bytes(16));
        $nextAnnual = $totalToman;
        $nextClv = $totalToman;
        $insertCustomer = $pdo->prepare(
            'INSERT INTO customers
                (id, phone_e164, full_name, city, rfm_segment, annual_spend_toman, lifetime_value_toman, last_purchase_at, created_at, updated_at)
             VALUES
                (:id, :phone, :name, :city, :segment, :annual, :clv, NOW(), NOW(), NOW())'
        );
        $insertCustomer->execute([
            ':id' => $customerId,
            ':phone' => $phone,
            ':name' => mb_substr($fullName, 0, 120),
            ':city' => mb_substr((string) ($customer['city'] ?? 'تهران'), 0, 64),
            ':segment' => 'New',
            ':annual' => $nextAnnual,
            ':clv' => $nextClv,
        ]);
    }

    $orderId = bin2hex(random_bytes(16));
    $insertOrder = $pdo->prepare(
        'INSERT INTO orders
            (id, customer_id, source_site, external_order_id, attribution_channel, items_summary, total_toman, status, ordered_at)
         VALUES
            (:id, :customer, :site, :ext, :attribution, :items, :total, :status, NOW())'
    );
    $insertOrder->execute([
        ':id' => $orderId,
        ':customer' => $customerId,
        ':site' => $sourceSite,
        ':ext' => $orderExternalId,
        ':attribution' => $attribution,
        ':items' => mb_substr($itemsSummary !== '' ? $itemsSummary : 'سفارش آنلاین', 0, 255),
        ':total' => $totalToman,
        ':status' => 'paid',
    ]);

    // Loyalty tier thresholds (mirrors src/utils/crmEngine.ts).
    $tierCode = 'bronze';
    $multiplier = 1.0;
    $cashbackPct = 0.0;
    if ($nextAnnual >= 50_000_000) {
        $tierCode = 'vip_black';
        $multiplier = 3.0;
        $cashbackPct = 10.0;
    } elseif ($nextAnnual >= 15_000_000) {
        $tierCode = 'platinum';
        $multiplier = 2.0;
        $cashbackPct = 5.0;
    } elseif ($nextAnnual >= 5_000_000) {
        $tierCode = 'gold';
        $multiplier = 1.5;
    }

    $pointsEarned = (int) floor(($totalToman / 10_000) * $multiplier);
    $cashbackToman = (int) round(($totalToman * $cashbackPct) / 100);

    $accountStmt = $pdo->prepare(
        'SELECT id FROM loyalty_accounts WHERE customer_id = :customer LIMIT 1 FOR UPDATE'
    );
    $accountStmt->execute([':customer' => $customerId]);
    $accountId = $accountStmt->fetchColumn();

    if ($accountId === false) {
        $accountId = bin2hex(random_bytes(16));
        $insertAccount = $pdo->prepare(
            'INSERT INTO loyalty_accounts
                (id, customer_id, tier_code, points_per_10k, points_balance, cashback_rate_pct, referral_code, tier_updated_at)
             VALUES
                (:id, :customer, :tier, :multiplier, :points, :cashback, :referral, NOW())'
        );
        $insertAccount->execute([
            ':id' => $accountId,
            ':customer' => $customerId,
            ':tier' => $tierCode,
            ':multiplier' => $multiplier,
            ':points' => $pointsEarned,
            ':cashback' => $cashbackPct,
            ':referral' => 'RASP-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 6)),
        ]);
    } else {
        $updateAccount = $pdo->prepare(
            'UPDATE loyalty_accounts
             SET tier_code = :tier, points_per_10k = :multiplier,
                 points_balance = points_balance + :points,
                 cashback_rate_pct = :cashback, tier_updated_at = NOW()
             WHERE id = :id'
        );
        $updateAccount->execute([
            ':tier' => $tierCode,
            ':multiplier' => $multiplier,
            ':points' => $pointsEarned,
            ':cashback' => $cashbackPct,
            ':id' => $accountId,
        ]);
    }

    if ($cashbackToman > 0) {
        $walletStmt = $pdo->prepare(
            'UPDATE customers SET wallet_balance_toman = wallet_balance_toman + :wallet, updated_at = NOW() WHERE id = :id'
        );
        $walletStmt->execute([':wallet' => $cashbackToman, ':id' => $customerId]);
    }

    $insertTx = $pdo->prepare(
        'INSERT INTO loyalty_transactions
            (id, loyalty_account_id, tx_type, points_delta, source_order_id, idempotency_key)
         VALUES
            (:id, :account, :type, :points, :order_id, :key)'
    );
    $insertTx->execute([
        ':id' => bin2hex(random_bytes(16)),
        ':account' => $accountId,
        ':type' => 'earn_purchase',
        ':points' => $pointsEarned,
        ':order_id' => $orderId,
        ':key' => 'order:' . $sourceSite . ':' . $orderExternalId,
    ]);

    // Schedule the 24h NPS follow-up exactly once per order.
    $insertFollowUp = $pdo->prepare(
        'INSERT INTO follow_up_tasks (id, customer_id, order_id, stage_code, scheduled_for)
         VALUES (:id, :customer, :order_id, :stage, DATE_ADD(NOW(), INTERVAL 24 HOUR))'
    );
    $insertFollowUp->execute([
        ':id' => bin2hex(random_bytes(16)),
        ':customer' => $customerId,
        ':order_id' => $orderId,
        ':stage' => 'h24_nps',
    ]);

    $pdo->commit();

    raspina_audit(
        'همگام‌سازی سفارش ' . $orderExternalId . ' (+' . $pointsEarned . ' امتیاز)',
        $phone,
        'webhook'
    );

    raspina_json([
        'ok' => true,
        'duplicate' => false,
        'crmCustomerId' => $customerId,
        'tierCode' => $tierCode,
        'pointsEarned' => $pointsEarned,
        'walletCashbackToman' => $cashbackToman,
        'receivedOrderId' => $orderExternalId,
    ]);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    if ($e->getCode() === '23000') {
        // Distinguish a harmless replay from a concurrent first-time insert for the
        // same phone number; the latter must be retried, not silently dropped.
        try {
            $check = $pdo->prepare('SELECT id FROM orders WHERE source_site = :site AND external_order_id = :ext LIMIT 1');
            $check->execute([':site' => $sourceSite, ':ext' => $orderExternalId]);
            if ($check->fetchColumn() !== false) {
                raspina_json(['ok' => true, 'duplicate' => true, 'message' => 'سفارش تکراری نادیده گرفته شد.']);
            }
        } catch (Throwable $checkError) {
            error_log('Raspina sync duplicate check failed');
        }
        raspina_fail('concurrent_conflict', 'همین مشتری هم‌زمان ثبت شد؛ لطفاً درخواست را با nonce جدید تکرار کنید.', 409);
    }
    error_log('Raspina sync failed: ' . $e->getCode());
    raspina_fail('sync_failed', 'ثبت سفارش در CRM انجام نشد.', 500);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    throw $e;
}
