import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_CUSTOMERS } from '../data/crmSeed';
import {
  applyWebhookOrderToCustomers,
  calculateCustomerScores,
  calculatePurchasePoints,
  determineLoyaltyTier,
  filterCustomSegment,
  normalizeIranPhone,
  validateCampaignSendPolicy,
} from './crmEngine';

test('loyalty tiers and points match comprehensive 16-module spec', () => {
  assert.equal(determineLoyaltyTier({ annualSpendToman: 3_000_000 }).code, 'bronze');
  assert.equal(determineLoyaltyTier({ annualSpendToman: 8_000_000 }).code, 'gold');
  assert.equal(determineLoyaltyTier({ annualSpendToman: 22_000_000 }).code, 'platinum');
  assert.equal(determineLoyaltyTier({ annualSpendToman: 55_000_000 }).code, 'vip_black');

  const vipPts = calculatePurchasePoints({ amountToman: 1_000_000, tierCode: 'vip_black' });
  assert.equal(vipPts.pointsEarned, 300); // 100 * 3
  assert.equal(vipPts.walletCashbackToman, 100_000); // 10%

  const b2bPts = calculatePurchasePoints({
    amountToman: 60_000_000,
    tierCode: 'vip_black',
    isB2BWholesale: true,
  });
  assert.equal(b2bPts.pointsEarned, 30_000); // 6,000 * 5X B2B
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
});

test('webhook order ingestion deduplicates by normalized phone and upgrades tier + points', () => {
  const res = applyWebhookOrderToCustomers(INITIAL_CUSTOMERS, {
    phone: '09355544332', // Matches cust-05 (bronze, 3.17M annual)
    fullName: 'هلیا کریمی',
    city: 'تهران',
    sourceSite: 'raspinashop',
    externalOrderId: 'RSH-99881',
    totalToman: 3_000_000, // pushes annual spend from 3.17M to 6.17M -> gold!
    itemsSummary: 'مانتو کتی لینن دیپلمات',
    attributionChannel: 'instagram_dm',
  });

  assert.equal(normalizeIranPhone('09355544332'), '+989355544332');
  assert.equal(res.isNewCustomer, false);
  assert.equal(res.tierUpgradedFrom, 'bronze');
  assert.equal(res.targetCustomer.tierCode, 'gold');
  assert.equal(res.pointsEarned, 450); // 300 * 1.5
  assert.equal(res.newFollowUpTask.orderId, 'RSH-99881');
});
