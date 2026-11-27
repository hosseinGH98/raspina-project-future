import { useState } from 'react';
import { Award, Crown, Gift, Users } from 'lucide-react';
import {
  GAMIFICATION_BADGES,
  LOYALTY_TIERS,
  POINT_EARN_RULES,
  POINT_REDEEM_RULES,
  SURPRISE_BOX_PLANS,
  WEEKLY_CHALLENGES,
} from '../data/crmSeed';
import { getTierSpec } from '../utils/crmEngine';
import type {
  Customer360,
  FamilyGroup,
  GiftCardRecord,
  LoyaltyTransaction,
} from '../types/crm';

interface LoyaltyClubViewProps {
  customers: Customer360[];
  transactions: LoyaltyTransaction[];
  familyGroups: FamilyGroup[];
  giftCards: GiftCardRecord[];
  onAwardPoints: (customerId: string, actionFa: string, points: number) => void;
  onRedeemReward: (
    customerId: string,
    rewardFa: string,
    pointsRequired: number,
    walletCreditToman?: number
  ) => void;
  onIssueGiftCard: (input: {
    occasion: GiftCardRecord['occasion'];
    amountToman: number;
    recipientPhone: string;
    deliveryChannel: GiftCardRecord['deliveryChannel'];
  }) => void;
}

