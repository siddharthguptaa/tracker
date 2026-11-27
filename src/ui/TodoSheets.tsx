import { useState } from "react";
import { ask } from "./ask";
import { Sheet } from "./Sheet";
import { setUi, toast, openSheet, useUi, getUi } from "./uiStore";
import { getState } from "../domain/ctx";
import { useAppState } from "../storage/store";
import { todayStr, addDays } from "../domain/clock";
import { estText } from "../domain/format";
import { parseQuick, todoStats, dueLabel } from "../domain/todos";
import { deleteTodo, undoTo } from "../domain/actions";
import { commit } from "../storage/store";
import { TodoForm } from "./TodoForm";
import { play } from "./fx";
import { writeWorkbook, readWorkbook } from "./goalIo";
import * as CSV from "../domain/todoCsv";
import { tallyApi } from "./tally";
import { useRef } from "react";
import * as O from "../domain/todoOps";

const close = () => setUi({ sheet: null, sheetArg: null });

/** Live "what did it understand" preview for smart add. */
export function quickPreview(text: string): string {
  if (!O.smartOn() || !text.trim()) return "";
  const q = parseQuick(text.trim()), bits: string[] = [];
  if (q.due) bits.push("📅 " + dueLabel(q.due)); if (q.time) bits.push("🕒 " + q.time); if (q.repeat) bits.push("↻ " + q.repeat); if (q.est) bits.push("⏱ " + estText(q.est)); if (q.someday) bits.push("🌙 Someday");
  q.tags.forEach((id) => { const t = getState().tags.find((x) => x.id === id); if (t) bits.push("#" + t.name); });
  return q.any && bits.length ? bits.join(" · ") : "";
}

