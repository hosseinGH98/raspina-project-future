import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuthGate } from './components/AuthGate';
import { AppShell, type Notice, type SaveStatus, type WorkspaceTabId } from './components/AppShell';
import { CommandPalette, isTypingTarget } from './components/CommandPalette';
import { TodayView } from './components/TodayView';
import { Customers360View } from './components/Customers360View';
import { DashboardView } from './components/DashboardView';
import { FollowUpRmaView } from './components/FollowUpRmaView';
import { IntegrationsOpsView } from './components/IntegrationsOpsView';
import { LoyaltyClubView } from './components/LoyaltyClubView';
import { SegmentationJourneyView } from './components/SegmentationJourneyView';
import { SupportCampaignsView } from './components/SupportCampaignsView';
import { api, ApiError, getRuntimeConfig, type SessionUser } from './utils/apiClient';
import { applyWebhookOrderToCustomers, getTierSpec, type WebhookOrderInput } from './utils/crmEngine';
import { can, ROLE_LABELS, type Permission } from './utils/permissions';
import { buildSearchIndex, type SearchResult } from './utils/searchIndex';
import { buildTodayTasks, type TodayTarget } from './utils/todayTasks';
import {
  clearLocalState,
  createEmptyState,
  createSeedState,
  loadLocalState,
  saveLocalState,
  validateCrmState,
  type CrmState,
} from './utils/stateSchema';
import {
  sanitizeText,
  validateAmountToman,
  validateFullName,
  validateGiftCardAmount,
  validatePhone,
  validateRequiredText,
} from './utils/validation';
import type {
  AuditLogEntry,
  CampaignItem,
  Customer360,
  CustomerInteraction,
  GiftCardRecord,
  RbacRole,
  RmaRequest,
  SupportTicket,
  WebhookSimulationOutcome,
} from './types/crm';

type BootState = 'loading' | 'auth' | 'ready' | 'demo';

const MAX_AUDIT_LOGS = 100;

function nowFa(): string {
  return new Date().toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' });
}

function npsLabel(score: number): Customer360['npsLabel'] {
  return score >= 9 ? 'Promoter' : score >= 7 ? 'Passive' : 'Detractor';
}

