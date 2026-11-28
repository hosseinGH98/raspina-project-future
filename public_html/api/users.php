<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
raspina_set_exception_handler();
raspina_send_security_headers();
raspina_start_session();

$user = raspina_require_permission('users:manage');
$pdo = raspina_db();
$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

function raspina_public_user(array $row): array
{
    return [
        'id' => $row['id'],
        'username' => $row['username'],
        'displayName' => $row['display_name'],
        'role' => $row['role'],
        'isActive' => (int) $row['is_active'] === 1,
        'lastLoginAt' => $row['last_login_at'],
    ];
}

if ($method === 'GET') {
    $rows = $pdo->query(
        'SELECT id, username, display_name, role, is_active, last_login_at FROM users ORDER BY created_at ASC LIMIT 200'
    )->fetchAll();
    raspina_json(['ok' => true, 'users' => array_map('raspina_public_user', $rows)]);
}

if ($method !== 'POST') {
    header('Allow: GET, POST');
    raspina_fail('method_not_allowed', 'متد درخواست مجاز نیست.', 405);
}

raspina_require_same_origin();
raspina_require_csrf();

$action = (string) ($_GET['action'] ?? '');
$body = raspina_read_json_body();
$validRoles = array_keys(raspina_role_permissions());

if ($action === 'create') {
    [$allowed] = raspina_rate_limit('users_create', 20, 3600);
    if (!$allowed) {
        raspina_fail('rate_limited', 'تعداد ساخت حساب در ساعت بیش از حد مجاز است.', 429);
    }

    $username = strtolower(trim((string) ($body['username'] ?? '')));
    $displayName = trim((string) ($body['displayName'] ?? ''));
    $role = (string) ($body['role'] ?? '');
    $password = (string) ($body['password'] ?? '');

    if (!preg_match('/^[a-z0-9._-]{4,60}$/', $username)) {
        raspina_fail('invalid_username', 'نام کاربری باید ۴ تا ۶۰ نویسه لاتین باشد.', 422);
    }
    if (mb_strlen($displayName) < 3 || mb_strlen($displayName) > 120) {
        raspina_fail('invalid_display_name', 'نام نمایشی باید بین ۳ تا ۱۲۰ نویسه باشد.', 422);
    }
    if (!in_array($role, $validRoles, true)) {
        raspina_fail('invalid_role', 'نقش انتخاب‌شده معتبر نیست.', 422);
    }
    if (
        strlen($password) < 12 || strlen($password) > 200 ||
        !preg_match('/[A-Za-z]/', $password) || !preg_match('/\d/', $password)
    ) {
        raspina_fail('weak_password', 'گذرواژه باید حداقل ۱۲ نویسه و شامل حرف و رقم باشد.', 422);
    }

    try {
        $stmt = $pdo->prepare(
            'INSERT INTO users (id, username, display_name, password_hash, role, is_active)
             VALUES (:id, :username, :display_name, :hash, :role, 1)'
        );
        $stmt->execute([
            ':id' => bin2hex(random_bytes(16)),
            ':username' => $username,
            ':display_name' => $displayName,
            ':hash' => password_hash($password, PASSWORD_DEFAULT),
            ':role' => $role,
        ]);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {
            raspina_fail('username_taken', 'این نام کاربری قبلاً ثبت شده است.', 409);
        }
        throw $e;
    }

    raspina_audit('ایجاد حساب کاربری ' . $username . ' با نقش ' . $role, $username, (string) $user['role']);
    raspina_json(['ok' => true]);
}

if ($action === 'toggle') {
    $targetId = (string) ($body['userId'] ?? '');
    $isActive = (bool) ($body['isActive'] ?? false);
    if (!preg_match('/^[a-f0-9-]{36}$/', $targetId)) {
        raspina_fail('invalid_user', 'شناسه کاربر معتبر نیست.', 422);
    }
    if ($targetId === (string) $user['user_id']) {
        raspina_fail('self_lockout', 'غیرفعال کردن حساب خودتان مجاز نیست.', 422);
    }

    $exists = $pdo->prepare('SELECT id FROM users WHERE id = :id LIMIT 1');
    $exists->execute([':id' => $targetId]);
    if ($exists->fetchColumn() === false) {
        raspina_fail('user_not_found', 'کاربر یافت نشد.', 404);
    }

    $stmt = $pdo->prepare(
        'UPDATE users
         SET is_active = :active, session_version = session_version + 1,
             failed_attempts = 0, locked_until = NULL
         WHERE id = :id'
    );
    $stmt->execute([':active' => $isActive ? 1 : 0, ':id' => $targetId]);

    raspina_audit($isActive ? 'فعال‌سازی حساب کاربری' : 'غیرفعال‌سازی حساب کاربری', $targetId, (string) $user['role']);
    raspina_json(['ok' => true]);
}

if ($action === 'reset_password') {
    $targetId = (string) ($body['userId'] ?? '');
    $password = (string) ($body['password'] ?? '');
    if (!preg_match('/^[a-f0-9-]{36}$/', $targetId)) {
        raspina_fail('invalid_user', 'شناسه کاربر معتبر نیست.', 422);
    }
    if (
        strlen($password) < 12 || strlen($password) > 200 ||
        !preg_match('/[A-Za-z]/', $password) || !preg_match('/\d/', $password)
    ) {
        raspina_fail('weak_password', 'گذرواژه باید حداقل ۱۲ نویسه و شامل حرف و رقم باشد.', 422);
    }

    $stmt = $pdo->prepare(
        'UPDATE users
         SET password_hash = :hash, session_version = session_version + 1,
             failed_attempts = 0, locked_until = NULL
         WHERE id = :id'
    );
    $stmt->execute([':hash' => password_hash($password, PASSWORD_DEFAULT), ':id' => $targetId]);
    if ($stmt->rowCount() === 0) {
        raspina_fail('user_not_found', 'کاربر یافت نشد.', 404);
    }

    raspina_audit('بازنشانی گذرواژه کاربر', $targetId, (string) $user['role']);
    raspina_json(['ok' => true]);
}

raspina_fail('not_found', 'عملیات درخواستی وجود ندارد.', 404);
