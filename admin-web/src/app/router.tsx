import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import type { ComponentType } from 'react';
import { AuthenticatedLayout, SignInLayout } from '@/components/layout';
import { paths } from '@/config/route-paths';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { RouteLoadingFallback } from '@/pages/RouteLoadingFallback';
import { ScreenIndexPage } from '@/pages/ScreenIndexPage';
import type { RouteHandle } from './route-handle';

type Feature = 'access' | 'people' | 'marketplace' | 'trust' | 'money' | 'config';

/* Each feature is one lazily loaded chunk. Vite needs literal import paths, hence the map. */
const featureModuleLoaders: Record<Feature, () => Promise<Record<string, unknown>>> = {
  access: () => import('@/features/access'),
  people: () => import('@/features/people'),
  marketplace: () => import('@/features/marketplace'),
  trust: () => import('@/features/trust'),
  money: () => import('@/features/money'),
  config: () => import('@/features/config'),
};

function lazyFeaturePage(
  feature: Feature,
  name: string,
  handle: RouteHandle = {},
): Pick<RouteObject, 'lazy' | 'handle'> {
  return {
    handle,
    lazy: async () => ({ Component: (await featureModuleLoaders[feature]())[name] as ComponentType }),
  };
}

/** "flagged-check-ins" → "Flagged check-ins" */
function humanizeSlug(slug = '') {
  const words = slug.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export const router = createBrowserRouter([
  {
    HydrateFallback: RouteLoadingFallback,
    children: [
      {
        element: <SignInLayout />,
        children: [
          { path: paths.login, ...lazyFeaturePage('access', 'LoginPage') },
          { path: paths.mfaSetup, ...lazyFeaturePage('access', 'MfaSetupPage') },
          { path: paths.mfaVerify, ...lazyFeaturePage('access', 'MfaVerifyPage') },
          { path: paths.mfaLocked, ...lazyFeaturePage('access', 'MfaLockedPage') },
        ],
      },
      {
        element: <AuthenticatedLayout />,
        children: [
          { index: true, element: <Navigate to={paths.ops} replace /> },
          { path: paths.screens, element: <ScreenIndexPage />, handle: { crumb: 'Screen index' } },
          {
            path: paths.ops,
            handle: { crumb: 'Ops queues', permission: 'ops.view' },
            children: [
              { index: true, ...lazyFeaturePage('access', 'OpsDashboardPage') },
              {
                path: 'queues/:queue',
                ...lazyFeaturePage('access', 'OpsQueuePage', { crumb: ({ queue }) => humanizeSlug(queue) }),
              },
            ],
          },
          {
            path: paths.users,
            handle: { crumb: 'User lookup', permission: 'user.view' },
            children: [
              { index: true, ...lazyFeaturePage('people', 'UserLookupPage') },
              {
                path: 'customers/:id',
                ...lazyFeaturePage('people', 'CustomerDetailPage', { crumb: 'Customer' }),
              },
              { path: 'workers/:id', ...lazyFeaturePage('people', 'WorkerDetailPage', { crumb: 'Worker' }) },
            ],
          },
          {
            path: paths.requests,
            ...lazyFeaturePage('marketplace', 'RequestsPage', {
              crumb: 'Requests',
              permission: 'booking.view',
            }),
          },
          {
            path: paths.bookings,
            handle: { crumb: 'Bookings', permission: 'booking.view' },
            children: [
              { index: true, ...lazyFeaturePage('marketplace', 'BookingsPage') },
              { path: ':id', ...lazyFeaturePage('marketplace', 'BookingDetailPage', { crumb: 'Booking' }) },
            ],
          },
          {
            path: paths.verifications,
            handle: { crumb: 'Verifications', permission: 'verification.review' },
            children: [
              { index: true, ...lazyFeaturePage('trust', 'VerificationQueuePage') },
              { path: ':id', ...lazyFeaturePage('trust', 'VerificationReviewPage', { crumb: 'Review' }) },
            ],
          },
          {
            path: paths.disputes,
            handle: { crumb: 'Disputes', permission: 'dispute.manage' },
            children: [
              { index: true, ...lazyFeaturePage('trust', 'DisputeQueuePage') },
              { path: ':id', ...lazyFeaturePage('trust', 'DisputeDetailPage', { crumb: 'Dispute' }) },
            ],
          },
          {
            path: paths.reviews,
            ...lazyFeaturePage('trust', 'ReviewModerationPage', {
              crumb: 'Reviews',
              permission: 'review.moderate',
            }),
          },
          {
            path: paths.payments,
            handle: { crumb: 'Payments & refunds', permission: 'finance.view' },
            children: [
              { index: true, ...lazyFeaturePage('money', 'PaymentsPage') },
              { path: 'queues', ...lazyFeaturePage('money', 'MoneyQueuesPage', { crumb: 'Queues' }) },
            ],
          },
          {
            path: paths.payouts,
            ...lazyFeaturePage('money', 'PayoutAccountsPage', {
              crumb: 'Payout accounts',
              permission: 'finance.view',
            }),
          },
          {
            path: paths.ledger,
            ...lazyFeaturePage('money', 'LedgerPage', { crumb: 'Ledger', permission: 'finance.view' }),
          },
          {
            path: paths.catalog,
            ...lazyFeaturePage('config', 'CatalogPage', { crumb: 'Catalog', permission: 'catalog.manage' }),
          },
          {
            path: paths.zones,
            ...lazyFeaturePage('config', 'ServiceZonesPage', {
              crumb: 'Service zones',
              permission: 'service_zone.manage',
            }),
          },
          {
            path: paths.notifications,
            ...lazyFeaturePage('config', 'NotificationsPage', {
              crumb: 'Notifications',
              permission: 'notification.view',
            }),
          },
          {
            path: paths.outbox,
            ...lazyFeaturePage('config', 'OutboxPage', { crumb: 'Outbox', permission: 'ops.view' }),
          },
          {
            path: paths.audit,
            ...lazyFeaturePage('config', 'AuditLogPage', { crumb: 'Audit log', permission: 'audit.view' }),
          },
          {
            path: paths.staff,
            handle: { crumb: 'Staff & roles' },
            children: [
              { index: true, ...lazyFeaturePage('config', 'StaffPage', { permission: 'staff.manage' }) },
              {
                path: 'roles',
                ...lazyFeaturePage('config', 'RolesPage', { crumb: 'Roles', permission: 'ops.view' }),
              },
            ],
          },
          {
            path: paths.settings,
            handle: { crumb: 'Settings', permission: 'ops.view' },
            children: [
              { index: true, ...lazyFeaturePage('config', 'SettingsPage') },
              {
                path: 'reason-codes',
                ...lazyFeaturePage('config', 'ReasonCodesPage', { crumb: 'Reason codes' }),
              },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
