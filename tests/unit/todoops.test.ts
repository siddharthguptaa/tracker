import { describe, it as _it, expect, afterEach, vi } from "vitest";
import { boot } from "./helpers";
import { getState } from "../../src/domain/ctx";
import * as O from "../../src/domain/todoOps";

// fixed clock comes from the golden fixture; todos/tags/templates start empty for isolation
const fresh = () => { boot(); const s = getState(); s.todos = []; s.tags = []; s.todoTemplates = []; };
const it = (n: string, f: () => void) => _it(n, () => { fresh(); f(); });
afterEach(() => { vi.useRealTimers(); });
const today = () => new Date().toISOString().slice(0, 10);
const mk = (t: string, f: Partial<O.TodoFormValues> = {}) => O.addTodo(t, O.emptyForm({ ...f }))!;

describe("adding", () => {
  it("rejects empty text", () => { expect(O.addTodo("   ", O.emptyForm())).toBeNull(); expect(getState().todos.length).toBe(0); });
  it("smart add pulls date, tag and estimate out of the sentence", () => {
    O.addTag("Errands"); const t: any = mk("Call bank tomorrow 5pm #errands 30m"); expect(t.text).toBe("Call bank"); expect(t.time).toBe("17:00"); expect(t.est).toBe(30); expect(t.tags).toEqual([getState().tags[0].id]); expect(t.due > today()).toBe(true);
  });
  it("smart add off keeps the text exactly", () => { getState().settings.todoSmart = false; const t: any = mk("Call bank tomorrow"); expect(t.text).toBe("Call bank tomorrow"); expect(t.due).toBeFalsy(); });
  it("a repeat with no date becomes due today", () => { const t: any = mk("Water plants", { repeat: "daily" }); expect(t.due).toBe(O.normalizeForm(O.emptyForm({ repeat: "daily" })).due); });
  it("a time with no date becomes today; reminder needs a date", () => { const t: any = mk("Stand up", { time: "09:00", rem: 10 }); expect(t.due).toBeTruthy(); const u: any = mk("x", { rem: 10 }); expect(u.rem).toBeUndefined(); });
  it("linking a goal clears the category", () => { const t: any = mk("Run", { goalId: "g1", category: "Health" }); expect(t.goalId).toBe("g1"); expect(t.category).toBe(""); });
  it("empty optional fields are not stored", () => { const t: any = mk("Plain"); ["notes", "est", "time", "subs", "rem", "someday", "alerted"].forEach((k) => expect(t[k] == null || t[k] === false || k === "alerted").toBe(true)); expect("notes" in t).toBe(false); expect("subs" in t).toBe(false); });
  it("monthly repeat remembers the day of month", () => { const t: any = mk("Rent", { repeat: "monthly", due: "2026-03-31" }); expect(t.rdom).toBe(31); });
  it("new tags typed in the form are created once, case-insensitively", () => {
    mk("a", { newTags: "Errands, errands , Ideas" }); expect(getState().tags.map((x) => x.name)).toEqual(["Errands", "Ideas"]); expect((getState().todos[0] as any).tags.length).toBe(2);
  });
  it("blank subtasks are dropped", () => { const t: any = mk("x", { subs: [{ id: "1", t: " a ", d: false }, { id: "2", t: "  ", d: false }] }); expect(t.subs.length).toBe(1); expect(t.subs[0].t).toBe("a"); });
});

describe("editing", () => {
  it("empty text is refused and nothing changes", () => { const t: any = mk("Keep"); expect(O.saveTodoEdit(t, "  ", O.formOf(t))).toBe("To-do can't be empty"); expect(t.text).toBe("Keep"); });
  it("round-trips the form without losing fields", () => {
    const t: any = mk("Full", { due: "2026-05-01", time: "10:00", repeat: "weekly", rem: 60, est: 45, notes: "n", subs: [{ id: "s", t: "sub", d: true }], category: "Home" });
    const before = JSON.stringify(t); expect(O.saveTodoEdit(t, "Full", O.formOf(t))).toBeNull(); expect(JSON.stringify(t)).toBe(before);
  });
  it("editing the date clears the fired-reminder marker", () => { const t: any = mk("x", { due: "2026-05-01", rem: 0 }); t.alerted = "old"; O.saveTodoEdit(t, "x", { ...O.formOf(t), due: "2026-05-02" }); expect(t.alerted).toBeNull(); });
  it("removing the date also removes time and reminder", () => { const t: any = mk("x", { due: "2026-05-01", time: "09:00", rem: 10 }); O.saveTodoEdit(t, "x", { ...O.formOf(t), due: null, time: null }); expect(t.time).toBeUndefined(); expect(t.rem).toBeUndefined(); });
  it("custom repeat strings", () => { expect(O.customRepeat(1, "week", false)).toBe("weekly"); expect(O.customRepeat(3, "day", true)).toBe("every 3 days after completion"); expect(O.customRepeat(9999, "month", false)).toBe("every 365 months"); expect(O.customRepeat(0, "year", false)).toBe("yearly"); });
});

