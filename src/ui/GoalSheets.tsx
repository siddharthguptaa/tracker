import { useState } from "react";
import { ask } from "./ask";
import { getState } from "../domain/ctx";
import { fmt, fmtDate } from "../domain/format";
import { clamp, year, curYear, todayStr } from "../domain/clock";
import { current, habitStats, isFocus, focusGoals, yearTarget, yearAchieved } from "../domain/goals";
import { deleteGoal, undoTo } from "../domain/actions";
import * as G from "../domain/goalOps";
import { commit } from "../storage/store";
import { Sheet } from "./Sheet";
import { setUi, toast, useUi, openSheet } from "./uiStore";
import { play } from "./fx";
import type { Goal, GoalType } from "../domain/types";

const close = () => setUi({ sheet: null, sheetArg: null, importItems: [], prefill: null });

export function GoalEditSheet({ arg }: { arg: { id?: string; prefill?: Goal } | null }) {
  const s = getState(), id = arg && arg.id, g0 = id ? G.goalById(id) : null, pre = arg && arg.prefill, ui = useUi();
  const cats = G.allCats(), init: G.GoalForm = g0 ? G.formOfGoal(g0) : pre ? { ...G.formOfGoal(pre), total: pre.total, deps: [] } : (() => { const f = G.blankGoalForm((G.planById(ui.plan || "") || G.planOfYear(year(todayStr()))).id); if (ui.cat !== "All" && cats.includes(ui.cat)) { f.category = ui.cat; if (/health/i.test(ui.cat)) f.type = "milestones"; } return f; })();
  const [f, setF] = useState<G.GoalForm>({ ...init, category: cats.includes(init.category) || !cats.length ? init.category : cats.length ? "__new" : init.category, newCategory: !cats.includes(init.category) && init.category ? init.category : "" });
  const set = (p: Partial<G.GoalForm>) => setF((x) => ({ ...x, ...p }));
  const simple = f.type === "milestones" || f.type === "habit", isNew = !g0, title = isNew ? (pre ? "Next-plan goal" : "New goal") : "Edit goal";
  const others = s.goals.filter((x) => x.id !== (g0 && g0.id) && !x.archived), si = g0 ? G.saveInfo(g0) : null;
  const save = () => {
    const e = G.validateGoalForm(f); if (e) return toast(e);
    const { g, skipped } = G.saveGoal(f, g0 ? g0.id : null, pre ? pre.prevId || null : null);
    play("ok"); if (isNew) { setUi({ sheet: null, sheetArg: null, page: { kind: "detail", id: g.id }, tab: "goals" }); } else close();
    toast(skipped ? "Saved — a circular dependency was skipped" : isNew ? "Goal added" : "Goal saved");
  };
  return <Sheet label={title}>
    <h1>{title}</h1>{pre ? <p className="note">Pre-filled from your earlier goal. Set the new total you want to reach.</p> : null}
    <label htmlFor="f_name">Goal name</label><input id="f_name" value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Emergency Fund" />
    <div className="g2">
      <div><label htmlFor="f_cat">Category</label><select id="f_cat" value={f.category} onChange={(e) => { const v = e.target.value; set({ category: v, ...(isNew && /health/i.test(v) ? { type: "milestones" as GoalType } : {}) }); }}>{cats.map((c) => <option key={c} value={c}>{c}</option>)}<option value="__new">＋ New category…</option></select></div>
      {simple ? null : <div><label htmlFor="f_unit">Unit</label><input id="f_unit" value={f.unit} onChange={(e) => set({ unit: e.target.value })} placeholder="₹, gm, kg…" /></div>}
    </div>
    {f.category === "__new" ? <div><label htmlFor="f_newcat">New category name</label><input id="f_newcat" value={f.newCategory || ""} onChange={(e) => set({ newCategory: e.target.value })} placeholder="e.g. Health" /></div> : null}
    {simple ? null : <div className="g2"><div><label htmlFor="f_total">Goal total</label><input id="f_total" type="number" inputMode="decimal" step="any" value={Number.isNaN(f.total) ? "" : f.total} onChange={(e) => set({ total: e.target.value === "" ? NaN : Number(e.target.value) })} /></div>
      <div><label htmlFor="f_base">Starting number</label><input id="f_base" type="number" inputMode="decimal" step="any" value={f.baseline} onChange={(e) => set({ baseline: e.target.value === "" ? 0 : Number(e.target.value) })} /></div></div>}
    <label htmlFor="f_type">How it's measured</label>
    <select id="f_type" value={f.type} onChange={(e) => set({ type: e.target.value as GoalType })}><option value="total">Running total — I add amounts as I go</option><option value="level">Level — I update the current value (e.g. monthly income)</option><option value="milestones">Milestones — steps with dates (e.g. 6-pack abs)</option><option value="habit">Habit — repeat every week (e.g. gym 4× a week)</option></select>
    {f.type === "habit" ? <div><label htmlFor="f_perweek">How many times per week?</label><select id="f_perweek" value={f.perWeek} onChange={(e) => set({ perWeek: +e.target.value })}>{[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n} time{n > 1 ? "s" : ""} a week</option>)}</select><p className="note">Progress is how consistently you hit this each week, not a number to reach. You check in on the days you do it.</p></div> : null}
    {f.type === "milestones" ? <p className="note">No number to hit here. You break the goal into steps, give each a date, and tick them off. Add the milestones after saving.</p> : null}
    <div className="g2"><div><label htmlFor="f_start">Start date</label><input id="f_start" type="date" value={f.start} onChange={(e) => set({ start: e.target.value })} /></div><div><label htmlFor="f_end">End date</label><input id="f_end" type="date" value={f.end} onChange={(e) => set({ end: e.target.value })} /></div></div>
    <label htmlFor="f_plan">Plan</label><select id="f_plan" value={f.plan} onChange={(e) => set({ plan: e.target.value })}>{s.plans.map((p) => <option key={p.id} value={p.id}>{G.planLabel(p)} · {year(p.start)}–{year(p.end)}</option>)}</select>
    <label htmlFor="f_status">Status</label><select id="f_status" value={f.status} onChange={(e) => set({ status: e.target.value })}>{G.STATUSES.map((x) => <option key={x}>{x}</option>)}</select>
    <label htmlFor="f_money">Counts toward money check</label><select id="f_money" value={f.usesMoney ? "1" : "0"} onChange={(e) => set({ usesMoney: e.target.value === "1" })}><option value="1">Yes — this goal needs money from my savings</option><option value="0">No</option></select>
    {others.length ? <><label>Waits for (optional)</label><div className="deplist">{others.map((o) => <label key={o.id} className="chkrow"><input type="checkbox" checked={(f.deps || []).includes(o.id)} onChange={(e) => set({ deps: e.target.checked ? [...(f.deps || []), o.id] : (f.deps || []).filter((d) => d !== o.id) })} /> {o.name}</label>)}</div><p className="note">Pick goals that should be finished first. You'll get a warning if you update this goal before they're done.</p></> : null}
    {g0 ? <><label>Money set aside</label><p className="note" style={{ marginTop: 2 }}>{si ? `${fmt(si.saved, "₹")} of ${fmt(si.tgt, "₹")} set aside.` : "Nothing set aside yet."} To track money for this goal, open Money → Plan → Savings and choose it there.</p></> : null}
    <button className="btn" onClick={save}>Save</button>
    <div className="btns"><button className="btn alt" onClick={close}>Cancel</button>{g0 ? <button className="btn danger" onClick={async () => { if (!await ask(`Delete “${g0.name}”? You can undo right after.`)) return; const b = deleteGoal(g0); setUi({ sheet: null, sheetArg: null, page: null }); toast("Goal deleted", { label: "Undo", fn: () => undoTo(b) }); play("warn"); }}>Delete</button> : null}</div>
  </Sheet>;
}

