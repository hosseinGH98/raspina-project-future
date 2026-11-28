<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
raspina_set_exception_handler();
raspina_send_security_headers();
raspina_start_session();

$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$action = (string) ($_GET['action'] ?? 'customers');

if ($method === 'GET' && $action === 'customers') {
    raspina_require_permission('customers:view');

    $limit = (int) ($_GET['limit'] ?? 50);
    $limit = max(1, min(200, $limit));
    $offset = max(0, (int) ($_GET['offset'] ?? 0));

    $stmt = raspina_db()->prepare(
        'SELECT c.id, c.full_name, c.phone_e164, c.city, c.annual_spend_toman, c.lifetime_value_toman,
                c.wallet_balance_toman, c.overall_score, c.churn_risk_pct, c.last_purchase_at,
                l.tier_code, l.points_balance
         FROM customers c
         LEFT JOIN loyalty_accounts l ON l.customer_id = c.id
         ORDER BY c.updated_at DESC
         LIMIT :limit OFFSET :offset'
    );
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();

    raspina_json([
        'ok' => true,
        'customers' => $stmt->fetchAll(),
        'limit' => $limit,
        'offset' => $offset,
    ]);
}

if ($method === 'GET' && $action === 'audit') {
    raspina_require_permission('audit:view');
    $limit = max(1, min(200, (int) ($_GET['limit'] ?? 50)));
    $stmt = raspina_db()->prepare(
        'SELECT actor_role, action_text, target_ref, created_at FROM audit_logs ORDER BY created_at DESC LIMIT :limit'
    );
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->execute();
    raspina_json(['ok' => true, 'logs' => $stmt->fetchAll()]);
}

if ($method === 'POST' && $action === 'award_points') {
    $user = raspina_require_permission('loyalty:award');
    raspina_require_same_origin();
    raspina_require_csrf();

    $body = raspina_read_json_body();
    $customerId = (string) ($body['customerId'] ?? '');
    $points = (int) ($body['points'] ?? 0);
    $reason = mb_substr(trim((string) ($body['reason'] ?? 'اعطای امتیاز کارشناس')), 0, 100);
    $requestId = (string) ($body['requestId'] ?? '');

    if (!preg_match('/^[a-f0-9-]{36}$/', $customerId)) {
        raspina_fail('invalid_customer', 'شناسه مشتری معتبر نیست.', 422);
    }
    if ($points <= 0 || $points > 10_000) {
        raspina_fail('invalid_points', 'مقدار امتیاز باید بین ۱ تا ۱۰,۰۰۰ باشد.', 422);
    }
    if (!preg_match('/^[A-Za-z0-9_-]{8,64}$/', $requestId)) {
        raspina_fail('request_id_required', 'شناسه یکتای درخواست (requestId) الزامی است.', 422);
    }

    $pdo = raspina_db();
    try {
        $pdo->beginTransaction();

        $accountStmt = $pdo->prepare(
            'SELECT id, points_balance FROM loyalty_accounts WHERE customer_id = :customer LIMIT 1 FOR UPDATE'
        );
        $accountStmt->execute([':customer' => $customerId]);
        $account = $accountStmt->fetch();

        if (!is_array($account)) {
            $pdo->rollBack();
            raspina_fail('account_not_found', 'حساب باشگاه این مشتری یافت نشد.', 404);
        }

        $idempotencyKey = 'api:award:' . $requestId;
        $txStmt = $pdo->prepare(
            'INSERT INTO loyalty_transactions
                (id, loyalty_account_id, tx_type, points_delta, idempotency_key)
             VALUES (:id, :account, :type, :points, :key)'
        );

        try {
            $txStmt->execute([
                ':id' => bin2hex(random_bytes(16)),
                ':account' => $account['id'],
                ':type' => 'earn_review',
                ':points' => $points,
                ':key' => $idempotencyKey,
            ]);
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                $pdo->rollBack();
                raspina_json(['ok' => true, 'duplicate' => true, 'pointsAdded' => 0]);
            }
            throw $e;
        }

        $update = $pdo->prepare(
            'UPDATE loyalty_accounts SET points_balance = points_balance + :points WHERE id = :id'
        );
        $update->execute([':points' => $points, ':id' => $account['id']]);

        raspina_audit(
            'اعطای ' . $points . ' امتیاز (' . $reason . ')',
            $customerId,
            (string) $user['role']
        );

        $pdo->commit();
        raspina_json([
            'ok' => true,
            'duplicate' => false,
            'pointsAdded' => $points,
            'pointsBalance' => (int) $account['points_balance'] + $points,
        ]);
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log('Raspina award points failed: ' . $e->getCode());
        raspina_fail('award_failed', 'ثبت امتیاز انجام نشد.', 500);
    }
}

raspina_fail('not_found', 'عملیات درخواستی وجود ندارد.', 404);
