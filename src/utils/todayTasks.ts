import { getTierProgress, toLatinDigits } from './crmEngine';
import type { CrmState } from './stateSchema';

export type TodayTarget = 'customers' | 'followup' | 'support_campaigns' | 'loyalty';

export type TodayTaskId =
  | 'overdue_followups'
  | 'sla_at_risk'
  | 'orders_today'
  | 'rma_pending'
  | 'tier_upgrade';

export interface TodayTask {
  id: TodayTaskId;
  label: string;
  count: number;
  why: string;
  target: TodayTarget;
  /** Lower number = more urgent; used for display order only. */
  priority: number;
}

function pad2(value: string): string {
  return value.padStart(2, '0');
}

/** Today's Jalali date as `YYYY-MM-DD`, computed with Latin digits. */
export function jalaliDateKey(date: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Asia/Tehran',
    }).formatToParts(date);
    const pick = (type: string) => toLatinDigits(parts.find((p) => p.type === type)?.value ?? '');
    const year = pick('year');
    const month = pick('month');
    const day = pick('day');
    if (!/^\d{4}$/.test(year)) return '';
    return `${year}-${pad2(month)}-${pad2(day)}`;
  } catch {
    return '';
  }
}

/** Normalizes a stored Jalali date (`۱۴۰۴/۰۸/۲۱`) to `1404-08-21`; empty on garbage. */
export function normalizeJalaliDate(raw: string): string {
  const latin = toLatinDigits(String(raw ?? '')).trim();
  const match = latin.match(/(\d{4})\D(\d{1,2})\D(\d{1,2})/);
  if (!match) return '';
  return `${match[1]}-${pad2(match[2])}-${pad2(match[3])}`;
}

const URGENT_DUE = /امروز|فوری|عقب|سررسید/;

/**
 * Builds the "today" action cards from the same trusted snapshot the views use,
 * so counts always match what the user sees after following the link.
 */
export function buildTodayTasks(state: CrmState, todayKey: string = jalaliDateKey()): TodayTask[] {
  const tasks: TodayTask[] = [];

  const overdueFollowUps = state.followUps.filter(
    (task) => task.status === 'pending' && URGENT_DUE.test(task.dueLabelFa ?? '')
  ).length;
  if (overdueFollowUps > 0) {
    tasks.push({
      id: 'overdue_followups',
      label: 'پیگیری‌های سررسیده',
      count: overdueFollowUps,
      why: 'هر تماس امروز، شانس بازگشت مشتری را بیشتر می‌کند.',
      target: 'followup',
      priority: 1,
    });
  }

  const slaAtRisk = state.tickets.filter(
    (ticket) =>
      ticket.status !== 'resolved' &&
      ticket.firstReplySlaHours > 0 &&
      ticket.elapsedHours >= ticket.firstReplySlaHours * 0.75
  ).length;
  if (slaAtRisk > 0) {
    tasks.push({
      id: 'sla_at_risk',
      label: 'تیکت‌های نزدیک به نقض SLA',
      count: slaAtRisk,
      why: 'پاسخ دیرتر از تعهد SLA، رضایت و امتیاز باشگاه را پایین می‌آورد.',
      target: 'support_campaigns',
      priority: 2,
    });
  }

  if (todayKey) {
    const ordersToday = state.customers.reduce(
      (sum, customer) =>
        sum +
        customer.orders.filter((order) => normalizeJalaliDate(order.orderedAt) === todayKey).length,
      0
    );
    if (ordersToday > 0) {
      tasks.push({
        id: 'orders_today',
        label: 'سفارش‌های امروز',
        count: ordersToday,
        why: 'پرداخت و وضعیت ارسال سفارش‌های امروز را همان روز بررسی کنید.',
        target: 'customers',
        priority: 3,
      });
    }
  }

  const pendingRmas = state.rmas.filter((rma) => rma.status === 'pending_review').length;
  if (pendingRmas > 0) {
    tasks.push({
      id: 'rma_pending',
      label: 'مرجوعی‌های در انتظار بررسی',
      count: pendingRmas,
      why: 'بررسی دیرتر، بازگشت وجه مشتری را عقب می‌اندازد.',
      target: 'followup',
      priority: 4,
    });
  }

  const nearUpgrade = state.customers.filter((customer) => {
    const progress = getTierProgress(customer.annualSpendToman);
    if (!progress.next) return false;
    // Only customers who really sit in the lower tier count; a manual VIP invite
    // must not be reported as "about to upgrade".
    if (progress.current.code !== customer.tierCode) return false;
    return (
      progress.amountToNextToman > 0 &&
      progress.amountToNextToman <= progress.next.minAnnualToman * 0.05
    );
  }).length;
  if (nearUpgrade > 0) {
    tasks.push({
      id: 'tier_upgrade',
      label: 'مشتریان نزدیک ارتقای سطح',
      count: nearUpgrade,
      why: 'کمتر از ۵٪ تا سطح بالاتر مانده؛ یک پیام یادآوری کافی است.',
      target: 'loyalty',
      priority: 5,
    });
  }

  return tasks.sort((a, b) => a.priority - b.priority);
}
