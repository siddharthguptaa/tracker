import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { boot, G } from "./helpers";
import { getState } from "../../src/domain/ctx";
import { normalize, parseStored, seed } from "../../src/domain/normalize";
import { addGoal, addLog, validateGoal, deleteGoal, undoTo, addTodoFromText, toggleTodo, deleteTodo, toggleHabitDay } from "../../src/domain/actions";
import { snapState } from "../../src/storage/store";
import { addDays, todayStr, mondayOf, isoOf, clamp } from "../../src/domain/clock";
import { fmt, fmtDate, esc, estText, monthsText, hm12 } from "../../src/domain/format";

beforeEach(() => { boot(); });
afterEach(() => { vi.useRealTimers(); });

describe("storage safety", () => {
  it("never loses unknown fields from a newer/older app version", () => {
    const d: any = JSON.parse(JSON.stringify(G.state)); d.futureThing = { a: 1 }; d.goals[0].futureField = "keep";
    const n: any = normalize(d); expect(n.futureThing).toEqual({ a: 1 }); expect(n.goals[0].futureField).toBe("keep");
  });
  it("normalize is idempotent", () => { const a = JSON.stringify(normalize(JSON.parse(JSON.stringify(G.state)))); expect(JSON.stringify(normalize(JSON.parse(a)))).toBe(a); });
  it("survives garbage", () => {
    for (const raw of [null, "", "{", "null", "[]", "42", '{"goals":"nope"}']) expect(() => parseStored(raw as any)).not.toThrow();
    expect(() => normalize({})).not.toThrow(); expect(() => normalize({ goals: [null, 1, {}], todos: [null] } as any)).not.toThrow();
  });
  it("fresh install seeds an empty, valid state", () => { const s: any = seed(); expect(s.goals).toEqual([]); expect(s.todos).toEqual([]); expect(Array.isArray(s.categories)).toBe(true); });
  it("writes the same localStorage key as the original app", () => { addTodoFromText("x"); expect(JSON.parse(localStorage.getItem("goal-tracker.v1")!).todos.some((t: any) => t.text === "x")).toBe(true); });
});

describe("goals", () => {
  const ok = { name: "Read", category: "Learning", type: "total" as const, unit: "pages", total: 100, start: "2026-01-01", end: "2026-12-31" };
  it("validates input", () => {
    expect(validateGoal({ ...ok, name: "  " })).toMatch(/name/i); expect(validateGoal({ ...ok, total: 0 })).toMatch(/above 0/);
    expect(validateGoal({ ...ok, total: NaN })).toMatch(/above 0/); expect(validateGoal({ ...ok, start: "" })).toMatch(/dates/);
    expect(validateGoal({ ...ok, end: "2025-01-01" })).toMatch(/before/); expect(validateGoal(ok)).toBeNull();
    expect(validateGoal({ ...ok, type: "habit", total: 0 })).toBeNull();
  });
  it("adds a goal, re-using an existing category regardless of case", () => {
    const n = getState().categories.length; const g = addGoal({ ...ok, category: getState().categories[0].toUpperCase() });
    expect(getState().categories.length).toBe(n); expect(g.category).toBe(getState().categories[0]); expect(getState().goals.includes(g)).toBe(true);
  });
  it("creates habit and milestone goals with the right shape", () => {
    const h = addGoal({ ...ok, type: "habit", total: 0 }), m = addGoal({ ...ok, type: "milestones", total: 0 });
    expect(h.checks).toEqual([]); expect(m.milestones).toEqual([]); expect(h.total).toBe(1);
  });
  it("logging progress updates totals, status and can be undone", () => {
    const g = addGoal(ok); const snap = addLog(g, 40)!; expect(g.status).toBe("In Progress");
    addLog(g, 60); expect(g.status).toBe("Completed"); undoTo(snap); expect(getState().goals.find((x) => x.id === g.id)!.logs.length).toBe(0);
  });
  it("rejects non-numeric logs", () => { expect(addLog(addGoal(ok), NaN as any)).toBe("Enter a number"); });
  it("delete + undo restores the goal", () => { const g = getState().goals[0], n = getState().goals.length, b = deleteGoal(g); expect(getState().goals.length).toBe(n - 1); undoTo(b); expect(getState().goals.length).toBe(n); });
  it("habit check-ins toggle on and off", () => { const g = addGoal({ ...ok, type: "habit", total: 0 }); toggleHabitDay(g, todayStr()); expect(g.checks).toContain(todayStr()); toggleHabitDay(g, todayStr()); expect(g.checks).not.toContain(todayStr()); });
});

describe("to-dos", () => {
  it("adds via natural language", () => { const t = addTodoFromText("call bank tomorrow")!; expect(t.text).toBe("call bank"); expect(t.due).toBe(addDays(todayStr(), 1)); });
  it("ignores empty input", () => { expect(addTodoFromText("   ")).toBeNull(); });
  it("explicit due date wins over parsed one", () => { expect(addTodoFromText("x tomorrow", "2027-01-01")!.due).toBe("2027-01-01"); });
  it("completing a repeating to-do creates exactly one next occurrence; un-completing removes it", () => {
    const t = addTodoFromText("water plants every 2 days")!, n = getState().todos.length; toggleTodo(t);
    expect(t.done).toBe(true); expect(getState().todos.length).toBe(n + 1); toggleTodo(t); expect(t.done).toBe(false); expect(getState().todos.length).toBe(n);
  });
  it("delete + undo", () => { const t = getState().todos[0], n = getState().todos.length, b = deleteTodo(t); expect(getState().todos.length).toBe(n - 1); undoTo(b); expect(getState().todos.length).toBe(n); });
  it("snapshot ignores settings so Undo never reverts theme/backup stamps", () => { expect(JSON.parse(snapState())).not.toHaveProperty("settings"); });
});

describe("dates & formatting helpers", () => {
  it("addDays crosses month/year/leap boundaries", () => { expect(addDays("2026-12-31", 1)).toBe("2027-01-01"); expect(addDays("2028-02-28", 1)).toBe("2028-02-29"); expect(addDays("2026-03-01", -1)).toBe("2026-02-28"); });
  it("mondayOf", () => { expect(mondayOf("2026-11-26")).toBe("2026-11-23"); expect(mondayOf("2026-11-29")).toBe("2026-11-23"); expect(mondayOf("2026-11-23")).toBe("2026-11-23"); });
  it("isoOf is timezone-safe local date", () => { expect(isoOf(new Date(2026, 0, 5, 23, 59).getTime())).toBe("2026-01-05"); });
  it("clamp", () => { expect(clamp(2)).toBe(1); expect(clamp(-1)).toBe(0); expect(clamp(0.4)).toBe(0.4); });
  it("esc blocks HTML injection", () => { expect(esc('<img src=x onerror="a">&\'')).toBe("&lt;img src=x onerror=&quot;a&quot;&gt;&amp;&#39;"); });
  it("fmt handles money, long numbers and bad input", () => { expect(fmt(1234567, "₹")).toBe("₹12.35 L"); expect(() => fmt(NaN, "₹")).not.toThrow(); expect(() => fmt(undefined as any)).not.toThrow(); });
  it("fmtDate / hm12 / estText / monthsText", () => { expect(fmtDate("")).toBe("—"); expect(hm12("17:05")).toBe("5:05 PM"); expect(hm12("00:00")).toBe("12:00 AM"); expect(estText(90)).toBe("1h 30m"); expect(monthsText(1)).toBe("1 month"); expect(monthsText(30)).toContain("years"); });
});
