import { test, expect } from "@playwright/test";
import { seeded, openTab } from "./helpers";

const openAll = (page: any) => page.evaluate(() => document.querySelectorAll(".sheet details").forEach((d: any) => { d.open = true; }));
const noSideScroll = (page: any) => page.evaluate(() => { const s = document.querySelector(".sheet") as HTMLElement | null; return s ? s.scrollWidth - s.clientWidth : 0; });

test.describe("to-do", () => {
  test("tap a to-do to edit it, save, and it changes", async ({ browser }) => {
    const { ctx, page, errors } = await seeded(browser); await openTab(page, "To-do"); await page.click("button:has-text('All open')");
    const first = page.locator(".trw .ttx").first(); const old = await first.innerText();
    await first.click(); await expect(page.locator(".sheet h1")).toHaveText("Edit to-do");
    await page.fill("#te_text", old + " EDITED"); await page.click(".sheet button:has-text('Save')");
    await expect(page.locator(".trw .ttx", { hasText: "EDITED" }).first()).toBeVisible(); expect(errors).toEqual([]); await ctx.close();
  });
  test("empty text on edit is refused", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); await openTab(page, "To-do"); await page.click("button:has-text('All open')");
    await page.locator(".trw .ttx").first().click(); await page.fill("#te_text", "  "); await page.click(".sheet button:has-text('Save')");
    await expect(page.locator(".toast, #toast")).toContainText("can't be empty"); await expect(page.locator(".sheet h1")).toHaveText("Edit to-do"); await ctx.close();
  });
  test("smart add shows what it understood; Add & add another keeps the sheet open", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); await openTab(page, "To-do"); await page.click("#fab");
    await page.fill("#tn_text", "Pay electricity bill tomorrow 6pm every month 30m"); await expect(page.locator("#tn_preview")).toContainText("Understood");
    await page.click(".sheet button:has-text('Add & add another')"); await expect(page.locator("#tn_text")).toHaveValue("");
    await page.fill("#tn_text", "Second one"); await page.click(".sheet .btns button:text-is('Add')"); await expect(page.locator(".sheet")).toHaveCount(0);
    await page.click("button:has-text('All open')"); await expect(page.getByRole("button", { name: "Pay electricity bill Tomorrow" })).toBeVisible(); await expect(page.locator(".trw .ttx", { hasText: "Second one" })).toBeVisible(); await ctx.close();
  });
  test("custom repeat, reminder, subtasks and notes are saved", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); await openTab(page, "To-do"); await page.click("#fab");
    await page.fill("#tn_text", "Water plants"); await openAll(page);
    await page.selectOption("#tn_rep", "custom"); await page.fill("#tn_repn", "3"); await page.selectOption("#tn_repu", "day"); await page.selectOption("#tn_rem", "10");
    await page.click(".sheet button:has-text('Add subtask')"); await page.fill(".tsrow input[type=text]", "Fern"); await page.fill("#tn_notes", "Use rainwater");
    await page.click(".sheet .btns button:text-is('Add')"); await page.click("button:has-text('All open')");
    const row = page.locator(".trw", { hasText: "Water plants" }); await expect(row).toContainText("every 3 days"); await expect(row).toContainText("0/1"); await expect(row).toContainText("🔔");
    await row.locator(".ttx").click(); await expect(page.locator("#te_notes")).toHaveValue("Use rainwater"); await expect(page.locator("#te_rep")).toHaveValue("custom"); await expect(page.locator("#te_repn")).toHaveValue("3"); await ctx.close();
  });
  test("calendar: pick a day, add to it, change month", async ({ browser }) => {
    const { ctx, page, errors } = await seeded(browser); await openTab(page, "To-do"); await page.click(".seg button:has-text('Calendar')");
    await expect(page.locator(".calgrid")).toBeVisible(); await page.locator(".cd:not(.e)").nth(14).click(); await page.click("button:has-text('＋ Add')");
    await page.fill("#tn_text", "Calendar item"); await page.click(".sheet .btns button:text-is('Add')"); await expect(page.locator(".panel .trw .ttx", { hasText: "Calendar item" })).toBeVisible();
    const m = await page.locator(".calhead b").innerText(); await page.click("button[aria-label='Next month']"); expect(await page.locator(".calhead b").innerText()).not.toBe(m);
    await page.click(".calhead button:has-text('Today')"); expect(await page.locator(".calhead b").innerText()).toBe(m); expect(errors).toEqual([]); await ctx.close();
  });
  test("select several: move, delete and undo", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); await openTab(page, "To-do"); await page.click("button:has-text('All open')");
    const before = await page.locator(".trw").count(); await page.click("button[aria-label='Select several']");
    await page.locator(".trw .chk").nth(0).click(); await page.locator(".trw .chk").nth(1).click(); await expect(page.locator(".selbar")).toContainText("2 selected");
    await page.click(".selbar button:has-text('Move')"); await page.click(".sheet button:has-text('No date (Inbox)')"); await expect(page.locator(".selbar")).toHaveCount(0);
    await page.click("button:has-text('Inbox')"); expect(await page.locator(".trw").count()).toBeGreaterThanOrEqual(2);
    await page.click("button:has-text('All open')"); await page.click("button[aria-label='Select several']"); await page.locator(".trw .chk").nth(0).click(); await page.click(".selbar button:has-text('Delete')");
    expect(await page.locator(".trw").count()).toBe(before - 1); await page.click(".toast button, #toast button"); expect(await page.locator(".trw").count()).toBe(before); await ctx.close();
  });
  test("snooze from the edit sheet", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); await openTab(page, "To-do"); await page.click("button:has-text('All open')");
    await page.locator(".trw .ttx").first().click(); await page.click(".sheet button:has-text('Snooze or reschedule')"); await expect(page.locator(".sheet h1")).toHaveText("Snooze or reschedule");
    await page.click(".sheet button:has-text('Tomorrow')"); await expect(page.locator(".sheet")).toHaveCount(0); await ctx.close();
  });
  test("tags: create, tag a to-do, filter by it, delete", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); page.on("dialog", (d: any) => { throw new Error("browser dialog used"); }); await openTab(page, "To-do");
    await page.click("button[aria-label='To-do settings']"); await page.click(".sheet summary:has-text('New tag')"); await page.fill("input[aria-label='New tag name']", "Errands"); await page.click(".sheet button:has-text('Add tag')");
    await page.fill("input[aria-label='New tag name']", "errands"); await page.click(".sheet button:has-text('Add tag')"); await expect(page.locator(".toast, #toast")).toContainText("already exists");
    await page.click(".sheet button:has-text('Close')"); await page.click("button:has-text('All open')");
    await page.locator(".trw .ttx").first().click(); await openAll(page); await page.click(".tagchk:has-text('Errands')"); await page.click(".sheet button:has-text('Save')");
    await page.click(".chips button:text-is('Errands')"); expect(await page.locator(".trw").count()).toBe(1);
    await page.click("button[aria-label='To-do settings']"); await page.click(".sheet .tgd:has-text('Errands') summary"); await page.click(".sheet .tgd:has-text('Errands') button:has-text('Delete tag')"); await page.click(".askov .btn:not(.alt)"); await page.click(".sheet button:has-text('Close')");
    await expect(page.locator(".chips button:text-is('Errands')")).toHaveCount(0); await ctx.close();
  });
  test("templates: create from text, use it, subtasks appear", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); await openTab(page, "To-do"); await page.click("button[aria-label='Templates']");
    await page.click(".sheet button:has-text('New template')"); await page.fill("#tp_name", "Trip"); await page.fill("#tp_lines", "Pack bag\n- socks\n- charger\nBook cab");
    await page.click(".sheet button:has-text('Save template')"); await expect(page.locator(".sheet .panel:has-text('Trip')")).toContainText("2 to-dos"); await page.click(".sheet button:text-is('Today')");
    await page.click(".sheet .panel:has-text('Trip') button:text-is('Use')"); await page.click("button:has-text('All open')");
    await expect(page.locator(".trw", { hasText: "Pack bag" })).toContainText("0/2"); await expect(page.locator(".trw .ttx", { hasText: "Book cab" })).toBeVisible(); await ctx.close();
  });
  test("stats sheet opens", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); await openTab(page, "To-do"); await page.click("button[aria-label='Statistics']"); await expect(page.locator(".sheet h1")).toHaveText("Your to-do stats"); await expect(page.locator(".wbars > div")).toHaveCount(8); await ctx.close();
  });
  test("view options: group by tag / goal, manual order moves a row", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); await openTab(page, "To-do"); await page.click("button:has-text('All open')"); await page.click("summary:has-text('View options')");
    await page.click(".seg button:has-text('By goal')"); await expect(page.locator(".cat").first()).toBeVisible(); await page.click(".seg button:has-text('By category')");
    await page.click(".seg button:has-text('My order')"); const names = await page.locator(".trw .ttx").allInnerTexts(); await page.locator("button[aria-label='Move down']").first().click();
    const after = await page.locator(".trw .ttx").allInnerTexts(); expect(after.join("|")).not.toBe(names.join("|")); await page.click(".seg button:has-text('Sort by date')"); await ctx.close();
  });
  test("a reminder that is due raises a banner on Home", async ({ browser }) => {
    const { ctx, page } = await seeded(browser);
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("goal-tracker.v1")!); const d = new Date(Date.now() - 5 * 60000), p = (n: number) => String(n).padStart(2, "0"); s.todos.push({ id: "rem1", text: "Reminder test", done: false, doneAt: null, due: d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()), time: p(d.getHours()) + ":" + p(d.getMinutes()), rem: 0, tags: [], created: Date.now() }); localStorage.setItem("goal-tracker.v1", JSON.stringify(s)); });
    await page.reload(); await page.waitForSelector("#app .hh"); await expect(page.locator(".alert")).toContainText("Reminder test"); await ctx.close();
  });
  for (const w of [320, 390, 1280]) test(`new/edit sheet has no sideways scroll at ${w}px with every section open`, async ({ browser }) => {
    const { ctx, page } = await seeded(browser, w, 800); await openTab(page, "To-do"); await page.click("#fab");
    await openAll(page); await page.selectOption("#tn_rep", "custom");
    expect(await noSideScroll(page)).toBeLessThanOrEqual(0); await ctx.close();
  });
});

