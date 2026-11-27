/* To-do operations ported from the classic app: form → todo, move/snooze, templates, tags, reminders, ordering. */
import { getState } from "./ctx";
import { todayStr, isoOf, addDays, mondayOf, addMonthsIso, p2 } from "./clock";
import { uid } from "./format";
import { commit } from "../storage/store";
import { parseQuick, repOf } from "./todos";
import type { Todo, Tag } from "./types";

export const TAG_COLORS = ["#6b7280", "#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#db2777", "#0d9488"];
export const T_REPS: [string, string][] = [["", "Doesn't repeat"], ["daily", "Every day"], ["weekdays", "Every weekday"], ["weekly", "Every week"], ["every 2 weeks", "Every 2 weeks"], ["monthly", "Every month"], ["yearly", "Every year"], ["custom", "Custom…"]];
export const T_ESTS = [5, 10, 15, 30, 45, 60, 90, 120, 180, 240];
export const smartOn = () => getState().settings.todoSmart !== false;

/** Values a to-do form produces (same shape the classic app's readTodoForm returned). */
export interface TodoFormValues { due: string | null; time: string | null; someday: boolean; repeat: string; goalId: string | null; category: string; tags: string[]; rem: number | null; est: number | null; notes: string; subs: { id: string; t: string; d: boolean }[]; newTags?: string }

export function applyForm(t: any, f: Partial<TodoFormValues>) {
  Object.assign(t, f); t.alerted = null; if (!t.someday) delete t.someday;
  const r = repOf(t); t.rdom = r && (r.unit === "month" || r.unit === "year") && t.due ? +t.due.slice(8) : undefined; if (t.rdom === undefined) delete t.rdom;
  ["notes", "est", "time"].forEach((k) => { if (t[k] == null || t[k] === "") delete t[k]; }); if (!t.subs || !t.subs.length) delete t.subs; if (t.rem == null) delete t.rem;
}
export function customRepeat(n: number, unit: string, fromDone: boolean): string {
  n = Math.max(1, Math.min(365, Math.floor(n) || 1));
  const base = n === 1 ? ({ day: "daily", week: "weekly", month: "monthly", year: "yearly" } as any)[unit] : `every ${n} ${unit}s`;
  return base + (fromDone ? " after completion" : "");
}
/** Finish a form: a repeat or time with no date means "today", exactly like the classic app. */
export function normalizeForm(f: TodoFormValues): TodoFormValues {
  const g = { ...f }; if (!g.due && !g.someday && (g.repeat || g.time)) g.due = todayStr();
  g.time = g.due ? g.time : null; g.rem = g.due && g.rem != null ? g.rem : null; if (g.goalId) g.category = ""; return g;
}
/** Comma-separated "new tags" typed in the form become real tags (case-insensitive de-dupe). */
export function resolveNewTags(f: TodoFormValues): TodoFormValues {
  const g = { ...f, tags: [...f.tags] };
  (g.newTags || "").split(",").forEach((n) => { const id = ensureTag(n); if (id && !g.tags.includes(id)) g.tags.push(id); });
  delete g.newTags; g.subs = g.subs.map((x) => ({ ...x, t: x.t.trim() })).filter((x) => x.t); g.notes = (g.notes || "").trim(); return g;
}
export function addTodo(text: string, form: TodoFormValues): Todo | null {
  text = text.trim(); if (!text) return null;
  const f = normalizeForm(resolveNewTags(form));
  if (smartOn()) {
    const q: any = parseQuick(text); text = q.text || text;
    if (!f.due && !f.someday && q.due) f.due = q.due; if (!f.time && q.time && f.due) f.time = q.time; if (!f.repeat && q.repeat) f.repeat = q.repeat;
    if (!f.est && q.est) f.est = q.est; if (q.tags.length) f.tags = [...new Set([...f.tags, ...q.tags])]; if (q.someday && !f.due) f.someday = true; if (f.repeat && !f.due) f.due = todayStr();
  }
  const t: any = { id: uid(), text, done: false, doneAt: null, created: Date.now() }; applyForm(t, f); getState().todos.push(t); commit(); return t;
}
export function saveTodoEdit(t: any, text: string, form: TodoFormValues): string | null {
  text = text.trim(); if (!text) return "To-do can't be empty";
  applyForm(t, { ...normalizeForm(resolveNewTags(form)), text } as any); commit(); return null;
}
export const emptyForm = (o: Partial<TodoFormValues> = {}): TodoFormValues => ({ due: null, time: null, someday: false, repeat: "", goalId: null, category: "", tags: [], rem: null, est: null, notes: "", subs: [], ...o });
export function formOf(t: any): TodoFormValues { return emptyForm({ due: t.due || null, time: t.time || null, someday: !!t.someday, repeat: t.repeat || "", goalId: t.goalId || null, category: t.category || "", tags: [...(t.tags || [])], rem: t.rem == null || t.rem === "" ? null : Number(t.rem), est: t.est || null, notes: t.notes || "", subs: (t.subs || []).map((s: any) => ({ ...s })) }); }

