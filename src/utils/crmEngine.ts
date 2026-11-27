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

export function normalizeIranPhone(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.startsWith('98') && digits.length >= 12) {
    return `+${digits.slice(0, 12)}`;
  }
  if (digits.startsWith('09') && digits.length >= 11) {
    return `+98${digits.slice(1, 11)}`;
  }
  if (digits.startsWith('9') && digits.length === 10) {
    return `+98${digits}`;
  }
  return raw.trim();
}

export function getTierSpec(code: LoyaltyTierCode): LoyaltyTierSpec {
  return LOYALTY_TIERS.find((t) => t.code === code) ?? LOYALTY_TIERS[0];
}

export function determineLoyaltyTier(input: {
  annualSpendToman: number;
  manualVipInvited?: boolean;
}): LoyaltyTierSpec {
  if (input.manualVipInvited || input.annualSpendToman >= 50_000_000) {
    return getTierSpec('vip_black');
  }
  if (input.annualSpendToman >= 15_000_000) {
    return getTierSpec('platinum');
  }
  if (input.annualSpendToman >= 5_000_000) {
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
  const amount = Math.max(0, input.amountToman);
  const spec = getTierSpec(input.tierCode);
  let multiplier = spec.pointsPer10k;

  if (input.isB2BWholesale && amount >= 50_000_000) {
    multiplier = 5;
  } else if (input.isAnniversaryDay) {
    multiplier *= 2;
  }

  const pointsEarned = Math.floor((amount / 10_000) * multiplier);
  const walletCashbackToman = Math.round((amount * spec.walletCashbackPct) / 100);
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
  const days = Math.max(0, input.lastPurchaseDaysAgo);
  const recencyScore =
    days <= 7 ? 98 : days <= 30 ? 88 : days <= 60 ? 68 : days <= 90 ? 45 : days <= 180 ? 22 : 10;

  const frequencyScore = Math.min(100, Math.max(20, input.orderCount * 22 + 12));
  const monetaryScore = Math.min(
    100,
    Math.max(20, Math.round((input.lifetimeValueToman / 70_000_000) * 100))
  );

  // Exact spec weights: Recency 35%, Frequency 30%, Monetary 35%
  const rfmWeighted = Math.round(
    recencyScore * 0.35 + frequencyScore * 0.30 + monetaryScore * 0.35
  );

  const behavioralScore = Math.min(100, Math.max(0, Math.round(input.behavioralScore)));
  const engagementScore = Math.min(100, Math.max(0, Math.round(input.engagementScore)));
  const npsNormalized = Math.min(100, Math.max(0, Math.round(input.npsLatest * 10)));
  const potentialScore = Math.min(
    100,
    Math.round(rfmWeighted * 0.6 + behavioralScore * 0.25 + Math.min(15, input.wishlistCount * 5))
  );

  // Exact spec formula:
  // Customer Score = (RFM * 0.35) + (Behavioral * 0.20) + (Engagement * 0.15) + (NPS * 0.15) + (Potential * 0.15)
  const overallScore = Math.round(
    rfmWeighted * 0.35 +
      behavioralScore * 0.20 +
      engagementScore * 0.15 +
      npsNormalized * 0.15 +
      potentialScore * 0.15
  );

  const churnRiskPct = Math.min(
    95,
    Math.max(4, Math.round(days * 0.45 + (input.npsLatest <= 6 ? 25 : 0) - input.orderCount * 3))
  );

  const returnRiskPct = Math.min(45, Math.max(3, input.npsLatest <= 6 ? 24 : 7));
  const predicted12mClvToman = Math.round(
    Math.max(input.lifetimeValueToman, 6_000_000) * (1 + overallScore / 220)
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

export function classifyRfmSegment(customer: Pick<Customer360, 'lastPurchaseDaysAgo' | 'orders' | 'scores'>): RfmSegmentName {
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

export function applyWebhookOrderToCustomers(
  customers: Customer360[],
  payload: WebhookOrderInput
): {
  updatedCustomers: Customer360[];
  targetCustomer: Customer360;
  isNewCustomer: boolean;
  pointsEarned: number;
  walletCashbackToman: number;
  tierUpgradedFrom: LoyaltyTierCode | null;
  newFollowUpTask: FollowUpTask;
} {
  const phoneE164 = normalizeIranPhone(payload.phone);
  const existingIndex = customers.findIndex((c) => c.phoneE164 === phoneE164);
  const isNewCustomer = existingIndex === -1;

  const newOrder = {
    id: `ord-${Date.now()}`,
    externalOrderId: payload.externalOrderId,
    sourceSite: payload.sourceSite,
    attributionChannel: payload.attributionChannel,
    orderedAt: 'هم‌اکنون (۱۴۰۴/۰۸/۲۶)',
    totalToman: payload.totalToman,
    itemsSummary: payload.itemsSummary,
    paymentMethod: 'zarinpal' as const,
    status: 'paid' as const,
  };

  let target: Customer360;
  let tierUpgradedFrom: LoyaltyTierCode | null = null;

  if (!isNewCustomer) {
    const prev = customers[existingIndex];
    const nextAnnual = prev.annualSpendToman + payload.totalToman;
    const nextTier = determineLoyaltyTier({
      annualSpendToman: nextAnnual,
      manualVipInvited: prev.manualVipInvited,
    });
    if (nextTier.code !== prev.tierCode) {
      tierUpgradedFrom = prev.tierCode;
    }

    const { pointsEarned, walletCashbackToman } = calculatePurchasePoints({
      amountToman: payload.totalToman,
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
    const nextClv = prev.lifetimeValueToman + payload.totalToman;
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
        orderId: payload.externalOrderId,
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

  const nextTier = determineLoyaltyTier({ annualSpendToman: payload.totalToman });
  const { pointsEarned, walletCashbackToman } = calculatePurchasePoints({
    amountToman: payload.totalToman,
    tierCode: nextTier.code,
  });

  const scores = calculateCustomerScores({
    lastPurchaseDaysAgo: 0,
    orderCount: 1,
    lifetimeValueToman: payload.totalToman,
    behavioralScore: 65,
    engagementScore: 70,
    npsLatest: 8,
    wishlistCount: 0,
  });

  target = {
    id: `cust-${Date.now()}`,
    fullName: payload.fullName.trim() || 'مشتری جدید راسپینا',
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
    viewedProducts: [payload.itemsSummary],
    wishlist: [],
    abandonedCartItems: [],
    searchKeywords: [],
    devicePreference: 'mobile',
    acquisitionSource: payload.sourceSite,
    interactions: [],
    annualSpendToman: payload.totalToman,
    lifetimeValueToman: payload.totalToman,
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
      orderId: payload.externalOrderId,
      stage: 'immediate_confirm',
      stageLabelFa: 'خوش‌آمدگویی + تأیید سفارش اول',
      dueLabelFa: 'هم‌اکنون (Webhook)',
      channel: 'SMS',
      suggestedOffer: 'لینک تکمیل پروفایل سایز (+۱۰۰ امتیاز هدیه)',
      status: 'pending',
    },
  };
}
