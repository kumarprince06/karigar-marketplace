import type { LucideIcon } from 'lucide-react';
import type { Tone } from '@/components/ui';
import type { Permission } from '@/features/auth';

/** The seven ops queues, LLD-020 §3.3. */
export type OpsQueueCode =
  | 'VERIFICATION_PENDING'
  | 'OPEN_DISPUTE'
  | 'FLAGGED_CHECK_IN'
  | 'CASH_DISPUTED'
  | 'STUCK_REFUND'
  | 'PARKED_PROVIDER_EVENT'
  | 'OUTBOX_DEAD';

export interface OpsQueueSummary {
  code: OpsQueueCode;
  title: string;
  /** Shorter label used on the queue tabs strip. */
  tabTitle: string;
  icon: LucideIcon;
  iconTone: 'warm' | 'brand';
  viewPermission: Permission;
  /** Extra permission note shown after the view permission, e.g. "retry ops.act". */
  permissionNote?: string;
  count: number;
  /** Age of the oldest item, e.g. "51 h"; absent when the queue is empty. */
  oldestAge?: string;
  oldestIsOverSla?: boolean;
  alertChip: { tone: Tone; label: string; icon?: LucideIcon };
  stripe: 'error' | 'accent' | 'success';
  /** Where the "Open" link and the queue tab go. */
  to: string;
}

export interface TodayKpi {
  label: string;
  value: number;
  /** When true the value is paise and shown with formatMoney. */
  isMoney?: boolean;
  hint: string;
}

export type StartCodeResult =
  { status: 'VERIFIED'; verifiedAt: string } | { status: 'NOT_ENTERED'; triesUsed: number; maxTries: number };

export type Trade = 'Electrician' | 'Plumber';

export interface FlaggedCheckIn {
  visitId: string;
  bookingId: string;
  workerName: string;
  trade: Trade;
  checkedInLabel: string;
  distanceMeters: number;
  accuracyMeters: number;
  workerReason: string;
  startCode: StartCodeResult;
}

export type AcknowledgeOutcome = 'NO_ACTION' | 'HANDLED_ELSEWHERE';
