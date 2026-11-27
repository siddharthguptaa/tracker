/** To-do CSV export / import (same columns and matching rules as the classic app's file format). */
import { getState } from "./ctx";
import { todayStr, addDays, isoOf, ts, p2, DAY } from "./clock";
import { uid } from "./format";
import { commit } from "../storage/store";
import { todoGoal, todoCat, parseRepeatText, repText } from "./todos";
import { applyForm, ensureTag, tagById } from "./todoOps";
import { parseCSV } from "./vault";

export const TD_COLS = ["ID", "To-do", "Done", "Due date", "Completed on", "Repeat", "Goal", "Category", "Tags", "Created", "Time", "Estimate (min)", "Notes", "Subtasks", "Reminder (min before)", "Someday"];
export const normName = (s: any) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const tdKey = (s: any) => String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9]/g, "");
const TD_SYN: Record<string, string[]> = { id: ["id"], text: ["todo", "task", "title", "item", "todoitem"], done: ["done", "completed", "complete", "iscompleted", "status"], due: ["duedate", "due", "deadline", "date"], doneon: ["completedon", "doneon", "completedat", "donedate", "completeddate"],
  repeat: ["repeat", "recurrence", "recurring"], goal: ["goal", "linkedgoal", "goalname", "project"], category: ["category", "list", "area"], tags: ["tags", "labels", "label"], time: ["time", "duetime", "at"], est: ["estimatemin", "estimate", "timeneeded", "minutes", "duration"],
  notes: ["notes", "note", "description", "details"], subs: ["subtasks", "checklist", "subtask", "steps"], rem: ["remindermin", "reminder", "remindermminbefore", "reminderminbefore"], someday: ["someday", "maybe"] };

export function exportRows(): any[][] {
  const s = getState();
  return s.todos.map((t) => { const g = todoGoal(t);
    return [t.id, t.text, t.done ? "Yes" : "No", t.due || "", t.doneAt ? isoOf(t.doneAt) : "", t.repeat || "", g ? g.name : "", todoCat(t), (t.tags || []).map((id) => tagById(id)?.name).filter(Boolean).join(", "), t.created ? isoOf(t.created) : "", t.time || "", t.est || "", t.notes || "", (t.subs || []).map((x) => (x.d ? "[x] " : "[ ] ") + x.t).join("\n"), t.rem != null ? t.rem : "", t.someday && !t.due ? "Yes" : ""]; });
}
export const exampleRows = (): any[][] => [["", "Call the bank about the FD rate", "No", addDays(todayStr(), 1), "", "", "Emergency Fund", "", "Calls", "", "17:30", 15, "Ask about the 1-year rate", "[ ] Find the passbook\n[ ] Note the rate", 10, ""], ["", "Read 30 minutes", "No", todayStr(), "", "daily", "", "Personal", "Habit, Evening", "", "21:00", 30, "", "", "", ""]];
const q = (v: any) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
export const csvText = (rows: any[][]) => [TD_COLS, ...rows].map((r) => r.map(q).join(",")).join("\r\n");

function toISO(v: any): string | null {
  if (v == null || v === "") return null; const s = String(v).trim();
  const m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/.exec(s); if (m) { let y = +m[3]; if (y < 100) y += 2000; return y + "-" + p2(+m[2]) + "-" + p2(+m[1]); }
  if (typeof v === "number" && v > 20000 && v < 90000) return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * DAY).toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10); const d = new Date(s); return isNaN(d.getTime()) ? null : isoOf(d.getTime());
}
const tdTrue = (v: any) => ["yes", "y", "true", "1", "done", "completed", "complete", "closed", "x", "✓"].includes(String(v == null ? "" : v).trim().toLowerCase());
const str = (v: any) => String(v == null ? "" : v).trim();

