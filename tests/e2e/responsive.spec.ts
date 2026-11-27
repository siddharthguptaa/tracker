import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { seeded } from "./helpers";
import { layoutCheck, problemsOf } from "./layout";

type Frame = ReturnType<Page["mainFrame"]>;

// Phones (portrait and landscape), tablets, laptops, desktops, a 2560px monitor, and 200% browser zoom (640px CSS width).
const VIEWPORTS: [number, number, string][] = [
  [320, 568, "phone-xs"], [360, 740, "phone-s"], [390, 844, "phone"], [430, 932, "phone-l"],
  [667, 375, "landscape-phone-s"], [844, 390, "landscape-phone"],
  [768, 1024, "tablet"], [820, 1180, "tablet-large"], [1024, 768, "tablet-landscape"], [1180, 820, "tablet-large-landscape"],
  [1280, 800, "laptop"], [1366, 768, "laptop-small"], [1440, 900, "desktop"], [1920, 1080, "full-hd"], [2560, 1440, "quad-hd"],
  [640, 800, "zoom-200"],
];

const tab = (p: Page, n: string) => p.click(`nav button:has-text("${n}")`);
const sub = (p: Page, n: string) => p.click(`.subtabs button:text-is("${n}")`);
const goalsSub = async (p: Page, n: string) => { await tab(p, "Goals"); await sub(p, n); return null; };
const goalDetail = async (p: Page) => { await tab(p, "Goals"); await sub(p, "Overview"); await p.locator(".card").first().click(); };
// Money is an embedded app in an iframe, so its screens are measured inside that frame too.
const moneyFrame = async (p: Page): Promise<Frame> => {
  await tab(p, "Money");
  const handle = await p.waitForSelector("#tallyframe", { state: "attached" });
  const frame = await handle.contentFrame();
  if (!frame) throw new Error("Money frame not found");
  await frame.waitForSelector("[aria-label='Add record']", { timeout: 15000 });
  return frame;
};

// Disclosure sections ("View options", "Repeat & reminder", …) are closed by default; their content is measured once open.
const openAllSections = (p: Page) => p.evaluate(() => { document.querySelectorAll("details").forEach((d) => { d.open = true; }); });

/** Every screen a user reaches by tapping, each opened from a fresh load. */
const SCREENS: { name: string; open: (p: Page) => Promise<Frame | null> }[] = [
  { name: "home", open: async (p) => { await tab(p, "Home"); return null; } },
  { name: "quick add", open: async (p) => { await tab(p, "Home"); await p.click("#fab"); return null; } },
  { name: "to-do", open: async (p) => { await tab(p, "To-do"); return null; } },
  { name: "to-do sheet", open: async (p) => { await tab(p, "To-do"); await p.click("#fab"); return null; } },
  { name: "vault", open: async (p) => { await tab(p, "Vault"); return null; } },
  { name: "vault sheet", open: async (p) => { await tab(p, "Vault"); await p.click("#fab"); return null; } },
  { name: "money", open: (p) => moneyFrame(p) },
  { name: "money sheet", open: async (p) => { const f = await moneyFrame(p); await f.click("[aria-label='Add record']"); return f; } },
  { name: "goals overview", open: (p) => goalsSub(p, "Overview") },
  { name: "goals yearly", open: (p) => goalsSub(p, "Yearly") },
  { name: "goals timeline", open: (p) => goalsSub(p, "Timeline") },
  { name: "goals trends", open: (p) => goalsSub(p, "Trends") },
  { name: "goals outlook", open: (p) => goalsSub(p, "Outlook") },
  { name: "goal detail", open: async (p) => { await goalDetail(p); return null; } },
  { name: "goal edit", open: async (p) => { await goalDetail(p); await p.click("button:text-is('Edit goal')"); return null; } },
  { name: "goal sheet", open: async (p) => { await tab(p, "Goals"); await sub(p, "Overview"); await p.click("#fab"); return null; } },
  { name: "year-end review", open: async (p) => { await tab(p, "Goals"); await sub(p, "Yearly"); await p.click("button:has-text('Year-end review')"); return null; } },
  { name: "settings", open: async (p) => { await tab(p, "Home"); await p.click("[aria-label='Settings']"); return null; } },
  { name: "confirm dialog", open: async (p) => { await tab(p, "Home"); await p.click("[aria-label='Settings']"); await p.click("button:has-text('Delete all goals')"); return null; } },
  { name: "to-do, all sections open", open: async (p) => { await tab(p, "To-do"); await openAllSections(p); return null; } },
  { name: "to-do sheet, all sections open", open: async (p) => { await tab(p, "To-do"); await p.click("#fab"); await openAllSections(p); return null; } },
  { name: "goal sheet, all sections open", open: async (p) => { await tab(p, "Goals"); await sub(p, "Overview"); await p.click("#fab"); await openAllSections(p); return null; } },
  { name: "goal detail, all sections open", open: async (p) => { await goalDetail(p); await openAllSections(p); return null; } },
  { name: "settings, all sections open", open: async (p) => { await tab(p, "Home"); await p.click("[aria-label='Settings']"); await openAllSections(p); return null; } },
];

