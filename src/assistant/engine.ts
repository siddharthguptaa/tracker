/* Offline assistant engine: pure functions over the app state + Money data. Replies are HTML strings built from escaped text. */
import { getState } from "../domain/ctx";
import { DAY, addDays, todayStr, isoOf } from "../domain/clock";
import { esc, fmt, fmtDate, uid } from "../domain/format";
import { current, pct } from "../domain/goals";
import { completeTodo, dueLabel, parseQuick } from "../domain/todos";
import { OSTAT, goalOutlook, outlookAll, outlookLabel } from "../domain/outlook";
import { todayWins } from "../domain/motivation";
import { commit, markDirty, snapState, restoreSnap } from "../storage/store";
import { mAmt, moneyChanged, readMoney, tallyBooks, tallyRaw, TALLY_BOOKS_KEY } from "../storage/moneyStore";
void isoOf; void DAY; void goalOutlook;

export interface ChatAct { id?: string; label: string; run: () => string | null }
export interface Reply { html: string; acts: ChatAct[]; pick: boolean }
export const C_MON_RE_EXPORT = 0; void C_MON_RE_EXPORT;
const C_MON = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"], C_DOW = ["sun","mon","tue","wed","thu","fri","sat"];
const C_MONRE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const C_STOP = new Set("the and for with from that this have has had was are you your mine all any can could would should want need into onto about some please kindly what how much many show tell give list my our not but now just also then than them they its it's".split(" "));
const C_SYN = {food:"food eat eating lunch dinner breakfast snack snacks meal meals restaurant swiggy zomato cafe chai tea coffee pizza biryani", grocer:"grocery groceries vegetable vegetables veggies fruit fruits milk kirana bigbasket blinkit zepto", fuel:"petrol diesel fuel cng", transport:"uber ola cab taxi metro bus train auto rickshaw flight travel toll parking", bill:"bill bills electricity recharge wifi internet broadband phone mobile water dth", rent:"rent maintenance", shop:"amazon flipkart clothes shopping shirt shoes myntra", health:"medicine medicines doctor pharmacy hospital medical gym", entertain:"movie movies netflix game games spotify prime hotstar", salary:"salary pay payroll stipend wage", educat:"course fees tuition book books school", invest:"sip mutual stock stocks shares investment"};
const C_NEEDS = /rent|emi|loan|bill|electric|water|grocer|medic|health|insur|fuel|transport|educat|school|fee|tax|maintenance|internet|phone|recharge|travel|commute/i;
const cIso = (y, m, d) => y + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0");
const cTok = s => String(s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(w => w.length >= 3 && !C_STOP.has(w));
const cSim = (a, b) => { const B = cTok(b); let n = 0; cTok(a).forEach(w => { if (B.some(x => x === w || (Math.min(x.length, w.length) >= 4 && (x.startsWith(w) || w.startsWith(x))))) n++; }); return n; };
const cCut = (s, re) => { const m = re.exec(s); if (!m) return null; return {m, s:(s.slice(0, m.index) + " " + s.slice(m.index + m[0].length)).replace(/\s+/g, " ").trim()}; };
const cMonIdx = w => C_MON.indexOf(w.slice(0, 3).toLowerCase()) + 1;
export function cDate(s) {
  const t = todayStr(); let r;
  if ((r = cCut(s, /\bday before yesterday\b/i))) return {iso:addDays(t, -2), s:r.s, found:true};
  if ((r = cCut(s, /\byesterday\b/i))) return {iso:addDays(t, -1), s:r.s, found:true};
  if ((r = cCut(s, /\b(today|tonight|just now)\b/i))) return {iso:t, s:r.s, found:true};
  if ((r = cCut(s, /\b(\d{1,3})\s+days?\s+ago\b/i))) return {iso:addDays(t, -(+r.m[1])), s:r.s, found:true};
  if ((r = cCut(s, /\b(?:last|on)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues?|wed|thu(?:rs?)?|fri|sat)\b/i))) {
    const want = C_DOW.indexOf(r.m[1].slice(0, 3).toLowerCase()), cur = new Date(t + "T00:00:00").getDay(); let back = (cur - want + 7) % 7; if (back === 0) back = 7; return {iso:addDays(t, -back), s:r.s, found:true};
  }
  const fix = (y, m, d) => { if (m < 1 || m > 12 || d < 1 || d > 31) return null; let iso = cIso(y || +t.slice(0, 4), m, d); if (!y && iso > addDays(t, 30)) iso = cIso(+t.slice(0, 4) - 1, m, d); return iso; };
  if ((r = cCut(s, new RegExp("\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+" + C_MONRE + "\\.?(?:,?\\s+(\\d{4}))?\\b", "i")))) { const iso = fix(r.m[3] ? +r.m[3] : 0, cMonIdx(r.m[2]), +r.m[1]); if (iso) return {iso, s:r.s, found:true}; }
  if ((r = cCut(s, new RegExp("\\b" + C_MONRE + "\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b", "i")))) { const iso = fix(r.m[3] ? +r.m[3] : 0, cMonIdx(r.m[1]), +r.m[2]); if (iso) return {iso, s:r.s, found:true}; }
  if ((r = cCut(s, /\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/))) { let y = r.m[3] ? +r.m[3] : 0; if (y && y < 100) y += 2000; const iso = fix(y, +r.m[2], +r.m[1]); if (iso) return {iso, s:r.s, found:true}; }
  return {iso:t, s, found:false};
}
export function cAmt(s) {
  const re = /(^|[^\w.])(₹|rs\.?|inr)?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|lakhs?|lacs?|cr|crores?|l)?(?![a-z0-9])/ig; let best = null, m;
  while ((m = re.exec(s))) {
    const n = parseFloat(m[3].replace(/,/g, "")); if (!isFinite(n)) continue;
    const mul = !m[4] ? 1 : /^k|thou/i.test(m[4]) ? 1e3 : /^cr/i.test(m[4]) ? 1e7 : 1e5, hit = {n:n * mul, i:m.index + m[1].length, len:m[0].length - m[1].length, cur:!!m[2]};
    if (!best || (hit.cur && !best.cur)) best = hit; if (hit.cur) break;
  }
  if (!best) return null; return {n:best.n, rest:(s.slice(0, best.i) + " " + s.slice(best.i + best.len)).replace(/\s+/g, " ").trim()};
}
export function cMoney() {
  const bk = tallyBooks(), b = bk.list.find(x => x.id === bk.active) || bk.list[0]; let D = null;
  try { D = JSON.parse(tallyRaw(b.key) || "null"); } catch (e) {}
  if (!D || !Array.isArray(D.records) || !Array.isArray(D.categories)) return null;
  return {key:b.key, D, book:b, multi:bk.list.length > 1, cur:(D.settings && D.settings.currency) || "₹"};
}
export function cMWrite(M: any) { localStorage.setItem(M.key, JSON.stringify(M.D)); moneyChanged(); markDirty(); }
export function cCat(words, type, cats) {
  const W = cTok(words); let best = null, bs = 0;
  cats.filter(c => !type || c.type === type).forEach(c => {
    const nm = String(c.name).toLowerCase(); let sc = cSim(words, c.name) * 3;
    Object.keys(C_SYN).forEach(k => { if (nm.includes(k)) { const al = C_SYN[k].split(" "); W.forEach(w => { if (al.includes(w)) sc += 2; }); } });
    if (sc > bs) { bs = sc; best = c; }
  });
  return best ? {c:best, score:bs} : null;
}
/* periods */
export function cPeriod(s) {
  const t = todayStr(), y = +t.slice(0, 4), mo = +t.slice(5, 7); let m;
  const mEnd = (yy, mm) => cIso(yy, mm, new Date(yy, mm, 0).getDate()), prev = (yy, mm) => mm === 1 ? [yy - 1, 12] : [yy, mm - 1];
  if (/\btoday\b/i.test(s)) return {from:t, to:t, label:"today", kind:"day"};
  if (/\byesterday\b/i.test(s)) { const d = addDays(t, -1); return {from:d, to:d, label:"yesterday", kind:"day"}; }
  if (/\blast\s+week\b/i.test(s)) { const dow = (new Date(t + "T00:00:00").getDay() + 6) % 7, st = addDays(t, -dow - 7); return {from:st, to:addDays(st, 6), label:"last week", kind:"week"}; }
  if (/\b(this|current)\s+week\b/i.test(s)) { const dow = (new Date(t + "T00:00:00").getDay() + 6) % 7; return {from:addDays(t, -dow), to:t, label:"this week", kind:"week"}; }
  if (/\blast\s+month\b/i.test(s)) { const [yy, mm] = prev(y, mo); return {from:cIso(yy, mm, 1), to:mEnd(yy, mm), label:"last month", kind:"month", prev:1}; }
  if ((m = /\b(?:last|past)\s+(\d{1,3})\s+days?\b/i.exec(s))) return {from:addDays(t, -(+m[1] - 1)), to:t, label:"the last " + m[1] + " days", kind:"range"};
  if ((m = /\b(?:last|past)\s+(\d{1,2})\s+months?\b/i.exec(s))) { let yy = y, mm = mo; for (let i = 1; i < +m[1]; i++) [yy, mm] = prev(yy, mm); return {from:cIso(yy, mm, 1), to:t, label:"the last " + m[1] + " months", kind:"range"}; }
  if (/\b(this|current)\s+year\b|\bso far this year\b/i.test(s)) return {from:cIso(y, 1, 1), to:t, label:"this year", kind:"year"};
  if (/\blast\s+year\b/i.test(s)) return {from:cIso(y - 1, 1, 1), to:cIso(y - 1, 12, 31), label:"last year", kind:"year"};
  if (/\b(overall|all time|ever|lifetime|total)\b/i.test(s) && !/this month/i.test(s)) return {from:"0000-01-01", to:"9999-12-31", label:"all time", kind:"all"};
  if ((m = new RegExp("\\b(?:in|for|during)\\s+" + C_MONRE + "(?:\\s+(\\d{4}))?\\b", "i").exec(s))) { const mm = cMonIdx(m[1]); let yy = m[2] ? +m[2] : (mm > mo ? y - 1 : y); return {from:cIso(yy, mm, 1), to:mEnd(yy, mm), label:"in " + new Date(yy, mm - 1, 1).toLocaleDateString("en-IN", {month:"long", year:"numeric"}), kind:"month"}; }
  return {from:cIso(y, mo, 1), to:t, label:"this month", kind:"month", cur:1};
}
export function cSum(D, from, to) {
  const o = {inc:0, exp:0, n:0, cat:{} as Record<string, number>, recs:[] as any[]};
  D.records.forEach(r => { if (r.d < from || r.d > to || r.t === "x") return; o.n++; o.recs.push(r); if (r.t === "i") o.inc += r.a; else if (r.t === "e") { o.exp += r.a; o.cat[r.c] = (o.cat[r.c] || 0) + r.a; } });
  return o;
}
const cNice = n => n >= 5000 ? Math.round(n / 500) * 500 : Math.round(n / 100) * 100;
const cBar = (p: number, bad?: boolean) => `<div class="cbar"><i style="width:${Math.max(2, Math.min(100, Math.round(p)))}%;${bad ? "background:var(--red)" : ""}"></i></div>`;
/* undo snapshot for assistant actions */
/* ---- actions the assistant can propose ---- */
function cMoneyAdd(raw, kind) {
  const M = cMoney(); if (!M) return A("Open the Money tab once first so your accounts and categories are set up, then ask me again.");
  const d = cDate(raw), a = cAmt(d.s); if (!a || !(a.n > 0)) return A("How much? For example: <i>“add 250 for lunch yesterday”</i> or <i>“got salary 52000”</i>.");
  const words = a.rest.replace(/\b(i|spent|spend|paid|pay|bought|buy|expense|expenses|add|added|got|get|received|earned|income|credited|credit|rupees|rs|inr|for|on|to|at|in|from|my|an?|the|of|record|log|entry|new|as|under|category|today|please)\b/gi, " ").replace(/\s+/g, " ").trim();
  const type = kind === "i" ? "income" : "expense";
  let hit = cCat(words + " " + raw, type, M.D.categories), cat = hit && hit.score >= 2 ? hit.c : null, guess = false;
  if (!cat) { cat = M.D.categories.find(c => c.type === type && /other|misc|general/i.test(c.name)) || M.D.categories.find(c => c.type === type); guess = true; }
  if (!cat) return A("I couldn't find a " + type + " category in Money. Add one in Money → Categories first.");
  const accs = M.D.accounts || [], acct = accs.map(x => ({x, s:cSim(raw, x.name)})).sort((p, q) => q.s - p.s)[0]; const ac = acct && acct.s > 0 ? acct.x : accs[0];
  if (!ac) return A("There's no account in Money yet. Add one in Money first.");
  const note = words && !(cat && cSim(words, cat.name) >= cTok(words).length && cTok(words).length) ? words.charAt(0).toUpperCase() + words.slice(1, 80) : "";
  const now = new Date(), tm = d.iso === todayStr() ? String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0") : "12:00";
  const rec = {id:uid(), t:kind, a:Math.round(a.n * 100), ac:ac.id, to:"", c:cat.id, n:note, d:d.iso, tm, cr:Date.now()};
  const html = `Add this ${kind === "i" ? "income" : "expense"}?<div class="cprev"><b>${mAmt(rec.a, M.cur)}</b> · ${esc(cat.icon || "")} ${esc(cat.name)}${guess ? " <small>(best guess)</small>" : ""}<br><small>${esc(fmtDate(rec.d))} · ${esc(ac.name)}${note ? " · “" + esc(note) + "”" : ""}${M.multi ? " · book: " + esc(M.book.name) : ""}</small></div>`;
  const mk = (c, label) => ({label, run() { const M2 = cMoney(); M2.D.records.push({...rec, c:c.id}); cMWrite(M2); return `Added ${kind === "i" ? "income" : "expense"} ${mAmt(rec.a, M.cur)} to ${esc(c.name)}.`; }});
  if (guess) {
    const use = {}; M.D.records.forEach(r => { if (r.t === kind) use[r.c] = (use[r.c] || 0) + 1; });
    const alts = M.D.categories.filter(c => c.type === type).sort((p, q) => (use[q.id] || 0) - (use[p.id] || 0)).slice(0, 4);
    return A(`I couldn't match a category for “${esc(words || raw)}”. Add <b>${mAmt(rec.a, M.cur)}</b> (${esc(fmtDate(rec.d))}, ${esc(ac.name)}) under which category?`, alts.map(c => mk(c, (c.icon || "") + " " + c.name)), true);
  }
  return A(html, [mk(cat, "Add it")]);
}
function cGoalFind(txt) { let best = null, bs = 0; getState().goals.filter(g => !g.archived).forEach(g => { const sc = cSim(txt, g.name) + cSim(txt, g.category || "") * 0.4; if (sc > bs) { bs = sc; best = g; } }); return best ? {g:best, score:bs} : null; }
function cGoalLog(raw, hit) {
  const g = hit.g, d = cDate(raw), a = cAmt(d.s);
  if (g.type === "habit") {
    if ((g.checks || []).includes(d.iso)) return A(`‘${esc(g.name)}’ is already checked for ${esc(fmtDate(d.iso))}.`);
    return A(`Check off <b>${esc(g.name)}</b> for ${esc(dueLabel(d.iso))}?`, [{label:"Check it", run() { g.checks = g.checks || []; if (!g.checks.includes(d.iso)) g.checks.push(d.iso); commit(); markDirty(); return `Checked ‘${esc(g.name)}’ for ${esc(dueLabel(d.iso))}.`; }}]);
  }
  if (g.type === "milestones") return A(`‘${esc(g.name)}’ is tracked with milestones. Say <i>“complete ${esc((g.milestones || []).filter(m => !m.done)[0] ? g.milestones.filter(m => !m.done)[0].title : "a milestone")}”</i> to tick one off.`);
  if (!a || !(a.n > 0)) return A(`How much for ‘${esc(g.name)}’? For example: <i>“add 5 to ${esc(g.name)}”</i>.`);
  const before = current(g);
  if (g.type === "level") return A(`Set the current level of <b>${esc(g.name)}</b> to <b>${esc(fmt(a.n, g.unit))}</b> (now ${esc(fmt(before, g.unit))})?`, [{label:"Update", run() { g.logs.push({id:uid(), date:d.iso, amount:a.n, note:"Added via assistant"}); commit(); markDirty(); return `Updated ‘${esc(g.name)}’ to ${esc(fmt(a.n, g.unit))}.`; }}]);
  return A(`Add <b>${esc(fmt(a.n, g.unit))}</b> to <b>${esc(g.name)}</b> (${esc(dueLabel(d.iso))})?<div class="cprev"><small>${esc(fmt(before, g.unit))} → ${esc(fmt(before + a.n, g.unit))} of ${esc(fmt(g.total, g.unit))}</small></div>`, [{label:"Add it", run() { g.logs.push({id:uid(), date:d.iso, amount:a.n, note:"Added via assistant"}); commit(); markDirty(); return `Added ${esc(fmt(a.n, g.unit))} to ‘${esc(g.name)}’ — now ${Math.round(pct(g) * 100)}% done.`; }}]);
}
function cTodoAdd(raw) {
  let txt = raw.replace(/^\s*(please\s+)?(add|create|new|make|set)?\s*(a\s+|an\s+)?(to-?do|task|reminder)\s*(to|for|:|-)?\s*/i, "").replace(/^\s*remind me\s*(to|about)?\s*/i, "").trim();
  if (!txt) return A("What should the to-do say? e.g. <i>“add todo call bank tomorrow 5pm”</i>.");
  const q = parseQuick(txt), t: any = {id:uid(), text:q.text || txt, done:false, doneAt:null, due:q.due || null, goalId:null, category:"", repeat:q.repeat || "", tags:q.tags || [], created:Date.now()};
  if (q.time) t.time = q.time; if (q.est) t.est = q.est; if (q.someday && !t.due) t.someday = true;
  return A(`Add this to-do?<div class="cprev"><b>${esc(t.text)}</b><br><small>${t.due ? esc(dueLabel(t.due)) + (t.time ? " · " + esc(t.time) : "") : t.someday ? "Someday" : "No date"}${t.repeat ? " · repeats" : ""}</small></div>`, [{label:"Add it", run() { getState().todos.push(t); commit(); markDirty(); return `To-do added${t.due ? " for " + esc(dueLabel(t.due)) : ""}.`; }}]);
}
function cDoneWhat(raw) {
  const txt = raw.replace(/^\s*(please\s+)?(mark|tick|check)?\s*(off)?\s*(as\s+)?(done|complete|completed|finish|finished|did|checked)\b\s*/i, "").replace(/\b(milestone|todo|to-do|task|as done|as complete|today)\b/ig, "").trim();
  if (!txt) return A("Which one? e.g. <i>“done call bank”</i>.");
  const cands = [];
  getState().todos.filter(t => !t.done).forEach(t => { const s = cSim(txt, t.text); if (s > 0) cands.push({s:s + 0.3, label:"To-do: " + t.text, run() { completeTodo(t); commit(); markDirty(); return `Marked “${esc(t.text)}” done. ✅`; }}); });
  getState().goals.filter(g => !g.archived).forEach(g => {
    if (g.type === "habit") { const s = cSim(txt, g.name); if (s > 0) cands.push({s:s + 0.1, label:"Habit: " + g.name, run() { g.checks = g.checks || []; const d = todayStr(); if (!g.checks.includes(d)) g.checks.push(d); commit(); markDirty(); return `Checked ‘${esc(g.name)}’ for today. 🔥`; }}); }
    (g.milestones || []).filter(m => !m.done).forEach(m => { const s = cSim(txt, m.title); if (s > 0) cands.push({s, label:"Milestone: " + m.title + " (" + g.name + ")", run() { m.done = true; m.doneDate = todayStr(); commit(); markDirty(); return `Milestone “${esc(m.title)}” done. 🎯`; }}); });
  });
  if (!cands.length) return A(`I couldn't find an open to-do, habit or milestone like “${esc(txt)}”.`);
  cands.sort((a, b) => b.s - a.s);
  if (cands.length === 1 || cands[0].s - cands[1].s >= 1) return A(`Mark as done: <b>${esc(cands[0].label)}</b>?`, [{label:"Mark done", run:cands[0].run}]);
  return A("Which one did you finish?", cands.slice(0, 4).map(c => ({label:c.label.slice(0, 48), run:c.run})), true);
}
function cDelete(raw) {
  const M = cMoney(), txt = raw.replace(/^\s*(please\s+)?(delete|remove|erase|clear)\s*/i, "").trim();
  let m;
  if ((m = /^(?:all\s+)?(?:completed|done|finished)\s+(?:to-?dos?|tasks?)$/i.exec(txt))) {
    const n = getState().todos.filter(t => t.done).length; if (!n) return A("There are no completed to-dos to clear.");
    return A(`Delete all <b>${n}</b> completed to-do${n > 1 ? "s" : ""}?`, [{label:"Delete " + n, run() { getState().todos = getState().todos.filter(t => !t.done); commit(); markDirty(); return `Deleted ${n} completed to-do${n > 1 ? "s" : ""}.`; }}]);
  }
  const recLine = r => { const c = (M.D.categories || []).find(x => x.id === r.c); return `${mAmt(r.a, M.cur)} · ${c ? esc(c.icon || "") + " " + esc(c.name) : "Transfer"} · ${esc(fmtDate(r.d))}${r.n ? " · “" + esc(String(r.n).slice(0, 40)) + "”" : ""}`; };
  const delRec = r => ({label:"Delete", run() { const M2 = cMoney(); M2.D.records = M2.D.records.filter(x => x.id !== r.id); cMWrite(M2); return "Deleted that Money record."; }});
  if ((m = /^(?:the\s+)?(last|latest|previous|recent)\s+(expense|income|record|entry|transaction|payment)s?$/i.exec(txt)) || /^(?:the\s+)?(last|latest)\s+one$/i.test(txt)) {
    if (!M) return A("There is no Money data yet.");
    const kind = m && /expense|payment/i.test(m[2]) ? "e" : m && /income/i.test(m[2]) ? "i" : null;
    const r = M.D.records.filter(x => !kind || x.t === kind).sort((p, q) => (q.cr || 0) - (p.cr || 0) || (q.d < p.d ? -1 : 1))[0];
    if (!r) return A("I couldn't find a matching record.");
    return A(`Delete your most recent ${kind === "e" ? "expense" : kind === "i" ? "income" : "record"}?<div class="cprev">${recLine(r)}</div>`, [delRec(r)]);
  }
  if ((m = /^(?:the\s+)?(?:to-?do|task)\s+(.+)$/i.exec(txt))) {
    const c = getState().todos.map(t => ({t, s:cSim(m[1], t.text)})).filter(x => x.s > 0).sort((p, q) => q.s - p.s).slice(0, 4);
    if (!c.length) return A(`No to-do matches “${esc(m[1])}”.`);
    const mk = t => ({label:"Delete", run() { getState().todos = getState().todos.filter(x => x !== t); commit(); markDirty(); return `Deleted to-do “${esc(t.text)}”.`; }});
    return c.length === 1 || c[0].s > c[1].s ? A(`Delete to-do <b>${esc(c[0].t.text)}</b>?`, [mk(c[0].t)]) : A("Which to-do?", c.map(x => ({label:x.t.text.slice(0, 44), run:mk(x.t).run})), true);
  }
  if (M) {
    const d = cDate(txt), a = cAmt(d.s), words = a ? a.rest : d.s, ct = cCat(words, null, M.D.categories);
    let c = M.D.records.filter(r => { if (a && Math.abs(r.a - Math.round(a.n * 100)) > 1) return false; if (d.found && r.d !== d.iso) return false; const cat = M.D.categories.find(x => x.id === r.c); const w = cTok(words); if (w.length) { const hay = (r.n || "") + " " + (cat ? cat.name : ""); if (!(cSim(words, hay) > 0 || (ct && ct.score >= 2 && r.c === ct.c.id))) return false; } return !!(a || d.found || w.length); });
    if (c.length) {
      c.sort((p, q) => (q.cr || 0) - (p.cr || 0)); const top = c.slice(0, 4);
      if (top.length === 1) return A(`Delete this record?<div class="cprev">${recLine(top[0])}</div>`, [delRec(top[0])]);
      return A(`I found ${c.length} matching records. Which one should I delete?`, top.map(r => ({label:recLine(r).replace(/<[^>]+>/g, "").slice(0, 52), run:delRec(r).run})), true);
    }
  }
  const t = getState().todos.map(t => ({t, s:cSim(txt, t.text)})).filter(x => x.s > 0).sort((p, q) => q.s - p.s)[0];
  if (t) return A(`Delete to-do <b>${esc(t.t.text)}</b>?`, [{label:"Delete", run() { getState().todos = getState().todos.filter(x => x !== t.t); commit(); markDirty(); return `Deleted to-do “${esc(t.t.text)}”.`; }}]);
  return A("I couldn't find that. Try <i>“delete last expense”</i>, <i>“delete 450 groceries yesterday”</i> or <i>“delete todo call bank”</i>. Goals and Vault items are deleted from their own screens for safety.");
}
/* ---- analysis ---- */
export function cMonthsAvg(D, n) {
  const t = todayStr(), mo = t.slice(0, 7), agg = {}; D.records.forEach(r => { const m = String(r.d).slice(0, 7); if (m >= mo || r.t === "x") return; const x = agg[m] = agg[m] || {i:0, e:0, cat:{}}; if (r.t === "i") x.i += r.a; else { x.e += r.a; x.cat[r.c] = (x.cat[r.c] || 0) + r.a; } });
  const ks = Object.keys(agg).sort().slice(-n); if (!ks.length) return null; const k = ks.length, cat = {};
  ks.forEach(m => Object.keys(agg[m].cat).forEach(c => { cat[c] = (cat[c] || 0) + agg[m].cat[c] / k; }));
  return {n:k, inc:ks.reduce((s, m) => s + agg[m].i, 0) / k, exp:ks.reduce((s, m) => s + agg[m].e, 0) / k, cat};
}
function cNoMoney() { return A("I don't see any Money data yet. Add a few records in the Money tab (or say <i>“add 250 food today”</i>) and I can analyse them."); }
function cSpend(raw) {
  const M = cMoney(); if (!M) return cNoMoney(); const P = cPeriod(raw), isInc = /\b(income|earn|earned|salary|received)\b/i.test(raw) && !/spend|spent/i.test(raw);
  const hit = cCat(raw, isInc ? "income" : "expense", M.D.categories), cat = hit && hit.score >= 2 ? hit.c : null;
  const S = cSum(M.D, P.from, P.to), tot = isInc ? S.inc : S.exp; let val = tot, cnt = S.recs.filter(r => r.t === (isInc ? "i" : "e")).length;
  if (cat) { const rs = S.recs.filter(r => r.c === cat.id); val = rs.reduce((s, r) => s + r.a, 0); cnt = rs.length; }
  let cmp = ""; if (P.kind === "month" && P.cur) {
    const y = +P.from.slice(0, 4), mo = +P.from.slice(5, 7), py = mo === 1 ? y - 1 : y, pm = mo === 1 ? 12 : mo - 1, day = +todayStr().slice(8), pf = cIso(py, pm, 1), pt = cIso(py, pm, Math.min(day, new Date(py, pm, 0).getDate())), PS = cSum(M.D, pf, pt);
    const pv = cat ? PS.recs.filter(r => r.c === cat.id).reduce((s, r) => s + r.a, 0) : isInc ? PS.inc : PS.exp;
    if (pv > 0) { const diff = (val - pv) / pv * 100; cmp = `<br><small>Same days last month: ${mAmt(pv, M.cur)} (${diff >= 0 ? "+" : ""}${Math.round(diff)}%)</small>`; }
  }
  const lab = cat ? esc((cat.icon || "") + " " + cat.name) : isInc ? "income" : "spending";
  let top = ""; if (!cat && !isInc && S.exp > 0) { top = "<br>" + Object.keys(S.cat).sort((a, b) => S.cat[b] - S.cat[a]).slice(0, 3).map(id => { const c = M.D.categories.find(x => x.id === id); return `${esc(c ? (c.icon || "") + " " + c.name : "Other")} ${mAmt(S.cat[id], M.cur)}`; }).join(" · "); }
  if (!cnt) return A(`No ${cat ? esc(cat.name) + " " : ""}${isInc ? "income" : "spending"} recorded ${esc(P.label)}.`);
  return A(`${isInc ? "You earned" : "You spent"} <b>${mAmt(val, M.cur)}</b>${cat ? " on " + lab : ""} ${esc(P.label)} <small>(${cnt} record${cnt > 1 ? "s" : ""})</small>.${top}${cmp}`);
}
function cBreakdown(raw) {
  const M = cMoney(); if (!M) return cNoMoney(); const P = cPeriod(raw), S = cSum(M.D, P.from, P.to); if (!S.exp) return A(`No spending recorded ${esc(P.label)}.`);
  const ids = Object.keys(S.cat).sort((a, b) => S.cat[b] - S.cat[a]).slice(0, 7), mx = S.cat[ids[0]];
  return A(`Where your money went ${esc(P.label)} — total <b>${mAmt(S.exp, M.cur)}</b>:` + ids.map(id => { const c = M.D.categories.find(x => x.id === id); return `<div class="crow"><span>${esc(c ? (c.icon || "") + " " + c.name : "Other")}</span><b>${mAmt(S.cat[id], M.cur)}</b> <small>${Math.round(S.cat[id] / S.exp * 100)}%</small></div>${cBar(S.cat[id] / mx * 100)}`; }).join("") + (S.inc ? `<small>Income ${mAmt(S.inc, M.cur)} · kept ${mAmt(S.inc - S.exp, M.cur)}</small>` : ""));
}
function cBiggest(raw) {
  const M = cMoney(); if (!M) return cNoMoney(); const P = cPeriod(raw), S = cSum(M.D, P.from, P.to), rs = S.recs.filter(r => r.t === "e").sort((a, b) => b.a - a.a).slice(0, 5);
  if (!rs.length) return A(`No spending recorded ${esc(P.label)}.`);
  return A(`Biggest expenses ${esc(P.label)}:` + rs.map(r => { const c = M.D.categories.find(x => x.id === r.c); return `<div class="crow"><span>${esc(c ? (c.icon || "") + " " + c.name : "Other")}${r.n ? " <small>" + esc(String(r.n).slice(0, 30)) + "</small>" : ""}</span><b>${mAmt(r.a, M.cur)}</b></div>`; }).join(""));
}
function cSummary() {
  const M = cMoney(), t = todayStr(), O = outlookAll(), od = getState().todos.filter(x => !x.done && x.due && x.due < t).length, tdy = getState().todos.filter(x => !x.done && x.due === t).length; let h = "<b>Your snapshot</b>";
  if (M) { const S = cSum(M.D, t.slice(0, 7) + "-01", t), rate = S.inc > 0 ? Math.round((S.inc - S.exp) / S.inc * 100) : null; h += `<div class="crow"><span>💰 This month</span><b>${mAmt(S.exp, M.cur)} spent</b></div><small>${S.inc ? "Income " + mAmt(S.inc, M.cur) + " · " : ""}${rate !== null ? "saving " + rate + "% so far" : "no income recorded yet"}</small>`; }
  if (O.n) h += `<div class="crow"><span>🔮 Goals readiness</span><b>${O.score}/100</b></div><small>${O.ahead + O.ontrack} on time · ${O.risk + O.behind + O.stalled} need help</small>`;
  h += `<div class="crow"><span>✅ To-dos</span><b>${tdy} today</b></div><small>${od ? od + " overdue" : "nothing overdue"}</small>`;
  const e = getState().engage || {}; if (e.streak) h += `<div class="crow"><span>🔥 Streak</span><b>${e.streak} day${e.streak > 1 ? "s" : ""}</b></div>`;
  return A(h);
}
function cSavings() {
  const M = cMoney(); if (!M) return cNoMoney(); const t = todayStr(), S = cSum(M.D, t.slice(0, 7) + "-01", t), av = cMonthsAvg(M.D, 3); let h = "<b>Savings</b>";
  if (S.inc || S.exp) h += `<div class="crow"><span>This month so far</span><b>${mAmt(S.inc - S.exp, M.cur)}</b></div><small>${S.inc ? Math.round((S.inc - S.exp) / S.inc * 100) + "% of income" : "no income recorded yet"}</small>`;
  if (av) h += `<div class="crow"><span>Average of last ${av.n} month${av.n > 1 ? "s" : ""}</span><b>${mAmt(av.inc - av.exp, M.cur)}</b></div><small>${av.inc ? Math.round((av.inc - av.exp) / av.inc * 100) + "% of income" : ""} · a healthy target is 20% or more</small>`;
  return A(h === "<b>Savings</b>" ? "I need at least one full month of records to work out your savings." : h);
}
function cCompare() {
  const M = cMoney(); if (!M) return cNoMoney(); const t = todayStr(), y = +t.slice(0, 4), mo = +t.slice(5, 7), py = mo === 1 ? y - 1 : y, pm = mo === 1 ? 12 : mo - 1, day = +t.slice(8);
  const a = cSum(M.D, cIso(y, mo, 1), t), b = cSum(M.D, cIso(py, pm, 1), cIso(py, pm, Math.min(day, new Date(py, pm, 0).getDate())));
  if (!a.exp && !b.exp) return A("No spending to compare yet.");
  const ids = [...new Set([...Object.keys(a.cat), ...Object.keys(b.cat)])].map(id => ({id, d:(a.cat[id] || 0) - (b.cat[id] || 0)})).sort((p, q) => Math.abs(q.d) - Math.abs(p.d)).slice(0, 4);
  return A(`First ${day} days of this month vs last month:<div class="crow"><span>Spending</span><b>${mAmt(a.exp, M.cur)}</b> <small>vs ${mAmt(b.exp, M.cur)}</small></div>` + ids.map(x => { const c = M.D.categories.find(k => k.id === x.id); return `<div class="crow"><span>${esc(c ? (c.icon || "") + " " + c.name : "Other")}</span><b class="${x.d > 0 ? "red" : "gap-ok"}">${x.d > 0 ? "+" : "−"}${mAmt(Math.abs(x.d), M.cur)}</b></div>`; }).join(""));
}
function cBudget() {
  const M = cMoney(); if (!M) return cNoMoney(); const av = cMonthsAvg(M.D, 3);
  if (!av || !(av.exp > 0)) return A("I need at least one full past month of expenses to build a budget from your real spending. Keep recording and ask again next month.");
  const O = outlookAll(), gneed = O.live.filter(o => (o.g.usesMoney === undefined ? o.g.unit === "₹" : o.g.usesMoney) && o.g.type === "total" && o.need).reduce((s, o) => s + o.need * 100, 0);
  const inc = av.inc > 0 ? av.inc : av.exp * 1.25, estimated = !(av.inc > 0);
  const cats = Object.keys(av.cat).map(id => { const c = M.D.categories.find(x => x.id === id); return {id, name:c ? c.name : "Other", icon:c ? c.icon || "" : "", avg:av.cat[id], need:c ? C_NEEDS.test(c.name) : false}; }).filter(c => c.avg > 0).sort((a, b) => b.avg - a.avg);
  const needT = cats.filter(c => c.need).reduce((s, c) => s + c.avg, 0), wantT = cats.filter(c => !c.need).reduce((s, c) => s + c.avg, 0);
  const saveT = Math.min(inc * 0.6, Math.max(inc * 0.2, gneed)), avail = inc - saveT, wantRoom = Math.max(0, avail - needT), k = wantT > 0 ? Math.min(1, wantRoom / wantT) : 1;
  const t = todayStr(), S = cSum(M.D, t.slice(0, 7) + "-01", t), rows = cats.slice(0, 8).map(c => { const lim = c.need ? cNice(c.avg * 1.0) : cNice(c.avg * k), used = S.cat[c.id] || 0, p = lim > 0 ? used / lim * 100 : 0; return {c, lim, used, p}; });
  const kept = inc - av.exp, rate = Math.round(kept / inc * 100), newRate = Math.round(saveT / inc * 100);
  let h = `<b>Suggested monthly budget</b><br><small>Built from your last ${av.n} full month${av.n > 1 ? "s" : ""}: income ${estimated ? "≈ " : ""}${mAmt(inc, M.cur)}, spending ${mAmt(av.exp, M.cur)}${estimated ? " (no income recorded, so I estimated)" : ""}.</small>`;
  h += `<div class="crow"><span>🎯 Save every month</span><b>${mAmt(saveT, M.cur)}</b> <small>${newRate}%</small></div><small>${gneed > 0 ? "Your money goals need about " + mAmt(gneed, M.cur) + " a month to finish on time; " : ""}you currently keep ${rate}%.</small>`;
  h += rows.map(r => `<div class="crow"><span>${esc(r.c.icon)} ${esc(r.c.name)} ${r.c.need ? "<small>need</small>" : ""}</span><b>${mAmt(r.lim, M.cur)}</b> <small>avg ${mAmt(r.c.avg, M.cur)}</small></div>${cBar(r.p, r.p > 100)}<small>${mAmt(r.used, M.cur)} used this month</small>`).join("");
  const cuts = rows.filter(r => !r.c.need && r.c.avg - r.lim >= 20000).sort((a, b) => (b.c.avg - b.lim) - (a.c.avg - a.lim));
  const tips = []; if (needT > avail) tips.push("Your essential spending alone is above what's left after saving — look at rent/EMI or raise income, and save what you can."); 
  if (cuts.length) tips.push("Trim " + cuts.slice(0, 2).map(r => esc(r.c.name) + " by " + mAmt(r.c.avg - r.lim, M.cur)).join(" and ") + " to reach the saving target.");
  if (rate < 20 && !cuts.length && needT <= avail) tips.push("You're close to the target already — automate the saving on salary day.");
  if (rate >= 20) tips.push("You already save " + rate + "% — nicely above the 20% rule. Keep the same limits.");
  if (cats[0] && cats[0].avg / av.exp > 0.4) tips.push(esc(cats[0].name) + " is " + Math.round(cats[0].avg / av.exp * 100) + "% of all spending — the single biggest lever.");
  return A(h + (tips.length ? "<br><b>What to do</b><ul class=\"ctips\">" + tips.map(x => "<li>" + x + "</li>").join("") + "</ul>" : "") + "<small>A guide based on your averages, not financial advice.</small>", [{label:"Set these as my Money budgets", run() { const M2 = cMoney(); M2.D.budgets = M2.D.budgets || []; rows.forEach(r => { const ex = M2.D.budgets.find(x => x.c === r.c.id && !x.m); if (ex) ex.l = r.lim; else M2.D.budgets.push({id:uid(), c:r.c.id, l:r.lim, m:""}); }); cMWrite(M2); return `Monthly budgets set for ${rows.length} categories in Money.`; }}]);
}
function cAfford(raw) {
  const M = cMoney(); if (!M) return cNoMoney(); const a = cAmt(raw); if (!a) return A("How much? e.g. <i>“can I afford 15000 this month?”</i>");
  const av = cMonthsAvg(M.D, 3), t = todayStr(), S = cSum(M.D, t.slice(0, 7) + "-01", t); if (!av) return A("I need a full past month of records to judge that.");
  const amt = a.n * 100, projInc = Math.max(av.inc, S.inc), projExp = Math.max(av.exp, S.exp), left = projInc - projExp, O = outlookAll(), gneed = O.live.filter(o => (o.g.usesMoney === undefined ? o.g.unit === "₹" : o.g.usesMoney) && o.g.type === "total" && o.need).reduce((s, o) => s + o.need * 100, 0), free = left - gneed;
  let v; if (amt <= Math.max(0, free) * 0.8) v = `Yes — comfortably. You'd still keep about <b>${mAmt(left - amt, M.cur)}</b> this month${gneed ? " and your goal savings stay funded" : ""}.`;
  else if (amt <= Math.max(0, left)) v = `Possible, but it eats into your goals: you'd keep ${mAmt(left - amt, M.cur)}, less than the ${mAmt(gneed, M.cur)} your money goals need.`;
  else { const mths = left > 0 ? Math.ceil((amt - Math.max(0, left)) / left) + 1 : null; v = `Not this month. It's more than the ${mAmt(Math.max(0, left), M.cur)} you typically keep.${mths ? " Saving normally, you could afford it in about <b>" + mths + " months</b>." : ""}`; }
  return A(`Spending <b>${mAmt(amt, M.cur)}</b>? ` + v + `<br><small>Based on typical income ${mAmt(projInc, M.cur)} and spending ${mAmt(projExp, M.cur)} a month.</small>`);
}
function cGoals() {
  const O = outlookAll(); if (!O.all.length) return A("You have no goals yet — add one in the Goals tab and I'll project where you're heading.");
  const order = {stalled:0, behind:1, risk:2, ontrack:3, ahead:4};
  return A(`<b>Future readiness ${O.score == null ? "–" : O.score}/100</b> — ${esc(outlookLabel(O.score))}` + O.live.slice(0, 5).map(o => `<div class="crow"><span>${esc(o.g.name)}</span><b>${OSTAT[o.key][0]}</b></div><small>${esc(o.tip)}</small>`).join("") + `<button class="clink" data-act="gooutlook">Open full outlook ›</button>`);
}
function cTodos(raw) {
  const t = todayStr(); let list, lab;
  if (/overdue|late/i.test(raw)) { list = getState().todos.filter(x => !x.done && x.due && x.due < t); lab = "Overdue"; }
  else if (/tomorrow/i.test(raw)) { list = getState().todos.filter(x => !x.done && x.due === addDays(t, 1)); lab = "Tomorrow"; }
  else if (/week/i.test(raw)) { list = getState().todos.filter(x => !x.done && x.due && x.due >= t && x.due <= addDays(t, 7)); lab = "Next 7 days"; }
  else if (/today|due/i.test(raw)) { list = getState().todos.filter(x => !x.done && x.due && x.due <= t); lab = "Due today & overdue"; }
  else { list = getState().todos.filter(x => !x.done); lab = "Open to-dos"; }
  list.sort((a, b) => (a.due || "9") < (b.due || "9") ? -1 : 1);
  if (!list.length) return A(`${lab}: nothing 🎉`);
  return A(`<b>${lab}</b> (${list.length})` + list.slice(0, 8).map(x => `<div class="crow"><span>${esc(x.text)}</span><small>${x.due ? esc(dueLabel(x.due)) : "No date"}</small></div>`).join("") + (list.length > 8 ? `<small>+${list.length - 8} more</small>` : ""));
}
function cFocus() {
  const O = outlookAll(), t = todayStr(), od = getState().todos.filter(x => !x.done && x.due && x.due < t), tdy = getState().todos.filter(x => !x.done && x.due === t), st = O.live.filter(o => ["stalled", "behind"].includes(o.key));
  const L = []; od.slice(0, 2).forEach(x => L.push(`Finish overdue: <b>${esc(x.text)}</b>`)); tdy.slice(0, 2).forEach(x => L.push(`Today: <b>${esc(x.text)}</b>`)); st.slice(0, 2).forEach(o => L.push(`Move <b>${esc(o.g.name)}</b> — ${esc(o.tip)}`));
  if (!todayWins()[2].d) L.push("Record today's spending in Money (30 seconds).");
  return A(L.length ? "<b>Your focus for today</b><ol class=\"ctips\">" + L.slice(0, 5).map(x => "<li>" + x + "</li>").join("") + "</ol>" : "You're all caught up — nothing urgent today. Maybe log a goal while you're here? 🌟");
}
export const C_HELP = `I work fully offline on your real data. Try:<ul class="ctips"><li><b>Add:</b> “spent 250 on lunch yesterday”, “got salary 52000”, “add todo call bank tomorrow 5pm”, “add 3 km to Run 500”</li><li><b>Budget:</b> “set food budget 5000”</li><li><b>Delete:</b> “delete last expense”, “delete 450 groceries”, “delete todo call bank”</li><li><b>Finish:</b> “done call bank”</li><li><b>Predict:</b> “forecast this month”, “predict my savings in 2 years”, “when will I finish Run 500?”, “what if I cut food by 20%?”</li><li><b>Insights:</b> “give me suggestions”, “financial health score”, “any unusual spending?”, “my subscriptions”, “spending trends”, “weekly review”, “how long would my money last?”</li><li><b>Analyse:</b> “what budget should I follow?”, “where did my money go last month?”, “am I on track?”, “can I afford 15000?”, “biggest expenses”, “compare with last month”</li></ul>I always ask before changing anything, and you can undo.`;
export function A(html: string, acts?: ChatAct[], pick?: boolean): Reply { return { html, acts: (acts || []).map((a) => ({ ...a, id: uid() })), pick: !!pick }; }
function routeV11(raw: string) {
  const s = raw.trim(), l = s.toLowerCase();
  if (!s) return null;
  if (/^(hi|hello|hey|help|\?|what can you do|how do (i|you) use)/.test(l)) return A(C_HELP);
  if (/^(thanks|thank you|ok|okay|great|cool)\b/.test(l)) return A("Anytime! 🙌");
  if (/^(delete|remove|erase|clear)\b/.test(l)) return cDelete(s);
  if (/^(please\s+)?(mark\s+|tick\s+)?(done|complete|completed|finish|finished|did|checked)\b/.test(l) || /\b(is|are)\s+(done|complete|completed|finished)$/.test(l) || /^i\s+(did|finished|completed)\b/.test(l)) return cDoneWhat(s.replace(/^i\s+/i, ""));
  if (/^(please\s+)?(add|create|new|make|set)?\s*(a\s+|an\s+)?(to-?do|task|reminder)\b/.test(l) || /^(please\s+)?remind me\b/.test(l)) return cTodoAdd(s);
  const hasNum = !!cAmt(cDate(s).s), isInc = /\b(got|received|earned|credited|salary|income|bonus|refund|cashback|interest|dividend)\b/.test(l) && !/\b(spent|paid|bought)\b/.test(l);
  if (hasNum && /^(i\s+)?(spent|spend|paid|pay|bought|buy|expense)\b/.test(l)) return cMoneyAdd(s, "e");
  if (hasNum && (isInc && /^(i\s+)?(got|received|earned|credited|salary|income|add|log|record)|\b(salary|bonus|refund|cashback)\b/.test(l)) && !/\b(how much|what|total)\b/.test(l)) return cMoneyAdd(s, "i");
  if (hasNum && /^(i\s+)?(add|log|record|put|save|saved|invest|invested|ran|read|walked|cycled|deposit|deposited|transfer|transferred)\b/.test(l)) {
    const body = s.replace(/^\s*(i\s+)?(add|log|record|put|save|saved|invest|invested|ran|read|walked|cycled|deposit|deposited|transfer|transferred)\s*/i, ""), M = cMoney(), gh = cGoalFind(body), ch = M ? cCat(body, "expense", M.D.categories) : null;
    if (/\b(expense|spent)\b/.test(l)) return cMoneyAdd(s, "e");
    if (gh && gh.score >= 1 && (!ch || gh.score * 3 >= ch.score)) return cGoalLog(s, gh);
    return cMoneyAdd(s, "e");
  }
  if (/can i (afford|spend|buy)|afford/.test(l)) return cAfford(s);
  if (/budget|50.?30.?20|how much should i (spend|save)|spending (limit|plan)|plan my (money|spending)/.test(l)) return cBudget();
  if (/(biggest|largest|highest|top)\b.*\b(expense|spend|purchase|transaction|payment)/.test(l)) return cBiggest(s);
  if (/compare|versus|\bvs\b|than last month/.test(l)) return cCompare();
  if (/where.*(money|spend|go)|breakdown|by category|categories|top (spend|categor)/.test(l)) return cBreakdown(s);
  if (/saving|saved|save rate|how much.*\bkeep\b/.test(l)) return cSavings();
  if (/(how much|total|what).*(spend|spent|expense|cost|paid|income|earn|earned|received|salary)|^(spend|spent|expenses?|income)\b/.test(l)) return cSpend(s);
  if (/what should i do|plan my day|focus|priorit|what.?s next|\bnext step\b/.test(l)) return cFocus();
  if (/\bgoal|on track|behind|outlook|future|progress|readiness|catch up/.test(l)) return cGoals();
  if (/to-?do|task|overdue|due|pending|reminder/.test(l)) return cTodos(s);
  if (/summary|overview|how am i doing|status|report|snapshot|dashboard/.test(l)) return cSummary();
  { const M = cMoney(), h = M && cCat(s, "expense", M.D.categories); if (h && h.score >= 3 && /spend|spent|cost|month|week|year|today|yesterday|total/.test(l)) return cSpend(s); }
  return A(`I didn't catch that. ${C_HELP}`);
}

