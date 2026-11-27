/* Goal logic ported from the classic app: plans, handover, review, milestones, logs, recurring, import/export. */
import { getState } from "./ctx";
import { todayStr, addDays, isoOf, ts, DAY, clamp, year, curYear, byDate } from "./clock";
import { uid, fmt, fmtDate } from "./format";
import { current, sortedLogs, autoStatus, yearTarget, yearAchieved, focusGoals, isFocus, fy, pct } from "./goals";
import { STATUSES } from "./normalize";
import { commit, snapState, restoreSnap } from "../storage/store";
import { tallyBooks, tallyRaw } from "../storage/moneyStore";
import type { Goal, GoalType, Plan } from "./types";

export { STATUSES };
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, "");
export const goalById = (id?: string | null) => getState().goals.find((g) => g.id === id);
export const allCats = () => { const s = getState(); return [...new Set([...s.categories, ...s.goals.map((g) => g.category)])].filter(Boolean); };

/* ---------- plans ---------- */
export const planLabel = (p: Plan) => (p.age ? "At " + p.age : "My plan");
export const planById = (id?: string) => getState().plans.find((p) => p.id === id);
export const planOfYear = (y: number) => getState().plans.find((p) => year(p.start) <= y && y <= year(p.end)) || getState().plans[0];
export const nextPlan = (id: string) => { const L = getState().plans, i = L.findIndex((p) => p.id === id); return i >= 0 ? L[i + 1] || null : null; };
export const successorOf = (g: Goal) => getState().goals.find((x) => x.prevId === g.id);
export function yearRange(): number[] {
  const s = getState(); let lo = 2026, hi = 2032;
  s.plans.forEach((p) => { lo = Math.min(lo, year(p.start)); hi = Math.max(hi, year(p.end)); });
  s.goals.forEach((g) => { if (g.start) lo = Math.min(lo, year(g.start)); if (g.end) hi = Math.max(hi, year(g.end)); });
  const out: number[] = []; for (let y = lo; y <= hi; y++) out.push(y); return out;
}
export function addPlan(age: number, endY: number): string | null {
  const s = getState(), last = s.plans[s.plans.length - 1], startY = year(last.end) + 1;
  const lastAge = Number(last.age) || 0; if (!(age > lastAge)) return `Age must be above ${lastAge}`;
  if (!(endY >= startY)) return `End year must be ${startY} or later`;
  if (s.plans.some((p) => p.age === age)) return "That age already has a plan";
  if (s.plans.some((p) => p.id === "p" + age)) return "That age already has a plan";
  s.plans.push({ id: "p" + age, age, start: startY + "-01-01", end: endY + "-12-31" }); commit(); return null;
}
export function deletePlan(id: string): string | null {
  const s = getState(); if (s.goals.some((g) => g.plan === id)) return "Move or delete its goals first"; if (s.plans.length < 2) return "Keep at least one plan";
  s.plans = s.plans.filter((p) => p.id !== id); commit(); return null;
}

/* ---------- categories ---------- */
export function addCategory(v: string): string | null { v = v.trim(); if (!v) return "Type a category name"; const s = getState(); if (s.categories.some((c) => c.toLowerCase() === v.toLowerCase())) return "That category already exists"; s.categories.push(v); commit(); return null; }
export function deleteCategory(c: string): string | null { const s = getState(); if (s.goals.some((g) => g.category === c)) return "Move or delete its goals first"; s.categories = s.categories.filter((x) => x !== c); commit(); return null; }
export function renameCategory(old: string, nv: string): string | null {
  nv = nv.trim(); if (!nv || nv === old) return null; const s = getState();
  if (s.categories.some((c) => c !== old && c.toLowerCase() === nv.toLowerCase())) return "That name is already used";
  s.categories = s.categories.map((c) => (c === old ? nv : c)); s.goals.forEach((g) => { if (g.category === old) g.category = nv; }); commit(); return null;
}

/* ---------- type sync ---------- */
export function syncMs(g: Goal) { g.milestones = g.milestones || []; g.total = Math.max(1, g.milestones.length); g.baseline = 0; g.unit = ""; autoStatus(g); }
export function syncHabit(g: Goal) { g.habit = g.habit || { perWeek: 3 }; g.checks = g.checks || []; g.total = 1; g.baseline = 0; g.unit = ""; autoStatus(g); }

