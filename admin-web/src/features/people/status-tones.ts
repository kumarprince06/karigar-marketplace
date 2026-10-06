import type { Tone } from '@/components/ui';

const STATUS_TONES: Record<string, Tone> = {
  ACTIVE: 'success',
  VERIFIED: 'success',
  COMPLETED: 'success',
  DONE: 'success',
  SUSPENDED: 'error',
  PENDING: 'warning',
  IN_REVIEW: 'warning',
  CONFIRMED: 'brand',
  IN_PROGRESS: 'info',
};

/** Chip tone for an enum value; anything unlisted (ONBOARDING, DEACTIVATED, CANCELLED, PAUSED …) is neutral. */
export function getStatusTone(status: string): Tone {
  return STATUS_TONES[status] ?? 'neutral';
}
