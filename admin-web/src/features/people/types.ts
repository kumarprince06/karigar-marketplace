import type { LucideIcon } from 'lucide-react';
import type { Paise } from '@/lib/formatters';

export type AccountStatus = 'ONBOARDING' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
export type ProfileType = 'CUSTOMER' | 'WORKER';
export type UserTypeFilter = 'ALL' | ProfileType;

export type RestrictionType = 'NO_NEW_REQUESTS' | 'NO_NEW_OFFERS' | 'NO_PAYOUTS';
export type RestrictionSource = 'ADMIN' | 'FRAUD' | 'STRIKES' | 'DUES';

/** Fields a reveal can ask for (POST /admin/users/{userId}/reveal). */
export type RevealableField = 'PHONE' | 'EMAIL' | 'ADDRESSES';

/** A reason code from the API-driven reason_codes table. */
export interface ReasonCodeOption {
  code: string;
  label: string;
}

/** One masked row of GET /admin/users?q=&type=. Full phone / email are kept only so the mock can match exactly. */
export interface UserSearchResult {
  id: string;
  name: string;
  profileTypes: ProfileType[];
  phone: string;
  email: string;
  area: string;
  accountStatus: AccountStatus;
  openDisputeCount: number;
  restrictions: RestrictionType[];
}

export interface AuditEventSummary {
  id: string;
  occurredAt: string;
  actorName: string;
  action: string;
  reasonCode?: string;
}

export interface CustomerBookingSummary {
  id: string;
  tradeIcon: LucideIcon;
  problem: string;
  workerName: string;
  firstVisitAt: string;
  bookingStatus: string;
  jobStatus: string;
  visitStatus: string;
}

export interface CustomerAddress {
  id: string;
  icon: LucideIcon;
  label: string;
  locality: string;
  pinCode: string;
  /** Only shown after a reveal that included ADDRESSES. */
  fullAddress: string;
}

export interface CustomerDetail {
  id: string;
  name: string;
  initials: string;
  accountStatus: AccountStatus;
  phone: string;
  email: string;
  joinedOn: string;
  language: string;
  platform: string;
  bookings: CustomerBookingSummary[];
  requestCount: number;
  auditEventCount: number;
  reviewsWrittenCount: number;
  addresses: CustomerAddress[];
  recentAuditEvents: AuditEventSummary[];
  liveRestrictionCount: number;
  lastLiftedRestriction?: string;
  openDispute?: {
    id: string;
    status: string;
    reasonCode: string;
    scope: string;
    bookingId: string;
  };
}

export interface WorkerTrade {
  icon: LucideIcon;
  name: string;
  ratePaise: Paise;
  rateUnit: string;
  experienceYears: number;
  status: string;
  isJobEligible: boolean;
}

export interface VerificationCheck {
  name: string;
  optionalNote?: string;
  status: string;
  statusDetail?: string;
}

export interface WorkerStrike {
  type: string;
  issuedOn: string;
  source: string;
  points: number;
  status: 'ACTIVE' | 'REVOKED';
}

export interface WorkerRestriction {
  type: RestrictionType;
  source: RestrictionSource;
}

export interface ConfirmedBookingSummary {
  id: string;
  startsAt: string;
  visitStatus?: string;
}

export interface WorkerDetail {
  id: string;
  name: string;
  initials: string;
  accountStatus: AccountStatus;
  verificationStatus: 'UNVERIFIED' | 'PARTIAL' | 'VERIFIED';
  pendingVerificationCount: number;
  availability: string;
  phone: string;
  email: string;
  rating: number;
  reviewCount: number;
  language: string;
  baseLocality: string;
  radiusKm: number;
  trades: WorkerTrade[];
  verificationChecks: VerificationCheck[];
  strikes: WorkerStrike[];
  restrictions: WorkerRestriction[];
  ledgerBalancePaise: Paise;
  duesLimitPaise: Paise;
  payoutAccount: { status: string; lastFourDigits: string };
  payoutHold?: string;
  confirmedBookings: ConfirmedBookingSummary[];
}
