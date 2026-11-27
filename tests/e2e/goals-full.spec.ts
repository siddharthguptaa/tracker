import { test, expect } from "@playwright/test";
import { seeded, openTab } from "./helpers";

const accept = (page: any) => page.on("dialog", (d: any) => { throw new Error("browser dialog used: " + d.message()); });
const yes = (page: any) => page.click(".askov .btn:not(.alt)");
const openAcc = (page: any) => page.evaluate(() => document.querySelectorAll("details.acc").forEach((d: any) => { d.open = true; }));
const sub = (page: any, n: string) => page.click(`.subtabs button:text-is('${n}')`);
const addGoal = async (page: any, name: string, o: { total?: string; unit?: string; type?: string; end?: string } = {}) => {
  await page.click("#fab"); await page.fill("#f_name", name); if (o.type) await page.selectOption("#f_type", o.type);
  if (o.total) await page.fill("#f_total", o.total); if (o.unit != null && !["milestones", "habit"].includes(o.type || "")) await page.fill("#f_unit", o.unit);
  await page.fill("#f_end", o.end || "2030-12-31"); await page.click(".sheet button:text-is('Save')");
};
const noSide = (page: any) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("goal detail and editing", () => {
  test("add, log, edit entry, delete entry with undo, edit goal, delete goal", async ({ browser }) => {
    const { ctx, page, errors } = await seeded(browser); accept(page); await openTab(page, "Goals");
    await addGoal(page, "QA savings", { total: "1000", unit: "₹" });
    await expect(page.locator("h1")).toHaveText("QA savings"); await openAcc(page);
    await page.fill("#la", "250"); await page.fill("#ln", "first"); await page.click(".panel button:text-is('Add entry')"); await expect(page.locator(".pct").first()).toContainText("25%");
    await page.click("button[aria-label='Edit entry']"); await page.fill("#ea", "500"); await page.click(".panel button:text-is('Save changes')"); await expect(page.locator(".pct").first()).toContainText("50%");
    await page.click("button[aria-label='Delete entry']"); await expect(page.locator(".pct").first()).toContainText("0%"); await page.click("#toast button:has-text('Undo')"); await expect(page.locator(".pct").first()).toContainText("50%");
    await page.click(".btns button:text-is('Edit goal')"); await page.fill("#f_name", "QA savings 2"); await page.click(".sheet button:text-is('Save')"); await expect(page.locator("h1")).toHaveText("QA savings 2");
    await page.click(".btns button:text-is('Edit goal')"); await page.click(".sheet button:text-is('Delete')"); await page.click(".askov .btn:not(.alt)"); await openTab(page, "Goals"); await page.click("#fab"); await page.click(".sheet button:text-is('Cancel')");
    await sub(page, "Overview"); await expect(page.locator(".card", { hasText: "QA savings 2" })).toHaveCount(0); expect(errors).toEqual([]); await ctx.close();
  });
  test("edit validation: name, total, dates, new category", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); await openTab(page, "Goals"); await page.click("#fab");
    await page.click(".sheet button:text-is('Save')"); await expect(page.locator("#toast")).toContainText("name");
    await page.fill("#f_name", "x"); await page.click(".sheet button:text-is('Save')"); await expect(page.locator("#toast")).toContainText("above 0");
    await page.fill("#f_total", "5"); await page.fill("#f_end", "2000-01-01"); await page.click(".sheet button:text-is('Save')"); await expect(page.locator("#toast")).toContainText("before start");
    await page.fill("#f_end", "2031-01-01"); await page.selectOption("#f_cat", "__new"); await page.click(".sheet button:text-is('Save')"); await expect(page.locator("#toast")).toContainText("category"); await ctx.close();
  });
  test("milestones: add, even checkpoints, toggle, edit, delete+undo", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); await openTab(page, "Goals"); await addGoal(page, "QA ms", { type: "milestones" }); await openAcc(page);
    await page.click("button:text-is('Add 4 evenly spaced checkpoints')"); await expect(page.locator("button[aria-label='Mark done']")).toHaveCount(4);
    await page.locator("button[aria-label='Mark done']").first().click(); await expect(page.locator(".pct").first()).toContainText("25%");
    await page.locator("button[aria-label='Edit milestone']").first().click(); await page.fill("#ms_et", "Renamed step"); await page.click(".panel button:text-is('Save changes')"); await expect(page.locator(".log", { hasText: "Renamed step" })).toHaveCount(1);
    await page.locator("button[aria-label='Delete milestone']").last().click(); await expect(page.locator("button[aria-label='Mark done']")).toHaveCount(3); await page.click("#toast button:has-text('Undo')"); await expect(page.locator("button[aria-label='Mark done']")).toHaveCount(4);
    await page.fill("#ms_t", "Extra"); await page.click("button:text-is('Add milestone')"); await expect(page.locator("button[aria-label='Mark done']")).toHaveCount(5); await ctx.close();
  });
  test("habit: check in from the card, tick days, walk back a week", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); await openTab(page, "Goals"); await addGoal(page, "QA habit", { type: "habit" });
    await page.click("button[aria-label='Previous week']"); await expect(page.locator("text=Week of")).toBeVisible(); await page.click("button[aria-label='Next week']");
    await page.locator(".hd:not([disabled])").first().click(); await expect(page.locator("text=Total check-ins")).toBeVisible(); await page.click(".backbar button");
    await page.click(".chip:text-is('All goals'), .seg button:text-is('All goals')"); const card = page.locator(".card", { hasText: "QA habit" }); await expect(card).toBeVisible(); await ctx.close();
  });
  test("recurring entry backfills past months and can be stopped", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); await openTab(page, "Goals"); await addGoal(page, "QA SIP", { total: "100000", unit: "₹" }); await openAcc(page);
    await page.fill("#rc_a", "1000"); await page.fill("#rc_f", "2026-01-01"); await page.click("button:text-is('Start recurring entry')"); await expect(page.locator("#toast")).toContainText("added");
    await expect(page.locator(".panel", { hasText: "Recurring entry" })).toContainText("On"); await page.click("button:text-is('Stop recurring entry')"); await expect(page.locator("summary", { hasText: "Recurring entry" })).toContainText("Off"); await ctx.close();
  });
  test("a goal that waits on another warns before an update", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); await openTab(page, "Goals"); await addGoal(page, "QA first", { total: "10", unit: "x" }); await openTab(page, "Goals");
    await page.click("#fab"); await page.fill("#f_name", "QA second"); await page.fill("#f_total", "10"); await page.fill("#f_end", "2030-12-31"); await page.locator(".deplist label", { hasText: "QA first" }).locator("input").check(); await page.click(".sheet button:text-is('Save')");
    await expect(page.locator(".panel", { hasText: "Waiting on" })).toContainText("QA first"); await openAcc(page);
    await page.fill("#la", "1"); await page.click(".panel button:text-is('Add entry')"); await expect(page.locator(".askov")).toContainText("QA first"); await page.click(".askov .btn.alt"); await expect(page.locator(".pct").first()).toContainText("0%");
    await page.click(".panel button:text-is('Add entry')"); await page.click(".askov .btn:not(.alt)"); await expect(page.locator(".pct").first()).toContainText("10%"); await ctx.close();
  });
  test("goal to-do is added from the goal and shows as open", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); await openTab(page, "Goals"); await addGoal(page, "QA todo goal", { total: "10", unit: "x" }); await openAcc(page);
    await page.fill("#gt_text", "Compare plans"); await page.click("button:text-is('Add to-do')"); await expect(page.locator("details[data-acc=todo] .vrow", { hasText: "Compare plans" })).toHaveCount(1); await ctx.close();
  });
});

