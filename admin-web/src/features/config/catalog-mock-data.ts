import { BrickWall, Hammer, PaintRoller, Refrigerator, SprayCan, Toolbox, Zap } from 'lucide-react';
import type { CatalogCategory, Locale, RateType, SearchMiss, TradeDetail } from './types';

export const RATE_TYPES: readonly RateType[] = [
  'VISIT',
  'HOURLY',
  'HALF_DAY',
  'DAILY',
  'PER_UNIT',
  'MINIMUM',
];

export const LOCALES: readonly Locale[] = ['en', 'bn', 'hi'];

export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', bn: 'বাংলা', hi: 'हिन्दी' };

export const CATALOG_CATEGORIES: CatalogCategory[] = [
  {
    code: 'ELECTRICAL_PLUMBING',
    icon: Zap,
    name: 'Electrical & plumbing',
    trades: [
      { code: 'ELECTRICIAN', name: 'Electrician', active: true },
      { code: 'PLUMBER', name: 'Plumber', active: true },
    ],
  },
  {
    code: 'CONSTRUCTION',
    icon: BrickWall,
    name: 'Construction',
    trades: [
      { code: 'MASON', name: 'Mason', active: false },
      { code: 'TILE_FITTER', name: 'Tile fitter', active: false },
    ],
  },
  {
    code: 'FINISHING_INTERIORS',
    icon: PaintRoller,
    name: 'Finishing & interiors',
    trades: [
      { code: 'PAINTER', name: 'Painter', active: false },
      { code: 'POP_FALSE_CEILING', name: 'POP / false ceiling', active: false },
    ],
  },
  {
    code: 'WOOD_METAL_GLASS',
    icon: Hammer,
    name: 'Wood, metal & glass',
    trades: [{ code: 'CARPENTER', name: 'Carpenter', active: false }],
  },
  {
    code: 'APPLIANCE_REPAIR',
    icon: Refrigerator,
    name: 'Appliance repair',
    trades: [{ code: 'AC_TECHNICIAN', name: 'AC technician', active: false }],
  },
  { code: 'CLEANING_PEST', icon: SprayCan, name: 'Cleaning & pest', trades: [] },
  { code: 'HELPERS_OTHER', icon: Toolbox, name: 'Helpers & other', trades: [] },
];

export const TRADE_DETAILS: TradeDetail[] = [
  {
    tradeCode: 'ELECTRICIAN',
    categoryCode: 'ELECTRICAL_PLUMBING',
    names: { en: 'Electrician', bn: 'ইলেকট্রিশিয়ান', hi: 'इलेक्ट्रीशियन' },
    defaultRateType: 'VISIT',
    emergencyEnabled: true,
    emergencySurchargePaise: 15000,
    advancePaise: 9900,
    skills: [
      { name: 'Wiring', active: true },
      { name: 'Fan & light fitting', active: true },
      { name: 'MCB / DB board', active: true },
      { name: 'Inverter', active: true },
      { name: 'Earthing', active: true },
      { name: 'Smart switches', active: false },
    ],
    problems: [
      {
        code: 'FAN_NOT_WORKING',
        skill: 'Fan & light fitting',
        titles: { en: 'Fan not working', bn: 'পাখা ঘুরছে না', hi: 'पंखा नहीं चल रहा' },
        keywords: { en: 'fan, ceiling fan, pankha', bn: 'পাখা, ফ্যান', hi: 'पंखा, pankha band' },
        priceGuide: { fromPaise: 25000, toPaise: 45000 },
        emergency: false,
        estimatedMinutes: 45,
        sortOrder: 1,
        active: true,
      },
      {
        code: 'MCB_TRIPPING',
        skill: 'MCB / DB board',
        titles: { en: 'MCB keeps tripping', bn: 'এমসিবি বারবার ট্রিপ করছে' },
        keywords: {
          en: 'mcb, trip, power cut, main switch falls',
          bn: 'এমসিবি, ট্রিপ, mcb trip',
          hi: 'एमसीबी, ट्रिप, बिजली चली जाती है, mcb trip, light chali jati, main switch gir jata',
        },
        priceGuide: { fromPaise: 30000, toPaise: 60000 },
        emergency: true,
        estimatedMinutes: 60,
        sortOrder: 2,
        active: true,
      },
      {
        code: 'SPARKING_BURNING_SMELL',
        skill: 'Wiring',
        titles: { en: 'Sparking / burning smell', bn: 'স্পার্ক / পোড়া গন্ধ', hi: 'चिंगारी / जलने की गंध' },
        keywords: { en: 'spark, burning smell, short circuit' },
        priceGuide: null,
        emergency: true,
        estimatedMinutes: 60,
        sortOrder: 3,
        active: true,
      },
      {
        code: 'NEW_LIGHT_POINT',
        skill: 'Wiring',
        titles: { en: 'New light point', bn: 'নতুন লাইট পয়েন্ট', hi: 'नया लाइट पॉइंट' },
        keywords: { en: 'new point, light fitting' },
        priceGuide: { fromPaise: 35000, toPaise: 70000 },
        emergency: false,
        estimatedMinutes: 90,
        sortOrder: 4,
        active: true,
      },
      {
        code: 'INVERTER_CONNECTION',
        skill: 'Inverter',
        titles: { en: 'Inverter connection', hi: 'इन्वर्टर कनेक्शन' },
        keywords: { en: 'inverter, ups, battery' },
        priceGuide: { fromPaise: 50000, toPaise: 90000 },
        emergency: false,
        estimatedMinutes: 120,
        sortOrder: 5,
        active: false,
      },
    ],
  },
];

export const CATALOG_SEARCH_MISSES: SearchMiss[] = [
  { term: 'পাখা ঘুরছে না', locale: 'bn', count: 41 },
  { term: 'geyser line', locale: 'en', count: 23 },
  { term: 'মিটার বোর্ড', locale: 'bn', count: 17 },
  { term: 'switch tuta', locale: 'en', count: 12 },
];

/** Missing translations across the whole catalog (GET /missing-translations?locale=). */
export const MISSING_TRANSLATION_COUNTS: { locale: Locale; count: number }[] = [
  { locale: 'hi', count: 3 },
  { locale: 'bn', count: 1 },
];

/** Recent search misses that look like the problem being edited (A-06b). */
export const PROBLEM_MATCHING_MISSES: SearchMiss[] = [
  { term: 'main switch gir gaya', locale: 'en', count: 9 },
  { term: 'trip ho raha', locale: 'en', count: 6 },
];
