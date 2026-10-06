import { Ban, Building2, Droplets, House, Zap, type LucideIcon } from 'lucide-react';
import { DEMO_IDS } from '@/mocks/demo-ids';
import type {
  CustomerDetail,
  ReasonCodeOption,
  RestrictionType,
  UserSearchResult,
  UserTypeFilter,
  WorkerDetail,
} from './types';

/** The one place trade icons are chosen (the mockups used emoji). */
const TRADE_ICONS = { ELECTRICIAN: Zap, PLUMBER: Droplets } as const;

export const MAX_SEARCH_RESULTS = 20;
export const MIN_NAME_PREFIX_LENGTH = 3;

const SEARCHABLE_USERS: UserSearchResult[] = [
  {
    id: DEMO_IDS.customer,
    name: 'Rina Das',
    profileTypes: ['CUSTOMER'],
    phone: '+919876544321',
    email: 'rina.das@gmail.com',
    area: 'Shibpur 711102',
    accountStatus: 'ACTIVE',
    openDisputeCount: 1,
    restrictions: [],
  },
  {
    id: '01928f6e-7c1a-7b3e-9d2f-11a2b36d19f4',
    name: 'Rinku Paul',
    profileTypes: ['WORKER'],
    phone: '+919830017710',
    email: 'rinku.paul@yahoo.in',
    area: 'Bally · 6 km',
    accountStatus: 'ACTIVE',
    openDisputeCount: 0,
    restrictions: ['NO_NEW_OFFERS'],
  },
  {
    id: '01928f6e-7c1a-7b3e-9d2f-22b3c4a1907c',
    name: 'Rina Mukherjee',
    profileTypes: ['CUSTOMER'],
    phone: '+919831000092',
    email: 'mukherjee.rina@gmail.com',
    area: 'Salkia 711106',
    accountStatus: 'SUSPENDED',
    openDisputeCount: 0,
    restrictions: [],
  },
  {
    id: '01928f6e-7c1a-7b3e-9d2f-33c4d5e55b10',
    name: 'Rintu Sk',
    profileTypes: ['WORKER'],
    phone: '+919874003348',
    email: 'rintu.sk@gmail.com',
    area: 'Santragachi · 4 km',
    accountStatus: 'ONBOARDING',
    openDisputeCount: 0,
    restrictions: [],
  },
  {
    id: '01928f6e-7c1a-7b3e-9d2f-44d5e60c7d4a',
    name: 'Rina Ghosh',
    profileTypes: ['CUSTOMER', 'WORKER'],
    phone: '+919903005521',
    email: 'ghosh.rina@outlook.com',
    area: 'Howrah 711101',
    accountStatus: 'ACTIVE',
    openDisputeCount: 0,
    restrictions: [],
  },
  {
    id: '01928f6e-7c1a-7b3e-9d2f-55e6f763fe02',
    name: 'Rinki Shaw',
    profileTypes: ['CUSTOMER'],
    phone: '+919748009018',
    email: 'shaw.rinki@gmail.com',
    area: 'Liluah 711204',
    accountStatus: 'DEACTIVATED',
    openDisputeCount: 0,
    restrictions: [],
  },
  {
    id: '01928f6e-7c1a-7b3e-9d2f-66f70877b2d1',
    name: 'Rinita Bose',
    profileTypes: ['WORKER'],
    phone: '+919836006620',
    email: 'bose.rinita@gmail.com',
    area: 'Shibpur · 5 km',
    accountStatus: 'SUSPENDED',
    openDisputeCount: 0,
    restrictions: ['NO_PAYOUTS'],
  },
  {
    id: DEMO_IDS.worker,
    name: 'Sujit Das',
    profileTypes: ['WORKER'],
    phone: '+919830027710',
    email: 'sujit.das@gmail.com',
    area: 'Shibpur · 6 km',
    accountStatus: 'ACTIVE',
    openDisputeCount: 0,
    restrictions: ['NO_NEW_OFFERS'],
  },
];