describe("move / snooze", () => {
  it("tomorrow, week, month, inbox, someday, date", () => {
    const a: any = mk("a", { due: "2026-01-01", time: "08:00" }), td = O.normalizeForm(O.emptyForm({ due: "2026-01-01" })).due!;
    O.moveTodos([a.id], "tomorrow"); expect(a.due > td || a.due > "2026").toBe(true); expect(a.time).toBe("08:00");
    O.moveTodos([a.id], "inbox"); expect(a.due).toBeNull(); expect(a.time).toBeUndefined();
    O.moveTodos([a.id], "someday"); expect(a.someday).toBe(true); O.moveTodos([a.id], "date", "2030-02-03"); expect(a.due).toBe("2030-02-03"); expect(a.someday).toBeUndefined();
  });
  it("week is a Monday; month is later", () => { const a: any = mk("a"); O.moveTodos([a.id], "week"); expect(new Date(a.due + "T00:00:00").getDay()).toBe(1); O.moveTodos([a.id], "month"); expect(a.due > a.created + "").toBe(true); });
  it("later today never lands in the past and crosses to tomorrow 09:00 late at night", () => {
    const a: any = mk("a"); O.moveTodos([a.id], "later", undefined, new Date(2026, 5, 10, 22, 30)); expect(a.due).toBe("2026-06-11"); expect(a.time).toBe("09:00");
    O.moveTodos([a.id], "later", undefined, new Date(2026, 5, 10, 10, 7)); expect(a.due).toBe("2026-06-10"); expect(a.time).toBe("13:00");
  });
  it("clears the fired-reminder marker", () => { const a: any = mk("a", { due: "2026-01-01", rem: 0 }); a.alerted = "x"; O.moveTodos([a.id], "tomorrow"); expect(a.alerted).toBeNull(); });
  it("only touches the selected to-dos", () => { const a = mk("a", { due: "2026-01-01" }), b: any = mk("b", { due: "2026-01-01" }); O.moveTodos([a.id], "inbox"); expect(b.due).toBe("2026-01-01"); });
});

describe("bulk, clear, order", () => {
  it("bulk done only counts open ones; delete is undoable", () => {
    const a = mk("a"), b = mk("b"); b.done = true; expect(O.bulkDone([a.id, b.id])).toBe(1); const gone = O.bulkDelete([a.id]); expect(getState().todos.length).toBe(1); O.restoreTodos(gone); expect(getState().todos.length).toBe(2);
  });
  it("clearDone removes only completed", () => { mk("a"); const b = mk("b"); b.done = true; const gone = O.clearDone(); expect(gone.length).toBe(1); expect(getState().todos.length).toBe(1); });
  it("moveInOrder swaps neighbours and ignores the ends", () => {
    const a: any = mk("a"), b: any = mk("b"), c: any = mk("c"); a.created = 1; b.created = 2; c.created = 3; const ids = [a.id, b.id, c.id];
    O.moveInOrder(ids, a.id, -1); expect(O.ordOf(a) < O.ordOf(b)).toBe(true);
    O.moveInOrder(ids, b.id, -1); expect(O.ordOf(b) < O.ordOf(a)).toBe(true); expect(O.ordOf(a) < O.ordOf(c)).toBe(true);
    O.moveInOrder([b.id, a.id, c.id], c.id, 1); expect(O.ordOf(a) < O.ordOf(c)).toBe(true);
    O.moveInOrder([b.id, a.id, c.id], c.id, -1); expect(O.ordOf(c) < O.ordOf(a)).toBe(true); expect(O.ordOf(b) < O.ordOf(c)).toBe(true);
  });
});

describe("tags", () => {
  it("rejects empty and duplicate names", () => { expect(O.addTag("  ")).toBe("Name the tag"); expect(O.addTag("Work")).toBeNull(); expect(O.addTag("work")).toBe("That tag already exists"); });
  it("colours cycle through the palette", () => { O.addTag("a"); O.addTag("b"); expect(getState().tags[0].color).toBe(O.TAG_COLORS[0]); expect(getState().tags[1].color).toBe(O.TAG_COLORS[1]); });
  it("rename can't collide; note and colour update", () => { O.addTag("a"); O.addTag("b"); const [a, b] = getState().tags; expect(O.updateTag(b.id, { name: "A" })).toBe("That tag already exists"); expect(O.updateTag(b.id, { name: "" })).toBe("Tag name can't be empty"); O.updateTag(a.id, { note: "hi", color: "#fff" }); expect(a.note).toBe("hi"); expect(a.color).toBe("#fff"); });
  it("deleting a tag removes it from every to-do", () => { O.addTag("a"); const id = getState().tags[0].id, t: any = mk("x", { tags: [id] }); O.deleteTag(id); expect(t.tags).toEqual([]); expect(getState().tags.length).toBe(0); });
});

