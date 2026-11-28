import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Search, X } from 'lucide-react';
import { searchAll, type SearchDoc, type SearchKind, type SearchResult } from '../utils/searchIndex';

const KIND_LABELS: Record<SearchKind, string> = {
  customer: 'مشتری',
  order: 'سفارش',
  ticket: 'تیکت',
};

/** True when the user is typing in a field, so `/` must not steal the key. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

interface CommandPaletteProps {
  open: boolean;
  docs: SearchDoc[];
  onClose: () => void;
  onSelect: (result: SearchResult) => void;
}

export function CommandPalette({ open, docs, onClose, onSelect }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const results = useMemo(() => searchAll(docs, query), [docs, query]);

  // Focus the field on open and give focus back to the trigger on close.
  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setQuery('');
    setActiveIndex(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(timer);
      restoreFocusRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) return null;

  const activeResult = results[activeIndex];
  const activeOptionId = activeResult ? `command-option-${activeIndex}` : undefined;

  const select = (result: SearchResult | undefined) => {
    if (!result) return;
    onSelect(result);
    onClose();
  };

  const handleDialogKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusables = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>('input, button') ?? []
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (results.length > 0) setActiveIndex((i) => (i + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (results.length > 0) setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      if (results.length > 0) setActiveIndex(results.length - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      select(results[activeIndex]);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/50 p-3 pt-[8vh]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-palette-title"
        onKeyDown={handleDialogKeyDown}
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-[#e5dfd3] bg-white shadow-2xl"
      >
        <h2 id="command-palette-title" className="sr-only">
          جست‌وجوی سراسری
        </h2>

        <div className="flex items-center gap-2 border-b border-[#e5dfd3] px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-[#52586c]" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-results"
            aria-activedescendant={activeOptionId}
            aria-autocomplete="list"
            aria-label="جست‌وجو در مشتریان، سفارش‌ها و تیکت‌ها"
            placeholder="نام مشتری، شماره موبایل، کد سفارش یا کد تیکت…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
            className="min-w-0 flex-1 bg-transparent text-sm text-[#171a26] placeholder:text-[#8b8f9e] focus:outline-none"
            dir="auto"
          />
          {query && (
            <span className="shrink-0 text-[11px] font-semibold text-[#52586c]" aria-hidden="true">
              {results.length.toLocaleString('fa-IR')} نتیجه
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن جست‌وجو"
            className="shrink-0 rounded-md p-1 text-[#52586c] hover:bg-[#f7f6f2]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <p role="status" aria-live="polite" className="sr-only">
          {query ? `${results.length.toLocaleString('fa-IR')} نتیجه پیدا شد` : ''}
        </p>

        <ul
          id="command-results"
          role="listbox"
          aria-label="نتایج جست‌وجو"
          className="max-h-[52vh] overflow-y-auto p-2"
        >
          {results.map((result, index) => (
            <li
              key={`${result.kind}-${result.id}`}
              id={`command-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => select(result)}
              className={`cursor-pointer rounded-xl px-3 py-2.5 ${
                index === activeIndex ? 'bg-[#fdf6e6] ring-1 ring-[#c9a84c]' : 'hover:bg-[#f7f6f2]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-xs font-bold text-[#14192b]" dir="auto">
                  {result.title}
                </span>
                <span className="shrink-0 rounded-md border border-[#e5dfd3] px-1.5 py-0.5 text-[10px] font-semibold text-[#52586c]">
                  {KIND_LABELS[result.kind]}
                </span>
              </div>
              <p className="mt-0.5 truncate text-[11px] text-[#52586c]" dir="auto">
                {result.subtitle}
              </p>
            </li>
          ))}
        </ul>

        {query && results.length === 0 && (
          <p className="border-t border-[#e5dfd3] px-4 py-6 text-center text-xs leading-6 text-[#52586c]">
            نتیجه‌ای پیدا نشد. شماره موبایل را با ۰۹ شروع کنید، یا نام مشتری را کامل‌تر بنویسید.
          </p>
        )}

        {!query && (
          <p className="border-t border-[#e5dfd3] px-4 py-3 text-[11px] leading-6 text-[#52586c]">
            بر اساس نام، شماره موبایل، کد مشتری، شماره سفارش یا کد تیکت جست‌وجو می‌کند.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#e5dfd3] bg-[#f7f6f2] px-4 py-2 text-[10px] font-semibold text-[#52586c]">
          <span>↑ ↓ حرکت</span>
          <span>Enter باز کردن</span>
          <span>Esc بستن</span>
        </div>
      </div>
    </div>
  );
}
