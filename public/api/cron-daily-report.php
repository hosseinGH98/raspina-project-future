<?php
// Raspina Daily & Weekly Instagram Specialist Report Cron Job
// Schedule via cPanel/DirectAdmin Cron Jobs UI (No SSH required): 0 22 * * * php /home/USER/public_html/api/cron-daily-report.php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('CLI Cron only');
}

$configPath = __DIR__ . '/config.php';
if (!file_exists($configPath)) {
    exit("config.php missing\n");
}

$config = require $configPath;
$pdo = new PDO(
    sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $config['db_host'], $config['db_name']),
    $config['db_user'],
    $config['db_pass'],
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
);

$today = date('Y-m-d');
$salesStmt = $pdo->prepare(
    "SELECT COALESCE(SUM(total_toman), 0) FROM orders WHERE attribution_channel = 'instagram_dm' AND DATE(ordered_at) = :d"
);
$salesStmt->execute([':d' => $today]);
$igSalesToday = (int) $salesStmt->fetchColumn();

echo sprintf("Daily Raspina Instagram Report [%s] - Attributed Sales: %s Toman\n", $today, number_format($igSalesToday));
