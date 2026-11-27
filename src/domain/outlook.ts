import { getState } from "./ctx";
import { DAY, addDays, clamp, todayStr, ts, byDate } from "./clock";
import { fmt, fmtDate, monthsText } from "./format";
import { current, habitStats, pct, sortedLogs, timeLeft } from "./goals";
import { readMoney } from "../storage/moneyStore";
import type { Goal } from "./types";
void addDays; void byDate; void pct; void timeLeft;

export function moneyTrend() {
  const D = readMoney(); if (!D || !D.records.length) return null;
  const mo = todayStr().slice(0, 7), months = {}, cats = {}, catN = {}; (D.categories || []).forEach(c => { catN[c.id] = c; });
  D.records.forEach(r => { const m = String(r.d).slice(0, 7); if (m >= mo) return; const x = months[m] = months[m] || {i:0, e:0}; if (r.t === "i") x.i += r.a; else if (r.t === "e") { x.e += r.a; cats[r.c] = (cats[r.c] || 0) + r.a; } });
  const ks = Object.keys(months).sort().slice(-3); if (!ks.length) return null;
  const inc = ks.reduce((s, k) => s + months[k].i, 0) / ks.length / 100, exp = ks.reduce((s, k) => s + months[k].e, 0) / ks.length / 100;
  const top = Object.entries(cats as Record<string, number>).map(([id, v]) => ({name:(catN[id] || {}).name || "Other", icon:(catN[id] || {}).icon || "•", avg:v / ks.length / 100})).sort((a: any, b: any) => b.avg - a.avg).slice(0, 3);
  return {n:ks.length, inc, exp, net:inc - exp, top, cur:(D.settings && D.settings.currency) || "₹"};
}
export function goalOutlook(g: Goal) {
  const now = Date.now(), end = ts(g.end), start = ts(g.start), mLeft = Math.max(0.25, (end - now) / DAY / 30.44);
  const o: any = {g, key:"ok", like:0, tip:"", have:null, need:null, finish:null};
  if (g.status === "Completed") return {...o, key:"done", like:100};
  if (start > now) return {...o, key:"upcoming", like:100, tip:`Starts ${fmtDate(g.start)}. Plan the first step now.`};
  if (g.type === "habit") {
    const st = habitStats(g), c = st.consistency; o.like = Math.round(c * 100);
    o.key = c >= 0.8 ? "ahead" : c >= 0.6 ? "ontrack" : c >= 0.35 ? "risk" : "behind";
    o.tip = c >= 0.8 ? `Strong consistency (${o.like}%). Keep the same time and place each day.` : `Consistency is ${o.like}% — you need ${st.per}× a week. Tie it to a fixed trigger (after chai, before bed) and schedule it in your to-dos.`;
    return o;
  }
  if (g.type === "milestones") {
    const ms = g.milestones || [], left = ms.filter(m => !m.done), od = left.filter(m => m.date < todayStr());
    const done90 = ms.filter(m => m.done && ts(m.doneDate || m.date) >= now - 90 * DAY).length / 3, needM = left.length / mLeft;
    o.have = done90; o.need = needM;
    if (od.length) { o.key = od.length > 1 ? "behind" : "risk"; o.like = Math.max(10, 70 - od.length * 20); o.tip = `${od.length} milestone${od.length > 1 ? "s are" : " is"} overdue — finish or re-date “${od[0].title || (od[0] as any).name || "the first one"}” this week, then the rest fall into place.`; }
    else { o.key = left.length ? "ontrack" : "done"; o.like = 85; o.tip = left.length ? `Next up: ${fmtDate(left.sort(byDate)[0].date)}. You need about ${needM.toFixed(1)} milestone${needM >= 1.5 ? "s" : ""} per month.` : ""; }
    return o;
  }
  const cur = current(g), rem = g.total - cur; if (g.type === "total" && rem <= 0) return {...o, key:"done", like:100};
  let gained = 0, days = 30;
  if (g.type === "level") {
    const l = sortedLogs(g); if (l.length >= 2) { const a = l[Math.max(0, l.length - 6)], b = l[l.length - 1]; days = Math.max(14, (ts(b.date) - ts(a.date)) / DAY); gained = (b.amount - a.amount) * ((g.total - g.baseline) >= 0 ? 1 : -1); }
    else { o.key = "risk"; o.like = 50; o.tip = "Log your progress at least twice so I can see your trend and project the finish."; return o; }
  } else {
    const cutoff = Math.max(start, now - 180 * DAY); days = Math.max(30, (now - cutoff) / DAY); gained = g.logs.filter(l => ts(l.date) >= cutoff).reduce((s, l) => s + l.amount, 0);
  }
  const dir = g.type === "level" && g.total < g.baseline ? -1 : 1, remAbs = Math.max(0, dir * (g.total - cur)); if (g.type === "level" && remAbs <= 0) return {...o, key:"done", like:100};
  const have = Math.max(0, gained / days * 30.44), need = remAbs / mLeft; o.have = have; o.need = need;
  if (end < now) { o.key = "behind"; o.like = 10; o.tip = `The deadline passed with ${Math.round(pct(g) * 100)}% done. Re-plan: set a realistic new end date and a monthly amount of ${fmt(Math.round(remAbs / 6), g.unit)} for 6 months.`; return o; }
  if (have <= 0) { o.key = "stalled"; o.like = 5; o.tip = `No recent progress logged. Log even a first small entry — to finish on time you need about ${fmt(Math.round(need), g.unit)} per month.`; return o; }
  o.finish = now + remAbs / (have / 30.44) * DAY; o.late = Math.round((o.finish - end) / DAY / 30.44);
  const r = have / Math.max(need, 1e-9); o.like = Math.round(clamp(r, 0, 1.2) * 85);
  o.key = r >= 1.1 ? "ahead" : r >= 0.9 ? "ontrack" : r >= 0.5 ? "risk" : "behind";
  const when = new Date(o.finish).toLocaleDateString("en-IN", {month:"short", year:"numeric"});
  if (o.key === "ahead") o.tip = `Ahead of plan — at this pace you finish ${when}. You could raise the target or free effort for another goal.`;
  else if (o.key === "ontrack") o.tip = `On track — finishing around ${when}. Keep ${fmt(Math.round(need), g.unit)} per month going.`;
  else o.tip = `At ${fmt(Math.round(have), g.unit)}/month you finish ${when} (${monthsText(Math.max(1, o.late))} late). Raise it by ${fmt(Math.round(need - have), g.unit)}/month to hit ${fmtDate(g.end)} — or move the deadline to ${when}.`;
  return o;
}
export function outlookAll() {
  const act = getState().goals.filter(g => !g.archived && g.status !== "Draft" && g.status !== "On Hold").map(goalOutlook);
  const live = act.filter(o => !["done", "upcoming"].includes(o.key)), n = live.length;
  const score = n ? Math.round(live.reduce((s, o) => s + o.like, 0) / n) : null, cnt = k => live.filter(o => o.key === k).length;
  const order = {stalled:0, behind:1, risk:2, ontrack:3, ahead:4};
  live.sort((a, b) => (order[a.key] - order[b.key]) || (a.like - b.like));
  return {all:act, live, score, n, ahead:cnt("ahead"), ontrack:cnt("ontrack"), risk:cnt("risk"), behind:cnt("behind"), stalled:cnt("stalled"), done:act.filter(o => o.key === "done").length};
}
export function outlookLabel(s) { return s == null ? "" : s >= 80 ? "Excellent" : s >= 60 ? "Good" : s >= 40 ? "Needs attention" : "At risk"; }
export const OSTAT: Record<string, [string, string]> = {ahead:["Ahead", "ok"], ontrack:["On track", "ok"], risk:["At risk", "warn"], behind:["Behind", "bad"], stalled:["Stalled", "bad"], done:["Done", "ok"], upcoming:["Upcoming", ""]};
