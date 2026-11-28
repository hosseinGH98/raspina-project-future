import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_CUSTOMERS } from '../data/crmSeed';
import {
  applyWebhookOrderToCustomers,
  calculateCustomerScores,
  calculatePurchasePoints,
  determineLoyaltyTier,
  filterCustomSegment,
  formatIranPhone,
  getTierProgress,
  normalizeIranPhone,
  validateCampaignSendPolicy,
} from './crmEngine';

test('loyalty tiers and points match comprehensive 16-module spec', () => {
  assert.equal(determineLoyaltyTier({ annualSpendToman: 3_000_000 }).code, 'bronze');
  assert.equal(determineLoyaltyTier({ annualSpendToman: 8_000_000 }).code, 'gold');
  assert.equal(determineLoyaltyTier({ annualSpendToman: 22_000_000 }).code, 'platinum');
  assert.equal(determineLoyaltyTier({ annualSpendToman: 55_000_000 }).code, 'vip_black');
  assert.equal(
    determineLoyaltyTier({ annualSpendToman: 0, manualVipInvited: true }).code,
    'vip_black'
  );

  const vipPts = calculatePurchasePoints({ amountToman: 1_000_000, tierCode: 'vip_black' });
  assert.equal(vipPts.pointsEarned, 300); // 100 * 3
  assert.equal(vipPts.walletCashbackToman, 100_000); // 10%

  const b2bPts = calculatePurchasePoints({
    amountToman: 60_000_000,
    tierCode: 'vip_black',
    isB2BWholesale: true,
  });
  assert.equal(b2bPts.pointsEarned, 30_000); // 6,000 * 5X B2B

  const anniversaryPts = calculatePurchasePoints({
    amountToman: 1_000_000,
    tierCode: 'gold',
    isAnniversaryDay: true,
  });
  assert.equal(anniversaryPts.pointsEarned, 300); // 100 * 1.5 * 2

  const progress = getTierProgress(10_000_000);
  assert.equal(progress.current.code, 'gold');
  assert.equal(progress.next?.code, 'platinum');
  assert.equal(progress.amountToNextToman, 5_000_000);
});

test('Iranian mobile normalization accepts all common formats and rejects junk', () => {
  const expected = '+989123456789';
  for (const input of [
    '09123456789',
    '+989123456789',
    '00989123456789',
    '989123456789',
    '9123456789',
    '۰۹۱۲۳۴۵۶۷۸۹',
    '0912 345 6789',
    '0912-345-6789',
  ]) {
    assert.equal(normalizeIranPhone(input), expected, `input: ${input}`);
  }

  for (const invalid of ['', '12345', '0212345678', '091234567', '091234567890', 'abcdefghijk']) {
    assert.equal(normalizeIranPhone(invalid), '', `invalid: ${invalid}`);
  }

  assert.equal(formatIranPhone(expected), '0912 345 6789');
});

test('multi-dimensional RFM + Customer Score formula calculates accurately', () => {
  const result = calculateCustomerScores({
    lastPurchaseDaysAgo: 5,
    orderCount: 4,
    lifetimeValueToman: 70_000_000,
    behavioralScore: 90,
    engagementScore: 80,
    npsLatest: 10,
    wishlistCount: 3,
  });
  // R=98, F=100, M=100 -> RFM = round(98*0.35 + 100*0.3 + 100*0.35) = 99
  assert.equal(result.rfmWeighted, 99);
  assert.ok(result.overallScore >= 90 && result.overallScore <= 100);

  const robust = calculateCustomerScores({
    lastPurchaseDaysAgo: Number.NaN,
    orderCount: -4,
    lifetimeValueToman: Number.NaN,
    behavioralScore: 500,
    engagementScore: -2,
    npsLatest: 99,
    wishlistCount: -1,
  });
  assert.ok(robust.overallScore >= 0 && robust.overallScore <= 100);
  assert.ok(robust.churnRiskPct >= 4 && robust.churnRiskPct <= 95);
});

