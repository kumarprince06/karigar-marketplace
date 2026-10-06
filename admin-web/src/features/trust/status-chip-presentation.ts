/** Every trust enum → chip label and tone, in one place (one label = one enum value). */
import type { Tone } from '@/components/ui';
import type {
  DisputeActionStatus,
  DisputePriority,
  DisputeStatus,
  ReviewStatus,
  VerificationPriority,
  VerificationStatus,
} from './types';

interface ChipPresentation {
  label: string;
  tone: Tone;
}

export const VERIFICATION_STATUS_CHIP: Record<VerificationStatus, ChipPresentation> = {
  PENDING: { label: 'PENDING', tone: 'warning' },
  IN_REVIEW: { label: 'IN_REVIEW', tone: 'info' },
  VERIFIED: { label: 'VERIFIED', tone: 'success' },
  REJECTED: { label: 'REJECTED', tone: 'error' },
  EXPIRED: { label: 'EXPIRED', tone: 'neutral' },
  REVOKED: { label: 'REVOKED', tone: 'error' },
  SUPERSEDED: { label: 'SUPERSEDED', tone: 'neutral' },
};

export const VERIFICATION_PRIORITY_CHIP: Record<VerificationPriority, ChipPresentation> = {
  1: { label: 'P1 · blocked from all jobs', tone: 'error' },
  2: { label: 'P2 · mandatory', tone: 'warning' },
  3: { label: 'P3 · optional badge', tone: 'neutral' },
};

export const DISPUTE_STATUS_CHIP: Record<DisputeStatus, ChipPresentation> = {
  AWAITING_RESPONSE: { label: 'AWAITING_RESPONSE', tone: 'warning' },
  IN_REVIEW: { label: 'IN_REVIEW', tone: 'info' },
  RESOLVED: { label: 'RESOLVED', tone: 'success' },
  REJECTED: { label: 'REJECTED', tone: 'neutral' },
  WITHDRAWN: { label: 'WITHDRAWN', tone: 'neutral' },
};

export const DISPUTE_PRIORITY_CHIP: Record<DisputePriority, ChipPresentation> = {
  HIGH: { label: 'HIGH', tone: 'error' },
  NORMAL: { label: 'NORMAL', tone: 'neutral' },
};

export const DISPUTE_ACTION_STATUS_CHIP: Record<DisputeActionStatus, ChipPresentation> = {
  PENDING: { label: 'PENDING', tone: 'warning' },
  DONE: { label: 'DONE', tone: 'success' },
  FAILED: { label: 'FAILED', tone: 'error' },
  CANCELLED: { label: 'CANCELLED', tone: 'neutral' },
};

export const REVIEW_STATUS_CHIP: Record<ReviewStatus, ChipPresentation> = {
  PENDING_REVEAL: { label: 'PENDING_REVEAL', tone: 'neutral' },
  PUBLISHED: { label: 'PUBLISHED', tone: 'success' },
  UNDER_MODERATION: { label: 'UNDER_MODERATION', tone: 'warning' },
  HIDDEN: { label: 'HIDDEN', tone: 'neutral' },
  REMOVED: { label: 'REMOVED', tone: 'error' },
};
