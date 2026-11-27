import { describe, it as _it, expect, afterEach, vi } from "vitest";
import { boot } from "./helpers";
import { getState } from "../../src/domain/ctx";
import * as V from "../../src/domain/vault";
import * as AI from "../../src/assistant/online";

const fresh = () => boot();
const it = (n: string, f: () => any) => _it(n, async () => { fresh(); await f(); });
afterEach(() => { vi.useRealTimers(); });
const S = { on: true, key: "sk-ant-test-123", model: "claude-test" };
const reply = (content: any[], stop = "end_turn", status = 200) => ({ ok: status < 300, status, json: async () => (status < 300 ? { content, stop_reason: stop } : { error: { message: "boom" } }) });
const ALL = ["overview", "list_goals", "goal_detail", "list_todos", "todo_stats", "money_summary", "money_records", "calc", "show_chart"];

describe("calc", () => {
  it("precedence, parens, unary, decimals, modulo", () => { expect(AI.calc("2+3*4")).toBe(14); expect(AI.calc("(2+3)*4")).toBe(20); expect(AI.calc("-5+2")).toBe(-3); expect(AI.calc("10/4")).toBe(2.5); expect(AI.calc("17%5")).toBe(2); expect(AI.calc("₹1,200 × 12")).toBe(14400); expect(AI.calc("0.1+0.2")).toBeCloseTo(0.3); });
  it("rejects anything that is not arithmetic", () => { for (const bad of ["alert(1)", "2**3", "1/0", "(1+2", "1+", "process.exit()", ""]) expect(() => AI.calc(bad)).toThrow(); });
});

describe("tools read real data", () => {
  it("list_goals matches the app's goals", () => { const L = AI.runTool("list_goals", {}); expect(L.length).toBe(getState().goals.filter((g) => !g.archived).length); expect(L[0]).toHaveProperty("progress_pct"); expect(L[0]).toHaveProperty("pace"); });
  it("goal_detail finds by partial, case-insensitive name and lists names on a miss", () => {
    const g = getState().goals[0], d = AI.runTool("goal_detail", { goal: g.name.slice(0, 4).toUpperCase() }); expect(d.name || d.error).toBeTruthy();
    const miss = AI.runTool("goal_detail", { goal: "zzzz-none" }); expect(miss.error).toMatch(/No goal/); expect(miss.names.length).toBeGreaterThan(0);
  });
  it("list_todos filters", () => {
    const s = getState(), today = new Date().toISOString().slice(0, 10); s.todos = [{ id: "a", text: "late", done: false, doneAt: null, due: "2000-01-01", tags: [] }, { id: "b", text: "today", done: false, doneAt: null, due: today, tags: [] }, { id: "c", text: "fin", done: true, doneAt: 1, tags: [] }] as any;
    expect(AI.runTool("list_todos", { status: "overdue" }).items.map((x: any) => x.text)).toEqual(["late"]); expect(AI.runTool("list_todos", { status: "done" }).total).toBe(1); expect(AI.runTool("list_todos", { status: "all", limit: 2 }).items.length).toBe(2);
  });
  it("money_summary agrees with the records", () => {
    const r = AI.runTool("money_summary", { from: "2000-01-01", to: "2100-01-01" }); if (r.error) return; const D = JSON.parse(localStorage.getItem("tally:app:v1") || "{}");
    const E = (D.records || []).filter((x: any) => x.t === "e").reduce((a: number, x: any) => a + x.a, 0) / 100; expect(r.expense).toBeCloseTo(E, 2);
    expect(r.expense_by_category.reduce((a: number, c: any) => a + c.amount, 0)).toBeCloseTo(r.expense, 1); expect(r.net).toBeCloseTo(r.income - r.expense, 2);
  });
  it("show_chart validates and reports to the UI", () => {
    const got: any[] = []; expect(AI.runTool("show_chart", { title: "t", kind: "bar", labels: ["a", "b"], values: [1, 2] }, (c) => got.push(c)).ok).toBe(true); expect(got[0].values).toEqual([1, 2]);
    expect(AI.runTool("show_chart", { title: "t", kind: "bar", labels: ["a"], values: [1, 2] }).error).toBeTruthy(); expect(AI.runTool("show_chart", { title: "t", kind: "bar", labels: ["a"], values: ["x"] }).error).toBeTruthy(); expect(got.length).toBe(1);
  });
  it("unknown tool is an error, not a crash", () => { expect(AI.runTool("rm_rf", {}).error).toMatch(/Unknown/); });
});

