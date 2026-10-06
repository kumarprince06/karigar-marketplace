import {
  AlarmClock,
  Banknote,
  Bell,
  Check,
  Droplets,
  IdCard,
  Mail,
  Mailbox,
  MapPin,
  Scale,
  Undo2,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { paths } from '@/config/route-paths';
import { DEMO_IDS } from '@/mocks/demo-ids';
import type { FlaggedCheckIn, Trade, OpsQueueCode, OpsQueueSummary, TodayKpi } from './types';

export const TRADE_ICONS: Record<Trade, LucideIcon> = { Electrician: Zap, Plumber: Droplets };

export const FLAGGED_CHECK_INS_QUEUE_SLUG = 'flagged-check-ins';

/** Authenticator secret shown once during enrolment (POST /admin/me/mfa/enroll). */
export const MFA_ENROLMENT_SECRET = 'JBSW Y3DP EHPK 3PXP';

/** The code typed on A-01c that the server rejected (422 MFA_CODE_INVALID). */
export const REJECTED_MFA_CODE = '391207';
export const MFA_TRIES_LEFT = 3;

/** Seconds left on the 15-minute lock (429 MFA_LOCKED). */
export const MFA_LOCK_SECONDS_REMAINING = 14 * 60 + 32;

/** GET /admin/ops/queues: dashboard order. */
export const OPS_QUEUE_SUMMARIES: readonly OpsQueueSummary[] = [
  {
    code: 'VERIFICATION_PENDING',
    title: 'Verification pending',
    tabTitle: 'Verification',
    icon: IdCard,
    iconTone: 'warm',
    viewPermission: 'verification.review',
    count: 14,
    oldestAge: '51 h',
    oldestIsOverSla: true,
    alertChip: { tone: 'error', label: 'Over 48 h SLA', icon: AlarmClock },
    stripe: 'error',
    to: paths.verifications,
  },
  {
    code: 'OPEN_DISPUTE',
    title: 'Open disputes',
    tabTitle: 'Disputes',
    icon: Scale,
    iconTone: 'warm',
    viewPermission: 'dispute.manage',
    count: 6,
    oldestAge: '31 h',
    alertChip: { tone: 'warning', label: '2 HIGH' },
    stripe: 'accent',
    to: paths.disputes,
  },
  {
    code: 'FLAGGED_CHECK_IN',
    title: 'Flagged check-ins',
    tabTitle: 'Flagged check-ins',
    icon: MapPin,
    iconTone: 'warm',
    viewPermission: 'ops.view',
    count: 4,
    oldestAge: '2 d',
    alertChip: { tone: 'neutral', label: 'last 30 days' },
    stripe: 'accent',
    to: paths.opsQueue(FLAGGED_CHECK_INS_QUEUE_SLUG),
  },
  {
    code: 'CASH_DISPUTED',
    title: 'Disputed cash',
    tabTitle: 'Disputed cash',
    icon: Banknote,
    iconTone: 'warm',
    viewPermission: 'ops.view',
    count: 2,
    oldestAge: '19 h',
    alertChip: { tone: 'neutral', label: 'waits for dispute' },
    stripe: 'accent',
    to: paths.moneyQueues,
  },
  {
    code: 'STUCK_REFUND',
    title: 'Stuck refunds',
    tabTitle: 'Stuck refunds',
    icon: Undo2,
    iconTone: 'brand',
    viewPermission: 'finance.view',
    count: 1,
    oldestAge: '26 h',
    alertChip: { tone: 'error', label: 'Alert firing', icon: Bell },
    stripe: 'error',
    to: paths.moneyQueues,
  },
  {
    code: 'PARKED_PROVIDER_EVENT',
    title: 'Parked provider events',
    tabTitle: 'Parked events',
    icon: Mail,
    iconTone: 'brand',
    viewPermission: 'finance.view',
    count: 0,
    alertChip: { tone: 'success', label: 'Clear', icon: Check },
    stripe: 'success',
    to: paths.moneyQueues,
  },
  {
    code: 'OUTBOX_DEAD',
    title: 'Outbox dead events',
    tabTitle: 'Outbox dead',
    icon: Mailbox,
    iconTone: 'brand',
    viewPermission: 'ops.view',
    permissionNote: 'retry ops.act',
    count: 3,
    oldestAge: '42 min',
    alertChip: { tone: 'error', label: '> 0 for 15 min', icon: Bell },
    stripe: 'error',
    to: paths.outbox,
  },
];

/** Order of the tabs strip on a queue page (A-01f). */
export const OPS_QUEUE_TAB_ORDER: readonly OpsQueueCode[] = [
  'FLAGGED_CHECK_IN',
  'CASH_DISPUTED',
  'STUCK_REFUND',
  'PARKED_PROVIDER_EVENT',
  'VERIFICATION_PENDING',
  'OPEN_DISPUTE',
  'OUTBOX_DEAD',
];

export const TODAY_KPIS: readonly TodayKpi[] = [
  { label: 'Requests created', value: 64, hint: '5 still matching' },
  { label: 'Bookings confirmed', value: 41, hint: '3 cancelled' },
  { label: 'Visits in progress', value: 12, hint: '2 en route' },
  { label: 'Disputes opened', value: 2, hint: '1 HIGH' },
  { label: 'Refunds succeeded', value: 396_000, isMoney: true, hint: '9 refunds' },
];

/** GET /admin/ops/queues/FLAGGED_CHECK_IN, oldest first in the API; shown newest first as in the design. */
export const FLAGGED_CHECK_INS: readonly FlaggedCheckIn[] = [
  {
    visitId: DEMO_IDS.visit,
    bookingId: DEMO_IDS.booking,
    workerName: 'Sujit Das',
    trade: 'Electrician',
    checkedInLabel: 'Today 10:12',
    distanceMeters: 820,
    accuracyMeters: 140,
    workerReason: 'Poor GPS signal',
    startCode: { status: 'VERIFIED', verifiedAt: '10:14' },
  },
  {
    visitId: '01928f6e-7c1a-7b3e-9d2f-1e2f3a77d0b2',
    bookingId: '01928f6e-7c1a-7b3e-9d2f-7a8b9cc2e817',
    workerName: 'Mitali Pal',
    trade: 'Plumber',
    checkedInLabel: 'Today 09:40',
    distanceMeters: 410,
    accuracyMeters: 60,
    workerReason: 'Building entrance on other road',
    startCode: { status: 'VERIFIED', verifiedAt: '09:42' },
  },
  {
    visitId: '01928f6e-7c1a-7b3e-9d2f-2b3c4d0be5f9',
    bookingId: '01928f6e-7c1a-7b3e-9d2f-8c9d0e98a4d0',
    workerName: 'Abdul Hossain',
    trade: 'Electrician',
    checkedInLabel: 'Yesterday 17:05',
    distanceMeters: 2400,
    accuracyMeters: 35,
    workerReason: 'Other',
    startCode: { status: 'NOT_ENTERED', triesUsed: 5, maxTries: 5 },
  },
  {
    visitId: '01928f6e-7c1a-7b3e-9d2f-3c4d5e5c1a33',
    bookingId: '01928f6e-7c1a-7b3e-9d2f-9d0e1f41bb7e',
    workerName: 'Rakesh Mondal',
    trade: 'Plumber',
    checkedInLabel: '2 days ago 11:30',
    distanceMeters: 350,
    accuracyMeters: 110,
    workerReason: 'Poor GPS signal',
    startCode: { status: 'VERIFIED', verifiedAt: '11:31' },
  },
];