function makeAudit(
  logs: AuditLogEntry[],
  action: string,
  target: string,
  role: RbacRole
): AuditLogEntry[] {
  return [
    {
      id: `aud-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      actorRole: role,
      action,
      target: sanitizeText(target, 160),
      timestamp: nowFa(),
    },
    ...logs,
  ].slice(0, MAX_AUDIT_LOGS);
}

function initialState(): CrmState {
  return loadLocalState() ?? createSeedState();
}

export function App() {
  const cfg = useMemo(getRuntimeConfig, []);
  const stateRef = useRef<CrmState>(initialState());
  const [state, setState] = useState<CrmState>(stateRef.current);
  const [boot, setBoot] = useState<BootState>('loading');
  const [bootError, setBootError] = useState('');
  const [demoReason, setDemoReason] = useState('');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTabId>('today');
  const [activeRole, setActiveRole] = useState<RbacRole>('ceo');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    stateRef.current.customers[0]?.id ?? null
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const versionRef = useRef(0);
  const skipNextSaveRef = useRef(true);
  const noticeTimerRef = useRef<number | null>(null);
  const activeRoleRef = useRef<RbacRole>('ceo');

  useEffect(() => {
    activeRoleRef.current = activeRole;
  }, [activeRole]);

  const todayTasks = useMemo(() => buildTodayTasks(state), [state]);
  const searchDocs = useMemo(() => buildSearchIndex(state), [state]);

  // Ctrl/⌘+K opens global search; `/` does too, unless the user is typing.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && (event.key === 'k' || event.key === 'K')) {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }
      if (event.key === '/' && !paletteOpen && !isTypingTarget(event.target)) {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [paletteOpen]);

  const notify = useCallback((kind: Notice['kind'], text: string) => {
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    setNotice({ id: Date.now(), kind, text });
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 8000);
  }, []);

  useEffect(
    () => () => {
      if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    },
    []
  );

  /** Applies a mutation against the freshest state snapshot (never a stale render closure). */
  const applyState = useCallback(<T,>(producer: (prev: CrmState) => { next: CrmState; result: T }): T => {
    const { next, result } = producer(stateRef.current);
    stateRef.current = next;
    setState(next);
    return result;
  }, []);

  const canAccess = useCallback(
    (permission: Permission) => can(activeRoleRef.current, permission),
    []
  );

  const requirePermission = useCallback(
    (permission: Permission, actionLabel: string): boolean => {
      if (canAccess(permission)) return true;
      notify(
        'error',
        `نقش «${ROLE_LABELS[activeRoleRef.current].label}» اجازه «${actionLabel}» را ندارد. با مدیرعامل تماس بگیرید.`
      );
      return false;
    },
    [canAccess, notify]
  );

  const hydrateFromServer = useCallback(
    async (session: SessionUser) => {
      const remote = await api.fetchState();
      if (remote.version > 0) {
        const validation = validateCrmState(remote.state);
        if (!validation.ok) {
          throw new ApiError(`داده سرور معتبر نیست: ${validation.errorFa}`, 500, 'invalid_state');
        }
        stateRef.current = validation.state;
        setState(validation.state);
        setSelectedCustomerId(validation.state.customers[0]?.id ?? null);
      } else {
        // A fresh production install starts empty; demo records must never be
        // written into a real customer database.
        const empty = createEmptyState();
        stateRef.current = empty;
        setState(empty);
        setSelectedCustomerId(null);
        const saved = await api.saveState(empty, 0);
        remote.version = saved.version;
      }
      versionRef.current = remote.version;
      // Server mode must not leave customer PII in browser storage.
      clearLocalState();
      skipNextSaveRef.current = true;
      setActiveRole(session.role);
      // Every new session starts on the "today" actions view.
      setActiveTab('today');
      setUser(session);
      setSaveStatus('saved');
    },
    []
  );

  const startDemo = useCallback((reason: string) => {
    const local = loadLocalState() ?? createSeedState();
    stateRef.current = local;
    setState(local);
    setSelectedCustomerId(local.customers[0]?.id ?? null);
    setDemoReason(reason);
    setSaveStatus('demo');
    setBoot('demo');
  }, []);

  // Bootstrap: session -> server data, or explicit demo mode.
  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      if (cfg.mode === 'demo') {
        startDemo('حالت نمایشی به‌صورت دستی در app-config.js انتخاب شده است.');
        return;
      }

      try {
        const session = await api.session();
        if (cancelled) return;
        await hydrateFromServer(session);
        if (!cancelled) setBoot('ready');
      } catch (error) {
        if (cancelled) return;

        if (error instanceof ApiError && error.status === 401) {
          setBoot('auth');
          return;
        }

        const apiMissing =
          cfg.mode === 'auto' &&
          error instanceof ApiError &&
          (error.status === 404 || error.status === 503 || error.code === 'invalid_response');

        if (apiMissing) {
          startDemo('API روی این هاست پیکربندی نشده است؛ برای عملیات واقعی راهنمای استقرار را اجرا کنید.');
          return;
        }

        setBootError(error instanceof Error ? error.message : 'خطای ناشناخته در شروع به کار.');
        setBoot('auth');
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [cfg.mode, hydrateFromServer, startDemo]);

  // Only demo mode caches data in the browser. Server mode keeps PII on the server.
  useEffect(() => {
    if (boot !== 'demo') return;
    saveLocalState(state);
  }, [state, boot]);

  // Debounced server save with optimistic concurrency (If-Match).
  useEffect(() => {
    if (boot !== 'ready' || !user) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    const timer = window.setTimeout(async () => {
      setSaveStatus('saving');
      try {
        const saved = await api.saveState(state, versionRef.current);
        versionRef.current = saved.version;
        setSaveStatus('saved');
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          setSaveStatus('conflict');
          notify('error', 'نسخه داده روی سرور تغییر کرده است؛ ذخیره‌سازی متوقف شد. صفحه را دوباره بارگذاری کنید.');
          return;
        }
        if (error instanceof ApiError && error.status === 401) {
          setUser(null);
          setBoot('auth');
          setSaveStatus('idle');
          notify('error', 'نشست شما منقضی شده است؛ دوباره وارد شوید.');
          return;
        }
        setSaveStatus('error');
        notify('error', 'ذخیره‌سازی روی سرور انجام نشد. داده‌ها موقتاً در این مرورگر نگه داشته شده‌اند.');
      }
    }, 900);

    return () => window.clearTimeout(timer);
  }, [state, boot, user, notify]);

  const handleAuthenticated = async (session: SessionUser) => {
    setBoot('loading');
    setBootError('');
    try {
      await hydrateFromServer(session);
      setBoot('ready');
    } catch (error) {
      setBootError(error instanceof Error ? error.message : 'بارگذاری داده سرور ناموفق بود.');
      setBoot('auth');
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // A failed logout still clears local session state.
    }
    setUser(null);
    setBoot('auth');
    setSaveStatus('idle');
    setNotice(null);
  };

  const handleInspectCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setActiveTab('customers');
  };

  const handleAddCustomer = (customer: Customer360) => {
    if (!requirePermission('customers:create', 'ثبت مشتری جدید')) return;
    const added = applyState((prev) => {
      if (prev.customers.some((c) => c.phoneE164 === customer.phoneE164)) {
        notify('error', 'مشتری با این شماره موبایل از قبل در CDP ثبت شده است.');
        return { next: prev, result: false };
      }
      const next: CrmState = {
        ...prev,
        customers: [customer, ...prev.customers],
        transactions: [
          {
            id: `ltx-${Date.now()}`,
            customerId: customer.id,
            customerName: customer.fullName,
            type: 'earn',
            actionFa: 'هدیه تکمیل پروفایل جدید باشگاه',
            pointsDelta: 100,
            createdAt: 'هم‌اکنون',
          },
          ...prev.transactions,
        ],
        auditLogs: makeAudit(prev.auditLogs, 'ثبت پروفایل جدید در CDP', customer.fullName, activeRoleRef.current),
      };
      return { next, result: true };
    });
    if (added) {
      notify('success', 'مشتری جدید در CDP ثبت شد و ۱۰۰ امتیاز تکمیل پروفایل دریافت کرد.');
    }
  };

  const handleAddInteraction = (customerId: string, interaction: CustomerInteraction) => {
    if (!requirePermission('customers:edit', 'ثبت تعامل مشتری')) return;
    const topicError = validateRequiredText(interaction.topic, 'موضوع تعامل', 120);
    const summaryError = validateRequiredText(interaction.summary, 'خلاصه تعامل', 500);
    if (topicError || summaryError) {
      notify('error', topicError ?? summaryError ?? 'اطلاعات تعامل نامعتبر است.');
      return;
    }

    applyState((prev) => {
      const target = prev.customers.find((c) => c.id === customerId);
      if (!target) {
        notify('error', 'مشتری یافت نشد.');
        return { next: prev, result: undefined };
      }
      const clean: CustomerInteraction = {
        ...interaction,
        topic: sanitizeText(interaction.topic, 120),
        summary: sanitizeText(interaction.summary, 500),
      };
      const next: CrmState = {
        ...prev,
        customers: prev.customers.map((c) =>
          c.id === customerId ? { ...c, interactions: [clean, ...c.interactions] } : c
        ),
        auditLogs: makeAudit(
          prev.auditLogs,
          `ثبت لاگ تعامل (${clean.topic})`,
          target.fullName,
          activeRoleRef.current
        ),
      };
      return { next, result: undefined };
    });
    notify('success', 'تعامل در پروفایل مشتری ثبت شد.');
  };

  const handleAddTag = (customerId: string, rawTag: string) => {
    if (!requirePermission('customers:edit', 'افزودن برچسب')) return;
    const tag = sanitizeText(rawTag, 40);
    if (tag.length < 2) {
      notify('error', 'برچسب باید حداقل ۲ نویسه باشد.');
      return;
    }
    applyState((prev) => {
      const target = prev.customers.find((c) => c.id === customerId);
      if (!target) return { next: prev, result: undefined };
      if (target.tags.includes(tag)) {
        notify('info', 'این برچسب از قبل روی مشتری ثبت شده است.');
        return { next: prev, result: undefined };
      }
      if (target.tags.length >= 20) {
        notify('error', 'حداکثر ۲۰ برچسب برای هر مشتری مجاز است.');
        return { next: prev, result: undefined };
      }
      const next: CrmState = {
        ...prev,
        customers: prev.customers.map((c) =>
          c.id === customerId ? { ...c, tags: [...c.tags, tag] } : c
        ),
        auditLogs: makeAudit(prev.auditLogs, `افزودن برچسب «${tag}»`, target.fullName, activeRoleRef.current),
      };
      return { next, result: undefined };
    });
  };

  const handleCompleteFollowUp = (taskId: string, rawNps: number, rawNote: string) => {
    if (!requirePermission('followup:complete', 'ثبت نتیجه پیگیری')) return;
    const npsScore = Math.min(10, Math.max(0, Math.round(Number(rawNps))));
    if (!Number.isFinite(npsScore)) {
      notify('error', 'امتیاز NPS نامعتبر است.');
      return;
    }
    const note = sanitizeText(rawNote, 500);
    if (note.length < 2) {
      notify('error', 'نتیجه پیگیری را وارد کنید.');
      return;
    }

    applyState((prev) => {
      const task = prev.followUps.find((t) => t.id === taskId);
      if (!task) return { next: prev, result: undefined };
      if (task.status !== 'pending') {
        notify('error', 'این وظیفه قبلاً بسته شده است.');
        return { next: prev, result: undefined };
      }

      const isDetractor = npsScore <= 6;
      const nextTickets: SupportTicket[] = isDetractor
        ? [
            {
              id: `tkt-${Date.now()}`,
              ticketCode: `TKT-${Math.floor(9100 + Math.random() * 899)}`,
              customerId: task.customerId,
              customerName: task.customerName,
              tierCode: task.tierCode,
              channel: 'تلفن',
              category: 'کیفیت محصول',
              subject: sanitizeText(
                `ارجاع خودکار پیگیری (NPS=${npsScore}): ${note}`,
                200
              ),
              firstReplySlaHours: Math.min(2, getTierSpec(task.tierCode).firstReplySlaHours),
              resolutionSlaHours: getTierSpec(task.tierCode).resolutionSlaHours,
              elapsedHours: 0,
              status: 'open',
              assignee: 'تیم رسیدگی فوری (SLA زیر ۲ ساعت)',
              createdAt: nowFa(),
            },
            ...prev.tickets,
          ]
        : prev.tickets;

      const next: CrmState = {
        ...prev,
        followUps: prev.followUps.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: isDetractor ? ('escalated' as const) : ('completed' as const),
                npsRecorded: npsScore,
                outcomeNote: note,
              }
            : t
        ),
        customers: prev.customers.map((c) =>
          c.id === task.customerId
            ? { ...c, npsLatest: npsScore, npsLabel: npsLabel(npsScore) }
            : c
        ),
        tickets: nextTickets,
        auditLogs: makeAudit(
          prev.auditLogs,
          isDetractor ? `ارجاع خودکار NPS پایین (${npsScore})` : `تکمیل پیگیری (NPS=${npsScore})`,
          task.customerName,
          activeRoleRef.current
        ),
      };
      return { next, result: undefined };
    });

    notify(
      npsScore <= 6 ? 'info' : 'success',
      npsScore <= 6
        ? 'NPS پایین ثبت شد و تیکت فوری برای کارشناس ساخته شد.'
        : 'نتیجه پیگیری با موفقیت ثبت شد.'
    );
  };

  const handleCreateRma = (input: {
    customerId: string;
    orderId: string;
    productTitle: string;
    reason: RmaRequest['reason'];
    refundAmountToman: number;
    refundTarget: RmaRequest['refundTarget'];
  }) => {
    if (!requirePermission('rma:create', 'ثبت درخواست مرجوعی')) return;
    const productTitle = sanitizeText(input.productTitle, 200);
    const amountError = validateAmountToman(input.refundAmountToman, 100_000, 500_000_000);
    if (productTitle.length < 3 || amountError) {
      notify('error', productTitle.length < 3 ? 'نام کالا معتبر نیست.' : amountError ?? 'مبلغ نامعتبر است.');
      return;
    }

    applyState((prev) => {
      const customer = prev.customers.find((c) => c.id === input.customerId);
      if (!customer) return { next: prev, result: undefined };
      const rma: RmaRequest = {
        id: `rma-${Date.now()}`,
        rmaCode: `RMA-${Math.floor(405000 + Math.random() * 8999)}`,
        customerId: customer.id,
        customerName: customer.fullName,
        tierCode: customer.tierCode,
        orderId: sanitizeText(input.orderId, 64) || 'RSH-MANUAL',
        productTitle,
        reason: input.reason,
        refundAmountToman: Math.round(input.refundAmountToman),
        refundTarget: input.refundTarget,
        status: 'pending_review',
        createdAt: nowFa(),
      };
      const next: CrmState = {
        ...prev,
        rmas: [rma, ...prev.rmas],
        auditLogs: makeAudit(
          prev.auditLogs,
          `ثبت درخواست مرجوع (${rma.rmaCode})`,
          customer.fullName,
          activeRoleRef.current
        ),
      };
      return { next, result: undefined };
    });
    notify('success', 'درخواست مرجوعی ثبت شد و در صف بررسی قرار گرفت.');
  };

  const handleAdvanceRma = (rmaId: string) => {
    if (!requirePermission('rma:advance', 'تأیید یا تسویه مرجوعی')) return;
    applyState((prev) => {
      const rma = prev.rmas.find((r) => r.id === rmaId);
      if (!rma) return { next: prev, result: undefined };
      if (rma.status === 'refunded') {
        notify('error', 'این مرجوعی قبلاً تسویه شده است.');
        return { next: prev, result: undefined };
      }

      const nextStatus: RmaRequest['status'] =
        rma.status === 'pending_review' ? 'approved_pickup' : 'refunded';

      const nextCustomers =
        nextStatus === 'refunded' && rma.refundTarget === 'wallet'
          ? prev.customers.map((c) =>
              c.id === rma.customerId
                ? { ...c, walletBalanceToman: c.walletBalanceToman + rma.refundAmountToman }
                : c
            )
          : prev.customers;

      const next: CrmState = {
        ...prev,
        rmas: prev.rmas.map((r) => (r.id === rmaId ? { ...r, status: nextStatus } : r)),
        customers: nextCustomers,
        auditLogs: makeAudit(
          prev.auditLogs,
          nextStatus === 'refunded' ? `بازگشت وجه مرجوعی (${rma.rmaCode})` : `تایید کد مرجوعی (${rma.rmaCode})`,
          rma.customerName,
          activeRoleRef.current
        ),
      };
      return { next, result: undefined };
    });

    const rma = stateRef.current.rmas.find((r) => r.id === rmaId);
    notify(
      'success',
      rma?.status === 'refunded' ? 'مرجوعی تکمیل و مبلغ به کیف پول مشتری واریز شد.' : 'کد مرجوعی تأیید شد.'
    );
  };

  const handleAwardPoints = (customerId: string, actionFa: string, points: number) => {
    if (!requirePermission('loyalty:award', 'اعطای امتیاز')) return;
    const amount = Math.round(Number(points));
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000) {
      notify('error', 'مقدار امتیاز نامعتبر است.');
      return;
    }
    const action = sanitizeText(actionFa, 100);

    applyState((prev) => {
      const customer = prev.customers.find((c) => c.id === customerId);
      if (!customer) return { next: prev, result: undefined };
      if (customer.pointsBalance + amount > 5_000_000) {
        notify('error', 'سقف موجودی امتیاز این مشتری تکمیل شده است.');
        return { next: prev, result: undefined };
      }
      const next: CrmState = {
        ...prev,
        customers: prev.customers.map((c) =>
          c.id === customerId ? { ...c, pointsBalance: c.pointsBalance + amount } : c
        ),
        transactions: [
          {
            id: `ltx-${Date.now()}`,
            customerId,
            customerName: customer.fullName,
            type: 'earn',
            actionFa: action,
            pointsDelta: amount,
            createdAt: 'هم‌اکنون',
          },
          ...prev.transactions,
        ],
        auditLogs: makeAudit(prev.auditLogs, `اعطای ${amount} امتیاز (${action})`, customer.fullName, activeRoleRef.current),
      };
      return { next, result: undefined };
    });
  };

  const handleRedeemReward = (
    customerId: string,
    rewardFa: string,
    pointsRequired: number,
    walletCreditToman?: number
  ) => {
    if (!requirePermission('loyalty:redeem', 'خرج امتیاز')) return;
    const cost = Math.round(Number(pointsRequired));
    if (!Number.isFinite(cost) || cost <= 0) {
      notify('error', 'امتیاز موردنیاز جایزه نامعتبر است.');
      return;
    }
    const reward = sanitizeText(rewardFa, 100);
    const credit = Math.max(0, Math.round(Number(walletCreditToman ?? 0)));

    const outcome = applyState((prev) => {
      const customer = prev.customers.find((c) => c.id === customerId);
      if (!customer) return { next: prev, result: 'missing' as const };
      if (customer.pointsBalance < cost) return { next: prev, result: 'insufficient' as const };

      const next: CrmState = {
        ...prev,
        customers: prev.customers.map((c) =>
          c.id === customerId
            ? {
                ...c,
                pointsBalance: c.pointsBalance - cost,
                walletBalanceToman: c.walletBalanceToman + credit,
              }
            : c
        ),
        transactions: [
          {
            id: `ltx-${Date.now()}`,
            customerId,
            customerName: customer.fullName,
            type: 'redeem',
            actionFa: reward,
            pointsDelta: -cost,
            createdAt: 'هم‌اکنون',
          },
          ...prev.transactions,
        ],
        auditLogs: makeAudit(prev.auditLogs, `خرج ${cost} امتیاز بابت ${reward}`, customer.fullName, activeRoleRef.current),
      };
      return { next, result: 'ok' as const };
    });

    if (outcome === 'insufficient') {
      notify('error', 'موجودی امتیاز مشتری برای این جایزه کافی نیست.');
    } else if (outcome === 'ok') {
      notify('success', `جایزه «${reward}» صادر شد.`);
    }
  };

  const handleIssueGiftCard = (input: {
    occasion: GiftCardRecord['occasion'];
    amountToman: number;
    recipientPhone: string;
    deliveryChannel: GiftCardRecord['deliveryChannel'];
  }) => {
    if (!requirePermission('loyalty:giftcard', 'صدور کارت هدیه')) return;
    const amountError = validateGiftCardAmount(input.amountToman);
    const phoneError = validatePhone(input.recipientPhone);
    if (amountError || phoneError) {
      notify('error', amountError ?? phoneError ?? 'اطلاعات کارت هدیه نامعتبر است.');
      return;
    }

    applyState((prev) => {
      const card: GiftCardRecord = {
        id: `gc-${Date.now()}`,
        code: `RASP-GIFT-${Math.floor(1000 + Math.random() * 8999)}`,
        occasion: input.occasion,
        amountToman: Math.round(input.amountToman),
        recipientPhone: sanitizeText(input.recipientPhone, 16),
        deliveryChannel: input.deliveryChannel,
        status: 'active',
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('fa-IR'),
      };
      const next: CrmState = {
        ...prev,
        giftCards: [card, ...prev.giftCards],
        auditLogs: makeAudit(
          prev.auditLogs,
          `صدور کارت هدیه ${card.amountToman.toLocaleString('fa-IR')} ت`,
          card.code,
          activeRoleRef.current
        ),
      };
      return { next, result: undefined };
    });
    notify('success', 'کارت هدیه دیجیتال صادر شد.');
  };

  const handleCreateTicket = (input: {
    customerId: string;
    channel: SupportTicket['channel'];
    category: SupportTicket['category'];
    subject: string;
  }) => {
    if (!requirePermission('support:create', 'ثبت تیکت')) return;
    const subject = sanitizeText(input.subject, 200);
    if (subject.length < 3) {
      notify('error', 'شرح تیکت باید حداقل ۳ نویسه باشد.');
      return;
    }

    applyState((prev) => {
      const customer = prev.customers.find((c) => c.id === input.customerId);
      if (!customer) return { next: prev, result: undefined };
      const tier = getTierSpec(customer.tierCode);
      const ticket: SupportTicket = {
        id: `tkt-${Date.now()}`,
        ticketCode: `TKT-${Math.floor(9100 + Math.random() * 899)}`,
        customerId: customer.id,
        customerName: customer.fullName,
        tierCode: customer.tierCode,
        channel: input.channel,
        category: input.category,
        subject,
        firstReplySlaHours: tier.firstReplySlaHours,
        resolutionSlaHours: tier.resolutionSlaHours,
        elapsedHours: 0,
        status: 'open',
        assignee: customer.tierCode === 'vip_black' ? 'مدیر اختصاصی VIP' : 'پشتیبانی متمرکز',
        createdAt: nowFa(),
      };
      const next: CrmState = {
        ...prev,
        tickets: [ticket, ...prev.tickets],
        auditLogs: makeAudit(prev.auditLogs, `ثبت تیکت (${ticket.ticketCode})`, customer.fullName, activeRoleRef.current),
      };
      return { next, result: undefined };
    });
    notify('success', 'تیکت در اینباکس پشتیبانی ثبت شد.');
  };

  const handleAdvanceTicket = (ticketId: string) => {
    if (!requirePermission('support:advance', 'تغییر وضعیت تیکت')) return;
    applyState((prev) => {
      const ticket = prev.tickets.find((t) => t.id === ticketId);
      if (!ticket || ticket.status === 'resolved') return { next: prev, result: undefined };
      const nextStatus: SupportTicket['status'] =
        ticket.status === 'open' ? 'in_progress' : 'resolved';
      const next: CrmState = {
        ...prev,
        tickets: prev.tickets.map((t) => (t.id === ticketId ? { ...t, status: nextStatus } : t)),
        auditLogs: makeAudit(
          prev.auditLogs,
          nextStatus === 'resolved' ? `بستن تیکت (${ticket.ticketCode})` : `شروع بررسی تیکت (${ticket.ticketCode})`,
          ticket.customerName,
          activeRoleRef.current
        ),
      };
      return { next, result: undefined };
    });
  };

  const handleToggleCampaign = (campaignId: string) => {
    if (!requirePermission('campaign:toggle', 'فعال یا متوقف کردن کمپین')) return;
    applyState((prev) => {
      const campaign = prev.campaigns.find((c) => c.id === campaignId);
      if (!campaign) return { next: prev, result: undefined };
      const next: CrmState = {
        ...prev,
        campaigns: prev.campaigns.map((c) =>
          c.id === campaignId ? { ...c, isActive: !c.isActive } : c
        ),
        auditLogs: makeAudit(
          prev.auditLogs,
          campaign.isActive ? `توقف کمپین ${campaign.title}` : `فعال‌سازی کمپین ${campaign.title}`,
          campaign.title,
          activeRoleRef.current
        ),
      };
      return { next, result: undefined };
    });
  };

  const handleCreateCampaign = (input: {
    title: string;
    channel: CampaignItem['channel'];
    targetSegment: string;
    templateWithTokens: string;
  }) => {
    if (!requirePermission('campaign:create', 'ساخت کمپین')) return;
    const title = sanitizeText(input.title, 120);
    const template = sanitizeText(input.templateWithTokens, 1000);
    const target = sanitizeText(input.targetSegment, 120);
    if (title.length < 3 || template.length < 5 || target.length < 2) {
      notify('error', 'عنوان، سگمنت هدف و متن پیام کمپین را کامل وارد کنید.');
      return;
    }

    applyState((prev) => {
      const campaign: CampaignItem = {
        id: `cmp-${Date.now()}`,
        title,
        type: 'broadcast',
        channel: input.channel,
        targetSegment: target,
        templateWithTokens: template,
        isActive: true,
        sentCount: 0,
        openOrReadRatePct: 0,
        conversionRatePct: 0,
        revenueToman: 0,
      };
      const next: CrmState = {
        ...prev,
        campaigns: [campaign, ...prev.campaigns],
        auditLogs: makeAudit(prev.auditLogs, 'ساخت کمپین جدید', title, activeRoleRef.current),
      };
      return { next, result: undefined };
    });
    notify('success', 'کمپین ساخته و فعال شد.');
  };

  const handleSimulateWebhookOrder = (payload: WebhookOrderInput): WebhookSimulationOutcome => {
    if (!requirePermission('integrations:simulate', 'شبیه‌سازی وب‌هوک سفارش')) {
      return { ok: false, errorFa: 'دسترسی لازم برای این عملیات وجود ندارد.' };
    }

    return applyState<WebhookSimulationOutcome>((prev) => {
      const result = applyWebhookOrderToCustomers(prev.customers, payload);
      if (!result.ok) {
        notify('error', result.errorFa);
        return { next: prev, result: { ok: false, errorFa: result.errorFa } };
      }

      if (result.duplicate) {
        notify('info', `سفارش ${payload.externalOrderId} قبلاً پردازش شده بود؛ از امتیازدهی مجدد جلوگیری شد.`);
        return {
          next: prev,
          result: {
            ok: true,
            duplicate: true,
            customerId: result.targetCustomer.id,
            customerName: result.targetCustomer.fullName,
            pointsEarned: 0,
            tierUpgraded: null,
          },
        };
      }

      const upgradedLabel = result.tierUpgradedFrom
        ? getTierSpec(result.targetCustomer.tierCode).nameFa
        : null;

      const next: CrmState = {
        ...prev,
        customers: result.updatedCustomers,
        followUps: result.newFollowUpTask
          ? [result.newFollowUpTask, ...prev.followUps]
          : prev.followUps,
        transactions: [
          {
            id: `ltx-${Date.now()}`,
            customerId: result.targetCustomer.id,
            customerName: result.targetCustomer.fullName,
            type: 'earn',
            actionFa: `سفارش وب‌هوک ${payload.externalOrderId} (${payload.sourceSite})`,
            pointsDelta: result.pointsEarned,
            createdAt: 'هم‌اکنون',
          },
          ...prev.transactions,
        ],
        auditLogs: makeAudit(
          prev.auditLogs,
          `همگام‌سازی سفارش ${payload.externalOrderId} (+${result.pointsEarned} امتیاز)`,
          result.targetCustomer.fullName,
          activeRoleRef.current
        ),
      };

      return {
        next,
        result: {
          ok: true,
          duplicate: false,
          customerId: result.targetCustomer.id,
          customerName: result.targetCustomer.fullName,
          pointsEarned: result.pointsEarned,
          tierUpgraded: upgradedLabel,
        },
      };
    });
  };

  const handleResetDemoData = () => {
    if (boot !== 'demo') {
      notify('error', 'بازنشانی داده فقط در حالت نمایشی مجاز است؛ داده سرور واقعی حذف نمی‌شود.');
      return;
    }
    if (typeof window !== 'undefined' && !window.confirm('همه تغییرات محلی این مرورگر حذف و داده نمونه بازنشانی شود؟')) {
      return;
    }
    clearLocalState();
    const seed = createSeedState();
    stateRef.current = seed;
    setState(seed);
    setSelectedCustomerId(seed.customers[0]?.id ?? null);
    notify('success', 'داده‌های نمونه بازنشانی شد.');
  };

  const openTicketsCount = state.tickets.filter((t) => t.status !== 'resolved').length;
  const pendingFollowupsCount = state.followUps.filter((f) => f.status === 'pending').length;
  const canSwitchRole = boot === 'demo' || user?.role === 'ceo';

  if (boot === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f6f2]">
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-[#c9a84c] border-t-transparent" />
          <p className="mt-3 text-xs font-bold text-[#52586c]">در حال بارگذاری پنل راسپینا…</p>
        </div>
      </div>
    );
  }

  if (boot === 'auth') {
    return (
      <AuthGate
        initialError={bootError}
        allowDemo={cfg.mode === 'auto'}
        demoReason="برای مشاهده رابط کاربری می‌توانید در حالت نمایشی ادامه دهید؛ این حالت داده واقعی ذخیره نمی‌کند."
        onAuthenticated={(session) => void handleAuthenticated(session)}
        onContinueDemo={() => startDemo('API پیکربندی نشده است؛ داده‌ها فقط در این مرورگر ذخیره می‌شوند.')}
      />
    );
  }

  const handleTodayTaskOpen = (target: TodayTarget) => {
    setActiveTab(target);
  };

  const handleSearchSelect = (result: SearchResult) => {
    setPaletteOpen(false);
    if (result.kind === 'ticket') {
      setActiveTab(result.target);
      return;
    }
    if (result.customerId) setSelectedCustomerId(result.customerId);
    setActiveTab(result.target);
  };

  return (
    <AppShell
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      activeRole={activeRole}
      onChangeRole={(role) => {
        if (!canSwitchRole) {
          notify('error', 'تغییر نقش فقط برای مدیرعامل مجاز است.');
          return;
        }
        setActiveRole(role);
        notify('info', `نقش فعال به «${ROLE_LABELS[role].label}» تغییر کرد.`);
        applyState((prev) => ({
          next: {
            ...prev,
            auditLogs: makeAudit(prev.auditLogs, 'تغییر سطح دسترسی فعال', ROLE_LABELS[role].label, role),
          },
          result: undefined,
        }));
      }}
      canSwitchRole={canSwitchRole}
      canAccess={canAccess}
      onQuickSimulateOrder={() => setActiveTab('integrations')}
      onResetDemoData={handleResetDemoData}
      canResetDemoData={boot === 'demo'}
      onLogout={() => void handleLogout()}
      user={user}
      mode={boot === 'demo' ? 'demo' : 'server'}
      demoReason={demoReason}
      saveStatus={saveStatus}
      notice={notice}
      onDismissNotice={() => setNotice(null)}
      onOpenSearch={() => setPaletteOpen(true)}
      commandPalette={
        <CommandPalette
          open={paletteOpen}
          docs={searchDocs}
          onClose={() => setPaletteOpen(false)}
          onSelect={handleSearchSelect}
        />
      }
      openTicketsCount={openTicketsCount}
      pendingFollowupsCount={pendingFollowupsCount}
    >
      {activeTab === 'today' && (
        <TodayView
          tasks={todayTasks}
          onOpenTask={handleTodayTaskOpen}
          onOpenSearch={() => setPaletteOpen(true)}
          onGoToDashboard={() => setActiveTab('dashboard')}
        />
      )}

      {activeTab === 'dashboard' && (
        <DashboardView
          customers={state.customers}
          onInspectCustomer={handleInspectCustomer}
          onNavigateTab={(tab) => setActiveTab(tab)}
        />
      )}

      {activeTab === 'customers' && (
        <Customers360View
          customers={state.customers}
          selectedCustomerId={selectedCustomerId}
          onSelectCustomer={setSelectedCustomerId}
          onAddCustomer={handleAddCustomer}
          onAddInteraction={handleAddInteraction}
          onAddTag={handleAddTag}
        />
      )}

      {activeTab === 'segments' && (
        <SegmentationJourneyView
          customers={state.customers}
          onInspectCustomer={handleInspectCustomer}
          onGoToCampaigns={() => setActiveTab('support_campaigns')}
        />
      )}

      {activeTab === 'followup' && (
        <FollowUpRmaView
          customers={state.customers}
          tasks={state.followUps}
          rmas={state.rmas}
          onCompleteFollowUp={handleCompleteFollowUp}
          onCreateRma={handleCreateRma}
          onAdvanceRma={handleAdvanceRma}
        />
      )}

      {activeTab === 'loyalty' && (
        <LoyaltyClubView
          customers={state.customers}
          transactions={state.transactions}
          familyGroups={state.familyGroups}
          giftCards={state.giftCards}
          onAwardPoints={handleAwardPoints}
          onRedeemReward={handleRedeemReward}
          onIssueGiftCard={handleIssueGiftCard}
        />
      )}

      {activeTab === 'support_campaigns' && (
        <SupportCampaignsView
          customers={state.customers}
          tickets={state.tickets}
          campaigns={state.campaigns}
          onCreateTicket={handleCreateTicket}
          onAdvanceTicket={handleAdvanceTicket}
          onToggleCampaign={handleToggleCampaign}
          onCreateCampaign={handleCreateCampaign}
        />
      )}

      {activeTab === 'integrations' && (
        <IntegrationsOpsView
          customers={state.customers}
          auditLogs={state.auditLogs}
          onSimulateWebhookOrder={handleSimulateWebhookOrder}
          onOpenCustomerProfile={handleInspectCustomer}
          canManageUsers={boot === 'ready' && canAccess('users:manage')}
          currentUsername={user?.username ?? ''}
        />
      )}
    </AppShell>
  );
}

export default App;