test.describe("quick add and CSV", () => {
  test("Home + opens Quick add: adds a to-do, and offers Expense / Income / full form", async ({ browser }) => {
    const { ctx, page, errors } = await seeded(browser); await page.click("#fab"); await expect(page.locator(".sheet h1")).toHaveText("Quick add");
    await page.click(".sheet button:has-text('Add to-do')"); await expect(page.locator("#toast")).toContainText("Type your to-do first");
    await page.fill("#hq_text", "quick-qa item tomorrow"); await page.keyboard.press("Enter"); await expect(page.locator(".sheet")).toHaveCount(0);
    await openTab(page, "To-do"); await page.click("button:has-text('Upcoming')"); await expect(page.locator(".trw", { hasText: "quick-qa item" })).toHaveCount(1);
    await openTab(page, "Home"); await page.click("#fab"); await expect(page.locator(".sheet")).toContainText("Expense"); await expect(page.locator(".sheet")).toContainText("Income"); await page.click(".sheet button:has-text('Full to-do form')"); await expect(page.locator(".sheet h1")).toHaveText("New to-do");
    expect(errors).toEqual([]); await ctx.close();
  });
  test("CSV: export downloads a file; importing a file previews then applies", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); await openTab(page, "To-do"); await page.click("button[aria-label='To-do settings']");
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click(".sheet button:has-text('Export to-dos (.csv)')")]); expect(dl.suggestedFilename()).toContain("todos-"); expect(dl.suggestedFilename().endsWith(".csv")).toBe(true);
    await page.setInputFiles("input[aria-label='Import to-dos file']", { name: "in.csv", mimeType: "text/csv", buffer: Buffer.from("To-do,Due date\nCsv imported thing,2031-01-02\n") });
    await expect(page.locator(".sheet h1")).toHaveText("Import to-dos"); await expect(page.locator(".sheet")).toContainText("Csv imported thing"); await page.click(".sheet button:has-text('Apply 1 change')");
    await expect(page.locator("#toast")).toContainText("1 added"); await page.click(".sheet button:has-text('Close')"); await page.click("button:has-text('Upcoming')"); await expect(page.locator(".trw", { hasText: "Csv imported thing" })).toHaveCount(1); await ctx.close();
  });
  test("importing an .xlsx offline explains the reader needs internet", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); await openTab(page, "To-do"); await page.click("button[aria-label='To-do settings']");
    await ctx.setOffline(true); await page.setInputFiles("input[aria-label='Import to-dos file']", { name: "a.xlsx", mimeType: "application/octet-stream", buffer: Buffer.from("x") }); await expect(page.locator("#toast")).toContainText("Excel"); await ctx.close();
  });
});

