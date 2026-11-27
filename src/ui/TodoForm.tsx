import { useState } from "react";
import { getState } from "../domain/ctx";
import { todayStr, addDays, mondayOf } from "../domain/clock";
import { estText, uid } from "../domain/format";
import { repOf, repText } from "../domain/todos";
import { T_REPS, T_ESTS, customRepeat, type TodoFormValues } from "../domain/todoOps";

const UNITS = ["day", "week", "month", "year"];
/** Controlled to-do form shared by the New and Edit sheets (same fields as the classic app). */
export function TodoForm({ v, set, id }: { v: TodoFormValues; set: (p: Partial<TodoFormValues>) => void; id: string }) {
  const s = getState(), today = todayStr(), r = repOf({ repeat: v.repeat } as any);
  const key = r ? repText({ ...r, from: "due" }) : "", initSel = !r ? "" : T_REPS.some((x) => x[0] === key) ? key : "custom";
  const [sel, setSel] = useState(initSel), [cn, setCn] = useState(String(initSel === "custom" && r ? r.n : 2)), [cu, setCu] = useState(initSel === "custom" && r ? r.unit : "day"), [fromDone, setFromDone] = useState(!!r && r.from === "done");
  const setRep = (sl: string, n = cn, u = cu, fd = fromDone) => {
    setSel(sl); const rep = sl === "custom" ? customRepeat(parseInt(n) || 1, u, false) : sl; set({ repeat: rep ? rep + (fd ? " after completion" : "") : "" });
  };
  const goals = s.goals.filter((g) => !g.archived && g.status !== "Draft"), cats = [...new Set([...s.categories, ...s.goals.map((g) => g.category)])].filter(Boolean);
  const when = (d: string | null, some = false) => some ? v.someday && !v.due : !v.someday && (v.due || "") === (d || "");
  const pickWhen = (d: string, some = false) => set(some ? { due: null, time: null, someday: true, rem: null } : { due: d || null, someday: false, ...(d ? {} : { time: null, rem: null }) });
  const chip = (l: string, d: string, some = false) => <button type="button" key={l} className={"chip" + (when(d, some) ? " on" : "")} onClick={() => pickWhen(d, some)}>{l}</button>;
  const ests = T_ESTS.concat(v.est && !T_ESTS.includes(v.est) ? [v.est] : []).sort((a, b) => a - b);
  const setSub = (i: number, p: any) => set({ subs: v.subs.map((x, k) => (k === i ? { ...x, ...p } : x)) });
  const hasA = !!r || v.rem != null, hasB = v.subs.length > 0 || !!v.notes || !!v.est, hasC = !!v.goalId || !!v.category || v.tags.length > 0;
  return (
    <>
      <label>When</label>
      <div className="chips" style={{ marginTop: 2, flexWrap: "wrap", overflow: "visible" }}>{chip("Today", today)}{chip("Tomorrow", addDays(today, 1))}{chip("Next week", addDays(mondayOf(today), 7))}{chip("No date", "")}{chip("🌙 Someday", "", true)}</div>
      <div className="g2" style={{ marginTop: 8 }}>
        <input id={id + "_due"} type="date" value={v.due || ""} aria-label="Due date" onChange={(e) => set(e.target.value ? { due: e.target.value, someday: false } : { due: null, time: null, rem: null })} />
        <input id={id + "_time"} type="time" value={v.time || ""} aria-label="Time" onChange={(e) => set(e.target.value ? { time: e.target.value, ...(v.due ? {} : { due: todayStr(), someday: false }) } : { time: null })} />
      </div>
      <div className="chips" style={{ marginTop: 6, flexWrap: "wrap", overflow: "visible" }}>
        {([["9 AM", "09:00"], ["1 PM", "13:00"], ["6 PM", "18:00"], ["9 PM", "21:00"], ["No time", ""]] as const).map(([l, hm]) => <button type="button" key={l} className="chip" onClick={() => set(hm ? { time: hm, ...(v.due ? {} : { due: todayStr(), someday: false }) } : { time: null })}>{l}</button>)}
      </div>
      <details className="acc" style={{ marginTop: 10 }} open={hasA || undefined}><summary>Repeat &amp; reminder</summary>
        <label style={{ marginTop: 0 }} htmlFor={id + "_rep"}>Repeat</label>
        <select id={id + "_rep"} value={sel} onChange={(e) => setRep(e.target.value)}>{T_REPS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        {sel === "custom" ? <div className="g2" style={{ marginTop: 6 }}>
          <input id={id + "_repn"} type="number" min={1} max={365} value={cn} aria-label="Every how many" onChange={(e) => { setCn(e.target.value); setRep("custom", e.target.value); }} />
          <select id={id + "_repu"} aria-label="Unit" value={cu} onChange={(e) => { setCu(e.target.value as any); setRep("custom", cn, e.target.value); }}>{UNITS.map((u) => <option key={u} value={u}>{u}s</option>)}</select></div> : null}
        {sel ? <label className="chkrow"><input type="checkbox" checked={fromDone} onChange={(e) => { setFromDone(e.target.checked); setRep(sel, cn, cu, e.target.checked); }} /> Count from the day I finish it</label> : null}
        <label htmlFor={id + "_rem"}>Reminder</label>
        <select id={id + "_rem"} value={v.rem == null ? "" : String(v.rem)} onChange={(e) => set({ rem: e.target.value === "" ? null : Number(e.target.value) })}>{[["", "No reminder"], ["0", "At the due time"], ["10", "10 minutes before"], ["60", "1 hour before"], ["1440", "1 day before"]].map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <p className="note">Reminders show inside the app while it is open (and as a phone notification if you allow them in To-do settings). They need a due date.</p></details>
      <details className="acc" style={{ marginTop: 6 }} open={hasB || undefined}><summary>Subtasks, notes &amp; time estimate</summary>
        <label style={{ marginTop: 0 }}>Subtasks</label>
        <div>{v.subs.map((x, i) => <div className="tsrow" key={x.id}><input type="checkbox" checked={x.d} aria-label="Done" onChange={(e) => setSub(i, { d: e.target.checked })} /><input type="text" placeholder="Subtask" value={x.t} autoComplete="off" onChange={(e) => setSub(i, { t: e.target.value })} /><button className="x" type="button" aria-label="Remove subtask" onClick={() => set({ subs: v.subs.filter((_, k) => k !== i) })}>✕</button></div>)}</div>
        <button className="btn small alt" type="button" style={{ marginTop: 6 }} onClick={() => set({ subs: [...v.subs, { id: uid(), t: "", d: false }] })}>＋ Add subtask</button>
        <label htmlFor={id + "_notes"}>Notes</label><textarea id={id + "_notes"} rows={3} placeholder="Details, links, anything to remember…" value={v.notes} onChange={(e) => set({ notes: e.target.value })} />
        <label htmlFor={id + "_est"}>Time needed</label>
        <select id={id + "_est"} value={v.est ? String(v.est) : ""} onChange={(e) => set({ est: e.target.value ? Number(e.target.value) : null })}><option value="">No estimate</option>{ests.map((m) => <option key={m} value={m}>{estText(m)}</option>)}</select></details>
      <details className="acc" style={{ marginTop: 6 }} open={hasC || undefined}><summary>Goal, category &amp; tags</summary>
        <label style={{ marginTop: 0 }} htmlFor={id + "_goal"}>Linked goal</label>
        <select id={id + "_goal"} value={v.goalId || ""} onChange={(e) => set({ goalId: e.target.value || null })}><option value="">None</option>{goals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
        {v.goalId ? null : <><label htmlFor={id + "_cat"}>Category (used when no goal is linked)</label>
          <select id={id + "_cat"} value={v.category} onChange={(e) => set({ category: e.target.value })}><option value="">None</option>{cats.map((c) => <option key={c} value={c}>{c}</option>)}</select></>}
        <label>Tags</label>
        {s.tags.length ? <div className="tagpick">{s.tags.map((g) => <label key={g.id} className="tagchk" style={{ ["--tc" as any]: g.color }}><input type="checkbox" checked={v.tags.includes(g.id)} onChange={(e) => set({ tags: e.target.checked ? [...v.tags, g.id] : v.tags.filter((x) => x !== g.id) })} /><span>{g.name}</span></label>)}</div> : <p className="note">No tags yet. Add some below, or in To-do settings.</p>}
        <input type="text" placeholder="New tags, comma separated" aria-label="New tags" value={v.newTags || ""} style={{ marginTop: 6 }} onChange={(e) => set({ newTags: e.target.value })} /></details>
    </>
  );
}
