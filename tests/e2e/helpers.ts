import { readFileSync } from "node:fs";
import { join } from "node:path";
// Playwright runs from the project root, so a cwd-relative path works for both CJS and ESM test files.
import type { Page, BrowserContext } from "@playwright/test";

export const SEED = readFileSync(join(process.cwd(), "tests/fixtures/sample-seed.js"), "utf8");
export const WIDTHS = [320, 360, 390, 412, 768, 1024, 1280, 1920];
export const TABS = ["Home", "Goals", "To-do", "Money", "Vault"] as const;

/** Fresh context with sample data pre-loaded (the seed only fills an empty browser, like the original). */
export async function seeded(browser: any, w = 390, h = 844, opts: any = {}) {
  const ctx: BrowserContext = await browser.newContext({ viewport: { width: w, height: h }, acceptDownloads: true, ...opts });
  await ctx.addInitScript(SEED);
  const page: Page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await page.goto("/");
  await page.waitForSelector("#app h1, #app .hh");
  return { ctx, page, errors };
}
export async function openTab(page: Page, name: string) {
  await page.click(`nav button:has-text("${name}")`);
  await page.waitForTimeout(name === "Money" ? 1300 : 250);
}

/** Every visible control/heading rectangle in the page area, for overlap checks. */
export async function overlaps(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const vis = (e: Element) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 1 && r.height > 1 && s.visibility !== "hidden" && s.display !== "none" && +s.opacity > 0; };
    const hdr = Array.from(document.querySelectorAll("#app .themebtn")).filter(vis) as HTMLElement[];
    const out: string[] = [];
    const R = (e: Element) => e.getBoundingClientRect(), hit = (a: DOMRect, b: DOMRect) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
    for (let i = 0; i < hdr.length; i++) for (let j = i + 1; j < hdr.length; j++) if (hit(R(hdr[i]), R(hdr[j]))) out.push(`header buttons overlap: ${hdr[i].className} × ${hdr[j].className}`);
    const title = document.querySelector("#app h1") as HTMLElement | null;
    if (title && vis(title)) {
      // measure the text itself, not the full-width block
      const rg = document.createRange(); rg.selectNodeContents(title); const tr = rg.getBoundingClientRect();
      hdr.forEach((b) => { if (hit(tr, R(b))) out.push(`title text overlaps ${b.className}`); });
    }
    const nav = document.querySelector("nav") as HTMLElement;
    const fab = document.getElementById("fab");
    if (fab && vis(fab) && nav && hit(R(fab), R(nav))) out.push("fab overlaps nav");
    if (document.documentElement.scrollWidth > window.innerWidth + 1) out.push(`horizontal scroll: ${document.documentElement.scrollWidth} > ${window.innerWidth}`);
    return out;
  });
}