/* ---------- dependencies ---------- */
export const blockers = (g: Goal) => (g.dependsOn || []).map((id) => goalById(id)).filter((d): d is Goal => !!d && !d.archived && d.status !== "Completed");
export function depChain(startId: string, targetId: string, seen = new Set<string>()): boolean {
  if (seen.has(startId)) return false; seen.add(startId); const g = goalById(startId); if (!g) return false;
  return (g.dependsOn || []).some((id) => id === targetId || depChain(id, targetId, seen));
}
const acked: Record<string, boolean> = {};
/** Ask once per session before updating a goal whose prerequisites aren't done. */
export async function depGuard(g: Goal, confirmFn: (m: string) => boolean | Promise<boolean>): Promise<boolean> {
  const b = blockers(g); if (!b.length || acked[g.id]) return true;
  const ok = await confirmFn(`“${g.name}” is waiting on ${b.map((x) => x.name).join(", ")}. Update it anyway?`); if (ok) acked[g.id] = true; return ok;
}

/* ---------- Money links ---------- */
export function moneyGoals(): any[] { try { const out: any[] = []; tallyBooks().list.forEach((b) => { const raw = tallyRaw(b.key); if (!raw) return; const d = JSON.parse(raw); if (Array.isArray(d.sgoals)) d.sgoals.filter((x: any) => x && x.id).forEach((x: any) => out.push(x)); }); return out; } catch { return []; } }
export function saveInfo(g: Goal) {
  const L = moneyGoals(), s = L.find((x) => x.gid === g.id) || (g.saveLink ? L.find((x) => x.id === g.saveLink) : null); if (!s) return null;
  const saved = (Array.isArray(s.contrib) ? s.contrib : []).reduce((a: number, c: any) => a + (Number(c && c.a) || 0), 0), tgt = Number(s.target) || 0;
  return { name: s.name as string, saved: saved / 100, tgt: tgt / 100, p: tgt > 0 ? Math.max(0, Math.min(100, Math.round((saved / tgt) * 100))) : 0 };
}
export function moneyRows(y: number) {
  const s = getState();
  return focusGoals(y).filter((g) => g.usesMoney && g.type !== "level").map((g) => { const auto = g.unit === "₹", amt = auto ? yearTarget(g, y) || 0 : Number((s.budget[y] || {})[g.id] || 0); return { g, auto, amt }; });
}
export const moneyPlanned = (y: number) => moneyRows(y).reduce((a, r) => a + r.amt, 0);

/* ---------- projection / handover ---------- */
export function projectAt(g: Goal, dateStr: string): number {
  const cur = current(g); if (g.type === "level" || g.type === "milestones" || g.type === "habit") return cur;
  const now = Date.now(), el = (now - ts(g.start)) / DAY; if (!(el >= 30)) return cur;
  const rate = (cur - g.baseline) / el; if (rate <= 0) return cur; return cur + rate * Math.max(0, (ts(dateStr) - now) / DAY);
}
export const suggest = (g: Goal): "finish" | "carry" => (g.type === "habit" ? "carry" : g.status === "Completed" || projectAt(g, g.end) >= g.total ? "finish" : "carry");
export function makeSuccessor(g: Goal, np: Plan): Goal {
  const base = Math.round(Math.min(projectAt(g, g.end), g.total) * 100) / 100, simple = g.type === "milestones" || g.type === "habit";
  return { id: uid(), category: g.category, name: g.name, unit: g.unit, type: g.type, total: simple ? 1 : g.total, baseline: simple ? 0 : base, milestones: g.type === "milestones" ? [] : undefined, habit: g.type === "habit" ? { ...g.habit! } : undefined, checks: g.type === "habit" ? [] : undefined,
    start: np.start, end: np.end, status: "Draft", targets: {}, logs: [], focus: {}, usesMoney: g.usesMoney, plan: np.id, prevId: g.id, dependsOn: [] } as Goal;
}
export const undecided = (p: Plan) => getState().goals.filter((g) => !g.archived && g.plan === p.id && g.status !== "Draft" && g.status !== "Completed" && !g.handover && !successorOf(g)).length;
export const handoverDecision = (g: Goal) => (g.status === "Completed" ? "finish" : g.handover || null);
export function decide(g: Goal, v: string) { g.handover = g.handover === v ? null : v; commit(); }
export function useSuggestions(pid: string) { getState().goals.filter((g) => g.plan === pid && g.status !== "Draft" && g.status !== "Completed" && !g.handover).forEach((g) => { g.handover = suggest(g); }); commit(); }
export function handoverPlan(pid: string) {
  const s = getState(), gs = s.goals.filter((g) => !g.archived && g.plan === pid && g.status !== "Draft");
  return { mk: gs.filter((g) => g.handover === "carry" && g.status !== "Completed" && !successorOf(g)), dp: gs.filter((g) => g.handover === "drop" && g.status !== "On Hold" && g.status !== "Completed") };
}
export function applyHandover(pid: string) { const N = nextPlan(pid)!, { mk, dp } = handoverPlan(pid); mk.forEach((g) => getState().goals.push(makeSuccessor(g, N))); dp.forEach((g) => { g.status = "On Hold"; }); commit(); return { made: mk.length, held: dp.length }; }
export function promote(g: Goal) { g.status = g.logs.length ? "In Progress" : "Not Started"; commit(); }

