import { useState } from 'react';
import {
  Bot,
  CalendarClock,
  Camera,
  CheckCircle2,
  FolderArchive,
  Send,
  Server,
  ShieldCheck,
  Webhook,
} from 'lucide-react';
import { AI_ROADMAP_PHASES } from '../data/crmSeed';
import { BRAND_PROFILE, HOSTING_CHECKLIST, TELEGRAM_SAMPLE_PRODUCTS } from '../data/raspinaPlan';
import {
  calculateDeliveryTimeline,
  matchTelegramCatalog,
  resolveInstagramInquiry,
} from '../utils/estimator';
import type { WebhookOrderInput } from '../utils/crmEngine';
import type { AuditLogEntry, ChannelKey, Customer360 } from '../types/crm';

interface IntegrationsOpsViewProps {
  customers: Customer360[];
  auditLogs: AuditLogEntry[];
  onSimulateWebhookOrder: (payload: WebhookOrderInput) => {
    customerId: string;
    customerName: string;
    pointsEarned: number;
    tierUpgraded: string | null;
  };
  onOpenCustomerProfile: (customerId: string) => void;
}

export function IntegrationsOpsView({
  customers,
  auditLogs,
  onSimulateWebhookOrder,
  onOpenCustomerProfile,
}: IntegrationsOpsViewProps) {
  const [subTab, setSubTab] = useState<'webhook' | 'bots' | 'ops_roadmap' | 'hosting'>('webhook');

  // Webhook Order Simulator state
  const [whPhone, setWhPhone] = useState('09355544332');
  const [whName, setWhName] = useState('هلیا کریمی');
  const [whSite, setWhSite] = useState<ChannelKey>('raspinaclothing');
  const [whCity, setWhCity] = useState<Customer360['city']>('تهران');
  const [whAmount, setWhAmount] = useState(3_450_000);
  const [whItem, setWhItem] = useState('مانتو عبایی مزونی کرپ حریر مشکی');
  const [whAttr, setWhAttr] = useState<WebhookOrderInput['attributionChannel']>('instagram_dm');
  const [whResult, setWhResult] = useState<{ text: string; customerId: string } | null>(null);

  // Telegram Simulator
  const [tgCategory, setTgCategory] = useState<'all' | 'manteau' | 'blouse' | 'pants' | 'set'>('blouse');
  const [tgSearch, setTgSearch] = useState('');

  // Instagram AI Simulator
  const [igPrompt, setIgPrompt] = useState('قیمت شومیز حریر چنده و چه سایزهایی داره؟');
  const [igMediaId, setIgMediaId] = useState('');

  // Timeline calculator
  const [tlMode, setTlMode] = useState<'parallel' | 'sequential'>('parallel');
  const [tlBuffer, setTlBuffer] = useState(true);

  const tgProducts = matchTelegramCatalog(tgCategory, tgSearch);
  const igResolution = resolveInstagramInquiry({
    queryText: igPrompt,
    attachedMediaId: igMediaId || undefined,
  });
  const timeline = calculateDeliveryTimeline({
    mode: tlMode,
    includeExternalBuffer: tlBuffer,
  });

  const handleTriggerWebhook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!whPhone.trim() || whAmount <= 0) return;
    const result = onSimulateWebhookOrder({
      phone: whPhone.trim(),
      fullName: whName.trim(),
      city: whCity,
      sourceSite: whSite,
      externalOrderId: `WH-${Math.floor(10000 + Math.random() * 89999)}`,
      totalToman: whAmount,
      itemsSummary: whItem.trim() || 'محصول راسپینا',
      attributionChannel: whAttr,
    });
    setWhResult({
      customerId: result.customerId,
      text: `سفارش وب‌هوک برای ${result.customerName} همگام شد: +${result.pointsEarned.toLocaleString('fa-IR')} امتیاز${
        result.tierUpgraded ? ` و ارتقاء به سطح ${result.tierUpgraded}` : ''
      } + ایجاد وظیفه پیگیری فوری.`,
    });
  };

  return (
    <div className="min-w-0 space-y-6">
      {/* Sub-navigation */}
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-[#e5dfd3] bg-white p-3">
        {[
          { id: 'webhook', label: 'شبیه‌ساز وب‌هوک ۳ سایت و سپیدار', icon: Webhook },
          { id: 'bots', label: 'ربات تلگرام و هوش مصنوعی اینستاگرام', icon: Bot },
          { id: 'ops_roadmap', label: 'اتوماسیون اداری، انبار ۱۴M، تایم‌لاین و امنیت', icon: CalendarClock },
          { id: 'hosting', label: 'استقرار بدون SSH در public_html', icon: Server },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id as typeof subTab)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold ${
                subTab === tab.id
                  ? 'bg-[#14192b] text-white'
                  : 'bg-[#f7f6f2] text-[#4b5063] hover:text-[#14192b]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {subTab === 'webhook' && (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Live Webhook Simulator */}
          <section className="min-w-0 rounded-xl border border-[#e5dfd3] bg-white p-5 lg:col-span-7">
            <h2 className="border-b border-[#e5dfd3] pb-3 text-sm font-extrabold text-[#14192b]">
              شبیه‌ساز زنده Webhook از ۳ وب‌سایت رسمی راسپینا
            </h2>
            <p className="mt-2 text-xs text-[#52586c]">
              ارسال سفارش آزمایشی باعث تطبیق شماره موبایل (Identity Resolution)، بروزرسانی CLV،
              محاسبه امتیاز/سطح باشگاه و ایجاد خودکار تسک پیگیری ۲۴ساعته در کل CRM می‌شود.
            </p>

            <form onSubmit={handleTriggerWebhook} className="mt-4 space-y-3 text-xs">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-bold text-[#14192b]" htmlFor="wh-phone">
                    موبایل مشتری (تست تجمیع: 09355544332 یا جدید)
                  </label>
                  <input
                    id="wh-phone"
                    type="tel"
                    value={whPhone}
                    onChange={(e) => setWhPhone(e.target.value)}
                    className="font-mono-code w-full rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-[#14192b]" htmlFor="wh-name">
                    نام (در صورت مشتری جدید)
                  </label>
                  <input
                    id="wh-name"
                    type="text"
                    value={whName}
                    onChange={(e) => setWhName(e.target.value)}
                    className="w-full rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block font-bold text-[#14192b]" htmlFor="wh-site">
                    سایت مبدأ
                  </label>
                  <select
                    id="wh-site"
                    value={whSite}
                    onChange={(e) => setWhSite(e.target.value as ChannelKey)}
                    className="w-full rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-2.5 py-2"
                  >
                    <option value="raspinashop">raspinashop.com</option>
                    <option value="raspinaclothing">raspinaclothing.com</option>
                    <option value="raspinaclothes">raspinaclothes.com</option>
                    <option value="pos_hamedan">POS شعبه همدان</option>
                    <option value="pos_tehran">POS شعبه تهران</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-bold text-[#14192b]" htmlFor="wh-city">
                    شهر
                  </label>
                  <select
                    id="wh-city"
                    value={whCity}
                    onChange={(e) => setWhCity(e.target.value as Customer360['city'])}
                    className="w-full rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-2.5 py-2"
                  >
                    <option value="تهران">تهران</option>
                    <option value="همدان">همدان</option>
                    <option value="کرج">کرج</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-bold text-[#14192b]" htmlFor="wh-amount">
                    مبلغ سفارش (تومان)
                  </label>
                  <input
                    id="wh-amount"
                    type="number"
                    min={100000}
                    step={10000}
                    value={whAmount}
                    onChange={(e) => setWhAmount(Number(e.target.value))}
                    className="tabular-nums w-full rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-3 py-2 font-bold"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-bold text-[#14192b]" htmlFor="wh-item">
                    شرح کالا
                  </label>
                  <input
                    id="wh-item"
                    type="text"
                    value={whItem}
                    onChange={(e) => setWhItem(e.target.value)}
                    className="w-full rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-[#14192b]" htmlFor="wh-attr">
                    منبع Attribution
                  </label>
                  <select
                    id="wh-attr"
                    value={whAttr}
                    onChange={(e) =>
                      setWhAttr(e.target.value as WebhookOrderInput['attributionChannel'])
                    }
                    className="w-full rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-2.5 py-2"
                  >
                    <option value="instagram_dm">دایرکت اینستاگرام</option>
                    <option value="telegram_bot">ربات تلگرام</option>
                    <option value="direct_web">ورود مستقیم وب‌سایت</option>
                    <option value="store_walkin">خرید حضوری شعبه</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg bg-[#14192b] px-4 py-2.5 font-bold text-white hover:bg-[#1e2540]"
              >
                <Webhook className="h-4 w-4 text-[#e2c275]" aria-hidden="true" />
                <span>ارسال و پردازش سفارش در هسته CRM</span>
              </button>
            </form>

            {whResult && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#16a34a]/30 bg-[#dcfce7] p-3 text-xs font-bold text-[#16a34a]">
                <span>{whResult.text}</span>
                <button
                  type="button"
                  onClick={() => onOpenCustomerProfile(whResult.customerId)}
                  className="rounded bg-[#14192b] px-2.5 py-1 text-[11px] text-white"
                >
                  مشاهده در پروفایل ۳۶۰
                </button>
              </div>
            )}
          </section>

          {/* Connected External Stack */}
          <section className="min-w-0 space-y-4 lg:col-span-5">
            <div className="rounded-xl border border-[#e5dfd3] bg-white p-5 text-xs">
              <h3 className="font-extrabold text-[#14192b]">یکپارچه‌سازی‌های زیرساختی راسپینا</h3>
              <ul className="mt-3 space-y-2.5 text-[#4b5063]">
                <li>
                  <strong className="text-[#14192b]">۳ سایت فروش آنلاین (SSO + Webhook):</strong>{' '}
                  {BRAND_PROFILE.sites.join(' · ')}
                </li>
                <li>
                  <strong className="text-[#14192b]">سپیدار ERP:</strong> همگام‌سازی فاکتور فروش،
                  موجودی ۱۴M+ کالا، مرجوعی و خروجی مالی
                </li>
                <li>
                  <strong className="text-[#14192b]">درگاه‌های پرداخت:</strong> زرین‌پال (اصلی)،
                  به‌پرداخت ملت، سپ و بازگشت وجه خودکار
                </li>
                <li>
                  <strong className="text-[#14192b]">ارسال و لجستیک:</strong> پست ایران، تیپاکس،
                  اسنپ‌اکسپرس و ماهکس با رهگیری لحظه‌ای در پروفایل
                </li>
                <li>
                  <strong className="text-[#14192b]">پیام‌رسان‌ها:</strong> کاوه‌نگار / فراز SMS،
                  واتساپ بیزینس، تلگرام و Instagram Graph API
                </li>
              </ul>
            </div>
          </section>
        </div>
      )}

      {subTab === 'bots' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Telegram Shop Bot */}
          <section className="min-w-0 rounded-xl border border-[#e5dfd3] bg-white p-5">
            <div className="flex items-center gap-2 border-b border-[#e5dfd3] pb-3">
              <Send className="h-4 w-4 text-[#0088cc]" aria-hidden="true" />
              <h2 className="text-sm font-extrabold text-[#14192b]">
                ربات فروشگاه تلگرام (دسته‌بندی ← محصول ← قیمت و لینک سایت)
              </h2>
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {[
                { id: 'all', label: 'همه' },
                { id: 'manteau', label: 'مانتو' },
                { id: 'blouse', label: 'شومیز' },
                { id: 'pants', label: 'شلوار' },
                { id: 'set', label: 'ست' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setTgCategory(cat.id as typeof tgCategory)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                    tgCategory === cat.id
                      ? 'bg-[#14192b] text-white'
                      : 'border border-[#e5dfd3] bg-[#f7f6f2] text-[#4b5063]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <input
              type="search"
              aria-label="جستجو در کاتالوگ ربات تلگرام"
              value={tgSearch}
              onChange={(e) => setTgSearch(e.target.value)}
              placeholder="جستجوی نام محصول در ربات..."
              className="mt-3 w-full rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-3 py-2 text-xs"
            />

            <div className="mt-3 space-y-2">
              {tgProducts.map((p) => (
                <div
                  key={p.sku}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] p-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold text-[#14192b]">{p.title}</p>
                    <p className="mt-0.5 text-[11px] text-[#52586c]">
                      دسته {p.categoryFa} · سایزها: {p.sizes.join('، ')}
                    </p>
                  </div>
                  <div className="shrink-0 text-left">
                    <p className="tabular-nums font-extrabold text-[#14192b]">
                      {p.priceToman.toLocaleString('fa-IR')} ت
                    </p>
                    <p className="font-mono-code text-[10px] text-[#0088cc]">utm=telegram_bot</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Instagram AI Bot */}
          <section className="min-w-0 rounded-xl border border-[#e5dfd3] bg-white p-5">
            <div className="flex items-center gap-2 border-b border-[#e5dfd3] pb-3">
              <Camera className="h-4 w-4 text-[#c13584]" aria-hidden="true" />
              <h2 className="text-sm font-extrabold text-[#14192b]">
                ربات هوش مصنوعی دایرکت (۲–۱۰ث + قفل دسته‌بندی) و گزارش پایش
              </h2>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-bold text-[#52586c]" htmlFor="ig-media-select">
                  شبیه‌سازی فوروارد پست محصول به دایرکت
                </label>
                <select
                  id="ig-media-select"
                  value={igMediaId}
                  onChange={(e) => setIgMediaId(e.target.value)}
                  className="w-full rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-3 py-2"
                >
                  <option value="">سوال متنی بدون پست ضمیمه</option>
                  {TELEGRAM_SAMPLE_PRODUCTS.map((p) => (
                    <option key={p.instagramMediaId} value={p.instagramMediaId}>
                      پست {p.categoryFa}: {p.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block font-bold text-[#52586c]" htmlFor="ig-query-input">
                  پیام دایرکت مشتری
                </label>
                <input
                  id="ig-query-input"
                  type="text"
                  value={igPrompt}
                  onChange={(e) => setIgPrompt(e.target.value)}
                  className="w-full rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-3 py-2"
                />
              </div>

              <div className="rounded-xl border border-[#14192b] bg-[#14192b] p-4 text-white">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="font-bold text-[#e2c275]">
                    قفل دسته تاییدشده: {igResolution.categoryGuard}
                  </span>
                  <span className="tabular-nums text-white/75">
                    زمان پاسخ: {(igResolution.simulatedLatencyMs / 1000).toFixed(1)} ثانیه (هدف ۲–۱۰ث)
                  </span>
                </div>
                <p className="mt-2 leading-7 text-white/95">{igResolution.replyTextFa}</p>
                {igResolution.product && (
                  <p className="font-mono-code mt-2 break-all text-[11px] text-[#e2c275]">
                    {igResolution.product.canonicalUrl}?utm_source=instagram_dm
                  </p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] p-3 text-center">
                <div>
                  <p className="text-[10px] text-[#52586c]">رشد خالص روزانه</p>
                  <p className="tabular-nums font-extrabold text-[#16a34a]">+۳۴۲ فالوور</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#52586c]">پاسخ زیر ۱۰ ثانیه</p>
                  <p className="tabular-nums font-extrabold text-[#14192b]">۹۸.۴٪</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#52586c]">فروش منتسب هفتگی</p>
                  <p className="tabular-nums font-extrabold text-[#9a7622]">۴۸۲M تومان</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {subTab === 'ops_roadmap' && (
        <div className="space-y-6">
          {/* AI 3-Phase Roadmap + Project Timeline */}
          <section className="rounded-xl border border-[#e5dfd3] bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5dfd3] pb-3">
              <h2 className="text-sm font-extrabold text-[#14192b]">
                جدول زمان‌بندی اجرای اکوسیستم (رویکرد AI-First)
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setTlMode('parallel')}
                  className={`rounded-lg px-3 py-1 font-bold ${
                    tlMode === 'parallel' ? 'bg-[#14192b] text-white' : 'bg-[#f7f6f2] text-[#4b5063]'
                  }`}
                >
                  اجرای موازی ({timeline.totalCalendarWeeks} هفته)
                </button>
                <button
                  type="button"
                  onClick={() => setTlMode('sequential')}
                  className={`rounded-lg px-3 py-1 font-bold ${
                    tlMode === 'sequential'
                      ? 'bg-[#14192b] text-white'
                      : 'bg-[#f7f6f2] text-[#4b5063]'
                  }`}
                >
                  ترتیبی
                </button>
                <label className="flex items-center gap-1.5 text-[11px] font-semibold">
                  <input
                    type="checkbox"
                    checked={tlBuffer}
                    onChange={(e) => setTlBuffer(e.target.checked)}
                  />
                  <span>بافر تاییدیه Meta و API سایت‌ها</span>
                </label>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {timeline.modules.map((mod) => (
                <div
                  key={mod.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-3.5 py-2.5 text-xs"
                >
                  <div>
                    <p className="font-bold text-[#14192b]">{mod.title}</p>
                    <p className="text-[11px] text-[#52586c]">{mod.deliverables.join(' · ')}</p>
                  </div>
                  <span className="tabular-nums rounded bg-white px-2.5 py-1 font-extrabold text-[#9a7622]">
                    {mod.effectiveWeeks} هفته
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Office Automation + Warehouse + AI Phases + Audit Log */}
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-[#e5dfd3] bg-white p-5 text-xs">
              <div className="flex items-center gap-2 border-b border-[#e5dfd3] pb-3">
                <FolderArchive className="h-4 w-4 text-[#9a7622]" aria-hidden="true" />
                <h3 className="text-sm font-extrabold text-[#14192b]">
                  اتوماسیون اداری بدون کاغذ و انبار ۱۴M سپیدار
                </h3>
              </div>
              <ul className="mt-3 space-y-2 text-[#4b5063]">
                <li>• دبیرخانه نامه‌های داخلی همدان ↔ تهران با امضای دیجیتال و QR</li>
                <li>• کانبان وظایف، مرخصی آنلاین، تردد موبایلی و فیش حقوقی دیجیتال</li>
                <li>• اسکنر بارکد موبایلی (PWA) زیر ۰.۵ ثانیه برای ۱۴ میلیون+ قلم کالا</li>
                <li>• خروجی اکسل تعدیل کسری/اضافی آماده ورود به سپیدار</li>
              </ul>

              <div className="mt-4 space-y-2 border-t border-[#e5dfd3] pt-3">
                <p className="font-extrabold text-[#14192b]">نقشه راه هوش مصنوعی ۵ ساله (۳ فاز):</p>
                {AI_ROADMAP_PHASES.map((ph) => (
                  <div key={ph.phase} className="rounded-lg bg-[#f7f6f2] p-2.5">
                    <p className="font-bold text-[#9a7622]">{ph.phase}</p>
                    <p className="mt-1 text-[11px] text-[#4b5063]">
                      {ph.items.map((i) => `${i.title} (${i.metric})`).join(' · ')}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-[#e5dfd3] bg-white p-5 text-xs">
              <div className="flex items-center gap-2 border-b border-[#e5dfd3] pb-3">
                <ShieldCheck className="h-4 w-4 text-[#9a7622]" aria-hidden="true" />
                <h3 className="text-sm font-extrabold text-[#14192b]">
                  امنیت (AES-256 / RBAC) و Audit Log زنده سیستم
                </h3>
              </div>
              <p className="mt-2 text-[11px] text-[#52586c]">
                تمامی تغییرات پروفایل، امتیازدهی، تیکت و وب‌هوک با نقش عامل و زمان دقیق ثبت می‌شوند:
              </p>
              <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-3 py-2"
                  >
                    <div className="flex justify-between text-[11px]">
                      <span className="font-bold text-[#14192b]">نقش: {log.actorRole}</span>
                      <span className="tabular-nums text-[#52586c]">{log.timestamp}</span>
                    </div>
                    <p className="mt-0.5 text-[#4b5063]">
                      {log.action} ← <strong>{log.target}</strong>
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}

      {subTab === 'hosting' && (
        <section className="rounded-xl border border-[#e5dfd3] bg-white p-5">
          <div className="border-b border-[#e5dfd3] pb-3">
            <h2 className="text-sm font-extrabold text-[#14192b]">
              راهنمای استقرار روی هاست اشتراکی لینوکس (بدون ترمینال و بدون SSH)
            </h2>
            <p className="mt-1 text-xs text-[#52586c]">
              خروجی کامل پنل CRM + APIهای PHP 8.2 + دیتابیس MySQL به‌صورت یکجا در پوشه{' '}
              <span className="font-mono-code font-bold text-[#14192b]">public_html/</span> تولید شده است.
            </p>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {HOSTING_CHECKLIST.map((item) => (
              <div key={item.step} className="rounded-xl border border-[#e5dfd3] bg-[#f7f6f2] p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#16a34a]" aria-hidden="true" />
                  <h3 className="text-xs font-extrabold text-[#14192b]">
                    گام {item.step}: {item.title}
                  </h3>
                </div>
                <p className="mt-2 text-xs leading-6 text-[#4b5063]">{item.detail}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-[#14192b] bg-[#14192b] p-4 text-xs text-white">
            <p className="font-bold text-[#e2c275]">ساختار فایل‌های آماده آپلود در public_html:</p>
            <p className="font-mono-code mt-2 break-words leading-7 text-white/85">
              public_html/index.html · public_html/assets/* · public_html/.htaccess ·
              public_html/sql/raspina_crm_schema.sql · public_html/api/config.example.php ·
              public_html/api/crm-api.php · public_html/api/crm-sync.php ·
              public_html/api/telegram-webhook.php · public_html/api/instagram-webhook.php ·
              public_html/api/cron-daily-report.php
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