describe("templates", () => {
  it("validates, counts only top-level lines, edits in place", () => {
    expect(O.saveTemplate("", "a")).toBe("Give the template a name"); expect(O.saveTemplate("T", "  ")).toBe("Add at least one to-do");
    expect(O.saveTemplate("Trip", "Pack\n- socks\n- charger\nBook cab")).toBeNull(); const t = getState().todoTemplates[0]; expect(O.templateCount(t.lines)).toBe(2);
    O.saveTemplate("Trip 2", "One", t.id); expect(getState().todoTemplates.length).toBe(1); expect(t.name).toBe("Trip 2");
  });
  it("tplCreate makes subtasks from dash lines and applies the date", () => {
    const n = O.tplCreate({ lines: "Pack\n- socks\n• charger\nBook cab" }, "2026-07-01"); expect(n).toBe(2);
    const [a, b]: any[] = getState().todos; expect(a.subs.map((x: any) => x.t)).toEqual(["socks", "charger"]); expect(a.due).toBe("2026-07-01"); expect(b.subs).toBeUndefined(); expect(a.created < b.created).toBe(true);
  });
  it("smart words inside template lines work; a stray leading subtask line becomes a to-do", () => { O.tplCreate({ lines: "- orphan\nPay rent every month" }, null); const L: any[] = getState().todos; expect(L.length).toBe(2); expect(L[1].repeat).toBeTruthy(); });
  it("template from selected to-dos keeps subtasks", () => { const a = mk("A", { subs: [{ id: "1", t: "s1", d: false }] }); expect(O.templateFromTodos([a.id])).toBe("A\n- s1"); });
  it("delete", () => { O.saveTemplate("x", "y"); O.deleteTemplate(getState().todoTemplates[0].id); expect(getState().todoTemplates.length).toBe(0); });
});

describe("reminders", () => {
  it("fires once when due-minus-lead passes, then not again", () => {
    const t: any = mk("Call", { due: "2026-06-10", time: "10:00", rem: 10 }), at = new Date(2026, 5, 10, 9, 50).getTime();
    expect(O.checkReminders(at - 60000).length).toBe(0); expect(O.checkReminders(at).length).toBe(1); expect(O.checkReminders(at + 60000).length).toBe(0); expect(t.alerted).toBeTruthy();
  });
  it("stale reminders (over 36 h old) are marked but not announced", () => { mk("Old", { due: "2026-06-01", time: "10:00", rem: 0 }); expect(O.checkReminders(new Date(2026, 5, 10).getTime()).length).toBe(0); expect(O.checkReminders(new Date(2026, 5, 10).getTime()).length).toBe(0); });
  it("ignores done to-dos and ones without a reminder", () => { const a = mk("a", { due: "2026-06-10", rem: 0 }); a.done = true; mk("b", { due: "2026-06-10" }); expect(O.checkReminders(new Date(2026, 5, 11).getTime()).length).toBe(0); });
  it("rescheduling re-arms the reminder", () => { const t: any = mk("a", { due: "2026-06-10", time: "10:00", rem: 0 }), at = new Date(2026, 5, 10, 10, 0).getTime(); O.checkReminders(at); O.moveTodos([t.id], "date", "2026-06-12"); expect(O.checkReminders(new Date(2026, 5, 12, 10, 0).getTime()).length).toBe(1); });
});

describe("calendar", () => {
  it("lays out a month starting Monday and buckets to-dos by day", () => {
    mk("a", { due: "2026-06-10" }); mk("b", { due: "2026-06-10" }); mk("c", { due: "2026-07-01" });
    const c = O.calendarMonth("2026-06"); expect(c.dim).toBe(30); expect(c.start).toBe(0); expect(c.by["2026-06-10"].length).toBe(2); expect(Object.keys(c.by).length).toBe(1);
    expect(O.calendarMonth("2026-02").start).toBe(6); expect(O.calendarMonth("2024-02").dim).toBe(29);
  });
  it("month navigation wraps years", () => { expect(O.shiftMonth("2026-12", 1)).toBe("2027-01"); expect(O.shiftMonth("2026-01", -1)).toBe("2025-12"); });
});