test.describe("yearly, timeline, trends", () => {
  test("Yearly: star a goal, set a target, money check, make focus year", async ({ browser }) => {
    const { ctx, page, errors } = await seeded(browser); accept(page); await openTab(page, "Goals"); await sub(page, "Yearly");
    const y = new Date().getFullYear(); await expect(page.locator("h1")).toHaveText("Goals"); await expect(page.locator(".subtabs button.on")).toHaveText("Yearly");
    await page.click(`.chip:text-is('${y + 1}')`); await expect(page.locator(".panel.row")).toContainText("Make focus year");
    await page.locator(".star").first().click(); await expect(page.locator("h2.focus")).toContainText("(1)");
    await page.locator(".yrow input[type=number]").first().fill("777"); await page.locator(".yrow input[type=number]").first().blur(); await expect(page.locator(".yrow").first()).toContainText("777");
    await page.click("button:text-is('Make focus year')"); await expect(page.locator("#toast")).toContainText("focus year"); expect(errors).toEqual([]); await ctx.close();
  });
  test("Yearly: savings capacity shows surplus or shortfall", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); await openTab(page, "Goals"); await sub(page, "Yearly");
    const cap = page.locator("input[aria-label^='Savings capacity']"); if (await cap.count()) { await cap.fill("99999999"); await cap.blur(); await expect(page.locator(".mtot", { hasText: "Surplus" })).toHaveCount(1); await cap.fill("1"); await cap.blur(); await expect(page.locator(".mtot", { hasText: "Shortfall" })).toHaveCount(1); }
    await ctx.close();
  });
  test("Timeline shows bars and today line; Trends charts and per-goal chart", async ({ browser }) => {
    const { ctx, page, errors } = await seeded(browser); await openTab(page, "Goals"); await sub(page, "Timeline");
    await expect(page.locator(".tl .tbar").first()).toBeVisible(); await sub(page, "Trends"); await expect(page.locator("svg[aria-label='Overall progress over time']")).toBeVisible();
    await page.click(".chip:text-is('24 months')"); await page.locator(".trow").first().click(); await expect(page.locator(".panel svg[role=img]")).toHaveCount(2); await page.locator(".trow").first().click(); await expect(page.locator(".panel svg[role=img]")).toHaveCount(1);
    expect(errors).toEqual([]); await ctx.close();
  });
  test("Overview: search, sort, scope toggle, category chips", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); await openTab(page, "Goals");
    await page.click(".seg button:text-is('All goals')"); const n = await page.locator(".card").count(); await page.fill("#q", "zzzz-no-match"); await expect(page.locator(".card")).toHaveCount(0); await page.fill("#q", ""); expect(await page.locator(".card").count()).toBe(n);
    await page.selectOption("select[aria-label='Sort goals']", "name"); const names = await page.locator(".card h3").allInnerTexts(); expect(names.length).toBeGreaterThan(0); await ctx.close();
  });
});

