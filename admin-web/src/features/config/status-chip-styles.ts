import type { Tone } from '@/components/ui';
import type { NotificationStatus, ServiceZoneStatus, StaffMfaState, StaffStatus } from './types';

/** One label = one enum value. Every status chip in this feature reads its label and tone from here. */
interface ChipStyle {
  label: string;
  tone: Tone;
}

export const SERVICE_ZONE_STATUS_CHIP: Record<ServiceZoneStatus, ChipStyle> = {
  ACTIVE: { label: 'ACTIVE', tone: 'success' },
  COMING_SOON: { label: 'COMING_SOON', tone: 'warning' },
  INACTIVE: { label: 'INACTIVE', tone: 'neutral' },
};

export const NOTIFICATION_STATUS_CHIP: Record<NotificationStatus, ChipStyle> = {
  PENDING: { label: 'PENDING', tone: 'info' },
  SENT: { label: 'SENT', tone: 'success' },
  FAILED: { label: 'FAILED', tone: 'error' },
  SUPPRESSED: { label: 'SUPPRESSED', tone: 'neutral' },
  EXPIRED: { label: 'EXPIRED', tone: 'neutral' },
};

export const STAFF_STATUS_CHIP: Record<StaffStatus, ChipStyle> = {
  ACTIVE: { label: 'ACTIVE', tone: 'success' },
  SUSPENDED: { label: 'SUSPENDED', tone: 'warning' },
  LEFT: { label: 'LEFT', tone: 'neutral' },
};

/** WIPED has no chip: the mock shows "secret wiped" as faint text for people who left. */
export const STAFF_MFA_STATE_CHIP: Record<Exclude<StaffMfaState, 'WIPED'>, ChipStyle> = {
  ENROLLED: { label: 'On', tone: 'success' },
  NOT_ENROLLED: { label: 'Not enrolled · blocked', tone: 'error' },
  NOT_SET_UP: { label: '—', tone: 'neutral' },
};

export const ACTIVE_FLAG_CHIP: Record<'true' | 'false', ChipStyle> = {
  true: { label: 'ACTIVE', tone: 'success' },
  false: { label: 'INACTIVE', tone: 'neutral' },
};
