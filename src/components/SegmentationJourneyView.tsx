import { useMemo, useState } from 'react';
import { Filter, GitBranch, Sparkles } from 'lucide-react';
import { filterCustomSegment, getTierSpec } from '../utils/crmEngine';
import type { ChannelKey, Customer360, CustomSegmentRule, LoyaltyTierCode } from '../types/crm';

interface SegmentationJourneyViewProps {
  customers: Customer360[];
  onInspectCustomer: (customerId: string) => void;
  onGoToCampaigns: () => void;
}

const JOURNEY_TRACKS = [
  {
    title: 'مسیر خرید آنلاین (۳ وب‌سایت)',
    steps: [
      '۱. ورود از گوگل/اینستا',
      '۲. مرور دسته‌بندی',
      '۳. افزودن به سبد (Remarketing)',
      '۴. ثبت‌نام/Identity',
      '۵. خرید اول + خوش‌آمد',
      '۶. تحویل + NPS ۴۸س',
      '۷. خرید دوم (فعال‌سازی Tier)',
      '۸. سفیر برند (Referral)',
    ],
  },
  {
    title: 'مسیر خرید از اینستاگرام (۲–۱۰ ثانیه AI)',
    steps: [
      '۱. مشاهده پست/ریلز',
      '۲. فوروارد پست یا دایرکت',
      '۳. پاسخ ۲–۱۰ث AI با قیمت و لینک',
      '۴. ورود به سایت (UTM Attribution)',
      '۵. تکمیل سفارش',
      '۶. نظرسنجی Follow-up DM',
    ],
  },
  {
    title: 'مسیر خرید حضوری (همدان و تهران)',
    steps: [
      '۱. ورود به شعبه + شناسایی موبایل',
      '۲. مشاوره استایل در CRM',
      '۳. ثبت سایز دقیق پس از پرو',
      '۴. فاکتور POS + سپیدار',
      '۵. محاسبه امتیاز لحظه‌ای',
      '۶. پیامک تشکر + کیف پول',
    ],
  },
];

