import { useAppState } from "../storage/store";
import { todayStr, addDays, isoOf, DAY } from "../domain/clock";
import { fmtDate } from "../domain/format";
import { pct, pctText, focusGoals, fy } from "../domain/goals";
import { outlookAll, outlookLabel } from "../domain/outlook";
import { QUOTES, engageOpen, todayWins } from "../domain/motivation";
import { moneyStats } from "../domain/moneyStats";
import { tallyBooks, mAmt } from "../storage/moneyStore";
import { vAudit } from "../domain/vault";
import { Header } from "./Header";
import { TodoRow } from "./TodoRow";
import { RemindBanner } from "./TodoSheets";
import { FocusBanner } from "./GoalBits";
import { setUi } from "./uiStore";
import { play } from "./fx";
import { useEffect } from "react";
import { toast } from "./uiStore";
import { bkAgo } from "./backupUi";

const todoSort = (a: any, b: any) => { const x = (a.due || "9999") + (a.time || ""), y = (b.due || "9999") + (b.time || ""); return x < y ? -1 : x > y ? 1 : 0; };

function Boost() {
  const state = useAppState();
  const off = state.settings.motivate === false;
  const e = engageOpen(), t = todayStr(), wins = todayWins(), n = wins.filter((w) => w.d).length;
  const O = outlookAll(), od = state.todos.filter((x) => !x.done && x.due && x.due < t).length;
  const doy = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / DAY);
  let msg = QUOTES[doy % QUOTES.length];
  if (n === 3) msg = "Perfect day! All three habits done. Rest knowing you moved forward.";
  else if (O.stalled) msg = `‘${O.live.find((o: any) => o.key === "stalled").g.name}’ hasn't moved lately — one small log today restarts it.`;
  else if (od > 2) msg = `${od} to-dos are overdue. Knock out two small ones in the next 10 minutes.`;
  else if (O.behind) msg = `‘${O.live.find((o: any) => o.key === "behind").g.name}’ is behind pace. See your Outlook for a catch-up plan.`;
  const st = e.streak || 1, badge = st >= 100 ? "🏆" : st >= 30 ? "🥇" : st >= 14 ? "🥈" : st >= 7 ? "🥉" : "🔥";
  useEffect(() => {
    if (off) return;
    if (n === 3 && !(e.wins || {})[t]) { e.wins = e.wins || {}; e.wins[t] = 1; e.perfect = (e.perfect || 0) + 1; play("win"); toast("All 3 done today — great work! 🎉"); }
    if (e.fresh) { e.fresh = false; if ([3, 7, 14, 30, 60, 100].includes(st)) { play("win"); toast(`${st}-day streak! ${badge}`); } }
  });
  if (off) return null;
  return (
    <div className="boost"><div className="bq">“{msg}”</div>
      <div className="bm"><span className="bs" title="Days in a row you opened the app">{badge} {st}-day streak{(e.best || 0) > st ? ` · best ${e.best}` : ""}</span><span className="bs">{n}/3 today</span></div>
      <div className="bw">{wins.map((w) => <button key={w.k} className={"bwin" + (w.d ? " on" : "")} onClick={() => setUi({ tab: w.v as any, page: null })}><i>{w.d ? "✓" : ""}</i>{w.l}</button>)}</div>
    </div>
  );
}

function MoneyCard({ label, bk, stats }: { label: string; bk?: any; stats: ReturnType<typeof moneyStats> }) {
  const open = () => setUi({ tab: "money", page: null });
  const sty = bk && bk.color ? { borderLeft: "4px solid " + bk.color } : undefined;
  if (!stats) return <div className="dcard" onClick={open} style={sty}><h3>{(bk && bk.icon) || "💰"} {label} <span className="dm">Open ›</span></h3><p className="note" style={{ margin: 0 }}>Add your first record to see this month here.</p></div>;
  const m = stats;
  return (
    <div className="dcard" onClick={open} style={sty}><h3>{(bk && bk.icon) || "💰"} {label} · this month <span className="dm">Open ›</span></h3>
      <div className="dk"><div><b className="gap-ok">{mAmt(m.inc, m.cur)}</b><small>Income</small></div><div><b className={m.exp > m.inc ? "red" : ""}>{mAmt(m.exp, m.cur)}</b><small>Spent</small></div><div><b>{mAmt(m.bal, m.cur)}</b><small>Total balance</small></div></div>
      {m.inc > 0 ? <><div className="note" style={{ margin: "6px 0 4px" }}>Saved {Math.max(0, Math.round((m.inc - m.exp) / m.inc * 100))}% of income</div><div className="dbar"><i style={{ width: Math.max(0, Math.min(100, (m.inc - m.exp) / m.inc * 100)) + "%" }} /></div></> : null}
      {m.top.length ? <div style={{ marginTop: 10 }}>{m.top.map((t, i) => <div key={i} className="vrow" style={{ padding: "6px 0" }}><span>{t.icon} {t.name}</span><b>{mAmt(t.v, m.cur)}</b></div>)}</div> : null}
      {m.over || m.near ? <div className="note" style={{ margin: "6px 0 0" }}>{m.over ? <span className="red">{m.over} budget{m.over > 1 ? "s" : ""} over</span> : null}{m.over && m.near ? " · " : ""}{m.near ? `${m.near} nearing the limit` : ""}</div> : null}
    </div>
  );
}

