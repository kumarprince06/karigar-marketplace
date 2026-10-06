/** Typed mock records for the trust screens. Replace these reads with API calls later. */
import { Camera, Check } from 'lucide-react';
import { DEMO_IDS } from '@/mocks/demo-ids';
import { DOCUMENT_ICON, TRADE_ICON } from './trust-icons';
import type {
  DisputeQueueRow,
  DisputeRecord,
  ModeratedReview,
  OpenDispute,
  ResolvedDispute,
  VerificationQueueRow,
  VerificationReview,
} from './types';

const mockId = (suffix: string) => `01928f6e-7c1a-7b3e-9d2f-${suffix.padStart(12, '0')}`;

/* ---------- A-04a ---------- */
export const VERIFICATION_QUEUE_SUMMARY = {
  pendingCount: 14,
  inReviewCount: 3,
  decidedTodayCount: 22,
  oldestHours: 51,
  blockedFromAllJobsCount: 5,
  mineInReviewCount: 1,
};

/** Waiting longer than this is over the hard SLA (24 h P90 · 48 h max). */
export const VERIFICATION_MAX_WAIT_HOURS = 48;

export const VERIFICATION_QUEUE: readonly VerificationQueueRow[] = [
  {
    id: DEMO_IDS.verification,
    workerId: mockId('a1b291c0aa'),
    workerName: 'Rakesh Das',
    priority: 1,
    checkType: 'ID_PROOF',
    documentIcon: DOCUMENT_ICON.VOTER_ID,
    documentLabel: 'VOTER_ID + selfie',
    submittedHoursAgo: 51,
    attemptLabel: '2 of 3',
    attemptHint: '(30 d)',
    status: 'PENDING',
  },
  {
    id: mockId('b10a20be5f9'),
    workerId: mockId('c2a40be5f9'),
    workerName: 'Abdul Hossain',
    priority: 1,
    checkType: 'ID_PROOF',
    documentIcon: DOCUMENT_ICON.PASSPORT,
    documentLabel: 'PASSPORT + selfie',
    submittedHoursAgo: 26,
    attemptLabel: '1',
    status: 'IN_REVIEW',
    claimedBy: 'Anita',
  },
  {
    id: mockId('b10a3077d0b2'),
    workerId: mockId('c2a477d0b2'),
    workerName: 'Mitali Pal',
    priority: 2,
    checkType: 'ELECTRICAL_LICENSE',
    documentIcon: DOCUMENT_ICON.ELECTRICAL_LICENSE,
    documentLabel: 'ELECTRICAL_LICENSE',
    trade: { icon: TRADE_ICON.Electrician, label: 'Electrician' },
    submittedHoursAgo: 20,
    attemptLabel: '1',
    status: 'PENDING',
  },
  {
    id: mockId('b10a408c03d2'),
    workerId: mockId('c2a48c03d2'),
    workerName: 'Sujit Das',
    priority: 2,
    checkType: 'PAN',
    documentIcon: DOCUMENT_ICON.PAN_CARD,
    documentLabel: 'PAN_CARD',
    submittedHoursAgo: 19,
    attemptLabel: '1',
    status: 'PENDING',
  },
  {
    id: mockId('b10a50e55b10'),
    workerId: mockId('c2a4e55b10'),
    workerName: 'Rintu Sk',
    priority: 2,
    checkType: 'ID_PROOF',
    documentIcon: DOCUMENT_ICON.DRIVING_LICENCE,
    documentLabel: 'DRIVING_LICENCE + selfie',
    submittedHoursAgo: 9,
    attemptLabel: '1',
    status: 'PENDING',
  },
  {
    id: mockId('b10a606d19f4'),
    workerId: mockId('c2a46d19f4'),
    workerName: 'Rinku Paul',
    priority: 3,
    checkType: 'POLICE_VERIFICATION',
    documentIcon: DOCUMENT_ICON.POLICE_CERTIFICATE,
    documentLabel: 'POLICE_CERTIFICATE',
    submittedHoursAgo: 6,
    attemptLabel: '1 · renewal',
    status: 'PENDING',
  },
  {
    id: mockId('b10a704a7e21'),
    workerId: mockId('c2a44a7e21'),
    workerName: 'Pradip Saha',
    priority: 3,
    checkType: 'SKILL_CERTIFICATE',
    documentIcon: DOCUMENT_ICON.SKILL_CERTIFICATE,
    documentLabel: 'SKILL_CERTIFICATE',
    trade: { icon: TRADE_ICON.Plumber, label: 'Plumber' },
    submittedHoursAgo: 2,
    attemptLabel: '1',
    status: 'PENDING',
  },
];

