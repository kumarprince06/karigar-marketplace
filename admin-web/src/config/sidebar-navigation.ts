import {
  Bell,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  Compass,
  CreditCard,
  IdCard,
  Inbox,
  Landmark,
  Map as MapIcon,
  Scale,
  ScrollText,
  Settings,
  Star,
  UserSearch,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { Permission } from '@/features/auth';
import { paths } from './route-paths';

export interface NavItem {
  label: string;
  icon: LucideIcon;
  to: string;
  /** Hidden when the staff member lacks it (LLD-020 §3.2). */
  permission: Permission;
  /** Live count badge; static numbers until wired to GET /admin/ops/queues. */
  count?: number;
}

export interface NavGroup {
  title?: string;
  items: NavItem[];
}

export const SIDEBAR_NAVIGATION: NavGroup[] = [
  { items: [{ label: 'Ops queues', icon: Compass, to: paths.ops, permission: 'ops.view', count: 30 }] },
  {
    title: 'People',
    items: [{ label: 'User lookup', icon: UserSearch, to: paths.users, permission: 'user.view' }],
  },
  {
    title: 'Marketplace',
    items: [
      { label: 'Requests', icon: ClipboardList, to: paths.requests, permission: 'booking.view' },
      { label: 'Bookings', icon: CalendarCheck, to: paths.bookings, permission: 'booking.view' },
    ],
  },
  {
    title: 'Trust',
    items: [
      {
        label: 'Verifications',
        icon: IdCard,
        to: paths.verifications,
        permission: 'verification.review',
        count: 14,
      },
      { label: 'Disputes', icon: Scale, to: paths.disputes, permission: 'dispute.manage', count: 6 },
      { label: 'Reviews', icon: Star, to: paths.reviews, permission: 'review.moderate', count: 3 },
    ],
  },
  {
    title: 'Money',
    items: [
      { label: 'Payments & refunds', icon: CreditCard, to: paths.payments, permission: 'finance.view' },
      { label: 'Payout accounts', icon: Landmark, to: paths.payouts, permission: 'finance.view', count: 2 },
      { label: 'Ledger', icon: BookOpen, to: paths.ledger, permission: 'finance.view' },
    ],
  },
  {
    title: 'Config',
    items: [
      { label: 'Catalog', icon: Wrench, to: paths.catalog, permission: 'catalog.manage' },
      { label: 'Service zones', icon: MapIcon, to: paths.zones, permission: 'service_zone.manage' },
      { label: 'Notifications', icon: Bell, to: paths.notifications, permission: 'notification.view' },
      { label: 'Outbox', icon: Inbox, to: paths.outbox, permission: 'ops.view', count: 3 },
      { label: 'Audit log', icon: ScrollText, to: paths.audit, permission: 'audit.view' },
      { label: 'Staff & roles', icon: Users, to: paths.staff, permission: 'staff.manage' },
      { label: 'Settings', icon: Settings, to: paths.settings, permission: 'ops.view' },
    ],
  },
];