export function Home() {
  const state = useAppState();
  const today = todayStr(), y = fy(), hr = new Date().getHours(), greet = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
  const date = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  const open = state.todos.filter((t) => !t.done), due = open.filter((t) => t.due && t.due <= today).sort(todoSort), overdue = open.filter((t) => t.due && t.due < today).length;
  const wk = [6, 5, 4, 3, 2, 1, 0].map((n) => { const d = addDays(today, -n); return { d, n: state.todos.filter((t) => t.done && t.doneAt && isoOf(t.doneAt) === d).length }; }), wmax = Math.max(1, ...wk.map((x) => x.n)), wtot = wk.reduce((a, x) => a + x.n, 0);
  const act = state.goals.filter((g) => !g.archived && g.status !== "Draft"), avg = act.length ? Math.round(act.reduce((a, g) => a + pct(g), 0) / act.length * 100) : 0;
  const done = act.filter((g) => g.status === "Completed").length, prog = act.filter((g) => g.status === "In Progress").length, foc = focusGoals(y);
  const soon = open.filter((t) => t.due && t.due > today && t.due <= addDays(today, 7)).sort(todoSort);
  const ms: { g: any; m: any }[] = []; state.goals.filter((g) => !g.archived).forEach((g) => (g.milestones || []).forEach((m) => { if (!m.done && m.date >= today && m.date <= addDays(today, 14)) ms.push({ g, m }); })); ms.sort((a, b) => (a.m.date < b.m.date ? -1 : 1));
  const mo = moneyStats(), books = tallyBooks().list, O = outlookAll(), live = state.vault.items.filter((i) => !i.trashed), au = vAudit(live), vIssues = au.reused.length + au.weak.length;
  const oldBk = !state.settings.lastBackup || Date.now() - state.settings.lastBackup > 14 * DAY;
  const bad = O.risk + O.behind + O.stalled;
  return (
    <>
      <Header />
      <h1 className="hh">{greet}</h1><p className="sub">{date}</p>
      <Boost />
      <div className="dcard" onClick={() => setUi({ sheet: "chat" })}><h3>💬 Ask your assistant <span className="dm">Chat ›</span></h3><p className="note" style={{ margin: 0 }}>Add or delete entries, get your budget, ask “am I on track?” — works offline.</p></div>
      <RemindBanner />
      <FocusBanner />
      <div className="stats">
        <div className="stat" onClick={() => setUi({ tab: "todo" })} style={{ cursor: "pointer" }}><b>{due.length}</b><span>Due today</span></div>
        <div className="stat" onClick={() => setUi({ tab: "todo" })} style={{ cursor: "pointer" }}><b className={overdue ? "red" : ""}>{overdue}</b><span>Overdue</span></div>
        <div className="stat" onClick={() => setUi({ tab: "goals" })} style={{ cursor: "pointer" }}><b>{avg}%</b><span>Goals avg</span></div>
        <div className="stat" onClick={() => setUi({ tab: "money" })} style={{ cursor: "pointer" }}><b>{mo ? mAmt(mo.exp, mo.cur) : "–"}</b><span>Spent / month</span></div>
      </div>
      <div className="panel" style={{ marginTop: 12 }}><div className="row"><b>Today</b><button className="btn small alt" onClick={() => setUi({ tab: "todo" })}>All to-dos ›</button></div>
        {due.length ? <>{due.slice(0, 5).map((t) => <TodoRow key={t.id} t={t} hideDelete />)}{due.length > 5 ? <p className="note">+{due.length - 5} more due</p> : null}</> : <p className="note">Nothing due today. 🎉</p>}
      </div>
      <div className="dgrid">
        <div className="dcard" onClick={() => setUi({ tab: "goals" })}><h3>🎯 Goals {y} <span className="dm">Open ›</span></h3>
          <div className="dk"><div><b>{act.length}</b><small>Active</small></div><div><b>{prog}</b><small>In progress</small></div><div><b>{done}</b><small>Completed</small></div></div>
          {foc.slice(0, 4).map((g) => <div key={g.id} style={{ marginTop: 9 }}><div className="row" style={{ fontSize: 13.5 }}><b style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</b><span style={{ fontWeight: 700 }}>{pctText(g)}</span></div><div className="dbar"><i style={{ width: Math.round(pct(g) * 1000) / 10 + "%" }} /></div></div>)}
          {foc.length > 4 ? <p className="note">+{foc.length - 4} more focus goals</p> : null}
        </div>
        {O.n ? <div className="dcard" onClick={() => setUi({ tab: "goals", gsub: "outlook", page: null })}><h3>🔮 Your outlook <span className="dm">Open ›</span></h3><div className="dk"><div><b className={O.score! >= 60 ? "gap-ok" : O.score! >= 40 ? "" : "red"}>{O.score}</b><small>Readiness</small></div><div><b>{O.ahead + O.ontrack}</b><small>On time</small></div><div><b className={bad ? "red" : ""}>{bad}</b><small>Need help</small></div></div><p className="note" style={{ margin: "8px 0 0" }}>{outlookLabel(O.score)} — tap for what to do next.</p></div> : null}
        {books.length > 1 ? books.map((b: any) => <MoneyCard key={b.id} label={b.name} bk={b} stats={moneyStats(b.key)} />) : <MoneyCard label="Money" stats={mo} />}
        <div className="dcard"><h3>✅ This week <span className="dm">{wtot} done</span></h3>
          <div className="wbars">{wk.map((x) => <div key={x.d}><i style={{ height: Math.round(x.n / wmax * 100) + "%" }} title={String(x.n)} /><small>{new Date(x.d + "T00:00:00").toLocaleDateString("en-IN", { weekday: "narrow" })}</small></div>)}</div>
          <p className="note" style={{ margin: "8px 0 0" }}>{open.length} to-do{open.length === 1 ? "" : "s"} still open</p></div>
        <div className="dcard" onClick={() => setUi({ tab: "vault" })}><h3>🔐 Vault <span className="dm">Open ›</span></h3>
          <div className="dk"><div><b>{live.filter((i) => i.type === "login").length}</b><small>Logins</small></div><div><b>{live.filter((i) => i.type === "card").length}</b><small>Cards</small></div><div><b>{live.filter((i) => i.type === "note" || i.type === "identity").length}</b><small>Notes &amp; IDs</small></div></div>
          <p className="note" style={{ margin: "8px 0 0" }}>{live.length ? (vIssues ? <>🛡 <span className="red">{au.reused.length} reused · {au.weak.length} weak</span> passwords to fix</> : "🛡 No weak or reused passwords 👍") : "Nothing saved yet. Tap to add your first item."}</p></div>
        <div className="dcard" onClick={() => setUi({ sheet: "backup" })} style={oldBk ? { border: "1px solid var(--amber,#d98a00)" } : undefined}><h3>💾 Back up everything <span className="dm">1 tap</span></h3><p className="note" style={{ margin: 0 }}>Last backup: <b>{bkAgo()}</b>. Saves goals, to-dos, vault and Money as separate files.</p></div>
        {soon.length + ms.length ? <div className="dcard" style={{ cursor: "default" }}><h3>📅 Coming up <span className="dm">next 7–14 days</span></h3>
          {soon.slice(0, 4).map((t) => <div key={t.id} className="vrow"><div style={{ minWidth: 0 }}><b>{t.text}</b><small>{fmtDate(t.due)}</small></div><span>☑</span></div>)}
          {ms.slice(0, 3).map(({ g, m }) => <div key={m.id || m.title} className="vrow"><div style={{ minWidth: 0 }}><b>{m.title || m.name}</b><small>{g.name} · {fmtDate(m.date)}</small></div><span>🎯</span></div>)}</div> : null}
      </div>
    </>
  );
}