export function NewTodoSheet({ day }: { day?: string | null }) {
  const [text, setText] = useState(""), [v, setV] = useState(() => O.emptyForm(day ? { due: day } : {}));
  const set = (p: Partial<O.TodoFormValues>) => setV((x) => ({ ...x, ...p }));
  const pv = quickPreview(text);
  const save = (another: boolean) => {
    if (!text.trim()) return toast("Type what needs doing");
    O.addTodo(text, v); play("ok");
    if (another) { setText(""); setV(O.emptyForm({ due: v.due, someday: v.someday })); toast("Added — type the next one"); document.getElementById("tn_text")?.focus(); } else { close(); toast("To-do added"); }
  };
  return (
    <Sheet label="New to-do">
      <h1>New to-do</h1>
      <input id="tn_text" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") save(false); }} placeholder="e.g. call bank tomorrow 5pm" aria-label="To-do" autoFocus autoComplete="off" />
      {pv ? <p className="note" id="tn_preview">Understood: {pv}</p> : <p className="note">Dates like “tomorrow”, “fri” or “every monday”, “30m” and “#tag” are understood.</p>}
      <TodoForm v={v} set={set} id="tn" />
      <div className="btns" style={{ marginTop: 14 }}><button className="btn alt" onClick={close}>Cancel</button><button className="btn alt" onClick={() => save(true)}>Add &amp; add another</button><button className="btn" onClick={() => save(false)}>Add</button></div>
    </Sheet>
  );
}

export function EditTodoSheet({ id }: { id: string }) {
  const t: any = getState().todos.find((x) => x.id === id);
  const [text, setText] = useState(t ? t.text : ""), [v, setV] = useState(() => (t ? O.formOf(t) : O.emptyForm()));
  if (!t) return null;
  const set = (p: Partial<O.TodoFormValues>) => setV((x) => ({ ...x, ...p }));
  const save = () => { const err = O.saveTodoEdit(t, text, v); if (err) return toast(err); play("ok"); close(); toast("Saved"); };
  return (
    <Sheet label="Edit to-do">
      <h1>Edit to-do</h1>
      <input id="te_text" value={text} onChange={(e) => setText(e.target.value)} aria-label="To-do" />
      <TodoForm v={v} set={set} id="te" />
      <button className="btn alt" style={{ marginTop: 10 }} onClick={() => openSheet("tdmove", [t.id])}>Snooze or reschedule…</button>
      <div className="btns" style={{ marginTop: 10 }}><button className="btn danger" onClick={() => { const b = deleteTodo(t); close(); toast("To-do deleted", { label: "Undo", fn: () => undoTo(b) }); play("warn"); }}>Delete</button><button className="btn alt" onClick={close}>Cancel</button><button className="btn" onClick={save}>Save</button></div>
    </Sheet>
  );
}

export function MoveSheet({ ids }: { ids: string[] }) {
  const [d, setD] = useState(todayStr()), n = ids.length;
  const go = (k: O.MoveKind, date?: string) => { O.moveTodos(ids, k, date); setUi({ sheet: null, sheetArg: null, sel: {}, selMode: false }); play("ok"); toast(n > 1 ? `${n} to-dos moved` : "Rescheduled"); };
  const btn = (k: O.MoveKind, l: string, small = "") => <button key={k} className="list-btn" onClick={() => go(k)}><span>{l}{small ? <small>{small}</small> : null}</span>›</button>;
  return (
    <Sheet label="Move to-dos">
      <h1>{n > 1 ? "Move " + n + " to-dos" : "Snooze or reschedule"}</h1>
      {btn("later", "Later today", "In about 3 hours")}{btn("tomorrow", "Tomorrow")}{btn("week", "Next week", "Monday")}{btn("month", "Next month")}{btn("inbox", "No date (Inbox)")}{btn("someday", "🌙 Someday")}
      <label htmlFor="tm_date">Pick a date</label>
      <div className="tadd"><input id="tm_date" type="date" value={d} onChange={(e) => setD(e.target.value)} /><button className="btn small" onClick={() => d ? go("date", d) : toast("Pick a date")}>Move</button></div>
      <button className="btn alt" style={{ marginTop: 12 }} onClick={close}>Cancel</button>
    </Sheet>
  );
}

export function StatsSheet() {
  const s: any = todoStats();
  return (
    <Sheet label="To-do stats">
      <h1>Your to-do stats</h1>
      <div className="dk"><div><b>{s.streak} day{s.streak === 1 ? "" : "s"}</b><small>Current streak</small></div><div><b>{s.best}</b><small>Best streak</small></div><div><b>{s.total}</b><small>Done, all time</small></div></div>
      <div className="dk"><div><b>{s.thisWeek}</b><small>This week</small></div><div><b>{s.thisMonth}</b><small>This month</small></div><div><b>{s.onTime == null ? "–" : s.onTime + "%"}</b><small>Finished on time</small></div></div>
      <div className="panel"><b>Last 8 weeks</b><div className="wbars" style={{ marginTop: 10 }}>{s.weeks.map((w: any, i: number) => <div key={i}><i style={{ height: Math.round((w.n / s.mx) * 100) + "%" }} title={String(w.n)} /><small>{w.n}</small></div>)}</div>
        <p className="note" style={{ margin: "8px 0 0" }}>About {s.avg} to-dos a day over the last 30 days{s.est ? ` · ${estText(s.est)} of estimated work done this week` : ""}.</p></div>
      {s.top.length ? <div className="panel"><b>Where your time went (30 days)</b>{s.top.map(([k, n]: [string, number]) => <div key={k} style={{ marginTop: 9 }}><div className="row" style={{ fontSize: 13.5 }}><span>{k}</span><b>{n}</b></div><div className="dbar"><i style={{ width: Math.round((n / s.top[0][1]) * 100) + "%" }} /></div></div>)}</div> : null}
      <button className="btn alt" onClick={close}>Close</button>
    </Sheet>
  );
}

export function TagsManager() {
  useAppState(); const s = getState(), [nn, setNn] = useState(""), [nt, setNt] = useState(""), [nc, setNc] = useState(O.TAG_COLORS[s.tags.length % O.TAG_COLORS.length]);
  const sw = (sel: string, on: (c: string) => void) => O.TAG_COLORS.map((c) => <button key={c} className={"sw sm" + (sel === c ? " on" : "")} style={{ background: c }} aria-label={"Colour " + c} onClick={() => on(c)} />);
  return (
    <>
      <details className="acc panel" style={{ margin: "0 0 10px" }}><summary>＋ New tag</summary>
        <input type="text" placeholder="Name, e.g. Errands, Waiting for, Ideas" aria-label="New tag name" value={nn} onChange={(e) => setNn(e.target.value)} />
        <input type="text" placeholder="Note (optional)" aria-label="New tag note" style={{ marginTop: 6 }} value={nt} onChange={(e) => setNt(e.target.value)} />
        <div className="sws" style={{ margin: "10px 0 8px", gap: 8 }}>{sw(nc, setNc)}</div>
        <button className="btn small" onClick={() => { const err = O.addTag(nn, nt, nc); if (err) return toast(err); setNn(""); setNt(""); toast("Tag added"); }}>Add tag</button></details>
      {s.tags.length ? <div className="tagrows">{s.tags.map((t) => {
        const all = s.todos.filter((x) => (x.tags || []).includes(t.id)), o = all.filter((x) => !x.done).length;
        return <details key={t.id} className="acc tgd"><summary><span className="tagpill" style={{ ["--tc" as any]: t.color, margin: 0 }}>{t.name}</span><span className="accs">{o} open · {all.length} total</span></summary>
          <input type="text" defaultValue={t.name} placeholder="Name" aria-label="Tag name" onBlur={(e) => { if (e.target.value !== t.name) { const err = O.updateTag(t.id, { name: e.target.value }); if (err) { toast(err); e.target.value = t.name; } } }} />
          <input type="text" defaultValue={t.note || ""} placeholder="Note: what should you remember?" aria-label="Tag note" style={{ marginTop: 6 }} onBlur={(e) => O.updateTag(t.id, { note: e.target.value })} />
          <div className="sws" style={{ margin: "10px 0 8px", gap: 8 }}>{sw(t.color || "", (c) => O.updateTag(t.id, { color: c }))}</div>
          <button className="btn small alt" onClick={async () => { if (await ask(`Delete the tag “${t.name}”? It is removed from its to-dos.`)) { O.deleteTag(t.id); if (getUi().tagf === t.id) setUi({ tagf: null }); toast("Tag deleted"); } }}>Delete tag</button></details>;
      })}</div> : <p className="note">No tags yet. Open “New tag” to add your first one.</p>}
    </>
  );
}
export function TagsSheet() { return <Sheet label="Tags"><h1>🏷 Tags</h1><TagsManager /><button className="btn alt" onClick={close}>Close</button></Sheet>; }

export function TemplatesSheet({ arg }: { arg?: any }) {
  const ui = useUi(); useAppState();
  const s = getState(), w = ui.tpWhen, [edit, setEdit] = useState<null | { id: string | null; name: string; lines: string }>(arg && arg.lines ? { id: null, name: "", lines: arg.lines } : null);
  if (edit) {
    const save = () => { const err = O.saveTemplate(edit.name, edit.lines, edit.id); if (err) return toast(err); setEdit(null); toast("Template saved"); };
    return (
      <Sheet label="Template">
        <h1>{edit.id ? "Edit template" : "New template"}</h1>
        <label style={{ marginTop: 0 }} htmlFor="tp_name">Name</label><input id="tp_name" type="text" value={edit.name} placeholder="e.g. Trip checklist" onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
        <label htmlFor="tp_lines">To-dos</label><textarea id="tp_lines" rows={9} placeholder={"One to-do per line.\nStart a line with - to make it a subtask of the line above."} value={edit.lines} onChange={(e) => setEdit({ ...edit, lines: e.target.value })} />
        <p className="note">Smart words work here too, like “Pay rent every month” or “Call bank tomorrow 5pm”.</p>
        <button className="btn" onClick={save}>Save template</button>
        <div className="btns"><button className="btn alt" onClick={async () => setEdit(null)}>Cancel</button>{edit.id ? <button className="btn danger" onClick={async () => { if (await ask("Delete this template?")) { O.deleteTemplate(edit.id!); setEdit(null); toast("Template deleted"); } }}>Delete</button> : null}</div>
      </Sheet>
    );
  }
  const use = (t: { lines: string }) => { const due = w === "today" ? todayStr() : w === "tomorrow" ? addDays(todayStr(), 1) : null, n = O.tplCreate(t, due); close(); play("ok"); toast(`${n} to-do${n === 1 ? "" : "s"} added`); };
  return (
    <Sheet label="Templates">
      <h1>Templates</h1><p className="sub">Add a whole checklist in one tap</p>
      <label style={{ marginTop: 0 }}>Add them for</label>
      <div className="chips wrap" style={{ marginTop: 2 }}>{([["none", "No date"], ["today", "Today"], ["tomorrow", "Tomorrow"]] as const).map(([v, l]) => <button key={v} className={"chip" + (w === v ? " on" : "")} onClick={() => setUi({ tpWhen: v })}>{l}</button>)}</div>
      {s.todoTemplates.length ? s.todoTemplates.map((t) => { const n = O.templateCount(t.lines); return <div key={t.id} className="panel" style={{ marginTop: 10 }}><div className="row"><div style={{ minWidth: 0 }}><b>{t.name}</b><div className="note" style={{ margin: "2px 0 0" }}>{n} to-do{n === 1 ? "" : "s"}</div></div><div style={{ display: "flex", gap: 6 }}><button className="btn small" onClick={() => use(t)}>Use</button><button className="btn small alt" onClick={() => setEdit({ id: t.id, name: t.name, lines: t.lines })}>Edit</button></div></div></div>; }) : <p className="note">No templates yet. Create one for something you repeat, like a trip checklist.</p>}
      <button className="btn alt" style={{ marginTop: 12 }} onClick={() => setEdit({ id: null, name: "", lines: "" })}>＋ New template</button><button className="btn alt" style={{ marginTop: 8 }} onClick={close}>Close</button>
    </Sheet>
  );
}

function saveText(name: string, text: string) { const a = document.createElement("a"), u = URL.createObjectURL(new Blob(["\ufeff" + text], { type: "text/csv" })); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); }