export function HandoverSheet({ pid }: { pid: string }) {
  getState(); const P = G.planById(pid), N = G.nextPlan(pid); useUi(); if (!P || !N) return null;
  const gs = getState().goals.filter((g) => !g.archived && g.plan === pid && g.status !== "Draft"), dec = G.handoverDecision, cnt = (k: string) => gs.filter((g) => dec(g) === k).length, und = gs.filter((g) => !dec(g)).length, { mk, dp } = G.handoverPlan(pid);
  return <Sheet label="Handover review">
    <h1>🧭 {G.planLabel(P)} → {G.planLabel(N)}</h1><p className="sub">Handover review · decide what happens to each goal as {G.planLabel(P).toLowerCase()} ends.</p>
    <div className="stats" style={{ gridTemplateColumns: "repeat(4,1fr)" }}><div className="stat"><b>{cnt("finish")}</b><span>Finish</span></div><div className="stat"><b>{cnt("carry")}</b><span>Carry over</span></div><div className="stat"><b>{cnt("drop")}</b><span>Drop</span></div><div className="stat"><b>{und}</b><span>Undecided</span></div></div>
    <div className="panel">{gs.length ? gs.map((g) => { const d = dec(g), pr = G.projectAt(g, g.end), sg = G.suggest(g), succ = G.successorOf(g), hs = g.type === "habit" ? habitStats(g) : null;
      const line = g.status === "Completed" ? "Completed" : hs ? `${Math.round(hs.consistency * 100)}% consistency · ${hs.streak}-week streak` : g.type === "milestones" ? `${current(g)} of ${(g.milestones || []).length} milestones done` : pr >= g.total ? `On pace to reach ${fmt(g.total, g.unit)} by ${fmtDate(g.end)}` : `At current pace: ${fmt(pr, g.unit)} by ${fmtDate(g.end)} (target ${fmt(g.total, g.unit)})`;
      return <div key={g.id} className="rv"><div className="row"><b>{g.name}</b><span className="note" style={{ margin: 0 }}>{g.category}</span></div><div className="note" style={{ margin: "3px 0 0" }}>{line}</div>
        {g.status === "Completed" ? null : <div className="dch"><button className={d === "finish" ? "fin" : ""} aria-pressed={d === "finish"} onClick={() => G.decide(g, "finish")}>Finish</button><button className={d === "carry" ? "car" : ""} aria-pressed={d === "carry"} onClick={() => G.decide(g, "carry")}>Carry to {G.planLabel(N)}</button><button className={d === "drop" ? "drp" : ""} aria-pressed={d === "drop"} onClick={() => G.decide(g, "drop")}>Drop</button></div>}
        <div className="note" style={{ margin: "6px 0 0" }}>{succ ? `✓ Draft created in ${G.planLabel(N)}` : !d ? `Suggested: ${sg === "finish" ? "Finish" : "Carry over"}` : ""}</div></div>; }) : <p className="note">No active goals in {G.planLabel(P)}.</p>}</div>
    {und ? <button className="btn alt" onClick={() => G.useSuggestions(pid)}>Use suggestions for the {und} undecided</button> : null}
    {mk.length || dp.length ? <button className="btn" onClick={async () => { if (!await ask(`Create ${mk.length} draft${mk.length === 1 ? "" : "s"} in ${G.planLabel(N)} and put ${dp.length} on hold?`, "Apply")) return; const r = G.applyHandover(pid); toast(`${r.made} draft${r.made === 1 ? "" : "s"} created${r.held ? ` · ${r.held} on hold` : ""}`); }}>Apply: {mk.length ? `create ${mk.length} draft${mk.length > 1 ? "s" : ""} in ${G.planLabel(N)}` : ""}{mk.length && dp.length ? " · " : ""}{dp.length ? `put ${dp.length} on hold` : ""}</button> : null}
    <button className="btn alt" onClick={close}>Close</button>
  </Sheet>;
}

