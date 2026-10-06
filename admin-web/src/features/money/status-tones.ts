import type {
  DisputeStatus,
  PaymentStatus,
  PayoutAccountStatus,
  PayoutStatus,
  RefundStatus,
  StatusTones,
} from './types';

/* The one place each money enum gets its chip tone. The label is the enum value (no invented wording). */

export const PAYMENT_STATUS_TONES: StatusTones<PaymentStatus> = {
  CREATED: 'neutral',
  PENDING: 'warning',
  SUCCEEDED: 'success',
  FAILED: 'error',
  CANCELLED: 'neutral',
  DISPUTED: 'error',
};

export const REFUND_STATUS_TONES: StatusTones<RefundStatus> = {
  REQUESTED: 'neutral',
  PROCESSING: 'info',
  SUCCEEDED: 'success',
  FAILED: 'error',
};

export const PAYOUT_ACCOUNT_STATUS_TONES: StatusTones<PayoutAccountStatus> = {
  PENDING_VERIFICATION: 'neutral',
  NEEDS_REVIEW: 'warning',
  ACTIVE: 'success',
  DISABLED: 'error',
};

export const PAYOUT_STATUS_TONES: StatusTones<PayoutStatus> = {
  QUEUED: 'neutral',
  PROCESSING: 'info',
  PAID: 'success',
  FAILED: 'error',
  REVERSED: 'warning',
};

export const DISPUTE_STATUS_TONES: StatusTones<DisputeStatus> = {
  AWAITING_RESPONSE: 'warning',
  IN_REVIEW: 'info',
  RESOLVED: 'success',
};