function ImportPreview({ m, onDone }: { m: CSV.Preview; onDone: () => void }) {
  const n = m.items.length, nNew = m.items.filter((x) => !x.t).length;
  const warn = [m.missingGoals.length ? `Goals not found, so those to-dos stay unlinked: ${m.missingGoals.join(", ")}.` : "", m.skipped ? `${m.skipped} row${m.skipped > 1 ? "s" : ""} had no to-do text and will be skipped.` : "", m.newTags.length ? `New tags to create: ${m.newTags.join(", ")}.` : ""].filter(Boolean);
  return (
    <>
      <h1>Import to-dos</h1>
      <div className="stats" style={{ gridTemplateColumns: "repeat(3,1fr)" }}><div className="stat"><b>{nNew}</b><span>New</span></div><div className="stat"><b>{n - nNew}</b><span>Updated</span></div><div className="stat"><b>{m.same}</b><span>Unchanged</span></div></div>
      {warn.length ? <div className="panel">{warn.map((w, i) => <p key={i} className="note" style={{ margin: "3px 0" }}>{w}</p>)}</div> : null}
      {n ? <div className="panel">{m.items.slice(0, 12).map((x, i) => <div key={i} className="rv"><b>{x.r.text}</b><div className="note" style={{ margin: "2px 0 0" }}>{x.ch.join(" · ")}</div></div>)}{n > 12 ? <p className="note">…and {n - 12} more</p> : null}</div> : <p className="note">Your file matches the app already, so nothing needs to change.</p>}
      <p className="note">Nothing is deleted. Matches use the ID column first, then the to-do text plus due date.</p>
      {n || m.tags.length ? <button className="btn" onClick={() => { const r = CSV.applyTodoImport(m); onDone(); toast(`${r.nNew} added · ${r.nUp} updated`); }}>Apply {n} change{n === 1 ? "" : "s"}</button> : null}
      <button className="btn alt" style={{ marginTop: 8 }} onClick={onDone}>Cancel</button>
    </>
  );
}

