import { useEffect, useState } from 'react';
import { AppShell, type WorkspaceTabId } from './components/AppShell';
import { Customers360View } from './components/Customers360View';
import { DashboardView } from './components/DashboardView';
import { FollowUpRmaView } from './components/FollowUpRmaView';
import { IntegrationsOpsView } from './components/IntegrationsOpsView';
import { LoyaltyClubView } from './components/LoyaltyClubView';
import { SegmentationJourneyView } from './components/SegmentationJourneyView';
import { SupportCampaignsView } from './components/SupportCampaignsView';
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
} from './data/crmSeed';
import type {
  AuditLogEntry,
  CampaignItem,
  Customer360,
  CustomerInteraction,
  FamilyGroup,
  FollowUpTask,
  GiftCardRecord,
  LoyaltyTransaction,
  RbacRole,
  RmaRequest,
  SupportTicket,
} from './types/crm';
import {
  applyWebhookOrderToCustomers,
  getTierSpec,
  type WebhookOrderInput,
} from './utils/crmEngine';

const STORAGE_KEY = 'raspina_crm_state_v2';

interface PersistedCrmState {
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

function getInitialState(): PersistedCrmState {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedCrmState;
        if (Array.isArray(parsed.customers) && parsed.customers.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Fallback to default seed data if storage is unavailable or corrupted
    }
  }
  return {
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

export function App() {
  const [state, setState] = useState<PersistedCrmState>(getInitialState);
  const [activeTab, setActiveTab] = useState<WorkspaceTabId>('dashboard');
  const [activeRole, setActiveRole] = useState<RbacRole>('ceo');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    state.customers[0]?.id ?? null
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors
    }
  }, [state]);

  const appendAudit = (
    prevLogs: AuditLogEntry[],
    action: string,
    target: string,
    role: RbacRole = activeRole
  ): AuditLogEntry[] => [
    {
      id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      actorRole: role,
      action,
      target,
      timestamp: 'هم‌اکنون',
    },
    ...prevLogs.slice(0, 39),
  ];

  const handleInspectCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setActiveTab('customers');
  };

  const handleAddCustomer = (customer: Customer360) => {
    setState((prev) => ({
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
      auditLogs: appendAudit(prev.auditLogs, 'ثبت پروفایل جدید در CDP', customer.fullName),
    }));
  };

  const handleAddInteraction = (customerId: string, interaction: CustomerInteraction) => {
    setState((prev) => {
      const target = prev.customers.find((c) => c.id === customerId);
      return {
        ...prev,
        customers: prev.customers.map((c) =>
          c.id === customerId ? { ...c, interactions: [interaction, ...c.interactions] } : c
        ),
        auditLogs: appendAudit(
          prev.auditLogs,
          `ثبت لاگ تعامل (${interaction.topic})`,
          target?.fullName ?? customerId
        ),
      };
    });
  };

  const handleAddTag = (customerId: string, tag: string) => {
    setState((prev) => ({
      ...prev,
      customers: prev.customers.map((c) =>
        c.id === customerId && !c.tags.includes(tag) ? { ...c, tags: [...c.tags, tag] } : c
      ),
    }));
  };

  const handleCompleteFollowUp = (taskId: string, npsScore: number, note: string) => {
    setState((prev) => {
      const targetTask = prev.followUps.find((t) => t.id === taskId);
      if (!targetTask) return prev;

      const isDetractor = npsScore <= 6;
      const nextFollowUps = prev.followUps.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: isDetractor ? ('escalated' as const) : ('completed' as const),
              npsRecorded: npsScore,
              outcomeNote: note,
            }
          : t
      );

      const nextCustomers = prev.customers.map((c) =>
        c.id === targetTask.customerId
          ? {
              ...c,
              npsLatest: npsScore,
              npsLabel:
                npsScore >= 9
                  ? ('Promoter' as const)
                  : npsScore >= 7
                    ? ('Passive' as const)
                    : ('Detractor' as const),
            }
          : c
      );

      let nextTickets = prev.tickets;
      if (isDetractor) {
        const tier = getTierSpec(targetTask.tierCode);
        nextTickets = [
          {
            id: `tkt-${Date.now()}`,
            ticketCode: `TKT-${Math.floor(9100 + Math.random() * 899)}`,
            customerId: targetTask.customerId,
            customerName: targetTask.customerName,
            tierCode: targetTask.tierCode,
            channel: 'تلفن',
            category: 'کیفیت محصول',
            subject: `ارجاع خودکار پیگیری ۲۴س (NPS=${npsScore}): ${note}`,
            firstReplySlaHours: Math.min(2, tier.firstReplySlaHours),
            resolutionSlaHours: tier.resolutionSlaHours,
            elapsedHours: 0,
            status: 'open',
            assignee: 'تیم رسیدگی فوری (SLA زیر ۲ ساعت)',
            createdAt: 'هم‌اکنون',
          },
          ...prev.tickets,
        ];
      }

      return {
        ...prev,
        followUps: nextFollowUps,
        customers: nextCustomers,
        tickets: nextTickets,
        auditLogs: appendAudit(
          prev.auditLogs,
          isDetractor ? `ارجاع خودکار NPS پایین (${npsScore})` : `تکمیل پیگیری (NPS=${npsScore})`,
          targetTask.customerName
        ),
      };
    });
  };

  const handleCreateRma = (input: {
    customerId: string;
    orderId: string;
    productTitle: string;
    reason: RmaRequest['reason'];
    refundAmountToman: number;
    refundTarget: RmaRequest['refundTarget'];
  }) => {
    setState((prev) => {
      const cust = prev.customers.find((c) => c.id === input.customerId);
      if (!cust) return prev;
      const newRma: RmaRequest = {
        id: `rma-${Date.now()}`,
        rmaCode: `RMA-${Math.floor(405000 + Math.random() * 8999)}`,
        customerId: cust.id,
        customerName: cust.fullName,
        tierCode: cust.tierCode,
        orderId: input.orderId,
        productTitle: input.productTitle,
        reason: input.reason,
        refundAmountToman: input.refundAmountToman,
        refundTarget: input.refundTarget,
        status: 'pending_review',
        createdAt: 'هم‌اکنون',
      };
      return {
        ...prev,
        rmas: [newRma, ...prev.rmas],
        auditLogs: appendAudit(prev.auditLogs, `ثبت درخواست مرجوع (${newRma.rmaCode})`, cust.fullName),
      };
    });
  };

  const handleAdvanceRma = (rmaId: string) => {
    setState((prev) => {
      const rma = prev.rmas.find((r) => r.id === rmaId);
      if (!rma) return prev;

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

      return {
        ...prev,
        rmas: prev.rmas.map((r) => (r.id === rmaId ? { ...r, status: nextStatus } : r)),
        customers: nextCustomers,
        auditLogs: appendAudit(
          prev.auditLogs,
          nextStatus === 'refunded' ? `بازگشت وجه مرجوعی (${rma.rmaCode})` : `تایید کد مرجوعی (${rma.rmaCode})`,
          rma.customerName
        ),
      };
    });
  };

  const handleAwardPoints = (customerId: string, actionFa: string, points: number) => {
    setState((prev) => {
      const cust = prev.customers.find((c) => c.id === customerId);
      if (!cust) return prev;

      return {
        ...prev,
        customers: prev.customers.map((c) =>
          c.id === customerId ? { ...c, pointsBalance: c.pointsBalance + points } : c
        ),
        transactions: [
          {
            id: `ltx-${Date.now()}`,
            customerId,
            customerName: cust.fullName,
            type: 'earn',
            actionFa,
            pointsDelta: points,
            createdAt: 'هم‌اکنون',
          },
          ...prev.transactions,
        ],
        auditLogs: appendAudit(prev.auditLogs, `اعطای ${points} امتیاز (${actionFa})`, cust.fullName),
      };
    });
  };

  const handleRedeemReward = (
    customerId: string,
    rewardFa: string,
    pointsRequired: number,
    walletCreditToman?: number
  ) => {
    setState((prev) => {
      const cust = prev.customers.find((c) => c.id === customerId);
      if (!cust || cust.pointsBalance < pointsRequired) return prev;

      return {
        ...prev,
        customers: prev.customers.map((c) =>
          c.id === customerId
            ? {
                ...c,
                pointsBalance: c.pointsBalance - pointsRequired,
                walletBalanceToman: c.walletBalanceToman + (walletCreditToman ?? 0),
              }
            : c
        ),
        transactions: [
          {
            id: `ltx-${Date.now()}`,
            customerId,
            customerName: cust.fullName,
            type: 'redeem',
            actionFa: rewardFa,
            pointsDelta: -pointsRequired,
            createdAt: 'هم‌اکنون',
          },
          ...prev.transactions,
        ],
        auditLogs: appendAudit(
          prev.auditLogs,
          `خرج ${pointsRequired} امتیاز بابت ${rewardFa}`,
          cust.fullName
        ),
      };
    });
  };

  const handleIssueGiftCard = (input: {
    occasion: GiftCardRecord['occasion'];
    amountToman: number;
    recipientPhone: string;
    deliveryChannel: GiftCardRecord['deliveryChannel'];
  }) => {
    setState((prev) => {
      const card: GiftCardRecord = {
        id: `gc-${Date.now()}`,
        code: `RASP-GIFT-${Math.floor(1000 + Math.random() * 8999)}`,
        occasion: input.occasion,
        amountToman: input.amountToman,
        recipientPhone: input.recipientPhone,
        deliveryChannel: input.deliveryChannel,
        status: 'active',
        expiresAt: '۱۴۰۵/۰۸/۲۶',
      };
      return {
        ...prev,
        giftCards: [card, ...prev.giftCards],
        auditLogs: appendAudit(
          prev.auditLogs,
          `صدور کارت هدیه ${card.amountToman.toLocaleString('fa-IR')} ت`,
          card.code
        ),
      };
    });
  };

  const handleCreateTicket = (input: {
    customerId: string;
    channel: SupportTicket['channel'];
    category: SupportTicket['category'];
    subject: string;
  }) => {
    setState((prev) => {
      const cust = prev.customers.find((c) => c.id === input.customerId);
      if (!cust) return prev;
      const tier = getTierSpec(cust.tierCode);
      const tkt: SupportTicket = {
        id: `tkt-${Date.now()}`,
        ticketCode: `TKT-${Math.floor(9100 + Math.random() * 899)}`,
        customerId: cust.id,
        customerName: cust.fullName,
        tierCode: cust.tierCode,
        channel: input.channel,
        category: input.category,
        subject: input.subject,
        firstReplySlaHours: tier.firstReplySlaHours,
        resolutionSlaHours: tier.resolutionSlaHours,
        elapsedHours: 0,
        status: 'open',
        assignee: cust.tierCode === 'vip_black' ? 'مدیر اختصاصی VIP' : 'پشتیبانی متمرکز',
        createdAt: 'هم‌اکنون',
      };
      return {
        ...prev,
        tickets: [tkt, ...prev.tickets],
        auditLogs: appendAudit(prev.auditLogs, `ثبت تیکت (${tkt.ticketCode})`, cust.fullName),
      };
    });
  };

  const handleAdvanceTicket = (ticketId: string) => {
    setState((prev) => ({
      ...prev,
      tickets: prev.tickets.map((t) => {
        if (t.id !== ticketId) return t;
        const nextStatus: SupportTicket['status'] =
          t.status === 'open' ? 'in_progress' : 'resolved';
        return { ...t, status: nextStatus };
      }),
    }));
  };

  const handleToggleCampaign = (campaignId: string) => {
    setState((prev) => ({
      ...prev,
      campaigns: prev.campaigns.map((c) =>
        c.id === campaignId ? { ...c, isActive: !c.isActive } : c
      ),
    }));
  };

  const handleCreateCampaign = (input: {
    title: string;
    channel: CampaignItem['channel'];
    targetSegment: string;
    templateWithTokens: string;
  }) => {
    setState((prev) => {
      const created: CampaignItem = {
        id: `cmp-${Date.now()}`,
        title: input.title,
        type: 'broadcast',
        channel: input.channel,
        targetSegment: input.targetSegment,
        templateWithTokens: input.templateWithTokens,
        isActive: true,
        sentCount: 0,
        openOrReadRatePct: 0,
        conversionRatePct: 0,
        revenueToman: 0,
      };
      return {
        ...prev,
        campaigns: [created, ...prev.campaigns],
        auditLogs: appendAudit(prev.auditLogs, 'ساخت کمپین جدید', created.title),
      };
    });
  };

  const handleSimulateWebhookOrder = (payload: WebhookOrderInput) => {
    const res = applyWebhookOrderToCustomers(state.customers, payload);
    const tierUpgraded = res.tierUpgradedFrom
      ? getTierSpec(res.targetCustomer.tierCode).nameFa
      : null;

    setState((prev) => ({
      ...prev,
      customers: res.updatedCustomers,
      followUps: [res.newFollowUpTask, ...prev.followUps],
      transactions: [
        {
          id: `ltx-${Date.now()}`,
          customerId: res.targetCustomer.id,
          customerName: res.targetCustomer.fullName,
          type: 'earn',
          actionFa: `سفارش وب‌هوک ${payload.externalOrderId} (${payload.sourceSite})`,
          pointsDelta: res.pointsEarned,
          createdAt: 'هم‌اکنون',
        },
        ...prev.transactions,
      ],
      auditLogs: appendAudit(
        prev.auditLogs,
        `همگام‌سازی سفارش ${payload.externalOrderId} (+${res.pointsEarned} امتیاز)`,
        res.targetCustomer.fullName
      ),
    }));

    return {
      customerId: res.targetCustomer.id,
      customerName: res.targetCustomer.fullName,
      pointsEarned: res.pointsEarned,
      tierUpgraded,
    };
  };

  const handleResetDemoData = () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
    setState({
      customers: INITIAL_CUSTOMERS,
      transactions: INITIAL_LOYALTY_TRANSACTIONS,
      followUps: INITIAL_FOLLOWUP_TASKS,
      rmas: INITIAL_RMAS,
      tickets: INITIAL_TICKETS,
      campaigns: INITIAL_CAMPAIGNS,
      familyGroups: INITIAL_FAMILY_GROUPS,
      giftCards: INITIAL_GIFT_CARDS,
      auditLogs: INITIAL_AUDIT_LOGS,
    });
    setSelectedCustomerId(INITIAL_CUSTOMERS[0]?.id ?? null);
  };

  const openTicketsCount = state.tickets.filter((t) => t.status !== 'resolved').length;
  const pendingFollowupsCount = state.followUps.filter((f) => f.status === 'pending').length;

  return (
    <AppShell
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      activeRole={activeRole}
      onChangeRole={(role) => {
        setActiveRole(role);
        setState((prev) => ({
          ...prev,
          auditLogs: appendAudit(prev.auditLogs, 'تغییر سطح دسترسی فعال', role, role),
        }));
      }}
      onQuickSimulateOrder={() => setActiveTab('integrations')}
      onResetDemoData={handleResetDemoData}
      openTicketsCount={openTicketsCount}
      pendingFollowupsCount={pendingFollowupsCount}
    >
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
        />
      )}
    </AppShell>
  );
}

export default App;
