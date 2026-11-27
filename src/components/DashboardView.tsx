import { useState } from 'react';
import { AlertTriangle, ArrowLeft, TrendingUp, Users } from 'lucide-react';
import { COHORT_MATRIX, KPI_5YEAR_TARGETS, LOYALTY_TIERS } from '../data/crmSeed';
import type { Customer360 } from '../types/crm';

interface DashboardViewProps {
  customers: Customer360[];
  onInspectCustomer: (customerId: string) => void;
  onNavigateTab: (tab: 'customers' | 'followup' | 'loyalty' | 'support_campaigns') => void;
}

export function DashboardView({
  customers,
  onInspectCustomer,
  onNavigateTab,
}: DashboardViewProps) {
  const [kpiGroupFilter, setKpiGroupFilter] = useState<'همه' | 'درآمدی' | 'وفاداری' | 'کمپین' | 'پشتیبانی'>('همه');

  const totalAnnualRevenue = customers.reduce((sum, c) => sum + c.annualSpendToman, 0);
  const totalClv = customers.reduce((sum, c) => sum + c.lifetimeValueToman, 0);
  const avgNps =
    customers.length > 0
      ? Math.round(customers.reduce((sum, c) => sum + c.npsLatest, 0) / customers.length * 10)
      : 0;
  const atRiskCustomers = customers.filter(
    (c) => c.scores.churnRiskPct >= 60 || c.lastPurchaseDaysAgo >= 60
  );

  const tierCounts = LOYALTY_TIERS.map((t) => ({
    ...t,
    count: customers.filter((c) => c.tierCode === t.code).length,
    revenue: customers
      .filter((c) => c.tierCode === t.code)
      .reduce((sum, c) => sum + c.annualSpendToman, 0),
  }));

  const hamedanCustomers = customers.filter((c) => c.city === 'همدان');
  const tehranCustomers = customers.filter((c) => c.city === 'تهران');
  const hamedanRev = hamedanCustomers.reduce((s, c) => s + c.annualSpendToman, 0);
  const tehranRev = tehranCustomers.reduce((s, c) => s + c.annualSpendToman, 0);

  const visibleKpis =
    kpiGroupFilter === 'همه'
      ? KPI_5YEAR_TARGETS
      : KPI_5YEAR_TARGETS.filter((k) => k.group === kpiGroupFilter);

  return (
    <div className="min-w-0 space-y-6">
      {/* Top 4 Executive Metrics */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="شاخص‌های کلیدی لحظه‌ای">
        <div className="rounded-xl border border-[#e5dfd3] bg-white p-4">
          <p className="text-xs font-medium text-[#52586c]">فروش تجمیعی سال جاری مشتریان</p>
          <p className="tabular-nums mt-2 text-xl font-extrabold text-[#14192b]">
            {(totalAnnualRevenue / 1_000_000).toLocaleString('fa-IR', { maximumFractionDigits: 1 })}M تومان
          </p>
          <p className="mt-1 text-[11px] font-semibold text-[#16a34a]">
            همگام با ۳ سایت و ۲ شعبه حضوری
          </p>
        </div>

        <div className="rounded-xl border border-[#e5dfd3] bg-white p-4">
          <p className="text-xs font-medium text-[#52586c]">ارزش مادام‌العمر کل (CLV)</p>
          <p className="tabular-nums mt-2 text-xl font-extrabold text-[#14192b]">
            {(totalClv / 1_000_000).toLocaleString('fa-IR', { maximumFractionDigits: 1 })}M تومان
          </p>
          <p className="mt-1 text-[11px] text-[#52586c]">
            میانگین هر عضو: {(totalClv / Math.max(1, customers.length) / 1_000_000).toFixed(1)}M
          </p>
        </div>

        <div className="rounded-xl border border-[#e5dfd3] bg-white p-4">
          <p className="text-xs font-medium text-[#52586c]">شاخص رضایت لحظه‌ای (NPS)</p>
          <p className="tabular-nums mt-2 text-xl font-extrabold text-[#14192b]">
            +{avgNps.toLocaleString('fa-IR')}
          </p>
          <p className="mt-1 text-[11px] font-semibold text-[#16a34a]">
            هدف سال اول: +۵۰ | سال سوم: +۷۰
          </p>
        </div>

        <div className="rounded-xl border border-[#e5dfd3] bg-white p-4">
          <p className="text-xs font-medium text-[#52586c]">هشدار ریسک ریزش (Churn Risk)</p>
          <p className="tabular-nums mt-2 text-xl font-extrabold text-[#dc2626]">
            {atRiskCustomers.length.toLocaleString('fa-IR')} مشتری
          </p>
          <button
            type="button"
            onClick={() => onNavigateTab('followup')}
            className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-[#9a7622] hover:underline"
          >
            <span>ارسال به صف پیگیری Win-back</span>
            <ArrowLeft className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>
      </section>

      {/* Tier Distribution & Churn Alerts */}
      <div className="grid gap-6 lg:grid-cols-12">
        <section className="min-w-0 rounded-xl border border-[#e5dfd3] bg-white p-5 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e5dfd3] pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#9a7622]" aria-hidden="true" />
              <h2 className="text-sm font-extrabold text-[#14192b]">توزیع سطوح باشگاه مشتریان</h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('loyalty')}
              className="text-xs font-semibold text-[#9a7622] hover:underline"
            >
              مدیریت امتیازات و سطوح
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[460px] text-right text-xs">
              <thead>
                <tr className="border-b border-[#e5dfd3] text-[#52586c]">
                  <th className="py-2 font-semibold">سطح عضویت</th>
                  <th className="py-2 font-semibold">آستانه خرید سالانه</th>
                  <th className="py-2 font-semibold">تعداد عضو</th>
                  <th className="py-2 font-semibold">فروش تجمیعی</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0ece3]">
                {tierCounts.map((t) => (
                  <tr key={t.code} className="hover:bg-[#f7f6f2]">
                    <td className="py-2.5 font-bold text-[#14192b]">{t.nameFa}</td>
                    <td className="py-2.5 text-[#52586c]">{t.thresholdFa}</td>
                    <td className="tabular-nums py-2.5 font-bold text-[#14192b]">
                      {t.count.toLocaleString('fa-IR')}
                    </td>
                    <td className="tabular-nums py-2.5 font-semibold text-[#9a7622]">
                      {(t.revenue / 1_000_000).toLocaleString('fa-IR', { maximumFractionDigits: 1 })}M
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Geo Comparison Hamedan vs Tehran */}
          <div className="mt-5 grid gap-3 border-t border-[#e5dfd3] pt-4 sm:grid-cols-2">
            <div className="rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#14192b]">شعبه و بازار همدان</span>
                <span className="tabular-nums font-semibold text-[#52586c]">
                  {hamedanCustomers.length.toLocaleString('fa-IR')} عضو
                </span>
              </div>
              <p className="tabular-nums mt-1 text-base font-extrabold text-[#14192b]">
                {(hamedanRev / 1_000_000).toLocaleString('fa-IR', { maximumFractionDigits: 1 })}M تومان
              </p>
              <p className="mt-0.5 text-[11px] text-[#52586c]">ترجیح غالب: خرید حضوری + B2B</p>
            </div>
            <div className="rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#14192b]">شعبه و بازار تهران</span>
                <span className="tabular-nums font-semibold text-[#52586c]">
                  {tehranCustomers.length.toLocaleString('fa-IR')} عضو
                </span>
              </div>
              <p className="tabular-nums mt-1 text-base font-extrabold text-[#14192b]">
                {(tehranRev / 1_000_000).toLocaleString('fa-IR', { maximumFractionDigits: 1 })}M تومان
              </p>
              <p className="mt-0.5 text-[11px] text-[#52586c]">ترجیح غالب: اینستاگرام + سایت</p>
            </div>
          </div>
        </section>

        {/* Churn Alerts Panel */}
        <section className="min-w-0 rounded-xl border border-[#e5dfd3] bg-white p-5 lg:col-span-5">
          <div className="flex items-center justify-between border-b border-[#e5dfd3] pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[#d97706]" aria-hidden="true" />
              <h2 className="text-sm font-extrabold text-[#14192b]">مشتریان نیازمند اقدام فوری</h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('customers')}
              className="text-xs font-semibold text-[#9a7622] hover:underline"
            >
              همه پروفایل‌ها
            </button>
          </div>

          <div className="mt-3 space-y-2.5">
            {atRiskCustomers.length === 0 ? (
              <p className="py-6 text-center text-xs text-[#52586c]">
                در حال حاضر هیچ مشتری با ریسک ریزش بالا ثبت نشده است.
              </p>
            ) : (
              atRiskCustomers.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[#e5dfd3] p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-[#14192b]">{c.fullName}</p>
                    <p className="mt-0.5 text-[11px] text-[#52586c]">
                      {c.city} · آخرین خرید {c.lastPurchaseDaysAgo.toLocaleString('fa-IR')} روز پیش ·
                      ریسک ریزش{' '}
                      <span className="tabular-nums font-bold text-[#dc2626]">
                        {c.scores.churnRiskPct.toLocaleString('fa-IR')}٪
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onInspectCustomer(c.id)}
                    className="shrink-0 whitespace-nowrap rounded-lg border border-[#e5dfd3] px-2.5 py-1.5 text-[11px] font-bold text-[#14192b] hover:bg-[#f7f6f2]"
                  >
                    پروفایل ۳۶۰
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Cohort Retention Matrix */}
      <section className="min-w-0 rounded-xl border border-[#e5dfd3] bg-white p-5">
        <div className="flex items-center gap-2 border-b border-[#e5dfd3] pb-3">
          <Users className="h-4 w-4 text-[#9a7622]" aria-hidden="true" />
          <h2 className="text-sm font-extrabold text-[#14192b]">تحلیل کوهورت (Cohort) و بازگشت مشتری</h2>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[600px] text-right text-xs">
            <thead>
              <tr className="border-b border-[#e5dfd3] text-[#52586c]">
                <th className="py-2 font-semibold">کوهورت جذب</th>
                <th className="py-2 font-semibold">تعداد مشتری</th>
                <th className="py-2 font-semibold">ماه ۱</th>
                <th className="py-2 font-semibold">ماه ۳</th>
                <th className="py-2 font-semibold">ماه ۶</th>
                <th className="py-2 font-semibold">ماه ۱۲</th>
                <th className="py-2 font-semibold">بهترین کانال (CLV)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0ece3]">
              {COHORT_MATRIX.map((row) => (
                <tr key={row.cohort} className="hover:bg-[#f7f6f2]">
                  <td className="py-2.5 font-bold text-[#14192b]">{row.cohort}</td>
                  <td className="tabular-nums py-2.5 text-[#52586c]">{row.size}</td>
                  <td className="tabular-nums py-2.5 font-semibold text-[#16a34a]">{row.m1}</td>
                  <td className="tabular-nums py-2.5 font-semibold text-[#14192b]">{row.m3}</td>
                  <td className="tabular-nums py-2.5 text-[#52586c]">{row.m6}</td>
                  <td className="tabular-nums py-2.5 text-[#52586c]">{row.m12}</td>
                  <td className="py-2.5 font-semibold text-[#9a7622]">{row.topChannel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 5-Year KPIs & Targets Table */}
      <section className="min-w-0 rounded-xl border border-[#e5dfd3] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5dfd3] pb-3">
          <div>
            <h2 className="text-sm font-extrabold text-[#14192b]">
              جدول شاخص‌های کلیدی (KPI) و اهداف ۵ ساله راسپینا
            </h2>
            <p className="mt-0.5 text-[11px] text-[#52586c]">
              منطبق با بخش شانزدهم سند جامع CRM و باشگاه مشتریان (۱۴۰۴–۱۴۰۸)
            </p>
          </div>
          <div className="flex flex-wrap gap-1 rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] p-1">
            {(['همه', 'درآمدی', 'وفاداری', 'کمپین', 'پشتیبانی'] as const).map((group) => (
              <button
                key={group}
                type="button"
                onClick={() => setKpiGroupFilter(group)}
                className={`whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  kpiGroupFilter === group
                    ? 'bg-[#14192b] text-white'
                    : 'text-[#52586c] hover:text-[#14192b]'
                }`}
              >
                {group}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[620px] text-right text-xs">
            <thead>
              <tr className="border-b border-[#e5dfd3] text-[#52586c]">
                <th className="py-2 font-semibold">حوزه</th>
                <th className="py-2 font-semibold">شاخص (KPI)</th>
                <th className="py-2 font-semibold">هدف سال ۱</th>
                <th className="py-2 font-semibold">سال ۲</th>
                <th className="py-2 font-semibold">سال ۳</th>
                <th className="py-2 font-semibold">افق سال ۵</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0ece3]">
              {visibleKpis.map((row) => (
                <tr key={row.name} className="hover:bg-[#f7f6f2]">
                  <td className="py-2.5 font-semibold text-[#9a7622]">{row.group}</td>
                  <td className="py-2.5 font-bold text-[#14192b]">{row.name}</td>
                  <td className="tabular-nums py-2.5 text-[#14192b]">{row.y1}</td>
                  <td className="tabular-nums py-2.5 text-[#52586c]">{row.y2}</td>
                  <td className="tabular-nums py-2.5 text-[#52586c]">{row.y3}</td>
                  <td className="tabular-nums py-2.5 font-bold text-[#16a34a]">{row.y5}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