test('custom segment AND/OR filtering and campaign blackout/frequency guardrails work accurately', () => {
  const tehranVips = filterCustomSegment(INITIAL_CUSTOMERS, {
    city: 'تهران',
    tier: 'vip_black',
    minAnnualMillion: 50,
    maxDaysSincePurchase: 30,
    channel: 'all',
    logic: 'AND',
  });
  assert.equal(tehranVips.length, 1);
  assert.equal(tehranVips[0].id, 'cust-01');

  assert.equal(
    validateCampaignSendPolicy({
      hourOfDay: 23,
      smsSentThisWeek: 0,
      unsubscribedMarketing: false,
      isSmsChannel: true,
    }).allowed,
    false
  );
  assert.equal(
    validateCampaignSendPolicy({
      hourOfDay: 14,
      smsSentThisWeek: 2,
      unsubscribedMarketing: false,
      isSmsChannel: true,
    }).allowed,
    false
  );
  assert.equal(
    validateCampaignSendPolicy({
      hourOfDay: 14,
      smsSentThisWeek: 1,
      unsubscribedMarketing: false,
      isSmsChannel: true,
    }).allowed,
    true
  );
  assert.equal(
    validateCampaignSendPolicy({
      hourOfDay: 14,
      smsSentThisWeek: 0,
      unsubscribedMarketing: true,
      isSmsChannel: false,
    }).allowed,
    false
  );
});

test('webhook order ingestion deduplicates by normalized phone and upgrades tier + points', () => {
  const res = applyWebhookOrderToCustomers(INITIAL_CUSTOMERS, {
    phone: '09355544332', // Matches cust-05 (bronze, 3.17M annual)
    fullName: 'هلیا کریمی',
    city: 'تهران',
    sourceSite: 'raspinashop',
    externalOrderId: 'RSH-99881',
    totalToman: 3_000_000, // pushes annual spend from 3.17M to 6.17M -> gold
    itemsSummary: 'مانتو کتی لینن دیپلمات',
    attributionChannel: 'instagram_dm',
  });

  assert.equal(res.ok, true);
  if (!res.ok) return;

  assert.equal(res.duplicate, false);
  assert.equal(res.isNewCustomer, false);
  assert.equal(res.tierUpgradedFrom, 'bronze');
  assert.equal(res.targetCustomer.tierCode, 'gold');
  assert.equal(res.pointsEarned, 450); // 300 * 1.5
  assert.equal(res.newFollowUpTask?.orderId, 'RSH-99881');
});

test('replayed webhook is idempotent and never double-awards points', () => {
  const payload = {
    phone: '09123456789',
    fullName: 'نیلوفر فرهادی',
    city: 'تهران' as const,
    sourceSite: 'raspinashop' as const,
    externalOrderId: 'RSH-IDEMPOTENT-1',
    totalToman: 2_000_000,
    itemsSummary: 'مانتو تست',
    attributionChannel: 'direct_web' as const,
  };

  const first = applyWebhookOrderToCustomers(INITIAL_CUSTOMERS, payload);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.duplicate, false);

  const second = applyWebhookOrderToCustomers(first.updatedCustomers, payload);
  assert.equal(second.ok, true);
  if (!second.ok) return;

  assert.equal(second.duplicate, true);
  assert.equal(second.pointsEarned, 0);
  assert.equal(second.newFollowUpTask, null);
  assert.equal(second.updatedCustomers, first.updatedCustomers);
});

test('webhook rejects invalid phone, amount and order id before mutating anything', () => {
  const base = {
    phone: '09123456789',
    fullName: 'تست',
    city: 'تهران' as const,
    sourceSite: 'raspinashop' as const,
    externalOrderId: 'RSH-VALID-1',
    totalToman: 1_000_000,
    itemsSummary: 'محصول',
    attributionChannel: 'direct_web' as const,
  };

  const badPhone = applyWebhookOrderToCustomers(INITIAL_CUSTOMERS, { ...base, phone: '123' });
  assert.equal(badPhone.ok, false);

  const badAmount = applyWebhookOrderToCustomers(INITIAL_CUSTOMERS, { ...base, totalToman: -1 });
  assert.equal(badAmount.ok, false);

  const badOrder = applyWebhookOrderToCustomers(INITIAL_CUSTOMERS, {
    ...base,
    externalOrderId: '',
  });
  assert.equal(badOrder.ok, false);
});
