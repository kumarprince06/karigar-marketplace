import type { Tone } from '@/components/ui';
import type { Paise } from '@/lib/formatters';
import type { SplitLine } from './calculate-pro-rata-refund';

/* Enums from LLD-010 / LLD-011 / LLD-019. The chip label is always the enum value itself. */

export type PaymentStatus = 'CREATED' | 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'DISPUTED';
export type PaymentPurpose =
  'BOOKING_ADVANCE' | 'VISIT_CHARGE' | 'DAILY_WAGE' | 'MILESTONE' | 'FINAL' | 'ADDITIONAL' | 'WORKER_DUES';
export type PaymentMethod = 'UPI' | 'CARD' | 'NETBANKING' | 'WALLET' | 'CASH';
export type RefundStatus = 'REQUESTED' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
export type PayoutAccountStatus = 'PENDING_VERIFICATION' | 'NEEDS_REVIEW' | 'ACTIVE' | 'DISABLED';
export type PayoutStatus = 'QUEUED' | 'PROCESSING' | 'PAID' | 'FAILED' | 'REVERSED';
export type DisputeStatus = 'AWAITING_RESPONSE' | 'IN_REVIEW' | 'RESOLVED';
export type LedgerTransactionType = 'CASH_COLLECTED' | 'DUES_RECEIVED' | 'ADJUSTMENT';
export type AdjustmentDirection = 'CREDIT' | 'DEBIT';

export type StatusTones<Status extends string> = Record<Status, Tone>;

export interface Refund {
  id: string;
  amountPaise: Paise;
  status: RefundStatus;
  initiatedBy: 'ADMIN' | 'SYSTEM';
  createdAtLabel: string;
}

/** What a payment was for: a booking (job), a request (advance) or a worker (dues). */
export type PaymentSubject =
  | { kind: 'booking'; id: string }
  | { kind: 'request'; id: string }
  | { kind: 'worker'; id: string; name: string };

export interface Payment {
  id: string;
  createdAtLabel: string;
  purpose: PaymentPurpose;
  method: PaymentMethod;
  amountPaise: Paise;
  status: PaymentStatus;
  refunds: readonly Refund[];
  subject: PaymentSubject;
  payerName: string;
  payerMaskedHandle: string;
  providerReference: string;
  capturedLabel: string;
  /** The provider's webhook confirmed the capture. */
  webhookConfirmed?: boolean;
  /** Original split of the payment, reversed pro-rata on refund. Comes from the server. */
  splitLines: readonly SplitLine[];
  /** Worker who earned from this payment, if they were already paid out (refund may push them negative). */
  paidOutWorker?: { name: string; balancePaise: Paise };
}

export interface StuckRefund {
  id: string;
  paymentId: string;
  paymentMethod: PaymentMethod;
  amountPaise: Paise;
  reasonCode: string;
  status: RefundStatus;
  ageLabel: string;
  failure: string;
}

export interface ParkedProviderEvent {
  id: string;
  provider: string;
  eventType: string;
  receivedLabel: string;
  attempts: number;
  processingError: string;
  acknowledgement?: 'NO_ACTION' | 'HANDLED_ELSEWHERE';
}

export interface DisputedCashPayment {
  paymentId: string;
  bookingId: string;
  amountPaise: Paise;
  workerMarkedLabel: string;
  customerSays: string;
  disputeId: string;
  disputeStatus: DisputeStatus;
  ageLabel: string;
}

export interface PayoutAccount {
  id: string;
  workerId: string;
  workerName: string;
  accountLastFour: string;
  ifsc: string;
  bankReturnedName: string;
  nameMatchScore: number;
  pennyDropSucceeded: boolean;
  status: PayoutAccountStatus;
  addedLabel: string;
}

export interface Payout {
  id: string;
  workerName: string;
  amountPaise: Paise;
  status: PayoutStatus;
  batchLabel: string;
  failure?: string;
}

export interface PayoutHold {
  workerId: string;
  workerName: string;
  reasonCode: string;
  note: string;
  placedLabel: string;
}

export interface LedgerEntry {
  id: string;
  whenLabel: string;
  transaction: LedgerTransactionType;
  reference: { label: string; id: string };
  direction: 'Dr' | 'Cr';
  amountPaise: Paise;
  postedBy: string;
}

export interface WorkerLedger {
  workerId: string;
  workerName: string;
  openingBalanceLabel: string;
  openingBalancePaise: Paise;
  duesLimitPaise: Paise;
  cashWithWorkerLast30DaysPaise: Paise;
  earningsOnHoldPaise: Paise;
  /** Oldest first; the table shows newest first. */
  entries: readonly LedgerEntry[];
}
