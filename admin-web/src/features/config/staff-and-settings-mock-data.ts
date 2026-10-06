import {
  Bell,
  CalendarDays,
  ClipboardList,
  CreditCard,
  Globe,
  Landmark,
  ReceiptText,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import { formatMoney } from '@/lib/formatters';
import type { ReasonCode, ReasonCodeCategory, SettingsGroup, StaffMember } from './types';

export const STAFF_MEMBERS: StaffMember[] = [
  {
    id: '01928f6e-7c1a-7b3e-9d2f-5f0000000001',
    name: 'Ananya Bose',
    maskedEmail: 'a***@karigar.in',
    grants: [{ role: 'SUPER_ADMIN', grantedBy: 'System', grantedAt: '2026-06-01' }],
    mfaState: 'ENROLLED',
    status: 'ACTIVE',
    passwordSet: true,
  },
  {
    id: '01928f6e-7c1a-7b3e-9d2f-5f0000000002',
    name: 'Priya Sen',
    maskedEmail: 'p***@karigar.in',
    grants: [{ role: 'OPS_MANAGER', grantedBy: 'Ananya', grantedAt: '2026-06-03' }],
    mfaState: 'ENROLLED',
    status: 'ACTIVE',
    passwordSet: true,
  },
  {
    id: '01928f6e-7c1a-7b3e-9d2f-5f0000000003',
    name: 'Kabir Ali',
    maskedEmail: 'k***@karigar.in',
    grants: [
      { role: 'DISPUTE_AGENT', grantedBy: 'Ananya', grantedAt: '2026-09-02' },
      { role: 'SUPPORT_AGENT', grantedBy: 'Priya', grantedAt: '2026-09-10' },
    ],
    mfaState: 'ENROLLED',
    status: 'ACTIVE',
    passwordSet: true,
  },
  {
    id: '01928f6e-7c1a-7b3e-9d2f-5f0000000004',
    name: 'Arif Khan',
    maskedEmail: 'a***@karigar.in',
    grants: [{ role: 'VERIFICATION_AGENT', grantedBy: 'Priya', grantedAt: '2026-07-14' }],
    mfaState: 'ENROLLED',
    status: 'ACTIVE',
    passwordSet: true,
  },
  {
    id: '01928f6e-7c1a-7b3e-9d2f-5f0000000005',
    name: 'Meera Iyer',
    maskedEmail: 'm***@karigar.in',
    grants: [{ role: 'FINANCE', grantedBy: 'Ananya', grantedAt: '2026-07-01' }],
    mfaState: 'ENROLLED',
    status: 'ACTIVE',
    passwordSet: true,
  },
  {
    id: '01928f6e-7c1a-7b3e-9d2f-5f0000000006',
    name: 'Neha Gupta',
    maskedEmail: 'n***@karigar.in',
    grants: [{ role: 'SUPPORT_AGENT', grantedBy: 'Priya', grantedAt: '2026-08-20' }],
    mfaState: 'NOT_ENROLLED',
    status: 'ACTIVE',
    passwordSet: true,
  },
  {
    id: '01928f6e-7c1a-7b3e-9d2f-5f0000000007',
    name: 'Rahul Dey',
    maskedEmail: 'r***@karigar.in',
    grants: [{ role: 'SUPPORT_AGENT', grantedBy: 'Priya', grantedAt: '2026-10-04' }],
    mfaState: 'NOT_SET_UP',
    status: 'ACTIVE',
    passwordSet: false,
  },
  {
    id: '01928f6e-7c1a-7b3e-9d2f-5f0000000008',
    name: 'Sunil Pal',
    maskedEmail: 's***@karigar.in',
    grants: [{ role: 'OPS_MANAGER', grantedBy: 'Ananya', grantedAt: '2026-06-10' }],
    mfaState: 'ENROLLED',
    status: 'SUSPENDED',
    passwordSet: true,
  },
  {
    id: '01928f6e-7c1a-7b3e-9d2f-5f0000000009',
    name: 'Tapas Roy',
    maskedEmail: 't***@karigar.in',
    grants: [],
    mfaState: 'WIPED',
    status: 'LEFT',
    passwordSet: true,
  },
];

/** Read-only config snapshot (A-06i). Values from LLD-006/009/010/011/016/018/019/020. */
export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    icon: ClipboardList,
    title: 'Requests',
    rows: [
      { label: 'Advance pay window', value: '15 min' },
      { label: 'Advance', value: `per trade (${formatMoney(9900)})` },
      { label: 'Expiry', value: 'per urgency' },
    ],
  },
  {
    icon: CalendarDays,
    title: 'Booking & visits',
    rows: [
      { label: 'Free cancel until', value: '2 h before' },
      { label: 'Late fee', value: `min(advance, ${formatMoney(10000)})` },
      { label: 'Check-in radius', value: '300 m · acc ≤ 100 m' },
      { label: 'Start code tries', value: '5' },
      { label: 'Visit / completion confirm', value: '24 h' },
      { label: 'Worker no-show', value: '60 min · auto 2 h' },
      { label: 'Warranty', value: '30 days' },
    ],
  },
  {
    icon: CreditCard,
    title: 'Payments',
    rows: [
      { label: 'Job payment expiry', value: '30 min' },
      { label: 'Commission', value: '10% of gross' },
      { label: 'GST on fee', value: '18%' },
      { label: 'Cash auto-confirm', value: '24 h' },
      { label: 'Dues limit', value: formatMoney(100000) },
    ],
  },
  {
    icon: Landmark,
    title: 'Payouts',
    rows: [
      { label: 'Daily batch', value: '11:00 IST' },
      { label: 'Minimum', value: formatMoney(10000) },
      { label: 'Cooling-off', value: '24 h' },
      { label: 'Name match', value: '≥ 80 auto · 50–79 review' },
    ],
  },
  {
    icon: Scale,
    title: 'Trust',
    rows: [
      { label: 'Dispute answer window', value: '48 h' },
      { label: 'Refund needing finance.refund', value: `> ${formatMoney(500000)}` },
      { label: 'Verification SLA', value: '24 h P90 · 48 h max' },
      { label: 'Submissions', value: '3 / type / 30 days' },
    ],
  },
  {
    icon: ShieldCheck,
    title: 'Admin security',
    rows: [
      { label: '2-step login', value: 'always on' },
      { label: 'MFA window', value: '12 h · staff 15 min' },
      { label: 'MFA lock', value: '5 wrong, then 15 min' },
      { label: 'PII reveals', value: '20 / hour' },
      { label: 'Admin API limit', value: '300 / min' },
    ],
  },
  {
    icon: Globe,
    title: 'Languages',
    chips: [
      { label: 'en · English' },
      { label: 'bn · বাংলা', lang: 'bn' },
      { label: 'hi · हिन्दी', lang: 'hi' },
    ],
    description: 'Missing text falls back to English.',
  },
  {
    icon: Bell,
    title: 'Notifications',
    description: 'Channels: push, email, in-app. No SMS. Templates in code.',
  },
  { icon: ReceiptText, title: 'Audit', description: 'Append-only, kept 8 years.' },
];

