import { useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Cloud,
  CloudOff,
  Crown,
  Headphones,
  Layers,
  Loader2,
  Lock,
  LogOut,
  Menu,
  PhoneCall,
  RotateCcw,
  Search,
  ShieldCheck,
  Users,
  Webhook,
  X,
} from 'lucide-react';
import { ROLE_LABELS, type Permission } from '../utils/permissions';
import type { RbacRole } from '../types/crm';
import type { SessionUser } from '../utils/apiClient';

export type WorkspaceTabId =
  | 'today'
  | 'dashboard'
  | 'customers'
  | 'segments'
  | 'followup'
  | 'loyalty'
  | 'support_campaigns'
  | 'integrations';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict' | 'demo';

export interface Notice {
  id: number;
  kind: 'success' | 'error' | 'info';
  text: string;
}

export const WORKSPACE_NAV: Array<{
  id: WorkspaceTabId;
  label: string;
  subtitle: string;
  icon: typeof BarChart3;
  permission: Permission;
}> = [
  {
    id: 'today',
    label: 'امروز — کارهای من',
    subtitle: 'کارهای فوری امروز، همه در یک صفحه',
    icon: CalendarDays,
    permission: 'dashboard:view',
  },
  {
    id: 'dashboard',
    label: 'داشبورد اجرایی و KPI',
    subtitle: 'نمای کلان، کوهورت، همدان vs تهران',
    icon: BarChart3,
    permission: 'dashboard:view',
  },
  {
    id: 'customers',
    label: 'مشتریان و پروفایل ۳۶۰',
    subtitle: 'CDP یکپارچه ۳ سایت + حضوری',
    icon: Users,
    permission: 'customers:view',
  },
  {
    id: 'segments',
    label: 'سگمنت‌ساز و سفر مشتری',
    subtitle: 'فیلتر پویا AND/OR + Attribution',
    icon: Layers,
    permission: 'segments:view',
  },
  {
    id: 'followup',
    label: 'پیگیری و مرجوعی (RMA)',
    subtitle: '۲۴س/۷ر/۳۰ر/۹۰ر + بازگشت وجه کیف‌پول',
    icon: PhoneCall,
    permission: 'followup:view',
  },
  {
    id: 'loyalty',
    label: 'باشگاه مشتریان و کیف پول',
    subtitle: '۴ سطح، امتیاز، چالش، خانواده، هدیه',
    icon: Crown,
    permission: 'loyalty:view',
  },
  {
    id: 'support_campaigns',
    label: 'پشتیبانی SLA و کمپین‌ها',
    subtitle: 'تیکتینگ هوشمند + تریگر پیامک/واتساپ',
    icon: Headphones,
    permission: 'support:view',
  },
  {
    id: 'integrations',
    label: 'یکپارچه‌سازی، ربات‌ها و هاست',
    subtitle: 'وب‌هوک ۳ سایت، ربات TG/IG، public_html',
    icon: Webhook,
    permission: 'integrations:view',
  },
];