/* ===================== v12: deeper analysis, predictions, smarter suggestions (all offline) ===================== */
const C_SPARK = "▁▂▃▄▅▆▇█";
const cMean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
const cSd = a => { if (a.length < 2) return 0; const m = cMean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / a.length); };
const cSlope = a => { const n = a.length; if (n < 2) return 0; const mx = (n - 1) / 2, my = cMean(a); let nu = 0, de = 0; a.forEach((v, i) => { nu += (i - mx) * (v - my); de += (i - mx) * (i - mx); }); return de ? nu / de : 0; };
const cSpark = a => { const mx = Math.max(...a), mn = Math.min(...a); return a.map(v => C_SPARK[Math.min(7, Math.max(0, Math.round((v - mn) / ((mx - mn) || 1) * 7)))]).join(""); };
const cConf = n => n >= 4 ? "good" : n >= 2 ? "moderate" : "low";
const cMonName = k => new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, 1).toLocaleDateString("en-IN", {month:"short"});
const cMonLong = k => new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, 1).toLocaleDateString("en-IN", {month:"short", year:"numeric"});
const cPct = n => (n >= 0 ? "+" : "−") + Math.abs(Math.round(n)) + "%";
export function cMonthly(D) {
  const cm = todayStr().slice(0, 7), m = {};
  D.records.forEach(r => { if (r.t === "x") return; const k = String(r.d).slice(0, 7), x = m[k] = m[k] || {i:0, e:0, cat:{}}; if (r.t === "i") x.i += r.a; else { x.e += r.a; x.cat[r.c] = (x.cat[r.c] || 0) + r.a; } });
  return {m, cm, keys:Object.keys(m).filter(k => k < cm).sort(), cur:m[cm] || {i:0, e:0, cat:{}}};
}
const cLastK = (H, n) => H.keys.slice(-n);
export function cBal(D: any): number { const b: Record<string, number> = {}; (D.accounts || []).forEach(a => { b[a.id] = Number(a.open) || 0; }); D.records.forEach(r => { const a = Number(r.a) || 0; if (r.t === "i") b[r.ac] = (b[r.ac] || 0) + a; else if (r.t === "e") b[r.ac] = (b[r.ac] || 0) - a; else if (r.t === "x") { b[r.ac] = (b[r.ac] || 0) - a; b[r.to] = (b[r.to] || 0) + a; } }); return Object.values(b).reduce((s, v) => s + v, 0); }
export function cAddM(iso, n, day) { let y = +iso.slice(0, 4), m = +iso.slice(5, 7) - 1 + n; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return cIso(y, m + 1, Math.min(day || +iso.slice(8), new Date(y, m + 1, 0).getDate())); }
export function cUpcoming(D, from, to) {
  const o = {e:0, i:0, list:[]};
  (D.recurring || []).forEach(r => { if (!r || !r.on || !(r.a > 0) || !r.next) return; const c = (D.categories || []).find(x => x.id === r.c); if (!c) return; let d = r.next, g = 0;
    while (d <= to && g < 60) { if (r.end && d > r.end) break; if (d > from) { if (c.type === "income") o.i += r.a; else o.e += r.a; o.list.push({r, d, c}); } d = r.freq === "weekly" ? addDays(d, 7) : cAddM(d, r.freq === "yearly" ? 12 : 1, r.day); g++; } });
  return o;
}
export function cHorizon(s) {
  let m = /(\d+(?:\.\d+)?)\s*(year|yr|month|mo)\w*/i.exec(s); if (m) return Math.max(1, Math.round(+m[1] * (/^y/i.test(m[2]) ? 12 : 1)));
  if (/next year|a year|one year/i.test(s)) return 12; if (/half.?year|six months/i.test(s)) return 6;
  m = new RegExp("\\bby\\s+(?:end of\\s+)?" + C_MONRE + "?\\s*(\\d{4})", "i").exec(s); if (m) { const t = todayStr(), mm = m[1] ? cMonIdx(m[1]) : 12, n = (+m[2] - +t.slice(0, 4)) * 12 + (mm - +t.slice(5, 7)); if (n > 0) return n; }
  return 12;
}
const cMonthsText = n => n % 12 === 0 && n >= 12 ? (n / 12) + " year" + (n > 12 ? "s" : "") : n + " month" + (n > 1 ? "s" : "");
const cMoneyGoals = () => outlookAll().live.filter(o => (o.g.usesMoney === undefined ? o.g.unit === "₹" : o.g.usesMoney) && o.g.type === "total" && o.need);
/* ---- 1. month-end forecast ---- */
export function cForecast() {
  const M = cMoney(); if (!M) return cNoMoney(); const D = M.D, t = todayStr(), H = cMonthly(D), L = cLastK(H, 6), cur = H.cur;
  const dim = new Date(+t.slice(0, 4), +t.slice(5, 7), 0).getDate(), d = +t.slice(8), rem = dim - d, endIso = t.slice(0, 7) + "-" + String(dim).padStart(2, "0");
  if (!L.length && !cur.e) return A("I need a few days of records before I can forecast. Add some expenses and ask again.");
  const expH = L.map(k => H.m[k].e), incH = L.map(k => H.m[k].i), avgE = cMean(expH), avgI = cMean(incH), sdE = expH.length > 1 ? cSd(expH) : avgE * 0.15, up = cUpcoming(D, t, endIso);
  const runRem = d > 0 ? cur.e / d * rem : 0, histRem = avgE * rem / dim, w = L.length ? Math.max(0.2, 1 - d / dim) : 0, varRem = w * histRem + (1 - w) * runRem;
  const expF = Math.max(cur.e + varRem, cur.e + up.e), band = sdE * Math.sqrt(rem / dim);
  const incKnown = cur.i + up.i, incF = avgI > 0 && incKnown < 0.85 * avgI ? avgI : incKnown, incNote = avgI > 0 && incKnown < 0.85 * avgI;
  const bud = (D.budgets || []).filter(b => b && b.l > 0 && (!b.m || b.m === H.cm)).reduce((s, b) => s + b.l, 0), sav = incF - expF;
  let h = `<b>This month's forecast</b> <small>(day ${d} of ${dim})</small>`;
  h += `<div class="crow"><span>So far</span><b>${mAmt(cur.e, M.cur)}</b></div>`;
  h += `<div class="crow"><span>📈 Expected spending by month-end</span><b>${mAmt(expF, M.cur)}</b></div><small>Likely range ${mAmt(Math.max(cur.e, expF - band), M.cur)} – ${mAmt(expF + band, M.cur)}${up.e ? " · includes " + mAmt(up.e, M.cur) + " of scheduled payments" : ""}</small>`;
  if (avgE) { const df = (expF - avgE) / avgE * 100; h += `<div class="crow"><span>vs your usual (${mAmt(avgE, M.cur)})</span><b class="${df > 10 ? "red" : df < -5 ? "gap-ok" : ""}">${cPct(df)}</b></div>`; }
  if (bud) h += `<div class="crow"><span>vs your Money budgets (${mAmt(bud, M.cur)})</span><b class="${expF > bud ? "red" : "gap-ok"}">${expF > bud ? "over by " + mAmt(expF - bud, M.cur) : "within budget"}</b></div>`;
  if (incF) h += `<div class="crow"><span>💰 Expected savings</span><b class="${sav >= 0 ? "gap-ok" : "red"}">${mAmt(sav, M.cur)}</b></div><small>${incNote ? "Assumes your usual income of " + mAmt(avgI, M.cur) + " still arrives. " : ""}${sav > 0 ? Math.round(sav / incF * 100) + "% of income" : ""}</small>`;
  const tips = []; if (rem > 0 && avgE && cur.e < avgE) tips.push(`To finish at your usual level you can spend about <b>${mAmt((avgE - cur.e) / rem, M.cur)}</b> a day for the next ${rem} days.`);
  if (avgE && cur.e > avgE) tips.push("You've already spent more than a usual full month — hold non-essential purchases until next month.");
  else if (bud && expF > bud) tips.push(`At this pace you'd exceed budget by ${mAmt(expF - bud, M.cur)}; about ${mAmt((expF - bud) / Math.max(1, rem), M.cur)} less per day fixes it.`);
  if (tips.length) h += "<ul class=\"ctips\">" + tips.map(x => "<li>" + x + "</li>").join("") + "</ul>";
  return A(h + `<small>Confidence: ${cConf(L.length)} (${L.length} past month${L.length === 1 ? "" : "s"} of history).</small>`);
}
/* ---- 2. savings / balance projection ---- */
export function cSaveProj(raw) {
  const M = cMoney(); if (!M) return cNoMoney(); const D = M.D, H = cMonthly(D), L = cLastK(H, 6), n = cHorizon(raw);
  if (!L.length) return A("I need at least one full past month of income and spending to project your savings.");
  const net = L.map(k => H.m[k].i - H.m[k].e), avgN = cMean(net), sdN = cSd(net), avgE = cMean(L.map(k => H.m[k].e)), bal = cBal(D), end = bal + avgN * n, band = sdN * Math.sqrt(n);
  let h = `<b>Where you'll be in ${cMonthsText(n)}</b><div class="crow"><span>Balance today</span><b>${mAmt(bal, M.cur)}</b></div><div class="crow"><span>Typical monthly saving</span><b class="${avgN >= 0 ? "gap-ok" : "red"}">${mAmt(avgN, M.cur)}</b></div>`;
  h += `<div class="crow"><span>📍 Projected balance</span><b>${mAmt(end, M.cur)}</b></div><small>Likely range ${mAmt(end - band, M.cur)} – ${mAmt(end + band, M.cur)} · if nothing changes</small>`;
  if (avgN > 0) {
    const e10 = end + avgE * 0.1 * n, r = 0.08 / 12, fv = bal > 0 || avgN > 0 ? Math.max(0, bal) * Math.pow(1 + r, n) + avgN * (Math.pow(1 + r, n) - 1) / r : end;
    h += `<div class="crow"><span>✂️ Cut spending by 10%</span><b>${mAmt(e10, M.cur)}</b></div><small>+${mAmt(avgE * 0.1 * n, M.cur)} extra</small>`;
    if (n >= 6) h += `<div class="crow"><span>📊 If invested at 8% a year*</span><b>${mAmt(fv, M.cur)}</b></div><small>*an assumption, not a promise — returns vary and can be negative</small>`;
  } else h += `<ul class="ctips"><li>You currently spend ${avgN < 0 ? "more than you earn" : "everything you earn"}${bal > 0 && avgN < 0 ? " — your balance would last about <b>" + Math.floor(bal / -avgN) + " months</b>" : ""}. Use <i>“what budget should I follow?”</i> to fix the gap.</li></ul>`;
  const mg = cMoneyGoals(), need = mg.reduce((s, o) => s + o.need * 100, 0);
  if (need > 0) h += `<small>Your money goals need ${mAmt(need, M.cur)} a month; your typical saving covers ${Math.round(Math.max(0, avgN) / need * 100)}% of that.</small>`;
  return A(h + `<br><small>Confidence: ${cConf(L.length)} (${L.length} month${L.length === 1 ? "" : "s"} of data). Projections assume your income and spending stay as they are.</small>`);
}
/* ---- 3. goal ETA with scenarios ---- */
function cEta(raw) {
  const hit = cGoalFind(raw.replace(/\b(when|will|can|i|finish|complete|reach|achieve|hit|make|my|goal|eta|how|long|does|take|to)\b/gi, " "));
  if (!hit || hit.score < 1) {
    const O = outlookAll(); if (!O.live.length) return A("You have no active goals with progress yet. Add one in Goals and log some progress.");
    return A("<b>When will each goal finish?</b>" + O.live.map(o => { const when = o.finish ? new Date(o.finish).toLocaleDateString("en-IN", {month:"short", year:"numeric"}) : "—"; return `<div class="crow"><span>${esc(o.g.name)}</span><b>${o.finish ? when : OSTAT[o.key][0]}</b></div><small>deadline ${esc(fmtDate(o.g.end))} · ${OSTAT[o.key][0]}${o.late > 0 ? " · " + o.late + " mo late" : ""}</small>`; }).join("") + "<br><small>Name a goal for pace scenarios, e.g. <i>“when will I finish Run 500?”</i></small>");
  }
  const g = hit.g, o = goalOutlook(g), p = Math.round(pct(g) * 100);
  let h = `<b>${esc(g.name)}</b> — ${p}% done, ${OSTAT[o.key][0].toLowerCase()}`;
  if (o.key === "done") return A(h + ". 🎉 Completed!");
  if (g.type === "total" || g.type === "level") {
    const dir = g.type === "level" && g.total < g.baseline ? -1 : 1, rem = Math.max(0, dir * (g.total - current(g))), have: number = o.have || 0, need: number = o.need || 0, dt = (ms: number) => new Date(ms).toLocaleDateString("en-IN", {month:"short", year:"numeric"});
    h += `<div class="crow"><span>Remaining</span><b>${esc(fmt(rem, g.unit))}</b></div><div class="crow"><span>Your pace</span><b>${esc(fmt(Math.round(have * 10) / 10, g.unit))}/month</b></div><div class="crow"><span>Needed to hit ${esc(fmtDate(g.end))}</span><b>${esc(fmt(Math.round(need * 10) / 10, g.unit))}/month</b></div>`;
    if (have > 0) { const base = rem / have; h += `<br><b>If you…</b>` + [[1, "keep this pace"], [1.25, "go 25% faster"], [1.5, "go 50% faster"]].map(([f, l]: any[]) => `<div class="crow"><span>${l}</span><b>${dt(Date.now() + rem / (have * f) * 30.44 * DAY)}</b></div>${f > 1 ? `<small>${(base - base / f).toFixed(1)} months sooner</small>` : ""}`).join(""); }
    else h += `<ul class="ctips"><li>No recent progress to project from — log something this week to get a forecast.</li></ul>`;
  }
  return A(h + `<ul class="ctips"><li>${esc(o.tip)}</li></ul>`);
}
/* ---- 4. what-if ---- */
function cWhatIf(raw) {
  const M = cMoney(); if (!M) return cNoMoney(); const D = M.D, H = cMonthly(D), L = cLastK(H, 6); if (!L.length) return A("I need at least one full past month of data to test what-ifs.");
  const l = raw.toLowerCase(), pc: any = /(\d+(?:\.\d+)?)\s*%/.exec(raw), a = cAmt(raw.replace(/(\d+(?:\.\d+)?)\s*%/, " ")), avgE = cMean(L.map(k => H.m[k].e)), avgI = cMean(L.map(k => H.m[k].i)), avgN = avgI - avgE;
  const cat = (() => { const h = cCat(raw, "expense", D.categories); return h && h.score >= 2 ? h.c : null; })(), catAvg = cat ? cMean(L.map(k => H.m[k].cat[cat.id] || 0)) : 0;
  let delta = 0, what = "";
  if (/(income|salary|earn|raise|hike|bonus)/.test(l) && !/cut|reduce|less/.test(l)) { delta = pc ? avgI * pc[1] / 100 : a ? a.n * 100 : 0; what = "earning " + (pc ? pc[1] + "% more" : mAmt(delta, M.cur) + " more"); }
  else if (/(cut|reduce|lower|less|decrease|trim|skip|stop|halve)/.test(l)) { const base = cat ? catAvg : avgE; delta = pc ? base * pc[1] / 100 : /halve/.test(l) ? base / 2 : a ? Math.min(a.n * 100, base) : 0; what = "spending " + (pc ? pc[1] + "% less" : mAmt(delta, M.cur) + " less") + (cat ? " on " + (cat.icon || "") + " " + cat.name : ""); }
  else if (/(save|saving|invest|put aside|set aside|extra)/.test(l)) { delta = pc ? avgI * pc[1] / 100 : a ? a.n * 100 : 0; what = "saving " + mAmt(delta, M.cur) + " more a month"; }
  if (!(delta > 0)) return A("By how much? Try <i>“what if I save 5000 more”</i>, <i>“what if I cut food by 20%”</i>, <i>“what if I spend 2000 less on shopping”</i> or <i>“what if my income rises 10%”</i>.");
  const newN = avgN + delta;
  let h = `<b>What if you were ${esc(what)}?</b><div class="crow"><span>Monthly saving</span><b>${mAmt(avgN, M.cur)} → ${mAmt(newN, M.cur)}</b></div><div class="crow"><span>After 1 year</span><b class="gap-ok">+${mAmt(delta * 12, M.cur)}</b></div><div class="crow"><span>After 5 years</span><b class="gap-ok">+${mAmt(delta * 60, M.cur)}</b></div>`;
  const mg = cMoneyGoals().sort((p, q) => p.like - q.like)[0];
  if (mg) {
    const g = mg.g, rem = Math.max(0, g.total - current(g)), have = mg.have || 0, dt = ms => new Date(ms).toLocaleDateString("en-IN", {month:"short", year:"numeric"}), extra = delta / 100;
    if (rem > 0) h += `<br><b>Effect on ${esc(g.name)}</b>` + (have > 0 ? `<div class="crow"><span>Finish date</span><b>${dt(Date.now() + rem / have * 30.44 * DAY)} → ${dt(Date.now() + rem / (have + extra) * 30.44 * DAY)}</b></div>` : `<div class="crow"><span>Finish date</span><b>${dt(Date.now() + rem / extra * 30.44 * DAY)}</b></div>`) + `<small>If the whole extra goes into this goal (deadline ${esc(fmtDate(g.end))}).</small>`;
  }
  return A(h + "<small>Based on your last " + L.length + " month" + (L.length > 1 ? "s" : "") + " of averages.</small>");
}
/* ---- 5. trends ---- */
function cTrends(raw) {
  const M = cMoney(); if (!M) return cNoMoney(); const D = M.D, H = cMonthly(D), L = cLastK(H, 6); if (L.length < 2) return A("I need at least two full past months to see a trend. Keep recording and ask again next month.");
  const hit = cCat(raw, "expense", D.categories), cat = hit && hit.score >= 2 ? hit.c : null, ex = L.map(k => cat ? (H.m[k].cat[cat.id] || 0) : H.m[k].e), inc = L.map(k => H.m[k].i);
  const sl = cSlope(ex), mean = cMean(ex), rel = mean ? sl / mean * 100 : 0, dir = rel > 4 ? "rising 📈" : rel < -4 ? "falling 📉" : "steady ➖";
  let h = `<b>${cat ? esc((cat.icon || "") + " " + cat.name) : "Spending"} trend</b> — ${dir} <small>(${cPct(rel)} per month)</small><div class="crow"><span style="font-size:20px;letter-spacing:2px">${cSpark(ex)}</span><small>${esc(cMonName(L[0]))} → ${esc(cMonName(L[L.length - 1]))}</small></div>`;
  h += `<small>${L.map((k, i) => cMonName(k) + " " + mAmt(ex[i], M.cur)).join(" · ")}</small>`;
  if (!cat && cMean(inc) > 0) { const si = cSlope(inc) / cMean(inc) * 100; h += `<div class="crow"><span>Income trend</span><b>${si > 4 ? "rising 📈" : si < -4 ? "falling 📉" : "steady ➖"}</b></div>`; if (rel > si + 4) h += `<ul class="ctips"><li>Your spending is growing faster than your income — the gap that funds your goals is shrinking.</li></ul>`; }
  if (!cat && L.length >= 4) {
    const a = L.slice(-3), b = L.slice(-6, -3), ids = [...new Set([].concat(...L.map(k => Object.keys(H.m[k].cat))))], tot = cMean(L.map(k => H.m[k].e));
    const ch = ids.map(id => { const x = cMean(a.map(k => H.m[k].cat[id] || 0)), y = cMean(b.map(k => H.m[k].cat[id] || 0)); return {id, x, y, d:x - y, p:y ? (x - y) / y * 100 : 100}; }).filter(c => Math.max(c.x, c.y) >= tot * 0.04);
    const nm = id => { const c = D.categories.find(k => k.id === id); return esc(c ? (c.icon || "") + " " + c.name : "Other"); };
    const up = ch.filter(c => c.d > 0).sort((p, q) => q.d - p.d).slice(0, 2), dn = ch.filter(c => c.d < 0).sort((p, q) => p.d - q.d).slice(0, 2);
    if (up.length) h += "<br><b>Growing</b>" + up.map(c => `<div class="crow"><span>${nm(c.id)}</span><b class="red">${cPct(c.p)}</b></div><small>${mAmt(c.y, M.cur)} → ${mAmt(c.x, M.cur)} a month</small>`).join("");
    if (dn.length) h += "<br><b>Shrinking</b>" + dn.map(c => `<div class="crow"><span>${nm(c.id)}</span><b class="gap-ok">${cPct(c.p)}</b></div><small>${mAmt(c.y, M.cur)} → ${mAmt(c.x, M.cur)} a month</small>`).join("");
  }
  return A(h);
}
/* ---- 6. unusual spending ---- */
function cAnomalies() {
  const M = cMoney(); if (!M) return cNoMoney(); const D = M.D, t = todayStr(), since = addDays(t, -90), H = cMonthly(D), L = cLastK(H, 3), out = [], byCat = {};
  D.records.filter(r => r.t === "e").forEach(r => (byCat[r.c] = byCat[r.c] || []).push(r));
  const nm = id => { const c = D.categories.find(k => k.id === id); return esc(c ? (c.icon || "") + " " + c.name : "Other"); };
  Object.keys(byCat).forEach(id => { const arr = byCat[id]; if (arr.length < 5) return; arr.filter(r => r.d >= since).forEach(r => { const oth = arr.filter(x => x !== r).map(x => x.a), mu = cMean(oth), sd = cSd(oth); if (r.a > mu + 2.5 * sd && r.a > 1.8 * mu && r.a >= 20000) out.push({p:2, t:`${nm(id)} ${mAmt(r.a, M.cur)} on ${esc(fmtDate(r.d))}${r.n ? " (“" + esc(String(r.n).slice(0, 28)) + "”)" : ""} is <b>${(r.a / mu).toFixed(1)}×</b> your usual ${mAmt(mu, M.cur)} there.`}); }); });
  const seen: Record<string, any[]> = {}; D.records.filter(r => r.t === "e" && r.d >= addDays(t, -60)).forEach(r => { const k = [r.d, r.a, r.c, r.n || ""].join("|"); (seen[k] = seen[k] || []).push(r); });
  Object.values(seen).filter(a => a.length > 1).slice(0, 3).forEach(a => out.push({p:1, t:`Possible duplicate: ${nm(a[0].c)} ${mAmt(a[0].a, M.cur)} recorded ${a.length}× on ${esc(fmtDate(a[0].d))}.`}));
  if (L.length >= 2 && +t.slice(8) >= 10) Object.keys(H.cur.cat).forEach(id => { const avg = cMean(L.map(k => H.m[k].cat[id] || 0)); if (avg > 0 && H.cur.cat[id] > avg * 1.25 && H.cur.cat[id] >= 50000) out.push({p:3, t:`${nm(id)} is already <b>${mAmt(H.cur.cat[id], M.cur)}</b> this month — ${cPct((H.cur.cat[id] - avg) / avg * 100)} above its usual full-month ${mAmt(avg, M.cur)}.`}); });
  out.sort((p, q) => q.p - p.p);
  return A(out.length ? `<b>Worth a look (${out.length})</b><ul class="ctips">` + out.slice(0, 6).map(x => "<li>" + x.t + "</li>").join("") + "</ul><small>Checked the last 90 days against your own normal. Delete duplicates with <i>“delete last expense”</i>.</small>" : "Nothing unusual — no spikes, duplicates or categories running well above normal. 👍");
}
/* ---- 7. subscriptions / recurring ---- */
function cSubs() {
  const M = cMoney(); if (!M) return cNoMoney(); const D = M.D, t = todayStr(), rows = [], nm = id => { const c = D.categories.find(k => k.id === id); return c ? (c.icon || "") + " " + c.name : "Other"; };
  (D.recurring || []).filter(r => r && r.on && r.a > 0).forEach(r => { const c = D.categories.find(x => x.id === r.c); if (!c || c.type === "income") return; rows.push({name:r.name || c.name, m:r.freq === "weekly" ? r.a * 4.33 : r.freq === "yearly" ? r.a / 12 : r.a, how:(r.freq === "yearly" ? "yearly" : r.freq === "weekly" ? "weekly" : "monthly") + " · scheduled"}); });
  const g: Record<string, any> = {}; D.records.filter(r => r.t === "e" && r.d >= addDays(t, -180)).forEach(r => { const key = r.c + "|" + Math.round(r.a / 100) + "|" + cTok(r.n || "").slice(0, 2).join(" "); const x = g[key] = g[key] || {r, months:new Set(), n:0}; x.months.add(String(r.d).slice(0, 7)); x.n++; });
  Object.values(g).filter(x => x.months.size >= 3 && x.n <= x.months.size * 1.5).forEach(x => { const nmx = (x.r.n || nm(x.r.c)); if (!rows.some(y => Math.abs(y.m - x.r.a) < 100 && y.name.toLowerCase() === String(nmx).toLowerCase())) rows.push({name:nmx, m:x.r.a, how:"looks recurring · seen in " + x.months.size + " months"}); });
  if (!rows.length) return A("I don't see any recurring or scheduled payments yet. Add them under Money → Recurring (or repeat entries) and I'll track the monthly total.");
  rows.sort((a, b) => b.m - a.m); const tot = rows.reduce((s, r) => s + r.m, 0), H = cMonthly(D), avgE = cMean(cLastK(H, 3).map(k => H.m[k].e));
  return A(`<b>Recurring payments</b> — about <b>${mAmt(tot, M.cur)}</b> a month (${mAmt(tot * 12, M.cur)} a year)` + rows.slice(0, 8).map(r => `<div class="crow"><span>${esc(String(r.name).slice(0, 32))}</span><b>${mAmt(r.m, M.cur)}</b></div><small>${esc(r.how)}</small>`).join("") + `<ul class="ctips"><li>${avgE ? "That's " + Math.round(tot / avgE * 100) + "% of your monthly spending. " : ""}Cancel or downgrade the ones you haven't used in the last month — it's the easiest saving there is.</li></ul>`);
}
/* ---- 8. spending patterns ---- */
function cPatterns() {
  const M = cMoney(); if (!M) return cNoMoney(); const D = M.D, t = todayStr(), days = 90, since = addDays(t, -(days - 1)), rs = D.records.filter(r => r.t === "e" && r.d >= since);
  if (rs.length < 8) return A("I need a few more expenses (at least 8 in the last 3 months) to see your patterns.");
  const first = rs.reduce((m, r) => r.d < m ? r.d : m, t), span = Math.max(14, Math.round((new Date(t).getTime() - new Date(first).getTime()) / DAY) + 1), dw = [0, 0, 0, 0, 0, 0, 0], cnt = [0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < span; i++) cnt[new Date(addDays(t, -i) + "T00:00:00").getDay()]++;
  rs.forEach(r => { dw[new Date(r.d + "T00:00:00").getDay()] += r.a; });
  const avgD = dw.map((v, i) => cnt[i] ? v / cnt[i] : 0), tot = rs.reduce((s, r) => s + r.a, 0), daily = tot / span, names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], mx = Math.max(...avgD), hi = avgD.indexOf(mx), lo = avgD.indexOf(Math.min(...avgD));
  const wk = (dw[0] + dw[6]) / tot * 100, early = rs.filter(r => +r.d.slice(8) <= 10).reduce((s, r) => s + r.a, 0) / tot * 100;
  let h = `<b>Your spending pattern</b> <small>(last ${span} days)</small><div class="crow"><span>Average per day</span><b>${mAmt(daily, M.cur)}</b></div>`;
  h += avgD.map((v, i) => `<div class="crow"><span>${names[i]}</span><small>${mAmt(v, M.cur)}</small></div>${cBar(mx ? v / mx * 100 : 0, i === hi)}`).join("");
  const tips = [`<b>${names[hi]}</b> is your priciest day — ${cPct((mx - daily) / daily * 100)} vs your daily average. ${names[lo]} is your lightest.`, `Weekends make up <b>${Math.round(wk)}%</b> of spending (${Math.round(2 / 7 * 100)}% would be even).`];
  if (early > 45) tips.push(`${Math.round(early)}% of your spending lands in the first 10 days of the month — plan a weekly cap so late-month isn't a squeeze.`);
  return A(h + "<ul class=\"ctips\">" + tips.map(x => "<li>" + x + "</li>").join("") + "</ul>");
}
/* ---- 9. runway / emergency cover ---- */
function cRunway() {
  const M = cMoney(); if (!M) return cNoMoney(); const D = M.D, H = cMonthly(D), L = cLastK(H, 6); if (!L.length) return A("I need at least one full past month of spending to calculate your runway.");
  const bal = cBal(D), avgE = cMean(L.map(k => H.m[k].e)), avgN = cMean(L.map(k => H.m[k].i - H.m[k].e)), ess = cMean(L.map(k => Object.keys(H.m[k].cat).filter(id => { const c = D.categories.find(x => x.id === id); return c && C_NEEDS.test(c.name); }).reduce((s, id) => s + H.m[k].cat[id], 0)));
  const mo = avgE > 0 ? bal / avgE : 0, moE = ess > 0 ? bal / ess : 0, target = avgE * 6, gap = Math.max(0, target - bal), fill = gap > 0 && avgN > 0 ? Math.ceil(gap / avgN) : 0;
  let h = `<b>Your safety cushion</b><div class="crow"><span>Balance across accounts</span><b>${mAmt(bal, M.cur)}</b></div><div class="crow"><span>Covers your full spending for</span><b class="${mo >= 6 ? "gap-ok" : mo < 3 ? "red" : ""}">${mo.toFixed(1)} months</b></div>${cBar(Math.min(100, mo / 6 * 100), mo < 3)}`;
  if (ess > 0) h += `<div class="crow"><span>Covers essentials only for</span><b>${moE.toFixed(1)} months</b></div>`;
  h += `<small>Goal: 6 months = ${mAmt(target, M.cur)}.</small><ul class="ctips">`;
  h += gap > 0 ? `<li>You're ${mAmt(gap, M.cur)} short of 6 months${fill ? " — about <b>" + fill + " months</b> of saving at your current pace" : ""}.</li>` : "<li>You've reached 6 months of cover — excellent. Extra savings can go to your goals or investments.</li>";
  if (mo < 3) h += "<li>Under 3 months is thin: build this first before taking on stretch goals.</li>";
  return A(h + "</ul>");
}
/* ---- 10. financial health score ---- */
export function cHealthParts() {
  const M = cMoney(), parts = []; if (!M) return {parts, score:null, M};
  const D = M.D, H = cMonthly(D), L = cLastK(H, 6);
  if (L.length) {
    const inc = cMean(L.map(k => H.m[k].i)), exp = cMean(L.map(k => H.m[k].e)), rate = inc > 0 ? (inc - exp) / inc : null;
    if (rate !== null) parts.push({k:"Savings rate", w:30, s:Math.max(0, Math.min(100, rate / 0.2 * 100)), d:Math.round(rate * 100) + "% of income (target 20%+)"});
    const mo = exp > 0 ? cBal(D) / exp : 0; parts.push({k:"Safety cushion", w:20, s:Math.max(0, Math.min(100, mo / 6 * 100)), d:mo.toFixed(1) + " months of spending (target 6)"});
    const ex = L.map(k => H.m[k].e); if (ex.length >= 3) { const rel = cMean(ex) ? cSlope(ex) / cMean(ex) * 100 : 0; parts.push({k:"Spending trend", w:15, s:Math.max(0, Math.min(100, 100 - Math.max(0, rel) * 8)), d:rel > 4 ? "rising " + Math.round(rel) + "% a month" : "stable or falling"}); }
    const bud = (D.budgets || []).filter(b => b && b.l > 0 && (!b.m || b.m === H.cm)); if (bud.length) { const ok = bud.filter(b => (H.cur.cat[b.c] || 0) <= b.l).length; parts.push({k:"Budget discipline", w:15, s:ok / bud.length * 100, d:ok + " of " + bud.length + " budgets on track"}); }
  }
  const O = outlookAll(); if (O.n) parts.push({k:"Goal progress", w:20, s:O.score, d:O.ahead + O.ontrack + " of " + O.n + " goals on time"});
  const W = parts.reduce((s, p) => s + p.w, 0); return {parts, score:W ? Math.round(parts.reduce((s, p) => s + p.s * p.w, 0) / W) : null, M};
}
function cHealth() {
  const {parts, score, M} = cHealthParts(); if (score === null) return A("I need some Money records and goals to score your overall health. Keep adding data and ask again.");
  const lab = score >= 80 ? "Excellent" : score >= 60 ? "Good" : score >= 40 ? "Needs attention" : "At risk", worst = parts.slice().sort((a, b) => a.s - b.s)[0];
  return A(`<b>Financial health: ${score}/100</b> — ${lab}${cBar(score, score < 40)}` + parts.map(p => `<div class="crow"><span>${p.k}</span><b>${Math.round(p.s)}</b></div>${cBar(p.s, p.s < 40)}<small>${esc(p.d)}</small>`).join("") + `<ul class="ctips"><li>Biggest lever: <b>${worst.k.toLowerCase()}</b> (${esc(worst.d)}). Ask <i>“give me suggestions”</i> for specific steps.</li></ul>`);
}
/* ---- 11. smart suggestions (also shown in Outlook) ---- */
export function cInsights() {
  const out = [], M = cMoney(), t = todayStr(), O = outlookAll();
  if (M) {
    const D = M.D, H = cMonthly(D), L = cLastK(H, 6), mm = a => mAmt(a, M.cur), nm = id => { const c = D.categories.find(k => k.id === id); return c ? (c.icon || "") + " " + c.name : "Other"; };
    if (L.length) {
      const inc = cMean(L.map(k => H.m[k].i)), exp = cMean(L.map(k => H.m[k].e)), rate = inc > 0 ? (inc - exp) / inc : null, bal = cBal(D);
      if (rate !== null && rate < 0.1) out.push({p:3, t:`You keep only <b>${Math.round(rate * 100)}%</b> of income. Aim for 20% — that's ${mm(inc * 0.2 - (inc - exp))} more a month. Start by trimming your biggest non-essential category.`});
      else if (rate !== null && rate < 0.2) out.push({p:2, t:`Savings rate is ${Math.round(rate * 100)}% — close to the 20% target. Automating ${mm(inc * 0.2 - (inc - exp))} on salary day closes the gap.`});
      else if (rate !== null) out.push({p:0, t:`Great: you save <b>${Math.round(rate * 100)}%</b> of income. Make sure the surplus is going to your goals, not sitting idle.`});
      if (exp > 0 && bal / exp < 3) out.push({p:3, t:`Your cushion covers only <b>${(bal / exp).toFixed(1)} months</b> of spending. Build to 3 first, then 6, before stretch goals.`});
      if (L.length >= 4) { const a = L.slice(-3), b = L.slice(-6, -3), ids = [...new Set([].concat(...L.map(k => Object.keys(H.m[k].cat))))]; const r = ids.map(id => { const x = cMean(a.map(k => H.m[k].cat[id] || 0)), y = cMean(b.map(k => H.m[k].cat[id] || 0)); return {id, x, y, p:y ? (x - y) / y * 100 : 0}; }).filter(c => c.y > 0 && c.x - c.y >= exp * 0.03 && c.p > 25).sort((p, q) => (q.x - q.y) - (p.x - p.y))[0]; if (r) out.push({p:2, t:`<b>${esc(nm(r.id))}</b> grew ${cPct(r.p)} (${mm(r.y)} → ${mm(r.x)} a month). Set a budget for it: <i>“set budget ${esc((D.categories.find(k => k.id === r.id) || {}).name || "")} ${Math.round(r.y / 100)}”</i>.`}); }
      const mg = cMoneyGoals(), need = mg.reduce((s, o) => s + o.need * 100, 0), net = inc - exp;
      if (need > 0 && net < need) out.push({p:3, t:`Your money goals need ${mm(need)} a month but you save ${mm(Math.max(0, net))} — covering ${Math.round(Math.max(0, net) / need * 100)}%. Raise saving by ${mm(need - Math.max(0, net))}, or move the deadline of "${esc(mg.sort((p, q) => p.like - q.like)[0].g.name)}".`});
      const fc = H.cur.e, d = +t.slice(8), dim = new Date(+t.slice(0, 4), +t.slice(5, 7), 0).getDate(), avgE = exp;
      if (d >= 7 && avgE > 0 && fc / d * dim > avgE * 1.15) out.push({p:2, t:`This month is on pace to spend about <b>${mm(fc / d * dim)}</b>, ${cPct((fc / d * dim - avgE) / avgE * 100)} above usual. Ask <i>“forecast this month”</i> for the daily limit to stay on track.`});
      const bud = (D.budgets || []).filter(b => b && b.l > 0 && (!b.m || b.m === H.cm)), over = bud.filter(b => (H.cur.cat[b.c] || 0) > b.l); if (over.length) out.push({p:2, t:`Over budget in ${over.map(b => esc(nm(b.c))).slice(0, 3).join(", ")}.`});
      const inH = L.map(k => H.m[k].i).filter(v => v > 0); if (inH.length >= 3 && cSd(inH) / cMean(inH) > 0.3) out.push({p:1, t:"Your income varies a lot month to month. Budget from your lowest recent month and keep a bigger cushion."});
    } else if (!H.cur.e && !H.cur.i) out.push({p:1, t:"No Money records yet — add today's spending (try “spent 120 on lunch”) so I can analyse and forecast."});
    const lastRec = D.records.reduce((m, r) => r.d > m ? r.d : m, ""); if (lastRec && lastRec < addDays(t, -3)) out.push({p:1, t:`You haven't recorded money since ${esc(fmtDate(lastRec))}. A 30-second daily entry keeps every forecast accurate.`});
  }
  O.live.filter(o => ["stalled", "behind"].includes(o.key)).slice(0, 2).forEach(o => out.push({p:o.key === "stalled" ? 3 : 2, goal:1, t:`<b>${esc(o.g.name)}</b>: ${esc(o.tip)}`}));
  const od = getState().todos.filter(x => !x.done && x.due && x.due < t).length; if (od) out.push({p:od > 3 ? 3 : 1, goal:1, t:`${od} overdue to-do${od > 1 ? "s" : ""}. Reschedule or finish the two smallest today.`});
  const ah = O.live.filter(o => o.key === "ahead"); if (ah.length) out.push({p:0, t:`<b>${esc(ah[0].g.name)}</b> is ahead of plan — consider raising its target or moving effort to a goal that's behind.`});
  const e = getState().engage || {}; if (e.streak >= 7) out.push({p:0, t:`${e.streak}-day streak — keep it going. 🔥`});
  return out.sort((a, b) => b.p - a.p);
}
function cSuggest() {
  const ins = cInsights(); if (!ins.length) return A("I need a bit more data (Money records or goal progress) to give specific advice. Add a few entries and ask again.");
  const dot = p => p >= 3 ? "🔴" : p === 2 ? "🟠" : p === 1 ? "🟡" : "🟢";
  return A(`<b>My suggestions, most important first</b><ul class="ctips" style="list-style:none;padding-left:0">${ins.slice(0, 7).map(x => `<li>${dot(x.p)} ${x.t}</li>`).join("")}</ul><small>Built from your own numbers — a guide, not financial advice.</small>`);
}
/* ---- 12. weekly review ---- */
function cWeekly() {
  const M = cMoney(), t = todayStr(), a0 = addDays(t, -6), b0 = addDays(t, -13), b1 = addDays(t, -7); let h = "<b>Your week in review</b>";
  if (M) { const A1 = cSum(M.D, a0, t), B1 = cSum(M.D, b0, b1), top = Object.keys(A1.cat).sort((x, y) => A1.cat[y] - A1.cat[x])[0], c = top && M.D.categories.find(k => k.id === top);
    h += `<div class="crow"><span>💰 Spent</span><b>${mAmt(A1.exp, M.cur)}</b></div><small>${B1.exp ? cPct((A1.exp - B1.exp) / B1.exp * 100) + " vs the week before (" + mAmt(B1.exp, M.cur) + ")" : "no data for the week before"}${c ? " · top: " + esc((c.icon || "") + " " + c.name) : ""}</small>`; if (A1.inc) h += `<div class="crow"><span>Income</span><b>${mAmt(A1.inc, M.cur)}</b></div>`; }
  const ms = Date.parse(a0 + "T00:00:00"), done = getState().todos.filter(x => x.done && x.doneAt && x.doneAt >= ms).length, logs = getState().goals.reduce((s, g) => s + (g.logs || []).filter(l => l.date >= a0 && l.date <= t).length + (g.checks || []).filter(d => d >= a0 && d <= t).length, 0);
  h += `<div class="crow"><span>✅ To-dos finished</span><b>${done}</b></div><div class="crow"><span>🎯 Goal updates</span><b>${logs}</b></div>`;
  const e = getState().engage || {}; if (e.streak) h += `<div class="crow"><span>🔥 Streak</span><b>${e.streak} day${e.streak > 1 ? "s" : ""}</b></div>`;
  const ins = cInsights()[0]; return A(h + (ins ? `<br><b>Focus for next week</b><ul class="ctips"><li>${ins.t}</li></ul>` : ""));
}
function cAverages() {
  const M = cMoney(); if (!M) return cNoMoney(); const H = cMonthly(M.D), L = cLastK(H, 6); if (!L.length) return A("I need at least one full past month for averages.");
  const i = cMean(L.map(k => H.m[k].i)), e = cMean(L.map(k => H.m[k].e));
  return A(`<b>Typical month</b> <small>(last ${L.length})</small><div class="crow"><span>Income</span><b>${mAmt(i, M.cur)}</b></div><div class="crow"><span>Spending</span><b>${mAmt(e, M.cur)}</b></div><div class="crow"><span>Saving</span><b class="${i - e >= 0 ? "gap-ok" : "red"}">${mAmt(i - e, M.cur)}</b></div><small>≈ ${mAmt(e / 30.44, M.cur)} spent per day</small>`);
}
/* ---- set budgets from chat ---- */
export function cSetBudget(raw) {
  const M = cMoney(); if (!M) return cNoMoney(); const a = cAmt(raw), hit = cCat(raw, "expense", M.D.categories), cat = hit && hit.score >= 2 ? hit.c : null;
  if (!a || !cat) return A("Tell me the category and amount, e.g. <i>“set food budget 5000”</i>.");
  const lim = Math.round(a.n * 100), ex = (M.D.budgets || []).find(b => b.c === cat.id && !b.m);
  return A(`${ex ? "Change" : "Set"} the monthly budget for <b>${esc((cat.icon || "") + " " + cat.name)}</b> to <b>${mAmt(lim, M.cur)}</b>${ex ? " (now " + mAmt(ex.l, M.cur) + ")" : ""}?`, [{label:"Set budget", run() { const M2 = cMoney(); M2.D.budgets = M2.D.budgets || []; const e2 = M2.D.budgets.find(b => b.c === cat.id && !b.m); if (e2) e2.l = lim; else M2.D.budgets.push({id:uid(), c:cat.id, l:lim, m:""}); cMWrite(M2); return `Budget for ${esc(cat.name)} set to ${mAmt(lim, M.cur)} a month.`; }}]);
}

