import { formatIranPhone, toLatinDigits } from './crmEngine';
import type { CrmState } from './stateSchema';
import type { Customer360, SupportTicket } from '../types/crm';

export type SearchKind = 'customer' | 'order' | 'ticket';
export type SearchTarget = 'customers' | 'followup' | 'support_campaigns';

export interface SearchDoc {
  id: string;
  kind: SearchKind;
  title: string;
  subtitle: string;
  keywords: string[];
  phoneDigits: string;
  customerId?: string;
  target: SearchTarget;
}

export interface SearchResult extends Omit<SearchDoc, 'keywords' | 'phoneDigits' | 'target'> {
  target: SearchTarget;
  score: number;
}

const MAX_DOCS = 20_000;
export const SEARCH_RESULT_LIMIT = 20;

/**
 * Folds Persian/Arabic variants onto one form, drops zero-width joiners and
 * collapses whitespace so "علي  كريمي" and "علی کریمی" match the same record.
 */
export function normalizeForSearch(input: string): string {
  return toLatinDigits(String(input ?? ''))
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u200c\u200d\u200e\u200f]/g, '')
    .replace(/[\u064b-\u0652\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function digitsOf(input: string): string {
  return toLatinDigits(String(input ?? '')).replace(/\D/g, '');
}

/** National mobile digits, so `+98912…`, `0912…` and `912…` compare equal. */
function nationalDigits(input: string): string {
  return digitsOf(input).replace(/^0098/, '').replace(/^98/, '').replace(/^0/, '');
}

function customerDoc(customer: Customer360): SearchDoc {
  const phone = formatIranPhone(customer.phoneE164);
  return {
    id: customer.id,
    kind: 'customer',
    title: customer.fullName,
    subtitle: `${phone} · ${customer.city} · ${customer.tierCode}`,
    keywords: [customer.id, customer.fullName, customer.city, customer.tierCode, ...customer.tags],
    phoneDigits: nationalDigits(customer.phoneE164),
    customerId: customer.id,
    target: 'customers',
  };
}

function orderDocs(customer: Customer360): SearchDoc[] {
  return customer.orders.map((order) => ({
    id: `${customer.id}:${order.id}`,
    kind: 'order' as const,
    title: order.externalOrderId,
    subtitle: `${customer.fullName} · ${order.orderedAt}`,
    keywords: [
      order.externalOrderId,
      order.itemsSummary ?? '',
      order.sourceSite ?? '',
      customer.fullName,
    ],
    phoneDigits: nationalDigits(customer.phoneE164),
    customerId: customer.id,
    target: 'customers' as const,
  }));
}

function ticketDoc(ticket: SupportTicket): SearchDoc {
  return {
    id: ticket.id,
    kind: 'ticket',
    title: `${ticket.ticketCode} — ${ticket.subject}`,
    subtitle: `${ticket.customerName} · ${ticket.status}`,
    keywords: [ticket.ticketCode, ticket.subject, ticket.customerName, ticket.ticketCode],
    phoneDigits: '',
    customerId: ticket.customerId,
    target: 'support_campaigns',
  };
}

/** Builds a flat, normalized index once per state change (no per-keystroke work). */
export function buildSearchIndex(state: Pick<CrmState, 'customers' | 'tickets'>): SearchDoc[] {
  const docs: SearchDoc[] = [];
  for (const customer of state.customers) {
    docs.push(customerDoc(customer));
    docs.push(...orderDocs(customer));
    if (docs.length >= MAX_DOCS) return docs.slice(0, MAX_DOCS);
  }
  for (const ticket of state.tickets) {
    docs.push(ticketDoc(ticket));
    if (docs.length >= MAX_DOCS) break;
  }
  return docs;
}

/**
 * Ranks phone matches above name matches and prefix matches above substring
 * matches, then caps the list so a screen reader never reads an endless list.
 */
export function searchAll(
  docs: SearchDoc[],
  query: string,
  limit: number = SEARCH_RESULT_LIMIT
): SearchResult[] {
  const normalized = normalizeForSearch(query);
  if (!normalized) return [];
  const queryDigits = nationalDigits(query);

  const scored: SearchResult[] = [];
  for (const doc of docs) {
    let score = 0;

    if (queryDigits.length >= 4 && doc.phoneDigits.endsWith(queryDigits)) score = 120;

    const title = normalizeForSearch(doc.title);
    if (title === normalized) score = Math.max(score, 100);
    else if (title.startsWith(normalized)) score = Math.max(score, 80);
    else if (title.includes(normalized)) score = Math.max(score, 60);

    for (const keyword of doc.keywords) {
      const value = normalizeForSearch(keyword);
      if (!value) continue;
      if (value === normalized) score = Math.max(score, 70);
      else if (value.startsWith(normalized)) score = Math.max(score, 50);
      else if (value.includes(normalized)) score = Math.max(score, 30);
    }

    if (normalizeForSearch(doc.subtitle).includes(normalized)) score = Math.max(score, 20);

    if (score > 0) {
      scored.push({
        id: doc.id,
        kind: doc.kind,
        title: doc.title,
        subtitle: doc.subtitle,
        customerId: doc.customerId,
        target: doc.target,
        score,
      });
    }
  }

  scored.sort(
    (a, b) => b.score - a.score || a.title.length - b.title.length || a.title.localeCompare(b.title, 'fa')
  );
  return scored.slice(0, Math.max(1, limit));
}
