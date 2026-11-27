import { useState } from 'react';
import { BookOpen, Headphones, Megaphone, ShieldAlert } from 'lucide-react';
import { getTierSpec, validateCampaignSendPolicy } from '../utils/crmEngine';
import type { CampaignItem, Customer360, SupportTicket } from '../types/crm';

interface SupportCampaignsViewProps {
  customers: Customer360[];
  tickets: SupportTicket[];
  campaigns: CampaignItem[];
  onCreateTicket: (input: {
    customerId: string;
    channel: SupportTicket['channel'];
    category: SupportTicket['category'];
    subject: string;
  }) => void;
  onAdvanceTicket: (ticketId: string) => void;
  onToggleCampaign: (campaignId: string) => void;
  onCreateCampaign: (input: {
    title: string;
    channel: CampaignItem['channel'];
    targetSegment: string;
    templateWithTokens: string;
  }) => void;
}

const KB_ARTICLES = [
  { title: 'راهنمای جامع اندازه‌گیری قد مانتو و دور سینه (سایز ۳۶ تا ۴۶)', views: '۱,۸۴۰ بازدید' },
  { title: 'شرایط شستشو و نگهداری حریر ابریشم و کرپ مازراتی', views: '۱,۱۲۰ بازدید' },
  { title: 'قوانین تعویض سایز و بازگشت وجه ۲۴ ساعته در راسپینا', views: '۹۶۰ بازدید' },
];

