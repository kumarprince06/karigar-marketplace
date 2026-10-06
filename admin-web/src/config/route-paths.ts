/** Every route in one place. Build links with these, never with string literals. */
export const paths = {
  login: '/login',
  mfaSetup: '/mfa/setup',
  mfaVerify: '/mfa',
  mfaLocked: '/mfa/locked',

  ops: '/ops',
  opsQueue: (queue: string) => `/ops/queues/${queue}`,

  users: '/users',
  customer: (id: string) => `/users/customers/${id}`,
  worker: (id: string) => `/users/workers/${id}`,

  requests: '/requests',
  bookings: '/bookings',
  booking: (id: string) => `/bookings/${id}`,

  verifications: '/verifications',
  verification: (id: string) => `/verifications/${id}`,
  disputes: '/disputes',
  dispute: (id: string) => `/disputes/${id}`,
  reviews: '/reviews',

  payments: '/payments',
  moneyQueues: '/payments/queues',
  payouts: '/payouts',
  ledger: '/ledger',

  catalog: '/catalog',
  zones: '/zones',
  notifications: '/notifications',
  outbox: '/outbox',
  audit: '/audit',
  staff: '/staff',
  roles: '/staff/roles',
  settings: '/settings',
  reasonCodes: '/settings/reason-codes',

  screens: '/screens',
} as const;

export const GRAFANA_URL = 'https://grafana.karigar.in';