export type MoveKind = "later" | "tomorrow" | "week" | "month" | "inbox" | "someday" | "today" | "date";
export function moveTodos(ids: string[], kind: MoveKind, date?: string, now: Date = new Date()): number {
  const today = kind === "later" ? isoOf(now.getTime()) : todayStr(), list = getState().todos.filter((t) => ids.includes(t.id));
  list.forEach((t: any) => {
    t.alerted = null; delete t.someday;
    if (kind === "inbox") { t.due = null; delete t.time; }
    else if (kind === "someday") { t.due = null; t.someday = true; delete t.time; }
    else if (kind === "later") { const d = new Date(now.getTime() + 3 * 3600000); if (d.getHours() < 6 || d.toDateString() !== now.toDateString()) { t.due = addDays(today, 1); t.time = "09:00"; } else { t.due = today; t.time = p2(d.getHours()) + ":" + p2((Math.round(d.getMinutes() / 15) * 15) % 60); } }
    else t.due = kind === "today" ? today : kind === "tomorrow" ? addDays(today, 1) : kind === "week" ? addDays(mondayOf(today), 7) : kind === "month" ? addMonthsIso(today, 1) : date;
  });
  commit(); return list.length;
}
export function bulkDone(ids: string[]) { const L = getState().todos.filter((t) => ids.includes(t.id) && !t.done); L.forEach((t) => { t.done = true; t.doneAt = Date.now(); }); commit(); return L.length; }
export function bulkDelete(ids: string[]): Todo[] { const s = getState(), gone = s.todos.filter((t) => ids.includes(t.id)); s.todos = s.todos.filter((t) => !ids.includes(t.id)); commit(); return gone; }
export function clearDone(): Todo[] { const s = getState(), gone = s.todos.filter((t) => t.done); s.todos = s.todos.filter((t) => !t.done); commit(); return gone; }
export function restoreTodos(list: Todo[]) { getState().todos.push(...list); commit(); }

/* ---- manual order (the classic app drags; here ▲▼ swap order values, same stored `ord`) ---- */
export const ordOf = (t: any) => (t.ord != null ? t.ord : t.created || 0);
export function moveInOrder(visibleIds: string[], id: string, dir: -1 | 1) {
  const i = visibleIds.indexOf(id), j = i + dir; if (i < 0 || j < 0 || j >= visibleIds.length) return;
  const ids = visibleIds.slice(); [ids[i], ids[j]] = [ids[j], ids[i]];
  const list = ids.map((x) => getState().todos.find((t) => t.id === x)).filter(Boolean) as any[], slots = visibleIds.map((x) => ordOf(getState().todos.find((t) => t.id === x))).sort((a, b) => a - b);
  list.forEach((t, k) => { t.ord = slots[k] + (slots[k] === ordOf(t) ? 0.0001 * (k + 1) * 0 : 0); });
  // equal slots would make the swap invisible; make them strictly increasing
  for (let k = 1; k < list.length; k++) if (list[k].ord <= list[k - 1].ord) list[k].ord = list[k - 1].ord + 1;
  commit();
}

