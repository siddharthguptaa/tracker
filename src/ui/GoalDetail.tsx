import { useState } from "react";
import { useAppState } from "../storage/store";
import { getState } from "../domain/ctx";
import { fmt, fmtDate } from "../domain/format";
import { todayStr } from "../domain/clock";
import { current, pct, pctText, expected, paceInfo, timeLeft, habitStats, isFocus, forecast, sortedLogs } from "../domain/goals";
import { goalOutlook } from "../domain/outlook";
import { undoTo, toggleHabitDay, deleteGoal } from "../domain/actions";
import { toggleTodo } from "../domain/actions";
import * as G from "../domain/goalOps";
import { Header } from "./Header";
import { setUi, openSheet, toast, useUi } from "./uiStore";
import { numsParts, slug, YearBar, HabitStrip, SaveLine, openGoal } from "./GoalBits";
import { play } from "./fx";
import { ask } from "./ask";
import { mondayOf, addDays } from "../domain/clock";
import type { Goal } from "../domain/types";

const undoToast = (msg: string, snap: string | null) => toast(msg, snap ? { label: "Undo", fn: () => G.restoreSnap(snap) } : undefined);
const Acc = ({ id, title, sub, children, open = true }: any) => <details className="panel acc" data-acc={id} open={open}><summary>{title}{sub != null ? <span className="accs">{sub}</span> : null}</summary>{children}</details>;
const Hint = ({ v, unit }: { v: string; unit: string }) => { const n = Number(v); return unit === "₹" && v !== "" && Number.isFinite(n) && Math.abs(n) >= 1000 ? <div className="hint">{fmt(n, "₹")}</div> : <div className="hint" />; };

