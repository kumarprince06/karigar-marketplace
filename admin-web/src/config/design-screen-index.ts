import { DEMO_IDS } from '@/mocks/demo-ids';
import { paths } from './route-paths';

export interface ScreenEntry {
  id: string;
  title: string;
  to: string;
}

/** Every designed admin frame (docs/design/screens/admin) and the URL that renders it. */
export const DESIGN_SCREEN_INDEX: { area: string; source: string; screens: ScreenEntry[] }[] = [
  {
    area: 'Access & ops',
    source: '01-access.html',
    screens: [
      { id: 'A-01a', title: 'Staff login', to: paths.login },
      { id: 'A-01b', title: 'Set up authenticator (MFA enrol)', to: paths.mfaSetup },
      { id: 'A-01c', title: 'Enter authenticator code', to: paths.mfaVerify },
      { id: 'A-01d', title: 'MFA lockout', to: paths.mfaLocked },
      { id: 'A-01e', title: 'Ops dashboard', to: paths.ops },
      {
        id: 'A-01f',
        title: 'Flagged check-ins + acknowledge',
        to: `${paths.opsQueue('flagged-check-ins')}?dialog=acknowledge`,
      },
    ],
  },
  {
    area: 'People',
    source: '02-people.html',
    screens: [
      { id: 'A-02a', title: 'User lookup', to: paths.users },
      { id: 'A-02b', title: 'Customer detail', to: paths.customer(DEMO_IDS.customer) },
      {
        id: 'A-02c',
        title: 'Reveal contact details',
        to: `${paths.customer(DEMO_IDS.customer)}?dialog=reveal`,
      },
      {
        id: 'A-02d',
        title: 'Customer suspend / restriction',
        to: `${paths.customer(DEMO_IDS.customer)}?dialog=suspend`,
      },
      { id: 'A-02e', title: 'Worker detail', to: paths.worker(DEMO_IDS.worker) },
      { id: 'A-02f', title: 'Worker suspend', to: `${paths.worker(DEMO_IDS.worker)}?dialog=suspend` },
    ],
  },
  {
    area: 'Marketplace',
    source: '03-marketplace.html',
    screens: [
      { id: 'A-03a', title: 'Requests', to: paths.requests },
      { id: 'A-03b', title: 'Bookings', to: paths.bookings },
      { id: 'A-03c', title: 'Booking / job detail', to: paths.booking(DEMO_IDS.booking) },
      { id: 'A-03d', title: 'Admin cancel booking', to: `${paths.booking(DEMO_IDS.booking)}?dialog=cancel` },
    ],
  },
  {
    area: 'Trust',
    source: '04-trust.html',
    screens: [
      { id: 'A-04a', title: 'Verification queue', to: paths.verifications },
      { id: 'A-04b', title: 'Verification review', to: paths.verification(DEMO_IDS.verification) },
      {
        id: 'A-04c',
        title: 'Revoke a verified check',
        to: `${paths.verification(DEMO_IDS.verification)}?dialog=revoke`,
      },
      { id: 'A-04d', title: 'Dispute queue', to: paths.disputes },
      { id: 'A-04e', title: 'Dispute investigation + decision', to: paths.dispute(DEMO_IDS.dispute) },
      { id: 'A-04f', title: 'Resolved dispute', to: paths.dispute(DEMO_IDS.resolvedDispute) },
      { id: 'A-04g', title: 'Review moderation', to: paths.reviews },
    ],
  },
  {
    area: 'Money',
    source: '05-money.html',
    screens: [
      { id: 'A-05a', title: 'Payments & refunds', to: paths.payments },
      { id: 'A-05b', title: 'Refund dialog', to: `${paths.payments}?dialog=refund` },
      { id: 'A-05c', title: 'Money queues', to: paths.moneyQueues },
      { id: 'A-05d', title: 'Payout accounts + hold', to: paths.payouts },
      { id: 'A-05e', title: 'Ledger + manual adjustment', to: paths.ledger },
    ],
  },
  {
    area: 'Config',
    source: '06-config.html',
    screens: [
      { id: 'A-06a', title: 'Catalog trade editor', to: paths.catalog },
      { id: 'A-06b', title: 'Edit common problem', to: `${paths.catalog}?dialog=edit-problem` },
      { id: 'A-06c', title: 'Service zones', to: paths.zones },
      { id: 'A-06d', title: 'Notifications delivery log', to: paths.notifications },
      { id: 'A-06e', title: 'Outbox dead events', to: paths.outbox },
      { id: 'A-06f', title: 'Audit log', to: paths.audit },
      { id: 'A-06g', title: 'Staff + step-up code', to: `${paths.staff}?dialog=step-up` },
      { id: 'A-06h', title: 'Roles & permissions', to: paths.roles },
      { id: 'A-06i', title: 'Platform settings', to: paths.settings },
      { id: 'A-06j', title: 'Reason codes', to: paths.reasonCodes },
    ],
  },
];
