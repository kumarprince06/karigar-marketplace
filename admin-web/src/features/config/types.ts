import type { LucideIcon } from 'lucide-react';
import type { Role } from '@/features/auth';
import type { Paise } from '@/lib/formatters';

/* ---------- Catalog (LLD-003) ---------- */

export type Locale = 'en' | 'bn' | 'hi';

export type LocalizedText = Partial<Record<Locale, string>>;

export type RateType = 'VISIT' | 'HOURLY' | 'HALF_DAY' | 'DAILY' | 'PER_UNIT' | 'MINIMUM';

export interface CatalogTrade {
  code: string;
  name: string;
  active: boolean;
}

export interface CatalogCategory {
  code: string;
  icon: LucideIcon;
  name: string;
  trades: CatalogTrade[];
}

export interface TradeSkill {
  name: string;
  active: boolean;
}

/** A price guide range, or null when the problem "needs inspection". */
export interface PriceGuide {
  fromPaise: Paise;
  toPaise: Paise;
}

export interface CommonProblem {
  code: string;
  skill: string;
  titles: LocalizedText;
  keywords: LocalizedText;
  priceGuide: PriceGuide | null;
  emergency: boolean;
  estimatedMinutes: number;
  sortOrder: number;
  active: boolean;
}

export interface TradeDetail {
  tradeCode: string;
  categoryCode: string;
  names: LocalizedText;
  defaultRateType: RateType;
  emergencyEnabled: boolean;
  emergencySurchargePaise: Paise;
  advancePaise: Paise;
  skills: TradeSkill[];
  problems: CommonProblem[];
}

export interface SearchMiss {
  term: string;
  locale: Locale;
  count: number;
}

/* ---------- Service zones (LLD-005) ---------- */

export type ServiceZoneStatus = 'ACTIVE' | 'COMING_SOON' | 'INACTIVE';

export interface ServiceZone {
  id: string;
  name: string;
  status: ServiceZoneStatus;
  pinCodes: string[];
  waitlistCount: number;
}

export interface WaitlistDemand {
  pinCode: string;
  zoneName: string | null;
  waitingCount: number;
}

/* ---------- Notifications (LLD-013) ---------- */

export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED' | 'SUPPRESSED' | 'EXPIRED';
export type NotificationChannel = 'IN_APP' | 'PUSH' | 'EMAIL';
export type NotificationCategory = 'TRANSACTIONAL' | 'REMINDER' | 'SECURITY';

export interface NotificationDelivery {
  id: string;
  createdAt: string;
  type: string;
  category: NotificationCategory;
  channel: NotificationChannel;
  locale: Locale;
  status: NotificationStatus;
  attempts: number | null;
  failureCode: string | null;
  nextAttemptAt: string | null;
  providerMessageId: string | null;
}

/* ---------- Outbox (LLD-022) ---------- */

export interface DeadOutboxEvent {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  occurredAt: string;
  attempts: number;
  lastError: string;
}

/* ---------- Audit (LLD-020) ---------- */

export interface AuditEvent {
  id: string;
  occurredAt: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  reasonCode: string | null;
  note: string | null;
  requestId: string | null;
  metadata: Record<string, unknown>;
}

/* ---------- Staff (LLD-020) ---------- */

export type StaffStatus = 'ACTIVE' | 'SUSPENDED' | 'LEFT';
export type StaffMfaState = 'ENROLLED' | 'NOT_ENROLLED' | 'NOT_SET_UP' | 'WIPED';

export interface RoleGrant {
  role: Role;
  grantedBy: string;
  grantedAt: string;
}

export interface StaffMember {
  id: string;
  name: string;
  maskedEmail: string;
  grants: RoleGrant[];
  mfaState: StaffMfaState;
  status: StaffStatus;
  passwordSet: boolean;
}

/* ---------- Settings and reason codes (LLD-022) ---------- */

export interface SettingsGroup {
  icon: LucideIcon;
  title: string;
  rows?: { label: string; value: string }[];
  chips?: { label: string; lang?: Locale }[];
  description?: string;
}

export interface ReasonCodeCategory {
  code: string;
  codeCount: number;
  ownerSeed: string;
}

export interface ReasonCode {
  sortOrder: number;
  code: string;
  labels: LocalizedText;
  requiresNote: boolean;
  cancellationFeeApplies: boolean;
  active: boolean;
}
