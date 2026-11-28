import { isValidIranMobile, normalizeIranPhone } from './crmEngine';

export const INPUT_LIMITS = {
  fullName: 120,
  tag: 40,
  topic: 120,
  note: 500,
  subject: 200,
  campaignTitle: 120,
  campaignTemplate: 1000,
  productTitle: 200,
  address: 300,
  username: 60,
  password: 200,
} as const;

/** Trims, collapses whitespace and strips control characters before persistence or rendering. */
export function sanitizeText(value: unknown, maxLength: number): string {
  return String(value ?? '')
    .replace(/[\u0000-\u001F\u007F\u200B-\u200D\uFEFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function validateFullName(value: unknown): string | null {
  const name = sanitizeText(value, INPUT_LIMITS.fullName);
  if (name.length < 3) return 'نام و نام خانوادگی باید حداقل ۳ نویسه باشد.';
  if (!/^[\p{L}\p{M}\s'\-\.]+$/u.test(name)) {
    return 'نام فقط می‌تواند شامل حروف، فاصله، خط تیره و نقطه باشد.';
  }
  return null;
}

export function validatePhone(value: unknown): string | null {
  return isValidIranMobile(String(value ?? '')) ? null : 'شماره موبایل ایرانی معتبر وارد کنید (مثال: 09121234567).';
}

export function normalizePhone(value: unknown): string {
  return normalizeIranPhone(String(value ?? ''));
}

export function validateAmountToman(value: unknown, min = 100_000, max = 5_000_000_000): string | null {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'مبلغ باید عدد باشد.';
  if (!Number.isInteger(amount)) return 'مبلغ باید عدد صحیح تومان باشد.';
  if (amount < min) return `مبلغ باید حداقل ${min.toLocaleString('fa-IR')} تومان باشد.`;
  if (amount > max) return `مبلغ نمی‌تواند بیش از ${max.toLocaleString('fa-IR')} تومان باشد.`;
  return null;
}

export function validateGiftCardAmount(value: unknown): string | null {
  const amount = Number(value);
  if (!Number.isFinite(amount) || !Number.isInteger(amount)) return 'مبلغ کارت هدیه باید عدد صحیح باشد.';
  if (amount < 100_000 || amount > 10_000_000) return 'مبلغ کارت هدیه باید بین ۱۰۰ هزار تا ۱۰ میلیون تومان باشد.';
  if (amount % 100_000 !== 0) return 'مبلغ کارت هدیه باید مضربی از ۱۰۰ هزار تومان باشد.';
  return null;
}

export function validateRequiredText(value: unknown, label: string, maxLength: number): string | null {
  const text = sanitizeText(value, maxLength);
  if (text.length < 2) return `${label} باید حداقل ۲ نویسه باشد.`;
  return null;
}

export function validateUsername(value: unknown): string | null {
  const username = sanitizeText(value, INPUT_LIMITS.username).toLowerCase();
  if (!/^[a-z0-9._-]{4,60}$/.test(username)) {
    return 'نام کاربری باید ۴ تا ۶۰ نویسه و شامل حروف لاتین، رقم، نقطه، خط تیره یا زیرخط باشد.';
  }
  return null;
}

export function validatePassword(value: unknown): string | null {
  const password = String(value ?? '');
  if (password.length < 12) return 'گذرواژه باید حداقل ۱۲ نویسه باشد.';
  if (password.length > INPUT_LIMITS.password) return 'گذرواژه بیش از حد طولانی است.';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'گذرواژه باید هم حرف و هم رقم داشته باشد.';
  }
  return null;
}

/** Masks a national ID or phone for non-privileged display. */
export function maskPhone(phone: string): string {
  return phone.replace(/^(\+\d{2})(\d{3})\d{4}(\d{2})$/, '$1$2****$3');
}