export interface ImportRow { has: Record<string, boolean>; id: string; text: string; done: boolean; due: string | null; doneOn: string | null; repeat: string; time: string | null; est: number | null; notes: string; rem: number | null; someday: boolean; subs: { id: string; t: string; d: boolean }[]; goal: string; category: string; tags: string[] }
export interface Parsed { todos: ImportRow[]; tags: { name: string; color: string; note: string }[]; skipped: number }
/** Parse already-split rows (from a CSV) into import rows; finds the header in the first 12 rows. */
export function parseTodoRows(a: any[][]): Parsed {
  const out: Parsed = { todos: [], tags: [], skipped: 0 }; let hi = -1;
  for (let i = 0; i < Math.min(a.length, 12) && hi < 0; i++) if ((a[i] || []).map(tdKey).some((k) => TD_SYN.text.includes(k))) hi = i;
  if (hi < 0) return out;
  const keys = a[hi].map(tdKey), find = (names: string[]) => keys.findIndex((k) => names.includes(k)), c: Record<string, number> = {}; Object.keys(TD_SYN).forEach((k) => { c[k] = find(TD_SYN[k]); });
  for (let r = hi + 1; r < a.length; r++) {
    const row = a[r] || [], text = str(row[c.text]); if (!text) { if (row.some((v) => v != null && v !== "")) out.skipped++; continue; }
    const val = (k: string) => (c[k] >= 0 ? row[c[k]] : undefined);
    const tv = val("time"); let time: string | null = null; if (tv != null && tv !== "") { const m = /^(\d{1,2})[:.](\d{2})\s*(am|pm)?/i.exec(str(tv)); if (m) { let h = +m[1]; if (m[3]) h = (h % 12) + (/pm/i.test(m[3]) ? 12 : 0); time = h < 24 ? p2(h) + ":" + m[2] : null; } }
    out.todos.push({ has: Object.fromEntries(Object.keys(c).map((k) => [k, c[k] >= 0])), id: str(val("id")), text, done: tdTrue(val("done")), due: toISO(val("due")), doneOn: toISO(val("doneon")), repeat: repText(parseRepeatText(str(val("repeat")))), time,
      est: Number(val("est")) > 0 ? Math.round(Number(val("est"))) : null, notes: str(val("notes")), rem: val("rem") == null || val("rem") === "" || isNaN(Number(val("rem"))) ? null : Number(val("rem")), someday: tdTrue(val("someday")),
      subs: str(val("subs")).split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => { const m = /^\[(x| )?\]\s*(.*)$/i.exec(l); return { id: uid(), t: (m ? m[2] : l).trim(), d: !!(m && m[1] && m[1].toLowerCase() === "x") }; }).filter((x) => x.t),
      goal: str(val("goal")), category: str(val("category")), tags: str(val("tags")).split(/[,;]/).map((x) => x.trim()).filter(Boolean) });
  }
  return out;
}
export const parseTodoCsv = (text: string) => parseTodoRows(parseCSV(text));

