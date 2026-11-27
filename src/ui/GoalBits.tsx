import { useState } from "react";
import { getState } from "../domain/ctx";
import { fmt, fmtDate } from "../domain/format";
import { todayStr, ts, clamp } from "../domain/clock";
import { current, pct, pctText, expected, paceInfo, timeLeft, habitStats, isFocus, fy, forecast, yearTarget, yearAchieved, focusGoals, isLive, focusDue, forgotten } from "../domain/goals";
import * as G from "../domain/goalOps";
import { setUi, openSheet } from "./uiStore";
import { play } from "./fx";
import { ask } from "./ask";
import { commit } from "../storage/store";
import { toggleHabitDay } from "../domain/actions";
import type { Goal } from "../domain/types";

export const slug = G.slug;
export const agoText = (d: number) => (d < 60 ? d + " days" : Math.round(d / 30.4) + " months");
export const runningNow = (y: number) => focusGoals(y).filter((g) => isLive(g));
export const openGoal = (id: string) => setUi({ tab: "goals", page: { kind: "detail", id }, editLog: null, editMs: null, hw: 0 });

export function numsParts(g: Goal) {
  if (g.type === "habit") { const st = habitStats(g); return { c: `${st.thisCount}/${st.per}`, t: "this week · consistency" }; }
  if (g.type === "milestones") return { c: String(current(g)), t: `of ${(g.milestones || []).length} milestones` };
  return { c: fmt(current(g), g.unit), t: `of ${fmt(g.total, g.unit)}` };
}
export const planSegUi = (cur: string, set: (id: string) => void) => {
  const ps = getState().plans; if (ps.length < 2) return null;
  return <div className="seg" role="tablist" aria-label="Plan">{ps.map((p) => <button key={p.id} className={cur === p.id ? "on" : ""} onClick={() => set(p.id)}>{G.planLabel(p)}<small>{p.start.slice(0, 4)}–{p.end.slice(2, 4)}</small></button>)}</div>;
};
export function curPlan(planId: string | null) { let p = G.planById(planId || ""); if (!p) p = G.planOfYear(fy()); return p; }

/** Focus card shown on Home and Settings (classic: "🎯 Focus 2026 · 7 goals · 6 running now" + review-due line). */
export function FocusBanner() {
  const s = getState(), y = fy(), fg = focusGoals(y), due = focusDue(y);
  if (!s.goals.length) return null;
  if (!fg.length) return <div className="banner late" role="button" tabIndex={0} onClick={() => setUi({ tab: "goals", gsub: "years", year: y, page: null })}>🎯 <b>No focus chosen for {y}</b><div className="bs">Tap to pick the goals you are working on this year.</div></div>;
  return <div className={"banner" + (due.late ? " late" : "")} role="button" tabIndex={0} onClick={() => setUi({ tab: "goals", gsub: "years", year: y, page: null })}>
    <div>🎯 <b>Focus {y}</b> · {fg.length} goal{fg.length > 1 ? "s" : ""} · {runningNow(y).length} running now</div>
    <div className="bn">{fg.map((g) => g.name).join(" · ")}</div>
    <div className="bs">{due.late ? `Focus last changed ${agoText(due.ageDays)} ago — review it and change it to clear this banner.` : `Review your focus by ${new Date(due.due).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}</div></div>;
}
export function Banners() {
  const s = getState(), y = fy(), fg = focusGoals(y), due = focusDue(y);
  return <>
    {!s.goals.length ? null : !fg.length ? <div className="banner late" role="button" tabIndex={0} onClick={() => setUi({ tab: "goals", gsub: "years", year: y, page: null })}>🎯 <b>No focus chosen for {y}</b><div className="bs">Tap to pick the goals you are working on this year.</div></div>
      : <div className={"banner" + (due.late ? " late" : "")} role="button" tabIndex={0} onClick={() => setUi({ tab: "goals", gsub: "years", year: y, page: null })}>
        <div>🎯 <b>Focus {y}</b> · {fg.length} goal{fg.length > 1 ? "s" : ""} · {runningNow(y).length} running now</div>
        <div className="bn">{fg.map((g) => g.name).join(" · ")}</div>
        <div className="bs">{due.late ? `Focus last changed ${agoText(due.ageDays)} ago — review it and change it to clear this banner.` : `Review your focus by ${new Date(due.due).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}</div></div>}
    {s.plans.map((p) => { const np = G.nextPlan(p.id); if (!np) return null; const toEnd = (ts(p.end) - Date.now()) / 86400000, n = G.undecided(p);
      return toEnd <= 548 && n > 0 ? <div key={p.id} className="banner bridge" role="button" tabIndex={0} onClick={() => openSheet("handover", p.id)}>🧭 <b>Handover {G.planLabel(p)} → {G.planLabel(np)}</b> · {n} goal{n > 1 ? "s" : ""} need a decision<div className="bs">Choose finish, carry over, or drop for each goal. This stays until every goal has a decision.</div></div> : null; })}
    {forgotten().map(({ g, days }) => <div key={g.id} className="alert" role="button" tabIndex={0} onClick={() => openGoal(g.id)}>⚠️ <b>{g.name}</b> — no update for {agoText(days)}{g.logs.length ? "" : " since its start date"}. Log progress to clear this.</div>)}
  </>;
}

