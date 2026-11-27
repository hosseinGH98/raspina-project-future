import { useState, type ReactNode } from 'react';
import {
  BarChart3,
  Crown,
  Headphones,
  Layers,
  Menu,
  PhoneCall,
  RotateCcw,
  ShieldCheck,
  Users,
  Webhook,
  X,
} from 'lucide-react';
import type { RbacRole } from '../types/crm';

export type WorkspaceTabId =
  | 'dashboard'
  | 'customers'
  | 'segments'
  | 'followup'
  | 'loyalty'
  | 'support_campaigns'
  | 'integrations';

export const WORKSPACE_NAV: Array<{
  id: WorkspaceTabId;
  label: string;
  subtitle: string;
  icon: typeof BarChart3;
}> = [
  {
    id: 'dashboard',
    label: 'داشبورد اجرایی و KPI',
    subtitle: 'نمای کلان، کوهورت، همدان vs تهران',
    icon: BarChart3,
  },
  {
    id: 'customers',
    label: 'مشتریان و پروفایل ۳۶۰',
    subtitle: 'CDP یکپارچه ۳ سایت + حضوری',
    icon: Users,
  },
  {
    id: 'segments',
    label: 'سگمنت‌ساز و سفر مشتری',
    subtitle: 'فیلتر پویا AND/OR + Attribution',
    icon: Layers,
  },
  {
    id: 'followup',
    label: 'پیگیری و مرجوعی (RMA)',
    subtitle: '۲۴س/۷ر/۳۰ر/۹۰ر + بازگشت وجه کیف‌پول',
    icon: PhoneCall,
  },
  {
    id: 'loyalty',
    label: 'باشگاه مشتریان و کیف پول',
    subtitle: '۴ سطح، امتیاز، چالش، خانواده، هدیه',
    icon: Crown,
  },
  {
    id: 'support_campaigns',
    label: 'پشتیبانی SLA و کمپین‌ها',
    subtitle: 'تیکتینگ هوشمند + تریگر پیامک/واتساپ',
    icon: Headphones,
  },
  {
    id: 'integrations',
    label: 'یکپارچه‌سازی، ربات‌ها و هاست',
    subtitle: 'وب‌هوک ۳ سایت، ربات TG/IG، public_html',
    icon: Webhook,
  },
];

const RBAC_ROLES: Array<{ id: RbacRole; label: string; scope: string }> = [
  { id: 'ceo', label: 'مدیرعامل (CEO)', scope: 'دسترسی کامل ۱۶ ماژول' },
  { id: 'branch_manager', label: 'مدیر شعبه همدان/تهران', scope: 'مشتریان، POS و مرجوعی' },
  { id: 'marketing', label: 'تیم مارکتینگ', scope: 'سگمنت، باشگاه و کمپین‌ها' },
  { id: 'support', label: 'کارشناس پشتیبانی', scope: 'تیکتینگ SLA، پیگیری و RMA' },
  { id: 'sales', label: 'فروش و استایلیست', scope: 'پروفایل ۳۶۰ و مشاوره VIP' },
  { id: 'analyst', label: 'آنالیست داده', scope: 'کوهورت، RFM و KPIها' },
];

interface AppShellProps {
  activeTab: WorkspaceTabId;
  onSelectTab: (tab: WorkspaceTabId) => void;
  activeRole: RbacRole;
  onChangeRole: (role: RbacRole) => void;
  onQuickSimulateOrder: () => void;
  onResetDemoData: () => void;
  openTicketsCount: number;
  pendingFollowupsCount: number;
  children: ReactNode;
}

