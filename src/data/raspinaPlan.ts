export interface BrandProfile {
  name: string;
  enName: string;
  instagram: string;
  sites: string[];
  hamedanAddress: string;
  tehranAddress: string;
  warehouseScale: string;
}

export const BRAND_PROFILE: BrandProfile = {
  name: 'برند پوشاک زنانه راسپینا',
  enName: 'Raspina Women Apparel',
  instagram: '@raspina_clothing',
  sites: ['raspinashop.com', 'raspinaclothing.com', 'raspinaclothes.com'],
  hamedanAddress: 'همدان، شعبه مرکزی و انبار اصلی تجمیعی',
  tehranAddress: 'تهران، دفتر مرکزی طراحی، فروش و شعبه حضوری',
  warehouseScale: 'بیش از ۱۴ میلیون آیتم کالا در همگام‌سازی انبار و سپیدار',
};

export interface CatalogProduct {
  sku: string;
  categorySlug: 'manteau' | 'blouse' | 'pants' | 'set';
  categoryFa: string;
  title: string;
  priceToman: number;
  sizes: string[];
  inStock: boolean;
  canonicalUrl: string;
  instagramMediaId: string;
}

export const TELEGRAM_SAMPLE_PRODUCTS: CatalogProduct[] = [
  {
    sku: 'RAS-MNT-LIN-104',
    categorySlug: 'manteau',
    categoryFa: 'مانتو',
    title: 'مانتو کتی لینن دیپلمات راسپینا',
    priceToman: 2_890_000,
    sizes: ['۳۸', '۴۰', '۴۲', '۴۴'],
    inStock: true,
    canonicalUrl: 'https://raspinashop.com/product/ras-mnt-lin-104',
    instagramMediaId: 'IG-POST-MANTEAU-104',
  },
  {
    sku: 'RAS-MNT-ABY-112',
    categorySlug: 'manteau',
    categoryFa: 'مانتو',
    title: 'مانتو عبایی مزونی کرپ حریر مشکی',
    priceToman: 3_450_000,
    sizes: ['فری‌سایز ۱', 'فری‌سایز ۲'],
    inStock: true,
    canonicalUrl: 'https://raspinaclothing.com/product/ras-mnt-aby-112',
    instagramMediaId: 'IG-POST-MANTEAU-112',
  },
  {
    sku: 'RAS-SHM-SLK-018',
    categorySlug: 'blouse',
    categoryFa: 'شومیز',
    title: 'شومیز حریر ابریشم یقه کرواتی کرم',
    priceToman: 1_680_000,
    sizes: ['۳۶', '۳۸', '۴۰', '۴۲'],
    inStock: true,
    canonicalUrl: 'https://raspinashop.com/product/ras-shm-slk-018',
    instagramMediaId: 'IG-POST-BLOUSE-018',
  },
  {
    sku: 'RAS-SHM-LIN-029',
    categorySlug: 'blouse',
    categoryFa: 'شومیز',
    title: 'شومیز اورسایز لینن تابستانه سفید',
    priceToman: 1_490_000,
    sizes: ['۳۸', '۴۰', '۴۲'],
    inStock: true,
    canonicalUrl: 'https://raspinaclothes.com/product/ras-shm-lin-029',
    instagramMediaId: 'IG-POST-BLOUSE-029',
  },
  {
    sku: 'RAS-PNT-KRN-205',
    categorySlug: 'pants',
    categoryFa: 'شلوار',
    title: 'شلوار بگ کرپ مازراتی کمر بلند',
    priceToman: 1_790_000,
    sizes: ['۳۶', '۳۸', '۴۰', '۴۲', '۴۴'],
    inStock: true,
    canonicalUrl: 'https://raspinashop.com/product/ras-pnt-krn-205',
    instagramMediaId: 'IG-POST-PANTS-205',
  },
  {
    sku: 'RAS-SET-KTY-310',
    categorySlug: 'set',
    categoryFa: 'ست',
    title: 'ست وست و شلوار کتی پاییزه راسپینا',
    priceToman: 4_120_000,
    sizes: ['۳۸', '۴۰', '۴۲'],
    inStock: true,
    canonicalUrl: 'https://raspinaclothing.com/product/ras-set-kty-310',
    instagramMediaId: 'IG-POST-SET-310',
  },
];

export interface TimelineModuleSpec {
  id: string;
  title: string;
  track: 'Track A: CRM & Club' | 'Track B: AI Bots' | 'Track C: Office & QA';
  aiDevDays: number;
  calendarWeeksParallel: number;
  calendarWeeksSequential: number;
  externalBufferDays: number;
  deliverables: string[];
}

