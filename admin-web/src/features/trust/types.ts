/** Domain types for verifications (LLD-016), disputes (LLD-018) and review moderation (LLD-012). */
import type { LucideIcon } from 'lucide-react';
import type { Paise } from '@/lib/formatters';

/* ---------- Verifications ---------- */
export type VerificationStatus =
  'PENDING' | 'IN_REVIEW' | 'VERIFIED' | 'REJECTED' | 'EXPIRED' | 'REVOKED' | 'SUPERSEDED';

export type VerificationCheckType =
  'ID_PROOF' | 'PAN' | 'POLICE_VERIFICATION' | 'SKILL_CERTIFICATE' | 'ELECTRICAL_LICENSE';

/** 1 blocked from all jobs → 2 mandatory → 3 optional badge (LLD-016 D10). */
export type VerificationPriority = 1 | 2 | 3;

export type IdentityDocumentKind = 'VOTER_ID' | 'DRIVING_LICENCE' | 'PASSPORT';

export const VERIFICATION_REJECT_REASONS = [
  'BLURRY_IMAGE',
  'DOCUMENT_INCOMPLETE',
  'WRONG_DOCUMENT_TYPE',
  'NAME_MISMATCH',
  'FACE_MISMATCH',
  'NUMBER_MISMATCH',
  'EXPIRED_DOCUMENT',
  'UNDERAGE',
  'DUPLICATE_DOCUMENT',
  'SUSPECTED_FORGERY',
  'OTHER',
] as const;
export type VerificationRejectReason = (typeof VERIFICATION_REJECT_REASONS)[number];

export interface Trade {
  icon: LucideIcon;
  label: string;
}

export interface VerificationQueueRow {
  id: string;
  workerId: string;
  workerName: string;
  priority: VerificationPriority;
  checkType: VerificationCheckType;
  documentIcon: LucideIcon;
  documentLabel: string;
  trade?: Trade;
  submittedHoursAgo: number;
  attemptLabel: string;
  /** Shown faint after the attempt, e.g. "(30 d)". */
  attemptHint?: string;
  status: VerificationStatus;
  claimedBy?: string;
}

export interface VerificationDocument {
  id: string;
  caption: string;
  icon: LucideIcon;
  /** Seconds left on the 60 s signed view link; absent when no link is open. */
  linkSecondsLeft?: number;
}

export interface VerificationCheckHistoryRow {
  id: string;
  checkLabel: string;
  tradeIcon?: LucideIcon;
  documentIcon: LucideIcon;
  documentLabel: string;
  status: VerificationStatus;
  revokeRequested?: boolean;
  rejectReason?: VerificationRejectReason;
  decidedOn: string;
  validUntil: string;
  reviewer: string;
}

export interface RevocationRequest {
  checkLabel: string;
  requestedBy: string;
  requestedAt: string;
  reasonCode: 'SAFETY_COMPLAINT' | 'SUSPECTED_FORGERY' | 'REVIEWER_ERROR' | 'OTHER';
  note: string;
  consequence: string;
}

export interface VerificationReview {
  id: string;
  workerId: string;
  workerName: string;
  checkType: VerificationCheckType;
  status: VerificationStatus;
  claimedMinutesAgo: number;
  priority: VerificationPriority;
  attemptNumber: number;
  maxAttempts: number;
  previousRejectReason?: VerificationRejectReason;
  previousAttemptOn?: string;
  waitingHours: number;
  duplicateOf?: {
    workerId: string;
    workerName: string;
    checkType: VerificationCheckType;
    verifiedOn: string;
  };
  documents: readonly VerificationDocument[];
  bankHolderName: string;
  version: number;
  typed: {
    documentKind: IdentityDocumentKind;
    nameOnCard: string;
    yearOfBirth: number;
    maskedNumber: string;
  };
  /** What the reviewer has typed so far (static design pre-fill). */
  reviewerDraft: { nameOnCard: string; documentNumber: string; issuedOn: string };
  checkHistory: readonly VerificationCheckHistoryRow[];
  revocationRequest: RevocationRequest;
}

/* ---------- Disputes ---------- */
export type DisputeStatus = 'AWAITING_RESPONSE' | 'IN_REVIEW' | 'RESOLVED' | 'REJECTED' | 'WITHDRAWN';
export type DisputePriority = 'HIGH' | 'NORMAL';
export const DISPUTE_CATEGORIES = [
  'WORK_NOT_DONE',
  'POOR_QUALITY',
  'OVERCHARGED',
  'CASH_NOT_PAID',
  'NO_SHOW_DISAGREEMENT',
  'DAMAGE',
  'BEHAVIOUR',
  'OTHER',
] as const;
export type DisputeCategory = (typeof DISPUTE_CATEGORIES)[number];
export type DisputeOutcome = 'UPHELD' | 'PARTIALLY_UPHELD' | 'NOT_UPHELD';
export type DisputeAtFault = 'WORKER' | 'CUSTOMER' | 'BOTH' | 'NONE';
export type DisputeActionType =
  'REFUND' | 'WORKER_STRIKE' | 'ADJUST_VISIT' | 'REVOKE_STRIKE' | 'CASH_CONFIRM_PAID';