export type SearchQueryKind = 'PHONE' | 'EMAIL' | 'ID' | 'NAME';

export function detectSearchQueryKind(query: string): SearchQueryKind {
  const compactQuery = query.replace(/\s/g, '');
  if (compactQuery.includes('@')) return 'EMAIL';
  if (/^\+?\d{10,}$/.test(compactQuery)) return 'PHONE';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(compactQuery)) return 'ID';
  return 'NAME';
}

/**
 * Stands in for GET /admin/users?q=&type=: exact phone / email / id, or a name prefix of at least 3 letters,
 * max 20 rows. Returns null when the query is too short (the API answers 422).
 */
export function searchUsers(query: string, typeFilter: UserTypeFilter): UserSearchResult[] | null {
  const trimmedQuery = query.trim().toLowerCase();
  const queryKind = detectSearchQueryKind(trimmedQuery);
  if (queryKind === 'NAME' && trimmedQuery.length < MIN_NAME_PREFIX_LENGTH) return null;

  const compactQuery = trimmedQuery.replace(/\s/g, '');
  const normalizedPhoneQuery = compactQuery.startsWith('+') ? compactQuery : `+91${compactQuery.slice(-10)}`;

  return SEARCHABLE_USERS.filter((user) => {
    if (typeFilter !== 'ALL' && !user.profileTypes.includes(typeFilter)) return false;
    if (queryKind === 'PHONE') return user.phone === normalizedPhoneQuery;
    if (queryKind === 'EMAIL') return user.email.toLowerCase() === compactQuery;
    if (queryKind === 'ID') return user.id === compactQuery;
    return user.name.toLowerCase().startsWith(trimmedQuery);
  }).slice(0, MAX_SEARCH_RESULTS);
}

/** "+919876544321" → "+91******4321" (LLD-020 D7). */
export function maskPhone(phone: string): string {
  return `${phone.slice(0, 3)}******${phone.slice(-4)}`;
}

/** "rina.das@gmail.com" → "r***@gmail.com" (LLD-020 D7). */
export function maskEmail(email: string): string {
  const [localPart = '', domain = ''] = email.split('@');
  return `${localPart.slice(0, 1)}***@${domain}`;
}