export function ReviewSheet({ y }: { y: number }) {
  useUi(); const fg = focusGoals(y), ny = y + 1, over = y < curYear(), st = getState();
  const withT = fg.filter((g) => (yearTarget(g, y) as number) > 0), hit = withT.filter((g) => (yearAchieved(g, y) || 0) >= (yearTarget(g, y) as number)).length, can = G.carryable(y);
  return <Sheet label={`${y} review`}>
    <h1>📋 {y} review</h1><p className="sub">{over ? "Year complete." : y === curYear() ? "Year in progress — a preview of how you're doing." : "This year hasn't started yet."}</p>
    <div className="stats" style={{ gridTemplateColumns: "repeat(3,1fr)" }}><div className="stat"><b>{fg.length}</b><span>Focus goals</span></div><div className="stat"><b>{hit}/{withT.length}</b><span>Targets hit</span></div><div className="stat"><b>{withT.length ? Math.round((hit / withT.length) * 100) : 0}%</b><span>Hit rate</span></div></div>
    <div className="panel">{fg.length ? fg.map((g) => { const t = yearTarget(g, y) as number, a = yearAchieved(g, y) || 0, has = t > 0, r = has ? a / t : 0;
      const tag = !has ? <span className="tag none">No target</span> : r >= 1 ? <span className="tag hit">✓ Hit</span> : !over ? <span className="tag prog">In progress</span> : r >= 0.5 ? <span className="tag part">Partly</span> : <span className="tag miss">Missed</span>;
      const unfinished = !has || r < 1, carried = isFocus(g, ny);
      const btn = unfinished || over ? (carried ? <span className="note">In {ny} focus ✓</span> : year(g.end) < ny ? <span className="note">Deadline passed</span> : <button className="btn small alt" onClick={() => { G.carryGoal(g, y); commit(); toast(`Carried to ${ny}`); }}>Carry to {ny}</button>) : null;
      return <div key={g.id} className="rv"><div className="row"><b>{g.name}</b>{tag}</div><div className={"bar thin" + (r >= 1 ? " done" : "")} style={{ margin: "9px 0 6px" }}><i style={{ width: (clamp(r) * 100).toFixed(1) + "%" }} /></div>
        <div className="row"><span className="note" style={{ margin: 0 }}>{fmt(a, g.unit)} of {has ? fmt(t, g.unit) : "—"}{has ? " · " + Math.round(r * 100) + "%" : ""}</span>{btn}</div></div>; }) : <p className="note">No focus goals were chosen for {y}.</p>}</div>
    {can.length ? <button className="btn" onClick={() => { const n = G.carryAll(y); toast(`${n} goal${n === 1 ? "" : "s"} carried to ${ny}`); }}>Carry all {can.length} unfinished to {ny}</button> : null}
    <div className="panel"><b>Notes for {y}</b><p className="note" style={{ marginTop: 2 }}>What went well? What will you change?</p>
      <textarea rows={4} aria-label={`Notes for ${y}`} placeholder="Write your thoughts…" defaultValue={st.reviews[y] || ""} onBlur={(e) => G.setReviewNote(y, e.target.value)} /></div>
    <button className="btn alt" onClick={close}>Close</button>
  </Sheet>;
}

