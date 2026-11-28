<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
raspina_set_exception_handler();
raspina_send_security_headers();
raspina_start_session();

$action = (string) ($_GET['action'] ?? '');

if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'session') {
    $user = raspina_session_user();
    if ($user === null) {
        raspina_fail('unauthenticated', 'نشست فعالی وجود ندارد.', 401);
    }
    raspina_json([
        'ok' => true,
        'user' => [
            'username' => $user['username'],
            'displayName' => $user['display_name'] ?? $user['username'],
            'role' => $user['role'],
            'csrfToken' => raspina_csrf_token(),
        ],
    ]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'login') {
    raspina_require_same_origin();

    [$allowed, $retryAfter] = raspina_rate_limit('login', 10, 900);
    if (!$allowed) {
        header('Retry-After: ' . $retryAfter);
        raspina_fail('rate_limited', 'تلاش‌های ورود بیش از حد مجاز است؛ چند دقیقه بعد دوباره تلاش کنید.', 429);
    }

    $body = raspina_read_json_body();
    $username = strtolower(trim((string) ($body['username'] ?? '')));
    $password = (string) ($body['password'] ?? '');

    if (!preg_match('/^[a-z0-9._-]{4,60}$/', $username) || $password === '' || strlen($password) > 200) {
        raspina_fail('invalid_credentials', 'نام کاربری یا گذرواژه نادرست است.', 401);
    }

    try {
        $stmt = raspina_db()->prepare(
            'SELECT id, username, display_name, password_hash, role, is_active, session_version, failed_attempts, locked_until
             FROM users WHERE username = :username LIMIT 1'
        );
        $stmt->execute([':username' => $username]);
        $user = $stmt->fetch();
    } catch (PDOException $e) {
        error_log('Raspina auth query failed: ' . $e->getCode());
        raspina_fail('setup_required', 'جدول کاربران آماده نیست؛ ابتدا api/setup.php را اجرا کنید.', 503);
    }

    if (!is_array($user)) {
        // Perform a dummy verification to keep timing uniform for unknown users.
        password_verify($password, RASPINA_DUMMY_HASH);
        raspina_fail('invalid_credentials', 'نام کاربری یا گذرواژه نادرست است.', 401);
    }

    $lockedUntil = $user['locked_until'] !== null ? strtotime((string) $user['locked_until']) : 0;
    if ($lockedUntil !== 0 && $lockedUntil <= time()) {
        // Expired lock: give the account a fresh set of attempts.
        $clear = raspina_db()->prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = :id');
        $clear->execute([':id' => $user['id']]);
        $user['failed_attempts'] = 0;
        $lockedUntil = 0;
    }
    if ((int) $user['is_active'] !== 1 || $lockedUntil > time()) {
        raspina_fail('account_locked', 'حساب موقتاً قفل است یا غیرفعال شده؛ با مدیر سیستم تماس بگیرید.', 423);
    }

    if (!password_verify($password, (string) $user['password_hash'])) {
        $attempts = (int) $user['failed_attempts'] + 1;
        $lockSql = $attempts >= 5 ? ', locked_until = DATE_ADD(NOW(), INTERVAL 15 MINUTE)' : '';
        $update = raspina_db()->prepare(
            'UPDATE users SET failed_attempts = :attempts' . $lockSql . ' WHERE id = :id'
        );
        $update->execute([':attempts' => $attempts, ':id' => $user['id']]);
        raspina_audit('تلاش ناموفق ورود', $username);
        raspina_fail('invalid_credentials', 'نام کاربری یا گذرواژه نادرست است.', 401);
    }

    if (password_needs_rehash((string) $user['password_hash'], PASSWORD_DEFAULT)) {
        $rehash = raspina_db()->prepare('UPDATE users SET password_hash = :hash WHERE id = :id');
        $rehash->execute([
            ':hash' => password_hash($password, PASSWORD_DEFAULT),
            ':id' => $user['id'],
        ]);
    }

    $reset = raspina_db()->prepare(
        'UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE id = :id'
    );
    $reset->execute([':id' => $user['id']]);

    session_regenerate_id(true);
    $_SESSION['user'] = [
        'user_id' => $user['id'],
        'username' => $user['username'],
        'display_name' => $user['display_name'] ?: $user['username'],
        'role' => $user['role'],
        'session_version' => (int) $user['session_version'],
        'login_at' => time(),
    ];
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    $_SESSION['last_seen'] = time();

    raspina_audit('ورود موفق به پنل', $username, (string) $user['role']);

    raspina_json([
        'ok' => true,
        'user' => [
            'username' => $user['username'],
            'displayName' => $user['display_name'] ?: $user['username'],
            'role' => $user['role'],
            'csrfToken' => $_SESSION['csrf_token'],
        ],
    ]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'logout') {
    raspina_require_same_origin();
    $user = raspina_session_user();
    if ($user !== null) {
        raspina_require_csrf();
        raspina_audit('خروج از پنل', $user['username'], (string) $user['role']);
    }

    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires' => time() - 42000,
            'path' => $params['path'],
            'domain' => $params['domain'],
            'secure' => $params['secure'],
            'httponly' => $params['httponly'],
            'samesite' => $params['samesite'] ?? 'Lax',
        ]);
    }
    session_destroy();
    raspina_json(['ok' => true]);
}

raspina_fail('not_found', 'عملیات درخواستی وجود ندارد.', 404);
