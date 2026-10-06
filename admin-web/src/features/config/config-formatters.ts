import { formatMoney } from '@/lib/formatters';
import { LOCALES } from './catalog-mock-data';
import type { Locale, LocalizedText, PriceGuide } from './types';

/** "₹300 – ₹600" */
export function formatPriceGuide(priceGuide: PriceGuide): string {
  return `${formatMoney(priceGuide.fromPaise)} – ${formatMoney(priceGuide.toPaise)}`;
}

/** Locales with no text yet; the app falls back to English for these. */
export function getMissingLocales(text: LocalizedText): Locale[] {
  return LOCALES.filter((locale) => !text[locale]?.trim());
}
