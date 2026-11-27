import {
  TELEGRAM_SAMPLE_PRODUCTS,
  TIMELINE_MODULES,
  type CatalogProduct,
  type TimelineModuleSpec,
} from '../data/raspinaPlan';
import type { LoyaltyTierCode } from '../types/crm';
import { calculatePurchasePoints, determineLoyaltyTier } from './crmEngine';

export type { LoyaltyTierCode };

export interface LoyaltyCalculationResult {
  tierCode: LoyaltyTierCode;
  tierLabelFa: string;
  pointsPer10k: number;
  cashbackRatePct: number;
  estimatedPoints: number;
  walletCashbackToman: number;
  voucherValueToman: number;
  nextTierLabelFa: string | null;
  amountToNextTierMillion: number;
}

export function calculateLoyaltyStatus(input: {
  purchaseCount: number;
  totalSpentMillionToman: number;
  manualVipInvited?: boolean;
}): LoyaltyCalculationResult {
  const spentMillion = Math.max(0, input.totalSpentMillionToman);
  const spentToman = spentMillion * 1_000_000;
  const spec = determineLoyaltyTier({
    annualSpendToman: spentToman,
    manualVipInvited: input.manualVipInvited,
  });

  const { pointsEarned, walletCashbackToman } = calculatePurchasePoints({
    amountToman: spentToman,
    tierCode: spec.code,
  });

  let nextTierLabelFa: string | null = null;
  let amountToNextTierMillion = 0;

  if (spec.code === 'bronze') {
    nextTierLabelFa = 'طلایی';
    amountToNextTierMillion = Math.max(0, 5 - spentMillion);
  } else if (spec.code === 'gold') {
    nextTierLabelFa = 'پلاتینیوم';
    amountToNextTierMillion = Math.max(0, 15 - spentMillion);
  } else if (spec.code === 'platinum') {
    nextTierLabelFa = 'VIP Black';
    amountToNextTierMillion = Math.max(0, 50 - spentMillion);
  }

  // Every 100 points = 10,000 Toman discount voucher (exact spec redeem table)
  const voucherValueToman = Math.floor(pointsEarned / 100) * 10_000;

  return {
    tierCode: spec.code,
    tierLabelFa: spec.nameFa,
    pointsPer10k: spec.pointsPer10k,
    cashbackRatePct: spec.walletCashbackPct,
    estimatedPoints: pointsEarned,
    walletCashbackToman,
    voucherValueToman,
    nextTierLabelFa,
    amountToNextTierMillion: Number(amountToNextTierMillion.toFixed(1)),
  };
}

export interface TimelineEstimateSummary {
  mode: 'parallel' | 'sequential';
  includeExternalBuffer: boolean;
  totalAiDevDays: number;
  totalCalendarWeeks: number;
  totalCalendarDays: number;
  modules: Array<
    TimelineModuleSpec & {
      effectiveWeeks: number;
    }
  >;
}

export function calculateDeliveryTimeline(input: {
  mode: 'parallel' | 'sequential';
  includeExternalBuffer: boolean;
  selectedModuleIds?: string[];
}): TimelineEstimateSummary {
  const activeIds =
    input.selectedModuleIds && input.selectedModuleIds.length > 0
      ? new Set(input.selectedModuleIds)
      : new Set(TIMELINE_MODULES.map((m) => m.id));

  const selected = TIMELINE_MODULES.filter((m) => activeIds.has(m.id));
  const totalAiDevDays = selected.reduce((sum, m) => sum + m.aiDevDays, 0);

  const modules = selected.map((m) => {
    const baseWeeks =
      input.mode === 'parallel' ? m.calendarWeeksParallel : m.calendarWeeksSequential;
    const bufferWeeks = input.includeExternalBuffer ? m.externalBufferDays / 7 : 0;
    return {
      ...m,
      effectiveWeeks: Number((baseWeeks + bufferWeeks).toFixed(1)),
    };
  });

  let totalCalendarWeeks = 0;
  if (selected.length > 0) {
    if (input.mode === 'sequential') {
      totalCalendarWeeks = modules.reduce((sum, m) => sum + m.effectiveWeeks, 0);
    } else {
      const trackTotals = new Map<string, number>();
      for (const m of modules) {
        trackTotals.set(m.track, (trackTotals.get(m.track) ?? 0) + m.effectiveWeeks);
      }
      const maxTrackWeeks = Math.max(...Array.from(trackTotals.values()));
      totalCalendarWeeks = maxTrackWeeks + (selected.length > 1 ? 0.5 : 0);
    }
  }

  const roundedWeeks = Number(totalCalendarWeeks.toFixed(1));
  return {
    mode: input.mode,
    includeExternalBuffer: input.includeExternalBuffer,
    totalAiDevDays,
    totalCalendarWeeks: roundedWeeks,
    totalCalendarDays: Math.ceil(roundedWeeks * 7),
    modules,
  };
}