export type DisputeActionStatus = 'PENDING' | 'DONE' | 'FAILED' | 'CANCELLED';

export interface DisputeSubject {
  kind: 'JOB' | 'PAYMENT' | 'VISIT';
  id: string;
  /** e.g. "#1" for a visit, "cash" for a payment. */
  detail?: string;
}

export interface DisputeQueueRow {
  id: string;
  priority: DisputePriority;
  category: DisputeCategory;
  subject: DisputeSubject;
  openedBy: string;
  status: DisputeStatus;
  respondentAnswer: string;
  assignee?: string;
  age: string;
}

export interface DisputeStatementEvent {
  id: string;
  party: 'CUSTOMER' | 'WORKER' | 'AGENT';
  author?: string;
  at?: string;
  text?: string;
  photos?: number;
  videos?: number;
}

export interface SummaryRow {
  label: string;
  value: string;
  /** Shown before the value, e.g. a check for "within range" or a camera for photos. */
  icon?: LucideIcon;
}

export interface DisputePayment {
  label: string;
  paymentId?: string;
  amountPaise: Paise;
  status: 'SUCCEEDED' | 'FAILED' | 'PENDING';
}

export interface DraftDisputeAction {
  id: string;
  type: DisputeActionType;
  detail: string;
  amountPaise?: Paise;
}

interface DisputeBase {
  id: string;
  category: DisputeCategory;
  priority: DisputePriority;
  subjectLabel: string;
  subjectId: string;
}

export interface OpenDispute extends DisputeBase {
  status: 'AWAITING_RESPONSE' | 'IN_REVIEW';
  assignedToMe: boolean;
  customerName: string;
  workerName: string;
  openedSummary: string;
  statements: readonly DisputeStatementEvent[];
  systemEvidence: readonly SummaryRow[];
  jobStatus: string;
  billPaise: Paise;
  payments: readonly DisputePayment[];
  refundableOnlinePaise: Paise;
  partyHistory: readonly string[];
  internalNotes: readonly { id: string; author: string; text: string }[];
  draftDecision: {
    outcome: DisputeOutcome;
    atFault: DisputeAtFault;
    actions: readonly DraftDisputeAction[];
    summary: string;
  };
}

export interface ResolvedDisputeAction {
  id: string;
  type: DisputeActionType;
  amountPaise?: Paise;
  description: string;
  referenceId: string;
  status: DisputeActionStatus;
  attempts: string;
  lastError?: string;
  nextAttemptAt?: string;
}

export interface ResolvedDispute extends DisputeBase {
  status: 'RESOLVED';
  outcome: DisputeOutcome;
  atFault: DisputeAtFault;
  closedBy: string;
  closedAt: string;
  actions: readonly ResolvedDisputeAction[];
}

export type DisputeRecord = OpenDispute | ResolvedDispute;

/* ---------- Reviews ---------- */
export type ReviewStatus = 'PENDING_REVEAL' | 'PUBLISHED' | 'UNDER_MODERATION' | 'HIDDEN' | 'REMOVED';
export type ReviewModerationQueue = 'MODERATION' | 'REPORTED';

export const REVIEW_MODERATION_REASONS = [
  'CONTACT_DETAILS',
  'ABUSIVE_LANGUAGE',
  'HATE_SPEECH',
  'NOT_ABOUT_JOB',
  'FAKE_OR_COLLUSION',
  'EXTORTION',
  'DISPUTE_OUTCOME',
  'OTHER',
] as const;
export type ReviewModerationReason = (typeof REVIEW_MODERATION_REASONS)[number];

export interface ModeratedReview {
  id: string;
  queue: ReviewModerationQueue;
  rating: number;
  direction: 'CUSTOMER_TO_WORKER' | 'WORKER_TO_CUSTOMER';
  authorName: string;
  targetName: string;
  jobId: string;
  status: ReviewStatus;
  flagReason?: ReviewModerationReason;
  text: string;
  language: 'en' | 'bn' | 'hi';
  flaggedPhrases: readonly string[];
  workerReply?: { text: string; flaggedPhrases: readonly string[] };
  reports?: { count: number; reason: ReviewModerationReason; onReply: boolean };
  moderatorNote?: string;
}