export const REASON_CODE_CATEGORIES: ReasonCodeCategory[] = [
  { code: 'CUSTOMER_CANCELLATION', codeCount: 6, ownerSeed: 'LLD-009' },
  { code: 'WORKER_CANCELLATION', codeCount: 5, ownerSeed: 'LLD-009' },
  { code: 'OFFER_DECLINE', codeCount: 6, ownerSeed: 'LLD-008' },
  { code: 'QUOTE_REJECTION', codeCount: 4, ownerSeed: 'LLD-017' },
  { code: 'VERIFICATION_REJECTION', codeCount: 15, ownerSeed: 'LLD-016' },
  { code: 'DISPUTE', codeCount: 8, ownerSeed: 'LLD-018' },
  { code: 'REFUND', codeCount: 8, ownerSeed: 'LLD-011' },
  { code: 'REVIEW_MODERATION', codeCount: 8, ownerSeed: 'LLD-012' },
  { code: 'WORKER_SUSPENSION', codeCount: 5, ownerSeed: 'LLD-020' },
  { code: 'CUSTOMER_SUSPENSION', codeCount: 4, ownerSeed: 'LLD-020' },
  { code: 'ACCOUNT_RESTRICTION', codeCount: 4, ownerSeed: 'LLD-020' },
  { code: 'PII_REVEAL', codeCount: 3, ownerSeed: 'LLD-020' },
  { code: 'WORKER_STRIKE', codeCount: 7, ownerSeed: 'LLD-009' },
];

/** Codes per category; only CUSTOMER_CANCELLATION is designed in the mockup. */
export const REASON_CODES_BY_CATEGORY: Partial<Record<string, ReasonCode[]>> = {
  CUSTOMER_CANCELLATION: [
    {
      sortOrder: 1,
      code: 'WORKER_LATE',
      labels: { en: 'Worker is late', bn: 'কারিগর দেরি করছেন', hi: 'कारीगर देर से आ रहा है' },
      requiresNote: false,
      cancellationFeeApplies: false,
      active: true,
    },
    {
      sortOrder: 2,
      code: 'FOUND_SOMEONE_ELSE',
      labels: { en: 'Found someone else', bn: 'অন্য কাউকে পেয়েছি', hi: 'किसी और को ढूंढ लिया' },
      requiresNote: false,
      cancellationFeeApplies: true,
      active: true,
    },
    {
      sortOrder: 3,
      code: 'NO_LONGER_NEEDED',
      labels: { en: 'No longer needed', bn: 'আর দরকার নেই', hi: 'अब ज़रूरत नहीं है' },
      requiresNote: false,
      cancellationFeeApplies: true,
      active: true,
    },
    {
      sortOrder: 4,
      code: 'PRICE_TOO_HIGH',
      labels: { en: 'Price is too high', bn: 'দাম খুব বেশি' },
      requiresNote: false,
      cancellationFeeApplies: true,
      active: true,
    },
    {
      sortOrder: 5,
      code: 'BOOKED_BY_MISTAKE',
      labels: { en: 'Booked by mistake', hi: 'गलती से बुक हो गया' },
      requiresNote: false,
      cancellationFeeApplies: true,
      active: true,
    },
    {
      sortOrder: 6,
      code: 'OTHER',
      labels: { en: 'Other reason', bn: 'অন্য কারণ', hi: 'अन्य कारण' },
      requiresNote: true,
      cancellationFeeApplies: true,
      active: true,
    },
  ],
};
