// Pure data mutations used by the UI. Each returns what the UI needs to show an Undo.
import { getState } from "./ctx";
import { todayStr, addDays } from "./clock";
import { uid } from "./format";
import { autoStatus, current } from "./goals";
import { completeTodo, parseQuick } from "./todos";
import { commit, snapState, restoreSnap } from "../storage/store";
import type { Goal, Todo, GoalType } from "./types";

export interface GoalInput { name: string; category: string; type: GoalType; unit?: string; total: number; baseline?: number; start: string; end: string }

export function validateGoal(i: GoalInput): string | null {
  const simple = i.type === "milestones" || i.type === "habit";
  if (!i.name.trim()) return "Give the goal a name";
  if (!simple && !(i.total > 0)) return "Goal total must be above 0";
  if (!i.start || !i.end) return "Pick start and end dates";
  if (i.end < i.start) return "End date is before start date";
  return null;
}

export function addGoal(i: GoalInput): Goal {
  const s = getState(), simple = i.type === "milestones" || i.type === "habit";
  let cat = i.category.trim() || "General";
  const dup = s.categories.find((c) => c.toLowerCase() === cat.toLowerCase());
  if (dup) cat = dup; else s.categories.push(cat);
  const g: Goal = { id: uid(), targets: {}, logs: [], focus: {}, dependsOn: [], plan: s.plans[0]?.id || "", name: i.name.trim(), category: cat, type: i.type, unit: simple ? "" : (i.unit || "").trim(), total: simple ? 1 : i.total, baseline: simple ? 0 : i.baseline || 0, start: i.start, end: i.end, status: "Not Started" as any };
  if (i.type === "habit") { g.checks = []; g.habit = { perWeek: 3 }; }
  if (i.type === "milestones") g.milestones = [];
  s.goals.push(g); commit(); return g;
}

export function addLog(g: Goal, amount: number, date = todayStr(), note = ""): string | null {
  if (!Number.isFinite(amount)) return "Enter a number";
  const before = snapState();
  g.logs.push({ id: uid(), amount, date, note } as any);
  autoStatus(g); if (g.status === "Not Started") g.status = "In Progress";
  commit(); return before;
}

export function deleteGoal(g: Goal): string { const b = snapState(); const s = getState(); s.goals = s.goals.filter((x) => x.id !== g.id); commit(); return b; }
export function toggleHabitDay(g: Goal, iso: string) {
  g.checks = g.checks || []; const i = g.checks.indexOf(iso);
  if (i >= 0) g.checks.splice(i, 1); else g.checks.push(iso);
  autoStatus(g); commit();
}

export function addTodoFromText(text: string, due?: string | null): Todo | null {
  const raw = text.trim(); if (!raw) return null;
  const q = parseQuick(raw), s = getState();
  const t: Todo = { id: uid(), text: q.text || raw, done: false, doneAt: null, due: due ?? q.due ?? null, goalId: null, category: "", repeat: q.repeat || "", tags: q.tags || [], created: Date.now() } as any;
  if ((q as any).time) t.time = (q as any).time;
  s.todos.push(t); commit(); return t;
}
export function toggleTodo(t: Todo) { completeTodo(t); commit(); }
export function deleteTodo(t: Todo): string { const b = snapState(); const s = getState(); s.todos = s.todos.filter((x) => x.id !== t.id); commit(); return b; }
export const undoTo = (snap: string) => restoreSnap(snap);
export const tomorrow = () => addDays(todayStr(), 1);
export { current };