/* ---- routing (new intents first, everything else falls through to the v11 router) ---- */
export function chatRoute(raw: string) {
  const _route = routeV11;
  {
    const s = String(raw || "").trim(), l = s.toLowerCase(); if (!s) return null;
    try {
      if (/^(set|change|update|make)\b.*\bbudget\b/.test(l) && cAmt(s)) return cSetBudget(s);
      if (/^(delete|remove|erase|clear|add|create|new|remind|done|mark|tick|spent|paid|got|log|record|save|saved|i spent|i paid)\b/.test(l) && !/^(add|log|record)\b.*\b(what|how)\b/.test(l)) return _route(raw);
      if (/budget/.test(l)) return _route(raw);
      if (/weekly review|week in review|how was my week|this week.*(review|summary)|review.*week/.test(l)) return cWeekly();
      if (/health score|financial health|money health|how healthy|financial fitness|overall score/.test(l)) return cHealth();
      if (/what if|suppose|what would happen|if i (save|cut|spend|reduce|earn|invest|increase|stop|skip|get)/.test(l)) return cWhatIf(s);
      if (/(forecast|predict|project|expect|estimate).*(this month|month|spend|expense)|will i (overspend|exceed|go over)|month.?end|end of (the )?month|how much will i (spend|end)/.test(l) && !/year|savings|balance/.test(l)) return cForecast();
      if (/(predict|project|forecast|how much will i|where will i|will i have|future).*(sav|balance|wealth|have|be)|in \d+ ?(years?|yrs?|months?)|by (end of )?(next year|20\d\d)|net worth|future (savings|balance)/.test(l)) return cSaveProj(s);
      if (/when (will|can|do|does) (i|my|the)\b.*(finish|complete|reach|achieve|hit|get|done)|when (will|can|do) i (finish|complete|reach|achieve|hit|get)|\beta\b|how long (will|does|would).*(take|reach|finish|complete)|(will|can) i (finish|complete|reach|achieve|hit|make) .*(goal|on time|deadline|\d)/.test(l)) return cEta(s);
      if (/unusual|anomal|abnormal|suspicious|spike|duplicate|unexpected|too much|overspen|out of (the )?ordinary|odd/.test(l)) return cAnomalies();
      if (/subscription|recurring|auto.?pay|\bemi\b|regular (payment|expense)|repeating|standing/.test(l)) return cSubs();
      if (/pattern|which day|weekday|weekend|day of (the )?week|when do i spend|daily average|average daily|per day|spending habit/.test(l)) return cPatterns();
      if (/runway|how long.*(last|survive)|emergency|cushion|safety net|if i lose|lose my job|no income|rainy day/.test(l)) return cRunway();
      if (/trend|increasing|decreasing|going up|going down|rising|falling|over time|month by month|month.?wise|last (6|six) months|is my .* (higher|lower|more|less)/.test(l)) return cTrends(s);
      if (/(average|avg|typical|usual|normal).*(month|spend|expense|income|saving)/.test(l)) return cAverages();
      if (/suggest|advice|advise|\btips?\b|improve|recommend|insight|what (should|can) i (do|change|improve|cut)|how (can|do|should) i (save|reduce|cut|improve|grow|manage)|financial plan|analy[sz]e|analysis|deep dive|review my|coach/.test(l)) return cSuggest();
    } catch (e) { return A("I hit a snag analysing that. Try a simpler question, or say <i>help</i>."); }
    return _route(raw);
  }
}

export const C_CHIPS: [string, 0 | 1][] = [["Give me suggestions", 1], ["Forecast this month", 1], ["What budget should I follow?", 1], ["Predict my savings in 1 year", 1], ["Financial health score", 1], ["Any unusual spending?", 1], ["What if I save 5000 more?", 0], ["Am I on track with my goals?", 1], ["My subscriptions", 1], ["Spending trends", 1], ["Weekly review", 1], ["Where did my money go this month?", 1], ["Spent 250 on lunch today", 0], ["Add todo call bank tomorrow 5pm", 0], ["Delete last expense", 1]];

/** Snapshot of goals/todos/vault + the active Money book, so any assistant action can be undone. */
export function cSnap() { const M = cMoney(); return { s: snapState(), key: M && M.key, raw: M ? tallyRaw(M.key) : null }; }
export function cRestore(sn: { s: string; key: any; raw: string | null }) {
  restoreSnap(sn.s);
  if (sn.key && sn.raw !== null) { localStorage.setItem(sn.key, sn.raw); moneyChanged(); }
}
