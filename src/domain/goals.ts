import type { AppState, Goal } from "./types";
import { getState } from "./ctx";
import { DAY, addDays, byDate, clamp, curYear, isoOf, mondayOf, todayStr, ts, year } from "./clock";
import { fmtDate, monthsText } from "./format";
import { REVIEW_DAYS } from "./normalize";

export const sortedLogs = (g: Goal) => g.logs.map((l, i) => ({ ...l, i })).sort((a, b) => (a.date === b.date ? a.i - b.i : a.date < b.date ? -1 : 1));
export function current(g: Goal): number {
  if (g.type === "habit") return habitStats(g).hit;
  if (g.type === "milestones") return (g.milestones || []).filter((m) => m.done).length;
  if (g.type === "level") { const l = sortedLogs(g); return l.length ? l[l.length - 1].amount : g.baseline; }
  return g.baseline + g.logs.reduce((s, l) => s + l.amount, 0);
}
export const pct = (g: Goal): number => (g.type === "habit" ? habitStats(g).consistency : g.total > 0 ? clamp(current(g) / g.total) : 0);
export function pctText(g: Goal) { const p = pct(g) * 100; return (p > 0 && p < 10 ? p.toFixed(1) : Math.round(p)) + "%"; }
export function expected(g: Goal): number {
  if (g.type === "milestones") { const ms = g.milestones || []; return ms.length ? ms.filter((m) => m.date <= todayStr()).length / ms.length : 0; }
  const a = ts(g.start), b = ts(g.end), n = Date.now();
  if (!a || !b || b <= a) return 0;
  return clamp((n - a) / (b - a));
}
export function timeLeft(g: Goal) {
  const d = Math.round((ts(g.end) - Date.now()) / DAY);
  if (isNaN(d)) return "";
  if (d < 0) return "Overdue by " + (Math.abs(d) > 60 ? Math.round(Math.abs(d) / 30) + " mo" : Math.abs(d) + " d");
  if (d > 60) return Math.round(d / 30.4) + " months left";
  return d + " days left";
}
export function paceInfo(g: Goal): { t: string; c: string } {
  if (g.status === "Draft") return { t: "Draft — not counted yet", c: "" };
  if (g.type === "habit") {
    if (g.status === "Completed") return { t: "Completed", c: "ok" };
    if (g.status === "On Hold") return { t: "On hold", c: "" };
    if (ts(g.start) > Date.now()) return { t: "Starts " + fmtDate(g.start), c: "" };
    const st = habitStats(g);
    if (st.thisCount >= st.per) return { t: "Week done ✓", c: "ok" };
    const need = st.per - st.thisCount, left = 7 - ((new Date().getDay() + 6) % 7);
    return need > left ? { t: `Behind this week (${need} to go)`, c: "bad" } : { t: `${need} more this week`, c: "" };
  }
  if (g.type === "milestones" && g.status !== "Completed" && g.status !== "On Hold") {
    const od = (g.milestones || []).filter((m) => !m.done && m.date < todayStr()).length;
    if (od) return { t: `${od} milestone${od > 1 ? "s" : ""} overdue`, c: "bad" };
  }
  if (g.status === "Completed") return { t: "Completed", c: "ok" };
  if (g.status === "On Hold") return { t: "On hold", c: "" };
  if (ts(g.start) > Date.now()) return { t: "Starts " + fmtDate(g.start), c: "" };
  if (g.status === "Not Started") return { t: "Not started", c: "bad" };
  return pct(g) >= expected(g) ? { t: "On track", c: "ok" } : { t: "Behind pace", c: "bad" };
}
export function yearAchieved(g: Goal, y: number): number | null {
  if (g.type === "habit") return (g.checks || []).filter((c) => year(c) === y).length;
  if (g.type === "milestones") return (g.milestones || []).filter((m) => m.done && year(m.doneDate || m.date) === y).length;
  const ls = sortedLogs(g).filter((l) => year(l.date) === y);
  if (g.type === "level") { if (ls.length) return ls[ls.length - 1].amount; return y === curYear() ? current(g) : null; }
  return ls.reduce((s, l) => s + l.amount, 0);
}
export function yearTarget(g: Goal, y: number): number | null {
  if (g.type === "habit") {
    const a = Math.max(ts(g.start), ts(y + "-01-01")), b = Math.min(ts(g.end), ts(y + 1 + "-01-01") - DAY), days = (b - a) / DAY + 1;
    return days > 0 ? Math.round(((g.habit && g.habit.perWeek) || 3) * days / 7) : null;
  }
  if (g.type === "milestones") { const n = (g.milestones || []).filter((m) => year(m.date) === y).length; return n > 0 ? n : null; }
  const t = g.targets && g.targets[y];
  return t === undefined || t === null || t === "" ? null : Number(t);
}
export function autoStatus(g: Goal) {
  if (g.status === "Draft") return;
  if (g.type === "habit") { if (g.status === "Not Started" && (g.checks || []).length) g.status = "In Progress"; return; }
  if (g.total > 0 && current(g) >= g.total) g.status = "Completed";
  else if (g.status === "Completed") g.status = "In Progress";
  else if (g.status === "Not Started" && (g.logs.length || (g.milestones || []).some((m) => m.done))) g.status = "In Progress";
}
export function forecast(g: Goal): { t: string; c: string } | null {
  if (g.status === "Draft" || g.status === "Completed" || g.status === "On Hold" || g.archived) return null;
  if (g.type === "milestones") {
    const left = (g.milestones || []).filter((m) => !m.done).sort(byDate); if (!left.length) return null;
    const od = left.filter((m) => m.date < todayStr()).length, last = left[left.length - 1];
    return od ? { t: `${od} overdue · last milestone due ${fmtDate(last.date)}`, c: "bad" } : { t: `Last milestone due ${fmtDate(last.date)}`, c: "" };
  }
  if (g.type === "habit" || g.type === "level") return null;
  if (ts(g.start) > Date.now()) return null;
  const rem = g.total - current(g); if (rem <= 0) return null;
  const cutoff = Math.max(ts(g.start), Date.now() - 180 * DAY), days = Math.max(30, (Date.now() - cutoff) / DAY);
  const gained = g.logs.filter((l) => ts(l.date) >= cutoff).reduce((s, l) => s + l.amount, 0);
  if (gained <= 0) return { t: "No pace yet — log progress to see a forecast", c: "" };
  const finish = Date.now() + (rem / (gained / days)) * DAY;
  if (!isFinite(finish) || finish > Date.now() + 80 * 365 * DAY) return { t: "At this pace it would take over 80 years", c: "bad" };
  const when = new Date(finish).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
  const diffM = Math.round((finish - ts(g.end)) / DAY / 30.4);
  if (diffM > 1) return { t: `At this pace: ${when} — ${monthsText(diffM)} late`, c: "bad" };
  if (diffM < -1) return { t: `At this pace: ${when} — ${monthsText(-diffM)} early`, c: "ok" };
  return { t: `At this pace: ${when} — on time`, c: "ok" };
}
const weekCount = (g: Goal, mon: string) => { const end = addDays(mon, 6); return (g.checks || []).filter((c) => c >= mon && c <= end).length; };
export interface HabitStats { per: number; thisCount: number; completed: number; hit: number; consistency: number; streak: number; strip: { mon: string; n: number; live: boolean; before: boolean }[]; total: number }
export function habitStats(g: Goal): HabitStats {
  const per = (g.habit && g.habit.perWeek) || 3, today = todayStr(), curMon = mondayOf(today);
  const thisCount = weekCount(g, curMon);
  const out: HabitStats = { per, thisCount, completed: 0, hit: 0, consistency: 0, streak: 0, strip: [], total: (g.checks || []).length };
  if (g.start > today) return out;
  const first = mondayOf(g.start), hits: boolean[] = [];
  for (let m = first, i = 0; m < curMon && i < 600; m = addDays(m, 7), i++) hits.push(weekCount(g, m) >= per);
  out.completed = hits.length; out.hit = hits.filter(Boolean).length;
  out.consistency = hits.length ? out.hit / hits.length : clamp(thisCount / per);
  let s = 0; for (let i = hits.length - 1; i >= 0 && hits[i]; i--) s++;
  out.streak = s + (thisCount >= per ? 1 : 0);
  for (let k = 7; k >= 0; k--) { const m = addDays(curMon, -7 * k); out.strip.push({ mon: m, n: weekCount(g, m), live: k === 0, before: m < first }); }
  return out;
}
/* ---- focus ---- */
export const fy = (s: AppState = getState()) => s.settings.focusYear || curYear();
export const isFocus = (g: Goal, y: number = fy()) => !g.archived && g.status !== "Draft" && !!(g.focus && g.focus[y]);
export const focusGoals = (y: number = fy()) => getState().goals.filter((g) => isFocus(g, y));
export const isLive = (g: Goal) => g.status !== "Completed" && g.status !== "On Hold" && g.status !== "Draft" && ts(g.start) <= Date.now() && Date.now() <= ts(g.end) + DAY;
export function focusDue(y: number = fy()) { const m = getState().focusMeta[y] || Date.now(), due = m + REVIEW_DAYS * DAY; return { due, late: Date.now() >= due, ageDays: Math.floor((Date.now() - m) / DAY) }; }
export function lastTouch(g: Goal): string {
  if (g.type === "habit") { const c = (g.checks || []).slice().sort(); return c.length ? c[c.length - 1] : g.start; }
  if (g.type === "milestones") { const d = (g.milestones || []).filter((m) => m.done).map((m) => m.doneDate || m.date).sort(); return d.length ? d[d.length - 1] : g.start; }
  return g.logs.length ? g.logs.reduce((m, l) => (l.date > m ? l.date : m), g.logs[0].date) : g.start;
}
export function forgotten() {
  const s = getState(), lim = s.settings.staleDays || 180;
  return s.goals.filter((g) => !g.archived).map((g) => ({ g, days: Math.floor((Date.now() - ts(lastTouch(g))) / DAY) }))
    .filter((x) => x.g.status !== "Completed" && x.g.status !== "On Hold" && x.g.status !== "Draft" && ts(x.g.start) <= Date.now() && x.days >= (x.g.type === "habit" ? Math.min(lim, 14) : lim))
    .sort((a, b) => b.days - a.days);
}
export { isoOf };