export function LoyaltyClubView({
  customers,
  transactions,
  familyGroups,
  giftCards,
  onAwardPoints,
  onRedeemReward,
  onIssueGiftCard,
}: LoyaltyClubViewProps) {
  const [selectedMemberId, setSelectedMemberId] = useState(customers[0]?.id ?? '');
  const [redeemFeedback, setRedeemFeedback] = useState('');

  // Gift card state
  const [gcOccasion, setGcOccasion] = useState<GiftCardRecord['occasion']>('تولد');
  const [gcAmount, setGcAmount] = useState(2_000_000);
  const [gcPhone, setGcPhone] = useState('09123334455');
  const [gcChannel, setGcChannel] = useState<GiftCardRecord['deliveryChannel']>('واتساپ');

  const activeMember = customers.find((c) => c.id === selectedMemberId) ?? customers[0];
  const activeTier = activeMember ? getTierSpec(activeMember.tierCode) : LOYALTY_TIERS[0];

  const leaderboard = [...customers].sort((a, b) => b.pointsBalance - a.pointsBalance);

  const handleRedeem = (
    rewardFa: string,
    pointsRequired: number,
    walletCreditToman?: number
  ) => {
    if (!activeMember) return;
    if (activeMember.pointsBalance < pointsRequired) {
      setRedeemFeedback(
        `موجودی امتیاز ${activeMember.fullName} (${activeMember.pointsBalance.toLocaleString('fa-IR')}) برای «${rewardFa}» کافی نیست.`
      );
      return;
    }
    onRedeemReward(activeMember.id, rewardFa, pointsRequired, walletCreditToman);
    setRedeemFeedback(
      `جایزه «${rewardFa}» برای ${activeMember.fullName} صادر و ${pointsRequired.toLocaleString('fa-IR')} امتیاز کسر شد.`
    );
  };

  const handleIssueGift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gcPhone.trim() || gcAmount < 100_000) return;
    onIssueGiftCard({
      occasion: gcOccasion,
      amountToman: gcAmount,
      recipientPhone: gcPhone.trim(),
      deliveryChannel: gcChannel,
    });
  };

  return (
    <div className="min-w-0 space-y-6">
      {/* 4 Loyalty Tiers Spec Grid */}
      <section className="rounded-xl border border-[#e5dfd3] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e5dfd3] pb-3">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-[#9a7622]" aria-hidden="true" />
            <h2 className="text-sm font-extrabold text-[#14192b]">
              چهار سطح رسمی باشگاه مشتریان راسپینا (مطابق بخش هشتم سند جامع)
            </h2>
          </div>
          <span className="text-[11px] font-semibold text-[#52586c]">
            انقضای امتیاز: پس از ۱۲ ماه عدم فعالیت (هشدار ۳۰ روز قبل)
          </span>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {LOYALTY_TIERS.map((tier) => (
            <div
              key={tier.code}
              className={`flex flex-col rounded-xl border p-4 ${
                tier.code === 'vip_black'
                  ? 'border-[#14192b] bg-[#14192b] text-white'
                  : 'border-[#e5dfd3] bg-[#f7f6f2] text-[#14192b]'
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold">{tier.nameFa}</h3>
                <span
                  className={`tabular-nums rounded px-2 py-0.5 text-[11px] font-bold ${
                    tier.code === 'vip_black'
                      ? 'bg-[#c9a84c] text-[#14192b]'
                      : 'bg-white text-[#9a7622]'
                  }`}
                >
                  {tier.pointsPer10k.toLocaleString('fa-IR')} امتیاز / ۱۰K
                </span>
              </div>
              <p
                className={`mt-1 text-[11px] ${
                  tier.code === 'vip_black' ? 'text-[#e2c275]' : 'text-[#52586c]'
                }`}
              >
                {tier.thresholdFa}
              </p>
              <ul
                className={`mt-3 space-y-1.5 text-[11px] ${
                  tier.code === 'vip_black' ? 'text-white/85' : 'text-[#4b5063]'
                }`}
              >
                {tier.perks.map((perk) => (
                  <li key={perk}>• {perk}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Interactive Points Earn & Redeem Console */}
      <section className="rounded-xl border border-[#e5dfd3] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5dfd3] pb-4">
          <div>
            <h2 className="text-sm font-extrabold text-[#14192b]">
              موتور عملیاتی امتیاز — کسب و خرج (Earn & Redeem)
            </h2>
            <p className="text-[11px] text-[#52586c]">
              عضو باشگاه را انتخاب کنید تا امتیاز فعالیت‌ها را ثبت یا جوایز را به کیف پول/کد تخفیف تبدیل کنید
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label="انتخاب عضو باشگاه مشتریان"
              value={activeMember?.id ?? ''}
              onChange={(e) => {
                setSelectedMemberId(e.target.value);
                setRedeemFeedback('');
              }}
              className="rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-3 py-2 text-xs font-bold text-[#14192b]"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName} — {getTierSpec(c.tierCode).nameFa} ({c.pointsBalance.toLocaleString('fa-IR')} امتیاز)
                </option>
              ))}
            </select>
          </div>
        </div>

        {activeMember && (
          <div className="mt-4 grid gap-4 rounded-xl border border-[#e5dfd3] bg-[#f7f6f2] p-4 sm:grid-cols-4">
            <div>
              <p className="text-[11px] text-[#52586c]">عضو انتخاب‌شده</p>
              <p className="mt-1 text-sm font-extrabold text-[#14192b]">{activeMember.fullName}</p>
            </div>
            <div>
              <p className="text-[11px] text-[#52586c]">سطح و ضریب خرید</p>
              <p className="tabular-nums mt-1 text-sm font-extrabold text-[#9a7622]">
                {activeTier.nameFa} ({activeTier.pointsPer10k}×)
              </p>
            </div>
            <div>
              <p className="text-[11px] text-[#52586c]">موجودی امتیاز قابل خرج</p>
              <p
                data-testid="active-member-points"
                className="tabular-nums mt-1 text-sm font-extrabold text-[#14192b]"
              >
                {activeMember.pointsBalance.toLocaleString('fa-IR')} امتیاز
              </p>
            </div>
            <div>
              <p className="text-[11px] text-[#52586c]">اعتبار کیف پول دیجیتال</p>
              <p className="tabular-nums mt-1 text-sm font-extrabold text-[#16a34a]">
                {activeMember.walletBalanceToman.toLocaleString('fa-IR')} تومان
              </p>
            </div>
          </div>
        )}

        {redeemFeedback && (
          <p className="mt-3 rounded-lg border border-[#e5dfd3] bg-[#fdfaf3] px-3 py-2 text-xs font-bold text-[#14192b]">
            {redeemFeedback}
          </p>
        )}

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {/* Earn Table */}
          <div>
            <h3 className="text-xs font-extrabold text-[#14192b]">ثبت امتیاز تعامل و رویداد</h3>
            <div className="mt-2.5 divide-y divide-[#f0ece3] rounded-lg border border-[#e5dfd3]">
              {POINT_EARN_RULES.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
                >
                  <span className="text-[#14192b]">{rule.actionFa}</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!activeMember) return;
                      onAwardPoints(activeMember.id, rule.actionFa, rule.points);
                      setRedeemFeedback(
                        `+${rule.points.toLocaleString('fa-IR')} امتیاز بابت «${rule.actionFa}» به حساب ${activeMember.fullName} اضافه شد.`
                      );
                    }}
                    className="tabular-nums shrink-0 rounded-md bg-[#14192b] px-2.5 py-1 text-[11px] font-bold text-[#e2c275] hover:bg-[#1e2540]"
                  >
                    +{rule.points.toLocaleString('fa-IR')} امتیاز
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Redeem Table */}
          <div>
            <h3 className="text-xs font-extrabold text-[#14192b]">خرج امتیاز (Redeem Rewards)</h3>
            <div className="mt-2.5 divide-y divide-[#f0ece3] rounded-lg border border-[#e5dfd3]">
              {POINT_REDEEM_RULES.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
                >
                  <span className="text-[#14192b]">{rule.rewardFa}</span>
                  <button
                    type="button"
                    onClick={() =>
                      handleRedeem(rule.rewardFa, rule.pointsRequired, rule.walletCreditToman)
                    }
                    className="tabular-nums shrink-0 rounded-md border border-[#c9a84c] bg-[#fdfaf3] px-2.5 py-1 text-[11px] font-bold text-[#9a7622] hover:bg-[#c9a84c] hover:text-[#14192b]"
                  >
                    خرج {rule.pointsRequired.toLocaleString('fa-IR')} امتیاز
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Ledger */}
        <div className="mt-5 border-t border-[#e5dfd3] pt-4">
          <h3 className="text-xs font-extrabold text-[#14192b]">
            دفتر کل تراکنش‌های امتیاز اخیر ({transactions.length.toLocaleString('fa-IR')})
          </h3>
          <div className="mt-2 max-h-48 overflow-y-auto divide-y divide-[#f0ece3] rounded-lg border border-[#e5dfd3]">
            {transactions.slice(0, 8).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between px-3 py-2 text-xs">
                <div>
                  <span className="font-bold text-[#14192b]">{tx.customerName}</span>
                  <span className="mx-1.5 text-[#52586c]">—</span>
                  <span className="text-[#4b5063]">{tx.actionFa}</span>
                </div>
                <span
                  className={`tabular-nums font-extrabold ${
                    tx.pointsDelta >= 0 ? 'text-[#16a34a]' : 'text-[#dc2626]'
                  }`}
                >
                  {tx.pointsDelta >= 0 ? `+${tx.pointsDelta}` : tx.pointsDelta}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gamification, Leaderboard, Family, Gift Cards, Surprise Box & B2B */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Leaderboard + Challenges + Badges */}
        <section className="min-w-0 rounded-xl border border-[#e5dfd3] bg-white p-5 lg:col-span-6">
          <div className="flex items-center gap-2 border-b border-[#e5dfd3] pb-3">
            <Award className="h-4 w-4 text-[#9a7622]" aria-hidden="true" />
            <h2 className="text-sm font-extrabold text-[#14192b]">
              گیمیفیکیشن، چالش‌ها و رده‌بندی (همدان vs تهران)
            </h2>
          </div>

          <div className="mt-4 space-y-2">
            {leaderboard.slice(0, 5).map((m, idx) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="tabular-nums inline-flex h-5 w-5 items-center justify-center rounded bg-[#14192b] text-[10px] font-bold text-[#e2c275]">
                    {idx + 1}
                  </span>
                  <span className="font-bold text-[#14192b]">{m.fullName}</span>
                  <span className="text-[11px] text-[#52586c]">({m.city})</span>
                </div>
                <span className="tabular-nums font-extrabold text-[#9a7622]">
                  {m.pointsBalance.toLocaleString('fa-IR')} امتیاز
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {WEEKLY_CHALLENGES.map((ch) => (
              <div key={ch.id} className="rounded-lg border border-[#e5dfd3] p-2.5 text-xs">
                <p className="font-bold text-[#14192b]">{ch.title}</p>
                <p className="mt-1 text-[11px] text-[#52586c]">
                  {ch.progressText} ·{' '}
                  <strong className="tabular-nums text-[#9a7622]">+{ch.rewardPts} امتیاز</strong>
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 border-t border-[#e5dfd3] pt-3">
            <p className="text-[11px] font-bold text-[#52586c]">نشان‌های (Badges) قابل دریافت:</p>
            <p className="mt-1 text-xs leading-6 text-[#14192b]">{GAMIFICATION_BADGES.join(' · ')}</p>
          </div>
        </section>

        {/* Family, Gift Card, Surprise Box & B2B */}
        <section className="min-w-0 space-y-4 rounded-xl border border-[#e5dfd3] bg-white p-5 lg:col-span-6">
          <div className="flex items-center gap-2 border-b border-[#e5dfd3] pb-3">
            <Gift className="h-4 w-4 text-[#9a7622]" aria-hidden="true" />
            <h2 className="text-sm font-extrabold text-[#14192b]">
              عضویت خانوادگی، کارت هدیه، جعبه سورپرایز و B2B
            </h2>
          </div>

          {/* Family Pooling */}
          <div className="rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] p-3.5 text-xs">
            <div className="flex items-center gap-1.5 font-extrabold text-[#14192b]">
              <Users className="h-3.5 w-3.5 text-[#9a7622]" aria-hidden="true" />
              <span>عضویت خانوادگی (حداکثر ۵ نفر با تجمیع امتیاز)</span>
            </div>
            {familyGroups.map((fg) => (
              <p key={fg.id} className="mt-1.5 text-[#4b5063]">
                <strong>{fg.familyName}</strong> ({fg.memberIds.length} عضو متصل) — مجموع امتیاز
                تجمیعی:{' '}
                <strong className="tabular-nums text-[#9a7622]">
                  {fg.combinedPoints.toLocaleString('fa-IR')}
                </strong>
              </p>
            ))}
          </div>

          {/* Digital Gift Card Issuer */}
          <form
            onSubmit={handleIssueGift}
            className="space-y-2.5 rounded-lg border border-[#e5dfd3] p-3.5 text-xs"
          >
            <h3 className="font-extrabold text-[#14192b]">صدور کارت هدیه دیجیتال (۱۰۰K تا ۱۰M)</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <select
                aria-label="مناسبت کارت هدیه"
                value={gcOccasion}
                onChange={(e) => setGcOccasion(e.target.value as GiftCardRecord['occasion'])}
                className="rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-2 py-1.5"
              >
                <option value="تولد">تولد</option>
                <option value="نوروز">نوروز</option>
                <option value="ازدواج">ازدواج</option>
                <option value="تشکر">تشکر</option>
              </select>
              <input
                type="number"
                aria-label="مبلغ کارت هدیه"
                min={100000}
                max={10000000}
                step={100000}
                value={gcAmount}
                onChange={(e) => setGcAmount(Number(e.target.value))}
                className="tabular-nums rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-2 py-1.5 font-bold"
              />
              <input
                type="tel"
                aria-label="شماره موبایل گیرنده"
                value={gcPhone}
                onChange={(e) => setGcPhone(e.target.value)}
                className="font-mono-code rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-2 py-1.5"
              />
              <select
                aria-label="کانال ارسال کارت هدیه"
                value={gcChannel}
                onChange={(e) =>
                  setGcChannel(e.target.value as GiftCardRecord['deliveryChannel'])
                }
                className="rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-2 py-1.5"
              >
                <option value="واتساپ">واتساپ</option>
                <option value="تلگرام">تلگرام</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#52586c]">
                کارت‌های فعال: {giftCards.length.toLocaleString('fa-IR')} کارت
              </span>
              <button
                type="submit"
                className="rounded-lg bg-[#14192b] px-3 py-1.5 font-bold text-white hover:bg-[#1e2540]"
              >
                صدور و ارسال کارت هدیه
              </button>
            </div>
          </form>

          {/* Surprise Box + B2B */}
          <div className="grid gap-2 sm:grid-cols-3">
            {SURPRISE_BOX_PLANS.map((plan) => (
              <div key={plan.name} className="rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] p-2.5 text-[11px]">
                <p className="font-bold text-[#14192b]">{plan.name}</p>
                <p className="mt-1 text-[#52586c]">{plan.detail}</p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-[#14192b] bg-[#14192b] p-3.5 text-xs text-white">
            <p className="font-extrabold text-[#e2c275]">
              برنامه وفاداری B2B و عمده‌فروشان (Corporate Loyalty)
            </p>
            <p className="mt-1 text-[11px] leading-6 text-white/80">
              امتیاز ۵X برای سفارش‌های عمده بالای ۵۰ میلیون تومان (آتلیه‌ها و بوتیک‌های همکار)،
              دسترسی اولیه به موجودی انبار سپیدار و پیش‌سفارش کلکسیون.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
