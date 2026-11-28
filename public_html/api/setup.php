<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
raspina_set_exception_handler();
raspina_send_security_headers();
header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");

function h(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function render_page(string $title, string $body): never
{
    header('Content-Type: text/html; charset=utf-8');
    echo '<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="utf-8">';
    echo '<meta name="viewport" content="width=device-width, initial-scale=1">';
    echo '<meta name="robots" content="noindex, nofollow">';
    echo '<title>' . h($title) . '</title><style>
    body{font-family:Tahoma,Arial,sans-serif;background:#f7f6f2;color:#171a26;margin:0;padding:32px 16px;line-height:1.8}
    .card{max-width:520px;margin:0 auto;background:#fff;border:1px solid #e5dfd3;border-radius:16px;padding:24px}
    h1{font-size:18px;margin:0 0 8px} p{font-size:13px;color:#52586c}
    label{display:block;font-size:12px;font-weight:bold;margin:14px 0 4px}
    input{width:100%;box-sizing:border-box;padding:10px;border:1px solid #e5dfd3;border-radius:8px;background:#f7f6f2;font-family:inherit}
    button{margin-top:18px;width:100%;padding:11px;border:0;border-radius:8px;background:#14192b;color:#fff;font-weight:bold;cursor:pointer}
    .err{background:#fef2f2;border:1px solid #fca5a5;color:#991b1b;padding:10px;border-radius:8px;font-size:12px}
    .ok{background:#f0fdf4;border:1px solid #86efac;color:#166534;padding:10px;border-radius:8px;font-size:12px}
    code{background:#f1f5f9;padding:2px 5px;border-radius:4px;font-size:12px}
    .muted{font-size:11px;color:#6b7280}
    </style></head><body><div class="card">' . $body . '</div></body></html>';
    exit;
}

$config = raspina_config();
$setupToken = (string) ($config['setup_token'] ?? '');

if ($setupToken === '' || strlen($setupToken) < 24) {
    render_page('راه‌اندازی غیرفعال است', '<h1>راه‌اندازی غیرفعال است</h1><p class="err">ابتدا در <code>api/config.php</code> مقدار <code>setup_token</code> را با یک رشته تصادفی حداقل ۲۴ نویسه تنظیم کنید.</p>');
}

try {
    $count = (int) raspina_db()->query('SELECT COUNT(*) FROM users')->fetchColumn();
} catch (PDOException $e) {
    render_page('دیتابیس آماده نیست', '<h1>دیتابیس آماده نیست</h1><p class="err">جدول <code>users</code> وجود ندارد. ابتدا فایل <code>sql/raspina_crm_schema.sql</code> را در phpMyAdmin ایمپورت کنید.</p>');
}

if ($count > 0) {
    render_page('راه‌اندازی انجام شده است', '<h1>راه‌اندازی قبلاً انجام شده است</h1><p class="ok">حساب مدیر از قبل ساخته شده. برای امنیت بیشتر فایل <code>api/setup.php</code> را از هاست حذف کنید و از صفحه ورود استفاده کنید.</p>');
}

$error = '';
$success = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    raspina_require_same_origin();
    [$allowed] = raspina_rate_limit('setup', 5, 900);
    if (!$allowed) {
        $error = 'تلاش‌های ناموفق بیش از حد مجاز است؛ ۱۵ دقیقه بعد دوباره تلاش کنید.';
    } else {
        $providedToken = (string) ($_POST['setup_token'] ?? '');
        $username = strtolower(trim((string) ($_POST['username'] ?? '')));
        $displayName = trim((string) ($_POST['display_name'] ?? ''));
        $password = (string) ($_POST['password'] ?? '');
        $confirm = (string) ($_POST['password_confirm'] ?? '');

        if (!hash_equals($setupToken, $providedToken)) {
            $error = 'توکن راه‌اندازی نادرست است.';
        } elseif (!preg_match('/^[a-z0-9._-]{4,60}$/', $username)) {
            $error = 'نام کاربری باید ۴ تا ۶۰ نویسه لاتین (حروف، رقم، نقطه، خط تیره، زیرخط) باشد.';
        } elseif (strlen($displayName) < 3 || strlen($displayName) > 120) {
            $error = 'نام نمایشی باید بین ۳ تا ۱۲۰ نویسه باشد.';
        } elseif (strlen($password) < 12 || strlen($password) > 200 || !preg_match('/[A-Za-z]/', $password) || !preg_match('/\d/', $password)) {
            $error = 'گذرواژه باید حداقل ۱۲ نویسه و شامل حرف و رقم باشد.';
        } elseif (!hash_equals($password, $confirm)) {
            $error = 'گذرواژه و تکرار آن یکسان نیستند.';
        } else {
            try {
                $stmt = raspina_db()->prepare(
                    'INSERT INTO users (id, username, display_name, password_hash, role, is_active)
                     VALUES (:id, :username, :display_name, :password_hash, :role, 1)'
                );
                $stmt->execute([
                    ':id' => bin2hex(random_bytes(16)),
                    ':username' => $username,
                    ':display_name' => $displayName,
                    ':password_hash' => password_hash($password, PASSWORD_DEFAULT),
                    ':role' => 'ceo',
                ]);
                raspina_audit('ایجاد نخستین حساب مدیر', $username, 'ceo');
                $success = 'حساب مدیرعامل ساخته شد. اکنون فایل <code>api/setup.php</code> را از هاست حذف کنید و وارد پنل شوید.';
            } catch (PDOException $e) {
                error_log('Raspina setup insert failed: ' . $e->getCode());
                $error = 'ساخت حساب انجام نشد؛ ممکن است نام کاربری تکراری باشد.';
            }
        }
    }
}

$body = '<h1>راه‌اندازی اولیه CRM راسپینا</h1>';
$body .= '<p>این صفحه فقط یک‌بار و برای ساخت حساب مدیرعامل استفاده می‌شود. توکن راه‌اندازی را از <code>api/config.php</code> بردارید.</p>';
if ($error !== '') {
    $body .= '<p class="err">' . $error . '</p>';
}
if ($success !== '') {
    $body .= '<p class="ok">' . $success . '</p>';
} else {
    $body .= '<form method="post" action="setup.php" autocomplete="off">';
    $body .= '<label for="setup_token">توکن راه‌اندازی</label><input id="setup_token" name="setup_token" type="password" required minlength="24" maxlength="200" dir="ltr">';
    $body .= '<label for="username">نام کاربری مدیر</label><input id="username" name="username" type="text" required pattern="[a-z0-9._-]{4,60}" maxlength="60" dir="ltr" value="admin">';
    $body .= '<label for="display_name">نام و نام خانوادگی</label><input id="display_name" name="display_name" type="text" required maxlength="120">';
    $body .= '<label for="password">گذرواژه (حداقل ۱۲ نویسه، حرف و رقم)</label><input id="password" name="password" type="password" required minlength="12" maxlength="200" dir="ltr">';
    $body .= '<label for="password_confirm">تکرار گذرواژه</label><input id="password_confirm" name="password_confirm" type="password" required minlength="12" maxlength="200" dir="ltr">';
    $body .= '<button type="submit">ساخت حساب مدیرعامل</button>';
    $body .= '</form>';
    $body .= '<p class="muted">پس از ساخت حساب، این فایل را حذف کنید. نقش حساب اولیه «مدیرعامل» است و می‌تواند از داخل پنل، نقش‌های دیگر را تعریف کند.</p>';
}

render_page('راه‌اندازی CRM راسپینا', $body);
