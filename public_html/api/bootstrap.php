<?php
declare(strict_types=1);

/**
 * Raspina CRM shared bootstrap (PHP 8.2+, shared Linux hosting, no SSH required).
 * Every API entry point includes this file before doing any work.
 */

const RASPINA_MAX_JSON_BYTES = 2_097_152; // 2 MiB snapshot / webhook ceiling
const RASPINA_SESSION_NAME = 'RASPINA_SESSID';
const RASPINA_DUMMY_HASH = '$2y$10$usesomesillystringfore7hnbRJHxXVLeakoG8K30oukPsA.ztMG';

function raspina_config(): array
{
    static $config = null;
    if (is_array($config)) {
        return $config;
    }

    $path = __DIR__ . '/config.php';
    if (!is_file($path)) {
        raspina_fail('config_missing', 'config.php تنظیم نشده است.', 503);
    }

    $loaded = require $path;
    if (!is_array($loaded)) {
        raspina_fail('config_invalid', 'فایل تنظیمات معتبر نیست.', 503);
    }

    $config = $loaded;
    return $config;
}

function raspina_is_https(): bool
{
    if (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off') {
        return true;
    }
    return (string) ($_SERVER['SERVER_PORT'] ?? '') === '443';
}

function raspina_send_security_headers(): void
{
    if (headers_sent()) {
        return;
    }
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: no-referrer');
    header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
    header('Cross-Origin-Resource-Policy: same-origin');
    header('Cache-Control: no-store, max-age=0');
    header('Pragma: no-cache');
    header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    if (raspina_is_https()) {
        header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
    }
}

function raspina_json(array $payload, int $status = 200): never
{
    raspina_send_security_headers();
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    exit;
}

function raspina_fail(string $code, string $message, int $status): never
{
    raspina_json(['ok' => false, 'error' => ['code' => $code, 'message' => $message]], $status);
}

function raspina_read_json_body(): array
{
    $contentType = strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? ''));
    if (!str_contains($contentType, 'application/json')) {
        raspina_fail('unsupported_media_type', 'درخواست باید با Content-Type: application/json ارسال شود.', 415);
    }

    $length = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($length > RASPINA_MAX_JSON_BYTES) {
        raspina_fail('payload_too_large', 'حجم درخواست بیش از حد مجاز است.', 413);
    }

    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        raspina_fail('empty_body', 'بدنه درخواست خالی است.', 400);
    }
    if (strlen($raw) > RASPINA_MAX_JSON_BYTES) {
        raspina_fail('payload_too_large', 'حجم درخواست بیش از حد مجاز است.', 413);
    }

    try {
        $decoded = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
    } catch (JsonException $e) {
        raspina_fail('invalid_json', 'بدنه JSON معتبر نیست.', 400);
    }

    if (!is_array($decoded)) {
        raspina_fail('invalid_json', 'بدنه JSON باید یک شیء باشد.', 400);
    }
    return $decoded;
}

function raspina_require_method(string $method): void
{
    $actual = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    if ($actual !== strtoupper($method)) {
        header('Allow: ' . strtoupper($method));
        raspina_fail('method_not_allowed', 'متد درخواست مجاز نیست.', 405);
    }
}

function raspina_client_ip(): string
{
    // Only the direct peer address is trustworthy on shared hosting.
    return (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
}

/**
 * Sliding-window file rate limiter stored outside the web root of the API
 * and denied by .htaccess. Returns [allowed, retryAfterSeconds].
 */
function raspina_rate_limit(string $bucket, int $maxAttempts, int $windowSeconds): array
{
    $dir = dirname(__DIR__) . '/storage/ratelimit';
    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) {
        // Fail closed for authentication-related buckets.
        return [false, $windowSeconds];
    }

    $file = $dir . '/' . hash('sha256', $bucket . '|' . raspina_client_ip()) . '.json';
    $handle = @fopen($file, 'c+');
    if ($handle === false) {
        return [false, $windowSeconds];
    }

    try {
        if (!flock($handle, LOCK_EX)) {
            return [false, $windowSeconds];
        }
        $raw = stream_get_contents($handle);
        $timestamps = [];
        if (is_string($raw) && $raw !== '') {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                $timestamps = array_values(array_filter($decoded, 'is_int'));
            }
        }

        $now = time();
        $timestamps = array_values(array_filter(
            $timestamps,
            static fn (int $ts): bool => $ts > $now - $windowSeconds
        ));

        if (count($timestamps) >= $maxAttempts) {
            $retryAfter = max(1, $windowSeconds - ($now - min($timestamps)));
            return [false, $retryAfter];
        }

        $timestamps[] = $now;
        ftruncate($handle, 0);
        rewind($handle);
        fwrite($handle, json_encode($timestamps));
        fflush($handle);
        return [true, 0];
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}

