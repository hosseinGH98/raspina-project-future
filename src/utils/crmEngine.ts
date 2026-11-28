import { LOYALTY_TIERS } from '../data/crmSeed';
import type {
  ChannelKey,
  Customer360,
  CustomerScoreBreakdown,
  CustomSegmentRule,
  FollowUpTask,
  LoyaltyTierCode,
  LoyaltyTierSpec,
  RfmSegmentName,
} from '../types/crm';

const IRAN_MOBILE_NATIONAL = /^9\d{9}$/;

/** Converts Persian/Arabic-Indic digits to ASCII digits. */
export function toLatinDigits(input: string): string {
  return String(input ?? '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

/**
 * Normalizes any common Iranian mobile representation to E.164 (+98 9xxxxxxxxx).
 * Returns an empty string for invalid numbers so callers can reject them explicitly.
 */
export function normalizeIranPhone(raw: string): string {
  const cleaned = toLatinDigits(raw).replace(/[^\d+]/g, '');
  let national = cleaned.replace(/^\+/, '');

  if (national.startsWith('0098')) national = national.slice(4);
  else if (national.startsWith('98')) national = national.slice(2);
  else if (national.startsWith('0')) national = national.slice(1);

  return IRAN_MOBILE_NATIONAL.test(national) ? `+98${national}` : '';
}

export function isValidIranMobile(raw: string): boolean {
  return normalizeIranPhone(raw) !== '';
}

/** Formats an E.164 Iranian mobile for display without leaking nothing extra. */
export function formatIranPhone(phoneE164: string): string {
  const normalized = normalizeIranPhone(phoneE164);
  if (!normalized) return phoneE164;
  const national = normalized.slice(3);
  return `0${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`;
}

export function getTierSpec(code: LoyaltyTierCode): LoyaltyTierSpec {
  return LOYALTY_TIERS.find((t) => t.code === code) ?? LOYALTY_TIERS[0];
}

export interface TierProgress {
  current: LoyaltyTierSpec;
  next: LoyaltyTierSpec | null;
  amountToNextToman: number;
  progressPct: number;
}

export function getTierProgress(annualSpendToman: number): TierProgress {
  const spend = Number.isFinite(annualSpendToman) ? Math.max(0, annualSpendToman) : 0;
  const current = determineLoyaltyTier({ annualSpendToman: spend });
  const next = LOYALTY_TIERS.find((t) => t.minAnnualToman > current.minAnnualToman) ?? null;

  if (!next) {
    return { current, next: null, amountToNextToman: 0, progressPct: 100 };
  }

  const span = next.minAnnualToman - current.minAnnualToman;
  const progressPct =
    span > 0 ? Math.min(100, Math.max(0, Math.round(((spend - current.minAnnualToman) / span) * 100))) : 0;

  return {
    current,
    next,
    amountToNextToman: Math.max(0, next.minAnnualToman - spend),
    progressPct,
  };
}

export function determineLoyaltyTier(input: {
  annualSpendToman: number;
  manualVipInvited?: boolean;
}): LoyaltyTierSpec {
  const spend = Number.isFinite(input.annualSpendToman) ? Math.max(0, input.annualSpendToman) : 0;
  if (input.manualVipInvited || spend >= 50_000_000) {
    return getTierSpec('vip_black');
  }
  if (spend >= 15_000_000) {
    return getTierSpec('platinum');
  }
  if (spend >= 5_000_000) {
    return getTierSpec('gold');
  }
  return getTierSpec('bronze');
}

export function calculatePurchasePoints(input: {
  amountToman: number;
  tierCode: LoyaltyTierCode;
  isAnniversaryDay?: boolean;
  isB2BWholesale?: boolean;
}): { pointsEarned: number; walletCashbackToman: number } {
  const amount = Number.isFinite(input.amountToman) ? Math.max(0, input.amountToman) : 0;
  const spec = getTierSpec(input.tierCode);
  let multiplier = spec.pointsPer10k;

  if (input.isB2BWholesale && amount >= 50_000_000) {
    multiplier = 5;
  } else if (input.isAnniversaryDay) {
    multiplier *= 2;
  }

  const pointsEarned = Math.min(5_000_000, Math.floor((amount / 10_000) * multiplier));
  const walletCashbackToman = Math.min(
    amount,
    Math.round((amount * spec.walletCashbackPct) / 100)
  );
  return { pointsEarned, walletCashbackToman };
}

export function calculateCustomerScores(input: {
  lastPurchaseDaysAgo: number;
  orderCount: number;
  lifetimeValueToman: number;
  behavioralScore: number;
  engagementScore: number;
  npsLatest: number;
  wishlistCount: number;
}): CustomerScoreBreakdown {
  const days = Number.isFinite(input.lastPurchaseDaysAgo)
    ? Math.max(0, input.lastPurchaseDaysAgo)
    : 365;
  const orderCount = Number.isFinite(input.orderCount) ? Math.max(0, input.orderCount) : 0;
  const lifetimeValue = Number.isFinite(input.lifetimeValueToman)
    ? Math.max(0, input.lifetimeValueToman)
    : 0;
  const nps = Number.isFinite(input.npsLatest) ? Math.min(10, Math.max(0, input.npsLatest)) : 0;

  const recencyScore =
    days <= 7 ? 98 : days <= 30 ? 88 : days <= 60 ? 68 : days <= 90 ? 45 : days <= 180 ? 22 : 10;

  const frequencyScore = Math.min(100, Math.max(20, orderCount * 22 + 12));
  const monetaryScore = Math.min(100, Math.max(20, Math.round((lifetimeValue / 70_000_000) * 100)));

  // Spec weights: Recency 35%, Frequency 30%, Monetary 35%
  const rfmWeighted = Math.round(
    recencyScore * 0.35 + frequencyScore * 0.30 + monetaryScore * 0.35
  );

  const behavioralScore = Math.min(100, Math.max(0, Math.round(input.behavioralScore || 0)));
  const engagementScore = Math.min(100, Math.max(0, Math.round(input.engagementScore || 0)));
  const npsNormalized = Math.round(nps * 10);
  const potentialScore = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        rfmWeighted * 0.6 +
          behavioralScore * 0.25 +
          Math.min(15, Math.max(0, input.wishlistCount || 0) * 5)
      )
    )
  );

  const overallScore = Math.min(
    100,
    Math.round(
      rfmWeighted * 0.35 +
        behavioralScore * 0.20 +
        engagementScore * 0.15 +
        npsNormalized * 0.15 +
        potentialScore * 0.15
    )
  );

  const churnRiskPct = Math.min(
    95,
    Math.max(4, Math.round(days * 0.45 + (nps <= 6 ? 25 : 0) - orderCount * 3))
  );

  const returnRiskPct = Math.min(45, Math.max(3, nps <= 6 ? 24 : 7));
  const predicted12mClvToman = Math.round(
    Math.max(lifetimeValue, 6_000_000) * (1 + overallScore / 220)
  );

  return {
    recencyScore,
    frequencyScore,
    monetaryScore,
    rfmWeighted,
    behavioralScore,
    engagementScore,
    npsNormalized,
    potentialScore,
    overallScore,
    churnRiskPct,
    returnRiskPct,
    predicted12mClvToman,
  };
}

