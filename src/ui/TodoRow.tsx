import { getState } from "../domain/ctx";
import { todayStr, addDays } from "../domain/clock";
import { fmtDate, hm12, estText } from "../domain/format";
import { todoGoal } from "../domain/todos";
import { toggleTodo, deleteTodo, undoTo } from "../domain/actions";
import { toast, openSheet, setUi, getUi } from "./uiStore";
import type { Todo } from "../domain/types";
import { play } from "./fx";

export function TodoRow({ t, showGoal = true, sel, picked, manual, onUp, onDown, hideDelete }: { t: Todo; showGoal?: boolean; sel?: boolean; picked?: boolean; manual?: boolean; onUp?: () => void; onDown?: () => void; hideDelete?: boolean }) {
  const toggleSel = () => { const m = { ...getUi().sel }; if (m[t.id]) delete m[t.id]; else m[t.id] = true; setUi({ sel: m }); };
  const g = todoGoal(t), today = todayStr(), od = !t.done && !!t.due && t.due < today;
  const dl = t.due ? (t.due === today ? "Today" : t.due === addDays(today, 1) ? "Tomorrow" : (od ? "Overdue · " : "") + fmtDate(t.due)) + (t.time ? " · " + hm12(t.time) : "") : t.someday ? "🌙 Someday" : "";
  const subs = t.subs || [], tags = (t.tags || []).map((id) => getState().tags.find((x) => x.id === id)).filter(Boolean);
  const parts = [dl && <span key="d" className={od ? "red" : ""}>{dl}</span>, t.repeat && "↻ " + t.repeat, subs.length ? `☑ ${subs.filter((x) => x.d).length}/${subs.length}` : "", t.est ? "⏱ " + estText(t.est) : "", t.notes ? "📝" : "", t.rem != null && t.due ? "🔔" : "", g && showGoal ? "🎯 " + g.name : ""].filter(Boolean);
  return (
    <div className={"trw" + (t.done ? " dn" : "")} data-id={t.id}>
      {sel ? <button className={"chk sq" + (picked ? " on" : "")} aria-label="Select" aria-pressed={!!picked} onClick={toggleSel}>✓</button>
        : <button className={"chk" + (t.done ? " on" : "")} aria-label={t.done ? "Mark not done" : "Mark done"} onClick={() => { toggleTodo(t); play(t.done ? "ok" : "tick"); }}>✓</button>}
      <div className="tbody" role="button" tabIndex={0} onClick={() => (sel ? toggleSel() : openSheet("tdedit", t.id))} onKeyDown={(e) => { if (e.key === "Enter") (sel ? toggleSel() : openSheet("tdedit", t.id)); }}>
        <div className="ttx">{t.text}</div>
        {parts.length ? <div className="tsub">{parts.map((p, i) => <span key={i}>{i ? " · " : ""}{p}</span>)}</div> : null}
        {tags.length ? <div className="tsub" style={{ marginTop: 5 }}>{tags.map((tg: any) => <span key={tg.id} className="tagpill" style={{ ["--tc" as any]: tg.color }}>{tg.name}</span>)}</div> : null}
      </div>
      {manual && !sel && !t.done ? <span className="dh" style={{ display: "flex", flexDirection: "column", gap: 2 }}><button className="x" aria-label="Move up" onClick={onUp}>▲</button><button className="x" aria-label="Move down" onClick={onDown}>▼</button></span> : null}
      {sel || hideDelete ? null : <button className="x" aria-label={"Delete " + t.text} title="Delete" onClick={() => { const b = deleteTodo(t); toast("To-do deleted", { label: "Undo", fn: () => undoTo(b) }); play("warn"); }}>✕</button>}
    </div>
  );
}