/* ---------- A-04b, A-04c ---------- */
const DEMO_VERIFICATION_REVIEW: VerificationReview = {
  id: DEMO_IDS.verification,
  workerId: DEMO_IDS.worker,
  workerName: 'Rakesh Das',
  checkType: 'ID_PROOF',
  status: 'IN_REVIEW',
  claimedMinutesAgo: 4,
  priority: 1,
  attemptNumber: 2,
  maxAttempts: 3,
  previousRejectReason: 'BLURRY_IMAGE',
  previousAttemptOn: '2 Oct',
  waitingHours: 51,
  duplicateOf: {
    workerId: mockId('d3e47c21e0'),
    workerName: 'Ratan Das',
    checkType: 'ID_PROOF',
    verifiedOn: '3 Aug',
  },
  documents: [
    {
      id: mockId('e5f6a0000001'),
      caption: 'FRONT · VOTER_ID',
      icon: DOCUMENT_ICON.VOTER_ID,
      linkSecondsLeft: 42,
    },
    { id: mockId('e5f6a0000002'), caption: 'BACK', icon: DOCUMENT_ICON.VOTER_ID },
    {
      id: mockId('e5f6a0000003'),
      caption: 'SELFIE with document',
      icon: DOCUMENT_ICON.SELFIE,
      linkSecondsLeft: 51,
    },
  ],
  bankHolderName: 'RAKESH KUMAR DAS',
  version: 3,
  typed: {
    documentKind: 'VOTER_ID',
    nameOnCard: 'Rakesh Das',
    yearOfBirth: 1991,
    maskedNumber: 'XXXXXX4821',
  },
  reviewerDraft: { nameOnCard: 'RAKESH DAS', documentNumber: 'WBX1234821', issuedOn: '14 Jan 2019' },
  checkHistory: [
    {
      id: mockId('f7a800000001'),
      checkLabel: 'ELECTRICAL_LICENSE',
      tradeIcon: TRADE_ICON.Electrician,
      documentIcon: DOCUMENT_ICON.ELECTRICAL_LICENSE,
      documentLabel: '…0937',
      status: 'VERIFIED',
      revokeRequested: true,
      decidedOn: '12 Mar',
      validUntil: '03/2028',
      reviewer: 'Anita Roy',
    },
    {
      id: mockId('f7a800000002'),
      checkLabel: 'ID_PROOF',
      documentIcon: DOCUMENT_ICON.VOTER_ID,
      documentLabel: 'VOTER_ID …4821',
      status: 'VERIFIED',
      decidedOn: '10 Mar',
      validUntil: '—',
      reviewer: 'Neha Gupta',
    },
    {
      id: mockId('f7a800000003'),
      checkLabel: 'ID_PROOF',
      documentIcon: DOCUMENT_ICON.VOTER_ID,
      documentLabel: 'VOTER_ID …4821',
      status: 'REJECTED',
      rejectReason: 'BLURRY_IMAGE',
      decidedOn: '8 Mar',
      validUntil: '—',
      reviewer: 'Neha Gupta',
    },
    {
      id: mockId('f7a800000004'),
      checkLabel: 'PAN',
      documentIcon: DOCUMENT_ICON.PAN_CARD,
      documentLabel: 'ABXXXXX34F',
      status: 'PENDING',
      decidedOn: '—',
      validUntil: '—',
      reviewer: '—',
    },
    {
      id: mockId('f7a800000005'),
      checkLabel: 'POLICE_VERIFICATION',
      documentIcon: DOCUMENT_ICON.POLICE_CERTIFICATE,
      documentLabel: 'Shibpur PS',
      status: 'EXPIRED',
      decidedOn: '2 Feb 2024',
      validUntil: '02/2026',
      reviewer: 'SYSTEM',
    },
    {
      id: mockId('f7a800000006'),
      checkLabel: 'SKILL_CERTIFICATE',
      tradeIcon: TRADE_ICON.Electrician,
      documentIcon: DOCUMENT_ICON.SKILL_CERTIFICATE,
      documentLabel: 'ITI Howrah',
      status: 'SUPERSEDED',
      decidedOn: '1 Jan 2025',
      validUntil: '—',
      reviewer: 'Anita Roy',
    },
  ],
  revocationRequest: {
    checkLabel: 'ELECTRICAL_LICENSE · Electrician',
    requestedBy: 'Anita Roy',
    requestedAt: 'today 09:12',
    reasonCode: 'SAFETY_COMPLAINT',
    note: 'Licence number reported cancelled by issuer (ref WB-ELC-22).',
    consequence: 'Rakesh loses Electrician jobs eligibility at once; booked jobs are not cancelled.',
  },
};

const VERIFICATION_REVIEWS: readonly VerificationReview[] = [DEMO_VERIFICATION_REVIEW];