export function HabitStrip({ g }: { g: Goal }) {
  const st = habitStats(g);
  return <div className="hstrip">{st.strip.map((w, i) => <i key={i} className={w.before ? "" : w.n >= st.per ? "h" : w.n > 0 ? "p" : ""} title={`Week of ${fmtDate(w.mon)}: ${w.n} of ${st.per}`} />)}<small style={{ marginLeft: 6, color: "var(--text-secondary)", fontSize: "11.5px" }}>{st.streak ? "🔥 " + st.streak + "-week streak · " : ""}{st.per}× / week</small></div>;
}
export function YearBar({ g }: { g: Goal }) {
  const y = fy(), t = yearTarget(g, y) as number;
  if (!(t > 0)) return <div className="ylabel"><span>{y} target</span><span>not set</span></div>;
  const a = yearAchieved(g, y), r = clamp((a || 0) / t);
  return <><div className="ylabel"><span>{y} target</span><span><b>{a == null ? "—" : fmt(a, g.unit)}</b> / {fmt(t, g.unit)}</span></div><div className={"bar thin" + (r >= 1 ? " done" : "")}><i style={{ width: (r * 100).toFixed(1) + "%" }} /></div></>;
}
export function GoalExtras({ g }: { g: Goal }) {
  const out: any[] = [], today = todayStr();
  if (g.type === "milestones") { const ms = g.milestones || []; if (!ms.length) out.push(<div key="m" className="next">No milestones yet — open this goal to add some</div>); else { const nx = ms.filter((m) => !m.done).sort((a, b) => (a.date < b.date ? -1 : 1))[0]; out.push(nx ? <div key="m" className={"next" + (nx.date < today ? " red" : "")}>Next: {nx.title} · {nx.date < today ? "overdue, was due " : "by "}{fmtDate(nx.date)}</div> : <div key="m" className="next ok">All milestones done</div>); } }
  if (g.type === "habit") { const doneToday = (g.checks || []).includes(today), open = !["Draft", "Completed", "On Hold"].includes(g.status) && g.start <= today;
    out.push(<div key="h" onClick={(e) => e.stopPropagation()}><HabitStrip g={g} />{open ? <button className={"btn small" + (doneToday ? " alt" : "")} style={{ marginTop: 10 }} data-act="hcheck" onClick={async () => { if (!await G.depGuard(g, (m) => ask(m, "Update anyway", false))) return; toggleHabitDay(g, today); play("tick"); }}>{doneToday ? "✓ Done today — tap to undo" : "Check in today"}</button> : null}</div>); }
  if (g.status !== "Draft" && g.type !== "habit") out.push(<YearBar key="y" g={g} />);
  return <>{out}</>;
}
export function GoalFooter({ g }: { g: Goal }) {
  const b = G.blockers(g), f = forecast(g), si = G.saveInfo(g), open = getState().todos.filter((t) => t.goalId === g.id && !t.done), od = open.filter((t) => t.due && t.due < todayStr()).length;
  return <>
    {b.length && !["Completed", "Draft", "On Hold"].includes(g.status) ? <div className="next bad">⛔ Waiting on {b.map((x) => x.name).join(", ")}</div> : null}
    {f ? <div className={"next " + f.c}>{f.t}</div> : null}
    {g.recurring && g.recurring.active ? <div className="next">↻ {fmt(g.recurring.amount, g.unit)} added monthly (day {g.recurring.day})</div> : null}
    {open.length ? <div className="next">☑ {open.length} to-do{open.length > 1 ? "s" : ""} open{od ? <> · <span className="red">{od} overdue</span></> : null}</div> : null}
    {si ? <SaveLine i={si} /> : null}
  </>;
}
export function SaveLine({ i }: { i: NonNullable<ReturnType<typeof G.saveInfo>> }) {
  return <div style={{ marginTop: 8, fontSize: "12.5px" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span>💰 {i.name}</span><b>{fmt(i.saved, "₹")} / {fmt(i.tgt, "₹")}</b></div><div style={{ height: 7, borderRadius: 4, background: "var(--line)", marginTop: 4, overflow: "hidden" }}><i style={{ display: "block", height: "100%", width: i.p + "%", background: "var(--accent)" }} /></div></div>;
}

export function GoalCard({ g }: { g: Goal }) {
  const p = paceInfo(g), done = g.status === "Completed", f = isFocus(g), dr = g.status === "Draft", n = numsParts(g);
  return (
    <div className={`card ${f ? "fcard" : ""} ${dr ? "dcard" : ""} ${g.archived ? "arch" : ""}`} role="button" tabIndex={0} data-goal={g.id} onClick={() => openGoal(g.id)} onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) openGoal(g.id); }}>
      <div className="row"><span className="cat">{f ? <span className="st">★ </span> : null}{g.category}</span><span className={"pill st-" + slug(g.status)}>{g.status}</span></div>
      <h3 style={{ marginTop: 4 }}>{g.name}</h3>
      <div className="nums"><b>{n.c}</b><span>{n.t}</span><span className="pct">{pctText(g)}</span></div>
      <div className={"bar " + (done ? "done" : "")}><i style={{ width: (pct(g) * 100).toFixed(2) + "%" }} />{done || g.type === "habit" ? null : <u style={{ left: `calc(${(expected(g) * 100).toFixed(2)}% - 1px)` }} title="Where you should be today" />}</div>
      <GoalExtras g={g} />
      <div className="dates"><b>{fmtDate(g.start)}</b><span>→</span><b>{fmtDate(g.end)}</b></div>
      <div className="meta"><span className={p.c}>{p.t}</span><span>{timeLeft(g)}</span></div>
      <GoalFooter g={g} />
    </div>
  );
}

