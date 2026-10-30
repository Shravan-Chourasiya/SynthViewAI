import { expect, test, type Page } from '@playwright/test';

/**
 * Theme acceptance tests (docs/theme-audit.md).
 *
 * 1. A toggle must repaint every sampled element to the exact colours the page
 *    would have if it had been loaded in that theme already — one frame later.
 * 2. A reload must paint the stored theme on the very first frame (no flash).
 * 3. With "system" selected, OS colour-scheme changes apply live.
 */

type Sample = { signature: string; color: string; background: string };

const PAGES = [
  { name: 'landing', url: '/' },
  { name: 'about', url: '/about' },
  { name: 'contact', url: '/contact' },
];

const MIN_ELEMENTS = 30;
const SAMPLE_LIMIT = 40;

async function setStoredTheme(page: Page, theme: 'dark' | 'light' | 'system') {
  await page.evaluate((value) => window.localStorage.setItem('synthview-theme', value), theme);
}

/** Waits until transition suppression is lifted and two frames have passed. */
async function settle(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const next = () => {
          if (document.documentElement.classList.contains('theme-switching')) {
            requestAnimationFrame(next);
            return;
          }
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        };
        next();
      }),
  );
}

/**
 * The control that was just clicked keeps its own 200ms colour transition while
 * the pointer leaves it (`transition-all` on Button + `hover:text-foreground`).
 * That is pointer state, not theme state, so let it come to rest before sampling.
 */
async function settleToggle(page: Page) {
  await page.waitForFunction(() => {
    const holder = window as unknown as { __toggleColour?: string; __toggleStable?: number };
    const button = document.querySelector('button[aria-label*="theme"]');
    if (!button) return false;
    const svg = button.querySelector('svg');
    const value = `${getComputedStyle(button).color}|${svg ? getComputedStyle(svg).color : ''}`;
    if (holder.__toggleColour === value) holder.__toggleStable = (holder.__toggleStable ?? 0) + 1;
    else {
      holder.__toggleColour = value;
      holder.__toggleStable = 0;
    }
    return (holder.__toggleStable ?? 0) >= 3;
  });
}

/** Computed colour of the first N visible elements, in document order. */
async function sample(page: Page): Promise<Sample[]> {
  return page.evaluate(
    ({ limit }) => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      const elements = Array.from(document.querySelectorAll<HTMLElement>('body *'))
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        })
        .slice(0, limit);
      return elements.map((element) => {
        const style = getComputedStyle(element);
        // Identity, so a re-render that shifts the DOM does not read as a colour bug.
        const signature = `${element.tagName.toLowerCase()}${
          element.id ? `#${element.id}` : ''
        }.${element.getAttribute('class') ?? ''}`;
        return { signature, color: style.color, background: style.backgroundColor };
      });
    },
    { limit: SAMPLE_LIMIT },
  );
}

function expectSameColours(actual: Sample[], reference: Sample[]) {
  expect(
    actual.length,
    `sampled ${actual.length} elements after the toggle vs ${reference.length} in the reference render`,
  ).toBeGreaterThanOrEqual(MIN_ELEMENTS);
  expect(actual.map((entry) => entry.signature)).toEqual(reference.map((entry) => entry.signature));

  const mismatches: Array<{ signature: string; reference: Sample; actual: Sample }> = [];
  for (let index = 0; index < Math.min(actual.length, reference.length); index += 1) {
    if (
      actual[index]!.color !== reference[index]!.color ||
      actual[index]!.background !== reference[index]!.background
    ) {
      mismatches.push({
        signature: actual[index]!.signature,
        reference: reference[index]!,
        actual: actual[index]!,
      });
    }
  }
  expect(mismatches, JSON.stringify(mismatches, null, 2)).toEqual([]);
}

test.describe('Theme switching', () => {
  for (const { name, url } of PAGES) {
    test(`toggling repaints ${name} (${url}) to the new theme in one frame`, async ({ page }) => {
      // Reference render: the page loaded in light theme from the start.
      await page.goto(url);
      await setStoredTheme(page, 'light');
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
      await page.waitForTimeout(400);
      const reference = await sample(page);

      // Subject render: the same page loaded dark, then toggled through the UI.
      await setStoredTheme(page, 'dark');
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await page.waitForTimeout(400);

      await page.getByRole('button', { name: 'Switch to light theme' }).click();
      await settle(page);
      await page.mouse.move(0, 0);
      await settleToggle(page);
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

      const after = await sample(page);
      expectSameColours(after, reference);

      // And the reverse direction must hold too.
      await page.getByRole('button', { name: 'Switch to dark theme' }).click();
      await settle(page);
      await page.mouse.move(0, 0);
      await settleToggle(page);
      const backToDark = await sample(page);
      expect(backToDark.map((entry) => entry.color)).not.toEqual(after.map((entry) => entry.color));
    });
  }

  test('a reload paints the stored theme on the first frame', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('synthview-theme', 'light');
      const state = {
        events: [] as Array<{ at: number; theme: string }>,
        firstFrame: null as { at: number; theme: string } | null,
      };
      (window as unknown as { __themeState: typeof state }).__themeState = state;

      // documentElement does not exist yet when an init script first runs, so
      // everything is deferred to the first animation frame. rAF callbacks run
      // before the frame is painted and before any rAF the app registers later,
      // so this reads exactly the theme the browser is about to show — after the
      // inline script in index.html, before the first painted frame's successors.
      requestAnimationFrame(() => {
        const theme = document.documentElement.dataset.theme ?? '';
        state.firstFrame = { at: performance.now(), theme };
        state.events.push({ at: performance.now(), theme });
        // Any change after the first frame would be a correction of a wrong flash.
        new MutationObserver(() =>
          state.events.push({ at: performance.now(), theme: document.documentElement.dataset.theme ?? '' }),
        ).observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['class', 'data-theme'],
        });
      });
    });

    await page.goto('/');

    await expect
      .poll(() =>
        page.evaluate(() =>
          Boolean((window as unknown as { __themeState: { firstFrame: unknown } }).__themeState?.firstFrame),
        ),
      )
      .toBe(true);
    const state = await page.evaluate(
      () => (window as unknown as { __themeState: { events: unknown; firstFrame: unknown } }).__themeState,
    );

    expect(state.firstFrame.theme, 'first painted frame must be the stored theme').toBe('light');

    const laterChanges = state.events.filter((event: { at: number }) => event.at > state.firstFrame.at);
    expect(
      laterChanges.every((event: { theme: string }) => event.theme === 'light'),
      `theme corrections after the first frame: ${JSON.stringify(laterChanges)}`,
    ).toBe(true);
    await expect(page.locator('html')).toHaveClass(/light/);
  });

  test('a reload without a stored preference paints dark on the first frame', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem('synthview-theme');
      (window as unknown as { __firstTheme: string }).__firstTheme = '';
      requestAnimationFrame(() => {
        (window as unknown as { __firstTheme: string }).__firstTheme =
          document.documentElement.dataset.theme ?? '';
      });
    });

    await page.goto('/');
    await expect
      .poll(() =>
        page.evaluate(() => (window as unknown as { __firstTheme: string }).__firstTheme),
      )
      .toBe('dark');
  });

  test('system mode follows OS colour-scheme changes live', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await setStoredTheme(page, 'system');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    await page.emulateMedia({ colorScheme: 'dark' });
    await settle(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.emulateMedia({ colorScheme: 'light' });
    await settle(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });
});
