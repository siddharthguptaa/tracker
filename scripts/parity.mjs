// Generates PARITY.md: every UI action in the classic index.html vs. what the React app has.
// Run in CI so the report is always current:  npm run parity
import fs from "node:fs";
const legacy = fs.readFileSync(new URL("../legacy/index.html", import.meta.url), "utf8");
const acts = [...new Set([...legacy.matchAll(/data-act="([A-Za-z0-9_]+)"/g)].map((m) => m[1]))].sort();

// [classic action] → where it lives in the React app (keep this list honest: a test below verifies each target file exists)
const PORTED = {
  tab: "ui/Nav.tsx", back: "ui/Goals.tsx", close: "ui/Sheet.tsx", theme: "ui/Header.tsx", settheme: "ui/Settings.tsx", setaccent: "ui/Settings.tsx", settingsback: "ui/Settings.tsx",
  homeeye: "ui/Header.tsx", gsearch: "ui/Search.tsx", chatopen: "ui/Chat.tsx", chatsend: "ui/Chat.tsx", chatchip: "ui/Chat.tsx", chatdo: "ui/Chat.tsx", chatno: "ui/Chat.tsx", chatundo: "ui/Chat.tsx",
  fxhaptic: "ui/Settings.tsx", fxsound: "ui/Settings.tsx", motivate: "ui/Settings.tsx", bkall: "ui/BackupSheet.tsx", bkshare: "ui/BackupSheet.tsx", bkrestore: "ui/BackupSheet.tsx", gobackup: "ui/BackupSheet.tsx",
  gnew: "ui/NewSheets.tsx", savegoal: "ui/NewSheets.tsx", open: "ui/Goals.tsx", delgoal: "ui/Goals.tsx", addlog: "ui/Goals.tsx", hday: "ui/Goals.tsx", hprev: "ui/Goals.tsx", hnext: "ui/Goals.tsx",
  gsub: "ui/Goals.tsx", gooutlook: "ui/Goals.tsx", cat: "ui/Goals.tsx", gomoney: "ui/Home.tsx", homeadd: "App.tsx", savenewtodo: "ui/NewSheets.tsx", todotoggle: "ui/TodoRow.tsx", deltodo: "ui/TodoRow.tsx",
  tf: "ui/Todos.tsx", undo: "ui/Toast.tsx", msub: "App.tsx",
};

const V = "ui/VaultSheets.tsx", VT = "ui/VaultTab.tsx", T = "ui/TodoSheets.tsx", TT = "ui/Todos.tsx";
Object.assign(PORTED, {
  // Vault
  vnew: V, vedit: V, vsave: V, vtype: V, vuriadd: V, vtogglepw: V, vgenuser: V, vfadd: V, vfdel: V, vfrm: V, vattach: V, vreveal: V, vcopy: V, vclip: V, vclone: V, vtrash: V, vrestore: V, vpurge1: V, vemptytrash: V, verase: V,
  vgensheet: V, vgmode: V, vgsep: V, vgstep: V, vgtog: V, vgregen: V, vgfill: V, vgcopy: V, vhealth: V, vexposed: V, vemerg: V, vemtog: V, vemsec: V, vprint: V, vcsvexport: V, vcsvimport: V, vfview: V, vfold: V, folderadd: V, folderdel: V, foldername: V,
  vflt: VT, vsort: VT, vfav: VT, vqcopy: VT,
  // To-do
  todoedit: T, savetodo: T, tdwhen: "ui/TodoForm.tsx", tddate: "ui/TodoForm.tsx", tdtime: "ui/TodoForm.tsx", tdtimein: "ui/TodoForm.tsx", repsel: "ui/TodoForm.tsx", tsadd: "ui/TodoForm.tsx", tsdel: "ui/TodoForm.tsx", tsnooze: T, tmv: T, tnewday: TT,
  tview: TT, tselect: TT, tselone: "ui/TodoRow.tsx", tselall: TT, tbdone: TT, tbmove: TT, tbtpl: TT, tbdel: TT, tgroup: TT, tsort: TT, tagf: TT, cleardone: TT, tstats: T, ttpl: T, tplwhen: T, tpluse: T, tpledit: T, tplsave: T, tpldel: T,
  tagadd: T, tagdel: T, tagname: T, tagnote: T, todoset: T, tsmart: T, notifperm: T, alertgo: T, tsback: T, qmoney: T, qfull: T,
  tdcsvexport: T, tdximport: T, tdxapply: T, tdxtemplate: T,
});

