import { useState } from 'react';
import { CheckCircle2, PhoneCall, RotateCcw } from 'lucide-react';
import { getTierSpec } from '../utils/crmEngine';
import type { Customer360, FollowUpTask, RmaRequest } from '../types/crm';

interface FollowUpRmaViewProps {
  customers: Customer360[];
  tasks: FollowUpTask[];
  rmas: RmaRequest[];
  onCompleteFollowUp: (taskId: string, npsScore: number, note: string) => void;
  onCreateRma: (input: {
    customerId: string;
    orderId: string;
    productTitle: string;
    reason: RmaRequest['reason'];
    refundAmountToman: number;
    refundTarget: RmaRequest['refundTarget'];
  }) => void;
  onAdvanceRma: (rmaId: string) => void;
}

const FOLLOWUP_STAGES_GUIDE = [
  { when: 'بلافاصله', title: 'تأیید سفارش هوشمند', desc: 'SMS/ایمیل رهگیری + تماس تشکر برای VIP' },
  { when: '۲۴س بعد تحویل', title: 'NPS سریع', desc: '۳ گزینه؛ در صورت مشکل ← تیکت فوری + تماس زیر ۲س' },
  { when: '۷ روز بعد', title: 'نظر کامل + UGC', desc: 'دعوت ثبت نظر و عکس در اینستاگرام (+۵۰۰ امتیاز)' },
  { when: '۳۰ روز بعد', title: 'Cross-sell هوشمند', desc: 'پیشنهاد ۳–۵ محصول مکمل + کد تخفیف ۱۰٪' },
  { when: '۹۰ روز بعد', title: 'Win-back یا Upsell', desc: 'تخفیف ۱۵٪ بازگشت یا ارتقاء سطح باشگاه' },
  { when: 'سالگرد خرید', title: 'برنامه سالگرد', desc: 'کارت دیجیتال شخصی + ۲X امتیاز در روز سالگرد' },
];

