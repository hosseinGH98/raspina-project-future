import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchIndex, normalizeForSearch, searchAll } from './searchIndex';
import { createEmptyState } from './stateSchema';
import type { Customer360, SupportTicket } from '../types/crm';

function customer(overrides: Partial<Customer360>): Customer360 {
  return {
    id: 'c1',
    fullName: 'مشتری آزمون',
    phoneE164: '+989120000000',
    city: 'همدان',
    tierCode: 'gold',
    tags: [],
    orders: [],
    ...overrides,
  } as unknown as Customer360;
}

test('normalization unifies Arabic/Persian letters, digits and spacing', () => {
  assert.equal(normalizeForSearch('  علي   كريمي  '), 'علی کریمی');
  assert.equal(normalizeForSearch('۰۹۱۲۳۴۵۶۷۸۹'), '09123456789');
  assert.equal(normalizeForSearch('مشتری\u200cVIP'), 'مشتریvip');
});

test('phone search works with local format, spaces and Persian digits', () => {
  const docs = buildSearchIndex({
    customers: [customer({ id: 'c1', fullName: 'سارا رضایی', phoneE164: '+989123456789' })],
    tickets: [],
  });
  for (const query of ['0912 345 6789', '۰۹۱۲۳۴۵۶۷۸۹', '9123456789', '+989123456789']) {
    const results = searchAll(docs, query);
    assert.equal(results[0]?.id, 'c1', query);
    assert.equal(results[0]?.kind, 'customer');
    assert.equal(results[0]?.target, 'customers');
  }
});

test('name search tolerates extra spaces and Arabic letters', () => {
  const docs = buildSearchIndex({
    customers: [customer({ id: 'c1', fullName: 'علی کریمی', phoneE164: '+989120000001' })],
    tickets: [],
  });
  const results = searchAll(docs, '  علي   كريمي ');
  assert.equal(results.length, 1);
  assert.equal(results[0].customerId, 'c1');
});

test('orders and tickets are searchable by their codes and open their owner', () => {
  const docs = buildSearchIndex({
    customers: [
      customer({
        id: 'c1',
        fullName: 'مریم احمدی',
        phoneE164: '+989120000002',
        orders: [{ id: 'o1', externalOrderId: 'RSH-1001', orderedAt: '1404-08-21' }],
      } as Partial<Customer360>),
    ] as Customer360[],
    tickets: [
      {
        id: 't1',
        ticketCode: 'TKT-9101',
        subject: 'پیگیری ارسال',
        customerId: 'c1',
        customerName: 'مریم احمدی',
        status: 'open',
        tierCode: 'gold',
      } as SupportTicket,
    ],
  });

  const order = searchAll(docs, 'rsh-1001')[0];
  assert.equal(order?.kind, 'order');
  assert.equal(order?.customerId, 'c1');

  const ticket = searchAll(docs, 'TKT-9101')[0];
  assert.equal(ticket?.kind, 'ticket');
  assert.equal(ticket?.target, 'support_campaigns');
});

test('an unmatched query returns nothing and blank queries are ignored', () => {
  const docs = buildSearchIndex({
    customers: [customer({ id: 'c1', fullName: 'زهرا نوری', phoneE164: '+989120000003' })],
    tickets: [],
  });
  assert.deepEqual(searchAll(docs, 'هیچ‌چیز'), []);
  assert.deepEqual(searchAll(docs, '   '), []);
});

test('results are capped at 20 with the closest match first', () => {
  const customers = Array.from({ length: 25 }, (_, i) =>
    customer({
      id: `c${i}`,
      fullName: i === 24 ? 'کریمی' : `کریمی شماره ${i}`,
      phoneE164: `+9891200000${String(i).padStart(2, '0')}`,
    })
  );
  const docs = buildSearchIndex({ customers, tickets: [] });
  const results = searchAll(docs, 'کریمی');
  assert.equal(results.length, 20);
  assert.equal(results[0].id, 'c24');
});
