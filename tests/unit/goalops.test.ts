import { describe, it as _it, expect } from "vitest";
import { boot } from "./helpers";
import { getState } from "../../src/domain/ctx";
import * as G from "../../src/domain/goalOps";
import { current } from "../../src/domain/goals";

const it = (n: string, f: () => void) => _it(n, () => { boot(); f(); });
const mk = (o: Partial<G.GoalForm> = {}) => G.saveGoal({ ...G.blankGoalForm(getState().plans[0].id), name: "Test goal", total: 1000, end: "2030-12-31", ...o }).g;

describe("categories & plans", () => {
  it("add/rename/delete categories with guards", () => {
    expect(G.addCategory(" ")).toBeTruthy(); expect(G.addCategory("Zed")).toBeNull(); expect(G.addCategory("zed")).toBe("That category already exists");
    const g = mk({ category: "Zed" }); expect(G.deleteCategory("Zed")).toBe("Move or delete its goals first");
    expect(G.renameCategory("Zed", "Zee")).toBeNull(); expect(g.category).toBe("Zee"); expect(G.renameCategory("Zee", getState().categories[0])).toBe("That name is already used");
  });
  it("a plan with no age counts as age 0; ids never collide", () => { expect(G.addPlan(0, 2060)).toBeTruthy(); expect(G.addPlan(5, 2060)).toBeNull(); expect(new Set(getState().plans.map((p) => p.id)).size).toBe(getState().plans.length); });
  it("plans: validation, id, delete guards", () => {
    const last = getState().plans[getState().plans.length - 1]; expect(G.addPlan(last.age as number, 2060)).toBeTruthy(); expect(G.addPlan((last.age as number) + 5, 1990)).toBeTruthy();
    expect(G.addPlan((last.age as number) + 5, 2060)).toBeNull(); const p = getState().plans.at(-1)!; expect(p.id).toBe("p" + p.age); expect(p.end).toBe("2060-12-31");
    mk({ plan: p.id }); expect(G.deletePlan(p.id)).toBe("Move or delete its goals first");
  });
});

describe("saving goals", () => {
  it("validation", () => {
    const f = { ...G.blankGoalForm("p"), name: "x", total: 5, end: "2030-01-01" };
    expect(G.validateGoalForm({ ...f, name: " " })).toBeTruthy(); expect(G.validateGoalForm({ ...f, total: 0 })).toBeTruthy(); expect(G.validateGoalForm({ ...f, end: "2000-01-01" })).toBeTruthy(); expect(G.validateGoalForm(f)).toBeNull();
    expect(G.validateGoalForm({ ...f, type: "habit", total: NaN })).toBeNull();
  });
  it("new category is created once, case-insensitively", () => { const n = getState().categories.length; mk({ category: "__new", newCategory: "Brand New" }); mk({ category: "brand new" }); expect(getState().categories.length).toBe(n + 1); });
  it("milestone and habit types normalise totals", () => { const m = mk({ type: "milestones" }); expect(m.total).toBe(1); G.addMilestone(m, "a", "2027-01-01"); G.addMilestone(m, "b", "2027-02-01"); expect(m.total).toBe(2); const h = mk({ type: "habit", perWeek: 5 }); expect(h.habit!.perWeek).toBe(5); expect(h.unit).toBe(""); });
  it("circular dependencies are skipped", () => { const a = mk({ name: "A" }), b = mk({ name: "B", deps: [] }); G.saveGoal({ ...G.formOfGoal(b), deps: [a.id] }, b.id); const r = G.saveGoal({ ...G.formOfGoal(a), deps: [b.id] }, a.id); expect(r.skipped).toBe(true); expect(a.dependsOn).toEqual([]); expect(G.blockers(b).length).toBe(1); });
  it("edit keeps logs", () => { const g = mk(); G.addGoalLog(g, 100, "2026-01-01", ""); G.saveGoal({ ...G.formOfGoal(g), name: "Renamed" }, g.id); expect(g.logs.length).toBe(1); expect(g.name).toBe("Renamed"); });
});

describe("logs & milestones", () => {
  it("log add/edit/delete with undo snapshot", () => {
    const g = mk({ start: "2020-01-01" }), before = current(g); expect(G.addGoalLog(g, NaN, "", "")).toBeTruthy(); G.addGoalLog(g, 50, "2026-01-01", "n"); expect(current(g)).toBe(before + 50);
    const id = g.logs[0].id; G.saveLog(g, id, 70, "2026-01-02", "m"); expect(current(g)).toBe(before + 70); const snap = G.deleteLog(g, id); expect(current(g)).toBe(before); expect(snap).toBeTruthy();
  });
  it("milestones: even spacing, toggle, edit, delete", () => {
    const g = mk({ type: "milestones", start: "2026-01-01", end: "2030-01-01" }); G.evenMilestones(g); expect(g.milestones!.length).toBe(4); expect(g.milestones![3].date).toBe("2030-01-01");
    expect(G.toggleMilestone(g, g.milestones![0].id)).toBe(true); expect(g.milestones![0].doneDate).toBeTruthy(); expect(G.saveMilestone(g, g.milestones![0].id, "", "2027-01-01")).toBeTruthy();
    G.deleteMilestone(g, g.milestones![1].id); expect(g.total).toBe(3);
  });
});

