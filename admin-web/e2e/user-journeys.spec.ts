import { expect, test, type Page } from '@playwright/test';
import { paths } from '@/config/route-paths';
import { DEMO_IDS } from '@/mocks/demo-ids';
import { signedInTest } from './support/signed-in-test';

/** Below 1024px the sidebar is a drawer behind the menu button. */
async function openNavigationIfCollapsed(page: Page) {
  if ((page.viewportSize()?.width ?? 0) < 1024) await page.getByRole('button', { name: 'Open menu' }).click();
}

async function signInThroughTheForms(page: Page) {
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(new RegExp(`^[^?]*${paths.mfaVerify}`));
  await page.getByRole('button', { name: 'Verify' }).click();
}

/* ---------- Signing in (starts signed out) ---------- */

test('opening the console signed out goes to the login page', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(paths.login);
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
});

test('staff member logs in, passes MFA and lands on the ops queues', async ({ page }) => {
  await page.goto(paths.login);
  await signInThroughTheForms(page);
  await expect(page).toHaveURL(paths.ops);
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeVisible();
});

test('a deep link survives sign-in: login, MFA, then the page that was asked for', async ({ page }) => {
  const requestedPage = `${paths.booking(DEMO_IDS.booking)}?dialog=cancel`;
  await page.goto(requestedPage);
  await expect(page).toHaveURL(/\/login\?redirectTo=/);

  await signInThroughTheForms(page);
  await expect(page).toHaveURL(requestedPage);
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('the redirect only accepts pages inside the app (no open redirect)', async ({ page }) => {
  await page.goto(`${paths.login}?redirectTo=${encodeURIComponent('//evil.example.com')}`);
  await signInThroughTheForms(page);
  await expect(page).toHaveURL(paths.ops);
});

test('logging out returns to login and closes the console', async ({ page }) => {
  await page.goto(paths.login);
  await signInThroughTheForms(page);
  await expect(page).toHaveURL(paths.ops);

  await openNavigationIfCollapsed(page);
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(paths.login);

  await page.goto(paths.bookings);
  await expect(page).toHaveURL(/\/login\?redirectTo=%2Fbookings/);
});

/* ---------- Inside the console (starts signed in) ---------- */

signedInTest('sidebar navigation reaches a page and marks it current', async ({ page }) => {
  await page.goto(paths.ops);
  await openNavigationIfCollapsed(page);

  const navigation = page.getByRole('navigation', { name: 'Main' });
  await navigation.getByRole('link', { name: 'Bookings' }).click();

  await expect(page).toHaveURL(paths.bookings);
  await expect(navigation.getByRole('link', { name: 'Bookings' })).toHaveAttribute('aria-current', 'page');
});

signedInTest('on small screens the menu is a drawer that opens, navigates and closes', async ({ page }) => {
  signedInTest.skip((page.viewportSize()?.width ?? 0) >= 1024, 'sidebar is always visible on large screens');
  await page.goto(paths.ops);

  const navigation = page.getByRole('navigation', { name: 'Main' });
  await expect(navigation).not.toBeInViewport();

  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(navigation).toBeInViewport();

  await page.keyboard.press('Escape');
  await expect(navigation).not.toBeInViewport();

  await page.getByRole('button', { name: 'Open menu' }).click();
  await navigation.getByRole('link', { name: 'Ledger' }).click();
  await expect(page).toHaveURL(paths.ledger);
  await expect(navigation).not.toBeInViewport();
});

signedInTest('a dialog opens from its button, is in the URL, and Escape closes it', async ({ page }) => {
  await page.goto(paths.booking(DEMO_IDS.booking));
  await page.getByRole('button', { name: /Cancel booking/ }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/dialog=cancel/);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page).not.toHaveURL(/dialog=/);
});

signedInTest('global search sends the query to user lookup', async ({ page }) => {
  signedInTest.skip((page.viewportSize()?.width ?? 0) < 768, 'search box is collapsed to an icon on phones');
  await page.goto(paths.ops);
  const search = page.getByRole('searchbox', { name: 'Find a user' });
  await search.fill('Rina');
  await search.press('Enter');
  await expect(page).toHaveURL(`${paths.users}?q=Rina`);
});

signedInTest('roles only see what they are allowed to (LLD-020 §3.2)', async ({ page }) => {
  await page.goto(paths.ops);
  await openNavigationIfCollapsed(page);
  await page.getByLabel('Preview as role').selectOption('SUPPORT_AGENT');

  const navigation = page.getByRole('navigation', { name: 'Main' });
  await expect(navigation.getByRole('link', { name: 'Bookings' })).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Verifications' })).toHaveCount(0);
  await expect(navigation.getByRole('link', { name: 'Ledger' })).toHaveCount(0);

  await page.goto(paths.verifications);
  await expect(page.getByText("You don't have access to this page")).toBeVisible();
  await expect(page.getByText('verification.review')).toBeVisible();
});

test('unknown URLs show the not-found page', async ({ page }) => {
  await page.goto('/this-page-does-not-exist');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});
