import { useAppState, commit } from "../storage/store";
import { todayStr, isoOf, p2 } from "../domain/clock";
import { todoCat, todoGoal, dueLabel } from "../domain/todos";
import { Header } from "./Header";
import { TodoRow } from "./TodoRow";
import { RemindBanner } from "./TodoSheets";
import { useUi, setUi, openSheet, toast } from "./uiStore";
import * as O from "../domain/todoOps";
import { bulkDone, bulkDelete, restoreTodos, clearDone, calendarMonth, shiftMonth, ordOf } from "../domain/todoOps";
import { tagById } from "../domain/todoOps";
import type { Todo } from "../domain/types";

function todoSort(manual: boolean) {
  return (a: any, b: any) => { if (manual) return ordOf(a) - ordOf(b); const x = (a.due || "9999") + (a.time || ""), y = (b.due || "9999") + (b.time || ""); return x < y ? -1 : x > y ? 1 : 0; };
}

function Calendar({ sel }: { sel: boolean }) {
  const ui = useUi(), state = useAppState(), today = todayStr(), cm = ui.cm || today.slice(0, 7), selDay = ui.cday || today;
  const { y, m, start, dim, by } = calendarMonth(cm), mname = new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long" });
  const cells = [];
  for (let i = 0; i < start; i++) cells.push(<span key={"e" + i} className="cd e" />);
  for (let d = 1; d <= dim; d++) {
    const iso = cm + "-" + p2(d), L = by[iso] || [], o = L.filter((x) => !x.done).length, dn = L.length - o;
    cells.push(<button key={iso} className={"cd" + (iso === today ? " td" : "") + (iso === selDay ? " sel" : "")} aria-label={`${d} ${mname}, ${o} open`} onClick={() => setUi({ cday: iso })}><b>{d}</b><i>{o ? <u className={iso < today ? "late" : ""}>{o > 3 ? "3+" : "●".repeat(o)}</u> : dn ? <u className="ok">✓</u> : null}</i></button>);
  }
  const L = state.todos.filter((t) => t.due === selDay).sort((a, b) => Number(a.done) - Number(b.done) || todoSort(false)(a, b));
  return (
    <>
      <div className="calhead"><button className="x" aria-label="Previous month" onClick={() => setUi({ cm: shiftMonth(cm, -1) })}>‹</button><b>{new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</b><button className="x" aria-label="Next month" onClick={() => setUi({ cm: shiftMonth(cm, 1) })}>›</button><button className="btn small alt" onClick={() => setUi({ cm: null, cday: null })}>Today</button></div>
      <div className="calgrid">{["M", "T", "W", "T", "F", "S", "S"].map((x, i) => <span key={i} className="cw">{x}</span>)}{cells}</div>
      <div className="panel" style={{ marginTop: 12 }}><div className="row"><b>{dueLabel(selDay)}</b><button className="btn small" onClick={() => openSheet("todonew", selDay)}>＋ Add</button></div>
        {L.length ? L.map((t) => <TodoRow key={t.id} t={t} sel={sel} picked={!!ui.sel[t.id]} />) : <p className="note">Nothing on this day.</p>}</div>
    </>
  );
}

export function TodoTab() {
  const state = useAppState(), ui = useUi(), today = todayStr(), f = ui.tf || "today", grp = state.settings.todoGroup || "category", manual = state.settings.todoSort === "manual", cal = ui.tview === "cal", sel = ui.selMode;
  const open = state.todos.filter((t) => !t.done), isInbox = (t: any) => !t.due && !t.someday;
  const cnt: Record<string, number> = { today: open.filter((t) => t.due && t.due <= today).length, upcoming: open.filter((t) => t.due && t.due > today).length, inbox: open.filter(isInbox).length, someday: open.filter((t) => t.someday && !t.due).length, all: open.length, done: state.todos.filter((t) => t.done).length };
  const overdue = open.filter((t) => t.due && t.due < today).length, doneToday = state.todos.filter((t) => t.done && t.doneAt && isoOf(t.doneAt) === today).length;
  let items = f === "today" ? open.filter((t) => t.due && t.due <= today) : f === "upcoming" ? open.filter((t) => t.due && t.due > today) : f === "inbox" ? open.filter(isInbox) : f === "someday" ? open.filter((t) => t.someday && !t.due) : f === "done" ? state.todos.filter((t) => t.done) : open;
  items = f === "done" ? items.slice().sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)) : items.slice().sort(todoSort(manual));
  const tagf = ui.tagf && tagById(ui.tagf) ? ui.tagf : null;
  if (tagf) items = items.filter((t) => (t.tags || []).includes(tagf));
  const groups: { key: string; list: Todo[] }[] = [], idx: Record<string, number> = {};
  items.forEach((t) => {
    const g = todoGoal(t), tg = (t.tags || []).map(tagById).filter(Boolean) as any[], keys = grp === "tag" ? (tg.length ? tg.map((x) => x.name) : ["No tag"]) : [grp === "goal" ? (g ? g.name : "No goal") : (todoCat(t) || "No category")];
    keys.forEach((key) => { if (!(key in idx)) { idx[key] = groups.length; groups.push({ key, list: [] }); } groups[idx[key]].list.push(t); });
  });
  groups.sort((a, b) => (a.key.startsWith("No ") ? 1 : 0) - (b.key.startsWith("No ") ? 1 : 0));
  const chips: [string, string][] = [["today", "Today"], ["upcoming", "Upcoming"], ["inbox", "Inbox"], ["someday", "Someday"], ["all", "All open"], ["done", "Done"]];
  const empty = f === "today" ? "Nothing due today. 🎉\nTap the + button to add one, or check Upcoming." : f === "done" ? "Nothing completed yet." : f === "someday" ? "No someday ideas yet.\nPick “Someday” when adding a to-do to park it here." : f === "inbox" ? "Your inbox is empty." : "Nothing here.";
  const picked = Object.keys(ui.sel).filter((k) => ui.sel[k]), nSel = picked.length, canOrder = manual && grp !== "tag" && !sel;
  const set = (k: string, v: any) => { (state.settings as any)[k] = v; commit(); };
  const exit = () => setUi({ selMode: false, sel: {} });
  const visible = items.filter((t) => !t.done).map((t) => t.id);
  const doDelete = () => { const gone = bulkDelete(picked); exit(); toast(`${gone.length} deleted`, { label: "Undo", fn: () => restoreTodos(gone) }); };
  return (
    <>
      <Header />
      <h1>To-do</h1><p className="sub">Daily tasks, linked to your goals or categories</p>
      <RemindBanner />
      <div className="stats">
        <div className="stat"><b>{open.filter((t) => t.due === today).length}</b><span>Due today</span></div>
        <div className="stat"><b className={overdue ? "red" : ""}>{overdue}</b><span>Overdue</span></div>
        <div className="stat"><b>{doneToday}</b><span>Done today</span></div>
        <div className="stat"><b>{open.length}</b><span>Open</span></div></div>
      <div className="tdbar"><div className="seg" style={{ margin: 0 }}><button className={!cal ? "on" : ""} onClick={() => setUi({ tview: "list" })}>List</button><button className={cal ? "on" : ""} onClick={() => setUi({ tview: "cal" })}>Calendar</button></div>
        <div style={{ display: "flex", gap: 8, flex: "none" }}>
          <button className={"ib" + (sel ? " on" : "")} aria-label="Select several" title="Select several" onClick={() => (sel ? exit() : setUi({ selMode: true, sel: {} }))}>☑</button>
          <button className="ib" aria-label="Statistics" title="Statistics" onClick={() => openSheet("tdstats")}>📊</button>
          <button className="ib" aria-label="Templates" title="Templates" onClick={() => openSheet("tdtpl")}>📋</button>
          <button className="ib" aria-label="To-do settings" title="To-do settings" onClick={() => openSheet("tdsettings")}>⚙</button></div></div>
      {cal ? <Calendar sel={sel} /> : <>
        <div className="chips">{chips.map(([v, l]) => <button key={v} className={"chip" + (f === v ? " on" : "")} onClick={() => setUi({ tf: v })}>{l} · {cnt[v]}</button>)}</div>
        {state.tags.length ? <><div className="chips"><button className={"chip" + (!tagf ? " on" : "")} onClick={() => setUi({ tagf: null })}>All tags</button>{state.tags.map((t) => <button key={t.id} className={"chip" + (tagf === t.id ? " on" : "")} onClick={() => setUi({ tagf: t.id })}>{t.name}</button>)}</div>
          {tagf && tagById(tagf)?.note ? <p className="note">🏷 <b>{tagById(tagf)!.name}</b>: {tagById(tagf)!.note}</p> : null}</> : <div className="chips"><button className="chip" onClick={() => openSheet("tdsettings")}>🏷 Create tags in settings</button></div>}
        <details className="acc" style={{ marginTop: 2 }}><summary>View options</summary>
          <div className="seg" style={{ margin: "0 0 8px" }}>{([["category", "By category"], ["goal", "By goal"], ["tag", "By tag"]] as const).map(([v, l]) => <button key={v} className={grp === v ? "on" : ""} onClick={() => set("todoGroup", v)}>{l}</button>)}</div>
          <div className="seg" style={{ margin: 0 }}><button className={!manual ? "on" : ""} onClick={() => set("todoSort", "due")}>Sort by date</button><button className={manual ? "on" : ""} onClick={() => set("todoSort", "manual")}>My order (▲▼)</button></div></details>
        <div style={{ marginTop: 12 }}>{groups.length ? <div className="grid">{groups.map((g) => <div key={g.key} className="panel"><div className="cat" style={{ marginBottom: 2 }}>{g.key} · {g.list.length}</div>
          {g.list.map((t) => <TodoRow key={t.id} t={t} showGoal={grp !== "goal"} sel={sel} picked={!!ui.sel[t.id]} manual={canOrder} onUp={() => O.moveInOrder(visible, t.id, -1)} onDown={() => O.moveInOrder(visible, t.id, 1)} />)}</div>)}</div> : <div className="empty" style={{ whiteSpace: "pre-line" }}>{empty}</div>}</div>
        {f === "done" && cnt.done ? <button className="list-btn" style={{ marginTop: 12 }} onClick={() => { const gone = clearDone(); toast(`${gone.length} cleared`, { label: "Undo", fn: () => restoreTodos(gone) }); }}><span>Clear {cnt.done} completed to-do{cnt.done > 1 ? "s" : ""}<small>You can undo right after</small></span>›</button> : null}
      </>}
      {sel ? <div className="selbar"><b>{nSel} selected</b>
        <button className="btn small alt" onClick={() => { const all: Record<string, boolean> = {}; (cal ? state.todos.filter((t) => t.due === (ui.cday || today)) : items).forEach((t) => (all[t.id] = true)); setUi({ sel: all }); }}>All</button>
        <button className="btn small" disabled={!nSel} onClick={() => { const n = bulkDone(picked); exit(); toast(`${n} marked done`); }}>Done</button>
        <button className="btn small alt" disabled={!nSel} onClick={() => openSheet("tdmove", picked)}>Move</button>
        <button className="btn small alt" disabled={!nSel} onClick={() => { const lines = O.templateFromTodos(picked); exit(); openSheet("tdtpl", { lines }); }}>Template</button>
        <button className="btn small danger" disabled={!nSel} onClick={doDelete}>Delete</button>
        <button className="x" aria-label="Cancel selection" onClick={exit}>✕</button></div> : null}
    </>
  );
}