/* ---------- charts ---------- */
export function LineChart({ labels, series, max, fmtY, aria }: { labels: string[]; series: { vals: (number | null)[]; cls: string }[]; max: number; fmtY: (v: number) => string; aria: string }) {
  const W = 640, H = 220, L = 52, R = 14, T = 14, B = 28, n = labels.length, mx = max || 1;
  const x = (i: number) => (n > 1 ? L + (i * (W - L - R)) / (n - 1) : (L + W - R) / 2), y = (v: number) => T + (1 - clamp(v / mx)) * (H - T - B), step = Math.ceil(n / 7);
  return <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label={aria}>
    {[0, 1, 2, 3, 4].map((k) => { const v = (mx * k) / 4, yy = y(v); return <g key={k}><line x1={L} x2={W - R} y1={yy} y2={yy} style={{ stroke: "var(--line)", strokeWidth: 1 }} /><text x={L - 6} y={yy + 4} textAnchor="end" style={{ fill: "var(--mute)", fontSize: 11 }}>{fmtY(v)}</text></g>; })}
    {labels.map((lb, i) => (i % step === 0 || i === n - 1 ? <text key={i} x={x(i)} y={H - 8} textAnchor="middle" style={{ fill: "var(--mute)", fontSize: 11 }}>{lb}</text> : null))}
    {series.map((se, si) => { let d = "", pen = false; se.vals.forEach((v, i) => { if (v == null) { pen = false; return; } d += (pen ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1) + " "; pen = true; });
      const st = se.cls === "main" ? { stroke: "var(--accent)", strokeWidth: 2.5 } : se.cls === "tgt" ? { stroke: "var(--green)", strokeWidth: 1.5, strokeDasharray: "5 4" } : { stroke: "var(--mute)", strokeWidth: 1.5, strokeDasharray: "2 4" };
      return <g key={si}><path d={d} fill="none" style={st} />{se.cls === "main" ? se.vals.map((v, i) => (v != null ? <circle key={i} cx={x(i).toFixed(1)} cy={y(v).toFixed(1)} r={3.5} style={{ fill: "var(--accent)" }} /> : null)) : null}</g>; })}
  </svg>;
}
export function Spark({ vals }: { vals: (number | null)[] }) {
  const W = 84, H = 26; let d = "", pen = false;
  vals.forEach((v, i) => { if (v == null) { pen = false; return; } const px = (vals.length > 1 ? (i * (W - 4)) / (vals.length - 1) : W / 2) + 2, py = H - 3 - clamp(v) * (H - 6); d += (pen ? "L" : "M") + px.toFixed(1) + " " + py.toFixed(1) + " "; pen = true; });
  return <svg viewBox={`0 0 ${W} ${H}`} style={{ width: 84, height: 26, flex: "none" }} aria-hidden="true"><path d={d} fill="none" style={{ stroke: "var(--accent)", strokeWidth: 2 }} /></svg>;
}
export { commit };
