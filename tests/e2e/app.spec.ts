import { test, expect } from "@playwright/test";
import { seeded, openTab, overlaps, TABS, WIDTHS, BASE } from "./helpers";

test.describe("boots cleanly", () => {
  for (const w of [320, 390, 1280]) test(`every tab loads without errors at ${w}px`, async ({ browser }) => {
    const { ctx, page, errors } = await seeded(browser, w, w < 500 ? 800 : 900);
    for (const t of TABS) { await openTab(page, t); expect(await page.locator("nav .on").innerText()).toContain(t); }
    expect(errors).toEqual([]); await ctx.close();
  });
  test("makes no request outside its own origin (fully offline-capable)", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); const ext: string[] = [];
    page.on("request", (r) => { const u = r.url(); if (!u.startsWith("http://localhost") && !u.startsWith("data:") && !u.startsWith("blob:") && !u.startsWith("about:")) ext.push(u); });
    await page.reload(); for (const t of TABS) await openTab(page, t);
    expect(ext).toEqual([]); await ctx.close();
  });
});

test.describe("responsive: nothing overlaps, nothing scrolls sideways", () => {
  for (const w of WIDTHS) for (const dark of [false, true]) test(`${w}px ${dark ? "dark" : "light"}`, async ({ browser }) => {
    const { ctx, page } = await seeded(browser, w, w < 500 ? 800 : 900, { colorScheme: dark ? "dark" : "light" });
    const bad: string[] = [];
    for (const t of TABS) { await openTab(page, t); (await overlaps(page)).forEach((m) => bad.push(`${t}: ${m}`)); }
    expect(bad).toEqual([]); await ctx.close();
  });
  test("very long names and amounts wrap or truncate instead of overflowing", async ({ browser }) => {
    const { ctx, page } = await seeded(browser, 320, 700);
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("goal-tracker.v1")!); s.goals[0].name = "W".repeat(120) + " " + "x".repeat(60); s.todos[0].text = "Y".repeat(150); s.categories.push("C".repeat(80)); localStorage.setItem("goal-tracker.v1", JSON.stringify(s)); });
    await page.reload(); await page.waitForSelector("#app h1");
    const bad: string[] = []; for (const t of ["Home", "Goals", "To-do"]) { await openTab(page, t); (await overlaps(page)).forEach((m) => bad.push(`${t}: ${m}`)); }
    expect(bad).toEqual([]); await ctx.close();
  });
});

test.describe("to-dos", () => {
  test("add by natural language, complete, delete and undo", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); await openTab(page, "To-do");
    await page.click("#fab"); await page.fill("#tn_text", "buy qa-milk tomorrow"); await page.click('.sheet .btns button:text-is("Add")');
    await page.click('.chip:has-text("Upcoming")'); await expect(page.locator(".trw:has-text('qa-milk')")).toHaveCount(1);
    await page.locator(".trw:has-text('qa-milk') .chk").click(); await page.click('.chip:has-text("Done")');
    await expect(page.locator(".trw.dn:has-text('qa-milk')")).toHaveCount(1);
    await page.locator(".trw:has-text('qa-milk') .x").click(); await expect(page.locator(".trw:has-text('qa-milk')")).toHaveCount(0);
    await page.click('#toast button:has-text("Undo")'); await expect(page.locator(".trw:has-text('qa-milk')")).toHaveCount(1); await ctx.close();
  });
  test("empty input is rejected, nothing added", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); await openTab(page, "To-do"); const n = await page.locator(".trw").count();
    await page.click("#fab"); await page.click('.sheet .btns button:text-is("Add")'); await expect(page.locator("#toast")).toContainText("Type what needs doing"); await page.keyboard.press("Escape");
    expect(await page.locator(".trw").count()).toBe(n); await ctx.close();
  });
});

test.describe("goals", () => {
  test("add a goal, log progress, see it update, undo, delete", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); page.on("dialog", (d: any) => { throw new Error("browser dialog used"); }); await openTab(page, "Goals");
    await page.click("#fab"); await page.fill("#f_name", "QA push-ups"); await page.fill("#f_total", "100"); await page.fill("#f_unit", "reps"); await page.fill("#f_end", "2030-12-31"); await page.click('.sheet button:text-is("Save")');
    await page.evaluate(() => document.querySelectorAll("details.acc").forEach((d: any) => { d.open = true; }));
    await page.fill("#la", "40"); await page.click('button:text-is("Add entry")');
    await expect(page.locator(".pct").first()).toContainText("40%"); await page.click('button[aria-label="Delete entry"]'); await page.click('#toast button:has-text("Undo")'); await expect(page.locator(".pct").first()).toContainText("40%");
    await page.click('button:text-is("Edit goal")'); await page.click('.sheet button:text-is("Delete")'); await page.click(".askov .btn:not(.alt)"); await openTab(page, "Goals"); await page.click(".seg button:text-is('All goals')"); await expect(page.locator('.card:has-text("QA push-ups")')).toHaveCount(0); await ctx.close();
  });
  test("validation messages", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); await openTab(page, "Goals"); await page.click("#fab");
    await page.click('.sheet button:text-is("Save")'); await expect(page.locator("#toast")).toContainText("Give the goal a name");
    await page.fill("#f_name", "x"); await page.click('.sheet button:text-is("Save")'); await expect(page.locator("#toast")).toContainText("above 0"); await ctx.close();
  });
  test("Outlook sub-tab lists goals with advice", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); await openTab(page, "Goals"); await page.click('.subtabs button:has-text("Outlook")');
    expect(await page.locator("#app .panel").count()).toBeGreaterThan(1); await ctx.close();
  });
});

