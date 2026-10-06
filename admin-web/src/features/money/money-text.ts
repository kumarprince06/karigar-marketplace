import { formatMoney, type Paise } from '@/lib/formatters';

/** formatMoney with a typographic minus, as the ledger mockups show: "−₹1,240". */
export function formatSignedMoney(paise: Paise): string {
  return paise < 0 ? `−${formatMoney(-paise)}` : formatMoney(paise);
}

/** "1,850.5" or "₹ 500" typed by staff becomes integer paise without float rounding; null when not a valid amount. */
export function parseRupeesToPaise(text: string): Paise | null {
  const digitsOnly = text.replace(/[₹,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(digitsOnly)) return null;
  const [rupees = '0', paise = ''] = digitsOnly.split('.');
  return Number(rupees) * 100 + Number(paise.padEnd(2, '0'));
}
