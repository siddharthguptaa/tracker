import { test, expect } from "@playwright/test";
import { seeded } from "./helpers";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "POST, OPTIONS" };
const msg = (content: any[], stop = "end_turn") => JSON.stringify({ id: "m", type: "message", role: "assistant", content, stop_reason: stop });
async function withKey(browser: any, handler: (route: any, n: number, body: any) => Promise<void> | void, w = 390) {
  const s = await seeded(browser, w, 800); const reqs: any[] = [];
  await s.page.evaluate(() => localStorage.setItem("tracker.ai.v1", JSON.stringify({ on: true, key: "sk-ant-e2e-key", model: "claude-test" })));
  await s.page.route("https://api.anthropic.com/**", async (route: any) => {
    const req = route.request(); if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const body = JSON.parse(req.postData() || "{}"); reqs.push({ headers: req.headers(), body }); await handler(route, reqs.length, body);
  });
  await s.page.reload(); await s.page.waitForSelector("#app .hh"); return { ...s, reqs };
}
const ok = (route: any, body: string) => route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body });
const openChat = async (page: any) => { await page.click("button[aria-label='Ask the assistant']"); await page.waitForSelector("#ch_in"); };
const ask = async (page: any, q: string) => { await page.fill("#ch_in", q); await page.click(".chin .btn"); };

