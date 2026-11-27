import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDeliveryTimeline,
  calculateLoyaltyStatus,
  matchTelegramCatalog,
  resolveInstagramInquiry,
} from './estimator';

test('loyalty tier upgrades accurately across comprehensive spec thresholds', () => {
  const bronze = calculateLoyaltyStatus({ purchaseCount: 1, totalSpentMillionToman: 2 });
  assert.equal(bronze.tierCode, 'bronze');
  assert.equal(bronze.pointsPer10k, 1);
  assert.equal(bronze.cashbackRatePct, 0);

  const gold = calculateLoyaltyStatus({ purchaseCount: 2, totalSpentMillionToman: 6 });
  assert.equal(gold.tierCode, 'gold');
  assert.equal(gold.pointsPer10k, 1.5);

  const platinum = calculateLoyaltyStatus({ purchaseCount: 4, totalSpentMillionToman: 22 });
  assert.equal(platinum.tierCode, 'platinum');
  assert.equal(platinum.pointsPer10k, 2);
  assert.equal(platinum.cashbackRatePct, 5);

  const vip = calculateLoyaltyStatus({
    purchaseCount: 1,
    totalSpentMillionToman: 1,
    manualVipInvited: true,
  });
  assert.equal(vip.tierCode, 'vip_black');
  assert.equal(vip.pointsPer10k, 3);
  assert.equal(vip.cashbackRatePct, 10);
});

test('parallel AI-accelerated timeline is faster than sequential and respects external buffer', () => {
  const parallelFast = calculateDeliveryTimeline({
    mode: 'parallel',
    includeExternalBuffer: false,
  });
  const parallelBuffered = calculateDeliveryTimeline({
    mode: 'parallel',
    includeExternalBuffer: true,
  });
  const sequentialFast = calculateDeliveryTimeline({
    mode: 'sequential',
    includeExternalBuffer: false,
  });

  assert.ok(parallelFast.totalCalendarWeeks < sequentialFast.totalCalendarWeeks);
  assert.ok(parallelBuffered.totalCalendarWeeks > parallelFast.totalCalendarWeeks);
  assert.equal(parallelFast.totalAiDevDays, 68);
});

test('telegram catalog matcher filters by category and search query', () => {
  const blouses = matchTelegramCatalog('blouse');
  assert.equal(blouses.length, 2);
  assert.ok(blouses.every((p) => p.categorySlug === 'blouse'));

  const linenSearch = matchTelegramCatalog('all', 'لینن');
  assert.equal(linenSearch.length, 2);
});

test('instagram inquiry resolver never mixes up blouse and pants categories', () => {
  const blouseResult = resolveInstagramInquiry({
    queryText: 'قیمت شومیز حریر چنده؟',
  });
  assert.equal(blouseResult.matched, true);
  assert.equal(blouseResult.product?.categorySlug, 'blouse');
  assert.ok(blouseResult.simulatedLatencyMs >= 2000 && blouseResult.simulatedLatencyMs <= 10000);

  const forwardedPost = resolveInstagramInquiry({
    queryText: 'این مدل موجوده؟',
    attachedMediaId: 'IG-POST-PANTS-205',
  });
  assert.equal(forwardedPost.matched, true);
  assert.equal(forwardedPost.matchedBy, 'exact_media_id');
  assert.equal(forwardedPost.product?.categorySlug, 'pants');
});