/* ---- tags ---- */
export const tagById = (id: string | null | undefined): Tag | undefined => getState().tags.find((t) => t.id === id);
export function addTag(name: string, note = "", color?: string): string | null {
  name = name.trim(); if (!name) return "Name the tag"; const s = getState();
  if (s.tags.some((t) => t.name.toLowerCase() === name.toLowerCase())) return "That tag already exists";
  s.tags.push({ id: uid(), name, color: color || TAG_COLORS[s.tags.length % TAG_COLORS.length], note: note.trim() } as any); commit(); return null;
}
export function deleteTag(id: string) { const s = getState(); s.tags = s.tags.filter((t) => t.id !== id); s.todos.forEach((x) => { x.tags = (x.tags || []).filter((i) => i !== id); }); commit(); }
export function updateTag(id: string, p: Partial<{ name: string; note: string; color: string }>): string | null {
  const t: any = tagById(id); if (!t) return "Tag not found";
  if (p.name !== undefined) { const n = p.name.trim(); if (!n) return "Tag name can't be empty"; if (getState().tags.some((x) => x.id !== id && x.name.toLowerCase() === n.toLowerCase())) return "That tag already exists"; t.name = n; }
  if (p.note !== undefined) t.note = p.note; if (p.color) t.color = p.color; commit(); return null;
}
export function ensureTag(name: string): string | null { const n = name.trim(); if (!n) return null; const s = getState(); let t = s.tags.find((x) => x.name.toLowerCase() === n.toLowerCase()); if (!t) { t = { id: uid(), name: n, color: TAG_COLORS[s.tags.length % TAG_COLORS.length], note: "" } as any; s.tags.push(t!); } return t!.id; }

/* ---- templates ---- */
export function templateCount(lines: string) { return lines.split(/\r?\n/).filter((l) => l.trim() && !/^\s*[-•*]\s+/.test(l)).length; }
export function saveTemplate(name: string, lines: string, id?: string | null): string | null {
  name = name.trim(); lines = lines.replace(/\s+$/, ""); if (!name) return "Give the template a name"; if (!lines.trim()) return "Add at least one to-do";
  const s = getState(), t = id ? s.todoTemplates.find((x) => x.id === id) : null; if (t) { t.name = name; t.lines = lines; } else s.todoTemplates.push({ id: uid(), name, lines }); commit(); return null;
}
export function deleteTemplate(id: string) { const s = getState(); s.todoTemplates = s.todoTemplates.filter((x) => x.id !== id); commit(); }
export function templateFromTodos(ids: string[]): string { return getState().todos.filter((t) => ids.includes(t.id)).map((t) => t.text + (t.subs || []).map((s) => "\n- " + s.t).join("")).join("\n"); }
export function tplCreate(tpl: { lines: string }, due: string | null): number {
  let last: any = null, n = 0; const base = Date.now(), s = getState();
  tpl.lines.split(/\r?\n/).forEach((l) => {
    if (!l.trim()) return;
    if (/^\s*[-•*]\s+/.test(l) && last) { last.subs = last.subs || []; last.subs.push({ id: uid(), t: l.replace(/^\s*[-•*]\s+/, "").trim(), d: false }); return; }
    const q: any = smartOn() ? parseQuick(l.trim()) : { text: l.trim(), due: null, time: null, tags: [], repeat: "", est: null, someday: false };
    const t: any = { id: uid(), text: q.text || l.trim(), done: false, doneAt: null, due: q.due || due || null, goalId: null, category: "", repeat: q.repeat || "", tags: q.tags || [], created: base + n };
    if (q.time) t.time = q.time; if (q.est) t.est = q.est; if (q.someday && !t.due) t.someday = true; s.todos.push(t); last = t; n++;
  });
  commit(); return n;
}

/* ---- reminders ---- */
export const dueMs = (t: any) => new Date(t.due + "T" + (t.time || "09:00") + ":00").getTime();
/** Marks newly-due reminders as alerted and returns them. */
export function checkReminders(now = Date.now()): Todo[] {
  const hit: Todo[] = [];
  getState().todos.forEach((t: any) => {
    if (t.done || !t.due || t.rem == null || t.rem === "") return;
    const at = dueMs(t) - Number(t.rem) * 60000, key = t.due + "T" + (t.time || "") + "R" + t.rem;
    if (now >= at && t.alerted !== key) { t.alerted = key; if (now - at < 36 * 3600000) hit.push(t); }
  });
  if (hit.length) commit(); return hit;
}

/* ---- calendar ---- */
export function calendarMonth(cm: string) {
  const [y, m] = cm.split("-").map(Number), start = (new Date(y, m - 1, 1).getDay() + 6) % 7, dim = new Date(y, m, 0).getDate(), by: Record<string, Todo[]> = {};
  getState().todos.forEach((t) => { if (t.due && t.due.slice(0, 7) === cm) (by[t.due] = by[t.due] || []).push(t); });
  return { y, m, start, dim, by };
}
export const shiftMonth = (cm: string, d: number) => { const [y, m] = cm.split("-").map(Number), dt = new Date(y, m - 1 + d, 1); return dt.getFullYear() + "-" + p2(dt.getMonth() + 1); };