/* ---------- focus ---------- */
export function setFocus(g: Goal, y: number, on: boolean) { if (on) g.focus[y] = true; else delete g.focus[y]; getState().focusMeta[y] = Date.now(); commit(); }
export function toggleFocus(g: Goal, y: number): string | null { if (g.status === "Draft") return "Promote this draft first"; setFocus(g, y, !isFocus(g, y)); return null; }
export function setFocusYear(y: number) { const s = getState(); s.settings.focusYear = y; s.focusMeta[y] = s.focusMeta[y] || Date.now(); commit(); }
export function setTarget(g: Goal, y: number, v: string) { if (v === "") delete g.targets[y]; else g.targets[y] = Number(v); commit(); }
export function setBudget(y: number, gid: string, v: string) { const s = getState(); s.budget[y] = s.budget[y] || {}; s.budget[y][gid] = Number(v) || 0; commit(); }
export function setCapacity(y: number, v: string) { const s = getState(); if (v === "") delete s.capacity[y]; else s.capacity[y] = Number(v); commit(); }
export function setReviewNote(y: number, v: string) { getState().reviews[y] = v; commit(); }

/* ---------- year review ---------- */
export function carryGoal(g: Goal, y: number) {
  const ny = y + 1, t = yearTarget(g, y) as number, a = yearAchieved(g, y) || 0; g.focus[ny] = true; getState().focusMeta[ny] = Date.now();
  if (g.type !== "milestones" && g.type !== "habit" && !((yearTarget(g, ny) as number) > 0) && t > 0) { if (g.type === "level") g.targets[ny] = t; else if (t - a > 0) g.targets[ny] = t - a; }
}
export const carryable = (y: number) => focusGoals(y).filter((g) => { const t = yearTarget(g, y) as number, ny = y + 1; return (!(t > 0) || (yearAchieved(g, y) || 0) < t) && !isFocus(g, ny) && year(g.end) >= ny; });
export function carryAll(y: number) { const L = carryable(y); L.forEach((g) => carryGoal(g, y)); commit(); return L.length; }

