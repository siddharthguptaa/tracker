import type { Todo } from "./types";
import { getState } from "./ctx";
import { addDays, addMonthsIso, dowOf, isoOf, mondayOf, nextDow, nowHM, p2, todayStr } from "./clock";
import { uid } from "./format";

export const T_DOW: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
export const T_MON: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

export function dueLabel(iso: string) {
  const t = todayStr(); if (iso === t) return "Today"; if (iso === addDays(t, 1)) return "Tomorrow";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}
export interface Repeat { n: number; unit: "day" | "week" | "month" | "year" | "weekday"; from: "due" | "done" }
/* repeats are stored as short text: daily, weekdays, weekly, monthly, yearly, "every 3 days", plus " after completion" */
export function parseRepeatText(s: any): Repeat | null {
  s = String(s || "").toLowerCase().trim(); if (!s) return null;
  const from = /(after|from)\s+(completion|done|complete)/.test(s) ? "done" : "due"; s = s.replace(/\s*(after|from)\s+(completion|done|complete)\w*/, "").trim();
  let m: RegExpExecArray | null;
  if (/^(daily|every\s*day|each\s*day)$/.test(s)) return { n: 1, unit: "day", from };
  if (/^(weekly|every\s*week)$/.test(s)) return {n:1, unit:"week", from};
  if (/^(monthly|every\s*month)$/.test(s)) return {n:1, unit:"month", from};
  if (/^(yearly|annually|every\s*year)$/.test(s)) return {n:1, unit:"year", from};
  if (/^(every\s*)?weekdays?$/.test(s)) return {n:1, unit:"weekday", from};
  if ((m = /^every\s+(\d+)\s*(day|week|month|year)s?$/.exec(s))) return {n:Math.max(1, +m[1]), unit:m[2] as Repeat["unit"], from};
  if (s.includes("dai")) return { n: 1, unit: "day", from }; if (s.includes("week")) return {n:1, unit:"week", from};
  if (s.includes("month")) return {n:1, unit:"month", from}; if (s.includes("year")) return {n:1, unit:"year", from};
  return null;
}
export function repText(r: Repeat | null) {
  if (!r) return ""; const suf = r.from === "done" ? " after completion" : "";
  if (r.unit === "weekday") return "weekdays" + suf;
  return (r.n === 1 ? {day:"daily", week:"weekly", month:"monthly", year:"yearly"}[r.unit] : `every ${r.n} ${r.unit}s`) + suf;
}
export const repOf = (t: Pick<Todo, "repeat">) => parseRepeatText(t.repeat);
function stepDue(r: Repeat, iso: string, dom?: number) {
  if (r.unit === "day") return addDays(iso, r.n); if (r.unit === "week") return addDays(iso, 7 * r.n);
  if (r.unit === "weekday") { let x = iso; for (let i = 0; i < r.n; i++) { do { x = addDays(x, 1); } while (dowOf(x) === 0 || dowOf(x) === 6); } return x; }
  return addMonthsIso(iso, r.unit === "month" ? r.n : 12 * r.n, dom);
}
export function nextDueFor(t: Todo) {
  const r = repOf(t); if (!r) return null; const today = todayStr();
  if (r.from === "done" || !t.due) return stepDue(r, today, t.rdom);
  let x = stepDue(r, t.due, t.rdom), g = 0; while (x <= today && g++ < 800) x = stepDue(r, x, t.rdom); return x;
}

