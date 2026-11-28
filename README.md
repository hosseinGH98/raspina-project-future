# CRM و باشگاه مشتریان راسپینا

پنل یکپارچه CRM ۳۶۰ درجه، باشگاه وفاداری چهارسطحی، پیگیری پس از خرید، تیکتینگ با SLA، کمپین‌های هوشمند و اتصال سه وب‌سایت فروشگاهی — همراه با APIهای PHP و ربات تلگرام/اینستاگرام.

- **فرانت‌اند:** React 19 + TypeScript + Tailwind CSS 4 (Vite)
- **بک‌اند:** PHP 8.2 بدون فریم‌ورک + MySQL 8 / MariaDB 10.6
- **میزبانی:** هاست اشتراکی لینوکس (cPanel/DirectAdmin) **بدون SSH و بدون ترمینال**
- **خروجی استقرار:** تمام فایل‌ها، از جمله API و SQL، داخل `public_html/`

## ساختار پروژه

```text
src/                     کد React (منطق دامنه، مجوزها، اعتبارسنجی، state)
public/api/              APIهای PHP (فقط از این مسیر به وب سرو می‌شوند)
public/sql/              اسکریپت کامل دیتابیس برای phpMyAdmin
public/.htaccess         هدرهای امنیتی، مسیریابی SPA، مسدودسازی فایل‌های حساس
public/app-config.js     تنظیم حالت اجرا (auto / server / demo)
public/storage/          وضعیت موقت rate limit (دسترسی وب مسدود)
public_html/             خروجی build؛ همین پوشه را آپلود کنید
docs/DEPLOY-SHARED-HOSTING.md  راهنمای گام‌به‌گام استقرار بدون SSH
```

## اجرای محلی (فقط برای توسعه)

```bash
npm install          # یا bun install؛ lockfile را تغییر ندهید
npm run dev          # http://localhost:3000
npm run typecheck    # tsc --noEmit
npm test             # تست‌های منطق دامنه، مجوزها و اعتبارسنجی
npm run build        # خروجی کامل در public_html/
```

> در حالت توسعه، اگر API در دسترس نباشد برنامه با `mode: "auto"` به داده نمایشی می‌رود. این رفتار در production باید با `mode: "server"` غیرفعال شود.

## حالت‌های اجرا

`public/app-config.js`:

| حالت | رفتار |
| --- | --- |
| `server` | ورود اجباری، ذخیره‌سازی فقط روی سرور، بدون fallback نمایشی. **حالت production** |
| `auto` | تلاش برای اتصال به API؛ فقط اگر API نصب نباشد (404/503) وارد داده نمایشی می‌شود |
| `demo` | کاملاً مرورگری، بدون احراز هویت. هرگز روی هاست واقعی استفاده نشود |

## مدل امنیتی

- **احراز هویت:** session سمت سرور با کوکی `HttpOnly`، `SameSite=Strict`، `Secure` روی HTTPS؛ گذرواژه با `password_hash` (bcrypt/Argon2).
- **قفل حساب:** پس از ۵ تلاش ناموفق، حساب ۱۵ دقیقه قفل می‌شود؛ rate limit ورود ۱۰ درخواست در ۱۵ دقیقه.
- **CSRF:** توکن تصادفی در session؛ همه درخواست‌های تغییردهنده هدر `X-CSRF-Token` می‌خواهند و same-origin بودن بررسی می‌شود.
- **RBAC:** شش نقش (`ceo`, `branch_manager`, `marketing`, `support`, `sales`, `analyst`) با کمترین دسترسی. فقط مدیرعامل می‌تواند نقش کاربران را مدیریت کند.
- **مجوزدهی سمت سرور:** `state.php` تغییرات snapshot را با «diff» بررسی می‌کند؛ فرانت‌اند تنها نمایش‌دهنده مجوزهاست و به آن اعتماد نمی‌شود.
- **کنترل نسخه:** ذخیره state با `If-Match` و نسخه اتمیک؛ ذخیره‌های هم‌زمان باعث بازنویسی داده نمی‌شوند.
- **وب‌هوک فروشگاه:** HMAC-SHA256 روی `timestamp + "\n" + rawBody`، پنجره ±۵ دقیقه، nonce یک‌بارمصرف و idempotency بر اساس `externalOrderId`.
- **تلگرام:** هدر `X-Telegram-Bot-Api-Secret-Token` با مقایسه زمان‌ثابت.
- **اینستاگرام:** امضای `X-Hub-Signature-256` متا و توکن verify برای اشتراک وب‌هوک.
- **اعتبارسنجی:** نرمال‌سازی موبایل ایرانی در مرورگر و سرور، محدودیت طول/مبلغ، رد مقادیر نامعتبر و پیام‌های خطای فارسی.
- **هدرهای امنیتی:** CSP، HSTS (روی HTTPS)، `X-Frame-Options: SAMEORIGIN`، `nosniff`، `Referrer-Policy`، `Permissions-Policy` و مسدودسازی `config.php`، `sql/`، `storage/` و فایل‌های نقطه‌ای.
- **حسابرسی:** هر عملیات حساس با نقش، هدف و زمان در `audit_logs` ثبت می‌شود و برای مدیرعامل قابل مشاهده است.
- **حداقل‌سازی داده در مرورگر:** در حالت `server` هیچ داده مشتری در `localStorage` ذخیره نمی‌شود.
- **چرخه نشست:** انقضای مطلق ۲۴ ساعت و انقضای بی‌کاری ۸ ساعت؛ غیرفعال‌سازی کاربر یا بازنشانی گذرواژه، تمام نشست‌های فعال او را فوراً باطل می‌کند.