const CUSTOMERS: CustomerDetail[] = [
  {
    id: DEMO_IDS.customer,
    name: 'Rina Das',
    initials: 'RD',
    accountStatus: 'ACTIVE',
    phone: '+919876544321',
    email: 'rina.das@gmail.com',
    joinedOn: '12 Mar 2026',
    language: 'en',
    platform: 'Android',
    bookings: [
      {
        id: DEMO_IDS.booking,
        tradeIcon: TRADE_ICONS.ELECTRICIAN,
        problem: 'Fan not working',
        workerName: 'Sujit Das',
        firstVisitAt: '2026-10-06T10:00:00+05:30',
        bookingStatus: 'CONFIRMED',
        jobStatus: 'IN_PROGRESS',
        visitStatus: 'IN_PROGRESS',
      },
      {
        id: '01928f6e-7c1a-7b3e-9d2f-77a1b2c2e817',
        tradeIcon: TRADE_ICONS.PLUMBER,
        problem: 'Tap leaking',
        workerName: 'Mitali Pal',
        firstVisitAt: '2026-10-02T09:30:00+05:30',
        bookingStatus: 'COMPLETED',
        jobStatus: 'COMPLETED',
        visitStatus: 'DONE',
      },
      {
        id: '01928f6e-7c1a-7b3e-9d2f-88b2c3d18d4a',
        tradeIcon: TRADE_ICONS.ELECTRICIAN,
        problem: 'Wiring check',
        workerName: 'Abdul Hossain',
        firstVisitAt: '2026-09-21T16:00:00+05:30',
        bookingStatus: 'CANCELLED',
        jobStatus: 'CANCELLED',
        visitStatus: 'CANCELLED',
      },
    ],
    requestCount: 4,
    auditEventCount: 20,
    reviewsWrittenCount: 1,
    addresses: [
      {
        id: 'home',
        icon: House,
        label: 'Home',
        locality: 'Shibpur',
        pinCode: '711102',
        fullAddress: '14/2 Kazipara Lane, Shibpur, Howrah 711102',
      },
      {
        id: 'mother',
        icon: Building2,
        label: "Mother's flat",
        locality: 'Salkia',
        pinCode: '711106',
        fullAddress: 'Flat 3B, 22 GT Road, Salkia, Howrah 711106',
      },
    ],
    recentAuditEvents: [
      {
        id: 'audit-1',
        occurredAt: '2026-10-06T11:02:00+05:30',
        actorName: 'Priya Sen',
        action: 'USER_VIEWED',
      },
      {
        id: 'audit-2',
        occurredAt: '2026-10-06T10:48:00+05:30',
        actorName: 'Arif Khan',
        action: 'USER_PII_REVEALED · PHONE',
        reasonCode: 'SUPPORT_CALL',
      },
      {
        id: 'audit-3',
        occurredAt: '2026-10-03T18:20:00+05:30',
        actorName: 'SYSTEM',
        action: 'DISPUTE_OPENED',
        reasonCode: 'POOR_QUALITY',
      },
    ],
    liveRestrictionCount: 0,
    lastLiftedRestriction: 'NO_NEW_REQUESTS · ADMIN · lifted 28 Sep by Arif Khan (FRAUD_CLEARED)',
    openDispute: {
      id: DEMO_IDS.dispute,
      status: 'IN_REVIEW',
      reasonCode: 'POOR_QUALITY',
      scope: 'JOB',
      bookingId: '01928f6e-7c1a-7b3e-9d2f-77a1b2c2e817',
    },
  },
];

const WORKERS: WorkerDetail[] = [
  {
    id: DEMO_IDS.worker,
    name: 'Sujit Das',
    initials: 'SD',
    accountStatus: 'ACTIVE',
    verificationStatus: 'PARTIAL',
    pendingVerificationCount: 1,
    availability: 'ACCEPTING_JOBS',
    phone: '+919830027710',
    email: 'sujit.das@gmail.com',
    rating: 4.6,
    reviewCount: 32,
    language: 'bn',
    baseLocality: 'Shibpur',
    radiusKm: 6,
    trades: [
      {
        icon: TRADE_ICONS.ELECTRICIAN,
        name: 'Electrician',
        ratePaise: 35000,
        rateUnit: 'visit',
        experienceYears: 8,
        status: 'ACTIVE',
        isJobEligible: true,
      },
      {
        icon: TRADE_ICONS.PLUMBER,
        name: 'Plumber',
        ratePaise: 70000,
        rateUnit: 'half day',
        experienceYears: 3,
        status: 'PAUSED',
        isJobEligible: false,
      },
    ],
    verificationChecks: [
      { name: 'ID_PROOF · Voter ID', status: 'VERIFIED' },
      { name: 'ELECTRICAL_LICENSE · Electrician', status: 'VERIFIED', statusDetail: 'exp 03/2028' },
      { name: 'PAN', status: 'PENDING', statusDetail: '19 h' },
      { name: 'POLICE_VERIFICATION', optionalNote: '(optional badge)', status: 'NOT_SUBMITTED' },
    ],
    strikes: [
      { type: 'LATE_CANCELLATION', issuedOn: '18 Sep', source: 'SYSTEM', points: 2, status: 'ACTIVE' },
      { type: 'DISPUTE_UPHELD', issuedOn: '29 Sep', source: 'dispute …a0c2f1', points: 3, status: 'ACTIVE' },
      { type: 'NO_SHOW', issuedOn: '2 Aug', source: 'SYSTEM', points: 3, status: 'REVOKED' },
    ],
    restrictions: [{ type: 'NO_NEW_OFFERS', source: 'STRIKES' }],
    ledgerBalancePaise: -11800,
    duesLimitPaise: 100000,
    payoutAccount: { status: 'ACTIVE', lastFourDigits: '4821' },
    confirmedBookings: [
      { id: DEMO_IDS.booking, startsAt: '2026-10-06T10:00:00+05:30', visitStatus: 'IN_PROGRESS' },
      { id: '01928f6e-7c1a-7b3e-9d2f-99c3d4b4e0a7', startsAt: '2026-10-07T15:00:00+05:30' },
    ],
  },
];

