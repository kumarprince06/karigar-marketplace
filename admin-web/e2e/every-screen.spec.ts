import { expect } from '@playwright/test';
import { DESIGN_SCREEN_INDEX } from '@/config/design-screen-index';
import { COLOR_THEME_STORAGE_KEY } from '@/lib/color-theme';
import {
  collectPageProblems,
  expectNoHorizontalOverflow,
  expectNoSeriousAccessibilityViolations,
  expectOpenDialogFitsViewport,
} from './support/page-health';
import { signedInTest as test } from './support/signed-in-test';

/**
 * Every designed frame (A-01a … A-06j), at every viewport project:
 * renders, has a heading, throws nothing, never scrolls sideways, and opens its dialog when the URL asks for one.
 */
for (const area of DESIGN_SCREEN_INDEX) {
  test.describe(area.area, () => {
    for (const screen of area.screens) {
      test(`${screen.id} ${screen.title}`, async ({ page }, testInfo) => {
        const problems = collectPageProblems(page);
        await page.goto(screen.to);
        await page.waitForLoadState('networkidle');

        await expect(page.getByRole('heading').first()).toBeVisible();
        await expect(page.getByText("You don't have access to this page")).toHaveCount(0);

        if (screen.to.includes('dialog=')) await expectOpenDialogFitsViewport(page);
        await expectNoHorizontalOverflow(page);

        await testInfo.attach(`${screen.id}-${testInfo.project.name}`, {
          body: await page.screenshot({ fullPage: true }),
          contentType: 'image/png',
        });
        expect(problems, 'console errors and warnings').toEqual([]);
      });
    }
  });
}

test.describe('accessibility', () => {
  test.skip(({ viewport }) => viewport?.width !== 1440, 'axe runs once, at desktop size');

  for (const screen of DESIGN_SCREEN_INDEX.flatMap((area) => area.screens)) {
    test(`${screen.id} has no serious WCAG violations`, async ({ page }) => {
      await page.goto(screen.to);
      await page.waitForLoadState('networkidle');
      await expectNoSeriousAccessibilityViolations(page);
    });
  }
});

test.describe('accessibility in dark mode', () => {
  test.skip(({ viewport }) => viewport?.width !== 1440, 'axe runs once, at desktop size');
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(
      (storageKey) => localStorage.setItem(storageKey, 'dark'),
      COLOR_THEME_STORAGE_KEY,
    );
  });

  for (const screen of DESIGN_SCREEN_INDEX.flatMap((area) => area.screens)) {
    test(`${screen.id} has no serious WCAG violations in dark mode`, async ({ page }) => {
      await page.goto(screen.to);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await expectNoSeriousAccessibilityViolations(page);
    });
  }
});