export const TIMELINE_MODULES: TimelineModuleSpec[] = [
  {
    id: 'crm-club',
    title: 'هسته یکپارچه CRM + باشگاه مشتریان ۴ سطحی + ۳ سایت',
    track: 'Track A: CRM & Club',
    aiDevDays: 24,
    calendarWeeksParallel: 6,
    calendarWeeksSequential: 6,
    externalBufferDays: 4,
    deliverables: [
      'دیتابیس CDP + Identity Resolution و پروفایل ۳۶۰ درجه',
      'باشگاه ۴ سطحی (برنزی/طلایی/پلاتینیوم/VIP Black) + کیف پول',
      'پیگیری خودکار ۲۴س/۷ر/۳۰ر/۹۰ر + تیکتینگ با SLA',
    ],
  },
  {
    id: 'tg-bot',
    title: 'ربات فروشگاه تلگرام متصل به کاتالوگ سایت‌ها',
    track: 'Track B: AI Bots',
    aiDevDays: 10,
    calendarWeeksParallel: 3,
    calendarWeeksSequential: 3,
    externalBufferDays: 2,
    deliverables: [
      'منوی Inline دسته‌بندی‌ها ← لیست محصولات + قیمت + سایز',
      'لینک مستقیم خرید هر محصول در سایت با UTM و رهگیری سفارش',
    ],
  },
  {
    id: 'ig-bot',
    title: 'ربات هوش مصنوعی دایرکت اینستاگرام (۲–۱۰ث) + تحلیل روزانه/هفتگی',
    track: 'Track B: AI Bots',
    aiDevDays: 16,
    calendarWeeksParallel: 5,
    calendarWeeksSequential: 5,
    externalBufferDays: 5,
    deliverables: [
      'تشخیص فوری پست ارسالی به دایرکت + Anti-Hallucination Guard',
      'پاسخ ۲ تا ۱۰ ثانیه + پایش ورودی/خروجی فالوور و گزارش هفتگی',
    ],
  },
  {
    id: 'office-auto',
    title: 'اتوماسیون اداری ۱۰۰٪ بدون کاغذ (همدان ↔ تهران) + سپیدار',
    track: 'Track C: Office & QA',
    aiDevDays: 12,
    calendarWeeksParallel: 4,
    calendarWeeksSequential: 4,
    externalBufferDays: 3,
    deliverables: [
      'دبیرخانه دیجیتال، امضای QR، مرخصی/تردد و فیش حقوقی آنلاین',
      'حواله بین‌شعبه‌ای + اسکن بارکد موبایلی انبار برای سپیدار',
    ],
  },
  {
    id: 'integration-qa',
    title: 'یکپارچه‌سازی نهایی، تست UAT و استقرار روی هاست public_html',
    track: 'Track C: Office & QA',
    aiDevDays: 6,
    calendarWeeksParallel: 2,
    calendarWeeksSequential: 2,
    externalBufferDays: 0,
    deliverables: [
      'تست امنیت، Load Test وب‌هوک‌ها و آموزش کارشناسان دو شعبه',
      'خروجی نهایی آماده آپلود در File Manager هاست اشتراکی',
    ],
  },
];

export const HOSTING_CHECKLIST = [
  {
    step: '۱',
    title: 'آپلود خروجی Vite + PHP API در public_html',
    detail:
      'تمامی فایل‌های build رابط کاربری همراه با پوشه api/ و sql/ و فایل .htaccess مستقیماً داخل public_html قرار می‌گیرند (بدون نیاز به Node.js یا SSH روی سرور).',
  },
  {
    step: '۲',
    title: 'ایمپورت دیتابیس MySQL با یک کلیک در phpMyAdmin',
    detail:
      'فایل public_html/sql/raspina_crm_schema.sql شامل ۱۲ جدول یکپارچه CRM، باشگاه، تیکتینگ، مرجوعی، کمپین، کارت هدیه و متریک اینستاگرام است.',
  },
  {
    step: '۳',
    title: 'تنظیم کلیدهای اتصال در public_html/api/config.php',
    detail:
      'فایل config.example.php را به config.php تغییر نام دهید و اطلاعات دیتابیس، توکن تلگرام، توکن متا و کلید AI را وارد کنید؛ دسترسی وب به آن با .htaccess بسته شده است.',
  },
  {
    step: '۴',
    title: 'زمان‌بندی گزارش روزانه در Cron Jobs پنل هاست',
    detail:
      'از بخش Cron Jobs در cPanel یا DirectAdmin دستور اجرای php public_html/api/cron-daily-report.php را بدون نیاز به ترمینال ثبت کنید.',
  },
];