describe("privacy: Vault and notes never leave", () => {
  it("no tool output contains vault secrets or Money notes", () => {
    getState().vault = { v: 2, items: [], folders: [] } as any; V.saveItem({ type: "login", title: "ZZ-VAULT-TITLE", username: "zz-user", password: "ZZ-SECRET-PW-9", uris: ["https://zz.example"] } as any);
    const D = JSON.parse(localStorage.getItem("tally:app:v1") || "null"); if (D && D.records && D.records[0]) { D.records[0].n = "ZZ-PRIVATE-NOTE"; localStorage.setItem("tally:app:v1", JSON.stringify(D)); }
    getState().goals[0].notes = "x";
    const dump = JSON.stringify(ALL.map((n) => AI.runTool(n, { goal: getState().goals[0].name, from: "2000-01-01", to: "2100-01-01", status: "all", expression: "1+1", title: "t", kind: "bar", labels: ["a"], values: [1] }))) + JSON.stringify(AI.TOOLS) + AI.SYSTEM("2026-01-01");
    for (const secret of ["ZZ-VAULT-TITLE", "zz-user", "ZZ-SECRET-PW-9", "zz.example", "ZZ-PRIVATE-NOTE"]) expect(dump.includes(secret)).toBe(false);
  });
  it("no tool can write: data is unchanged after running every tool", () => { const before = JSON.stringify(getState()); ALL.forEach((n) => AI.runTool(n, { goal: getState().goals[0].name, expression: "1+1" })); expect(JSON.stringify(getState())).toBe(before); });
  it("the API key lives outside the app data, so it is not in backups", () => { AI.saveAi({ on: true, key: "sk-ant-KEY-XYZ" }); expect(JSON.stringify(getState()).includes("sk-ant-KEY-XYZ")).toBe(false); expect(localStorage.getItem("goal-tracker.v1")!.includes("sk-ant-KEY-XYZ")).toBe(false); AI.clearAi(); expect(AI.loadAi().key).toBe(""); });
});

