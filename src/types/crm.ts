export type LoyaltyTierCode = 'bronze' | 'gold' | 'platinum' | 'vip_black';

export type ChannelKey =
  | 'raspinashop'
  | 'raspinaclothing'
  | 'raspinaclothes'
  | 'telegram'
  | 'instagram'
  | 'pos_hamedan'
  | 'pos_tehran';

export type RfmSegmentName =
  | 'Champions'
  | 'Loyal'
  | 'High Potential'
  | 'New'
  | 'At-Risk'
  | 'Sleeping'
  | 'Lost';

export type RbacRole = 'ceo' | 'branch_manager' | 'marketing' | 'support' | 'analyst' | 'sales';

export interface CustomerIdentityLink {
  channel: ChannelKey;
  externalUserId: string;
  handle: string;
  syncedAt: string;
}

export interface CustomerOrderRecord {
  id: string;
  externalOrderId: string;
  sourceSite: ChannelKey;
  attributionChannel: 'instagram_dm' | 'telegram_bot' | 'direct_web' | 'store_walkin';
  orderedAt: string;
  totalToman: number;
  itemsSummary: string;
  paymentMethod: 'zarinpal' | 'behpardakht' | 'pos_card' | 'wallet';
  status: 'paid' | 'shipped' | 'delivered' | 'returned';
  couponUsed?: string;
}

export interface CustomerInteraction {
  id: string;
  channel: 'phone' | 'support_chat' | 'instagram_dm' | 'telegram_bot' | 'branch_visit' | 'email';
  timestamp: string;
  agentName: string;
  topic: string;
  summary: string;
  sentiment: 'positive' | 'neutral' | 'negative';
}

export interface CustomerScoreBreakdown {
  recencyScore: number;
  frequencyScore: number;
  monetaryScore: number;
  rfmWeighted: number;
  behavioralScore: number;
  engagementScore: number;
  npsNormalized: number;
  potentialScore: number;
  overallScore: number;
  churnRiskPct: number;
  returnRiskPct: number;
  predicted12mClvToman: number;
}

export interface Customer360 {
  id: string;
  fullName: string;
  phoneE164: string;
  altPhone?: string;
  email?: string;
  nationalIdMasked?: string;
  birthDate: string;
  city: 'همدان' | 'تهران' | 'اصفهان' | 'شیراز' | 'کرج';
  province: string;
  address: string;
  preferredChannel: 'whatsapp' | 'telegram' | 'sms' | 'instagram' | 'phone';
  bestContactTime: string;
  topSize: string;
  bottomSize: string;
  shoeSize: string;
  favoriteColors: string[];
  dislikedColors: string[];
  favoriteStyles: string[];
  favoriteCategory: string;
  identities: CustomerIdentityLink[];
  orders: CustomerOrderRecord[];
  viewedProducts: string[];
  wishlist: string[];
  abandonedCartItems: string[];
  searchKeywords: string[];
  devicePreference: 'mobile' | 'desktop';
  acquisitionSource: string;
  interactions: CustomerInteraction[];
  annualSpendToman: number;
  lifetimeValueToman: number;
  walletBalanceToman: number;
  pointsBalance: number;
  tierCode: LoyaltyTierCode;
  manualVipInvited?: boolean;
  isB2BWholesale?: boolean;
  familyGroupId?: string;
  lastPurchaseDaysAgo: number;
  npsLatest: number;
  npsLabel: 'Promoter' | 'Passive' | 'Detractor';
  behavioralEventsScore: number;
  engagementEventsScore: number;
  smsSentThisWeek: number;
  unsubscribedMarketing: boolean;
  tags: string[];
  badges: string[];
  referralCode: string;
  referralsCount: number;
  scores: CustomerScoreBreakdown;
}