export function ImportSheet() {
  const ui = useUi(), items = ui.importItems as G.ImportItem[];
  if (!items.length) return <Sheet label="Import"><h1>Import from Excel</h1><p className="sub">Your spreadsheet matches the app already — nothing to change.</p><button className="btn alt" onClick={close}>Close</button></Sheet>;
  const nOn = items.filter((x) => x.on).length;
  return <Sheet label="Import goals">
    <h1>Import from Excel</h1><p className="sub">Goals are matched by name. Untick anything you don't want to change.</p>
    <div className="panel">{items.map((x, i) => <div key={i} className="rv"><label className="chkrow" style={{ alignItems: "flex-start" }}><input type="checkbox" aria-label={x.r.name} checked={x.on} style={{ marginTop: 3 }} onChange={() => setUi({ importItems: items.map((y, j) => (j === i ? { ...y, on: !y.on } : y)) })} /><span><b>{x.r.name}</b>{x.g ? null : <> <span className="tag prog">New</span></>}<br /><small style={{ color: "var(--mute)", fontWeight: 500 }}>{x.ch.join(" · ")}</small></span></label></div>)}</div>
    <p className="note">Your logs and history stay. “Current” numbers are matched by adjusting the starting number, so your entries aren't lost.</p>
    <button className="btn" disabled={!nOn} onClick={() => { const r = G.applyGoalImport(items); close(); toast(`${r.nNew} added · ${r.nUp} updated`); }}>Apply {nOn} change{nOn === 1 ? "" : "s"}</button>
    <button className="btn alt" onClick={close}>Cancel</button>
  </Sheet>;
}
export { openSheet };