export interface Quick { text: string; due: string | null; time: string | null; tags: string[]; repeat: string; someday: boolean; est: number | null; any: boolean }
export function parseQuick(input: string): Quick {
  const state = getState(), today = todayStr(), o: Quick = { text: "", due: null, time: null, tags: [], repeat: "", someday: false, est: null, any: false }; let s = " " + String(input || "") + " ";
  const cut = (re: RegExp, fn: (m: RegExpExecArray) => void) => { const m = re.exec(s); if (!m) return false; s = s.slice(0, m.index) + " " + s.slice(m.index + m[0].length); fn(m); o.any = true; return true; };
  const tg: string[] = []; s = s.replace(/(^|\s)#([\w-]+)/g, (all, sp, nm) => { const k = nm.toLowerCase().replace(/[\s_-]/g, ""), t = state.tags.find(x => x.name.toLowerCase().replace(/[\s_-]/g, "") === k); if (t) { tg.push(t.id); o.any = true; return sp; } return all; });
  o.tags = [...new Set(tg)];
  let rep = "", repDow: number | null = null;
  cut(/\bevery\s+(mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/i, m => { rep = "weekly"; repDow = T_DOW[m[1].toLowerCase()]; });
  if (!rep) cut(/\b(?:every|each)\s+(\d+\s*)?(day|week|month|year)s?\b(\s+(?:after|from)\s+(?:completion|done))?/i, m => { const n = m[1] ? +m[1] : 1, u = m[2].toLowerCase(); rep = (n === 1 ? {day:"daily", week:"weekly", month:"monthly", year:"yearly"}[u] : `every ${n} ${u}s`) + (m[3] ? " after completion" : ""); });
  if (!rep) cut(/\bevery\s*weekdays?\b|\bweekdays\b/i, () => { rep = "weekdays"; });
  if (!rep) cut(/\b(daily|weekly|monthly|yearly|annually)\b/i, m => { const w = m[1].toLowerCase(); rep = w === "annually" ? "yearly" : w; });
  cut(/\b(someday|some day)\b/i, () => { o.someday = true; });
  cut(/(?:^|\s)(?:~|est\.?\s*|for\s+)(\d+(?:\.\d+)?)\s*(m|min|mins|minutes?|h|hr|hrs|hours?)\b/i, m => { const v = parseFloat(m[1]); o.est = Math.round(/^h/i.test(m[2]) ? v * 60 : v); });
  if (!o.est) cut(/(?:^|\s)(\d+(?:\.\d+)?)(m|min|mins|h|hr|hrs)(?=\s)/i, m => { const v = parseFloat(m[1]); o.est = Math.round(/^h/i.test(m[2]) ? v * 60 : v); });
  cut(/\b(?:at\s+)?(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/i, m => { let h = +m[1] % 12; if (/pm/i.test(m[3])) h += 12; o.time = p2(h) + ":" + (m[2] || "00"); });
  if (!o.time) cut(/\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/, m => { o.time = p2(+m[1]) + ":" + m[2]; });
  if (!o.time) cut(/\bat\s+(1[0-9]|2[0-3]|[1-9])\b(?![\/.\-:]\d)/i, m => { let h = +m[1]; if (h < 7) h += 12; o.time = p2(h) + ":00"; });
  if (!o.time) cut(/\bnoon\b/i, () => { o.time = "12:00"; });
  let due: string | null = null;
  cut(/\btonight\b/i, () => { due = today; if (!o.time) o.time = "20:00"; });
  if (!due) cut(/\b(\d{4})-(\d{2})-(\d{2})\b/, m => { due = m[0]; });
  if (!due) cut(/\bday after tomorrow\b/i, () => { due = addDays(today, 2); });
  if (!due) cut(/\b(tomorrow|tmrw|tmr)\b/i, () => { due = addDays(today, 1); });
  if (!due) cut(/\btoday\b/i, () => { due = today; });
  if (!due) cut(/\bnext\s+week\b/i, () => { due = addDays(mondayOf(today), 7); });
  if (!due) cut(/\bnext\s+month\b/i, () => { due = addMonthsIso(today, 1); });
  if (!due) cut(/\bin\s+(\d+)\s*(day|week|month)s?\b/i, m => { const n = +m[1], u = m[2].toLowerCase(); due = u === "day" ? addDays(today, n) : u === "week" ? addDays(today, 7 * n) : addMonthsIso(today, n); });
  if (!due) cut(/\b(?:next\s+|on\s+|this\s+)?(sun(?:day)?|mon(?:day)?|tues?(?:day)?|wed(?:nesday)?|thu(?:rs?(?:day)?)?|fri(?:day)?|sat(?:urday)?)\b/i, m => { due = nextDow(T_DOW[m[1].slice(0, 3).toLowerCase()], today, true); });
  const fixYear = (d, mo, y) => { let yy = y ? (+y < 100 ? 2000 + +y : +y) : new Date().getFullYear(), iso = yy + "-" + p2(mo) + "-" + p2(d); if (!y && iso < today) iso = (yy + 1) + "-" + p2(mo) + "-" + p2(d); return iso; };
  if (!due) cut(/\b(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?\b/, m => { if (+m[1] >= 1 && +m[1] <= 31 && +m[2] >= 1 && +m[2] <= 12) due = fixYear(+m[1], +m[2], m[3]); else { s += m[0]; o.any = false; } });
  if (!due) cut(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i, m => { due = fixYear(+m[1], T_MON[m[2].toLowerCase()] + 1, null); });
  if (!due) cut(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/i, m => { due = fixYear(+m[2], T_MON[m[1].toLowerCase()] + 1, null); });
  if (rep && !due) due = repDow != null ? nextDow(repDow, today, false) : today;
  if (o.time && !due) due = o.time > nowHM() ? today : addDays(today, 1);
  o.due = o.someday ? null : due; o.repeat = rep;
  o.text = s.replace(/\s+/g, " ").trim().replace(/^(on|by|at|due|from|to|until)\s+/i, "").replace(/\s+(on|by|at|due|from|until|every|in)$/i, "").trim() || String(input || "").trim();
  return o;
}

export function completeTodo(t: Todo) {
  const state = getState();
  t.done = !t.done; t.doneAt = t.done ? Date.now() : null;
  if (t.done && repOf(t)) {
    const nx: Todo = { ...t, id: uid(), done: false, doneAt: null, due: nextDueFor(t), created: Date.now(), alerted: null, subs: (t.subs || []).map((s) => ({ ...s, id: uid(), d: false })) };
    delete nx.nextId; if (!nx.subs!.length) delete nx.subs;
    t.nextId = nx.id; state.todos.push(nx);
  } else if (!t.done && t.nextId) {
    const nx = state.todos.find((x) => x.id === t.nextId); if (nx && !nx.done) state.todos = state.todos.filter((x) => x !== nx); delete t.nextId;
  }
}
export const todoGoal = (t: Todo) => (t.goalId ? getState().goals.find((g) => g.id === t.goalId) : undefined);
export const todoCat = (t: Todo) => { const g = todoGoal(t); return g ? g.category : t.category || ""; };
export function todoStats() {
  const state = getState();
  const done = state.todos.filter((t) => t.done && t.doneAt), today = todayStr(), days: Record<string, number> = {}; done.forEach((t) => { const d = isoOf(t.doneAt!); days[d] = (days[d] || 0) + 1; });
  let streak = 0, d = days[today] ? today : addDays(today, -1); while (days[d]) { streak++; d = addDays(d, -1); }
  let best = 0, run = 0; Object.keys(days).sort().forEach((k, i, a) => { run = i && addDays(a[i - 1], 1) === k ? run + 1 : 1; best = Math.max(best, run); });
  const mon = mondayOf(today), weeks: { s: string; n: number }[] = []; for (let i = 7; i >= 0; i--) { const s = addDays(mon, -7 * i), e = addDays(s, 6); weeks.push({ s, n: done.filter((t) => { const x = isoOf(t.doneAt!); return x >= s && x <= e; }).length }); }
  const thisWeek = weeks[7].n, thisMonth = done.filter((t) => isoOf(t.doneAt!).slice(0, 7) === today.slice(0, 7)).length;
  const withDue = done.filter((t) => t.due), onTime = withDue.filter((t) => isoOf(t.doneAt!) <= t.due!).length, last30 = done.filter((t) => isoOf(t.doneAt!) >= addDays(today, -29));
  const by: Record<string, number> = {}; last30.forEach((t) => { const k = todoCat(t) || "No category"; by[k] = (by[k] || 0) + 1; });
  const top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 5), mx = Math.max(1, ...weeks.map((w) => w.n)), est = done.filter((t) => isoOf(t.doneAt!) >= mon).reduce((a, t) => a + (t.est || 0), 0);
  return { streak, best, thisWeek, thisMonth, total: done.length, onTime: withDue.length ? Math.round((onTime / withDue.length) * 100) : null, avg: (last30.length / 30).toFixed(1), weeks, mx, top, est };
}