/** Opens every screen at one width and returns the problems found, each tagged with its screen. */
async function sweep(page: Page, errors: string[], w: number): Promise<string[]> {
  const problems: string[] = [];
  for (const s of SCREENS) {
    errors.splice(0);
    await page.reload();
    await page.waitForSelector("#app h1, #app .hh");
    let frame: Frame | null = null;
    try {
      frame = await s.open(page);
      await page.waitForTimeout(400);
    } catch (e) {
      problems.push(`${s.name}: could not open (${String(e).split("\n")[0].slice(0, 140)})`);
      continue;
    }
    const isMoney = s.name.startsWith("money");
    for (const m of problemsOf(await page.evaluate(layoutCheck), w, { blankIfFewItems: !isMoney })) problems.push(`${s.name}: ${m}`);
    if (frame) for (const m of problemsOf(await frame.evaluate(layoutCheck), w, { viewportKnown: false })) problems.push(`${s.name} (Money app): ${m}`);
    for (const e of errors) problems.push(`${s.name}: ${e}`);
  }
  // Printed only when something is wrong, so a failing CI log shows every screen that broke, not just the first line.
  if (problems.length) console.log(`responsive ${w}px: ${problems.length} problem(s)\n  ${problems.join("\n  ")}`);
  return problems;
}

// A full sweep takes minutes on a real browser. The sandbox test shim has no per-test budget, so the call is optional.
const budget = (ms: number) => (test as unknown as { setTimeout?: (n: number) => void }).setTimeout?.(ms);

test.describe("responsive sweep: every screen at every size", () => {
  for (const [w, h, name] of VIEWPORTS) {
    test(`sweep · ${name} ${w}×${h}: every screen fits, nothing overlaps, no errors`, async ({ browser }) => {
      budget(300_000);
      const { ctx, page, errors } = await seeded(browser, w, h, { isMobile: w < 768, hasTouch: w < 1100 });
      page.setDefaultTimeout(8000);
      const problems = await sweep(page, errors, w);
      await ctx.close();
      expect(problems).toEqual([]);
    });
  }
  for (const [w, h, name] of [[320, 568, "phone-xs"], [1440, 900, "desktop"]] as const) {
    test(`sweep · ${name} ${w}×${h} dark: every screen fits`, async ({ browser }) => {
      budget(300_000);
      const { ctx, page, errors } = await seeded(browser, w, h, { isMobile: w < 768, hasTouch: w < 1100, colorScheme: "dark" });
      page.setDefaultTimeout(8000);
      const problems = await sweep(page, errors, w);
      await ctx.close();
      expect(problems).toEqual([]);
    });
  }
});