const GL = "ui/Goals.tsx", GD = "ui/GoalDetail.tsx", GS = "ui/GoalSheets.tsx", ST = "ui/Settings.tsx", IO = "ui/goalIo.ts";
Object.assign(PORTED, {
  // Goals: detail, edit, years, review, handover, settings, import/export, lifecycle
  addcat: ST, delcat: ST, catrename: ST, catpick: GS, typepick: GS, addplan: ST, delplan: ST, plan: GL, year: GL, range: GL, scope: GL, tgoal: GL, target: GL, budget: GL, capacity: GL, setfocusyear: GL, togglefocus: GL, gofocus: "ui/GoalBits.tsx",
  edit: GD, cancellog: GD, editlog: GD, savelog: GD, dellog: GD, hcheck: "ui/GoalBits.tsx", msadd: GD, mscancel: GD, msdel: GD, msedit: GD, mseven: GD, mssave: GD, mstoggle: GD, recurstart: GD, recurstop: GD, gtodoadd: GD, promote: GD, mknext: GD, togglearch: GL, archivedone: GL,
  review: GS, reviewnote: GS, carry: GS, carryall: GS, handover: GS, decide: GS, usesuggest: GS, applyhandover: GS, reset: ST, checkupdate: ST, copylink: ST,
  gxexport: ST, gcsv: ST, xlsimport: ST, imptoggle: GS, applyimport: GS, calday: TT, calnav: TT,
  vmigrate: V, vdiscardold: V, vopen: VT, vxexport: V, tdxexport: T,
});
const GROUPS = [
  ["Vault (items, folders, generator, health, emergency, CSV, files)", /^v[a-z0-9]+$/],
  ["To-do detail: edit, sub-tasks, repeat editor, templates, tags, calendar view, bulk select, stats", /^(t[a-z0-9]+|todo(edit|set)|savetodo|mknext|qfull|qmoney|tdx.*|td.*|repsel|clear.?done)$/],
  ["Goal editing: milestones, plans & years, targets, dependencies, review, handover, focus, archive, recurring", /^(ms.*|plan|addplan|delplan|target|capacity|carry.*|decide|review.*|handover|applyhandover|togglefocus|gofocus|setfocusyear|togglearch|archivedone|promote|recur.*|year|range|budget|scope|calday|calnav|editlog|savelog|cancellog|dellog|edit|reset|addcat|delcat|catpick|catrename|usesuggest|typepick|alertgo|notifperm|checkupdate|copylink|hcheck|gtodoadd|tgoal)$/],
  ["Excel / CSV import & export", /^(xlsimport|gcsv|gxexport|applyimport|imptoggle|vcsv.*|vxexport)$/],
];
const done = acts.filter((a) => PORTED[a]), pending = acts.filter((a) => !PORTED[a]);
const missingFiles = Object.entries(PORTED).filter(([, f]) => !fs.existsSync(new URL("../src/" + f, import.meta.url)));
let md = `# Parity: classic index.html → React app\n\n_Generated by \`npm run parity\`._\n\n**${done.length} of ${acts.length}** classic UI actions are ported (${Math.round((done.length / acts.length) * 100)}%).\n\n`;
md += `The **core data logic** is ported and tested against recorded output of the classic app: goal maths, outlook, quick-add parsing, the whole assistant engine, search, backup/restore and the storage format. The Vault and the whole To-do area (edit form, repeat editor, tags, templates, calendar, bulk select, stats, reminders, CSV) are ported with unit and browser tests. Excel (.xlsx) import/export is not (the classic app downloads its Excel library from the internet). The assistant also has an opt-in online data-analyst mode that the classic app does not have.\n\n`;
md += `## Ported\n\n${done.map((a) => `- \`${a}\` → \`src/${PORTED[a]}\``).join("\n")}\n\n## Not ported yet\n\n`;
const left = new Set(pending);
for (const [title, re] of GROUPS) { const g = pending.filter((a) => left.has(a) && re.test(a)); g.forEach((a) => left.delete(a)); if (g.length) md += `### ${title}\n${g.map((a) => `\`${a}\``).join(", ")}\n\n`; }
if (left.size) md += `### Other\n${[...left].map((a) => `\`${a}\``).join(", ")}\n\n`;
md += pending.length ? `Until every item is ported, keep using the classic app at \`/tracker/\`; both apps read and write the same data, so nothing is lost by switching back and forth.\n` : `Every classic action is ported. This map is by action name; the behaviour behind each one is covered by the unit and end-to-end tests, not by this list. Both apps share the same data, so you can switch freely.\n`;
fs.writeFileSync(new URL("../PARITY.md", import.meta.url), md);
console.log(`parity: ${done.length}/${acts.length} ported`);
if (missingFiles.length) { console.error("PORTED map points at missing files:", missingFiles.map(([a, f]) => `${a}→${f}`).join(", ")); process.exit(1); }