export function classifyRfmSegment(
  customer: Pick<Customer360, 'lastPurchaseDaysAgo' | 'orders' | 'scores'>
): RfmSegmentName {
  const days = customer.lastPurchaseDaysAgo;
  const orderCount = customer.orders.length;

  if (days > 180) return 'Lost';
  if (days >= 91) return 'Sleeping';
  if (days >= 60) return 'At-Risk';
  if (orderCount <= 1 && days <= 30) return 'New';
  if (customer.scores.rfmWeighted >= 85 && orderCount >= 3) return 'Champions';
  if (customer.scores.rfmWeighted >= 65) return 'Loyal';
  return 'High Potential';
}

export function filterCustomSegment(
  customers: Customer360[],
  rule: CustomSegmentRule
): Customer360[] {
  return customers.filter((c) => {
    const checks: boolean[] = [];

    if (rule.city !== 'همه') {
      if (rule.city === 'سایر') {
        checks.push(c.city !== 'همدان' && c.city !== 'تهران');
      } else {
        checks.push(c.city === rule.city);
      }
    }

    if (rule.tier !== 'all') {
      checks.push(c.tierCode === rule.tier);
    }

    if (rule.minAnnualMillion > 0) {
      checks.push(c.annualSpendToman >= rule.minAnnualMillion * 1_000_000);
    }

    if (rule.maxDaysSincePurchase > 0) {
      checks.push(c.lastPurchaseDaysAgo <= rule.maxDaysSincePurchase);
    }

    if (rule.channel !== 'all') {
      checks.push(c.identities.some((id) => id.channel === rule.channel));
    }

    if (checks.length === 0) return true;
    return rule.logic === 'AND' ? checks.every(Boolean) : checks.some(Boolean);
  });
}