export function findVerificationReview(id: string | undefined): VerificationReview {
  return VERIFICATION_REVIEWS.find((review) => review.id === id) ?? DEMO_VERIFICATION_REVIEW;
}

/* ---------- A-04d ---------- */
export const DISPUTE_QUEUE_TAB_COUNTS = { open: 6, awaitingResponse: 2, inReview: 4 };

export const DISPUTE_QUEUE: readonly DisputeQueueRow[] = [
  {
    id: mockId('a0c1f3b9d2'),
    priority: 'HIGH',
    category: 'DAMAGE',
    subject: { kind: 'JOB', id: mockId('a0d177c1e3') },
    openedBy: 'CUSTOMER · APP',
    status: 'AWAITING_RESPONSE',
    respondentAnswer: 'due in 31 h',
    age: '17 h',
  },
  {
    id: DEMO_IDS.resolvedDispute,
    priority: 'HIGH',
    category: 'BEHAVIOUR',
    subject: { kind: 'JOB', id: mockId('a0d15a92d0') },
    openedBy: 'WORKER · SUPPORT',
    status: 'IN_REVIEW',
    respondentAnswer: 'answered',
    assignee: 'Kabir (you)',
    age: '31 h',
  },
  {
    id: DEMO_IDS.dispute,
    priority: 'NORMAL',
    category: 'POOR_QUALITY',
    subject: { kind: 'JOB', id: mockId('a0d1c2e817') },
    openedBy: 'CUSTOMER · APP',
    status: 'IN_REVIEW',
    respondentAnswer: 'answered',
    assignee: 'Kabir (you)',
    age: '2 d',
  },
  {
    id: mockId('a0c109c4ab'),
    priority: 'NORMAL',
    category: 'CASH_NOT_PAID',
    subject: { kind: 'PAYMENT', id: mockId('a0d1aa00be71'), detail: 'cash' },
    openedBy: 'CUSTOMER · APP',
    status: 'IN_REVIEW',
    respondentAnswer: 'timed out (48 h)',
    age: '2 d',
  },
  {
    id: mockId('a0c15e2f70'),
    priority: 'NORMAL',
    category: 'OVERCHARGED',
    subject: { kind: 'VISIT', id: mockId('a0d10f4b9e'), detail: '#1' },
    openedBy: 'CUSTOMER · APP',
    status: 'AWAITING_RESPONSE',
    respondentAnswer: 'due in 9 h',
    age: '39 h',
  },
  {
    id: mockId('a0c1b81d33'),
    priority: 'NORMAL',
    category: 'NO_SHOW_DISAGREEMENT',
    subject: { kind: 'VISIT', id: mockId('a0d25a92d0'), detail: '#1' },
    openedBy: 'WORKER · APP',
    status: 'IN_REVIEW',
    respondentAnswer: 'answered',
    assignee: 'Neha G.',
    age: '3 d',
  },
];

/* ---------- A-04e ---------- */
const OPEN_DEMO_DISPUTE: OpenDispute = {
  id: DEMO_IDS.dispute,
  status: 'IN_REVIEW',
  assignedToMe: true,
  category: 'POOR_QUALITY',
  priority: 'NORMAL',
  subjectLabel: 'JOB of booking',
  subjectId: DEMO_IDS.booking,
  customerName: 'Rina Das',
  workerName: 'Mitali Pal',
  openedSummary: 'opened 2 d ago in app',
  statements: [
    {
      id: 'statement-1',
      party: 'CUSTOMER',
      author: 'Rina (customer)',
      at: '3 Oct 18:20',
      text: 'Tap is leaking again the next morning. Paid ₹650 online.',
    },
    { id: 'statement-2', party: 'CUSTOMER', photos: 2, videos: 1 },
    {
      id: 'statement-3',
      party: 'WORKER',
      author: 'Mitali (worker)',
      at: '4 Oct 09:05',
      text: 'Washer replaced. Leak is from the old pipe joint, I told her it needs a new pipe.',
    },
    {
      id: 'statement-4',
      party: 'AGENT',
      author: 'Agent · Kabir',
      at: '4 Oct 11:30',
      text: 'Please add a photo of the pipe joint.',
    },
    { id: 'statement-5', party: 'CUSTOMER', at: '4 Oct 12:10', photos: 1 },
  ],
  systemEvidence: [
    { label: 'Visit #1 check-in', value: '2 Oct 09:31 · 40 m', icon: Check },
    { label: 'Start code', value: 'verified 09:33 · 1 try' },
    { label: 'Check-out', value: '10:20 · 2 after photos', icon: Camera },
  ],
  jobStatus: 'WORK_COMPLETED · held',
  billPaise: 65000,
  payments: [
    { label: 'ADVANCE · UPI', amountPaise: 9900, status: 'SUCCEEDED' },
    { label: 'FINAL · UPI', paymentId: DEMO_IDS.payment, amountPaise: 55100, status: 'SUCCEEDED' },
  ],
  refundableOnlinePaise: 65000,
  partyHistory: ['Mitali: 1 dispute (NOT_UPHELD) · 0 active strikes', 'Rina: 2 disputes (1 UPHELD)'],
  internalNotes: [
    {
      id: 'note-1',
      author: 'Kabir',
      text: 'Called Rina 14:10. Photo shows the leak at the old joint, not the washer.',
    },
  ],
  draftDecision: {
    outcome: 'PARTIALLY_UPHELD',
    atFault: 'WORKER',
    actions: [
      { id: 'draft-action-1', type: 'REFUND', detail: 'from FINAL UPI …f1c0', amountPaise: 25000 },
      { id: 'draft-action-2', type: 'WORKER_STRIKE', detail: 'DISPUTE_UPHELD' },
    ],
    summary:
      'The washer was replaced but the leak came from the joint, which was not checked. ₹250 refunded to your UPI.',
  },
};