export function SegmentationJourneyView({
  customers,
  onInspectCustomer,
  onGoToCampaigns,
}: SegmentationJourneyViewProps) {
  const [rule, setRule] = useState<CustomSegmentRule>({
    city: 'همه',
    tier: 'all',
    minAnnualMillion: 0,
    maxDaysSincePurchase: 0,
    channel: 'all',
    logic: 'AND',
  });

  const matchedCustomers = useMemo(() => filterCustomSegment(customers, rule), [customers, rule]);

  const applyPreset = (preset: 'vip_tehran' | 'at_risk' | 'hamedan_active' | 'reset') => {
    if (preset === 'vip_tehran') {
      setRule({
        city: 'تهران',
        tier: 'vip_black',
        minAnnualMillion: 50,
        maxDaysSincePurchase: 30,
        channel: 'all',
        logic: 'AND',
      });
    } else if (preset === 'at_risk') {
      setRule({
        city: 'همه',
        tier: 'all',
        minAnnualMillion: 5,
        maxDaysSincePurchase: 0,
        channel: 'instagram',
        logic: 'AND',
      });
    } else if (preset === 'hamedan_active') {
      setRule({
        city: 'همدان',
        tier: 'all',
        minAnnualMillion: 10,
        maxDaysSincePurchase: 30,
        channel: 'all',
        logic: 'AND',
      });
    } else {
      setRule({
        city: 'همه',
        tier: 'all',
        minAnnualMillion: 0,
        maxDaysSincePurchase: 0,
        channel: 'all',
        logic: 'AND',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Custom Segment Builder */}
      <section className="rounded-xl border border-[#e5dfd3] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5dfd3] pb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-[#9a7622]" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-extrabold text-[#14192b]">
                سگمنت‌ساز پویا (Custom AND / OR Segment Builder)
              </h2>
              <p className="text-[11px] text-[#52586c]">
                ترکیب شرط‌های جغرافیایی، سطح باشگاه، بودجه سالانه، تازگی خرید و کانال ورودی در لحظه
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => applyPreset('vip_tehran')}
              className="rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-2.5 py-1 text-[11px] font-semibold text-[#14192b] hover:border-[#c9a84c]"
            >
              VIP تهران
            </button>
            <button
              type="button"
              onClick={() => applyPreset('hamedan_active')}
              className="rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-2.5 py-1 text-[11px] font-semibold text-[#14192b] hover:border-[#c9a84c]"
            >
              فعال همدان (+۱۰M)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('at_risk')}
              className="rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-2.5 py-1 text-[11px] font-semibold text-[#14192b] hover:border-[#c9a84c]"
            >
              اینستاگرامی +۵M
            </button>
            <button
              type="button"
              onClick={() => applyPreset('reset')}
              className="rounded-lg border border-[#e5dfd3] px-2.5 py-1 text-[11px] font-semibold text-[#52586c]"
            >
              پاک‌کردن
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div>
            <label className="mb-1 block text-[11px] font-bold text-[#52586c]" htmlFor="seg-logic">
              عملگر منطقی
            </label>
            <select
              id="seg-logic"
              value={rule.logic}
              onChange={(e) => setRule({ ...rule, logic: e.target.value as 'AND' | 'OR' })}
              className="w-full rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-2.5 py-2 text-xs font-bold"
            >
              <option value="AND">همه شروط (AND)</option>
              <option value="OR">حداقل یک شرط (OR)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold text-[#52586c]" htmlFor="seg-city">
              شهر
            </label>
            <select
              id="seg-city"
              value={rule.city}
              onChange={(e) =>
                setRule({ ...rule, city: e.target.value as CustomSegmentRule['city'] })
              }
              className="w-full rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-2.5 py-2 text-xs font-semibold"
            >
              <option value="همه">همه شهرها</option>
              <option value="تهران">تهران</option>
              <option value="همدان">همدان</option>
              <option value="سایر">سایر شهرها</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold text-[#52586c]" htmlFor="seg-tier">
              سطح باشگاه
            </label>
            <select
              id="seg-tier"
              value={rule.tier}
              onChange={(e) => setRule({ ...rule, tier: e.target.value as 'all' | LoyaltyTierCode })}
              className="w-full rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-2.5 py-2 text-xs font-semibold"
            >
              <option value="all">همه سطوح</option>
              <option value="vip_black">VIP Black</option>
              <option value="platinum">پلاتینیوم</option>
              <option value="gold">طلایی</option>
              <option value="bronze">برنزی</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold text-[#52586c]" htmlFor="seg-spend">
              حداقل خرید سالانه (M)
            </label>
            <input
              id="seg-spend"
              type="number"
              min={0}
              max={200}
              value={rule.minAnnualMillion}
              onChange={(e) =>
                setRule({ ...rule, minAnnualMillion: Math.max(0, Number(e.target.value)) })
              }
              className="tabular-nums w-full rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-2.5 py-2 text-xs font-bold"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold text-[#52586c]" htmlFor="seg-days">
              حداکثر روز از آخرین خرید
            </label>
            <input
              id="seg-days"
              type="number"
              min={0}
              max={365}
              value={rule.maxDaysSincePurchase}
              onChange={(e) =>
                setRule({ ...rule, maxDaysSincePurchase: Math.max(0, Number(e.target.value)) })
              }
              className="tabular-nums w-full rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-2.5 py-2 text-xs font-bold"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold text-[#52586c]" htmlFor="seg-channel">
              کانال متصل
            </label>
            <select
              id="seg-channel"
              value={rule.channel}
              onChange={(e) => setRule({ ...rule, channel: e.target.value as 'all' | ChannelKey })}
              className="w-full rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-2.5 py-2 text-xs font-semibold"
            >
              <option value="all">همه کانال‌ها</option>
              <option value="raspinashop">raspinashop.com</option>
              <option value="raspinaclothing">raspinaclothing.com</option>
              <option value="raspinaclothes">raspinaclothes.com</option>
              <option value="instagram">اینستاگرام</option>
              <option value="telegram">تلگرام</option>
              <option value="pos_hamedan">شعبه همدان</option>
              <option value="pos_tehran">شعبه تهران</option>
            </select>
          </div>
        </div>

        {/* Matched Results */}
        <div className="mt-5 rounded-xl border border-[#e5dfd3] bg-[#f7f6f2] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-extrabold text-[#14192b]">
              نتیجه لحظه‌ای سگمنت:{' '}
              <span className="tabular-nums text-[#9a7622]">
                {matchedCustomers.length.toLocaleString('fa-IR')} مشتری منطبق
              </span>
            </p>
            <button
              type="button"
              onClick={onGoToCampaigns}
              className="rounded-lg bg-[#14192b] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#1e2540]"
            >
              هدف‌گیری این سگمنت در کمپین‌ها
            </button>
          </div>

          {matchedCustomers.length === 0 ? (
            <p className="mt-3 text-xs text-[#52586c]">
              هیچ مشتری با ترکیب شروط فعلی مطابقت ندارد؛ عملگر را روی OR بگذارید یا محدودیت‌ها را تغییر دهید.
            </p>
          ) : (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {matchedCustomers.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onInspectCustomer(c.id)}
                  className="flex items-center justify-between rounded-lg border border-[#e5dfd3] bg-white px-3 py-2.5 text-right hover:border-[#c9a84c]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-[#14192b]">{c.fullName}</p>
                    <p className="tabular-nums text-[11px] text-[#52586c]">
                      {c.city} · {getTierSpec(c.tierCode).nameFa}
                    </p>
                  </div>
                  <span className="tabular-nums text-xs font-extrabold text-[#9a7622]">
                    {(c.annualSpendToman / 1_000_000).toFixed(1)}M
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Omnichannel Customer Journeys & Attribution */}
      <section className="rounded-xl border border-[#e5dfd3] bg-white p-5">
        <div className="flex items-center gap-2 border-b border-[#e5dfd3] pb-3">
          <GitBranch className="h-4 w-4 text-[#9a7622]" aria-hidden="true" />
          <h2 className="text-sm font-extrabold text-[#14192b]">
            نقشه سفر مشتری Omnichannel و مدل‌های Attribution
          </h2>
        </div>

        <div className="mt-4 space-y-4">
          {JOURNEY_TRACKS.map((track) => (
            <div key={track.title} className="rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] p-3.5">
              <h3 className="text-xs font-extrabold text-[#14192b]">{track.title}</h3>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {track.steps.map((step) => (
                  <span
                    key={step}
                    className="rounded-md border border-[#e5dfd3] bg-white px-2.5 py-1 text-[11px] font-medium text-[#14192b]"
                  >
                    {step}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {[
            { name: 'First Touch', desc: 'اولین کانال معرفی (اینستاگرام / گوگل)' },
            { name: 'Last Touch', desc: 'آخرین کانال قبل از پرداخت (ربات تلگرام / دایرکت)' },
            { name: 'Linear', desc: 'تقسیم وزن مساوی بین تمام نقاط تماس' },
            { name: 'AI-Based Attribution', desc: 'وزن‌دهی یادگیرنده بر اساس تبدیل واقعی ۳ سایت' },
          ].map((m) => (
            <div key={m.name} className="rounded-lg border border-[#e5dfd3] p-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#14192b]">
                <Sparkles className="h-3.5 w-3.5 text-[#9a7622]" aria-hidden="true" />
                <span>{m.name}</span>
              </div>
              <p className="mt-1 text-[11px] text-[#52586c]">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