function LogPanel({ g }: { g: Goal }) {
  const lvl = g.type === "level", [a, setA] = useState(""), [d, setD] = useState(todayStr()), [n, setN] = useState("");
  const add = async () => { if (!await G.depGuard(g, (m) => ask(m, "Update anyway", false))) return; const e = G.addGoalLog(g, a === "" ? NaN : Number(a), d, n.trim()); if (e) return toast(e); setA(""); setN(""); play("ok"); toast(lvl ? "Value updated" : "Entry added"); };
  return <Acc id="log" title={lvl ? "Update current value" : "Log progress"}>
    <div className="g2"><div><label htmlFor="la">{lvl ? "New value" : "Amount"}</label><input id="la" type="number" inputMode="decimal" step="any" placeholder={lvl ? "e.g. 150000" : "e.g. 25000"} value={a} onChange={(e) => setA(e.target.value)} /><Hint v={a} unit={g.unit} /></div>
      <div><label htmlFor="ld">Date</label><input id="ld" type="date" value={d} onChange={(e) => setD(e.target.value)} /></div></div>
    <label htmlFor="ln">Note (optional)</label><input id="ln" type="text" placeholder="e.g. Salary SIP" value={n} onChange={(e) => setN(e.target.value)} />
    <button className="btn" onClick={add}>{lvl ? "Update value" : "Add entry"}</button>
    {lvl ? null : <p className="note">Use a negative amount for withdrawals or reductions.</p>}
  </Acc>;
}
function History({ g }: { g: Goal }) {
  const ui = useUi(), lvl = g.type === "level", logs = sortedLogs(g).slice().reverse(), [a, setA] = useState(""), [d, setD] = useState(""), [n, setN] = useState("");
  return <div className="panel"><b>History</b>
    {logs.length ? logs.map((l: any) => ui.editLog === l.id ? (
      <div key={l.id} className="log" style={{ display: "block" }}>
        <div className="g2"><div><label htmlFor="ea">{lvl ? "Value" : "Amount"}</label><input id="ea" type="number" inputMode="decimal" step="any" value={a} onChange={(e) => setA(e.target.value)} /><Hint v={a} unit={g.unit} /></div><div><label htmlFor="ed">Date</label><input id="ed" type="date" value={d} onChange={(e) => setD(e.target.value)} /></div></div>
        <label htmlFor="en">Note</label><input id="en" type="text" value={n} onChange={(e) => setN(e.target.value)} />
        <div className="btns"><button className="btn alt" onClick={() => setUi({ editLog: null })}>Cancel</button><button className="btn" onClick={() => { const e = G.saveLog(g, l.id, a === "" ? NaN : Number(a), d, n); if (e) return toast(e); setUi({ editLog: null }); toast("Entry updated"); }}>Save changes</button></div></div>
    ) : (
      <div key={l.id} className="log"><div><b>{lvl ? "" : l.amount > 0 ? "+" : ""}{fmt(l.amount, g.unit)}</b><br /><small>{fmtDate(l.date)}{l.note ? " · " + l.note : ""}</small></div>
        <span><button className="x" aria-label="Edit entry" onClick={() => { setA(String(l.amount)); setD(l.date); setN(l.note || ""); setUi({ editLog: l.id }); }}>✎</button>
          <button className="x" aria-label="Delete entry" onClick={() => { undoToast("Entry deleted", G.deleteLog(g, l.id)); }}>✕</button></span></div>
    )) : <p className="note">Nothing logged yet. Starting value: {fmt(g.baseline, g.unit)}.</p>}
  </div>;
}
function Recur({ g }: { g: Goal }) {
  const r = g.recurring, [a, setA] = useState(""), [dy, setDy] = useState(5), [f, setF] = useState(todayStr());
  if (r && r.active) return <Acc id="recur" title="↻ Recurring entry" sub={`On · ${fmt(r.amount, g.unit)}/month`} open={false}><p className="note" style={{ marginTop: 2 }}>{fmt(r.amount, g.unit)} on day {r.day} of every month, from {fmtDate(r.from || "")}. Added automatically whenever you open the app.</p><button className="btn alt" onClick={() => { G.recurStop(g); toast("Recurring entry stopped"); }}>Stop recurring entry</button></Acc>;
  return <Acc id="recur" title="↻ Recurring entry" sub="Off" open={false}><p className="note" style={{ marginTop: 2 }}>Add the same amount every month automatically, like a SIP.</p>
    <div className="g2"><div><label htmlFor="rc_a">Amount</label><input id="rc_a" type="number" inputMode="decimal" step="any" placeholder="e.g. 10000" value={a} onChange={(e) => setA(e.target.value)} /><Hint v={a} unit={g.unit} /></div>
      <div><label htmlFor="rc_d">Day of month</label><select id="rc_d" value={dy} onChange={(e) => setDy(+e.target.value)}>{Array.from({ length: 28 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select></div></div>
    <label htmlFor="rc_f">Start from</label><input id="rc_f" type="date" value={f} onChange={(e) => setF(e.target.value)} /><p className="note">Earlier start dates fill in the past months too.</p>
    <button className="btn" onClick={() => { const e = G.recurStart(g, a === "" ? NaN : Number(a), dy, f); if (e && !e.startsWith("n:")) return toast(e); const k = +e!.slice(2); toast(k ? `Recurring entry started · ${k} past entr${k > 1 ? "ies" : "y"} added` : "Recurring entry started"); }}>Start recurring entry</button></Acc>;
}
function MsPanel({ g }: { g: Goal }) {
  const ui = useUi(), ms = (g.milestones || []).slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)), t = todayStr(), [nt, setNt] = useState(""), [nd, setNd] = useState(g.end), [et, setEt] = useState(""), [ed, setEd] = useState("");
  return <Acc id="log" title="Milestones" sub={`${ms.filter((m) => m.done).length} of ${ms.length} done`}>
    <p className="note" style={{ marginTop: 2 }}>Break this goal into steps and give each one a date. Tick a step when you reach it.</p>
    {ms.length ? ms.map((m) => ui.editMs === m.id ? (
      <div key={m.id} className="log" style={{ display: "block" }}><label htmlFor="ms_et">Milestone</label><input id="ms_et" type="text" value={et} onChange={(e) => setEt(e.target.value)} /><label htmlFor="ms_ed">Due by</label><input id="ms_ed" type="date" value={ed} onChange={(e) => setEd(e.target.value)} />
        <div className="btns"><button className="btn alt" onClick={() => setUi({ editMs: null })}>Cancel</button><button className="btn" onClick={() => { const e = G.saveMilestone(g, m.id, et, ed); if (e) return toast(e); setUi({ editMs: null }); toast("Milestone updated"); }}>Save changes</button></div></div>
    ) : (
      <div key={m.id} className="log"><div style={{ display: "flex", gap: 11, alignItems: "center", minWidth: 0 }}><button className={"chk" + (m.done ? " on" : "")} aria-label="Mark done" aria-pressed={m.done} onClick={async () => { if (!m.done && !await G.depGuard(g, (m) => ask(m, "Update anyway", false))) return; if (G.toggleMilestone(g, m.id)) play("ok"); }}>✓</button>
        <div style={{ minWidth: 0 }}><b style={m.done ? { textDecoration: "line-through", color: "var(--mute)" } : undefined}>{m.title}</b><br /><small>{m.done ? "Done " + fmtDate(m.doneDate || m.date) : <>{m.date < t ? <span className="red">Overdue</span> : null}{m.date < t ? " · was due " : "Due by "}{fmtDate(m.date)}</>}</small></div></div>
        <span style={{ whiteSpace: "nowrap" }}><button className="x" aria-label="Edit milestone" onClick={() => { setEt(m.title); setEd(m.date); setUi({ editMs: m.id }); }}>✎</button><button className="x" aria-label="Delete milestone" onClick={() => undoToast("Milestone deleted", G.deleteMilestone(g, m.id))}>✕</button></span></div>
    )) : <p className="note">No milestones yet.</p>}
    <div className="g2"><div><label htmlFor="ms_t">New milestone</label><input id="ms_t" type="text" placeholder="e.g. Visible upper abs" value={nt} onChange={(e) => setNt(e.target.value)} /></div><div><label htmlFor="ms_d">Due by</label><input id="ms_d" type="date" value={nd} onChange={(e) => setNd(e.target.value)} /></div></div>
    <button className="btn" onClick={() => { const e = G.addMilestone(g, nt, nd); if (e) return toast(e); setNt(""); toast("Milestone added"); }}>Add milestone</button>
    {ms.length ? null : <button className="btn alt" onClick={() => G.evenMilestones(g)}>Add 4 evenly spaced checkpoints</button>}
  </Acc>;
}
function HabitPanel({ g }: { g: Goal }) {
  const ui = useUi(), st = habitStats(g), today = todayStr(), hw = ui.hw, mon = addDays(mondayOf(today), 7 * hw), L = ["M", "T", "W", "T", "F", "S", "S"], wc = (g.checks || []).filter((c) => c >= mon && c <= addDays(mon, 6)).length, wk = new Date(mon + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return <Acc id="log" title="Check-ins" sub={`${st.thisCount} of ${st.per} this week`}>
    <div className="row" style={{ marginTop: 8 }}><button className="x" aria-label="Previous week" onClick={() => setUi({ hw: hw - 1 })}>‹</button><span style={{ fontWeight: 600 }}>{hw ? "Week of " + wk : "This week"} · {wc} of {st.per}</span><button className="x" aria-label="Next week" disabled={!hw} style={hw ? undefined : { opacity: 0.3 }} onClick={() => setUi({ hw: Math.min(0, hw + 1) })}>›</button></div>
    <div className="hdays">{L.map((l, i) => { const iso = addDays(mon, i), on = (g.checks || []).includes(iso), fut = mon > mondayOf(today); return <button key={iso} className={"hd" + (on ? " on" : "")} disabled={fut} aria-label={fmtDate(iso)} aria-pressed={on} onClick={async () => { if (!on && !await G.depGuard(g, (m) => ask(m, "Update anyway", false))) return; toggleHabitDay(g, iso); play("tick"); }}>{l}<small>{+iso.slice(8)}</small></button>; })}</div>
    <p className="note" style={{ marginTop: 0 }}>Tap any day of the week to mark it done or undo it, weekends included. Use ‹ to fill in earlier weeks.</p>
    <div className="kv" style={{ gridTemplateColumns: "repeat(3,1fr)" }}><div><small>Streak</small><b>{st.streak} week{st.streak === 1 ? "" : "s"}</b></div><div><small>Consistency</small><b>{Math.round(st.consistency * 100)}%</b></div><div><small>Total check-ins</small><b>{st.total}</b></div></div>
    <div style={{ marginTop: 12 }}><HabitStrip g={g} /></div>
    <p className="note">Green = hit {st.per}× that week · amber = some days · grey = none. A week counts as a hit when you reach {st.per} check-ins.</p>
  </Acc>;
}
function GoalTodos({ g }: { g: Goal }) {
  const open = getState().todos.filter((t) => t.goalId === g.id && !t.done), [tx, setTx] = useState(""), [due, setDue] = useState("");
  return <Acc id="todo" title="☑ To-dos" sub={`${open.length} open`}>
    {open.length ? open.map((t) => <div key={t.id} className="vrow"><label style={{ display: "flex", gap: 8, alignItems: "center", margin: 0, minWidth: 0 }}><input type="checkbox" checked={false} onChange={() => toggleTodo(t)} aria-label={"Done: " + t.text} /><span>{t.text}</span></label><small>{t.due ? fmtDate(t.due) : ""}</small></div>) : <p className="note">No open to-dos for this goal.</p>}
    <div className="g2" style={{ marginTop: 8 }}><div><label htmlFor="gt_text">New to-do</label><input id="gt_text" type="text" placeholder="e.g. Compare SIP plans" value={tx} onChange={(e) => setTx(e.target.value)} /></div><div><label htmlFor="gt_due">Due (optional)</label><input id="gt_due" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div></div>
    <button className="btn" onClick={() => { const e = G.addGoalTodo(g, tx, due); if (e) return toast(e); setTx(""); setDue(""); toast("To-do added"); }}>Add to-do</button></Acc>;
}

export function GoalDetail({ id }: { id: string }) {
  useAppState(); const g = getState().goals.find((x) => x.id === id);
  if (!g) return null;
  const lvl = g.type === "level", ms = g.type === "milestones", hab = g.type === "habit", p = paceInfo(g), dr = g.status === "Draft", np = G.nextPlan(g.plan), succ = G.successorOf(g), prev = g.prevId ? G.goalById(g.prevId) : null, o = goalOutlook(g);
  const b = G.blockers(g), f = forecast(g), si = G.saveInfo(g), n = numsParts(g), st = hab ? habitStats(g) : null, back = () => setUi({ page: null, editLog: null, editMs: null });
  const plan = (pid: string) => G.planLabel(G.planById(pid) || getState().plans[0]), ys = G.yearRange();
  return (
    <>
      <div className="backbar"><button onClick={back}>‹ Goals</button></div>
      <Header nog />
      <div className="row"><span className="cat">{isFocus(g) ? <span className="st">★ </span> : null}{g.category} · {plan(g.plan)}{g.archived ? " · archived" : ""}</span><span className={"pill st-" + slug(g.status)}>{g.status}</span></div>
      <h1 style={{ marginTop: 4 }}>{g.name}</h1>
      <div className="nums"><b style={{ fontSize: 26 }}>{n.c}</b><span>{n.t}</span><span className="pct">{pctText(g)}</span></div>
      <div className={"bar " + (g.status === "Completed" ? "done" : "")} style={{ height: 12 }}><i style={{ width: (pct(g) * 100).toFixed(2) + "%" }} />{g.status === "Completed" || dr || hab ? null : <u style={{ left: `calc(${(expected(g) * 100).toFixed(2)}% - 1px)` }} />}</div>
      {dr || hab ? null : <YearBar g={g} />}
      <div className="kv"><div><small>Remaining</small><b>{hab ? Math.max(0, st!.per - st!.thisCount) + " this week" : ms ? Math.max(0, (g.milestones || []).length - current(g)) + " milestones" : fmt(Math.max(0, g.total - current(g)), g.unit)}</b></div><div><small>Deadline</small><b>{fmtDate(g.end)}</b></div><div><small>Pace</small><b className={p.c}>{dr ? "Draft" : p.t}</b></div></div>
      {prev ? <p className="note">↩ Continues from <b>{prev.name}</b> ({plan(prev.plan)})</p> : null}
      {succ ? <p className="note">↪ Continued in <b>{plan(succ.plan)}</b> as {succ.status === "Draft" ? "a draft" : "an active goal"}</p> : null}
      {b.length && !dr ? <div className="panel" style={{ borderLeft: "4px solid var(--amber)" }}><b>⛔ Waiting on</b><p className="note" style={{ margin: "3px 0 0" }}>{b.map((x) => x.name).join(", ")} should be completed first. You'll get a warning if you update this goal early.</p></div> : null}
      {si ? <div className="panel"><b>Money set aside</b><SaveLine i={si} /></div> : null}
      {f ? <div className="panel"><b>Forecast</b><p className={f.c} style={{ margin: "4px 0 0" }}>{f.t}</p></div> : null}
      {dr ? <div className="panel"><b>Draft goal</b><p className="note" style={{ marginTop: 2 }}>This goal is a plan for later. It doesn't count toward focus, progress, money checks or reminders until you promote it. Starts {fmtDate(g.start)}.</p><button className="btn" onClick={() => { G.promote(g); toast("Goal is now active"); }}>Promote to active goal</button></div> : <>
        <Acc id="focus" title="🎯 Focus years" sub={ys.filter((y) => isFocus(g, y)).join(", ") || "none"}><p className="note" style={{ marginTop: 2 }}>Tap a year to put this goal in or out of that year's focus.</p>
          <div className="chips wrap">{ys.map((y) => <button key={y} className={"chip" + (isFocus(g, y) ? " on" : "")} aria-pressed={isFocus(g, y)} onClick={() => G.toggleFocus(g, y)}>{y}</button>)}</div></Acc>
        {ms ? <MsPanel g={g} /> : hab ? <HabitPanel g={g} /> : <><LogPanel g={g} />{g.type === "total" ? <Recur g={g} /> : null}<History g={g} /></>}
        <GoalTodos g={g} />
      </>}
      {np && !dr && !succ ? <button className="btn alt" style={{ width: "100%" }} onClick={() => { const N = np, x = G.makeSuccessor(g, N); setUi({ sheet: "goaledit", sheetArg: { prefill: x } }); }}>➜ Create next-plan goal ({G.planLabel(np)})</button> : null}
      <button className="btn alt" style={{ width: "100%" }} onClick={() => { if (g.archived) { G.setArchived(g, false); toast("Brought back"); } else { G.setArchived(g, true); back(); toast("Archived", { label: "Undo", fn: () => G.setArchived(g, false) }); } }}>{g.archived ? "Bring back from archive" : "🗄 Archive this goal"}</button>
      <div className="btns"><button className="btn alt" onClick={back}>Back</button><button className="btn" onClick={() => setUi({ sheet: "goaledit", sheetArg: { id: g.id } })}>Edit goal</button></div>
    </>
  );
}
export { openGoal, undoTo, deleteGoal };
