<?php
declare(strict_types=1);

/**
 * Raspina daily/weekly Instagram & CRM report.
 * Schedule in cPanel/DirectAdmin → Cron Jobs (no SSH required):
 *   0 8 * * * php /home/USER/public_html/api/cron-daily-report.php
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("CLI only\n");
}

require __DIR__ . '/bootstrap.php';

try {
    $config = raspina_config();
    date_default_timezone_set((string) ($config['timezone'] ?? 'Asia/Tehran'));
    $pdo = raspina_db();
} catch (Throwable $e) {
    fwrite(STDERR, "Raspina cron aborted: configuration/database unavailable\n");
    exit(1);
}

$today = date('Y-m-d');
$weekStart = date('Y-m-d', strtotime('-6 days'));

try {
    // Retention: replay-protection nonces are only useful for the ±5 minute window.
    $pdo->exec('DELETE FROM webhook_events WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)');

    $dailyStmt = $pdo->prepare(
        "SELECT COALESCE(SUM(total_toman), 0) AS revenue, COUNT(*) AS orders
         FROM orders
         WHERE attribution_channel = 'instagram_dm' AND DATE(ordered_at) = :day"
    );
    $dailyStmt->execute([':day' => $today]);
    $daily = $dailyStmt->fetch() ?: ['revenue' => 0, 'orders' => 0];

    $weeklyStmt = $pdo->prepare(
        "SELECT COALESCE(SUM(total_toman), 0) AS revenue, COUNT(*) AS orders
         FROM orders
         WHERE attribution_channel = 'instagram_dm' AND DATE(ordered_at) BETWEEN :start AND :today"
    );
    $weeklyStmt->execute([':start' => $weekStart, ':today' => $today]);
    $weekly = $weeklyStmt->fetch() ?: ['revenue' => 0, 'orders' => 0];

    $newCustomersStmt = $pdo->prepare(
        'SELECT COUNT(*) FROM customers WHERE DATE(created_at) = :day'
    );
    $newCustomersStmt->execute([':day' => $today]);
    $newCustomers = (int) $newCustomersStmt->fetchColumn();

    $pointsStmt = $pdo->prepare(
        "SELECT COALESCE(SUM(points_delta), 0) FROM loyalty_transactions
         WHERE points_delta > 0 AND DATE(created_at) = :day"
    );
    $pointsStmt->execute([':day' => $today]);
    $pointsIssued = (int) $pointsStmt->fetchColumn();

    $pendingFollowUpsStmt = $pdo->prepare(
        "SELECT COUNT(*) FROM follow_up_tasks WHERE status = 'pending' AND scheduled_for <= NOW()"
    );
    $pendingFollowUpsStmt->execute();
    $pendingFollowUps = (int) $pendingFollowUpsStmt->fetchColumn();

    $summary = [
        'date' => $today,
        'instagram' => [
            'sales_toman' => (int) $daily['revenue'],
            'orders' => (int) $daily['orders'],
            'week_sales_toman' => (int) $weekly['revenue'],
            'week_orders' => (int) $weekly['orders'],
        ],
        'crm' => [
            'new_customers' => $newCustomers,
            'points_issued' => $pointsIssued,
            'overdue_follow_ups' => $pendingFollowUps,
        ],
    ];

    // Persist the snapshot for the analytics dashboard; follower metrics are filled by the
    // Instagram Insights sync job when configured, otherwise preserved from the last run.
    $upsert = $pdo->prepare(
        'INSERT INTO instagram_daily_metrics
            (id, metric_date, followers_gained, followers_lost, reach_and_views, dm_inbound_count,
             avg_bot_reply_ms, ig_attributed_sales_toman, ai_specialist_summary)
         VALUES
            (:id, :day, 0, 0, 0, 0, 0, :sales, :summary)
         ON DUPLICATE KEY UPDATE
            ig_attributed_sales_toman = VALUES(ig_attributed_sales_toman),
            ai_specialist_summary = VALUES(ai_specialist_summary)'
    );
    $upsert->execute([
        ':id' => bin2hex(random_bytes(16)),
        ':day' => $today,
        ':sales' => (int) $daily['revenue'],
        ':summary' => json_encode($summary, JSON_UNESCAPED_UNICODE),
    ]);

    $report = sprintf(
        "Raspina CRM report %s\nInstagram sales today: %s Toman (%d orders)\nInstagram sales last 7 days: %s Toman (%d orders)\nNew customers: %d\nPoints issued: %d\nOverdue follow-ups: %d\n",
        $today,
        number_format((int) $daily['revenue']),
        (int) $daily['orders'],
        number_format((int) $weekly['revenue']),
        (int) $weekly['orders'],
        $newCustomers,
        $pointsIssued,
        $pendingFollowUps
    );

    echo $report;
    exit(0);
} catch (Throwable $e) {
    error_log('Raspina cron failed: ' . $e->getMessage());
    fwrite(STDERR, "Raspina cron failed; see server error log\n");
    exit(1);
}
