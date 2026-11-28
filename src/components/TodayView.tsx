import {
  ArrowLeft,
  CheckCircle2,
  Crown,
  Headphones,
  PhoneCall,
  RotateCcw,
  Search,
  ShoppingBag,
} from 'lucide-react';
import type { TodayTarget, TodayTask, TodayTaskId } from '../utils/todayTasks';

const TASK_ICONS: Record<TodayTaskId, typeof PhoneCall> = {
  overdue_followups: PhoneCall,
  sla_at_risk: Headphones,
  orders_today: ShoppingBag,
  rma_pending: RotateCcw,
  tier_upgrade: Crown,
};

interface TodayViewProps {
  tasks: TodayTask[];
  onOpenTask: (target: TodayTarget) => void;
  onOpenSearch: () => void;
  onGoToDashboard: () => void;
}

export function TodayView({ tasks, onOpenTask, onOpenSearch, onGoToDashboard }: TodayViewProps) {
  const total = tasks.reduce((sum, task) => sum + task.count, 0);

  return (
    <section aria-labelledby="today-heading">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="today-heading" className="text-lg font-extrabold text-[#14192b]">
            کارهای امروز شما
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-6 text-[#52586c]">
            فقط کارهایی که به اقدام نیاز دارند، به ترتیب اهمیت. روی «رسیدگی» بزنید تا مستقیم به همان
            بخش بروید.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenSearch}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-[#e5dfd3] bg-white px-3 py-2 text-xs font-bold text-[#14192b] hover:bg-[#f7f6f2]"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          <span>جست‌وجوی سریع مشتری</span>
        </button>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-2xl border border-[#e5dfd3] bg-white p-8 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-[#16a34a]" aria-hidden="true" />
          <h3 className="mt-3 text-base font-extrabold text-[#14192b]">امروز کار سررسیده‌ای ندارید</h3>
          <p className="mx-auto mt-1 max-w-md text-xs leading-6 text-[#52586c]">
            همه‌ی پیگیری‌ها و تیکت‌های فوری رسیدگی شده‌اند. می‌توانید وضعیت کلی کسب‌وکار را ببینید یا
            مشتری جدید ثبت کنید.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={onGoToDashboard}
              className="rounded-lg bg-[#14192b] px-4 py-2 text-xs font-bold text-white hover:bg-[#1e2540]"
            >
              دیدن داشبورد KPI
            </button>
            <button
              type="button"
              onClick={onOpenSearch}
              className="rounded-lg border border-[#e5dfd3] px-4 py-2 text-xs font-bold text-[#14192b] hover:bg-[#f7f6f2]"
            >
              پیدا کردن مشتری
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="mb-3 text-[11px] font-semibold text-[#52586c]">
            {total.toLocaleString('fa-IR')} مورد در {tasks.length.toLocaleString('fa-IR')} دسته
          </p>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {tasks.map((task) => {
              const Icon = TASK_ICONS[task.id];
              const urgent = task.priority <= 2;
              return (
                <li
                  key={task.id}
                  className="flex flex-col justify-between rounded-2xl border border-[#e5dfd3] bg-white p-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <Icon className="h-4 w-4 shrink-0 text-[#9a7622]" aria-hidden="true" />
                        <h3 className="truncate text-sm font-extrabold text-[#14192b]">{task.label}</h3>
                      </span>
                      <span className="shrink-0 rounded-md bg-[#14192b] px-2 py-0.5 text-[11px] font-bold tabular-nums text-white">
                        {task.count.toLocaleString('fa-IR')} مورد
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-6 text-[#52586c]">{task.why}</p>
                    {urgent && (
                      <p className="mt-2 inline-flex rounded-md border border-[#fca5a5] bg-[#fef2f2] px-2 py-0.5 text-[10px] font-bold text-[#991b1b]">
                        اولویت فوری
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenTask(task.target)}
                    aria-label={`رسیدگی به ${task.label}`}
                    className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#14192b] px-3 py-2 text-xs font-bold text-white hover:bg-[#1e2540]"
                  >
                    <span>رسیدگی</span>
                    <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