test.describe("review and handover", () => {
  test("year review lists focus goals, saves a note, carries forward", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); await openTab(page, "Goals"); await sub(page, "Yearly"); await page.click("button.list-btn:has-text('Year-end review')");
    await expect(page.locator(".sheet h1")).toContainText("review"); await page.fill(".sheet textarea", "Went well"); await page.locator(".sheet textarea").blur();
    const carry = page.locator(".sheet button:has-text('Carry all')"); if (await carry.count()) { await carry.click(); await expect(page.locator("#toast")).toContainText("carried"); }
    const s = await page.evaluate(() => JSON.parse(localStorage.getItem("goal-tracker.v1")!).reviews); expect(JSON.stringify(s)).toContain("Went well"); await ctx.close();
  });
  test("handover: decide, use suggestions, apply creates drafts and parks dropped", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); accept(page);
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("goal-tracker.v1")!), Y = new Date().getFullYear(); s.plans = [{ id: "p1", age: 40, start: Y + "-01-01", end: (Y + 1) + "-12-31" }, { id: "p2", age: 42, start: (Y + 2) + "-01-01", end: (Y + 8) + "-12-31" }]; s.goals.forEach((g: any) => { g.plan = "p1"; }); localStorage.setItem("goal-tracker.v1", JSON.stringify(s)); });
    await page.reload(); await page.waitForSelector("#app h1"); await openTab(page, "Goals"); await expect(page.locator(".banner.bridge")).toBeVisible(); await page.click(".banner.bridge");
    await expect(page.locator(".sheet h1")).toContainText("→"); const und = page.locator(".sheet button:has-text('Use suggestions')"); await und.click(); await expect(page.locator(".sheet button:has-text('Use suggestions')")).toHaveCount(0);
    await page.locator(".dch button:has-text('Drop')").first().click(); await page.click(".sheet button:has-text('Apply')"); await page.click(".askov .btn:not(.alt)"); await expect(page.locator("#toast")).toContainText("draft");
    await page.click(".sheet button:text-is('Close')"); await page.click(".seg button:has-text('At 42')"); await expect(page.locator(".card.dcard").first()).toBeVisible(); await ctx.close();
  });
});