export function FollowUpRmaView({
  customers,
  tasks,
  rmas,
  onCompleteFollowUp,
  onCreateRma,
  onAdvanceRma,
}: FollowUpRmaViewProps) {
  const [stageFilter, setStageFilter] = useState<'all' | 'pending' | 'completed' | 'escalated'>('all');
  const [npsInputs, setNpsInputs] = useState<Record<string, number>>({});
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});

  // New RMA form
  const [rmaCustomerId, setRmaCustomerId] = useState(customers[0]?.id ?? '');
  const [rmaProduct, setRmaProduct] = useState('شومیز حریر ابریشم یقه کرواتی');
  const [rmaReason, setRmaReason] = useState<RmaRequest['reason']>('عدم تطابق سایز');
  const [rmaAmount, setRmaAmount] = useState(1_680_000);
  const [rmaTarget, setRmaTarget] = useState<RmaRequest['refundTarget']>('wallet');

  const filteredTasks =
    stageFilter === 'all' ? tasks : tasks.filter((t) => t.status === stageFilter);

  const handleSubmitRma = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rmaCustomerId || !rmaProduct.trim() || rmaAmount <= 0) return;
    const cust = customers.find((c) => c.id === rmaCustomerId);
    const orderId = cust?.orders[0]?.externalOrderId ?? 'RSH-MANUAL';
    onCreateRma({
      customerId: rmaCustomerId,
      orderId,
      productTitle: rmaProduct.trim(),
      reason: rmaReason,
      refundAmountToman: rmaAmount,
      refundTarget: rmaTarget,
    });
    setRmaProduct('');
  };

  return (
    <div className="min-w-0 space-y-6">
      {/* 6-Stage Automation Strip */}
      <section className="rounded-xl border border-[#e5dfd3] bg-white p-5">
        <h2 className="text-sm font-extrabold text-[#14192b]">
          چرخه ۶ مرحله‌ای پیگیری خودکار پس از خرید (هیچ مشتری فراموش نمی‌شود)
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {FOLLOWUP_STAGES_GUIDE.map((st) => (
            <div key={st.when} className="rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] p-3">
              <p className="text-[10px] font-bold text-[#9a7622]">{st.when}</p>
              <p className="mt-1 text-xs font-extrabold text-[#14192b]">{st.title}</p>
              <p className="mt-1 text-[11px] leading-5 text-[#52586c]">{st.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Active Follow-Up Queue */}
      <section className="rounded-xl border border-[#e5dfd3] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5dfd3] pb-3">
          <div className="flex items-center gap-2">
            <PhoneCall className="h-4 w-4 text-[#9a7622]" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-extrabold text-[#14192b]">
                صف وظایف پیگیری خودکار (ثبت NPS زیر ۷ ← تیکت فوری خودکار)
              </h2>
              <p className="text-[11px] text-[#52586c]">
                با ثبت امتیاز NPS ≤ ۶ سیستم بلافاصله تیکت شکایت/پیگیری با SLA سطح مشتری باز می‌کند
              </p>
            </div>
          </div>

          <div className="flex gap-1 rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] p-1">
            {([
              { id: 'all', label: 'همه' },
              { id: 'pending', label: 'در انتظار' },
              { id: 'escalated', label: 'ارجاع به تیکت' },
              { id: 'completed', label: 'انجام‌شده' },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStageFilter(tab.id)}
                className={`whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-bold ${
                  stageFilter === tab.id
                    ? 'bg-[#14192b] text-white'
                    : 'text-[#52586c] hover:text-[#14192b]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {filteredTasks.length === 0 ? (
            <p className="py-6 text-center text-xs text-[#52586c]">وظیفه‌ای در این وضعیت نیست.</p>
          ) : (
            filteredTasks.map((task) => {
              const tier = getTierSpec(task.tierCode);
              const npsVal = npsInputs[task.id] ?? 9;
              const noteVal = noteInputs[task.id] ?? '';

              return (
                <div
                  key={task.id}
                  className="rounded-xl border border-[#e5dfd3] bg-[#f7f6f2] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-extrabold text-[#14192b]">
                          {task.customerName}
                        </span>
                        <span className="rounded bg-[#14192b] px-1.5 py-0.5 text-[10px] font-bold text-[#e2c275]">
                          {tier.nameFa}
                        </span>
                        <span className="font-mono-code text-[11px] text-[#52586c]">
                          سفارش {task.orderId}
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-bold text-[#9a7622]">{task.stageLabelFa}</p>
                      <p className="mt-0.5 text-[11px] text-[#4b5063]">
                        کانال: {task.channel} · پیشنهاد: {task.suggestedOffer}
                      </p>
                    </div>

                    <span
                      className={`rounded-md px-2 py-1 text-[11px] font-bold ${
                        task.status === 'escalated'
                          ? 'bg-[#fee2e2] text-[#dc2626]'
                          : task.status === 'completed'
                            ? 'bg-[#dcfce7] text-[#16a34a]'
                            : 'bg-white text-[#d97706]'
                      }`}
                    >
                      {task.status === 'escalated'
                        ? 'ارجاع‌شده به پشتیبانی (NPS پایین)'
                        : task.status === 'completed'
                          ? 'تکمیل‌شده'
                          : task.dueLabelFa}
                    </span>
                  </div>

                  {task.status === 'pending' ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#e5dfd3] pt-3">
                      <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#14192b]">
                        <span>امتیاز NPS (۰ تا ۱۰):</span>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          aria-label={`امتیاز NPS برای ${task.customerName}`}
                          value={npsVal}
                          onChange={(e) =>
                            setNpsInputs({
                              ...npsInputs,
                              [task.id]: Math.min(10, Math.max(0, Number(e.target.value))),
                            })
                          }
                          className="tabular-nums w-16 rounded-lg border border-[#e5dfd3] bg-white px-2 py-1 text-xs font-bold"
                        />
                      </label>
                      <input
                        type="text"
                        aria-label={`یادداشت پیگیری ${task.customerName}`}
                        value={noteVal}
                        onChange={(e) => setNoteInputs({ ...noteInputs, [task.id]: e.target.value })}
                        placeholder="نتیجه تماس/پاسخ مشتری..."
                        className="w-full min-w-0 flex-1 rounded-lg border border-[#e5dfd3] bg-white px-3 py-1.5 text-xs sm:w-auto sm:min-w-[180px]"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          onCompleteFollowUp(
                            task.id,
                            npsVal,
                            noteVal.trim() || 'پیگیری انجام و ثبت شد.'
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-lg bg-[#14192b] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#1e2540]"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#e2c275]" aria-hidden="true" />
                        <span>ثبت نتیجه پیگیری</span>
                      </button>
                    </div>
                  ) : (
                    <p className="mt-2 border-t border-[#e5dfd3] pt-2 text-[11px] text-[#52586c]">
                      NPS ثبت‌شده: <strong className="tabular-nums">{task.npsRecorded}</strong> ·{' '}
                      {task.outcomeNote}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Unified RMA Return Management */}
      <section className="rounded-xl border border-[#e5dfd3] bg-white p-5">
        <div className="flex items-center gap-2 border-b border-[#e5dfd3] pb-3">
          <RotateCcw className="h-4 w-4 text-[#9a7622]" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-extrabold text-[#14192b]">
              مدیریت یکپارچه مرجوعی و تعویض (RMA + بازگشت به کیف پول)
            </h2>
            <p className="text-[11px] text-[#52586c]">
              تأیید زیر ۲ ساعت، هماهنگی پیک رایگان برای پلاتینیوم/VIP و واریز مستقیم به کیف پول
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-5 lg:grid-cols-12">
          <div className="min-w-0 space-y-2.5 lg:col-span-7">
            {rmas.map((rma) => (
              <div
                key={rma.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] p-3.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-mono-code font-bold text-[#14192b]">{rma.rmaCode}</span>
                    <span className="font-bold text-[#14192b]">{rma.customerName}</span>
                    <span className="text-[#52586c]">({rma.reason})</span>
                  </div>
                  <p className="mt-1 text-xs text-[#4b5063]">
                    {rma.productTitle} —{' '}
                    <strong className="tabular-nums">
                      {rma.refundAmountToman.toLocaleString('fa-IR')} تومان
                    </strong>{' '}
                    ({rma.refundTarget === 'wallet' ? 'واریز به کیف پول' : 'کارت بانکی'})
                  </p>
                </div>

                {rma.status !== 'refunded' ? (
                  <button
                    type="button"
                    onClick={() => onAdvanceRma(rma.id)}
                    className="rounded-lg bg-[#c9a84c] px-3 py-1.5 text-xs font-bold text-[#14192b] hover:bg-[#d8b85e]"
                  >
                    {rma.status === 'pending_review'
                      ? 'تأیید و صدور کد مرجوع'
                      : 'تکمیل مرجوع و شارژ کیف‌پول'}
                  </button>
                ) : (
                  <span className="rounded-md bg-[#dcfce7] px-2.5 py-1 text-[11px] font-bold text-[#16a34a]">
                    وجه بازگردانده شد
                  </span>
                )}
              </div>
            ))}
          </div>

          <form
            onSubmit={handleSubmitRma}
            className="min-w-0 space-y-3 rounded-lg border border-[#e5dfd3] p-4 text-xs lg:col-span-5"
          >
            <h3 className="font-extrabold text-[#14192b]">ثبت درخواست مرجوع جدید</h3>
            <div>
              <label className="mb-1 block text-[11px] font-bold text-[#52586c]" htmlFor="rma-cust">
                مشتری
              </label>
              <select
                id="rma-cust"
                value={rmaCustomerId}
                onChange={(e) => setRmaCustomerId(e.target.value)}
                className="w-full rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-2.5 py-2"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} ({getTierSpec(c.tierCode).nameFa})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold text-[#52586c]" htmlFor="rma-prod">
                نام کالا
              </label>
              <input
                id="rma-prod"
                type="text"
                value={rmaProduct}
                onChange={(e) => setRmaProduct(e.target.value)}
                className="w-full rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-3 py-2"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[11px] font-bold text-[#52586c]" htmlFor="rma-reason">
                  دلیل مرجوعی
                </label>
                <select
                  id="rma-reason"
                  value={rmaReason}
                  onChange={(e) => setRmaReason(e.target.value as RmaRequest['reason'])}
                  className="w-full rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-2 py-2"
                >
                  <option value="عدم تطابق سایز">عدم تطابق سایز</option>
                  <option value="ایراد دوخت">ایراد دوخت</option>
                  <option value="عدم تطابق رنگ">عدم تطابق رنگ</option>
                  <option value="تغییر سلیقه">تغییر سلیقه</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold text-[#52586c]" htmlFor="rma-amt">
                  مبلغ بازگشت (تومان)
                </label>
                <input
                  id="rma-amt"
                  type="number"
                  min={100000}
                  step={10000}
                  value={rmaAmount}
                  onChange={(e) => setRmaAmount(Number(e.target.value))}
                  className="tabular-nums w-full rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-2.5 py-2 font-bold"
                />
              </div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold">
                <input
                  type="checkbox"
                  checked={rmaTarget === 'wallet'}
                  onChange={(e) => setRmaTarget(e.target.checked ? 'wallet' : 'bank_card')}
                />
                <span>بازگشت آنی به کیف پول راسپینا</span>
              </label>
              <button
                type="submit"
                className="rounded-lg bg-[#14192b] px-3.5 py-2 font-bold text-white hover:bg-[#1e2540]"
              >
                ثبت RMA
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
