import type { RbacRole } from '../types/crm';

export type Permission =
  | 'dashboard:view'
  | 'customers:view'
  | 'customers:create'
  | 'customers:edit'
  | 'segments:view'
  | 'followup:view'
  | 'followup:complete'
  | 'rma:view'
  | 'rma:create'
  | 'rma:advance'
  | 'loyalty:view'
  | 'loyalty:award'
  | 'loyalty:redeem'
  | 'loyalty:giftcard'
  | 'support:view'
  | 'support:create'
  | 'support:advance'
  | 'campaign:view'
  | 'campaign:create'
  | 'campaign:toggle'
  | 'integrations:view'
  | 'integrations:simulate'
  | 'audit:view'
  | 'users:manage';

/**
 * Client-side mirror of the server ACL. The PHP API enforces the same matrix,
 * so hiding a control is a UX affordance, never the security boundary.
 */
const ROLE_PERMISSIONS: Record<RbacRole, readonly Permission[]> = {
  ceo: [
    'dashboard:view',
    'customers:view',
    'customers:create',
    'customers:edit',
    'segments:view',
    'followup:view',
    'followup:complete',
    'rma:view',
    'rma:create',
    'rma:advance',
    'loyalty:view',
    'loyalty:award',
    'loyalty:redeem',
    'loyalty:giftcard',
    'support:view',
    'support:create',
    'support:advance',
    'campaign:view',
    'campaign:create',
    'campaign:toggle',
    'integrations:view',
    'integrations:simulate',
    'audit:view',
    'users:manage',
  ],
  branch_manager: [
    'dashboard:view',
    'customers:view',
    'customers:create',
    'customers:edit',
    'segments:view',
    'followup:view',
    'followup:complete',
    'rma:view',
    'rma:create',
    'rma:advance',
    'loyalty:view',
    'support:view',
    'support:create',
    'support:advance',
    'integrations:view',
  ],
  marketing: [
    'dashboard:view',
    'customers:view',
    'segments:view',
    'loyalty:view',
    'loyalty:giftcard',
    'campaign:view',
    'campaign:create',
    'campaign:toggle',
    'support:view',
    'integrations:view',
  ],
  support: [
    'dashboard:view',
    'customers:view',
    'customers:edit',
    'followup:view',
    'followup:complete',
    'rma:view',
    'rma:create',
    'rma:advance',
    'loyalty:view',
    'support:view',
    'support:create',
    'support:advance',
    'integrations:view',
  ],
  sales: [
    'dashboard:view',
    'customers:view',
    'customers:create',
    'customers:edit',
    'segments:view',
    'followup:view',
    'followup:complete',
    'rma:view',
    'rma:create',
    'loyalty:view',
    'integrations:view',
  ],
  analyst: [
    'dashboard:view',
    'customers:view',
    'segments:view',
    'loyalty:view',
    'support:view',
    'campaign:view',
    'integrations:view',
    'audit:view',
  ],
};

export function can(role: RbacRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function permissionsFor(role: RbacRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export const ROLE_LABELS: Record<RbacRole, { label: string; scope: string }> = {
  ceo: { label: 'مدیرعامل (CEO)', scope: 'دسترسی کامل ۱۶ ماژول' },
  branch_manager: { label: 'مدیر شعبه همدان/تهران', scope: 'مشتریان، POS، پیگیری و مرجوعی' },
  marketing: { label: 'تیم مارکتینگ', scope: 'سگمنت، باشگاه، کارت هدیه و کمپین‌ها' },
  support: { label: 'کارشناس پشتیبانی', scope: 'تیکتینگ SLA، پیگیری و RMA' },
  sales: { label: 'فروش و استایلیست', scope: 'پروفایل ۳۶۰، ثبت مشتری و مشاوره VIP' },
  analyst: { label: 'آنالیست داده', scope: 'کوهورت، RFM، KPI و Audit Log (فقط خواندن)' },
};