export function AppShell({
  activeTab,
  onSelectTab,
  activeRole,
  onChangeRole,
  onQuickSimulateOrder,
  onResetDemoData,
  openTicketsCount,
  pendingFollowupsCount,
  children,
}: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currentTabMeta =
    WORKSPACE_NAV.find((item) => item.id === activeTab) ?? WORKSPACE_NAV[0];
  const currentRoleMeta = RBAC_ROLES.find((r) => r.id === activeRole) ?? RBAC_ROLES[0];

  const handleNavClick = (id: WorkspaceTabId) => {
    onSelectTab(id);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-[#171a26] lg:flex">
      {/* Desktop Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[264px] shrink-0 flex-col overflow-y-auto border-l border-[#222944] bg-[#14192b] text-white lg:flex">
        <div className="border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#c9a84c] text-sm font-black text-[#14192b]">
              R
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold text-white">راسپینا CRM و باشگاه</p>
              <p className="truncate text-[11px] text-[#e2c275]">پنل عملیاتی ۱۶ ماژوله</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3" aria-label="منوی اصلی CRM راسپینا">
          {WORKSPACE_NAV.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            const countBadge =
              item.id === 'followup'
                ? pendingFollowupsCount
                : item.id === 'support_campaigns'
                  ? openTicketsCount
                  : null;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-right transition-colors ${
                  active
                    ? 'bg-[#c9a84c] text-[#14192b]'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate text-xs font-bold">{item.label}</span>
                </span>
                {countBadge !== null && countBadge > 0 && (
                  <span
                    className={`tabular-nums rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                      active ? 'bg-[#14192b] text-white' : 'bg-white/15 text-[#e2c275]'
                    }`}
                  >
                    {countBadge.toLocaleString('fa-IR')}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4 text-[11px] text-white/75">
          <div className="flex items-center gap-2 text-[#e2c275]">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="font-semibold">کنترل دسترسی RBAC</span>
          </div>
          <p className="mt-1 text-white/60">{currentRoleMeta.scope}</p>
          <button
            type="button"
            onClick={onResetDemoData}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-[11px] font-medium text-white/80 transition-colors hover:bg-white/10"
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            <span>بازنشانی داده‌های نمونه</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="fixed inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col bg-[#14192b] text-white shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#c9a84c] text-xs font-black text-[#14192b]">
                  R
                </span>
                <span className="text-sm font-extrabold">راسپینا CRM</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="بستن منو"
                className="rounded-lg p-1.5 text-white/80 hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="منوی موبایل">
              {WORKSPACE_NAV.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item.id)}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-right text-xs font-bold ${
                      active
                        ? 'bg-[#c9a84c] text-[#14192b]'
                        : 'text-white/80 hover:bg-white/10'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="border-t border-white/10 p-3">
              <button
                type="button"
                onClick={() => {
                  onResetDemoData();
                  setMobileMenuOpen(false);
                }}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/20 px-3 py-2 text-xs text-white/85"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>بازنشانی داده‌های نمونه</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 border-b border-[#e5dfd3] bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="باز کردن منوی ناوبری"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#e5dfd3] text-[#14192b] lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <h1 className="truncate text-sm font-extrabold text-[#14192b] md:text-base">
                  {currentTabMeta.label}
                </h1>
                <p className="truncate text-[11px] text-[#52586c]">{currentTabMeta.subtitle}</p>
              </div>
            </div>

            <div className="flex max-w-full flex-wrap items-center gap-2.5">
              <label className="flex items-center gap-1.5 text-xs text-[#4b5063]">
                <span className="hidden sm:inline">نقش کاربری:</span>
                <select
                  aria-label="انتخاب نقش RBAC"
                  value={activeRole}
                  onChange={(e) => onChangeRole(e.target.value as RbacRole)}
                  className="rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-2.5 py-1.5 text-xs font-semibold text-[#14192b] focus:border-[#c9a84c] focus:outline-none"
                >
                  {RBAC_ROLES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={onQuickSimulateOrder}
                className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#14192b] px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-[#1e2540]"
              >
                <Webhook className="h-3.5 w-3.5 text-[#e2c275]" aria-hidden="true" />
                <span>شبیه‌ساز سفارش ۳ سایت</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Viewport */}
        <main className="mx-auto w-full min-w-0 max-w-[1360px] flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