/* ---------- save / edit ---------- */
export interface GoalForm { name: string; category: string; newCategory?: string; type: GoalType; unit: string; total: number; baseline: number; start: string; end: string; status: string; usesMoney: boolean; plan: string; perWeek: number; deps?: string[]; saveLink?: string }
export function validateGoalForm(f: GoalForm): string | null {
  const simple = f.type === "milestones" || f.type === "habit";
  if (!f.name.trim()) return "Give the goal a name"; if (!simple && !(f.total > 0)) return "Goal total must be above 0";
  if (!f.start || !f.end) return "Pick start and end dates"; if (f.end < f.start) return "End date is before start date";
  if (f.category === "__new" && !(f.newCategory || "").trim()) return "Type the new category name"; return null;
}
/** Create (id omitted) or update a goal. Returns the goal and whether a circular dependency was skipped. */
export function saveGoal(f: GoalForm, id?: string | null, prevId?: string | null): { g: Goal; skipped: boolean } {
  const s = getState(), simple = f.type === "milestones" || f.type === "habit";
  let cat = f.category === "__new" ? (f.newCategory || "").trim() : f.category.trim() || "General"; const dup = s.categories.find((c) => c.toLowerCase() === cat.toLowerCase()); if (dup) cat = dup; else s.categories.push(cat);
  let g = id ? goalById(id) : undefined;
  if (!g) { g = { id: uid(), targets: {}, logs: [], focus: {}, dependsOn: [] } as any as Goal; if (prevId) g.prevId = prevId; s.goals.push(g); }
  Object.assign(g, { name: f.name.trim(), category: cat, unit: simple ? "" : f.unit.trim(), total: simple ? 1 : f.total, baseline: simple ? 0 : f.baseline || 0, type: f.type, start: f.start, end: f.end, status: f.status, usesMoney: f.usesMoney, plan: f.plan });
  let skipped = false;
  if (f.deps) { const ok = f.deps.filter((d) => !depChain(d, g!.id)); skipped = ok.length < f.deps.length; g.dependsOn = ok; }
  if (f.saveLink !== undefined) { if (f.saveLink) g.saveLink = f.saveLink; else delete g.saveLink; }
  if (f.type === "milestones") { g.milestones = g.milestones || []; syncMs(g); }
  if (f.type === "habit") { g.habit = { perWeek: f.perWeek || 3 }; syncHabit(g); }
  commit(); return { g, skipped };
}
export const blankGoalForm = (plan: string, o: Partial<GoalForm> = {}): GoalForm => ({ name: "", category: allCats()[0] || "", type: "total", unit: "₹", total: NaN, baseline: 0, start: todayStr(), end: "", status: "Not Started", usesMoney: true, plan, perWeek: 3, ...o });
export function formOfGoal(g: Goal): GoalForm { return { name: g.name, category: g.category, type: g.type, unit: g.unit, total: g.total, baseline: g.baseline, start: g.start, end: g.end, status: g.status, usesMoney: !!g.usesMoney, plan: g.plan, perWeek: (g.habit && g.habit.perWeek) || 3, deps: [...(g.dependsOn || [])] }; }

/* ---------- logs, milestones, archive ---------- */
export function addGoalLog(g: Goal, amt: number, date: string, note: string): string | null { if (!Number.isFinite(amt)) return "Enter a number first"; g.logs.push({ id: uid(), date: date || todayStr(), amount: amt, note } as any); autoStatus(g); commit(); return null; }
export function saveLog(g: Goal, lid: string, amt: number, date: string, note: string): string | null { const l: any = g.logs.find((x) => x.id === lid); if (!l) return "Entry not found"; if (!Number.isFinite(amt)) return "Enter a number"; l.amount = amt; l.date = date || l.date; l.note = note.trim(); autoStatus(g); commit(); return null; }
export function deleteLog(g: Goal, lid: string): string | null { const i = g.logs.findIndex((l) => l.id === lid); if (i < 0) return null; const snap = snapState(); g.logs.splice(i, 1); autoStatus(g); commit(); return snap; }
export function addMilestone(g: Goal, title: string, date: string): string | null { title = title.trim(); if (!title) return "Name the milestone"; if (!date) return "Pick a due date"; g.milestones = g.milestones || []; g.milestones.push({ id: uid(), title, date, done: false, doneDate: null }); syncMs(g); commit(); return null; }
export function evenMilestones(g: Goal) { const a = Math.max(ts(g.start), ts(todayStr())), b = ts(g.end), from = b > a ? a : ts(g.start), span = Math.max(DAY, b - from); g.milestones = g.milestones || []; for (let i = 1; i <= 4; i++) g.milestones.push({ id: uid(), title: "Checkpoint " + i, date: isoOf(from + (span * i) / 4), done: false, doneDate: null }); syncMs(g); commit(); }
export function toggleMilestone(g: Goal, mid: string) { const m = (g.milestones || []).find((x) => x.id === mid); if (!m) return; m.done = !m.done; m.doneDate = m.done ? todayStr() : null; syncMs(g); commit(); return m.done; }
export function saveMilestone(g: Goal, mid: string, title: string, date: string): string | null { const m = (g.milestones || []).find((x) => x.id === mid); title = title.trim(); if (!m) return "Not found"; if (!title) return "Name the milestone"; if (!date) return "Pick a due date"; m.title = title; m.date = date; syncMs(g); commit(); return null; }
export function deleteMilestone(g: Goal, mid: string): string | null { const i = (g.milestones || []).findIndex((x) => x.id === mid); if (i < 0) return null; const snap = snapState(); g.milestones!.splice(i, 1); syncMs(g); commit(); return snap; }
export function setArchived(g: Goal, v: boolean) { g.archived = v; commit(); }
export function archiveCompleted(planId: string): Goal[] { const L = getState().goals.filter((g) => g.plan === planId && !g.archived && g.status === "Completed"); L.forEach((g) => { g.archived = true; }); commit(); return L; }
export function addGoalTodo(g: Goal, text: string, due: string): string | null { text = text.trim(); if (!text) return "Type your to-do first"; getState().todos.push({ id: uid(), text, done: false, doneAt: null, due: due || null, goalId: g.id, category: "", repeat: "", created: Date.now(), tags: [] } as any); commit(); return null; }
export function resetGoals() { const s = getState(); const keep = { vault: s.vault, vaultOld: s.vaultOld, todos: s.todos, tags: s.tags, todoTemplates: s.todoTemplates }; s.goals = []; s.focusMeta = {}; s.capacity = {}; s.budget = {}; s.reviews = {}; Object.assign(s, keep); commit(); }