export function TodoSettingsSheet() {
  useAppState(); const s = getState(), file = useRef<HTMLInputElement>(null), [imp, setImp] = useState<CSV.Preview | null>(null);
  const pick = async (f?: File | null) => {
    if (!f) return; try { const p = /\.xlsx?$/i.test(f.name) ? CSV.parseTodoSheets(await readWorkbook(f)) : CSV.parseTodoCsv(await f.text()); if (!p.todos.length) return toast("No to-dos found. Check the first row has a “To-do” column"); setImp(CSV.buildTodoImport(p)); } catch { toast(/\.xlsx?$/i.test(f.name) ? "Excel reader needs internet once. Save the sheet as CSV to import offline." : "Couldn't read that file"); }
  };
  if (imp) return <Sheet label="Import to-dos"><ImportPreview m={imp} onDone={() => setImp(null)} /></Sheet>;
  const perm = typeof Notification !== "undefined" ? Notification.permission : "unsupported";
  return (
    <Sheet label="To-do settings">
      <h1>To-do settings</h1>
      <h2>Preferences</h2>
      <div className="panel"><label className="chkrow" style={{ paddingTop: 0 }}><input type="checkbox" checked={s.settings.todoSmart !== false} onChange={(e) => { s.settings.todoSmart = e.target.checked; commit(); }} /> Smart add — understand “tomorrow 6pm”, “every month”, “#tag”, “30m”</label>
        <button className="btn alt small" style={{ marginTop: 6 }} onClick={async () => { if (perm === "unsupported") return toast("This browser can't show notifications"); const r = await Notification.requestPermission(); toast(r === "granted" ? "Notifications allowed" : "Notifications not allowed"); }}>🔔 Allow phone notifications{perm === "granted" ? " ✓" : ""}</button>
        <p className="note">Reminders always appear inside the app. Phone notifications only fire while the app is open or recently used, because a web app can't wake your phone on its own.</p></div>
      <h2>Tags</h2><TagsManager />
      <h2>Excel &amp; CSV</h2>
      <button className="list-btn" onClick={() => writeWorkbook(`todos-${todayStr()}`, [{ name: "To-do", rows: [CSV.TD_COLS, ...CSV.exportRows()] }, { name: "Tags", rows: [["Tag", "Colour", "Note"], ...s.tags.map((t: any) => [t.name, t.color, t.note || ""])] }], [CSV.TD_COLS, ...CSV.exportRows()], () => toast(`${s.todos.length} to-do${s.todos.length === 1 ? "" : "s"} exported`))}><span>Export to-dos (.xlsx)<small>Two sheets: To-do and Tags. Opens in Excel, Sheets, Notion and most tools.</small></span>›</button>
      <button className="list-btn" onClick={() => { saveText(`todos-${todayStr()}.csv`, CSV.csvText(CSV.exportRows())); toast(`${s.todos.length} to-do${s.todos.length === 1 ? "" : "s"} exported`); }}><span>Export to-dos (.csv)<small>Plain text, opens in Excel, Sheets, Notion and most tools</small></span>›</button>
      <button className="list-btn" onClick={() => file.current?.click()}><span>Import to-dos (.xlsx or .csv)<small>Add or update from a file. Nothing is deleted.</small></span>›</button>
      <button className="list-btn" onClick={() => { saveText("todos-template.csv", CSV.csvText(CSV.exampleRows())); toast("Template downloaded"); }}><span>Download a blank template<small>Shows the columns other systems should use</small></span>›</button>
      <input ref={file} type="file" accept=".csv,.xlsx,.xls,text/csv" hidden aria-label="Import to-dos file" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      <p className="note">Excel needs internet once to load its reader, then works offline. CSV always works offline.</p>
      <button className="btn alt" style={{ marginTop: 8 }} onClick={close}>Close</button>
    </Sheet>
  );
}