export interface CampaignPolicyCheckResult {
  allowed: boolean;
  reasonFa: string;
}

export function validateCampaignSendPolicy(input: {
  hourOfDay: number;
  smsSentThisWeek: number;
  unsubscribedMarketing: boolean;
  isSmsChannel: boolean;
}): CampaignPolicyCheckResult {
  if (input.unsubscribedMarketing) {
    return {
      allowed: false,
      reasonFa: 'مشتری عضویت تبلیغاتی را لغو (Unsubscribe) کرده است.',
    };
  }
  if (input.hourOfDay >= 23 || input.hourOfDay < 8) {
    return {
      allowed: false,
      reasonFa: 'ساعات سکوت (۲۳:۰۰ تا ۰۸:۰۰ صبح) — ارسال خودکار در صف صبح قرار می‌گیرد.',
    };
  }
  if (input.isSmsChannel && input.smsSentThisWeek >= 2) {
    return {
      allowed: false,
      reasonFa: 'محدودیت هفتگی (حداکثر ۲ پیامک در هفته) برای این مشتری تکمیل شده است.',
    };
  }
  return {
    allowed: true,
    reasonFa: 'ارسال مجاز و منطبق با قوانین باشگاه مشتریان است.',
  };
}

export interface WebhookOrderInput {
  phone: string;
  fullName: string;
  city: Customer360['city'];
  sourceSite: ChannelKey;
  externalOrderId: string;
  totalToman: number;
  itemsSummary: string;
  attributionChannel: 'instagram_dm' | 'telegram_bot' | 'direct_web' | 'store_walkin';
}

export interface WebhookApplySuccess {
  ok: true;
  duplicate: boolean;
  updatedCustomers: Customer360[];
  targetCustomer: Customer360;
  isNewCustomer: boolean;
  pointsEarned: number;
  walletCashbackToman: number;
  tierUpgradedFrom: LoyaltyTierCode | null;
  newFollowUpTask: FollowUpTask | null;
}

export interface WebhookApplyFailure {
  ok: false;
  errorFa: string;
}

export type WebhookApplyResult = WebhookApplySuccess | WebhookApplyFailure;

const MAX_ORDER_TOMAN = 5_000_000_000;

/**
 * Applies an order webhook exactly once. Duplicate externalOrderIds (retries from the
 * three storefronts or POS) are detected before any loyalty mutation, so a retried
 * webhook can never double-count spend, points or follow-up tasks.
 */
