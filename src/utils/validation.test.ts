import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeText,
  validateAmountToman,
  validateFullName,
  validateGiftCardAmount,
  validatePassword,
  validatePhone,
  validateUsername,
} from './validation';
import { createSeedState, validateCrmState, STATE_SCHEMA_VERSION } from './stateSchema';

test('sanitizeText strips control characters, collapses whitespace and enforces limits', () => {
  assert.equal(sanitizeText('  آزاده   شریفی \n', 120), 'آزاده شریفی');
  assert.equal(sanitizeText('a\u0000b\u200Bc', 120), 'a b c');
  assert.equal(sanitizeText('abcdef', 3), 'abc');
  assert.equal(sanitizeText(null, 10), '');
});

test('name, phone, amount and gift-card validation reject abuse cases', () => {
  assert.equal(validateFullName('آزاده شریفی'), null);
  assert.notEqual(validateFullName('a'), null);
  assert.notEqual(validateFullName('<script>alert(1)</script>'), null);

  assert.equal(validatePhone('09123456789'), null);
  assert.notEqual(validatePhone('12345'), null);

  assert.equal(validateAmountToman(1_500_000), null);
  assert.notEqual(validateAmountToman(0), null);
  assert.notEqual(validateAmountToman(5_000_000_001), null);
  assert.notEqual(validateAmountToman(1_000_000.5), null);

  assert.equal(validateGiftCardAmount(500_000), null);
  assert.notEqual(validateGiftCardAmount(150_000), null);
  assert.notEqual(validateGiftCardAmount(20_000_000), null);
});

test('credential policy enforces length and character diversity', () => {
  assert.equal(validateUsername('crm.admin_1'), null);
  assert.notEqual(validateUsername('ab'), null);
  assert.notEqual(validateUsername('نام فارسی'), null);

  assert.equal(validatePassword('RaspinaSecure2026'), null);
  assert.notEqual(validatePassword('short1'), null);
  assert.notEqual(validatePassword('onlyletterslong'), null);
});

test('state schema accepts the seed document and rejects corrupt payloads', () => {
  const seed = createSeedState();
  const valid = validateCrmState(seed);
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.state.schemaVersion, STATE_SCHEMA_VERSION);
    assert.ok(valid.state.customers.length > 0);
  }

  assert.equal(validateCrmState({}).ok, false);
  assert.equal(validateCrmState({ ...seed, customers: 'not-an-array' }).ok, false);
  assert.equal(validateCrmState({ ...seed, customers: [{ id: 'x' }] }).ok, false);

  const legacy = validateCrmState({ ...seed, schemaVersion: 2 });
  assert.equal(legacy.ok, true);
  if (legacy.ok) assert.equal(legacy.state.schemaVersion, STATE_SCHEMA_VERSION);
});
