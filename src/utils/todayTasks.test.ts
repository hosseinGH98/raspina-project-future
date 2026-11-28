import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTodayTasks, jalaliDateKey, normalizeJalaliDate } from './todayTasks';
import { createEmptyState, type CrmState } from './stateSchema';
import type { Customer360, FollowUpTask, RmaRequest, SupportTicket } from '../types/crm';

function customer(overrides: Partial<Customer360>): Customer360 {
  return {
    id: 'c1',
    fullName: 'مشتری آزمون',
    phoneE164: '+989120000000',
    annualSpendToman: 0,
    tierCode: 'bronze',
    orders: [],
    tags: [],
    ...overrides,
  } as unknown as Customer360;
}

function state(overrides: Partial<CrmState>): CrmState {
  return { ...createEmptyState(), ...overrides };
}

test('jalali date keys normalize Persian digits and padding', () => {
  assert.equal(normalizeJalaliDate('۱۴۰۴/۰۸/۰۱'), '1404-08-01');
  assert.equal(normalizeJalaliDate('1404-8-1'), '1404-08-01');
  assert.equal(normalizeJalaliDate('نامعتبر'), '');
  assert.match(jalaliDateKey(new Date('2026-11-28T10:00:00+03:30')), /^\d{4}-\d{2}-\d{2}$/);
});

test('an empty CRM produces no tasks (no empty dashboard noise)', () => {
  assert.deepEqual(buildTodayTasks(createEmptyState(), '1404-08-21'), []);
});

test('only orders of the given day are counted as today orders', () => {
  const s = state({
    customers: [
      customer({
        id: 'c1',
        orders: [
          { id: 'o1', externalOrderId: 'A1', orderedAt: '۱۴۰۴/۰۸/۲۱' },
          { id: 'o2', externalOrderId: 'A2', orderedAt: '1404-08-21' },
          { id: 'o3', externalOrderId: 'A3', orderedAt: '۱۴۰۴/۰۸/۲۰' },
        ] as Customer360['orders'],
      }),
    ],
  });
  const tasks = buildTodayTasks(s, '1404-08-21');
  const orders = tasks.find((t) => t.id === 'orders_today');
  assert.equal(orders?.count, 2);
  assert.equal(orders?.target, 'customers');
});

test('overdue follow-ups count only pending tasks due today or flagged urgent', () => {
  const task = (id: string, dueLabelFa: string, status: FollowUpTask['status']): FollowUpTask =>
    ({ id, customerId: 'c1', customerName: 'x', dueLabelFa, status, tierCode: 'gold' }) as FollowUpTask;

  const s = state({
    followUps: [
      task('f1', 'امروز · سررسید فوری', 'pending'),
      task('f2', 'فوری · ریسک ریزش', 'pending'),
      task('f3', 'فردا · ۱۱:۰۰', 'pending'),
      task('f4', 'امروز · ۱۶:۰۰', 'completed'),
      task('f5', 'عقب‌افتاده · ۳ روز', 'pending'),
    ],
  });
  const tasks = buildTodayTasks(s, '1404-08-21');
  assert.equal(tasks.find((t) => t.id === 'overdue_followups')?.count, 3);
  assert.equal(tasks.find((t) => t.id === 'overdue_followups')?.target, 'followup');
});

test('SLA at-risk tickets exclude resolved tickets and comfortable timers', () => {
  const ticket = (id: string, elapsedHours: number, status: SupportTicket['status']): SupportTicket =>
    ({
      id,
      customerId: 'c1',
      customerName: 'x',
      firstReplySlaHours: 2,
      resolutionSlaHours: 24,
      elapsedHours,
      status,
    }) as SupportTicket;

  const s = state({
    tickets: [
      ticket('t1', 1.6, 'open'),
      ticket('t2', 5, 'in_progress'),
      ticket('t3', 0.2, 'open'),
      ticket('t4', 3, 'resolved'),
    ],
  });
  const tasks = buildTodayTasks(s, '1404-08-21');
  assert.equal(tasks.find((t) => t.id === 'sla_at_risk')?.count, 2);
});

test('pending RMA reviews and near-upgrade customers are surfaced', () => {
  const s = state({
    rmas: [
      { id: 'r1', status: 'pending_review' },
      { id: 'r2', status: 'refunded' },
    ] as RmaRequest[],
    customers: [
      customer({ id: 'c1', tierCode: 'bronze', annualSpendToman: 4_900_000 }),
      customer({ id: 'c2', tierCode: 'gold', annualSpendToman: 4_950_000 }),
      customer({ id: 'c3', tierCode: 'bronze', annualSpendToman: 1_000_000 }),
    ],
  });
  const tasks = buildTodayTasks(s, '1404-08-21');
  assert.equal(tasks.find((t) => t.id === 'rma_pending')?.count, 1);
  // c1 is 200k away from the gold threshold and still bronze; c2 is already gold.
  assert.equal(tasks.find((t) => t.id === 'tier_upgrade')?.count, 1);
});

test('tasks are ordered by urgency and each carries a one-line reason', () => {
  const s = state({
    followUps: [
      { id: 'f1', customerName: 'x', dueLabelFa: 'امروز', status: 'pending' },
    ] as FollowUpTask[],
    customers: [
      customer({
        id: 'c1',
        orders: [{ id: 'o1', externalOrderId: 'A1', orderedAt: '1404-08-21' }] as Customer360['orders'],
      }),
    ],
  });
  const tasks = buildTodayTasks(s, '1404-08-21');
  assert.deepEqual(
    tasks.map((t) => t.id),
    ['overdue_followups', 'orders_today']
  );
  for (const task of tasks) {
    assert.ok(task.why.length > 5, task.id);
    assert.ok(task.label.length > 5, task.id);
    assert.ok(task.count > 0, task.id);
  }
});