export interface ImportItem { r: ImportRow; t: any; goal: any; ch: string[] }
export interface Preview { items: ImportItem[]; same: number; skipped: number; missingGoals: string[]; newTags: string[]; tags: Parsed["tags"] }
export function buildTodoImport(p: Parsed): Preview {
  const s = getState(), items: ImportItem[] = [], missing = new Set<string>(), newTags = new Set<string>(); let same = 0; const names = new Set(s.tags.map((t) => t.name.toLowerCase()));
  p.tags.forEach((t) => { if (!names.has(t.name.toLowerCase())) newTags.add(t.name); });
  p.todos.forEach((r) => {
    let t: any = r.id ? s.todos.find((x) => x.id === r.id) : null; if (!t) t = s.todos.find((x) => normName(x.text) === normName(r.text) && (x.due || "") === (r.due || ""));
    const goal = r.goal ? s.goals.find((g) => normName(g.name) === normName(r.goal)) : null; if (r.goal && !goal) missing.add(r.goal); r.tags.forEach((n) => { if (!names.has(n.toLowerCase())) newTags.add(n); });
    const ch: string[] = [];
    if (!t) ch.push("New"); else {
      if (t.text !== r.text) ch.push("text"); if (r.has.done && !!t.done !== r.done) ch.push(r.done ? "marked done" : "reopened"); if (r.has.due && (t.due || null) !== (r.due || null)) ch.push(`due ${t.due || "none"} → ${r.due || "none"}`); if (r.has.repeat && (t.repeat || "") !== r.repeat) ch.push("repeat");
      if ((r.has.time && (t.time || null) !== r.time) || (r.has.est && (t.est || null) !== r.est) || (r.has.notes && (t.notes || "") !== r.notes) || (r.has.rem && (t.rem == null ? null : t.rem) !== r.rem) || (r.has.subs && (t.subs || []).map((x: any) => x.t).join("|") !== r.subs.map((x) => x.t).join("|"))) ch.push("details");
      if (r.has.goal && (t.goalId || null) !== (goal ? goal.id : null)) ch.push("goal");
      if (r.has.tags && (t.tags || []).map((id: string) => tagById(id)?.name.toLowerCase()).filter(Boolean).sort().join("|") !== r.tags.map((x) => x.toLowerCase()).sort().join("|")) ch.push("tags");
    }
    if (ch.length) items.push({ r, t, goal, ch }); else same++;
  });
  return { items, same, skipped: p.skipped, missingGoals: [...missing], newTags: [...newTags], tags: p.tags };
}
export function applyTodoImport(imp: Preview) {
  const s = getState(); let nNew = 0, nUp = 0;
  imp.tags.forEach((x) => { const id = ensureTag(x.name), t: any = tagById(id as string); if (t && /^#[0-9a-f]{6}$/i.test(x.color)) t.color = x.color; if (t && x.note && !t.note) t.note = x.note; });
  imp.items.forEach(({ r, t, goal }) => {
    const tagIds = r.tags.map(ensureTag).filter(Boolean) as string[], cat = goal ? "" : r.category;
    if (cat && !s.categories.some((c) => c.toLowerCase() === cat.toLowerCase())) s.categories.push(cat);
    const catName = cat ? s.categories.find((c) => c.toLowerCase() === cat.toLowerCase()) || cat : "", doneAt = r.done ? (r.doneOn ? ts(r.doneOn) + 12 * 3600 * 1000 : Date.now()) : null;
    if (!t) {
      const id = /^[a-z0-9]{6,12}$/i.test(r.id) && !s.todos.some((x) => x.id === r.id) ? r.id : uid(), n: any = { id, text: r.text, done: r.done, doneAt, due: r.due || null, goalId: goal ? goal.id : null, category: catName, repeat: r.repeat, tags: [...new Set(tagIds)], created: Date.now() };
      s.todos.push(n); applyForm(n, { time: r.due ? r.time : null, est: r.est, notes: r.notes, rem: r.due ? r.rem : null, subs: r.subs, someday: r.someday && !r.due }); nNew++;
    } else {
      t.text = r.text; if (r.has.done && !!t.done !== r.done) { t.done = r.done; t.doneAt = doneAt; } if (r.has.due) t.due = r.due || null; if (r.has.repeat) t.repeat = r.repeat;
      const f: any = {}; if (r.has.time) f.time = t.due ? r.time : null; if (r.has.est) f.est = r.est; if (r.has.notes) f.notes = r.notes; if (r.has.rem) f.rem = t.due ? r.rem : null; if (r.has.subs) f.subs = r.subs.map((x) => { const o = (t.subs || []).find((y: any) => y.t === x.t); return o ? { ...o, d: x.d } : x; }); if (r.has.someday) f.someday = r.someday && !t.due;
      applyForm(t, { ...f }); if (r.has.goal) { t.goalId = goal ? goal.id : null; if (goal) t.category = ""; } if (r.has.category && !t.goalId) t.category = catName; if (r.has.tags) t.tags = [...new Set(tagIds)]; nUp++;
    }
  });
  commit(); return { nNew, nUp };
}

/** Workbook form: every sheet is scanned; a sheet with a "To-do" header gives to-dos, one with a "Tag" header gives tags. */
export function parseTodoSheets(sheets: any[][][]): Parsed {
  const out: Parsed = { todos: [], tags: [], skipped: 0 };
  sheets.forEach((a) => {
    let tagHi = -1; for (let i = 0; i < Math.min(a.length, 12); i++) { const k = (a[i] || []).map(tdKey); if (k.some((x) => TD_SYN.text.includes(x))) { tagHi = -2; break; } if (k.includes("tag") || k.includes("tagname")) { tagHi = i; break; } }
    if (tagHi >= 0) { const keys = a[tagHi].map(tdKey), f = (n: string[]) => keys.findIndex((k) => n.includes(k)), c = { n: f(["tag", "tagname", "name"]), c: f(["colour", "color"]), note: f(["note", "notes", "description"]) };
      for (let r = tagHi + 1; r < a.length; r++) { const row = a[r] || [], nm = String(row[c.n] == null ? "" : row[c.n]).trim(); if (nm) out.tags.push({ name: nm, color: c.c >= 0 ? String(row[c.c] || "").trim() : "", note: c.note >= 0 ? String(row[c.note] || "").trim() : "" }); } return; }
    const p = parseTodoRows(a); out.todos.push(...p.todos); out.skipped += p.skipped;
  });
  return out;
}