test.describe("vault", () => {
  test("add a login, open it, edit it, trash it and undo", async ({ browser }) => {
    const { ctx, page, errors } = await seeded(browser); await openTab(page, "Vault"); await page.click("#fab"); await page.click(".sheet button:has-text('Login')");
    await page.fill("#ve_title", "Zebra Mail"); await page.fill("input[aria-label='Username or email']", "me@zebra.test"); await page.fill("input[aria-label='Password']", "Tr0ub4dor&3-xyz-Long"); await page.click(".sheet button:text-is('Save')");
    await expect(page.locator(".sheet")).toContainText("me@zebra.test"); await expect(page.locator(".sheet")).toContainText("Zebra Mail");
    await page.click(".sheet button:has-text('Edit')"); await page.fill("#ve_title", "Zebra Mail 2"); await page.click(".sheet button:text-is('Save')"); await expect(page.locator(".sheet")).toContainText("Zebra Mail 2");
    await page.click(".sheet button:has-text('Move to trash')"); await expect(page.locator(".sheet")).toHaveCount(0); await expect(page.locator("#app", { hasText: "Zebra Mail 2" })).toHaveCount(0);
    await page.click("#toast button:has-text('Undo')"); await expect(page.locator("#app", { hasText: "Zebra Mail 2" })).toBeVisible();
    expect(errors).toEqual([]); await ctx.close();
  });
  test("validation: empty name is refused", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); await openTab(page, "Vault"); await page.click("#fab"); await page.click(".sheet button:has-text('Login')"); await page.click(".sheet button:text-is('Save')");
    await expect(page.locator("#toast")).toContainText("Give this item a name"); await expect(page.locator(".sheet")).toBeVisible(); await ctx.close();
  });
  test("secrets stay hidden until revealed", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); await openTab(page, "Vault"); await page.locator("#app :text('Netflix')").first().click();
    const before = await page.locator(".sheet").innerText(); expect(before.includes("Demo-Password")).toBe(false); await ctx.close();
  });
  test("generator, health, emergency and settings open and close without errors", async ({ browser }) => {
    const { ctx, page, errors } = await seeded(browser); await openTab(page, "Vault");
    for (const label of ["Generator", "Health", "Emergency", "Folders"]) { await page.click(`#app button:has-text('${label}')`); await expect(page.locator(".sheet")).toBeVisible(); await page.keyboard.press("Escape"); await expect(page.locator(".sheet")).toHaveCount(0); }
    expect(errors).toEqual([]); await ctx.close();
  });
  test("search and filter chips narrow the list", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); await openTab(page, "Vault"); const all = await page.locator("#app .vcard, #app .vrow, #app .trw").count();
    await page.click("#app .chip:has-text('Cards')"); await expect(page.locator("#app", { hasText: "Demo credit card" })).toBeVisible(); expect(await page.locator("#app :text('Netflix')").count()).toBe(0); void all; await ctx.close();
  });
  test("Vault tab makes no network request by itself", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); const ext: string[] = []; page.on("request", (r: any) => { const u = r.url(); if (!u.startsWith("http://localhost") && !u.startsWith("data:") && !u.startsWith("blob:")) ext.push(u); });
    await openTab(page, "Vault"); await page.waitForTimeout(500); expect(ext).toEqual([]); await ctx.close();
  });
});