test.describe("import, export, settings", () => {
  test("CSV import previews changes, then applies; unticked rows are skipped", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); await openTab(page, "Goals"); await page.click(".subtabs button:text-is('Overview')");
    await page.click("#fab").catch(() => {}); await page.click(".sheet button:text-is('Cancel')").catch(() => {});
    await page.evaluate(() => (window as any).scrollTo(0, 0)); await page.click("nav button:has-text('Home')"); await page.click("button[aria-label='Settings']");
    const csv = 'Category,Goal Name,Goal Total,Start Date,End Date,Status\nQA,Imported A,500,2026-01-01,2030-01-01,In Progress\nQA,Imported B,700,2026-01-01,2030-01-01,\n';
    const [fc] = await Promise.all([page.waitForEvent("filechooser"), page.click("button.list-btn:has-text('Import from Excel or CSV')")]); await fc.setFiles({ name: "g.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await expect(page.locator(".sheet h1")).toHaveText("Import from Excel"); await page.locator(".sheet input[aria-label='Imported B']").uncheck(); await page.click(".sheet button:has-text('Apply 1 change')"); await expect(page.locator("#toast")).toContainText("1 added");
    const s = await page.evaluate(() => JSON.parse(localStorage.getItem("goal-tracker.v1")!).goals.map((g: any) => g.name)); expect(s.includes("Imported A")).toBe(true); expect(s.includes("Imported B")).toBe(false); await ctx.close();
  });
  test("CSV export downloads goals-DATE.csv with a header row", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); await page.click("button[aria-label='Settings']");
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("button.list-btn:has-text('Export goals to CSV')")]); expect(dl.suggestedFilename()).toContain("goals-"); expect(dl.suggestedFilename().endsWith(".csv")).toBe(true); await ctx.close();
  });
  test("Excel export falls back to CSV when the reader can't load (offline)", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); await page.route("**/xlsx*", (r: any) => r.abort()); await page.click("button[aria-label='Settings']");
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("button.list-btn:has-text('Export goals to Excel')")]); expect(dl.suggestedFilename().endsWith(".csv")).toBe(true); await ctx.close();
  });
  test("settings: categories, plans, stale days, focus year, delete all with undo", async ({ browser }) => {
    const { ctx, page, errors } = await seeded(browser); accept(page); await page.click("button[aria-label='Settings']");
    await page.fill("#newcat", "QA cat"); await page.click(".panel button:text-is('Add')"); await expect(page.locator("input[aria-label='Rename category QA cat']")).toHaveCount(1);
    await page.fill("input[aria-label='Rename category QA cat']", "QA cat 2"); await page.locator("input[aria-label='Rename category QA cat']").blur(); await expect(page.locator("input[aria-label='Rename category QA cat 2']")).toHaveCount(1);
    await page.click("button[aria-label='Delete category QA cat 2']"); await expect(page.locator("input[aria-label='Rename category QA cat 2']")).toHaveCount(0);
    await page.fill("#np_age", "50"); await page.fill("#np_end", "2050"); await page.click("button:text-is('Add plan')"); await expect(page.locator("button[aria-label='Delete plan At 50']")).toHaveCount(1); await page.click("button[aria-label='Delete plan At 50']");
    await page.fill("#np_age", "0"); await page.fill("#np_end", "2050"); await page.click("button:text-is('Add plan')"); await expect(page.locator("#toast")).toContainText("above");
    await page.selectOption("#set_stale", "30"); const stale = await page.evaluate(() => JSON.parse(localStorage.getItem("goal-tracker.v1")!).settings.staleDays); expect(stale).toBe(30);
    await page.click("button.list-btn:has-text('Delete all goals')"); await page.click(".askov .btn:not(.alt)"); const n = await page.evaluate(() => JSON.parse(localStorage.getItem("goal-tracker.v1")!).goals.length); expect(n).toBe(0);
    const todos = await page.evaluate(() => JSON.parse(localStorage.getItem("goal-tracker.v1")!).todos.length); expect(todos).toBeGreaterThan(0);
    await page.click("#toast button:has-text('Undo')"); const m = await page.evaluate(() => JSON.parse(localStorage.getItem("goal-tracker.v1")!).goals.length); expect(m).toBeGreaterThan(0); expect(errors).toEqual([]); await ctx.close();
  });
  test("check for update: same version, and a newer bundle offers Reload", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); await page.click("button[aria-label='Settings']");
    await page.evaluate(() => { const sc = document.createElement("script"); sc.setAttribute("src", "./assets/index-AAAAAAAA.js"); sc.setAttribute("type", "text/plain"); document.head.appendChild(sc); }); await page.evaluate(() => { const of = window.fetch.bind(window); window.fetch = ((u: any, o: any) => String(u).includes("index.html") ? Promise.resolve(new Response('<script src="./assets/index-ZZZZZZZZ.js"></script>', { status: 200 })) : of(u, o)) as any; }); await page.click("button.list-btn:has-text('Check for update')");
    await expect(page.locator("#toast")).toContainText("update"); await ctx.close();
  });
});