export interface LoyaltyTierSpec {
  code: LoyaltyTierCode;
  nameFa: string;
  thresholdFa: string;
  minAnnualToman: number;
  maxAnnualToman: number | null;
  pointsPer10k: number;
  walletCashbackPct: number;
  permanentDiscountPct: number;
  birthdayDiscountPct: number;
  firstReplySlaHours: number;
  resolutionSlaHours: number;
  freeShippingRule: string;
  perks: string[];
}

export interface PointEarnRule {
  id: string;
  actionFa: string;
  points: number;
  category: 'engagement' | 'social' | 'milestone';
}

export interface PointRedeemRule {
  id: string;
  rewardFa: string;
  pointsRequired: number;
  walletCreditToman?: number;
}

export interface LoyaltyTransaction {
  id: string;
  customerId: string;
  customerName: string;
  type: 'earn' | 'redeem';
  actionFa: string;
  pointsDelta: number;
  createdAt: string;
}

export type FollowUpStage =
  | 'immediate_confirm'
  | 'h24_nps'
  | 'd7_review_ugc'
  | 'd30_cross_sell'
  | 'd90_winback'
  | 'anniversary_2x';

export interface FollowUpTask {
  id: string;
  customerId: string;
  customerName: string;
  tierCode: LoyaltyTierCode;
  orderId: string;
  stage: FollowUpStage;
  stageLabelFa: string;
  dueLabelFa: string;
  channel: 'SMS' | 'تلفن' | 'واتساپ' | 'ایمیل';
  suggestedOffer: string;
  status: 'pending' | 'completed' | 'escalated';
  npsRecorded?: number;
  outcomeNote?: string;
}

export interface RmaRequest {
  id: string;
  rmaCode: string;
  customerId: string;
  customerName: string;
  tierCode: LoyaltyTierCode;
  orderId: string;
  productTitle: string;
  reason: 'عدم تطابق سایز' | 'ایراد دوخت' | 'عدم تطابق رنگ' | 'تغییر سلیقه';
  refundAmountToman: number;
  refundTarget: 'wallet' | 'bank_card';
  status: 'pending_review' | 'approved_pickup' | 'refunded';
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  ticketCode: string;
  customerId: string;
  customerName: string;
  tierCode: LoyaltyTierCode;
  channel: 'سایت' | 'تلگرام' | 'اینستاگرام' | 'تلفن' | 'واتساپ';
  category: 'مرجوعی و تعویض' | 'سایز و موجودی' | 'کیفیت محصول' | 'پیگیری ارسال' | 'باشگاه مشتریان';
  subject: string;
  firstReplySlaHours: number;
  resolutionSlaHours: number;
  elapsedHours: number;
  status: 'open' | 'in_progress' | 'resolved';
  assignee: string;
  createdAt: string;
}

export interface CampaignItem {
  id: string;
  title: string;
  type: 'trigger' | 'broadcast' | 'drip';
  channel: 'SMS' | 'واتساپ' | 'تلگرام' | 'ایمیل' | 'Push';
  targetSegment: string;
  templateWithTokens: string;
  isActive: boolean;
  sentCount: number;
  openOrReadRatePct: number;
  conversionRatePct: number;
  revenueToman: number;
}

export interface FamilyGroup {
  id: string;
  familyName: string;
  memberIds: string[];
  combinedPoints: number;
  combinedTier: LoyaltyTierCode;
}

export interface GiftCardRecord {
  id: string;
  code: string;
  occasion: 'تولد' | 'نوروز' | 'ازدواج' | 'تشکر';
  amountToman: number;
  recipientPhone: string;
  deliveryChannel: 'واتساپ' | 'تلگرام';
  status: 'active' | 'redeemed';
  expiresAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorRole: RbacRole;
  action: string;
  target: string;
  timestamp: string;
}

export interface CustomSegmentRule {
  city: 'همه' | 'همدان' | 'تهران' | 'سایر';
  tier: 'all' | LoyaltyTierCode;
  minAnnualMillion: number;
  maxDaysSincePurchase: number;
  channel: 'all' | ChannelKey;
  logic: 'AND' | 'OR';
}