export function applyWebhookOrderToCustomers(
  customers: Customer360[],
  payload: WebhookOrderInput
): WebhookApplyResult {
  const phoneE164 = normalizeIranPhone(payload.phone);
  if (!phoneE164) {
    return { ok: false, errorFa: 'شماره موبایل معتبر نیست؛ سفارش پذیرفته نشد.' };
  }

  const totalToman = Math.round(Number(payload.totalToman));
  if (!Number.isFinite(totalToman) || totalToman <= 0 || totalToman > MAX_ORDER_TOMAN) {
    return { ok: false, errorFa: 'مبلغ سفارش نامعتبر است؛ سفارش پذیرفته نشد.' };
  }

  const externalOrderId = String(payload.externalOrderId ?? '').trim().slice(0, 64);
  if (externalOrderId.length < 3) {
    return { ok: false, errorFa: 'کد سفارش معتبر نیست؛ سفارش پذیرفته نشد.' };
  }

  const itemsSummary = String(payload.itemsSummary ?? '').trim().slice(0, 255) || 'محصول راسپینا';
  const fullName = String(payload.fullName ?? '').trim().slice(0, 120) || 'مشتری جدید راسپینا';

  const duplicateOwner = customers.find((c) =>
    c.orders.some(
      (o) => o.externalOrderId.trim().toLowerCase() === externalOrderId.toLowerCase()
    )
  );
  if (duplicateOwner) {
    return {
      ok: true,
      duplicate: true,
      updatedCustomers: customers,
      targetCustomer: duplicateOwner,
      isNewCustomer: false,
      pointsEarned: 0,
      walletCashbackToman: 0,
      tierUpgradedFrom: null,
      newFollowUpTask: null,
    };
  }

  const newOrder = {
    id: `ord-${Date.now()}`,
    externalOrderId,
    sourceSite: payload.sourceSite,
    attributionChannel: payload.attributionChannel,
    orderedAt: 'هم‌اکنون (۱۴۰۴/۰۸/۲۶)',
    totalToman,
    itemsSummary,
    paymentMethod: 'zarinpal' as const,
    status: 'paid' as const,
  };

  const existingIndex = customers.findIndex((c) => c.phoneE164 === phoneE164);
  const isNewCustomer = existingIndex === -1;
  let target: Customer360;
  let tierUpgradedFrom: LoyaltyTierCode | null = null;

  if (!isNewCustomer) {
    const prev = customers[existingIndex];
    const nextAnnual = prev.annualSpendToman + totalToman;
    const nextTier = determineLoyaltyTier({
      annualSpendToman: nextAnnual,
      manualVipInvited: prev.manualVipInvited,
    });
    if (nextTier.code !== prev.tierCode) {
      tierUpgradedFrom = prev.tierCode;
    }

    const { pointsEarned, walletCashbackToman } = calculatePurchasePoints({
      amountToman: totalToman,
      tierCode: nextTier.code,
      isB2BWholesale: prev.isB2BWholesale,
    });

    const hasChannel = prev.identities.some((id) => id.channel === payload.sourceSite);
    const nextIdentities = hasChannel
      ? prev.identities
      : [
          ...prev.identities,
          {
            channel: payload.sourceSite,
            externalUserId: `SYNC-${Math.floor(1000 + Math.random() * 9000)}`,
            handle: phoneE164,
            syncedAt: 'هم‌اکنون',
          },
        ];

    const nextOrders = [newOrder, ...prev.orders];
    const nextClv = prev.lifetimeValueToman + totalToman;
    const scores = calculateCustomerScores({
      lastPurchaseDaysAgo: 0,
      orderCount: nextOrders.length,
      lifetimeValueToman: nextClv,
      behavioralScore: Math.min(100, prev.behavioralEventsScore + 6),
      engagementScore: Math.min(100, prev.engagementEventsScore + 4),
      npsLatest: prev.npsLatest,
      wishlistCount: prev.wishlist.length,
    });

    target = {
      ...prev,
      identities: nextIdentities,
      orders: nextOrders,
      annualSpendToman: nextAnnual,
      lifetimeValueToman: nextClv,
      pointsBalance: prev.pointsBalance + pointsEarned,
      walletBalanceToman: prev.walletBalanceToman + walletCashbackToman,
      tierCode: nextTier.code,
      lastPurchaseDaysAgo: 0,
      scores,
    };

    const updatedCustomers = customers.map((c, idx) => (idx === existingIndex ? target : c));
    return {
      ok: true,
      duplicate: false,
      updatedCustomers,
      targetCustomer: target,
      isNewCustomer: false,
      pointsEarned,
      walletCashbackToman,
      tierUpgradedFrom,
      newFollowUpTask: {
        id: `fu-${Date.now()}`,
        customerId: target.id,
        customerName: target.fullName,
        tierCode: target.tierCode,
        orderId: externalOrderId,
        stage: 'immediate_confirm',
        stageLabelFa: 'تأیید سفارش هوشمند + زمان‌بندی NPS ۲۴ساعته',
        dueLabelFa: 'هم‌اکنون (Webhook)',
        channel: target.tierCode === 'vip_black' ? 'تلفن' : 'SMS',
        suggestedOffer:
          target.tierCode === 'vip_black'
            ? 'تماس تشکر اختصاصی VIP + ارسال کد رهگیری'
            : 'پیامک جزئیات سفارش + لینک رهگیری زنده',
        status: 'pending',
      },
    };
  }

  const nextTier = determineLoyaltyTier({ annualSpendToman: totalToman });
  const { pointsEarned, walletCashbackToman } = calculatePurchasePoints({
    amountToman: totalToman,
    tierCode: nextTier.code,
  });

  const scores = calculateCustomerScores({
    lastPurchaseDaysAgo: 0,
    orderCount: 1,
    lifetimeValueToman: totalToman,
    behavioralScore: 65,
    engagementScore: 70,
    npsLatest: 8,
    wishlistCount: 0,
  });

  target = {
    id: `cust-${Date.now()}`,
    fullName,
    phoneE164,
    birthDate: '1375/01/01',
    city: payload.city,
    province: payload.city,
    address: `${payload.city} — ثبت‌شده از وب‌هوک سایت`,
    preferredChannel: 'sms',
    bestContactTime: '۱۰:۰۰ تا ۲۰:۰۰',
    topSize: '۳۸ (M)',
    bottomSize: '۳۸',
    shoeSize: '۳۸',
    favoriteColors: ['مشکی', 'کرم'],
    dislikedColors: [],
    favoriteStyles: ['کژوال شیک'],
    favoriteCategory: 'مانتو',
    identities: [
      {
        channel: payload.sourceSite,
        externalUserId: `WEB-${Math.floor(1000 + Math.random() * 9000)}`,
        handle: phoneE164,
        syncedAt: 'هم‌اکنون',
      },
    ],
    orders: [newOrder],
    viewedProducts: [itemsSummary],
    wishlist: [],
    abandonedCartItems: [],
    searchKeywords: [],
    devicePreference: 'mobile',
    acquisitionSource: payload.sourceSite,
    interactions: [],
    annualSpendToman: totalToman,
    lifetimeValueToman: totalToman,
    walletBalanceToman: walletCashbackToman,
    pointsBalance: pointsEarned,
    tierCode: nextTier.code,
    lastPurchaseDaysAgo: 0,
    npsLatest: 8,
    npsLabel: 'Passive',
    behavioralEventsScore: 65,
    engagementEventsScore: 70,
    smsSentThisWeek: 0,
    unsubscribedMarketing: false,
    tags: ['خریدار اول', 'ثبت از وب‌هوک'],
    badges: ['خریدار اول'],
    referralCode: `RASP-${Math.floor(1000 + Math.random() * 9000)}`,
    referralsCount: 0,
    scores,
  };

  return {
    ok: true,
    duplicate: false,
    updatedCustomers: [target, ...customers],
    targetCustomer: target,
    isNewCustomer: true,
    pointsEarned,
    walletCashbackToman,
    tierUpgradedFrom: null,
    newFollowUpTask: {
      id: `fu-${Date.now()}`,
      customerId: target.id,
      customerName: target.fullName,
      tierCode: target.tierCode,
      orderId: externalOrderId,
      stage: 'immediate_confirm',
      stageLabelFa: 'خوش‌آمدگویی + تأیید سفارش اول',
      dueLabelFa: 'هم‌اکنون (Webhook)',
      channel: 'SMS',
      suggestedOffer: 'لینک تکمیل پروفایل سایز (+۱۰۰ امتیاز هدیه)',
      status: 'pending',
    },
  };
}