/* ---------- recurring entries ---------- */
const nextYM = (ym: string) => { let [y, m] = ym.split("-").map(Number); m++; if (m > 12) { m = 1; y++; } return y + "-" + String(m).padStart(2, "0"); };
const recurDue = (ym: string, day: number) => { const [y, m] = ym.split("-").map(Number), dim = new Date(y, m, 0).getDate(); return ym + "-" + String(Math.min(day, dim)).padStart(2, "0"); };
export function applyRecurring(): number {
  let total = 0; const today = todayStr();
  getState().goals.forEach((g) => {
    const r: any = g.recurring; if (!r || !r.active || g.type !== "total" || g.archived || ["Draft", "On Hold", "Completed"].includes(g.status)) return;
    let ym = r.last ? nextYM(r.last) : String(r.from).slice(0, 7), guard = 0, added = 0;
    while (guard++ < 240) { const due = recurDue(ym, r.day); if (due > today) break; if (due >= r.from) { g.logs.push({ id: uid(), date: due, amount: r.amount, note: "Recurring", auto: true }); added++; } r.last = ym; ym = nextYM(ym); }
    if (added) { autoStatus(g); total += added; }
  });
  if (total) commit(); return total;
}
export function recurStart(g: Goal, amt: number, day: number, from: string): string | null { if (!Number.isFinite(amt) || amt === 0) return "Enter the monthly amount"; if (!from) return "Pick a start date"; g.recurring = { amount: amt, day, from, active: true, last: null } as any; const n = applyRecurring(); commit(); return "n:" + n; }
export function recurStop(g: Goal) { delete g.recurring; commit(); }