/* ---------- A-04f ---------- */
const RESOLVED_DEMO_DISPUTE: ResolvedDispute = {
  id: DEMO_IDS.resolvedDispute,
  status: 'RESOLVED',
  category: 'BEHAVIOUR',
  priority: 'HIGH',
  subjectLabel: 'JOB',
  subjectId: mockId('a0d15a92d0'),
  outcome: 'UPHELD',
  atFault: 'WORKER',
  closedBy: 'Kabir',
  closedAt: 'today 12:40',
  actions: [
    {
      id: 'resolved-action-1',
      type: 'REFUND',
      amountPaise: 40000,
      description: 'from VISIT_CHARGE UPI',
      referenceId: mockId('a0e1000091aa'),
      status: 'FAILED',
      attempts: '5 / 5',
      lastError: 'PROVIDER_TIMEOUT',
    },
    {
      id: 'resolved-action-2',
      type: 'WORKER_STRIKE',
      description: 'ABUSIVE_BEHAVIOUR · strike',
      referenceId: mockId('a0e100000d4c'),
      status: 'DONE',
      attempts: '1',
    },
    {
      id: 'resolved-action-3',
      type: 'REFUND',
      amountPaise: 9900,
      description: 'from BOOKING_ADVANCE UPI',
      referenceId: mockId('a0e10000a7f3'),
      status: 'PENDING',
      attempts: '2',
      nextAttemptAt: '12:58',
    },
  ],
};

const DISPUTE_RECORDS: readonly DisputeRecord[] = [OPEN_DEMO_DISPUTE, RESOLVED_DEMO_DISPUTE];

export function findDispute(id: string | undefined): DisputeRecord {
  return DISPUTE_RECORDS.find((record) => record.id === id) ?? OPEN_DEMO_DISPUTE;
}

/* ---------- A-04g ---------- */
export const MODERATED_REVIEWS: readonly ModeratedReview[] = [
  {
    id: mockId('a0f100000001'),
    queue: 'MODERATION',
    rating: 2,
    direction: 'CUSTOMER_TO_WORKER',
    authorName: 'Rina Das',
    targetName: 'Sujit Das',
    jobId: mockId('a0f1003f9a1c'),
    status: 'UNDER_MODERATION',
    flagReason: 'CONTACT_DETAILS',
    text: 'Came late and asked for extra cash. Call me on 98765 43210 if you want the details.',
    language: 'en',
    flaggedPhrases: ['98765 43210'],
    moderatorNote: 'Phone number in text',
  },
  {
    id: mockId('a0f100000002'),
    queue: 'MODERATION',
    rating: 1,
    direction: 'WORKER_TO_CUSTOMER',
    authorName: 'Abdul Hossain',
    targetName: 'Moumita Roy',
    jobId: mockId('a0f10077c1e3'),
    status: 'UNDER_MODERATION',
    flagReason: 'ABUSIVE_LANGUAGE',
    text: 'খুব খারাপ ব্যবহার, **** মানুষ।',
    language: 'bn',
    flaggedPhrases: ['****'],
  },
  {
    id: mockId('a0f100000003'),
    queue: 'REPORTED',
    rating: 5,
    direction: 'CUSTOMER_TO_WORKER',
    authorName: 'Pallab Das',
    targetName: 'Mitali Pal',
    jobId: mockId('a0f100e81c27'),
    status: 'PUBLISHED',
    text: 'Quick and clean work.',
    language: 'en',
    flaggedPhrases: [],
    workerReply: {
      text: 'Thank you dada! Message me directly next time @mitali.plumbs',
      flaggedPhrases: ['@mitali.plumbs'],
    },
    reports: { count: 1, reason: 'CONTACT_DETAILS', onReply: true },
  },
];