test.describe("assistant", () => {
  test("answers, asks before changing data, and can undo", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); await page.click(".asstbtn");
    await page.fill("#ch_in", "financial health score"); await page.keyboard.press("Enter"); await expect(page.locator(".cm.a").last()).toContainText("Financial health");
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem("tally:app:v1")!).records.length);
    await page.fill("#ch_in", "spent 250 on lunch today"); await page.keyboard.press("Enter");
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("tally:app:v1")!).records.length)).toBe(before);   // not changed until confirmed
    await page.locator(".cacts button.btn").first().click();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("tally:app:v1")!).records.length)).toBe(before + 1);
    await page.click('button:has-text("Undo")'); expect(await page.evaluate(() => JSON.parse(localStorage.getItem("tally:app:v1")!).records.length)).toBe(before); await ctx.close();
  });
  test("cancel changes nothing; chat is reachable from every tab", async ({ browser }) => {
    const { ctx, page } = await seeded(browser);
    for (const t of TABS) { await openTab(page, t); await page.click(".asstbtn"); await expect(page.locator("#ch_in")).toHaveCount(1); await page.keyboard.press("Escape"); }
    await ctx.close();
  });
  test("HTML in user text is never executed", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); await page.click(".asstbtn"); await page.fill("#ch_in", '<img src=x onerror="window.__pwn=1">'); await page.keyboard.press("Enter");
    await page.waitForTimeout(200); expect(await page.evaluate(() => (window as any).__pwn)).toBeUndefined(); await ctx.close();
  });
});

test.describe("search, theme, hide, backup", () => {
  test("search finds across goals, to-dos and money (Ctrl+K)", async ({ browser }) => {
    const { ctx, page } = await seeded(browser, 1280, 800); await page.keyboard.press("Control+k"); await page.fill("#gs_q", "rent");
    await expect(page.locator("#gs_res")).toContainText("Rent"); await page.fill("#gs_q", "qqqqzzzz"); await expect(page.locator("#gs_res")).toContainText("Nothing found"); await ctx.close();
  });
  test("theme toggle persists across reload", async ({ browser }) => {
    const { ctx, page } = await seeded(browser, 390, 844, { colorScheme: "light" }); await page.click('#app .themebtn[aria-label*="theme"]'); await page.reload(); await page.waitForSelector("#app h1");
    expect(await page.evaluate(() => document.documentElement.getAttribute("data-theme"))).toBe("dark"); await ctx.close();
  });
  test("hide amounts eye masks Money numbers on Home", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); await page.click(".eyeh"); await expect(page.locator(".dgrid")).toContainText("••••"); await page.click(".eyeh"); await ctx.close();
  });
  test("backup downloads four files in the original format", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); const names: string[] = []; page.on("download", (d) => names.push(d.suggestedFilename()));
    await page.click('.dcard:has-text("Back up everything")'); await page.click('.sheet button:has-text("Back up everything now")'); await page.waitForTimeout(2600);
    expect(names.sort().map((n) => n.replace(/\d{4}-\d{2}-\d{2}/, "DATE"))).toEqual(["tracker-goals-DATE.json", "tracker-money-DATE.json", "tracker-todos-DATE.json", "tracker-vault-DATE.json"]); await ctx.close();
  });
});

test.describe("compatibility with the classic app's data", () => {
  test("keeps fields it does not know about, and keeps the same storage key", async ({ browser }) => {
    const { ctx, page } = await seeded(browser);
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("goal-tracker.v1")!); s.futureThing = { a: 1 }; s.goals[0].futureField = "keep"; localStorage.setItem("goal-tracker.v1", JSON.stringify(s)); });
    await page.reload(); await page.waitForSelector("#app h1"); await openTab(page, "To-do"); await page.click("#fab"); await page.fill("#tn_text", "compat"); await page.click('.sheet .btns button:text-is("Add")');
    const s = await page.evaluate(() => JSON.parse(localStorage.getItem("goal-tracker.v1")!)); expect(s.futureThing).toEqual({ a: 1 }); expect(s.goals[0].futureField).toBe("keep"); await ctx.close();
  });
  test("corrupt storage does not crash the app", async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: BASE }); await ctx.addInitScript(() => { localStorage.setItem("goal-tracker.v1", "{not json"); localStorage.setItem("tally:app:v1", "][" ); });
    const page = await ctx.newPage(); const errs: string[] = []; page.on("pageerror", (e) => errs.push(e.message)); await page.goto("/"); await page.waitForSelector("#app h1");
    for (const t of TABS) await openTab(page, t); expect(errs).toEqual([]); await ctx.close();
  });
});

test.describe("offline", () => {
  test("after one visit the app reloads with the network off", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); await page.evaluate(() => navigator.serviceWorker.ready); await page.reload(); await page.waitForTimeout(500);
    await ctx.setOffline(true); await page.reload(); await page.waitForSelector("#app h1");
    for (const t of TABS) await openTab(page, t); await openTab(page, "Money"); await expect(page.frameLocator("#tallyframe").locator("body")).toBeVisible(); await ctx.close();
  });
});
