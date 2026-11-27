import { useAppState, commit, snapState, restoreSnap } from "../storage/store";
import { ask } from "./ask";
import { Header } from "./Header";
import { setUi, toast } from "./uiStore";
import { applyTheme, ACCENTS, isDarkNow } from "./theme";
import { FocusBanner } from "./GoalBits";
import { BUILD } from "./build";
import { bkAgo, backupNow, restoreFiles } from "./backupUi";
import { idbFiles } from "./vaultFiles";
import { useRef, useState } from "react";
import { getState } from "../domain/ctx";
import { fy } from "../domain/goals";
import { undoTo } from "../domain/actions";
import * as G from "../domain/goalOps";
import { exportGoalsCsv, exportGoalsXlsx, pickGoalFile } from "./goalIo";
import { checkForUpdate, QUICK_LINKS } from "./lifecycle";
import { year } from "../domain/clock";

const THEMES: [string, string][] = [["system", "Automatic"], ["light", "Light"], ["dark", "Dark"], ["comfort", "👁 Eye comfort"], ["night", "🌙 Night comfort"]];


function Categories() {
  const st = useAppState(), [nv, setNv] = useState("");
  return <><h2>Categories</h2><div className="panel">
    {st.categories.map((c) => { const n = st.goals.filter((g) => g.category === c).length; return <div key={c} className="mrow"><input type="text" defaultValue={c} key={c} style={{ flex: 1, width: "auto", textAlign: "left" }} aria-label={`Rename category ${c}`} onBlur={(e) => { const r = G.renameCategory(c, e.target.value); if (r) { toast(r); e.target.value = c; } else if (e.target.value.trim() !== c) toast("Category renamed"); }} /><small style={{ color: "var(--mute)", whiteSpace: "nowrap" }}>{n} goal{n === 1 ? "" : "s"}</small><button className="x" disabled={!!n} style={n ? { opacity: 0.3 } : undefined} aria-label={`Delete category ${c}`} onClick={() => { const r = G.deleteCategory(c); toast(r || "Category deleted"); }}>✕</button></div>; })}
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, marginTop: 12 }}><input id="newcat" placeholder="New category (e.g. Health, Family)" value={nv} onChange={(e) => setNv(e.target.value)} /><button className="btn small" onClick={() => { const r = G.addCategory(nv); if (r) return toast(r); setNv(""); toast("Category added"); }}>Add</button></div>
    <p className="note">Edit a name to rename it everywhere. A category can be deleted only when it has no goals. You can also create one while adding or editing a goal.</p></div></>;
}
function Plans() {
  const st = useAppState(), [age, setAge] = useState(""), [end, setEnd] = useState("");
  return <><h2>Plans (age stages)</h2><div className="panel">
    {st.plans.map((p) => { const n = st.goals.filter((g) => g.plan === p.id).length, off = !!n || st.plans.length < 2; return <div key={p.id} className="mrow"><span><b>{G.planLabel(p)}</b> · {year(p.start)}–{year(p.end)}</span><small style={{ color: "var(--mute)", whiteSpace: "nowrap" }}>{n} goal{n === 1 ? "" : "s"}</small><button className="x" disabled={off} style={off ? { opacity: 0.3 } : undefined} aria-label={`Delete plan ${G.planLabel(p)}`} onClick={() => { const r = G.deletePlan(p.id); toast(r || "Plan deleted"); }}>✕</button></div>; })}
    <div className="g2" style={{ marginTop: 12 }}><input id="np_age" type="number" inputMode="numeric" placeholder="Age, e.g. 45" value={age} onChange={(e) => setAge(e.target.value)} aria-label="Plan age" /><input id="np_end" type="number" inputMode="numeric" placeholder="Ends in year, e.g. 2042" value={end} onChange={(e) => setEnd(e.target.value)} aria-label="Plan end year" /></div>
    <button className="btn alt" style={{ marginTop: 8 }} onClick={() => { const r = G.addPlan(Number(age), Number(end)); if (r) return toast(r); setAge(""); setEnd(""); toast("Plan added"); }}>Add plan</button>
    <p className="note">Each plan starts the year after the previous one ends. A plan can be deleted only when it has no goals.</p></div></>;
}
function QuickLaunch() {
  const base = location.origin + location.pathname;
  return <><h2>Quick launch</h2><div className="panel"><p className="note" style={{ marginTop: 0 }}><b>Press and hold the app icon</b> on your home screen to jump straight to Add to-do, Add expense, Add income or Money. (After an update, close and reopen the app twice. If the shortcuts still don't show, remove the icon and add it again.)</p>
    <details className="acc"><summary>Make your own home-screen icons</summary><p className="note">In Chrome, open one of these links, then ⋮ → Add to Home screen. Each becomes its own icon, like a widget button.</p>
      {QUICK_LINKS.map(([l, q]) => <div key={q} className="vrow"><div style={{ minWidth: 0 }}><b>{l}</b><small style={{ overflowWrap: "anywhere" }}>{base + q}</small></div><button className="btn small alt" onClick={async () => { try { await navigator.clipboard.writeText(base + q); toast("Link copied"); } catch { toast("Couldn't copy — select the link instead"); } }}>Copy link</button></div>)}</details>
    <p className="note">A true Android widget can't be made from a web app. These shortcuts and icons are the closest thing: one tap opens the exact screen you want, even offline.</p></div></>;
}

export function Settings() {
  const fileRef = useRef<HTMLInputElement>(null);
  const onPickBackup = async (e: { target: HTMLInputElement }) => { const l = Array.from(e.target.files || []) as File[]; e.target.value = ""; if (l.length) await restoreFiles(l, (m) => ask(m, "Restore", false), idbFiles); };
  const st = useAppState(), s = st.settings, ys = G.yearRange();
  const set = (k: string, v: any) => { (s as any)[k] = v; commit(); applyTheme(); };
  return (
    <>
      <Header nog />
      <div className="backbar"><button onClick={() => setUi({ tab: "home" })}>‹ Back</button></div>
      <h1>Settings</h1>
      <p className="sub">Your data lives on this device.</p>
      <FocusBanner />
      <h2>Appearance</h2>
      <div className="panel">
        <label style={{ marginTop: 0 }}>Theme</label>
        <div className="seg wrap" role="radiogroup" aria-label="Theme" style={{ margin: "4px 0 0" }}>{THEMES.map(([v, l]) => <button key={v} role="radio" aria-checked={s.theme === v} className={s.theme === v ? "on" : ""} onClick={() => set("theme", v)}>{l}</button>)}</div>
        <p className="note"><b>Eye comfort</b> is a warm paper-like theme with softer contrast and no bright white. <b>Night comfort</b> is a dim warm dark theme with less blue light. Both apply to every section, including Money.</p>
        <label>Accent colour</label>
        <div className="sws" role="radiogroup" aria-label="Accent colour">{Object.entries(ACCENTS).map(([k, a]) => <button key={k} role="radio" aria-checked={s.accent === k} aria-label={a.n} className={"sw" + (s.accent === k ? " on" : "")} style={{ background: isDarkNow() ? a.d[0] : a.l[0] }} onClick={() => { set("accent", k); toast(a.n + " accent"); }} />)}</div>
        <p className="note">Automatic follows your phone's light or dark setting. The ☀ / ☾ button at the top right of every page flips between light and dark in one tap; pick Automatic here to follow your device again.</p>
      </div>
      <h2>Settings</h2>
      <div className="panel">
        <label htmlFor="set_fy" style={{ marginTop: 0 }}>Current focus year</label>
        <select id="set_fy" value={fy()} onChange={(e) => { G.setFocusYear(+e.target.value); toast(`${e.target.value} is now your focus year`); }}>{ys.map((v) => <option key={v} value={v}>{v}</option>)}</select>
        <label htmlFor="set_stale">Show red “forgotten goal” banner after no update for</label>
        <select id="set_stale" value={s.staleDays} onChange={(e) => set("staleDays", +e.target.value)}>{[[30, "1 month"], [60, "2 months"], [90, "3 months"], [180, "6 months"]].map(([d, l]) => <option key={d} value={d}>{l}</option>)}</select>
        <p className="note">Your focus banner asks for a review every 6 months.</p>
      </div>
      <QuickLaunch />
      <Categories />
      <Plans />
      <h2>Backup &amp; restore</h2>
      <div className="panel"><button className="btn" style={{ width: "100%" }} onClick={() => backupNow()}>💾 Back up everything now</button><p className="note">Last backup: <b>{bkAgo()}</b>. One tap saves four files to your phone: Goals, To-dos, Vault (with attachments) and Money (all books). Restore any of them separately, in any order.</p>
        <div className="btns" style={{ marginTop: 6 }}><button className="btn alt small" onClick={() => backupNow(true)}>Share / save to Drive…</button><button className="btn alt small" onClick={() => fileRef.current?.click()}>Restore from files…</button></div>
        <input ref={fileRef} type="file" accept=".json,application/json" multiple hidden onChange={onPickBackup} /></div>
      <h2>Feedback &amp; motivation</h2>
      <div className="panel">
        <label className="chkrow" style={{ marginTop: 0 }}><input type="checkbox" checked={s.fxHaptic !== false} onChange={(e) => set("fxHaptic", e.target.checked)} aria-label="Haptic feedback" /> Haptic feedback (vibration on taps, saves and deletes)</label>
        <label className="chkrow"><input type="checkbox" checked={s.fxSound !== false} onChange={(e) => set("fxSound", e.target.checked)} aria-label="Soft sounds" /> Soft sounds</label>
        <label className="chkrow"><input type="checkbox" checked={s.motivate !== false} onChange={(e) => set("motivate", e.target.checked)} aria-label="Motivation card" /> Daily motivation card, streak and “today's 3” on Home</label>
        <p className="note">Vibration works on most Android phones; iPhones don't allow it for web apps, so sounds are the feedback there.</p>
      </div>
      <h2>Excel &amp; CSV</h2>
      <button className="list-btn" onClick={exportGoalsXlsx}><span>Export goals to Excel (.xlsx)<small>Goals, targets by year and progress. Opens in Excel, Sheets and Numbers.</small></span>›</button>
      <button className="list-btn" onClick={exportGoalsCsv}><span>Export goals to CSV<small>The same columns as plain text</small></span>›</button>
      <button className="list-btn" onClick={pickGoalFile}><span>Import from Excel or CSV<small>Update or add goals by name. You review the changes first.</small></span>›</button>
      <p className="note">To-do, Vault and Money each have their own Excel / CSV options in their settings (gear icon). Excel needs internet once to load its reader, then works offline.</p>
      <h2>Danger zone</h2>
      <button className="list-btn" onClick={async () => { if (!await ask("Delete all goals? To-dos, vault and Money are kept. You can undo right after.", "Delete all")) return; const snap = snapState(); G.resetGoals(); toast("All goals deleted", { label: "Undo", fn: () => restoreSnap(snap) }); }}><span>Delete all goals<small>Starts the goals section from empty. To-dos, vault and Money are kept.</small></span>›</button>
      <h2>About</h2>
      <button className="list-btn" onClick={async () => { toast("Checking…"); const r = await checkForUpdate(); if (r === "same") toast("You're on the latest version"); else if (r === "err") toast("Couldn't check — are you online?"); }}><span>Check for update<small>Version {BUILD}. Shows if a newer version is online and reloads into it.</small></span>›</button>
      <div className="panel"><div className="vrow"><span>Version</span><b>{BUILD}</b></div><p className="note">Same data as the classic Tracker on this device. Everything works offline.</p></div>
      <h2>Tip</h2>
      <p className="note">Install it like an app: on iPhone use Safari → Share → <b>Add to Home Screen</b>. On Android Chrome use ⋮ → <b>Install app</b>. It works offline after the first load.</p>
      <p className="note">Data is saved in this browser only. Phone and laptop each keep their own copy — use Excel export and import to move data across.</p>
    </>
  );
}
