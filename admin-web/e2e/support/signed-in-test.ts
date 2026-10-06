import { test as baseTest } from '@playwright/test';
import { SIGNED_IN_STORAGE_KEY } from '@/features/auth/session-storage-keys';

/**
 * `test` that starts every page already past login + MFA, for screen checks that are not about signing in.
 * Use the plain Playwright `test` for sign-in journeys.
 */
export const signedInTest = baseTest.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(
      (storageKey) => sessionStorage.setItem(storageKey, 'true'),
      SIGNED_IN_STORAGE_KEY,
    );
    await use(page);
  },
});