/* ---------- trends ---------- */
export function monthEnds(n: number): string[] { const out: string[] = [], now = new Date(); for (let k = n - 1; k >= 0; k--) out.push(k === 0 ? todayStr() : isoOf(new Date(now.getFullYear(), now.getMonth() - k + 1, 0).getTime())); return out; }
export function monthLabel(iso: string) { const d = new Date(iso + "T00:00:00"); return d.toLocaleDateString("en-IN", { month: "short" }) + (d.getMonth() === 0 ? " ’" + String(d.getFullYear()).slice(2) : ""); }
export function valueAt(g: Goal, iso: string): number {
  if (g.type === "milestones") return (g.milestones || []).filter((m) => m.done && (m.doneDate || m.date) <= iso).length;
  if (g.type === "level") { const l = sortedLogs(g).filter((x) => x.date <= iso); return l.length ? l[l.length - 1].amount : g.baseline; }
  if (g.type === "habit") { const from = addDays(iso, -27); return (g.checks || []).filter((c) => c >= from && c <= iso).length; }
  return g.baseline + g.logs.filter((l) => l.date <= iso).reduce((s, l) => s + l.amount, 0);
}
export function pctAt(g: Goal, iso: string): number | null {
  if (iso < g.start) return null;
  if (g.type === "habit") return clamp(valueAt(g, iso) / (((g.habit && g.habit.perWeek) || 3) * 4));
  if (g.type === "milestones") { const n = (g.milestones || []).length; return n ? clamp(valueAt(g, iso) / n) : 0; }
  return g.total > 0 ? clamp(valueAt(g, iso) / g.total) : 0;
}
export function sortGoals(list: Goal[]) {
  const s = getState().settings.sort || "default", a = list.slice();
  if (s === "deadline") a.sort((x, y) => (x.end < y.end ? -1 : x.end > y.end ? 1 : 0)); else if (s === "progress") a.sort((x, y) => pct(x) - pct(y)); else if (s === "name") a.sort((x, y) => x.name.localeCompare(y.name)); return a;
}
export const nextMilestone = (g: Goal) => (g.milestones || []).filter((m) => !m.done).sort(byDate as any)[0];

