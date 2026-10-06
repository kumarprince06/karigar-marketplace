/** Icons for documents and trades, in one place. Mock data and screens refer to these. */
import {
  BookUser,
  Car,
  CreditCard,
  Droplets,
  GraduationCap,
  IdCard,
  ScanFace,
  ScrollText,
  ShieldCheck,
  Zap,
  type LucideIcon,
} from 'lucide-react';

export const DOCUMENT_ICON = {
  VOTER_ID: IdCard,
  PASSPORT: BookUser,
  DRIVING_LICENCE: Car,
  PAN_CARD: CreditCard,
  ELECTRICAL_LICENSE: ScrollText,
  POLICE_CERTIFICATE: ShieldCheck,
  SKILL_CERTIFICATE: GraduationCap,
  SELFIE: ScanFace,
} satisfies Record<string, LucideIcon>;

export const TRADE_ICON = {
  Electrician: Zap,
  Plumber: Droplets,
} satisfies Record<string, LucideIcon>;
