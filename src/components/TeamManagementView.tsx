import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { api, ApiError, type ManagedUser } from '../utils/apiClient';
import { ROLE_LABELS } from '../utils/permissions';
import type { RbacRole } from '../types/crm';

const ASSIGNABLE_ROLES: RbacRole[] = [
  'branch_manager',
  'marketing',
  'support',
  'sales',
  'analyst',
];

const EMPTY_FORM = {
  username: '',
  displayName: '',
  role: 'sales' as RbacRole,
  password: '',
};

function isStrongPassword(value: string): boolean {
  return value.length >= 12 && value.length <= 200 && /[A-Za-z]/.test(value) && /\d/.test(value);
}

export default function TeamManagementView({ currentUsername }: { currentUsername: string }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [resetTarget, setResetTarget] = useState('');
  const [resetPassword, setResetPassword] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await api.listUsers());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'دریافت فهرست کاربران انجام نشد.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const username = form.username.trim().toLowerCase();
    if (!/^[a-z0-9._-]{4,60}$/.test(username)) {
      setError('نام کاربری باید ۴ تا ۶۰ نویسه لاتین (حروف کوچک، رقم، نقطه، خط تیره) باشد.');
      return;
    }
    if (form.displayName.trim().length < 3) {
      setError('نام نمایشی باید حداقل ۳ نویسه باشد.');
      return;
    }
    if (!isStrongPassword(form.password)) {
      setError('گذرواژه باید حداقل ۱۲ نویسه و شامل حرف و رقم باشد.');
      return;
    }

    setBusy(true);
    try {
      await api.createUser({
        username,
        displayName: form.displayName.trim(),
        role: form.role,
        password: form.password,
      });
      setForm(EMPTY_FORM);
      setShowPassword(false);
      setNotice('حساب کاربری جدید ساخته شد.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ساخت حساب کاربری انجام نشد.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async (user: ManagedUser) => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await api.setUserActive(user.id, !user.isActive);
      setNotice(user.isActive ? 'حساب کاربری غیرفعال شد.' : 'حساب کاربری فعال شد.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تغییر وضعیت کاربر انجام نشد.');
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!resetTarget) {
      setError('برای بازنشانی گذرواژه، یک کاربر را انتخاب کنید.');
      return;
    }
    if (!isStrongPassword(resetPassword)) {
      setError('گذرواژه جدید باید حداقل ۱۲ نویسه و شامل حرف و رقم باشد.');
      return;
    }

    setBusy(true);
    try {
      await api.resetUserPassword(resetTarget, resetPassword);
      setResetPassword('');
      setResetTarget('');
      setNotice('گذرواژه کاربر بازنشانی شد.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'بازنشانی گذرواژه انجام نشد.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Users size={16} /> مدیریت تیم و دسترسی‌ها
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              فقط مدیرعامل می‌تواند حساب بسازد، غیرفعال کند یا گذرواژه را بازنشانی کند. هر تغییر در گزارش حسابرسی ثبت می‌شود.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || busy}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> به‌روزرسانی
          </button>
        </div>

        <div aria-live="polite" className="mt-3 space-y-2">
          {error && (
            <p className="flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              <AlertCircle size={14} /> {error}
            </p>
          )}
          {notice && (
            <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
              <CheckCircle2 size={14} /> {notice}
            </p>
          )}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-right text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] text-slate-500">
                <th className="py-2 font-bold">کاربر</th>
                <th className="py-2 font-bold">نقش</th>
                <th className="py-2 font-bold">آخرین ورود</th>
                <th className="py-2 font-bold">وضعیت</th>
                <th className="py-2 font-bold">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-400">
                    در حال دریافت…
                  </td>
                </tr>
              )}
              {!loading && users.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-400">
                    کاربری ثبت نشده است.
                  </td>
                </tr>
              )}
              {users.map((user) => (
                <tr key={user.id} className="border-b border-slate-100">
                  <td className="py-2.5">
                    <p className="font-bold text-slate-800">{user.displayName}</p>
                    <p dir="ltr" className="font-mono text-[11px] text-slate-400">
                      {user.username}
                    </p>
                  </td>
                  <td className="py-2.5 text-slate-600">{ROLE_LABELS[user.role]?.label ?? user.role}</td>
                  <td className="py-2.5 text-slate-500">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('fa-IR') : '—'}
                  </td>
                  <td className="py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        user.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {user.isActive ? 'فعال' : 'غیرفعال'}
                    </span>
                  </td>
                  <td className="py-2.5">
                    <button
                      type="button"
                      disabled={busy || user.username === currentUsername}
                      onClick={() => void handleToggle(user)}
                      title={user.username === currentUsername ? 'حساب خودتان قابل غیرفعال‌سازی نیست' : undefined}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {user.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <form onSubmit={handleCreate} className="rounded-2xl border border-slate-200 bg-white p-5">
          <h4 className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <UserPlus size={15} /> ساخت حساب کاربری
          </h4>
          <div className="mt-3 space-y-3">
            <label className="block text-xs font-bold text-slate-600">
              نام نمایشی
              <input
                value={form.displayName}
                onChange={(e) => setForm((prev) => ({ ...prev, displayName: e.target.value }))}
                maxLength={120}
                required
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </label>
            <label className="block text-xs font-bold text-slate-600">
              نام کاربری (لاتین)
              <input
                value={form.username}
                onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                maxLength={60}
                dir="ltr"
                required
                autoComplete="off"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </label>
            <label className="block text-xs font-bold text-slate-600">
              نقش سازمانی
              <select
                value={form.role}
                onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value as RbacRole }))}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              >
                {ASSIGNABLE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role].label} — {ROLE_LABELS[role].scope}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-bold text-slate-600">
              گذرواژه موقت
              <div className="relative mt-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  required
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 pl-10 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'مخفی کردن گذرواژه' : 'نمایش گذرواژه'}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <span className="mt-1 block text-[11px] font-normal text-slate-400">حداقل ۱۲ نویسه، شامل حرف و رقم.</span>
            </label>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <ShieldCheck size={15} /> ساخت حساب
            </button>
          </div>
        </form>

        <form onSubmit={handleReset} className="rounded-2xl border border-slate-200 bg-white p-5">
          <h4 className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <KeyRound size={15} /> بازنشانی گذرواژه
          </h4>
          <div className="mt-3 space-y-3">
            <label className="block text-xs font-bold text-slate-600">
              کاربر
              <select
                value={resetTarget}
                onChange={(e) => setResetTarget(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">— انتخاب کاربر —</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.displayName} ({user.username})
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-bold text-slate-600">
              گذرواژه جدید
              <input
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                autoComplete="new-password"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </label>
            <p className="text-[11px] leading-5 text-slate-400">
              پس از بازنشانی، تلاش‌های ناموفق و قفل حساب کاربر پاک می‌شود. گذرواژه را از طریق کانال امن به کاربر اعلام کنید.
            </p>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <KeyRound size={15} /> بازنشانی گذرواژه
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