const GUIDES: Record<WorkspaceTabId, { intro: string; steps: string[] }> = {
  today: {
    intro: 'اینجا فقط کارهایی است که امروز به اقدام نیاز دارند، به ترتیب اهمیت.',
    steps: [
      'کارت‌ها را از بالا به پایین انجام دهید؛ بالاترین کارت فوری‌تر است.',
      'برای پیدا کردن سریع مشتری، Ctrl+K (یا ⌘+K) را بزنید.',
      'هر کارت شما را مستقیم به همان بخش مربوط می‌برد.',
    ],
  },
  dashboard: {
    intro: 'نمای کلان کسب‌وکار: KPI، کوهورت و مقایسه شعبه‌ها.',
    steps: [
      'عددهای بالای صفحه را با هدف ماه مقایسه کنید.',
      'برای دیدن پرونده هر مشتری روی نام او بزنید.',
      'برای کارهای روزانه به تب «امروز» برگردید.',
    ],
  },
  customers: {
    intro: 'پرونده ۳۶۰ درجه هر مشتری: سفارش‌ها، امتیازها، تعامل‌ها و برچسب‌ها.',
    steps: [
      'مشتری را از فهرست یا با Ctrl+K انتخاب کنید.',
      'سفارش‌ها و موجودی کیف پول را بررسی کنید.',
      'تعامل یا برچسب جدید را همان‌جا ثبت کنید.',
    ],
  },
  segments: {
    intro: 'ساخت سگمنت پویا و سنجش نتیجه کمپین‌ها.',
    steps: [
      'فیلترها را ترکیب کنید تا سگمنت دقیق ساخته شود.',
      'حجم سگمنت را قبل از ارسال بررسی کنید.',
      'سگمنت را به کمپین بفرستید.',
    ],
  },
  followup: {
    intro: 'پیگیری‌های زمان‌بندی‌شده و درخواست‌های مرجوعی.',
    steps: [
      'وظیفه‌ها را به ترتیب سررسید انجام دهید.',
      'نتیجه تماس و امتیاز NPS را ثبت کنید.',
      'درخواست مرجوعی را از همین تب بررسی و تأیید کنید.',
    ],
  },
  loyalty: {
    intro: 'باشگاه مشتریان: امتیاز، سطح، کیف پول و کارت هدیه.',
    steps: [
      'موجودی امتیاز و کیف پول مشتری را ببینید.',
      'امتیاز یا کارت هدیه را با تأیید ثبت کنید.',
      'گروه خانوادگی را برای جمع امتیاز بررسی کنید.',
    ],
  },
  support_campaigns: {
    intro: 'تیکت‌های پشتیبانی با تعهد SLA و کمپین‌های پیامکی.',
    steps: [
      'تیکت‌های نزدیک به نقض SLA را اول پاسخ دهید.',
      'وضعیت تیکت را جلو ببرید تا بسته شود.',
      'کمپین را فقط برای سگمنت هدف فعال کنید.',
    ],
  },
  integrations: {
    intro: 'وضعیت وب‌هوک سه سایت، ربات‌ها، کاربران و گزارش حسابرسی.',
    steps: [
      'وضعیت وب‌هوک هر سایت را ببینید.',
      'یک سفارش آزمایشی شبیه‌سازی کنید تا مسیر داده را بسنجید.',
      'Audit Log را برای تغییرهای حساس بخوانید.',
    ],
  },
};

interface AppShellProps {
  activeTab: WorkspaceTabId;
  onSelectTab: (tab: WorkspaceTabId) => void;
  activeRole: RbacRole;
  onChangeRole: (role: RbacRole) => void;
  canSwitchRole: boolean;
  canAccess: (permission: Permission) => boolean;
  onQuickSimulateOrder: () => void;
  onResetDemoData: () => void;
  canResetDemoData: boolean;
  onLogout: () => void;
  user: SessionUser | null;
  mode: 'demo' | 'server';
  demoReason?: string;
  saveStatus: SaveStatus;
  notice: Notice | null;
  onDismissNotice: () => void;
  onOpenSearch: () => void;
  commandPalette?: ReactNode;
  openTicketsCount: number;
  pendingFollowupsCount: number;
  children: ReactNode;
}

const SAVE_STATUS_META: Record<SaveStatus, { label: string; className: string; icon: typeof Cloud }> = {
  idle: { label: 'آماده', className: 'text-[#52586c]', icon: Cloud },
  saving: { label: 'در حال ذخیره…', className: 'text-[#9a7622]', icon: Loader2 },
  saved: { label: 'ذخیره شد', className: 'text-[#16a34a]', icon: CheckCircle2 },
  error: { label: 'خطا در ذخیره', className: 'text-[#dc2626]', icon: AlertTriangle },
  conflict: { label: 'تعارض نسخه', className: 'text-[#dc2626]', icon: AlertTriangle },
  demo: { label: 'حالت نمایشی', className: 'text-[#9a7622]', icon: CloudOff },
};

