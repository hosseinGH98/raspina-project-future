import { useMemo, useState } from 'react';
import { Plus, Search, UserCheck, X } from 'lucide-react';
import {
  calculateCustomerScores,
  classifyRfmSegment,
  getTierSpec,
  normalizeIranPhone,
} from '../utils/crmEngine';
import type {
  Customer360,
  CustomerInteraction,
  LoyaltyTierCode,
} from '../types/crm';

interface Customers360ViewProps {
  customers: Customer360[];
  selectedCustomerId: string | null;
  onSelectCustomer: (id: string | null) => void;
  onAddCustomer: (customer: Customer360) => void;
  onAddInteraction: (customerId: string, interaction: CustomerInteraction) => void;
  onAddTag: (customerId: string, tag: string) => void;
}

const CHANNEL_LABELS: Record<string, string> = {
  raspinashop: 'raspinashop.com',
  raspinaclothing: 'raspinaclothing.com',
  raspinaclothes: 'raspinaclothes.com',
  telegram: 'تلگرام',
  instagram: 'اینستاگرام',
  pos_hamedan: 'POS همدان',
  pos_tehran: 'POS تهران',
};

export function Customers360View({
  customers,
  selectedCustomerId,
  onSelectCustomer,
  onAddCustomer,
  onAddInteraction,
  onAddTag,
}: Customers360ViewProps) {
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | LoyaltyTierCode>('all');
  const [cityFilter, setCityFilter] = useState<'همه' | 'همدان' | 'تهران'>('همه');
  const [showAddModal, setShowAddModal] = useState(false);

  // Add customer form state
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newCity, setNewCity] = useState<Customer360['city']>('تهران');
  const [newTopSize, setNewTopSize] = useState('۳۸ (M)');
  const [newFavCategory, setNewFavCategory] = useState('مانتو و پالتو');
  const [formError, setFormError] = useState('');

  // Profile interaction form state
  const [noteChannel, setNoteChannel] = useState<CustomerInteraction['channel']>('phone');
  const [noteTopic, setNoteTopic] = useState('');
  const [noteSummary, setNoteSummary] = useState('');
  const [newTagText, setNewTagText] = useState('');

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (tierFilter !== 'all' && c.tierCode !== tierFilter) return false;
      if (cityFilter !== 'همه' && c.city !== cityFilter) return false;
      if (!q) return true;
      return (
        c.fullName.toLowerCase().includes(q) ||
        c.phoneE164.includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q)) ||
        c.identities.some((id) => id.handle.toLowerCase().includes(q))
      );
    });
  }, [customers, search, tierFilter, cityFilter]);

  const activeCustomer =
    customers.find((c) => c.id === selectedCustomerId) ?? filteredCustomers[0] ?? null;

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newName.trim();
    const normalizedPhone = normalizeIranPhone(newPhone);
    if (!trimmedName || normalizedPhone.length < 11) {
      setFormError('نام کامل و شماره موبایل معتبر الزامی است.');
      return;
    }
    if (customers.some((c) => c.phoneE164 === normalizedPhone)) {
      setFormError('مشتری با این شماره موبایل از قبل در CDP ثبت شده است.');
      return;
    }

    const scores = calculateCustomerScores({
      lastPurchaseDaysAgo: 0,
      orderCount: 0,
      lifetimeValueToman: 0,
      behavioralScore: 50,
      engagementScore: 60,
      npsLatest: 8,
      wishlistCount: 0,
    });

    const created: Customer360 = {
      id: `cust-${Date.now()}`,
      fullName: trimmedName,
      phoneE164: normalizedPhone,
      birthDate: '1375/01/01',
      city: newCity,
      province: newCity,
      address: `${newCity} — ثبت‌شده در پنل CRM`,
      preferredChannel: 'whatsapp',
      bestContactTime: '۱۰:۰۰ تا ۲۰:۰۰',
      topSize: newTopSize,
      bottomSize: newTopSize.split(' ')[0],
      shoeSize: '۳۸',
      favoriteColors: ['مشکی', 'کرم'],
      dislikedColors: [],
      favoriteStyles: ['کلاسیک شیک'],
      favoriteCategory: newFavCategory,
      identities: [
        {
          channel: newCity === 'همدان' ? 'pos_hamedan' : 'pos_tehran',
          externalUserId: `CRM-${Math.floor(1000 + Math.random() * 9000)}`,
          handle: normalizedPhone,
          syncedAt: 'هم‌اکنون',
        },
      ],
      orders: [],
      viewedProducts: [],
      wishlist: [],
      abandonedCartItems: [],
      searchKeywords: [],
      devicePreference: 'mobile',
      acquisitionSource: 'ثبت مستقیم کارشناس',
      interactions: [],
      annualSpendToman: 0,
      lifetimeValueToman: 0,
      walletBalanceToman: 0,
      pointsBalance: 100, // تکمیل پروفایل +۱۰۰ امتیاز
      tierCode: 'bronze',
      lastPurchaseDaysAgo: 0,
      npsLatest: 8,
      npsLabel: 'Passive',
      behavioralEventsScore: 50,
      engagementEventsScore: 60,
      smsSentThisWeek: 0,
      unsubscribedMarketing: false,
      tags: ['عضو جدید باشگاه'],
      badges: [],
      referralCode: `RASP-${Math.floor(1000 + Math.random() * 9000)}`,
      referralsCount: 0,
      scores,
    };

    onAddCustomer(created);
    onSelectCustomer(created.id);
    setNewName('');
    setNewPhone('');
    setFormError('');
    setShowAddModal(false);
  };

  const handleLogInteraction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCustomer || !noteTopic.trim() || !noteSummary.trim()) return;
    onAddInteraction(activeCustomer.id, {
      id: `int-${Date.now()}`,
      channel: noteChannel,
      timestamp: 'هم‌اکنون',
      agentName: 'کارشناس فعال CRM',
      topic: noteTopic.trim(),
      summary: noteSummary.trim(),
      sentiment: 'positive',
    });
    setNoteTopic('');
    setNoteSummary('');
  };

  const handleSubmitTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCustomer || !newTagText.trim()) return;
    onAddTag(activeCustomer.id, newTagText.trim());
    setNewTagText('');
  };

  return (
    <div className="min-w-0 space-y-5">
      {/* Search & Filters Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-[#e5dfd3] bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          <div className="relative w-full basis-full sm:min-w-[220px] sm:flex-1 sm:basis-auto">
            <Search
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#52586c]"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="جستجوی مشتری با نام، موبایل یا آیدی"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجو با نام، موبایل، آیدی اینستاگرام/تلگرام..."
              className="w-full rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] py-2 pr-9 pl-3 text-xs text-[#14192b] focus:border-[#c9a84c] focus:outline-none"
            />
          </div>

          <select
            aria-label="فیلتر سطح باشگاه"
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value as 'all' | LoyaltyTierCode)}
            className="rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-3 py-2 text-xs font-semibold text-[#14192b]"
          >
            <option value="all">همه سطوح باشگاه</option>
            <option value="vip_black">VIP Black</option>
            <option value="platinum">پلاتینیوم</option>
            <option value="gold">طلایی</option>
            <option value="bronze">برنزی</option>
          </select>

          <select
            aria-label="فیلتر شهر"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value as 'همه' | 'همدان' | 'تهران')}
            className="rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-3 py-2 text-xs font-semibold text-[#14192b]"
          >
            <option value="همه">همه شهرها</option>
            <option value="همدان">همدان</option>
            <option value="تهران">تهران</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-[#c9a84c] px-4 py-2 text-xs font-bold text-[#14192b] transition-colors hover:bg-[#d6b65a]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>ثبت مشتری جدید در CDP</span>
        </button>
      </div>

      {/* Directory + 360 Detail Split */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Customer Directory Table */}
        <section className="min-w-0 rounded-xl border border-[#e5dfd3] bg-white p-4 lg:col-span-5">
          <div className="flex items-center justify-between border-b border-[#e5dfd3] pb-3">
            <h2 className="text-sm font-extrabold text-[#14192b]">
              دایرکتوری مشتریان ({filteredCustomers.length.toLocaleString('fa-IR')})
            </h2>
            <span className="text-[11px] text-[#52586c]">تجمیع خودکار ۳ سایت + POS</span>
          </div>

          {filteredCustomers.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-xs text-[#52586c]">مشتری با این فیلتر یافت نشد.</p>
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setTierFilter('all');
                  setCityFilter('همه');
                }}
                className="mt-2 text-xs font-bold text-[#9a7622] hover:underline"
              >
                پاک‌کردن فیلترها
              </button>
            </div>
          ) : (
            <div className="mt-3 divide-y divide-[#f0ece3]">
              {filteredCustomers.map((c) => {
                const tier = getTierSpec(c.tierCode);
                const rfmSeg = classifyRfmSegment(c);
                const isSelected = activeCustomer?.id === c.id;

                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onSelectCustomer(c.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-right transition-colors ${
                      isSelected ? 'bg-[#14192b] text-white' : 'hover:bg-[#f7f6f2]'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold">{c.fullName}</p>
                      <p
                        className={`tabular-nums mt-0.5 text-[11px] ${
                          isSelected ? 'text-white/75' : 'text-[#52586c]'
                        }`}
                      >
                        {c.city} · {tier.nameFa} · امتیاز کل{' '}
                        {c.scores.overallScore.toLocaleString('fa-IR')}/۱۰۰
                      </p>
                    </div>
                    <div className="shrink-0 text-left">
                      <p
                        className={`tabular-nums text-xs font-extrabold ${
                          isSelected ? 'text-[#e2c275]' : 'text-[#14192b]'
                        }`}
                      >
                        {(c.lifetimeValueToman / 1_000_000).toFixed(1)}M
                      </p>
                      <p
                        className={`text-[10px] ${
                          isSelected ? 'text-white/70' : 'text-[#52586c]'
                        }`}
                      >
                        {rfmSeg}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Full 8-Dimension 360 Profile Panel */}
        <section className="min-w-0 rounded-xl border border-[#e5dfd3] bg-white p-5 lg:col-span-7">
          {!activeCustomer ? (
            <p className="py-12 text-center text-xs text-[#52586c]">
              یک مشتری را از فهرست سمت راست انتخاب کنید تا پروفایل ۳۶۰ درجه نمایش داده شود.
            </p>
          ) : (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e5dfd3] pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-extrabold text-[#14192b]">
                      {activeCustomer.fullName}
                    </h2>
                    <span className="rounded-md bg-[#14192b] px-2 py-0.5 text-[11px] font-bold text-[#e2c275]">
                      {getTierSpec(activeCustomer.tierCode).nameFa}
                    </span>
                    <span className="rounded-md border border-[#e5dfd3] px-2 py-0.5 text-[11px] font-semibold text-[#52586c]">
                      {classifyRfmSegment(activeCustomer)}
                    </span>
                  </div>
                  <p className="font-mono-code mt-1 break-all text-xs text-[#52586c]">
                    {activeCustomer.phoneE164} · {activeCustomer.email ?? 'بدون ایمیل'}
                  </p>
                </div>

                <div className="flex gap-4 text-left">
                  <div>
                    <p className="text-[11px] text-[#52586c]">امتیاز باشگاه</p>
                    <p className="tabular-nums text-base font-extrabold text-[#9a7622]">
                      {activeCustomer.pointsBalance.toLocaleString('fa-IR')}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#52586c]">کیف پول</p>
                    <p className="tabular-nums text-base font-extrabold text-[#16a34a]">
                      {activeCustomer.walletBalanceToman.toLocaleString('fa-IR')} ت
                    </p>
                  </div>
                </div>
              </div>

              {/* 8 Dimensions Grid */}
              <div className="grid gap-4 md:grid-cols-2">
                {/* 1 & 2: Personal + Identity Resolution */}
                <div className="rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] p-3.5">
                  <h3 className="text-xs font-extrabold text-[#14192b]">
                    ۱ و ۲. اطلاعات شخصی و Identity Resolution
                  </h3>
                  <dl className="mt-2 space-y-1 text-xs">
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#52586c]">شهر و آدرس:</dt>
                      <dd className="font-semibold text-[#14192b]">{activeCustomer.city}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#52586c]">تولد / کانال ترجیحی:</dt>
                      <dd className="tabular-nums font-semibold text-[#14192b]">
                        {activeCustomer.birthDate} · {activeCustomer.preferredChannel}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-2.5 border-t border-[#e5dfd3] pt-2">
                    <p className="text-[11px] font-bold text-[#9a7622]">هویت‌های ادغام‌شده:</p>
                    <ul className="mt-1 space-y-1 text-[11px] text-[#4b5063]">
                      {activeCustomer.identities.map((id) => (
                        <li key={`${id.channel}-${id.externalUserId}`} className="flex justify-between">
                          <span>{CHANNEL_LABELS[id.channel] ?? id.channel}</span>
                          <span className="font-mono-code text-[#14192b]">{id.handle}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* 3: Sizes & Style Preferences */}
                <div className="rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] p-3.5">
                  <h3 className="text-xs font-extrabold text-[#14192b]">۳. سایز و سلیقه استایل</h3>
                  <dl className="mt-2 space-y-1 text-xs">
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#52586c]">بالاتنه / پایین‌تنه / کفش:</dt>
                      <dd className="tabular-nums font-bold text-[#14192b]">
                        {activeCustomer.topSize} / {activeCustomer.bottomSize} / {activeCustomer.shoeSize}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#52586c]">دسته محبوب:</dt>
                      <dd className="font-semibold text-[#14192b]">{activeCustomer.favoriteCategory}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#52586c]">رنگ‌های مورد علاقه:</dt>
                      <dd className="font-semibold text-[#14192b]">
                        {activeCustomer.favoriteColors.join('، ')}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#52586c]">سبک استایل:</dt>
                      <dd className="font-semibold text-[#14192b]">
                        {activeCustomer.favoriteStyles.join('، ')}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* 4 & 5: Financial + Multi-Dimensional Scoring */}
                <div className="rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] p-3.5">
                  <h3 className="text-xs font-extrabold text-[#14192b]">
                    ۴. موتور امتیازدهی (RFM ۳۵/۳۰/۳۵)
                  </h3>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded bg-white p-2">
                      <p className="text-[10px] text-[#52586c]">RFM</p>
                      <p className="tabular-nums font-extrabold text-[#14192b]">
                        {activeCustomer.scores.rfmWeighted}
                      </p>
                    </div>
                    <div className="rounded bg-white p-2">
                      <p className="text-[10px] text-[#52586c]">رفتاری/تعامل</p>
                      <p className="tabular-nums font-extrabold text-[#14192b]">
                        {activeCustomer.scores.behavioralScore}/{activeCustomer.scores.engagementScore}
                      </p>
                    </div>
                    <div className="rounded bg-white p-2">
                      <p className="text-[10px] text-[#52586c]">امتیاز کل</p>
                      <p className="tabular-nums font-extrabold text-[#9a7622]">
                        {activeCustomer.scores.overallScore}
                      </p>
                    </div>
                  </div>
                  <p className="tabular-nums mt-2 text-[11px] text-[#52586c]">
                    پیش‌بینی CLV دوازده‌ماهه:{' '}
                    <strong className="text-[#14192b]">
                      {(activeCustomer.scores.predicted12mClvToman / 1_000_000).toFixed(1)}M تومان
                    </strong>{' '}
                    · ریسک ریزش: {activeCustomer.scores.churnRiskPct}٪
                  </p>
                </div>

                {/* 5: Digital Behavior */}
                <div className="rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] p-3.5">
                  <h3 className="text-xs font-extrabold text-[#14192b]">
                    ۵. رفتار دیجیتال و سبد رهاشده
                  </h3>
                  <ul className="mt-2 space-y-1.5 text-[11px] text-[#4b5063]">
                    <li>
                      <strong>Wishlist:</strong>{' '}
                      {activeCustomer.wishlist.length > 0
                        ? activeCustomer.wishlist.join('، ')
                        : 'موردی ثبت نشده'}
                    </li>
                    <li>
                      <strong>سبد رهاشده:</strong>{' '}
                      {activeCustomer.abandonedCartItems.length > 0 ? (
                        <span className="font-bold text-[#dc2626]">
                          {activeCustomer.abandonedCartItems.join('، ')}
                        </span>
                      ) : (
                        'ندارد'
                      )}
                    </li>
                    <li>
                      <strong>کلیدواژه جستجو:</strong>{' '}
                      {activeCustomer.searchKeywords.join('، ') || '—'}
                    </li>
                  </ul>
                </div>
              </div>

              {/* 6: Purchase History */}
              <div>
                <h3 className="text-xs font-extrabold text-[#14192b]">
                  ۶. تاریخچه خرید از ۳ وب‌سایت و شعب ({activeCustomer.orders.length.toLocaleString('fa-IR')} سفارش)
                </h3>
                {activeCustomer.orders.length === 0 ? (
                  <p className="mt-2 text-xs text-[#52586c]">هنوز سفارشی برای این عضو ثبت نشده است.</p>
                ) : (
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full min-w-[480px] text-right text-xs">
                      <thead>
                        <tr className="border-b border-[#e5dfd3] text-[#52586c]">
                          <th className="px-2 py-1.5 font-semibold">کد سفارش</th>
                          <th className="px-2 py-1.5 font-semibold">کانال</th>
                          <th className="px-2 py-1.5 font-semibold">شرح اقلام</th>
                          <th className="px-2 py-1.5 font-semibold">مبلغ</th>
                          <th className="px-2 py-1.5 font-semibold">تاریخ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f0ece3]">
                        {activeCustomer.orders.map((ord) => (
                          <tr key={ord.id}>
                            <td className="font-mono-code px-2 py-2 font-semibold text-[#14192b]">
                              {ord.externalOrderId}
                            </td>
                            <td className="px-2 py-2 text-[#52586c]">
                              {CHANNEL_LABELS[ord.sourceSite] ?? ord.sourceSite}
                            </td>
                            <td className="px-2 py-2 text-[#14192b]">{ord.itemsSummary}</td>
                            <td className="tabular-nums px-2 py-2 font-bold text-[#14192b]">
                              {ord.totalToman.toLocaleString('fa-IR')} ت
                            </td>
                            <td className="tabular-nums px-2 py-2 text-[#52586c]">{ord.orderedAt}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 7: Interaction Log + Interactive Note Form */}
              <div className="rounded-lg border border-[#e5dfd3] p-4">
                <h3 className="text-xs font-extrabold text-[#14192b]">
                  ۷. لاگ تعاملات (تماس، دایرکت، تلگرام، مراجعه حضوری)
                </h3>
                <div className="mt-2.5 space-y-2">
                  {activeCustomer.interactions.length === 0 ? (
                    <p className="text-xs text-[#52586c]">تعاملی ثبت نشده است؛ اولین یادداشت را ثبت کنید.</p>
                  ) : (
                    activeCustomer.interactions.map((int) => (
                      <div key={int.id} className="rounded-lg bg-[#f7f6f2] px-3 py-2 text-xs">
                        <div className="flex flex-wrap justify-between gap-2 text-[11px] text-[#52586c]">
                          <span className="font-bold text-[#14192b]">{int.topic}</span>
                          <span>
                            {int.agentName} · {int.timestamp}
                          </span>
                        </div>
                        <p className="mt-1 text-[#4b5063]">{int.summary}</p>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleLogInteraction} className="mt-3 grid gap-2 border-t border-[#e5dfd3] pt-3 sm:grid-cols-12">
                  <select
                    aria-label="کانال تعامل"
                    value={noteChannel}
                    onChange={(e) => setNoteChannel(e.target.value as CustomerInteraction['channel'])}
                    className="rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-2.5 py-2 text-xs sm:col-span-3"
                  >
                    <option value="phone">تماس تلفنی</option>
                    <option value="branch_visit">مراجعه شعبه</option>
                    <option value="instagram_dm">دایرکت اینستا</option>
                    <option value="telegram_bot">تلگرام</option>
                  </select>
                  <input
                    type="text"
                    aria-label="موضوع تعامل"
                    value={noteTopic}
                    onChange={(e) => setNoteTopic(e.target.value)}
                    placeholder="موضوع (مثلاً: مشاوره سایز پالتو)"
                    className="rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-3 py-2 text-xs sm:col-span-3"
                  />
                  <input
                    type="text"
                    aria-label="خلاصه یادداشت تعامل"
                    value={noteSummary}
                    onChange={(e) => setNoteSummary(e.target.value)}
                    placeholder="نتیجه تماس یا سلیقه ثبت‌شده..."
                    className="rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-3 py-2 text-xs sm:col-span-4"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-[#14192b] px-3 py-2 text-xs font-bold text-white hover:bg-[#1e2540] sm:col-span-2"
                  >
                    ثبت تعامل
                  </button>
                </form>
              </div>

              {/* 8: Tags & Badges */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e5dfd3] pt-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-bold text-[#14192b]">۸. برچسب‌ها:</span>
                  {activeCustomer.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md border border-[#e5dfd3] bg-[#f7f6f2] px-2 py-0.5 text-[11px] font-semibold text-[#14192b]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <form onSubmit={handleSubmitTag} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    aria-label="افزودن تگ دستی"
                    value={newTagText}
                    onChange={(e) => setNewTagText(e.target.value)}
                    placeholder="تگ دستی..."
                    className="w-28 rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-2.5 py-1 text-xs"
                  />
                  <button
                    type="submit"
                    className="rounded-lg border border-[#e5dfd3] px-2.5 py-1 text-xs font-bold text-[#14192b] hover:bg-[#f7f6f2]"
                  >
                    افزودن
                  </button>
                </form>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-customer-title"
            className="w-full max-w-md rounded-2xl border border-[#e5dfd3] bg-white p-5 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-[#e5dfd3] pb-3">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-[#9a7622]" aria-hidden="true" />
                <h2 id="add-customer-title" className="text-sm font-extrabold text-[#14192b]">
                  ثبت مشتری جدید در پروفایل یکپارچه
                </h2>
              </div>
              <button
                type="button"
                aria-label="بستن پنجره ثبت مشتری"
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1 text-[#52586c] hover:bg-[#f7f6f2]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-bold text-[#14192b]" htmlFor="cust-name-input">
                  نام و نام خانوادگی
                </label>
                <input
                  id="cust-name-input"
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="مثلاً: آزاده شریفی"
                  className="w-full rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-[#14192b]" htmlFor="cust-phone-input">
                  شماره موبایل (کلید اصلی Identity Resolution)
                </label>
                <input
                  id="cust-phone-input"
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="09120001122"
                  className="font-mono-code w-full rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-bold text-[#14192b]" htmlFor="cust-city-select">
                    شهر / شعبه
                  </label>
                  <select
                    id="cust-city-select"
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value as Customer360['city'])}
                    className="w-full rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-2.5 py-2"
                  >
                    <option value="تهران">تهران</option>
                    <option value="همدان">همدان</option>
                    <option value="کرج">کرج</option>
                    <option value="اصفهان">اصفهان</option>
                    <option value="شیراز">شیراز</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-bold text-[#14192b]" htmlFor="cust-size-select">
                    سایز بالاتنه
                  </label>
                  <select
                    id="cust-size-select"
                    value={newTopSize}
                    onChange={(e) => setNewTopSize(e.target.value)}
                    className="w-full rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-2.5 py-2"
                  >
                    <option value="۳۶ (S)">۳۶ (S)</option>
                    <option value="۳۸ (M)">۳۸ (M)</option>
                    <option value="۴۰ (L)">۴۰ (L)</option>
                    <option value="۴۲ (XL)">۴۲ (XL)</option>
                    <option value="۴۴ (XXL)">۴۴ (XXL)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block font-bold text-[#14192b]" htmlFor="cust-cat-select">
                  دسته‌بندی مورد علاقه
                </label>
                <select
                  id="cust-cat-select"
                  value={newFavCategory}
                  onChange={(e) => setNewFavCategory(e.target.value)}
                  className="w-full rounded-lg border border-[#e5dfd3] bg-[#f7f6f2] px-2.5 py-2"
                >
                  <option value="مانتو و پالتو">مانتو و پالتو</option>
                  <option value="شومیز و بلوز">شومیز و بلوز</option>
                  <option value="شلوار و دامن">شلوار و دامن</option>
                  <option value="ست و کامل لباس">ست و کامل لباس</option>
                </select>
              </div>

              {formError && <p className="font-semibold text-[#dc2626]">{formError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg border border-[#e5dfd3] px-4 py-2 font-semibold text-[#52586c]"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#14192b] px-4 py-2 font-bold text-white"
                >
                  ذخیره + اعطای ۱۰۰ امتیاز پروفایل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
