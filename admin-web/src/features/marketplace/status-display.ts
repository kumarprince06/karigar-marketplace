import { Bike, Droplets, Siren, Zap, type LucideIcon } from 'lucide-react';
import type { Tone } from '@/components/ui';
import type {
  BookingStatus,
  JobStatus,
  MatchingRunStatus,
  MaterialBillStatus,
  PaymentStatus,
  QuoteStatus,
  RequestStatus,
  RequestUrgency,
  Trade,
  VisitConfirmedBy,
  VisitStatus,
} from './types';

interface StatusAppearance {
  tone: Tone;
  icon?: LucideIcon;
}

/**
 * Every marketplace enum maps to its chip appearance, in one place. The chip label is always the enum value itself
 * (one label = one enum value), so request, booking, job and visit never merge into one status (ADR 0009).
 */
export const STATUS_APPEARANCE = {
  request: {
    PENDING_PAYMENT: { tone: 'warning' },
    SUBMITTED: { tone: 'info' },
    MATCHING: { tone: 'info' },
    AWAITING_SELECTION: { tone: 'brand' },
    BOOKED: { tone: 'success' },
    COMPLETED: { tone: 'success' },
    CANCELLED: { tone: 'neutral' },
    EXPIRED: { tone: 'neutral' },
    FAILED_TO_MATCH: { tone: 'error' },
  } satisfies Record<RequestStatus, StatusAppearance>,
  urgency: {
    EMERGENCY: { tone: 'error', icon: Siren },
    NOW: { tone: 'info' },
    TODAY: { tone: 'neutral' },
    SCHEDULED: { tone: 'neutral' },
  } satisfies Record<RequestUrgency, StatusAppearance>,
  matchingRun: {
    RUNNING: { tone: 'info' },
    WAITING_SELECTION: { tone: 'brand' },
    FAILED: { tone: 'error' },
    STOPPED: { tone: 'neutral' },
  } satisfies Record<MatchingRunStatus, StatusAppearance>,
  booking: {
    CONFIRMED: { tone: 'brand' },
    COMPLETED: { tone: 'success' },
    CANCELLED: { tone: 'neutral' },
  } satisfies Record<BookingStatus, StatusAppearance>,
  job: {
    SCHEDULED: { tone: 'neutral' },
    IN_PROGRESS: { tone: 'info' },
    ON_HOLD: { tone: 'warning' },
    WORK_COMPLETED: { tone: 'warning' },
    COMPLETED: { tone: 'success' },
    CANCELLED: { tone: 'neutral' },
    FAILED: { tone: 'error' },
  } satisfies Record<JobStatus, StatusAppearance>,
  visit: {
    SCHEDULED: { tone: 'neutral' },
    EN_ROUTE: { tone: 'accent', icon: Bike },
    ARRIVED: { tone: 'info' },
    IN_PROGRESS: { tone: 'info' },
    DONE: { tone: 'success' },
    WORKER_NO_SHOW: { tone: 'error' },
    CUSTOMER_NO_SHOW: { tone: 'error' },
    RESCHEDULED: { tone: 'neutral' },
    CANCELLED: { tone: 'neutral' },
  } satisfies Record<VisitStatus, StatusAppearance>,
  visitConfirmation: {
    CUSTOMER: { tone: 'success' },
    SYSTEM: { tone: 'neutral' },
  } satisfies Record<VisitConfirmedBy, StatusAppearance>,
  quote: {
    SUBMITTED: { tone: 'info' },
    ACCEPTED: { tone: 'success' },
    REJECTED: { tone: 'error' },
    EXPIRED: { tone: 'neutral' },
    SUPERSEDED: { tone: 'neutral' },
    WITHDRAWN: { tone: 'neutral' },
  } satisfies Record<QuoteStatus, StatusAppearance>,
  materialBill: {
    COVERED: { tone: 'success' },
    PENDING_ACK: { tone: 'warning' },
    ACKNOWLEDGED: { tone: 'success' },
    EXCESS_REJECTED: { tone: 'error' },
    VOID: { tone: 'neutral' },
  } satisfies Record<MaterialBillStatus, StatusAppearance>,
  payment: {
    PENDING: { tone: 'warning' },
    SUCCEEDED: { tone: 'success' },
    FAILED: { tone: 'error' },
  } satisfies Record<PaymentStatus, StatusAppearance>,
} as const;

export type StatusKind = keyof typeof STATUS_APPEARANCE;
export type StatusValue<Kind extends StatusKind> = keyof (typeof STATUS_APPEARANCE)[Kind] & string;

export const TRADE_ICONS: Record<Trade, LucideIcon> = { ELECTRICIAN: Zap, PLUMBER: Droplets };
export const TRADE_LABELS: Record<Trade, string> = { ELECTRICIAN: 'Electrician', PLUMBER: 'Plumber' };
