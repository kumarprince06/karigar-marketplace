import type { LucideIcon } from 'lucide-react';
import type { Tone } from '@/components/ui';
import type { Paise } from '@/lib/formatters';

/* ---------- Enums (LLD-006, LLD-007, LLD-009, LLD-011, LLD-017) ---------- */

export type Trade = 'ELECTRICIAN' | 'PLUMBER';

export type RequestStatus =
  | 'PENDING_PAYMENT'
  | 'SUBMITTED'
  | 'MATCHING'
  | 'AWAITING_SELECTION'
  | 'BOOKED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'FAILED_TO_MATCH';

export type RequestUrgency = 'NOW' | 'TODAY' | 'SCHEDULED' | 'EMERGENCY';

export type MatchingRunStatus = 'RUNNING' | 'WAITING_SELECTION' | 'FAILED' | 'STOPPED';

export type BookingStatus = 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

export type JobStatus =
  'SCHEDULED' | 'IN_PROGRESS' | 'ON_HOLD' | 'WORK_COMPLETED' | 'COMPLETED' | 'CANCELLED' | 'FAILED';

export type VisitStatus =
  | 'SCHEDULED'
  | 'EN_ROUTE'
  | 'ARRIVED'
  | 'IN_PROGRESS'
  | 'DONE'
  | 'WORKER_NO_SHOW'
  | 'CUSTOMER_NO_SHOW'
  | 'RESCHEDULED'
  | 'CANCELLED';

export type VisitConfirmedBy = 'CUSTOMER' | 'SYSTEM';

export type QuoteStatus = 'SUBMITTED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'SUPERSEDED' | 'WITHDRAWN';

export type MaterialBillStatus = 'COVERED' | 'PENDING_ACK' | 'ACKNOWLEDGED' | 'EXCESS_REJECTED' | 'VOID';

export type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED';

export type BookingType = 'SINGLE_VISIT' | 'MULTI_DAY';

/* ---------- Requests (A-03a) ---------- */

/** Advance state, joined from payments + refunds (LLD-011). */
export type RequestAdvance =
  | { state: 'DUE'; dueAt: string }
  | { state: 'PAID'; amount: Paise }
  | { state: 'NOT_PAID' }
  | { state: 'REFUND_PROCESSING' }
  | { state: 'REFUNDED'; amount: Paise };

export interface MatchingRunSummary {
  status: MatchingRunStatus;
  /** Shown after the status, e.g. "round 3", "favourite", "attempt 2". */
  detail?: string;
  radiusKm?: number;
  offeredCount: number;
  interestedCount: number;
}

export interface MarketplaceRequest {
  id: string;
  createdAt: string;
  trade: Trade;
  title: string;
  area: string;
  urgency: RequestUrgency;
  advance: RequestAdvance;
  status: RequestStatus;
  matchingRun: MatchingRunSummary | null;
}

export interface MatchingRound {
  round: number;
  radiusKm: number;
  startedAt: string;
  offeredCount: number;
  /** null while the round is still waiting for answers. */
  interestedCount: number | null;
}

/** Extra detail for the request shown in the side rail. */
export interface RequestDetail {
  request: MarketplaceRequest;
  customerId: string;
  customerName: string;
  customerPhoneMasked: string;
  attentionMessage: string;
  window: string;
  priceGuide: { min: Paise; max: Paise };
  advanceDescription: string;
  media: { photoCount: number; voiceNoteCount: number };
  rounds: readonly MatchingRound[];
}

/* ---------- Bookings (A-03b) ---------- */

export interface BookingSignal {
  label: string;
  icon?: LucideIcon;
  /** Without a tone the signal is plain muted text. */
  tone?: Tone;
  kind?: 'late' | 'dispute';
  /** Dispute signals link to the dispute. */
  disputeId?: string;
}

export interface BookingSummary {
  id: string;
  trade: Trade;
  title: string;
  customerName: string;
  workerName: string;
  type: BookingType;
  nextVisit: string | null;
  bookingStatus: BookingStatus;
  jobStatus: JobStatus;
  visitStatus: VisitStatus;
  visitDetail?: string;
  signal: BookingSignal | null;
}

/* ---------- Booking detail (A-03c) ---------- */

export interface BookingVisit {
  id: string;
  number: number;
  date: string;
  visitType: 'FULL_DAY' | 'HALF_DAY' | 'TASK';
  status: VisitStatus;
  onMyWay: { at: string; etaMinutes: number } | null;
  checkIn: { at: string; distanceMetres: number; flagged: boolean } | null;
  startCode: { attempts: number; maxAttempts: number; verifiedAt: string | null };
  checkOutAt: string | null;
  labour: { labourPaise: Paise; helperPaise: Paise } | null;
  confirmedBy: VisitConfirmedBy | null;
}

export interface ExtraWorkQuote {
  id: string;
  description: string;
  amount: Paise;
  amountNote?: string;
  status: QuoteStatus;
}

export interface MaterialBill {
  id: string;
  description: string;
  amount: Paise;
  /** Amount above the accepted quote, if any. */
  overQuote?: Paise;
  status: MaterialBillStatus;
}

export interface BillLine {
  label: string;
  amount: Paise;
  isTotal?: boolean;
}

export interface BookingPayment {
  id: string;
  purpose: 'BOOKING_ADVANCE' | 'DAILY_WAGE' | 'FINAL_SETTLEMENT';
  method: 'UPI' | 'CASH' | 'CARD';
  note?: string;
  amount: Paise;
  status: PaymentStatus;
}

export interface BookingTimelineEvent {
  title: string;
  at: string;
  note?: string;
  isCurrent?: boolean;
}

export interface CancellationPreview {
  cancelledBy: 'ADMIN';
  customerPays: Paise;
  advance: Paise;
  advanceOutcome: string;
  workerGets: Paise;
  strike: string;
  requestOutcome: string;
}

export interface BookingDetail {
  summary: BookingSummary;
  heroTitle: string;
  currentVisitNumber: number;
  payCadence: 'DAILY' | 'ON_COMPLETION';
  requestId: string;
  offeredCount: number;
  interestedCount: number;
  customer: { id: string; name: string; phoneMasked: string; area: string };
  worker: { id: string; name: string; rating: number; phoneMasked: string; verification: string };
  agreedRate: { amount: Paise; unit: string; helperAmount: Paise; helperUnit: string };
  visits: readonly BookingVisit[];
  quotes: readonly ExtraWorkQuote[];
  materialBills: readonly MaterialBill[];
  bill: readonly BillLine[];
  payments: readonly BookingPayment[];
  timeline: readonly BookingTimelineEvent[];
  /** Short description of the next visit for the cancel dialog. */
  nextVisitDescription: string;
  cancellationPreview: CancellationPreview;
}

export interface CancelReason {
  code: string;
  label: string;
}
