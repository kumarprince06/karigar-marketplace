/** Money is always integer minor units (paise), ADR-0006. */
export type Paise = number;

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const inrWhole = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/** ₹4,250 · ₹1,25,000 · ₹99.50 — paise shown only when non-zero (design review fix). */
export function formatMoney(paise: Paise): string {
  return (paise % 100 === 0 ? inrWhole : inr).format(paise / 100);
}

/** UUIDv7 ids are shown by their last 6 characters, e.g. "…a91c4e" (ADR-0018). */
export function formatShortId(id: string): string {
  return `…${id.slice(-6)}`;
}

const dateTime = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Kolkata',
});

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

const clockTimeFormat = new Intl.DateTimeFormat('en-IN', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Kolkata',
});

const dayMonthFormat = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  timeZone: 'Asia/Kolkata',
});

/** "10:58" in IST. */
export function formatClockTime(iso: string): string {
  return clockTimeFormat.format(new Date(iso));
}

/** "5 Oct" in IST. */
export function formatDayMonth(iso: string): string {
  return dayMonthFormat.format(new Date(iso));
}
