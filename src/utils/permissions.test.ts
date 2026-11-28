import test from 'node:test';
import assert from 'node:assert/strict';
import { can, permissionsFor, ROLE_LABELS } from './permissions';
import type { RbacRole } from '../types/crm';

const ROLES = Object.keys(ROLE_LABELS) as RbacRole[];

test('every role can reach the dashboard and at least one customer view', () => {
  for (const role of ROLES) {
    assert.equal(can(role, 'dashboard:view'), true, role);
    assert.ok(permissionsFor(role).length > 0, role);
  }
});

test('least privilege: analysts and marketers cannot mutate loyalty balances', () => {
  for (const role of ['analyst', 'marketing'] as RbacRole[]) {
    assert.equal(can(role, 'loyalty:award'), false, role);
    assert.equal(can(role, 'loyalty:redeem'), false, role);
  }
});

test('support cannot award points or create campaigns; sales cannot settle RMA or toggle campaigns', () => {
  assert.equal(can('support', 'loyalty:award'), false);
  assert.equal(can('support', 'campaign:create'), false);
  assert.equal(can('sales', 'rma:advance'), false);
  assert.equal(can('sales', 'campaign:toggle'), false);
  assert.equal(can('support', 'followup:complete'), true);
  assert.equal(can('sales', 'customers:create'), true);
});

test('only the CEO receives every sensitive permission', () => {
  for (const permission of [
    'loyalty:award',
    'loyalty:redeem',
    'loyalty:giftcard',
    'rma:advance',
    'campaign:create',
    'campaign:toggle',
    'integrations:simulate',
    'audit:view',
    'users:manage',
  ] as const) {
    assert.equal(can('ceo', permission), true, permission);
  }

  const nonCeoCanSimulate = ROLES.filter(
    (role) => role !== 'ceo' && can(role, 'integrations:simulate')
  );
  assert.deepEqual(nonCeoCanSimulate, []);

  const nonCeoCanManageUsers = ROLES.filter(
    (role) => role !== 'ceo' && can(role, 'users:manage')
  );
  assert.deepEqual(nonCeoCanManageUsers, []);
});

test('unknown roles never gain permissions', () => {
  assert.equal(can('guest' as RbacRole, 'dashboard:view'), false);
  assert.deepEqual(permissionsFor('guest' as RbacRole), []);
});