export function SupportCampaignsView({
  customers,
  tickets,
  campaigns,
  onCreateTicket,
  onAdvanceTicket,
  onToggleCampaign,
  onCreateCampaign,
}: SupportCampaignsViewProps) {
  const [subTab, setSubTab] = useState<'support' | 'campaigns'>('support');

  // New Ticket State
  const [ticketCustId, setTicketCustId] = useState(customers[0]?.id ?? '');
  const [ticketChannel, setTicketChannel] = useState<SupportTicket['channel']>('تلگرام');
  const [ticketCat, setTicketCat] = useState<SupportTicket['category']>('سایز و موجودی');
  const [ticketSubject, setTicketSubject] = useState('');

  // Policy Simulator State
  const [simHour, setSimHour] = useState(14);
  const [simCustId, setSimCustId] = useState(customers[2]?.id ?? customers[0]?.id ?? '');
  const [simChannel, setSimChannel] = useState<CampaignItem['channel']>('SMS');

  // New Campaign State
  const [cmpTitle, setCmpTitle] = useState('');
  const [cmpTarget, setCmpTarget] = useState('VIP Black & Platinum');
  const [cmpTemplate, setCmpTemplate] = useState(
    'سلام {نام} عزیز ({سطح})؛ کلکسیون جدید با امتیاز {امتیاز} در انتظار شماست.'
  );

  const simCust = customers.find((c) => c.id === simCustId) ?? customers[0];
  const policyCheck = simCust
    ? validateCampaignSendPolicy({
        hourOfDay: simHour,
        smsSentThisWeek: simCust.smsSentThisWeek,
        unsubscribedMarketing: simCust.unsubscribedMarketing,
        isSmsChannel: simChannel === 'SMS',
      })
    : { allowed: true, reasonFa: '' };

  const handleTicketSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketCustId || !ticketSubject.trim()) return;
    onCreateTicket({
      customerId: ticketCustId,
      channel: ticketChannel,
      category: ticketCat,
      subject: ticketSubject.trim(),
    });
    setTicketSubject('');
  };

  const handleCampaignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cmpTitle.trim() || !cmpTemplate.trim()) return;
    onCreateCampaign({
      title: cmpTitle.trim(),
      channel: simChannel,
      targetSegment: cmpTarget,
      templateWithTokens: cmpTemplate.trim(),
    });
    setCmpTitle('');
  };

  return (
    <div className="min-w-0 space-y-6">
      {/* Sub-navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e5dfd3] bg-white p-3">
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setSubTab('support')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold ${
              subTab === 'support'
                ? 'bg-[#14192b] text-white'
                : 'bg-[#f7f6f2] text-[#4b5063] hover:text-[#14192b]'
            }`}
          >
            <Headphones className="h-3.5 w-3.5" aria-hidden="true" />
            <span>پشتیبانی و Helpdesk (SLA سطوح)</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('campaigns')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold ${
              subTab === 'campaigns'
                ? 'bg-[#14192b] text-white'
                : 'bg-[#f7f6f2] text-[#4b5063] hover:text-[#14192b]'
            }`}
          >
            <Megaphone className="h-3.5 w-3.5" aria-hidden="true" />
            <span>کمپین‌های چندکاناله و قوانین ارسال</span>
          </button>
        </div>
        <span className="text-[11px] font-semibold text-[#52586c]">
          Blackout: ۲۳:۰۰–۰۸:۰۰ · سقف پیامک: ۲ بار/هفته
        </span>
      </div>

      {subTab === 'support' ? (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Unified Ticket Queue */}
          <section className="min-w-0 rounded-xl border border-[#e5dfd3] bg-white p-5 lg:col-span-8">
            <h2 className="border-b border-[#e5dfd3] pb-3 text-sm font-extrabold text-[#14192b]">
              اینباکس یکپارچه تیکت‌ها (مرتب‌سازی بر اساس SLA باشگاه)
            </h2>

            <div className="mt-4 space-y-3">
              {tickets.map((t) => {
                const tier = getTierSpec(t.tierCode);
                return (
                  <div
                    key={t.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e5dfd3] bg-[#f7f6f2] p-3.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-mono-code font-bold text-[#14192b]">
                          {t.ticketCode}
                        </span>
                        <span className="font-bold text-[#14192b]">{t.customerName}</span>
                        <span className="rounded bg-[#14192b] px-1.5 py-0.5 text-[10px] font-bold text-[#e2c275]">
                          {tier.nameFa} · SLA {t.firstReplySlaHours}h/{t.resolutionSlaHours}h
                        </span>
                        <span className="text-[11px] text-[#52586c]">[{t.channel}]</span>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-[#14192b]">{t.subject}</p>
                      <p className="mt-0.5 text-[11px] text-[#52586c]">
                        دسته: {t.category} · مسئول: {t.assignee} · {t.createdAt}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {t.status !== 'resolved' ? (
                        <button
                          type="button"
                          onClick={() => onAdvanceTicket(t.id)}
                          className="rounded-lg bg-[#c9a84c] px-3 py-1.5 text-xs font-bold text-[#14192b] hover:bg-[#d8b85e]"
                        >
                          {t.status === 'open' ? 'شروع بررسی' : 'بستن و ثبت رزولوشن'}
                        </button>
                      ) : (
                        <span className="rounded-md bg-[#dcfce7] px-2.5 py-1 text-[11px] font-bold text-[#16a34a]">
                          حل‌شده
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* New Ticket + SLA Reference + KB */}
          <section className="min-w-0 space-y-4 lg:col-span-4">
            <form
              onSubmit={handleTicketSubmit}
              className="space-y-3 rounded-xl border border-[#e5dfd3] bg-white p-4 text-xs"
            >
              <h3 className="font-extrabold text-[#14192b]">ثبت تیکت جدید (تشخیص خودکار SLA)</h3>
              <select
                aria-label="مشتری تیکت"
                value={ticketCustId}
                onChange={(e) => setTicketCustId(e.target.value)}
                className="w-full rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-2.5 py-2"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} ({getTierSpec(c.tierCode).nameFa})
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <select
                  aria-label="کانال ورودی تیکت"
                  value={ticketChannel}
                  onChange={(e) => setTicketChannel(e.target.value as SupportTicket['channel'])}
                  className="rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-2 py-2"
                >
                  <option value="تلگرام">تلگرام</option>
                  <option value="اینستاگرام">اینستاگرام</option>
                  <option value="واتساپ">واتساپ</option>
                  <option value="سایت">سایت</option>
                  <option value="تلفن">تلفن</option>
                </select>
                <select
                  aria-label="موضوع دسته‌بندی تیکت"
                  value={ticketCat}
                  onChange={(e) => setTicketCat(e.target.value as SupportTicket['category'])}
                  className="rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-2 py-2"
                >
                  <option value="سایز و موجودی">سایز و موجودی</option>
                  <option value="مرجوعی و تعویض">مرجوعی و تعویض</option>
                  <option value="کیفیت محصول">کیفیت محصول</option>
                  <option value="پیگیری ارسال">پیگیری ارسال</option>
                  <option value="باشگاه مشتریان">باشگاه مشتریان</option>
                </select>
              </div>
              <input
                type="text"
                aria-label="شرح تیکت"
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
                placeholder="شرح درخواست یا مشکل مشتری..."
                className="w-full rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-3 py-2"
              />
              <button
                type="submit"
                className="w-full rounded-lg bg-[#14192b] py-2 font-bold text-white hover:bg-[#1e2540]"
              >
                ثبت تیکت در اینباکس
              </button>
            </form>

            <div className="rounded-xl border border-[#e5dfd3] bg-white p-4 text-xs">
              <div className="flex items-center gap-1.5 font-extrabold text-[#14192b]">
                <BookOpen className="h-3.5 w-3.5 text-[#9a7622]" aria-hidden="true" />
                <span>پایگاه دانش (Knowledge Base)</span>
              </div>
              <ul className="mt-2.5 space-y-2 text-[11px]">
                {KB_ARTICLES.map((art) => (
                  <li key={art.title} className="rounded bg-[#f7f6f2] p-2">
                    <p className="font-bold text-[#14192b]">{art.title}</p>
                    <p className="tabular-nums text-[#52586c]">{art.views}</p>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Campaigns List */}
          <section className="min-w-0 rounded-xl border border-[#e5dfd3] bg-white p-5 lg:col-span-7">
            <h2 className="border-b border-[#e5dfd3] pb-3 text-sm font-extrabold text-[#14192b]">
              کمپین‌های فعال و تریگرهای هوشمند
            </h2>
            <div className="mt-4 space-y-3">
              {campaigns.map((cmp) => (
                <div
                  key={cmp.id}
                  className="rounded-xl border border-[#e5dfd3] bg-[#f7f6f2] p-4 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-extrabold text-[#14192b]">{cmp.title}</p>
                      <p className="mt-0.5 text-[11px] text-[#52586c]">
                        کانال: {cmp.channel} · هدف: {cmp.targetSegment}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onToggleCampaign(cmp.id)}
                      className={`rounded-lg px-3 py-1.5 text-[11px] font-bold ${
                        cmp.isActive
                          ? 'bg-[#dcfce7] text-[#16a34a]'
                          : 'bg-white text-[#52586c] border border-[#e5dfd3]'
                      }`}
                    >
                      {cmp.isActive ? 'فعال (در حال اجرا)' : 'متوقف'}
                    </button>
                  </div>
                  <p className="mt-2 rounded bg-white px-2.5 py-1.5 text-[11px] text-[#4b5063]">
                    الگو: {cmp.templateWithTokens}
                  </p>
                  <div className="tabular-nums mt-2 flex flex-wrap gap-4 text-[11px] font-semibold text-[#14192b]">
                    <span>ارسال: {cmp.sentCount.toLocaleString('fa-IR')}</span>
                    <span>نرخ مشاهده: {cmp.openOrReadRatePct}٪</span>
                    <span>تبدیل: {cmp.conversionRatePct}٪</span>
                    <span className="text-[#9a7622]">
                      درآمد: {(cmp.revenueToman / 1_000_000).toLocaleString('fa-IR')}M ت
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Policy Guard & New Campaign Builder */}
          <section className="min-w-0 space-y-4 lg:col-span-5">
            <div className="rounded-xl border border-[#e5dfd3] bg-white p-4 text-xs">
              <div className="flex items-center gap-1.5 font-extrabold text-[#14192b]">
                <ShieldAlert className="h-4 w-4 text-[#9a7622]" aria-hidden="true" />
                <span>بررسی قوانین ارسال (Blackout 23–08 & Cap 2 SMS)</span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-[#52586c]" htmlFor="pol-cust">
                    مشتری نمونه
                  </label>
                  <select
                    id="pol-cust"
                    value={simCust?.id ?? ''}
                    onChange={(e) => setSimCustId(e.target.value)}
                    className="w-full rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-2 py-1.5"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName} ({c.smsSentThisWeek} SMS/هفته)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-[#52586c]" htmlFor="pol-hour">
                    ساعت ارسال (۰–۲۳)
                  </label>
                  <input
                    id="pol-hour"
                    type="number"
                    min={0}
                    max={23}
                    value={simHour}
                    onChange={(e) => setSimHour(Math.min(23, Math.max(0, Number(e.target.value))))}
                    className="tabular-nums w-full rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-2.5 py-1.5 font-bold"
                  />
                </div>
              </div>

              <div
                className={`mt-3 rounded-lg p-3 text-[11px] font-bold ${
                  policyCheck.allowed
                    ? 'bg-[#dcfce7] text-[#16a34a]'
                    : 'bg-[#fee2e2] text-[#dc2626]'
                }`}
              >
                {policyCheck.reasonFa}
              </div>
            </div>

            <form
              onSubmit={handleCampaignSubmit}
              className="space-y-3 rounded-xl border border-[#e5dfd3] bg-white p-4 text-xs"
            >
              <h3 className="font-extrabold text-[#14192b]">ایجاد کمپین شخصی‌سازی‌شده جدید</h3>
              <input
                type="text"
                aria-label="عنوان کمپین"
                value={cmpTitle}
                onChange={(e) => setCmpTitle(e.target.value)}
                placeholder="عنوان کمپین (مثلاً: پیش‌فروش کلکسیون زمستان)"
                className="w-full rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-3 py-2"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  aria-label="کانال کمپین"
                  value={simChannel}
                  onChange={(e) => setSimChannel(e.target.value as CampaignItem['channel'])}
                  className="rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-2 py-2"
                >
                  <option value="SMS">SMS</option>
                  <option value="واتساپ">واتساپ</option>
                  <option value="تلگرام">تلگرام</option>
                  <option value="ایمیل">ایمیل</option>
                </select>
                <input
                  type="text"
                  aria-label="سگمنت هدف"
                  value={cmpTarget}
                  onChange={(e) => setCmpTarget(e.target.value)}
                  className="rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-2.5 py-2"
                />
              </div>
              <textarea
                aria-label="متن پیام با توکن‌های شخصی‌سازی"
                rows={2}
                value={cmpTemplate}
                onChange={(e) => setCmpTemplate(e.target.value)}
                className="w-full rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] p-2.5"
              />
              <button
                type="submit"
                className="w-full rounded-lg bg-[#14192b] py-2 font-bold text-white hover:bg-[#1e2540]"
              >
                ذخیره و فعال‌سازی کمپین
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