/* ---------- Excel / CSV import & export ---------- */
export const normName = (s: any) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "").replace(/^mf$/, "mutualfunds");
export function toISO(v: any): string | null {
  if (v == null || v === "") return null; if (typeof v === "number" && v > 20000 && v < 90000) return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * DAY).toISOString().slice(0, 10);
  const s = String(v).trim(); if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10); const d = new Date(s); return isNaN(d.getTime()) ? null : isoOf(d.getTime());
}
export interface ImportRow { name: string; category?: string; total: number; cur?: number; start?: string; end?: string; status?: string; targets: Record<string, number> }
/** `sheets` = array of sheets, each an array of rows (what XLSX.sheet_to_json(header:1) or a CSV parse gives). */
export function parseGoalSheets(sheets: any[][][]): ImportRow[] {
  const rows: Record<string, ImportRow> = {};
  sheets.forEach((a) => {
    let hi = -1; for (let i = 0; i < Math.min(a.length, 30); i++) if ((a[i] || []).map((c) => String(c == null ? "" : c).trim().toLowerCase()).includes("goal name")) { hi = i; break; }
    if (hi < 0) return;
    const head = a[hi].map((c: any) => String(c == null ? "" : c).trim().toLowerCase()), col = (n: string) => head.indexOf(n);
    const ci = { cat: col("category"), name: col("goal name"), total: col("goal total"), cur: col("current number"), start: col("start date"), end: col("end date"), status: col("status") };
    const yc = head.map((t: string, i: number) => ({ m: /^(\d{4}) target$/.exec(t), i })).filter((x: any) => x.m);
    for (let r = hi + 1; r < a.length; r++) {
      const row = a[r] || [], nm = String(row[ci.name] == null ? "" : row[ci.name]).trim(); if (!nm) continue; const total = Number(row[ci.total]); if (!(total > 0)) continue;
      const o = rows[normName(nm)] || (rows[normName(nm)] = { name: nm, targets: {} } as ImportRow);
      if (ci.cat >= 0 && row[ci.cat]) o.category = String(row[ci.cat]).trim(); o.total = total;
      if (ci.cur >= 0 && row[ci.cur] != null && row[ci.cur] !== "" && !isNaN(Number(row[ci.cur]))) o.cur = Number(row[ci.cur]);
      if (ci.start >= 0) o.start = toISO(row[ci.start]) || o.start; if (ci.end >= 0) o.end = toISO(row[ci.end]) || o.end;
      if (ci.status >= 0 && (STATUSES as readonly string[]).includes(String(row[ci.status]).trim())) o.status = String(row[ci.status]).trim();
      yc.forEach((y: any) => { const v = row[y.i]; if (v != null && v !== "" && !isNaN(Number(v))) o.targets[y.m[1]] = Number(v); });
    }
  });
  return Object.values(rows);
}
export interface ImportItem { r: ImportRow; g?: Goal; ch: string[]; on: boolean }
export function buildGoalImport(rows: ImportRow[]): ImportItem[] {
  const s = getState();
  return rows.map((r) => {
    const g = s.goals.find((x) => normName(x.name) === normName(r.name)), ch: string[] = [];
    if (!g) ch.push("New goal"); else {
      if (r.total !== g.total && g.type !== "milestones" && g.type !== "habit") ch.push(`total ${fmt(g.total, g.unit)} → ${fmt(r.total, g.unit)}`);
      if (r.start && r.start !== g.start) ch.push(`start ${fmtDate(g.start)} → ${fmtDate(r.start)}`); if (r.end && r.end !== g.end) ch.push(`end ${fmtDate(g.end)} → ${fmtDate(r.end)}`); if (r.status && r.status !== g.status) ch.push(`status ${g.status} → ${r.status}`);
      if (r.cur != null && (g.type === "total" || g.type === "level") && Math.abs(r.cur - current(g)) > 0.001) ch.push(`current ${fmt(current(g), g.unit)} → ${fmt(r.cur, g.unit)}`);
      Object.keys(r.targets).forEach((y) => { if (yearTarget(g, +y) !== r.targets[y]) ch.push(`${y} target → ${fmt(r.targets[y], g.unit)}`); });
    }
    return { r, g, ch, on: true };
  }).filter((x) => x.ch.length);
}
export function applyGoalImport(items: ImportItem[]) {
  const s = getState(); let nNew = 0, nUp = 0;
  items.filter((x) => x.on).forEach(({ r, g }) => {
    if (!g) {
      const money = /fund|fire|stock|earning|income|salary|saving|\bmf\b/i.test(r.name) || r.total >= 50000, gram = /(gold|silver).*gm|gm/i.test(r.name), start = r.start || todayStr(), end = r.end || addDays(start, 365 * 5);
      s.goals.push({ id: uid(), category: r.category || "General", name: r.name, unit: gram ? "gm" : money ? "₹" : "", type: /earning|income|salary/i.test(r.name) ? "level" : "total", total: r.total, baseline: r.cur || 0, start, end, status: (r.status as any) || "Not Started", targets: { ...r.targets }, logs: [], focus: {}, dependsOn: [], plan: planOfYear(year(start))?.id || s.plans[0]?.id } as any); nNew++;
      if (r.category && !s.categories.some((c) => c.toLowerCase() === r.category!.toLowerCase())) s.categories.push(r.category);
    } else {
      if (g.type !== "milestones" && g.type !== "habit") g.total = r.total; if (r.start) g.start = r.start; if (r.end) g.end = r.end; if (r.status) g.status = r.status as any;
      Object.keys(r.targets).forEach((y) => { if (g.type !== "milestones" && g.type !== "habit") g.targets[y] = r.targets[y]; });
      if (r.cur != null) { if (g.type === "total") g.baseline = r.cur - g.logs.reduce((a, l) => a + l.amount, 0); else if (g.type === "level" && Math.abs(r.cur - current(g)) > 0.001) g.logs.push({ id: uid(), date: todayStr(), amount: r.cur, note: "Excel import" }); }
      nUp++;
    }
  });
  commit(); return { nNew, nUp };
}
export function goalExportRows() {
  const s = getState(), ys = yearRange(), head = ["Plan", "Category", "Goal Name", "Unit", "Type", "Goal Total", "Current Number", "Progress %", "Start Date", "End Date", "Status", "Focus years", ...ys.map((y) => y + " Target")];
  const rows = s.goals.filter((g) => !g.archived).map((g) => [planLabel(planById(g.plan) || s.plans[0]), g.category, g.name, g.unit || "", g.type, g.total, current(g), +(pct(g) * 100).toFixed(2), g.start, g.end, g.status, Object.keys(g.focus || {}).join(" "), ...ys.map((y) => { const t = yearTarget(g, y) as number; return t > 0 ? t : ""; })]);
  return { head, rows };
}
export const goalCsv = () => { const { head, rows } = goalExportRows(), q = (v: any) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; return [head, ...rows].map((r) => r.map(q).join(",")).join("\n"); };
export { snapState, restoreSnap, curYear };