describe("handover & review", () => {
  it("decide toggles; apply makes drafts and parks dropped", () => {
    const s = getState(), p = s.plans[0]; if (!G.nextPlan(p.id)) return;
    const a = mk({ name: "A", plan: p.id, status: "In Progress" }), b = mk({ name: "B", plan: p.id, status: "In Progress" });
    G.decide(a, "carry"); G.decide(b, "drop"); G.decide(b, "drop"); expect(b.handover).toBeNull(); G.decide(b, "drop");
    const r = G.applyHandover(p.id); expect(r.made).toBeGreaterThanOrEqual(1); const d = G.successorOf(a)!; expect(d.status).toBe("Draft"); expect(d.prevId).toBe(a.id); expect(b.status).toBe("On Hold");
    expect(G.applyHandover(p.id).made).toBe(0);
  });
  it("carry sets next-year focus and remaining target", () => {
    const g = mk({ start: "2026-01-01" }); G.setFocus(g, 2026, true); G.setTarget(g, 2026, "400"); G.addGoalLog(g, 100, "2026-02-01", ""); G.carryGoal(g, 2026); expect(g.focus[2027]).toBe(true); expect(g.targets[2027]).toBe(300);
  });
  it("focus: draft refused, year meta stamped", () => { const g = mk({ status: "Draft" }); expect(G.toggleFocus(g, 2026)).toBeTruthy(); G.promote(g); expect(G.toggleFocus(g, 2026)).toBeNull(); expect(getState().focusMeta[2026]).toBeTruthy(); });
});

describe("recurring", () => {
  it("backfills monthly entries once and is idempotent", () => {
    const g = mk({ start: "2026-01-01", end: "2030-01-01" }); G.recurStart(g, 100, 31, "2026-01-15"); const n = g.logs.filter((l) => l.auto).length; expect(n).toBeGreaterThan(0); expect(G.applyRecurring()).toBe(0); expect(g.logs.filter((l) => l.auto).length).toBe(n);
    expect(g.logs[0].date).toBe("2026-01-31"); G.recurStop(g); expect(g.recurring).toBeUndefined();
  });
  it("skips drafts and rejects zero", () => { const g = mk({ status: "Draft" }); expect(G.recurStart(g, 0, 1, "2026-01-01")).toBeTruthy(); G.recurStart(g, 10, 1, "2026-01-01"); expect(g.logs.length).toBe(0); });
});

describe("archive / reset / todos", () => {
  it("archive completed & reset keeps todos", () => { const g = mk({ status: "Completed" }); expect(G.archiveCompleted(g.plan).includes(g)).toBe(true); expect(g.archived).toBe(true); const s = getState(); const nt = s.todos.length; G.resetGoals(); expect(s.goals.length).toBe(0); expect(s.todos.length).toBe(nt); });
  it("goal to-do", () => { const g = mk(); expect(G.addGoalTodo(g, " ", "")).toBeTruthy(); G.addGoalTodo(g, "Do it", ""); expect((getState().todos.at(-1) as any).goalId).toBe(g.id); });
});

describe("import / export", () => {
  const sheet = [["junk"], ["Category", "Goal Name", "Goal Total", "Current Number", "Start Date", "End Date", "Status", "2027 Target"], ["Money", "Brand FIRE fund", 5000000, 100, 46023, "2030-01-01", "In Progress", 1000000]];
  it("parses header row anywhere and Excel serial dates", () => { const r = G.parseGoalSheets([sheet]); expect(r.length).toBe(1); expect(r[0].start).toBe("2026-01-01"); expect(r[0].targets["2027"]).toBe(1000000); expect(G.parseGoalSheets([[["a"]]]).length).toBe(0); });
  it("new goal + update existing; unchecked skipped", () => {
    const ex = mk({ name: "Existing", total: 100 }); const rows = G.parseGoalSheets([[["Goal Name", "Goal Total", "Status"], ["existing", 200, "Completed"], ["Brand New", 900, ""]]]);
    const items = G.buildGoalImport(rows); expect(items.length).toBe(2); items[1].on = false; const r = G.applyGoalImport(items); expect(r).toEqual({ nNew: 0, nUp: 1 }); expect(ex.total).toBe(200); expect(ex.status).toBe("Completed");
  });
  it("level goals get an import log", () => { const g = mk({ name: "Salary", type: "level", total: 500 }); const it2 = G.buildGoalImport([{ name: "Salary", total: 500, cur: 321, targets: {} }]); G.applyGoalImport(it2); expect(current(g)).toBe(321); });
  it("csv export quotes and has headers", () => { mk({ name: 'Say "hi", ok' }); const c = G.goalCsv(); expect(c.split("\n")[0].startsWith('"Plan","Category"')).toBe(true); expect(c.includes('"Say ""hi"", ok"')).toBe(true); });
});

describe("trends", () => {
  it("valueAt / pctAt per type", () => { const g = mk({ start: "2020-01-01", baseline: 100 }); G.addGoalLog(g, 100, "2025-01-01", ""); expect(G.valueAt(g, "2024-01-01")).toBe(100); expect(G.valueAt(g, "2026-01-01")).toBe(200); expect(G.pctAt(g, "2019-01-01")).toBeNull(); expect(G.monthEnds(6).length).toBe(6); });
});