test.describe("navigation and launch", () => {
  test("reload lands on the same tab and goal", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); await openTab(page, "Goals"); await sub(page, "Timeline"); await page.evaluate(() => window.dispatchEvent(new Event("pagehide"))); await page.reload(); await page.waitForSelector("#app h1");
    await expect(page.locator("h1")).toHaveText("Goals"); await expect(page.locator(".subtabs button.on")).toHaveText("Timeline"); await ctx.close();
  });
  test("an old saved position is still remembered", async ({ browser }) => {
    const { ctx, page } = await seeded(browser);
    // Plant an old position on a page that stays open: reloading this page would save its own (Home) position on the way out.
    await page.evaluate(() => localStorage.setItem("tracker.nav.v1", JSON.stringify({ t: Date.now() - 30 * 24 * 3600 * 1000, tab: "vault" })));
    const p2 = await ctx.newPage(); await p2.goto("/"); await p2.waitForSelector("#app h1");
    await expect(p2.locator("h1")).toHaveText("Vault"); await ctx.close();
  });
  test("Back closes a sheet, then a goal, then returns Home", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); await openTab(page, "Goals"); await page.locator(".card").first().click(); await page.click(".btns button:text-is('Edit goal')"); await expect(page.locator(".sheet")).toBeVisible();
    await page.goBack(); await expect(page.locator(".sheet")).toHaveCount(0); await page.goBack(); await expect(page.locator(".backbar")).toHaveCount(0); await page.goBack(); await expect(page.locator("nav button.on, nav button[aria-current]").first()).toContainText("Home"); await ctx.close();
  });
  test("home-screen shortcut ?add=todo opens the new to-do sheet; ?tab=money opens Money", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); await page.goto("/?add=todo"); await expect(page.locator(".sheet h1")).toHaveText("New to-do"); await page.goto("/?tab=money"); await page.waitForTimeout(500); await expect(page.locator("h1")).toHaveText("Money"); await ctx.close();
  });
});

test.describe("goal screens have no overlap or sideways scroll", () => {
  for (const w of [320, 390, 1280]) test(`every goals sub-tab and the edit sheet at ${w}px`, async ({ browser }) => {
    const { ctx, page } = await seeded(browser, w, w < 500 ? 800 : 900); await openTab(page, "Goals");
    for (const t of ["Overview", "Yearly", "Timeline", "Trends", "Outlook"]) { await sub(page, t); await page.waitForTimeout(150); expect(await noSide(page)).toBeLessThanOrEqual(1); }
    await sub(page, "Overview"); await page.locator(".card").first().click(); await openAcc(page); expect(await noSide(page)).toBeLessThanOrEqual(1);
    await page.click(".btns button:text-is('Edit goal')"); expect(await page.evaluate(() => { const s = document.querySelector(".sheet") as HTMLElement; return s.scrollWidth - s.clientWidth; })).toBeLessThanOrEqual(1); await ctx.close();
  });
});

test.describe("in-app confirm dialog", () => {
  test("looks like the app, Esc and Cancel keep the data, no sideways scroll at 320px", async ({ browser }) => {
    const { ctx, page } = await seeded(browser, 320, 700); accept(page); await page.click("button[aria-label='Settings']");
    await page.click("button.list-btn:has-text('Delete all goals')"); await expect(page.locator(".askov [role=alertdialog]")).toBeVisible();
    expect(await page.evaluate(() => { const d = document.querySelector(".askov .panel") as HTMLElement, r = d.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; })).toBe(true);
    await page.keyboard.press("Escape"); await expect(page.locator(".askov")).toHaveCount(0);
    await page.click("button.list-btn:has-text('Delete all goals')"); await page.click(".askov .btn.alt"); await expect(page.locator(".askov")).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("goal-tracker.v1")!).goals.length)).toBeGreaterThan(0); await ctx.close();
  });
});

test.describe("home and settings match the classic layout", () => {
  test("Home has the Focus card and Today rows have no delete ✕", async ({ browser }) => {
    const { ctx, page } = await seeded(browser, 390, 844); await page.click("nav button:has-text('Home')");
    await expect(page.locator(".banner", { hasText: "Focus" }).first()).toBeVisible();
    await expect(page.locator("button[aria-label^='Delete ']")).toHaveCount(0);
    await expect(page.locator(".dcard", { hasText: "Vault" }).first()).toContainText("passwords to fix");
    await expect(page.locator("button[aria-label='Quick add']")).toHaveCount(1); await ctx.close();
  });
  test("Settings theme shows all five choices inside the screen at 320px; accent is a row of swatches", async ({ browser }) => {
    const { ctx, page } = await seeded(browser, 320, 700); await page.click("button[aria-label='Settings']");
    for (const l of ["Automatic", "Light", "Dark", "Eye comfort", "Night comfort"]) await expect(page.locator(".seg.wrap button", { hasText: l })).toBeVisible();
    expect(await page.locator(".seg.wrap button").evaluateAll((els) => els.every((e) => e.getBoundingClientRect().right <= innerWidth + 0.5))).toBe(true);
    await expect(page.locator(".sws button")).toHaveCount(5); expect(await noSide(page)).toBeLessThanOrEqual(1); await ctx.close();
  });
});
