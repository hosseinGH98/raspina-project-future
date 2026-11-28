import {
  INITIAL_AUDIT_LOGS,
  INITIAL_CAMPAIGNS,
  INITIAL_CUSTOMERS,
  INITIAL_FAMILY_GROUPS,
  INITIAL_FOLLOWUP_TASKS,
  INITIAL_GIFT_CARDS,
  INITIAL_LOYALTY_TRANSACTIONS,
  INITIAL_RMAS,
  INITIAL_TICKETS,
} from '../data/crmSeed';
import type {
  AuditLogEntry,
  CampaignItem,
  Customer360,
  FamilyGroup,
  FollowUpTask,
  GiftCardRecord,
  LoyaltyTransaction,
  RmaRequest,
  SupportTicket,
} from '../types/crm';

export const STATE_SCHEMA_VERSION = 3;
export const STORAGE_KEY = 'raspina_crm_state_v3';
export const LEGACY_STORAGE_KEY = 'raspina_crm_state_v2';

export interface CrmState {
  schemaVersion: number;
  customers: Customer360[];
  transactions: LoyaltyTransaction[];
  followUps: FollowUpTask[];
  rmas: RmaRequest[];
  tickets: SupportTicket[];
  campaigns: CampaignItem[];
  familyGroups: FamilyGroup[];
  giftCards: GiftCardRecord[];
  auditLogs: AuditLogEntry[];
}

export function createEmptyState(): CrmState {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    customers: [],
    transactions: [],
    followUps: [],
    rmas: [],
    tickets: [],
    campaigns: [],
    familyGroups: [],
    giftCards: [],
    auditLogs: [],
  };
}

export function createSeedState(): CrmState {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    customers: INITIAL_CUSTOMERS,
    transactions: INITIAL_LOYALTY_TRANSACTIONS,
    followUps: INITIAL_FOLLOWUP_TASKS,
    rmas: INITIAL_RMAS,
    tickets: INITIAL_TICKETS,
    campaigns: INITIAL_CAMPAIGNS,
    familyGroups: INITIAL_FAMILY_GROUPS,
    giftCards: INITIAL_GIFT_CARDS,
    auditLogs: INITIAL_AUDIT_LOGS,
  };
}

const ARRAY_KEYS = [
  'customers',
  'transactions',
  'followUps',
  'rmas',
  'tickets',
  'campaigns',
  'familyGroups',
  'giftCards',
  'auditLogs',
] as const;

type ArrayKey = (typeof ARRAY_KEYS)[number];

const MAX_ITEMS: Record<ArrayKey, number> = {
  customers: 5_000,
  transactions: 20_000,
  followUps: 20_000,
  rmas: 20_000,
  tickets: 20_000,
  campaigns: 2_000,
  familyGroups: 2_000,
  giftCards: 10_000,
  auditLogs: 1_000,
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCustomerLike(value: unknown): value is Customer360 {
  if (!isPlainObject(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.fullName === 'string' &&
    typeof value.phoneE164 === 'string' &&
    typeof value.tierCode === 'string' &&
    Array.isArray(value.orders) &&
    Array.isArray(value.identities) &&
    Array.isArray(value.tags) &&
    isPlainObject(value.scores)
  );
}

export interface StateValidationFailure {
  ok: false;
  errorFa: string;
}

export interface StateValidationSuccess {
  ok: true;
  state: CrmState;
}

/**
 * Validates an untrusted state document (localStorage or server snapshot).
 * Unknown extra keys are dropped; malformed documents are rejected as a whole
 * so a corrupted payload can never partially overwrite a working CRM.
 */
export function validateCrmState(raw: unknown): StateValidationSuccess | StateValidationFailure {
  if (!isPlainObject(raw)) {
    return { ok: false, errorFa: 'ساختار داده CRM نامعتبر است.' };
  }

  const schemaVersion = Number(raw.schemaVersion ?? raw.version ?? 2);
  if (!Number.isFinite(schemaVersion) || schemaVersion < 2) {
    return { ok: false, errorFa: 'نسخه داده CRM پشتیبانی نمی‌شود.' };
  }

  for (const key of ARRAY_KEYS) {
    const value = raw[key];
    if (!Array.isArray(value)) {
      return { ok: false, errorFa: `بخش «${key}» در داده CRM یافت نشد.` };
    }
    if (value.length > MAX_ITEMS[key]) {
      return { ok: false, errorFa: `تعداد رکوردهای «${key}» بیش از حد مجاز است.` };
    }
  }

  const customers = raw.customers as unknown[];
  if (!customers.every(isCustomerLike)) {
    return { ok: false, errorFa: 'یکی از پروفایل‌های مشتری ناقص یا نامعتبر است.' };
  }

  const state: CrmState = {
    schemaVersion: STATE_SCHEMA_VERSION,
    customers: raw.customers as Customer360[],
    transactions: raw.transactions as LoyaltyTransaction[],
    followUps: raw.followUps as FollowUpTask[],
    rmas: raw.rmas as RmaRequest[],
    tickets: raw.tickets as SupportTicket[],
    campaigns: raw.campaigns as CampaignItem[],
    familyGroups: raw.familyGroups as FamilyGroup[],
    giftCards: raw.giftCards as GiftCardRecord[],
    auditLogs: raw.auditLogs as AuditLogEntry[],
  };

  return { ok: true, state };
}

export function loadLocalState(): CrmState | null {
  if (typeof window === 'undefined') return null;

  for (const key of [STORAGE_KEY, LEGACY_STORAGE_KEY]) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed: unknown = JSON.parse(raw);
      const validation = validateCrmState(parsed);
      if (validation.ok) {
        if (key === LEGACY_STORAGE_KEY) {
          // Upgrade the legacy document under the new key and remove the old one.
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(validation.state));
          window.localStorage.removeItem(LEGACY_STORAGE_KEY);
        }
        return validation.state;
      }
      window.localStorage.removeItem(key);
    } catch {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Storage can be unavailable in private mode; fall through to seeds.
      }
    }
  }
  return null;
}

export function saveLocalState(state: CrmState): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearLocalState(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}
