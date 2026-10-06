/**
 * Ids shared across features so cross-links (booking → customer → dispute …) land on real mock records.
 * Detail pages look a record up by id and fall back to their primary demo record.
 */
export const DEMO_IDS = {
  customer: '01928f6e-7c1a-7b3e-9d2f-4b8e2c7d1e0a',
  worker: '01928f6e-7c1a-7b3e-9d2f-6e1f0a5b3c21',
  request: '01928f6e-7c1a-7b3e-9d2f-1a2b3c8e4f71',
  booking: '01928f6e-7c1a-7b3e-9d2f-8d7c6b3f9a1c',
  visit: '01928f6e-7c1a-7b3e-9d2f-2c3d4ea91c4e',
  verification: '01928f6e-7c1a-7b3e-9d2f-5a6b7c0de4b2',
  dispute: '01928f6e-7c1a-7b3e-9d2f-9e8d7c41d2a6',
  resolvedDispute: '01928f6e-7c1a-7b3e-9d2f-3b4c5d7e8f90',
  payment: '01928f6e-7c1a-7b3e-9d2f-4d5e6f1a2b3c',
} as const;
