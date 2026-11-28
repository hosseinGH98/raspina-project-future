import { useState } from 'react';
import { AlertTriangle, Eye, EyeOff, Lock, LogIn, ShieldCheck } from 'lucide-react';
import { api, ApiError, type SessionUser } from '../utils/apiClient';

interface AuthGateProps {
  initialError?: string;
  allowDemo?: boolean;
  demoReason?: string;
  onAuthenticated: (user: SessionUser) => void;
  onContinueDemo?: () => void;
}

export function AuthGate({
  initialError,
  allowDemo,
  demoReason,
  onAuthenticated,
  onContinueDemo,
}: AuthGateProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(initialError ?? '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername || !password) {
      setError('نام کاربری و گذرواژه را وارد کنید.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const user = await api.login(cleanUsername, password);
      onAuthenticated(user);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.status === 429
            ? 'تلاش‌های ناموفق بیش از حد مجاز است. چند دقیقه بعد دوباره تلاش کنید.'
            : err.message
        );
      } else {
        setError('ورود ناموفق بود. دوباره تلاش کنید.');
      }
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f6f2] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#14192b] text-lg font-black text-[#e2c275]">
            R
          </span>
          <h1 className="mt-3 text-lg font-extrabold text-[#14192b]">
            ورود به پنل عملیاتی راسپینا
          </h1>
          <p className="mt-1 text-xs text-[#52586c]">
            CRM ۳۶۰ درجه، باشگاه مشتریان و پیگیری پس از خرید
          </p>
        </div>

        <div className="rounded-2xl border border-[#e5dfd3] bg-white p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4 text-xs" noValidate>
            <div>
              <label htmlFor="login-username" className="mb-1 block font-bold text-[#14192b]">
                نام کاربری
              </label>
              <input
                id="login-username"
                name="username"
                type="text"
                autoComplete="username"
                dir="ltr"
                required
                maxLength={60}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="font-mono-code w-full rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-3 py-2 text-left focus:border-[#c9a84c] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="mb-1 block font-bold text-[#14192b]">
                گذرواژه
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  dir="ltr"
                  required
                  maxLength={200}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="font-mono-code w-full rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-3 py-2 pl-10 text-left focus:border-[#c9a84c] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'پنهان کردن گذرواژه' : 'نمایش گذرواژه'}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded p-1 text-[#52586c] hover:bg-black/5"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-[#fca5a5] bg-[#fef2f2] px-3 py-2 font-semibold text-[#991b1b]"
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="leading-6">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#14192b] px-4 py-2.5 font-bold text-white transition-colors hover:bg-[#1e2540] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogIn className="h-4 w-4 text-[#e2c275]" aria-hidden="true" />
              <span>{submitting ? 'در حال بررسی…' : 'ورود امن به پنل'}</span>
            </button>
          </form>

          <div className="mt-4 flex items-start gap-2 border-t border-[#e5dfd3] pt-3 text-[11px] text-[#52586c]">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#9a7622]" aria-hidden="true" />
            <p className="leading-6">
              ارتباط با کوکی نشست HttpOnly و توکن CSRF محافظت می‌شود. پس از پنج تلاش ناموفق،
              حساب موقتاً قفل می‌شود.
            </p>
          </div>
        </div>

        {allowDemo && onContinueDemo && (
          <div className="mt-4 rounded-xl border border-[#e2c275] bg-[#fdfaf3] p-4 text-center text-xs">
            <p className="leading-6 text-[#6b551c]">
              API روی این هاست نصب نشده است. {demoReason ?? 'می‌توانید پنل را با داده نمونه ببینید.'}
            </p>
            <button
              type="button"
              onClick={onContinueDemo}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[#c9a84c] px-3 py-1.5 font-bold text-[#6b551c] hover:bg-[#c9a84c]/10"
            >
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>ادامه در حالت نمایشی</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