export function AppShell({
  activeTab,
  onSelectTab,
  activeRole,
  onChangeRole,
  canSwitchRole,
  canAccess,
  onQuickSimulateOrder,
  onResetDemoData,
  canResetDemoData,
  onLogout,
  user,
  mode,
  demoReason,
  saveStatus,
  notice,
  onDismissNotice,
  onOpenSearch,
  commandPalette,
  openTicketsCount,
  pendingFollowupsCount,
  children,
}: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hiddenGuides, setHiddenGuides] = useState<WorkspaceTabId[]>([]);

  const currentTabMeta =
    WORKSPACE_NAV.find((item) => item.id === activeTab) ?? WORKSPACE_NAV[0];
  const currentRoleMeta = ROLE_LABELS[activeRole] ?? ROLE_LABELS.ceo;
  const guide = GUIDES[activeTab] ?? GUIDES.today;
  const guideVisible = !hiddenGuides.includes(activeTab);
  const statusMeta = SAVE_STATUS_META[saveStatus];
  const StatusIcon = statusMeta.icon;

  const handleNavClick = (id: WorkspaceTabId) => {
    onSelectTab(id);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-[#171a26] lg:flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:right-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-[#14192b] focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
      >
        پرش به محتوای اصلی
      </a>

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
            const allowed = canAccess(item.permission);
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
                onClick={() => allowed && handleNavClick(item.id)}
                disabled={!allowed}
                aria-current={active ? 'page' : undefined}
                title={allowed ? item.subtitle : 'این بخش برای نقش فعال شما مجاز نیست.'}
                className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-right transition-colors ${
                  active
                    ? 'bg-[#c9a84c] text-[#14192b]'
                    : allowed
                      ? 'text-white/80 hover:bg-white/10 hover:text-white'
                      : 'cursor-not-allowed text-white/35'
                }`}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate text-xs font-bold">{item.label}</span>
                </span>
                {allowed && countBadge !== null && countBadge > 0 ? (
                  <span
                    className={`tabular-nums rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                      active ? 'bg-[#14192b] text-white' : 'bg-white/15 text-[#e2c275]'
                    }`}
                  >
                    {countBadge.toLocaleString('fa-IR')}
                  </span>
                ) : !allowed ? (
                  <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4 text-[11px] text-white/75">
          <div className="flex items-center gap-2 text-[#e2c275]">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="font-semibold">{currentRoleMeta.label}</span>
          </div>
          <p className="mt-1 text-white/60">{currentRoleMeta.scope}</p>
          {user ? (
            <p className="mt-1 truncate text-white/50">حساب: {user.username}</p>
          ) : (
            <p className="mt-1 text-[#e2c275]/80">حالت نمایشی — بدون احراز هویت</p>
          )}

          <div className="mt-3 space-y-1.5">
            <button
              type="button"
              onClick={onResetDemoData}
              disabled={!canResetDemoData}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-[11px] font-medium text-white/80 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              <span>بازنشانی داده‌های نمونه</span>
            </button>
            {mode === 'server' && (
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-[11px] font-medium text-white/80 transition-colors hover:bg-white/10"
              >
                <LogOut className="h-3 w-3" aria-hidden="true" />
                <span>خروج از حساب</span>
              </button>
            )}
          </div>
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
                const allowed = canAccess(item.permission);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => allowed && handleNavClick(item.id)}
                    disabled={!allowed}
                    className={`flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2.5 text-right text-xs font-bold ${
                      active
                        ? 'bg-[#c9a84c] text-[#14192b]'
                        : allowed
                          ? 'text-white/80 hover:bg-white/10'
                          : 'cursor-not-allowed text-white/35'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {!allowed && <Lock className="h-3.5 w-3.5" aria-hidden="true" />}
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
                disabled={!canResetDemoData}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/20 px-3 py-2 text-xs text-white/85 disabled:opacity-40"
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
              <button
                type="button"
                onClick={onOpenSearch}
                aria-keyshortcuts="Control+K Meta+K"
                aria-label="جست‌وجوی سراسری (Ctrl+K)"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#e5dfd3] bg-white px-2.5 py-2 text-[11px] font-bold text-[#14192b] hover:bg-[#f7f6f2]"
              >
                <Search className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">جست‌وجو</span>
                <kbd className="hidden rounded border border-[#e5dfd3] bg-[#f7f6f2] px-1 text-[10px] font-semibold text-[#52586c] md:inline">
                  Ctrl K
                </kbd>
              </button>

              <button
                type="button"
                onClick={() =>
                  setHiddenGuides((prev) =>
                    prev.includes(activeTab)
                      ? prev.filter((tab) => tab !== activeTab)
                      : [...prev, activeTab]
                  )
                }
                aria-expanded={guideVisible}
                aria-controls="section-guide"
                className="rounded-lg border border-[#e5dfd3] bg-white px-2.5 py-2 text-[11px] font-bold text-[#14192b] hover:bg-[#f7f6f2]"
              >
                {guideVisible ? 'پنهان‌کردن راهنما' : 'راهنما'}
              </button>

              <span
                className={`inline-flex items-center gap-1.5 rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-2.5 py-1.5 text-[11px] font-bold ${statusMeta.className}`}
                role="status"
                aria-live="polite"
              >
                <StatusIcon
                  className={`h-3.5 w-3.5 ${saveStatus === 'saving' ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                {statusMeta.label}
              </span>

              {canSwitchRole ? (
                <label className="flex items-center gap-1.5 text-xs text-[#4b5063]">
                  <span className="hidden sm:inline">نقش کاربری:</span>
                  <select
                    aria-label="انتخاب نقش RBAC"
                    value={activeRole}
                    onChange={(e) => onChangeRole(e.target.value as RbacRole)}
                    className="rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-2.5 py-1.5 text-xs font-semibold text-[#14192b] focus:border-[#c9a84c] focus:outline-none"
                  >
                    {(Object.keys(ROLE_LABELS) as RbacRole[]).map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role].label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <span className="rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-2.5 py-1.5 text-[11px] font-bold text-[#4b5063]">
                  {currentRoleMeta.label}
                </span>
              )}

              {canAccess('integrations:simulate') && (
                <button
                  type="button"
                  onClick={onQuickSimulateOrder}
                  className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#14192b] px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-[#1e2540]"
                >
                  <Webhook className="h-3.5 w-3.5 text-[#e2c275]" aria-hidden="true" />
                  <span>شبیه‌ساز سفارش ۳ سایت</span>
                </button>
              )}

              {mode === 'server' && user && (
                <button
                  type="button"
                  onClick={onLogout}
                  aria-label="خروج از حساب"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#e5dfd3] text-[#4b5063] hover:bg-[#f7f6f2]"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Viewport */}
        <main id="main-content" className="mx-auto w-full min-w-0 max-w-[1360px] flex-1 p-4 md:p-6">
          {guideVisible && (
            <section
              id="section-guide"
              aria-labelledby="section-guide-title"
              className="mb-4 rounded-xl border border-[#e5dfd3] bg-white px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 id="section-guide-title" className="text-xs font-extrabold text-[#14192b]">
                    این‌جا چه کاری انجام می‌شود؟
                  </h2>
                  <p className="mt-0.5 text-[11px] leading-6 text-[#52586c]">{guide.intro}</p>
                  <ol className="mt-2 list-decimal space-y-0.5 pr-4 text-[11px] leading-6 text-[#4b5063]">
                    {guide.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </div>
                <button
                  type="button"
                  onClick={() => setHiddenGuides((prev) => [...prev, activeTab])}
                  aria-label="بستن راهنمای این بخش"
                  className="shrink-0 rounded p-1 text-[#52586c] hover:bg-[#f7f6f2]"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </section>
          )}

          {mode === 'demo' && (
            <div className="mb-4 flex flex-wrap items-start gap-2 rounded-xl border border-[#e2c275] bg-[#fdfaf3] px-4 py-3 text-xs text-[#6b551c]">
              <CloudOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p className="min-w-0 flex-1 leading-6">
                <strong>حالت نمایشی:</strong> داده‌ها فقط در همین مرورگر ذخیره می‌شوند و احراز هویت
                فعال نیست. {demoReason ?? 'برای عملیات واقعی، API و دیتابیس را طبق راهنمای استقرار فعال کنید.'}
              </p>
            </div>
          )}

          {saveStatus === 'conflict' && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-[#fca5a5] bg-[#fef2f2] px-4 py-3 text-xs text-[#991b1b]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p className="leading-6">
                نسخه داده روی سرور توسط کاربر دیگری تغییر کرده است. برای جلوگیری از بازنویسی،
                ذخیره‌سازی خودکار متوقف شد؛ صفحه را دوباره بارگذاری کنید.
              </p>
            </div>
          )}

          {notice && (
            <div
              role={notice.kind === 'error' ? 'alert' : 'status'}
              aria-live={notice.kind === 'error' ? 'assertive' : 'polite'}
              className={`mb-4 flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-semibold ${
                notice.kind === 'error'
                  ? 'border-[#fca5a5] bg-[#fef2f2] text-[#991b1b]'
                  : notice.kind === 'success'
                    ? 'border-[#86efac] bg-[#f0fdf4] text-[#166534]'
                    : 'border-[#e5dfd3] bg-white text-[#14192b]'
              }`}
            >
              <span className="leading-6">{notice.text}</span>
              <button
                type="button"
                onClick={onDismissNotice}
                aria-label="بستن پیام"
                className="shrink-0 rounded p-0.5 hover:bg-black/5"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}

          {children}
        </main>
      </div>

      {commandPalette}
    </div>
  );
}