function raspina_start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    session_name(RASPINA_SESSION_NAME);
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'domain' => '',
        'secure' => raspina_is_https(),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_start();
}

function raspina_csrf_token(): string
{
    if (empty($_SESSION['csrf_token']) || !is_string($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function raspina_session_user(): ?array
{
    $user = $_SESSION['user'] ?? null;
    if (!is_array($user) || empty($user['username']) || empty($user['role'])) {
        return null;
    }

    // Absolute 24h and idle 8h session limits.
    $loginAt = (int) ($user['login_at'] ?? 0);
    $lastSeen = (int) ($_SESSION['last_seen'] ?? 0);
    if (
        ($loginAt > 0 && time() - $loginAt > 86_400) ||
        ($lastSeen > 0 && time() - $lastSeen > 28_800)
    ) {
        unset($_SESSION['user']);
        return null;
    }

    // Re-check the account on every request so disabling a user or resetting a
    // password invalidates existing sessions immediately, not after 24 hours.
    try {
        $stmt = raspina_db()->prepare('SELECT is_active, session_version FROM users WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => (string) ($user['user_id'] ?? '')]);
        $row = $stmt->fetch();
    } catch (Throwable $e) {
        unset($_SESSION['user']);
        return null;
    }
    if (
        !is_array($row) ||
        (int) $row['is_active'] !== 1 ||
        (int) $row['session_version'] !== (int) ($user['session_version'] ?? 0)
    ) {
        unset($_SESSION['user']);
        return null;
    }

    $_SESSION['last_seen'] = time();
    return $user;
}

function raspina_require_auth(): array
{
    $user = raspina_session_user();
    if ($user === null) {
        raspina_fail('unauthenticated', 'برای انجام این عملیات باید وارد شوید.', 401);
    }
    return $user;
}

function raspina_require_csrf(): void
{
    $provided = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    $expected = (string) ($_SESSION['csrf_token'] ?? '');
    if ($expected === '' || $provided === '' || !hash_equals($expected, $provided)) {
        raspina_fail('csrf_invalid', 'توکن CSRF معتبر نیست؛ صفحه را دوباره بارگذاری کنید.', 403);
    }
}

function raspina_require_same_origin(): void
{
    $fetchSite = strtolower((string) ($_SERVER['HTTP_SEC_FETCH_SITE'] ?? ''));
    if ($fetchSite === 'cross-site') {
        raspina_fail('cross_origin_blocked', 'درخواست‌های بین‌سایتی مجاز نیستند.', 403);
    }

    $origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
    if ($origin === '') {
        return;
    }

    $originHost = parse_url($origin, PHP_URL_HOST);
    $host = (string) ($_SERVER['HTTP_HOST'] ?? '');
    $hostOnly = explode(':', $host)[0];
    if (!is_string($originHost) || strcasecmp($originHost, $hostOnly) !== 0) {
        raspina_fail('origin_mismatch', 'مبدأ درخواست مجاز نیست.', 403);
    }
}

/** Mirror of src/utils/permissions.ts — keep both matrices in sync. */
function raspina_role_permissions(): array
{
    $all = [
        'dashboard:view', 'customers:view', 'customers:create', 'customers:edit', 'segments:view',
        'followup:view', 'followup:complete', 'rma:view', 'rma:create', 'rma:advance',
        'loyalty:view', 'loyalty:award', 'loyalty:redeem', 'loyalty:giftcard',
        'support:view', 'support:create', 'support:advance',
        'campaign:view', 'campaign:create', 'campaign:toggle',
        'integrations:view', 'integrations:simulate', 'audit:view', 'users:manage',
    ];

    return [
        'ceo' => $all,
        'branch_manager' => [
            'dashboard:view', 'customers:view', 'customers:create', 'customers:edit', 'segments:view',
            'followup:view', 'followup:complete', 'rma:view', 'rma:create', 'rma:advance',
            'loyalty:view', 'support:view', 'support:create', 'support:advance', 'integrations:view',
        ],
        'marketing' => [
            'dashboard:view', 'customers:view', 'segments:view', 'loyalty:view', 'loyalty:giftcard',
            'campaign:view', 'campaign:create', 'campaign:toggle', 'support:view', 'integrations:view',
        ],
        'support' => [
            'dashboard:view', 'customers:view', 'customers:edit', 'followup:view', 'followup:complete',
            'rma:view', 'rma:create', 'rma:advance', 'loyalty:view', 'support:view', 'support:create',
            'support:advance', 'integrations:view',
        ],
        'sales' => [
            'dashboard:view', 'customers:view', 'customers:create', 'customers:edit', 'segments:view',
            'followup:view', 'followup:complete', 'rma:view', 'rma:create', 'loyalty:view',
            'integrations:view',
        ],
        'analyst' => [
            'dashboard:view', 'customers:view', 'segments:view', 'loyalty:view', 'support:view',
            'campaign:view', 'integrations:view', 'audit:view',
        ],
    ];
}

function raspina_has_permission(string $role, string $permission): bool
{
    $matrix = raspina_role_permissions();
    return isset($matrix[$role]) && in_array($permission, $matrix[$role], true);
}

function raspina_require_permission(string $permission): array
{
    $user = raspina_require_auth();
    if (!raspina_has_permission((string) $user['role'], $permission)) {
        raspina_fail('forbidden', 'نقش شما اجازه این عملیات را ندارد.', 403);
    }
    return $user;
}

function raspina_db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $config = raspina_config();
    try {
        $pdo = new PDO(
            sprintf(
                'mysql:host=%s;dbname=%s;charset=utf8mb4',
                (string) ($config['db_host'] ?? 'localhost'),
                (string) ($config['db_name'] ?? '')
            ),
            (string) ($config['db_user'] ?? ''),
            (string) ($config['db_pass'] ?? ''),
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::ATTR_STRINGIFY_FETCHES => false,
            ]
        );
    } catch (PDOException $e) {
        error_log('Raspina DB connection failed: ' . $e->getCode());
        raspina_fail('database_unavailable', 'اتصال به دیتابیس برقرار نشد.', 503);
    }

    return $pdo;
}

function raspina_audit(string $action, string $target, string $role = 'system'): void
{
    try {
        $stmt = raspina_db()->prepare(
            'INSERT INTO audit_logs (id, actor_role, action_text, target_ref) VALUES (:id, :role, :action, :target)'
        );
        $stmt->execute([
            ':id' => bin2hex(random_bytes(16)),
            ':role' => mb_substr($role, 0, 32),
            ':action' => mb_substr($action, 0, 255),
            ':target' => mb_substr($target, 0, 128),
        ]);
    } catch (Throwable $e) {
        error_log('Raspina audit write failed: ' . $e->getMessage());
    }
}

function raspina_normalize_phone(string $raw): string
{
    $digits = preg_replace('/[^0-9]/', '', $raw) ?? '';
    $national = $digits;
    if (str_starts_with($national, '0098')) {
        $national = substr($national, 4);
    } elseif (str_starts_with($national, '98')) {
        $national = substr($national, 2);
    } elseif (str_starts_with($national, '0')) {
        $national = substr($national, 1);
    }

    return preg_match('/^9\d{9}$/', $national) === 1 ? '+98' . $national : '';
}

function raspina_set_exception_handler(): void
{
    set_exception_handler(static function (Throwable $e): void {
        error_log('Raspina unhandled error: ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
        raspina_fail('server_error', 'خطای داخلی سرور رخ داد.', 500);
    });
}