/** Stands in for GET /admin/users/{userId}; unknown ids fall back to the demo customer so any link renders. */
export function findCustomerById(customerId: string | undefined): CustomerDetail {
  return CUSTOMERS.find((customer) => customer.id === customerId) ?? CUSTOMERS[0]!;
}

/** Stands in for GET /admin/users/{userId} + worker summary; unknown ids fall back to the demo worker. */
export function findWorkerById(workerId: string | undefined): WorkerDetail {
  return WORKERS.find((worker) => worker.id === workerId) ?? WORKERS[0]!;
}

/** reason_codes category PII_REVEAL. */
export const PII_REVEAL_REASONS: ReasonCodeOption[] = [
  { code: 'SUPPORT_CALL', label: 'SUPPORT_CALL — customer is on the phone with support' },
  { code: 'DISPUTE_INVESTIGATION', label: 'DISPUTE_INVESTIGATION' },
  { code: 'SAFETY_CONCERN', label: 'SAFETY_CONCERN' },
  { code: 'FRAUD_SUSPECTED', label: 'FRAUD_SUSPECTED' },
  { code: 'LEGAL_REQUEST', label: 'LEGAL_REQUEST' },
];

/** reason_codes category CUSTOMER_SUSPENSION (placeholder codes, the LLD lists none). */
export const CUSTOMER_SUSPENSION_REASONS: ReasonCodeOption[] = [
  { code: 'FRAUD_SUSPECTED', label: 'FRAUD_SUSPECTED' },
  { code: 'ABUSIVE_BEHAVIOUR', label: 'ABUSIVE_BEHAVIOUR' },
  { code: 'PAYMENT_ABUSE', label: 'PAYMENT_ABUSE' },
];

/** reason_codes category WORKER_SUSPENSION (placeholder codes). */
export const WORKER_SUSPENSION_REASONS: ReasonCodeOption[] = [
  { code: 'SAFETY_CONCERN', label: 'SAFETY_CONCERN' },
  { code: 'FRAUD_SUSPECTED', label: 'FRAUD_SUSPECTED' },
  { code: 'QUALITY_ISSUES', label: 'QUALITY_ISSUES' },
];

/** reason_codes category ACCOUNT_RESTRICTION (placeholder codes). */
export const ACCOUNT_RESTRICTION_REASONS: ReasonCodeOption[] = [
  { code: 'ABUSIVE_TO_WORKERS', label: 'ABUSIVE_TO_WORKERS' },
  { code: 'FRAUD_SUSPECTED', label: 'FRAUD_SUSPECTED' },
  { code: 'REPEATED_NO_SHOWS', label: 'REPEATED_NO_SHOWS' },
];

/** Which account type each restriction applies to (LLD-020 §6). */
export const RESTRICTION_TYPE_OPTIONS: {
  type: RestrictionType;
  icon: LucideIcon;
  appliesTo: 'CUSTOMER' | 'WORKER';
}[] = [
  { type: 'NO_NEW_REQUESTS', icon: Ban, appliesTo: 'CUSTOMER' },
  { type: 'NO_NEW_OFFERS', icon: Ban, appliesTo: 'WORKER' },
  { type: 'NO_PAYOUTS', icon: Ban, appliesTo: 'WORKER' },
];

/** Reveals left this hour for the signed-in staff member (limit 20/h). */
export const REVEALS_LEFT_THIS_HOUR = 7;
export const REVEALS_PER_HOUR_LIMIT = 20;