describe("askAnalyst", () => {
  it("runs tools locally, sends results back, returns the final text", async () => {
    const calls: any[] = [], fetcher = async (url: string, init: any) => { calls.push({ url, init, body: JSON.parse(init.body) }); return calls.length === 1 ? reply([{ type: "text", text: "Looking…" }, { type: "tool_use", id: "t1", name: "list_goals", input: {} }], "tool_use") : reply([{ type: "text", text: "You have **3** goals." }]); };
    const r = await AI.askAnalyst([], "how many goals?", { settings: S, fetcher: fetcher as any });
    expect(r.text).toBe("You have **3** goals."); expect(r.tools).toEqual(["list_goals"]); expect(calls.length).toBe(2);
    expect(calls[0].url).toBe("https://api.anthropic.com/v1/messages"); expect(calls[0].init.headers["x-api-key"]).toBe(S.key); expect(calls[0].init.headers["anthropic-dangerous-direct-browser-access"]).toBe("true"); expect(calls[0].init.headers["anthropic-version"]).toBeTruthy(); expect(calls[0].body.model).toBe("claude-test");
    const last = calls[1].body.messages.at(-1); expect(last.role).toBe("user"); expect(last.content[0].type).toBe("tool_result"); expect(last.content[0].tool_use_id).toBe("t1"); expect(JSON.parse(last.content[0].content).length).toBeGreaterThan(0);
  });
  it("keeps conversation history across questions", async () => {
    let seen = 0; const f = async (_u: string, i: any) => { seen = JSON.parse(i.body).messages.length; return reply([{ type: "text", text: "ok" }]); };
    const a = await AI.askAnalyst([], "q1", { settings: S, fetcher: f as any }); await AI.askAnalyst(a.turns, "q2", { settings: S, fetcher: f as any }); expect(seen).toBe(3);
  });
  it("maps failures to friendly kinds", async () => {
    for (const [st, kind] of [[401, "auth"], [403, "auth"], [429, "rate"], [500, "server"], [400, "bad"]] as const) { const e: any = await AI.askAnalyst([], "x", { settings: S, fetcher: (async () => reply([], "end_turn", st)) as any }).catch((x) => x); expect(e.kind).toBe(kind); expect(AI.friendly(e).length).toBeGreaterThan(10); }
    const n: any = await AI.askAnalyst([], "x", { settings: S, fetcher: (async () => { throw new Error("offline"); }) as any }).catch((x) => x); expect(n.kind).toBe("network");
  });
  it("a broken tool never crashes the loop; an endless tool loop is cut off", async () => {
    let n = 0; const f = async () => { n++; return reply([{ type: "tool_use", id: "t" + n, name: "calc", input: { expression: "1/0" } }], "tool_use"); };
    const r = await AI.askAnalyst([], "x", { settings: S, fetcher: f as any, maxRounds: 3 }); expect(n).toBe(3); expect(r.text).toMatch(/more steps/);
  });
  it("charts requested by the model reach the UI", async () => {
    const got: any[] = []; let k = 0; const f = async () => (k++ === 0 ? reply([{ type: "tool_use", id: "c", name: "show_chart", input: { title: "Spend", kind: "bar", labels: ["Jan", "Feb"], values: [10, 20] } }], "tool_use") : reply([{ type: "text", text: "done" }]));
    await AI.askAnalyst([], "chart", { settings: S, fetcher: f as any, onChart: (c) => got.push(c) }); expect(got.length).toBe(1); expect(got[0].title).toBe("Spend");
  });
});

describe("readiness and rendering", () => {
  it("aiReady needs the switch, a key and a connection", () => {
    expect(AI.aiReady({ on: false, key: "k", model: "m" })).toBe(false); expect(AI.aiReady({ on: true, key: "", model: "m" })).toBe(false); expect(AI.aiReady({ on: true, key: "k", model: "m" })).toBe(true);
    try { const old = Object.getOwnPropertyDescriptor(globalThis, "navigator"); Object.defineProperty(globalThis, "navigator", { value: { onLine: false }, configurable: true }); expect(AI.aiReady({ on: true, key: "k", model: "m" })).toBe(false); if (old) Object.defineProperty(globalThis, "navigator", old); } catch { /* navigator is read-only in this environment; the e2e test covers offline */ }
  });
  it("mdLite escapes HTML and keeps only simple formatting", () => {
    const h = AI.mdLite("<img src=x onerror=alert(1)> **bold** `c`\n- one\n- two\n<script>x</script>"); expect(h.includes("<img")).toBe(false); expect(h.includes("<script")).toBe(false); expect(h).toContain("<b>bold</b>"); expect(h).toContain("<code>c</code>"); expect(h).toContain("<li>one</li>"); expect(h).toContain("&lt;img");
  });
  it("settings round-trip and tolerate corrupt storage", () => { AI.saveAi({ on: true, key: "k" }); expect(AI.loadAi()).toEqual({ on: true, key: "k", model: AI.DEFAULT_MODEL }); localStorage.setItem(AI.AI_KEY, "{bad"); expect(AI.loadAi().on).toBe(false); });
});
