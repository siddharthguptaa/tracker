import { useState } from "react";
import { Sheet } from "./Sheet";
import { setUi, toast } from "./uiStore";
import { getState } from "../domain/ctx";
import { todayStr, addDays } from "../domain/clock";
import { addGoal, validateGoal, addTodoFromText } from "../domain/actions";
import type { GoalType } from "../domain/types";
import { play } from "./fx";

export function NewGoalSheet() {
  const s = getState(), y = new Date().getFullYear();
  const [name, setName] = useState(""), [type, setType] = useState<GoalType>("total"), [cat, setCat] = useState(s.categories[0] || "General"), [unit, setUnit] = useState(""), [total, setTotal] = useState(""), [base, setBase] = useState(""), [start, setStart] = useState(todayStr()), [end, setEnd] = useState(`${y}-12-31`);
  const simple = type === "milestones" || type === "habit";
  const save = () => {
    const inp = { name, category: cat, type, unit, total: parseFloat(total), baseline: parseFloat(base) || 0, start, end };
    const err = validateGoal(inp); if (err) return toast(err);
    addGoal(inp); play("ok"); setUi({ sheet: null }); toast("Goal added");
  };
  return (
    <Sheet label="New goal">
      <h1>New goal</h1>
      <label htmlFor="f_name">Name</label><input id="f_name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Run 500 km" autoFocus />
      <label htmlFor="f_type">Type</label>
      <select id="f_type" value={type} onChange={(e) => setType(e.target.value as GoalType)}><option value="total">Total (add up)</option><option value="level">Level (reach a number)</option><option value="habit">Habit (check-ins)</option><option value="milestones">Milestones</option></select>
      <label htmlFor="f_cat">Category</label>
      <input id="f_cat" list="f_cats" value={cat} onChange={(e) => setCat(e.target.value)} /><datalist id="f_cats">{s.categories.map((c) => <option key={c} value={c} />)}</datalist>
      {simple ? null : <div className="g2"><div><label htmlFor="f_total">Target</label><input id="f_total" type="number" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} /></div><div><label htmlFor="f_unit">Unit</label><input id="f_unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="km, ₹, pages" /></div></div>}
      {type === "level" ? <><label htmlFor="f_base">Starting level</label><input id="f_base" type="number" inputMode="decimal" value={base} onChange={(e) => setBase(e.target.value)} /></> : null}
      <div className="g2"><div><label htmlFor="f_start">Start</label><input id="f_start" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div><div><label htmlFor="f_end">End</label><input id="f_end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div></div>
      <div className="btns" style={{ marginTop: 14 }}><button className="btn alt" onClick={() => setUi({ sheet: null })}>Cancel</button><button className="btn" onClick={save}>Save goal</button></div>
    </Sheet>
  );
}

export function NewTodoSheet() {
  const [text, setText] = useState(""), [due, setDue] = useState("");
  const save = () => { if (!text.trim()) return toast("Type what needs doing"); addTodoFromText(text, due || undefined); play("ok"); setUi({ sheet: null }); toast("To-do added"); };
  return (
    <Sheet label="New to-do">
      <h1>New to-do</h1>
      <input id="tn_text" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") save(); }} placeholder="e.g. call bank tomorrow 5pm" aria-label="To-do" autoFocus />
      <p className="note">Dates like “tomorrow”, “fri” or “every monday” are understood.</p>
      <label htmlFor="tn_due">Due (optional)</label><input id="tn_due" type="date" value={due} min={addDays(todayStr(), -365)} onChange={(e) => setDue(e.target.value)} />
      <div className="btns" style={{ marginTop: 14 }}><button className="btn alt" onClick={() => setUi({ sheet: null })}>Cancel</button><button className="btn" onClick={save}>Add</button></div>
    </Sheet>
  );
}