export function matchTelegramCatalog(
  categorySlug: CatalogProduct['categorySlug'] | 'all',
  searchQuery = ''
): CatalogProduct[] {
  const q = searchQuery.trim().toLowerCase();
  return TELEGRAM_SAMPLE_PRODUCTS.filter((p) => {
    const matchesCategory = categorySlug === 'all' || p.categorySlug === categorySlug;
    if (!matchesCategory) return false;
    if (!q) return true;
    return (
      p.title.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.categoryFa.toLowerCase().includes(q)
    );
  });
}

export interface InstagramResolutionResult {
  matched: boolean;
  matchedBy: 'exact_media_id' | 'strict_category_keyword' | 'fallback_clarification';
  categoryGuard: string;
  product: CatalogProduct | null;
  simulatedLatencyMs: number;
  replyTextFa: string;
}

const CATEGORY_KEYWORDS: Array<{ keyword: string; slug: CatalogProduct['categorySlug']; labelFa: string }> = [
  { keyword: 'شومیز', slug: 'blouse', labelFa: 'شومیز' },
  { keyword: 'بلوز', slug: 'blouse', labelFa: 'شومیز' },
  { keyword: 'مانتو', slug: 'manteau', labelFa: 'مانتو' },
  { keyword: 'عبا', slug: 'manteau', labelFa: 'مانتو' },
  { keyword: 'شلوار', slug: 'pants', labelFa: 'شلوار' },
  { keyword: 'ست', slug: 'set', labelFa: 'ست' },
];

export function resolveInstagramInquiry(input: {
  queryText: string;
  attachedMediaId?: string;
}): InstagramResolutionResult {
  if (input.attachedMediaId) {
    const exact = TELEGRAM_SAMPLE_PRODUCTS.find(
      (p) => p.instagramMediaId === input.attachedMediaId
    );
    if (exact) {
      return {
        matched: true,
        matchedBy: 'exact_media_id',
        categoryGuard: exact.categoryFa,
        product: exact,
        simulatedLatencyMs: 2400,
        replyTextFa: `سلام وقت بخیر. مدل ارسال‌شده «${exact.title}» (دسته ${exact.categoryFa}) با قیمت ${exact.priceToman.toLocaleString('fa-IR')} تومان در سایزهای ${exact.sizes.join('، ')} موجود است. لینک خرید مستقیم از سایت راسپینا:`,
      };
    }
  }

  const normalized = input.queryText.trim();
  const detectedCategory = CATEGORY_KEYWORDS.find((c) => normalized.includes(c.keyword));
  if (detectedCategory) {
    const candidates = TELEGRAM_SAMPLE_PRODUCTS.filter(
      (p) => p.categorySlug === detectedCategory.slug
    );
    const refined =
      candidates.find((p) => normalized.includes('حریر') && p.title.includes('حریر')) ??
      candidates.find((p) => normalized.includes('لینن') && p.title.includes('لینن')) ??
      candidates.find((p) => normalized.includes('کتی') && p.title.includes('کتی')) ??
      candidates[0];

    if (refined) {
      return {
        matched: true,
        matchedBy: 'strict_category_keyword',
        categoryGuard: detectedCategory.labelFa,
        product: refined,
        simulatedLatencyMs: 3100,
        replyTextFa: `سلام و درود. در دسته‌بندی «${detectedCategory.labelFa}»، مدل «${refined.title}» با قیمت ${refined.priceToman.toLocaleString('fa-IR')} تومان و سایزهای ${refined.sizes.join('، ')} آماده ثبت سفارش است. لینک خرید مستقیم:`,
      };
    }
  }

  return {
    matched: false,
    matchedBy: 'fallback_clarification',
    categoryGuard: 'نیاز به تایید دسته',
    product: null,
    simulatedLatencyMs: 1850,
    replyTextFa:
      'سلام وقت بخیر. برای اینکه قیمت و لینک دقیق همان مدل را برایتان بفرستم، لطفاً پست محصول را به دایرکت فوروارد کنید یا نام دقیق دسته (مثلاً شومیز، مانتو، شلوار) را بنویسید.',
  };
}