test.describe("online analyst", () => {
  test("answers from real tool results, draws a chart, shows what it used", async ({ browser }) => {
    const { ctx, page, reqs, errors } = await withKey(browser, (route, n) => n === 1
      ? ok(route, msg([{ type: "tool_use", id: "t1", name: "list_goals", input: {} }, { type: "tool_use", id: "t2", name: "show_chart", input: { title: "Progress", kind: "bar", labels: ["A", "B", "C"], values: [10, 40, 25], unit: "%" } }], "tool_use"))
      : ok(route, msg([{ type: "text", text: "You have **several** goals.\n- first point\n- second point" }])));
    await openChat(page); await expect(page.locator("#ch_mode")).toContainText("Online analyst");
    await ask(page, "How are my goals doing?"); await expect(page.locator(".cm.a", { hasText: "several" })).toBeVisible();
    await expect(page.locator(".cm.a b", { hasText: "several" })).toHaveCount(1); await expect(page.locator(".aichart svg")).toHaveCount(1); await expect(page.locator(".cm.a", { hasText: "Used:" })).toContainText("list goals");
    expect(reqs.length).toBe(2); expect(reqs[0].headers["x-api-key"]).toBe("sk-ant-e2e-key"); expect(reqs[0].headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
    const toolRes = JSON.stringify(reqs[1].body.messages.at(-1)); expect(toolRes).toContain("tool_result"); expect(toolRes).toContain("progress_pct"); expect(errors).toEqual([]); await ctx.close();
  });
  test("nothing from the Vault is ever in a request", async ({ browser }) => {
    const { ctx, page, reqs } = await withKey(browser, (route, n) => n === 1 ? ok(route, msg([{ type: "tool_use", id: "t1", name: "overview", input: {} }, { type: "tool_use", id: "t2", name: "list_todos", input: { status: "all" } }, { type: "tool_use", id: "t3", name: "money_records", input: {} }], "tool_use")) : ok(route, msg([{ type: "text", text: "ok" }])));
    await openChat(page); await ask(page, "Give me everything"); await expect(page.locator(".cm.a", { hasText: "ok" })).toBeVisible();
    const all = JSON.stringify(reqs); for (const secret of ["demo.user@example.com", "Netflix", "4111", "HomeNet", "Locker combination"]) expect(all.includes(secret)).toBe(false); await ctx.close();
  });
  test("model text can't inject HTML", async ({ browser }) => {
    const { ctx, page } = await withKey(browser, (route) => ok(route, msg([{ type: "text", text: "<img src=x onerror=\"window.__pwn=1\"> <script>window.__pwn=1</script> hi" }])));
    await openChat(page); await ask(page, "hello there"); await expect(page.locator(".cm.a", { hasText: "hi" })).toBeVisible(); expect(await page.evaluate(() => (window as any).__pwn)).toBeUndefined(); expect(await page.locator(".cm.a img").count()).toBe(0); await ctx.close();
  });
  test("a rejected key falls back to the offline assistant and says why", async ({ browser }) => {
    const { ctx, page } = await withKey(browser, (route) => route.fulfill({ status: 401, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify({ error: { message: "invalid x-api-key" } }) }));
    await openChat(page); await ask(page, "how much did I spend this month"); await expect(page.locator(".cm.a", { hasText: "key was rejected" })).toBeVisible(); await ctx.close();
  });
  test("no connection: falls back to offline answers without hanging", async ({ browser }) => {
    const { ctx, page } = await withKey(browser, (route) => route.abort("internetdisconnected"));
    await openChat(page); await ask(page, "how much did I spend this month"); await expect(page.locator(".cm.a", { hasText: "Answering offline instead" })).toBeVisible(); await expect(page.locator(".chin .btn")).toBeVisible(); await ctx.close();
  });
  test("commands that change data stay on the offline assistant (never sent to the API)", async ({ browser }) => {
    const { ctx, page, reqs } = await withKey(browser, (route) => ok(route, msg([{ type: "text", text: "should not be called" }])));
    await openChat(page); await ask(page, "add todo buy milk tomorrow"); await expect(page.locator(".cm.a button", { hasText: /Add|Yes|Confirm/ }).first()).toBeVisible(); expect(reqs.length).toBe(0); await ctx.close();
  });
  test("no key: nothing is ever sent and the offline assistant works as before", async ({ browser }) => {
    const { ctx, page } = await seeded(browser); const ext: string[] = []; page.on("request", (r: any) => { if (r.url().includes("anthropic.com")) ext.push(r.url()); });
    await openChat(page); await expect(page.locator("#ch_mode")).toContainText("Offline"); await ask(page, "how much did I spend this month"); await expect(page.locator(".cm.a").nth(1)).toBeVisible(); expect(ext).toEqual([]); await ctx.close();
  });
  test("settings: save key, test it, remove it", async ({ browser }) => {
    const { ctx, page, reqs } = await withKey(browser, (route) => ok(route, msg([{ type: "text", text: "OK" }])));
    await openChat(page); await page.click("button[aria-label='Assistant settings']"); await expect(page.locator("#ai_set")).toContainText("Never sent"); expect(await page.locator("#ai_key").getAttribute("type")).toBe("password");
    await page.click("#ai_set button:text-is('Test')"); await expect(page.locator("#ai_set")).toContainText("Works"); expect(reqs.length).toBe(1);
    await page.click("#ai_set button:has-text('Remove key')"); expect(await page.evaluate(() => localStorage.getItem("tracker.ai.v1"))).not.toContain("sk-ant"); await expect(page.locator("#ch_mode")).toContainText("Offline"); await ctx.close();
  });
  test("the key is not in the backup data", async ({ browser }) => {
    const { ctx, page } = await withKey(browser, (route) => ok(route, msg([{ type: "text", text: "x" }]))); expect(await page.evaluate(() => localStorage.getItem("goal-tracker.v1")!.includes("sk-ant"))).toBe(false); await ctx.close();
  });
  for (const w of [320, 390, 1280]) test(`chat with a chart and settings has no sideways scroll at ${w}px`, async ({ browser }) => {
    const { ctx, page } = await withKey(browser, (route, n) => n === 1 ? ok(route, msg([{ type: "tool_use", id: "t", name: "show_chart", input: { title: "A long chart title that should wrap nicely on small phones", kind: "line", labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan2", "Feb2"], values: [1, 5, 3, 8, 2, 9, 4, 7, 6, 3, 8, 1, 2, 3] } }], "tool_use")) : ok(route, msg([{ type: "text", text: "A very long unbroken string " + "x".repeat(200) }])), w);
    await openChat(page); await ask(page, "chart it"); await expect(page.locator(".aichart svg")).toHaveCount(1); await page.click("button[aria-label='Assistant settings']");
    const over = await page.evaluate(() => { const s = document.querySelector(".sheet") as HTMLElement; const l = document.getElementById("ch_log") as HTMLElement; return [s.scrollWidth - s.clientWidth, l.scrollWidth - l.clientWidth, document.documentElement.scrollWidth - innerWidth]; }); expect(over.every((n: number) => n <= 0)).toBe(true); await ctx.close();
  });
});
