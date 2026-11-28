# استقرار روی هاست اشتراکی لینوکس — بدون SSH و بدون ترمینال

این راهنما برای cPanel / DirectAdmin با PHP 8.2، MySQL 8 یا MariaDB 10.6 نوشته شده است. همه فایل‌ها، از جمله API و SQL، داخل `public_html` قرار می‌گیرند و هیچ ابزار خط فرمانی روی هاست لازم نیست.

---

## ۰. پیش‌نیازها

- دامنه با SSL فعال (Let's Encrypt از داخل cPanel).
- PHP **8.2** با افزونه‌های `pdo_mysql`, `curl`, `mbstring`, `json`, `openssl`.
- یک دیتابیس MySQL و یک کاربر متصل به آن با دسترسی کامل روی همان دیتابیس.
- دسترسی File Manager و phpMyAdmin.
- `AllowOverride All` برای `.htaccess` (در هاست‌های اشتراکی معمولاً فعال است؛ اگر خطای 500 دیدید از پشتیبانی بپرسید).

---

## ۱. ساخت خروجی

روی سیستم خودتان (نه هاست):

```bash
npm ci
npm run verify       # typecheck + tests + build
```

پوشه `public_html/` شامل این موارد است:

```text
index.html
assets/
app-config.js
.htaccess
storage/.htaccess
api/*.php
sql/raspina_crm_schema.sql
```

اگر می‌خواهید بدون نصب Node این کار را انجام دهید، از خروجی آماده همین مخزن استفاده کنید. فایل `api/config.php` را **هرگز** داخل ZIP قرار ندهید.

---

## ۲. آپلود با File Manager

1. cPanel → **File Manager** → وارد `public_html` شوید.
2. فایل‌های قبلی سایت (در صورت وجود) را پاک یا به `backup-old/` منتقل کنید.
3. ZIP خروجی را آپلود کنید.
4. روی ZIP کلیک راست → **Extract**.
5. مطمئن شوید `index.html` مستقیماً داخل `public_html` است، نه داخل یک پوشه اضافه.
6. فایل ZIP را حذف کنید.

سطح دسترسی پیشنهادی:

| مورد | مقدار |
| --- | --- |
| پوشه‌ها | `755` |
| فایل‌های PHP/HTML/JS/CSS | `644` |
| `api/config.php` | `600` (یا `640`) |
| `storage/` | `755` |

---

## ۳. دیتابیس

1. cPanel → **MySQL Databases**:
   - دیتابیس بسازید، مثلاً `cpaneluser_raspina`.
   - کاربر بسازید، گذرواژه قوی بگذارید.
   - کاربر را با **All Privileges** به دیتابیس اضافه کنید.
2. cPanel → **phpMyAdmin** → دیتابیس را انتخاب کنید → تب **Import**.
3. فایل `sql/raspina_crm_schema.sql` را آپلود و اجرا کنید.
4. در تب **SQL** این کوئری را اجرا کنید تا مطمئن شوید جداول ساخته شده‌اند:

```sql
SELECT COUNT(*) AS tables_count
FROM information_schema.tables
WHERE table_schema = DATABASE();
```

باید حداقل ۱۶ جدول ببینید، از جمله `users`, `app_state`, `webhook_events`, `customers`, `loyalty_accounts`, `orders`.

> اسکریپت با `CREATE TABLE IF NOT EXISTS` نوشته شده و ایمپورت دوباره داده را پاک نمی‌کند؛ با این حال قبل از هر ایمپورت مجدد از دیتابیس Backup بگیرید.

---

## ۴. فایل تنظیمات

1. در File Manager وارد `public_html/api` شوید.
2. `config.example.php` را کپی کنید و نام کپی را `config.php` بگذارید.
3. فایل را با **Edit** باز کنید و مقادیر را پر کنید:

| کلید | توضیح |
| --- | --- |
| `db_host` | معمولاً `localhost` |
| `db_name` / `db_user` / `db_pass` | از بخش MySQL cPanel |
| `timezone` | `Asia/Tehran` |
| `setup_token` | رشته تصادفی حداقل ۲۴ نویسه؛ فقط برای راه‌اندازی اولیه |
| `webhook_hmac_secret` | کلید امضای وب‌هوک فروشگاه (۳۲+ نویسه) |
| `telegram_bot_token` | توکن BotFather |
| `telegram_webhook_secret` | رشته تصادفی ۳۲+ نویسه برای هدر امنیتی تلگرام |
| `instagram_app_secret` | App Secret از Meta |
| `instagram_verify_token` | رشته تصادفی برای تأیید وب‌هوک |
| `instagram_page_access_token` | توکن صفحه اینستاگرام حرفه‌ای |
| `instagram_page_id` | شناسه صفحه اینستاگرام |
| `ai_*` | اختیاری؛ ربات فعلی بدون AI و فقط با کاتالوگ تأییدشده پاسخ می‌دهد |

**تولید رمز امن بدون ترمینال:** از Password Manager خود (یا سایت‌های تولید رمز) رشته‌ای ۳۲ تا ۶۴ نویسه‌ای شامل حروف بزرگ/کوچک و رقم بسازید. از یک رمز برای چند سرویس استفاده نکنید.

نکته: `.htaccess` دسترسی وب به `config.php` و `config.example.php` را مسدود می‌کند؛ با این حال فایل را بعد از تنظیم حذف یا غیرقابل‌خواندن کنید.

---

## ۵. سخت‌سازی پیش از راه‌اندازی

1. `app-config.js` را باز کنید و حالت را روی production بگذارید:

```js
window.RASPINA_APP = {
  mode: 'server',
  apiBase: './api',
};
```

2. در `public/.htaccess` (همان `.htaccess` داخل `public_html`) بخش **Force HTTPS** را از حالت کامنت خارج کنید، بعد از اینکه SSL فعال شد.
3. اگر هاست از `.htaccess` پشتیبانی نمی‌کند، هدرهای امنیتی را از پنل (ModSecurity/Headers) تنظیم کنید.

---

## ۶. ساخت حساب مدیرعامل

1. آدرس `https://YOUR-DOMAIN/api/setup.php` را باز کنید.
2. توکن راه‌اندازی، نام کاربری، نام نمایشی و گذرواژه (حداقل ۱۲ نویسه شامل حرف و رقم) را وارد کنید.
3. پس از موفقیت، **فایل `api/setup.php` را حذف کنید**.
4. صفحه ورود `https://YOUR-DOMAIN/` را باز کنید و وارد شوید.

> نصب تازه با CRM **خالی** شروع می‌شود؛ داده‌های نمونه فقط در حالت نمایشی وجود دارند و هرگز روی دیتابیس واقعی نوشته نمی‌شوند. اولین مشتری را از بخش «مشتریان ۳۶۰» ثبت کنید.

اگر پیام «راه‌اندازی قبلاً انجام شده است» دیدید یعنی حساب مدیر وجود دارد؛ فایل setup را حذف کنید.

### ساخت کاربران تیم

با حساب مدیرعامل وارد شوید → **یکپارچه‌سازی و عملیات** → تب **مدیریت تیم و دسترسی‌ها**. می‌توانید کاربر بسازید، غیرفعال کنید و گذرواژه را بازنشانی کنید. هر تغییر در گزارش حسابرسی ثبت می‌شود.

> حساب خودتان را نمی‌توانید غیرفعال کنید. اگر آخرین مدیرعامل را غیرفعال کنید، برای بازیابی باید از phpMyAdmin مقدار `is_active` را دستی به ۱ برگردانید.

---

## ۷. وب‌هوک سفارش سه وب‌سایت

آدرس: `https://YOUR-DOMAIN/api/crm-sync.php` (فقط `POST`، `Content-Type: application/json`).

هدرهای الزامی:

| هدر | مقدار |
| --- | --- |
| `X-Raspina-Timestamp` | زمان یونیکس (ثانیه)؛ حداکثر ۵ دقیقه اختلاف |
| `X-Raspina-Nonce` | رشته تصادفی ۱۶ تا ۶۴ نویسه؛ هر بار جدید |
| `X-Raspina-Signature` | `hash_hmac('sha256', timestamp + "\n" + rawBody, webhook_hmac_secret)` به صورت hex |

نمونه PHP روی سرور فروشگاه:

```php
<?php
$secret = getenv('RASPINA_WEBHOOK_SECRET'); // همان webhook_hmac_secret
$body = json_encode($order, JSON_UNESCAPED_UNICODE);
$ts = (string) time();
$nonce = bin2hex(random_bytes(16));
$signature = hash_hmac('sha256', $ts . "\n" . $body, $secret);

$ch = curl_init('https://YOUR-DOMAIN/api/crm-sync.php');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $body,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'X-Raspina-Timestamp: ' . $ts,
        'X-Raspina-Nonce: ' . $nonce,
        'X-Raspina-Signature: ' . $signature,
    ],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 10,
]);
$response = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
curl_close($ch);
```

بدنه نمونه:

```json
{
  "externalOrderId": "RS-14050412-8842",
  "sourceSite": "raspinaclothing",
  "totalToman": 3450000,
  "itemsSummary": "مانتو عبایی کرپ حریر مشکی",
  "attributionChannel": "instagram_dm",
  "customer": {
    "phone": "09355544332",
    "fullName": "هلیا کریمی",
    "city": "تهران"
  }
}
```

پاسخ‌ها:

- `200` با `duplicate: false` → سفارش ثبت شد.
- `200` با `duplicate: true` → همان سفارش یا nonce قبلاً ثبت شده؛ امتیاز دوباره داده نمی‌شود.
- `401` → امضا/زمان نامعتبر.
- `422` → داده ناقص (موبایل، مبلغ، سایت).
- `429` → نرخ درخواست بالا.

سایت‌های مجاز: `raspinashop`, `raspinaclothing`, `raspinaclothes`, `pos_hamedan`, `pos_tehran`.
کانال‌های انتساب مجاز: `instagram_dm`, `telegram_bot`, `direct_web`, `store_walkin`.

---

## ۸. ربات تلگرام

1. در BotFather توکن بگیرید و در `config.php` بگذارید.
2. یک `telegram_webhook_secret` تصادفی بسازید.
3. آدرس زیر را در مرورگر باز کنید (توکن را در جای امن نگه دارید):

```text
https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://YOUR-DOMAIN/api/telegram-webhook.php&secret_token=<TELEGRAM_WEBHOOK_SECRET>
```

4. بررسی وضعیت:

```text
https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo
```

باید `last_error_message` خالی و آدرس درست باشد. سپس در تلگرام `/start` بفرستید؛ دسته‌بندی‌ها از جدول `products_catalog` خوانده می‌شوند و لینک خرید با `utm_source=telegram_bot` ساخته می‌شود.

---

## ۹. اینستاگرام (Meta)

1. در [Meta for Developers](https://developers.facebook.com/) یک App از نوع Business بسازید و محصول **Instagram** را اضافه کنید.
2. Callback URL: `https://YOUR-DOMAIN/api/instagram-webhook.php`
3. Verify Token: همان `instagram_verify_token` در `config.php`.
4. اشتراک فیلد `messages` را فعال کنید.
5. App Secret را در `instagram_app_secret` و توکن صفحه حرفه‌ای را در `instagram_page_access_token` بگذارید.
6. پیام تست به دایرکت بفرستید. ربات فقط وقتی پاسخ می‌دهد که محصول از طریق `instagram_media_id` یا دسته‌بندی صریح (شومیز/مانتو/شلوار/ست) در کاتالوگ تأیید شود؛ در غیر این صورت درخواست شفاف‌سازی می‌فرستد و هیچ قیمتی از خود نمی‌سازد.

برای دریافت پیام‌ها، صفحه اینستاگرام باید Professional و متصل به همین App باشد.

---

## ۱۰. Cron گزارش روزانه

cPanel → **Cron Jobs** → افزودن:

```text
0 8 * * * /usr/local/bin/php /home/CPANEL_USER/public_html/api/cron-daily-report.php
```

- مسیر PHP را از پشتیبانی هاست بپرسید؛ ممکن است `/usr/bin/php` یا نسخه‌دار باشد.
- اسکریپت فقط از CLI اجرا می‌شود و در مرورگر ۴۰۳ می‌دهد.
- خروجی گزارش در ایمیل cron یا لاگ هاست دیده می‌شود.
- این کار nonceهای قدیمی‌تر از ۳۰ روز را هم پاک می‌کند.

---

## ۱۱. چک‌لیست امنیتی نهایی

- [ ] SSL فعال و ریدایرکت HTTPS روشن است.
- [ ] `api/setup.php` حذف شده است.
- [ ] `api/config.php` فقط شامل مقادیر واقعی است و دسترسی آن ۶۰۰/۶۴۰ است.
- [ ] `app-config.js` روی `mode: 'server'` است.
- [ ] فایل ZIP و نسخه‌های پشتیبان قدیمی داخل `public_html` نیستند.
- [ ] `public_html/storage` از وب قابل دسترسی نیست (تست: `/storage/ratelimit/` باید ۴۰۳ بدهد).
- [ ] `public_html/sql/` از وب قابل دسترسی نیست.
- [ ] `api/config.php` از وب ۴۰۳ می‌دهد.
- [ ] ورود با گذرواژه اشتباه ۵ بار → قفل موقت.
- [ ] ذخیره یک مشتری و رفرش صفحه → داده از سرور بازمی‌گردد.
- [ ] کاربر غیرمدیرعامل به تب مدیریت تیم دسترسی ندارد.
- [ ] غیرفعال کردن یک کاربر یا بازنشانی گذرواژه، نشست فعال او را فوراً باطل می‌کند (session_version).
- [ ] وب‌هوک با امضای غلط ۴۰۱ می‌دهد و با امضای درست ۲۰۰.
- [ ] ارسال دوباره همان `externalOrderId` امتیاز دوباره نمی‌دهد.
- [ ] Backup روزانه دیتابیس در cPanel فعال است.
- [ ] لاگ خطاهای PHP بررسی شده و هیچ مسیر/توکنی در آن نیست.

---

## ۱۲. عیب‌یابی

| نشانه | علت احتمالی | راه‌حل |
| --- | --- | --- |
| خطای 500 | نسخه PHP یا `.htaccess` | PHP را روی 8.2 بگذارید؛ `error_log` را ببینید؛ `AllowOverride` را بررسی کنید |
| صفحه سفید | asset اشتباه | مطمئن شوید `assets/` کنار `index.html` است و `base` نسبی است |
| «اتصال به سرور برقرار نشد» | API نصب/تنظیم نشده | `api/config.php` و دسترسی دیتابیس را بررسی کنید؛ `curl https://DOMAIN/api/auth.php?action=session` باید JSON بدهد |
| ۴۰۳ روی `setup.php` | توکن تنظیم نشده | `setup_token` را در `config.php` بگذارید |
| ۴۱۹ هنگام ذخیره | CSRF منقضی | صفحه را رفرش و دوباره وارد شوید |
| ۴۰۹ هنگام ذخیره | نسخه state قدیمی | رفرش صفحه؛ نسخه سرور ملاک است |
| ۴۲۹ | rate limit | چند دقیقه صبر کنید |
| ربات تلگرام ساکت | وب‌هوک/توکن | `getWebhookInfo` و `telegram_webhook_secret` را بررسی کنید |
| اینستاگرام پاسخ نمی‌دهد | امضا/توکن صفحه | App Secret، توکن صفحه و اشتراک `messages` را بررسی کنید |

---

## ۱۳. نگهداری

- هر ۹۰ روز کلیدهای وب‌هوک و توکن ربات را بچرخانید.
- قبل از هر به‌روزرسانی، از `public_html` و دیتابیس Backup بگیرید.
- `audit_logs` را دوره‌ای آرشیو کنید (نگهداری حداقل ۶ ماه توصیه می‌شود).
- پس از هر تغییر بزرگ، `npm run verify` را روی سیستم خودتان اجرا و خروجی جدید را آپلود کنید.