## API

همه پاسخ‌ها JSON با ساختار `{ ok: true, ... }` یا `{ ok: false, error: { code, message } }` هستند.

| مسیر | توضیح |
| --- | --- |
| `api/auth.php?action=login\|session\|logout` | ورود، بررسی نشست، خروج |
| `api/state.php` | `GET` دریافت snapshot، `PUT` ذخیره با `If-Match` و CSRF |
| `api/users.php` | مدیریت کاربران (فقط `users:manage` = مدیرعامل) |
| `api/crm-api.php?action=customers\|audit\|award_points` | API خواندن مشتریان/حسابرسی و اعطای امتیاز idempotent |
| `api/crm-sync.php` | وب‌هوک سفارش سه سایت (HMAC) |
| `api/telegram-webhook.php` | وب‌هوک ربات تلگرام |
| `api/instagram-webhook.php` | وب‌هوک دایرکت اینستاگرام |
| `api/cron-daily-report.php` | گزارش روزانه/هفتگی (فقط CLI) |
| `api/setup.php` | ساخت یک‌باره حساب مدیرعامل؛ بعد از راه‌اندازی حذف شود |

جزئیات قرارداد وب‌هوک‌ها و گام‌های استقرار در [docs/DEPLOY-SHARED-HOSTING.md](docs/DEPLOY-SHARED-HOSTING.md).

## استقرار سریع (بدون SSH)

1. `npm ci && npm run build` را روی سیستم خودتان اجرا کنید (یا از پوشه آماده `public_html/` استفاده کنید).
2. محتویات `public_html/` را در File Manager هاست، داخل `public_html` آپلود و استخراج کنید.
3. در cPanel یک دیتابیس و کاربر MySQL بسازید و `sql/raspina_crm_schema.sql` را در phpMyAdmin ایمپورت کنید.
4. `api/config.example.php` را به `api/config.php` کپی و مقادیر را پر کنید (توکن‌ها را با Password Manager بسازید).
5. `app-config.js` را روی `mode: 'server'` بگذارید.
6. یک‌بار `api/setup.php` را باز کنید، حساب مدیرعامل را بسازید و **همان فایل را حذف کنید**.
7. HTTPS را فعال و وب‌هوک‌ها و cron را طبق راهنما تنظیم کنید.

## توسعه با ایجنت (قواعد، مشخصات، تأیید)

قواعد پروژه یک‌جا در `.ruler/` نگه‌داری می‌شود و با [Ruler](https://github.com/intellectronica/ruler) به فایل‌های ایجنت‌ها تولید می‌شود:

```bash
npx @intellectronica/ruler apply --agents agentsmd,claude,copilot,cursor --mcp false --gitignore false
```

- `.ruler/AGENTS.md` — قواعد سخت (امنیت، هاست اشتراکی، حریم داده، مسیرها)
- `.ruler/20-workflow.md` — چرخه‌ی spec → plan → tasks → implement → verify
- `.ruler/30-accessibility-ux.md` — استاندارد WCAG 2.2 AA و سادگی کاربری
- `AGENTS.md` و `CLAUDE.md` — **تولیدشده**؛ دستی ویرایش نکنید

مشخصات محصول و برنامه‌ی توسعه در `docs/sdd/` است: `constitution.md` (اصول و دروازه‌های کیفیت) و `001-everyday-ux/` (نمای «امروز»، جست‌وجوی سراسری، راهنمای درون‌برنامه).

## محدودیت‌های شناخته‌شده

- احراز هویت دومرحله‌ای (2FA) در این نسخه پیاده نشده است؛ برای داده مشتری حتماً HTTPS، گذرواژه قوی و محدودیت IP پنل را فعال کنید.
- ارسال پیامک/واتساپ واقعی به درگاه نیاز دارد و در کد فقط صف و وضعیت آن مدیریت می‌شود.
- پاسخ اینستاگرام فقط با محصول تأییدشده از کاتالوگ انجام می‌شود تا مدل زبانی قیمت یا موجودی از خود نسازد.
- APIهای PHP نیازمند PHP 8.2+ و افزونه‌های `pdo_mysql`, `curl`, `mbstring`, `json` هستند.