/** Banner for fired reminders (Home + To-do). */
export function RemindBanner() {
  const ui = useUi(), s = getState(), live = ui.alerts.map((id) => s.todos.find((x) => x.id === id)).filter((t) => t && !t.done) as any[];
  if (!live.length) return null;
  return <div className="alert" role="button" tabIndex={0} onClick={() => setUi({ tab: "todo", tf: "today", page: null })}>⏰ <b>{live.length} reminder{live.length > 1 ? "s" : ""}</b> — {live.slice(0, 2).map((t) => t.text).join(" · ")}{live.length > 2 ? ` +${live.length - 2} more` : ""}<div className="bs">Tap to see them</div></div>;
}

/** Fire a phone notification through the service worker when allowed. */
export function notifyTodos(list: { text: string }[]) {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted" || !navigator.serviceWorker) return;
    navigator.serviceWorker.ready.then((r) => r.showNotification(list.length > 1 ? `${list.length} to-do reminders` : "To-do reminder", { body: list.slice(0, 3).map((t) => t.text).join("\n"), tag: "tracker-todo" })).catch(() => {});
  } catch { /* ignore */ }
}

/** Home “+” sheet: a one-line to-do, or jump straight to adding an expense / income in Money. */
export function QuickAddSheet() {
  const [text, setText] = useState("");
  const add = () => {
    const raw = text.trim(); if (!raw) return toast("Type your to-do first");
    const t: any = O.addTodo(raw, O.emptyForm({ due: O.smartOn() ? null : todayStr() })); if (!t) return;
    if (!t.due && !t.someday) { t.due = todayStr(); commit(); }
    play("ok"); close(); toast("To-do added" + (t.due && t.due !== todayStr() ? " for " + dueLabel(t.due) : ""));
  };
  const money = (kind: "e" | "i") => {
    setUi({ sheet: null, sheetArg: null, tab: "money", page: null }); window.scrollTo(0, 0); let n = 0;
    const iv = setInterval(() => { const a = tallyApi(); n++; if (a && a.addRecord) { clearInterval(iv); if (a.addRecord(kind) === false) toast("Money is locked — unlock it, then tap +"); } else if (n > 40) { clearInterval(iv); toast("Money is still loading — tap + inside Money"); } }, 150);
  };
  return (
    <Sheet label="Quick add">
      <h1>Quick add</h1>
      <input id="hq_text" type="text" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder={O.smartOn() ? "New to-do, e.g. Call mom tomorrow 6pm" : "New to-do"} aria-label="Quick add to-do" autoComplete="off" autoFocus style={{ fontSize: 17, padding: 14 }} />
      <button className="btn" style={{ marginTop: 10 }} onClick={add}>Add to-do</button>
      <div className="btns" style={{ marginTop: 12 }}><button className="btn alt" onClick={() => money("e")}>💸 Expense</button><button className="btn alt" onClick={() => money("i")}>💰 Income</button></div>
      <div className="btns"><button className="btn alt" onClick={() => setUi({ tab: "todo", page: null, sheet: "todonew", sheetArg: null })}>Full to-do form</button><button className="btn alt" onClick={close}>Close</button></div>
    </Sheet>
  );
}
