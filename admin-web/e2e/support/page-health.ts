import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** Collects uncaught errors and console errors/warnings for the lifetime of the page. */
export function collectPageProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`Uncaught: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      problems.push(`console.${message.type()}: ${message.text()}`);
    }
  });
  return problems;
}

/**
 * Nothing may push the page wider than the viewport. Wide tables are fine as long as they
 * scroll inside their own container, so we measure the page and the main scroll area, not the tables.
 */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const scrollAreas = [document.documentElement, document.querySelector('main')].filter(
      (element): element is HTMLElement => element instanceof HTMLElement,
    );
    return scrollAreas
      .map((element) => ({
        element: element.tagName.toLowerCase(),
        overflowPixels: element.scrollWidth - element.clientWidth,
      }))
      .filter((area) => area.overflowPixels > 1);
  });
  expect(overflow, 'content wider than the screen').toEqual([]);
}

/** Every open dialog must fit inside the viewport. */
export async function expectOpenDialogFitsViewport(page: Page) {
  const dialog = page.locator('dialog[open]');
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  const viewport = page.viewportSize();
  expect(box && viewport && box.x >= 0 && box.x + box.width <= viewport.width + 1, 'dialog fits').toBe(true);
}

/** WCAG 2.1 A/AA checks; only serious and critical findings fail the test. */
export async function expectNoSeriousAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blocking = results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => ({
      rule: violation.id,
      impact: violation.impact,
      help: violation.help,
      targets: violation.nodes.slice(0, 3).map((node) => node.target.join(' ')),
    }));
  expect(blocking, 'accessibility violations').toEqual([]);
}
