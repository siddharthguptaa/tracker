import { useAppState, commit } from "../storage/store";
import { ask } from "./ask";
import { getState } from "../domain/ctx";
import { fmt, fmtDate } from "../domain/format";
import { pct, pctText, isFocus, fy, focusGoals, yearTarget, yearAchieved, timeLeft } from "../domain/goals";
import { outlookAll, outlookLabel, OSTAT, moneyTrend } from "../domain/outlook";
import { todayStr } from "../domain/clock";
import { ts, clamp, year, curYear } from "../domain/clock";
import * as G from "../domain/goalOps";
import { Header } from "./Header";
import { useUi, setUi, openSheet, toast } from "./uiStore";
import { GoalCard, Banners, Spark, LineChart, planSegUi, curPlan, runningNow, openGoal } from "./GoalBits";
import { pickGoalFile } from "./goalIo";
export { GoalDetail } from "./GoalDetail";
import type { Goal } from "../domain/types";

function Outlook() {
  const state = useAppState(), O = outlookAll(), y = fy();
  if (!O.all.length) return <div className="panel" style={{ textAlign: "center", padding: "26px 18px" }}><div style={{ fontSize: 40 }}>🔮</div><h2 style={{ margin: "8px 0 4px" }}>Your outlook appears here</h2><p className="note" style={{ margin: 0 }}>Add a goal and log some progress. I'll project where you're heading and suggest how to catch up.</p></div>;
  const mt = moneyTrend(), left = Math.max(0.1, (new Date(y, 11, 31).getTime() - Date.now()) / 86400000 / 30.44);
  let yrNum = 0, yrN = 0;
  O.live.forEach((o: any) => { const g = o.g, t = yearTarget(g, y) as number, a = yearAchieved(g, y); if (g.type !== "total" || !(t > 0) || a == null || !isFocus(g, y)) return; yrNum += clamp((a + (o.have || 0) * left) / t); yrN++; });
  const yrPct = yrN ? Math.round((yrNum / yrN) * 100) : null;
  const moneyNeed = O.live.filter((o: any) => (o.g.usesMoney === undefined ? o.g.unit === "₹" : o.g.usesMoney) && o.g.type === "total" && o.need).reduce((s: number, o: any) => s + o.need, 0);
  const col = (O.score ?? 0) >= 60 ? "var(--green)" : (O.score ?? 0) >= 40 ? "var(--amber, #d98a00)" : "var(--red)";
  const sentence = `If you carry on exactly as in the last 6 months: ${O.ahead + O.ontrack} of ${O.n} active goal${O.n > 1 ? "s" : ""} finish on time${O.risk + O.behind ? `, ${O.risk + O.behind} finish late` : ""}${O.stalled ? `, ${O.stalled} ${O.stalled > 1 ? "have" : "has"} no movement at all` : ""}.`;
  const money = (n: number) => (mt ? mt.cur : "₹") + Math.round(n).toLocaleString("en-IN");
  const moves = O.live.filter((o: any) => ["stalled", "behind", "risk"].includes(o.key)).slice(0, 3);
  const od = state.todos.filter((t) => !t.done && t.due && t.due < todayStr()).length;
  const ORD: Record<string, number> = { stalled: 0, behind: 1, risk: 2, ontrack: 3, ahead: 4, done: 5 };
  const rows = O.all.filter((o: any) => o.key !== "upcoming").sort((a: any, b: any) => (ORD[a.key] - ORD[b.key]) || a.like - b.like);
  return <>
    <div className="panel"><div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ flex: "none", width: 76, height: 76, borderRadius: "50%", display: "grid", placeItems: "center", background: `conic-gradient(${col} ${O.score || 0}%, var(--bar) 0)` }}><div style={{ width: 58, height: 58, borderRadius: "50%", background: "var(--card)", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 19 }}>{O.score == null ? "–" : O.score}</div></div>
      <div style={{ minWidth: 0 }}><b style={{ fontSize: 16 }}>Future readiness: {outlookLabel(O.score) || "—"}</b><div className="note" style={{ margin: "3px 0 0" }}>{sentence}</div></div></div>
      {yrPct != null ? <><div className="vrow" style={{ padding: "10px 0 0" }}><span>Projected {y} focus completion</span><b>{yrPct}%</b></div><div className="bar thin"><i style={{ width: yrPct + "%" }} /></div></> : null}</div>
    {mt ? <div className="panel"><b>💰 Money fuel</b><p className="note" style={{ margin: "4px 0 6px" }}>From your last {mt.n} full month{mt.n > 1 ? "s" : ""} in Money, you earn about <b>{money(mt.inc)}</b>, spend <b>{money(mt.exp)}</b> and keep <b className={mt.net >= 0 ? "gap-ok" : "red"}>{money(mt.net)}</b> a month.{moneyNeed > 0 ? <> Your money goals need about <b>{money(moneyNeed)}</b> a month to finish on time.</> : null}</p>
      {moneyNeed > 0 && mt.net < moneyNeed ? <p className="note" style={{ margin: "0 0 6px", color: "var(--red)" }}>Shortfall of about {money(moneyNeed - Math.max(0, mt.net))}/month.{mt.top.length ? <> Your biggest spends: {mt.top.map((t) => `${t.icon} ${t.name} (${money(t.avg)})`).join(", ")}. Trimming 15% from these frees about {money(mt.top.reduce((s, t) => s + t.avg, 0) * 0.15)} a month.</> : null}</p>
        : moneyNeed > 0 ? <p className="note" style={{ margin: 0, color: "var(--green)" }}>Your savings cover your money goals. Automate the transfer so it happens without thinking.</p> : null}</div> : null}
    {moves.length || od ? <><h2>This week's top moves</h2><div className="panel">
      {moves.map((o: any, i: number) => <div key={o.g.id} className="vrow" style={{ alignItems: "flex-start", padding: "8px 0" }}><span style={{ minWidth: 0 }}><b>{i + 1}. {o.g.name}</b><small style={{ display: "block", whiteSpace: "normal" }}>{o.tip}</small></span></div>)}
      {od ? <div className="vrow" style={{ alignItems: "flex-start", padding: "8px 0" }}><span><b>{moves.length + 1}. Clear {od} overdue to-do{od > 1 ? "s" : ""}</b><small style={{ display: "block", whiteSpace: "normal" }}>Pick the two smallest and finish them today. Momentum matters more than size.</small></span></div> : null}</div></> : null}
    <h2>Goal by goal</h2>
    {rows.map((o: any) => { const [lab, cls] = OSTAT[o.key] || [o.key, ""], p = Math.round(pct(o.g) * 100);
      return <div key={o.g.id} className="panel" role="button" tabIndex={0} style={{ cursor: "pointer" }} onClick={() => openGoal(o.g.id)}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}><b style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.g.name}</b><span className={"next " + cls} style={{ flex: "none", margin: 0 }}>{lab}</span></div>
        <div className="bar thin" style={{ margin: "8px 0 4px" }}><i style={{ width: p + "%" }} /></div>
        <div className="note" style={{ margin: 0, display: "flex", justifyContent: "space-between" }}><span>{p}% done · {timeLeft(o.g)}</span><span>{o.like}% likely</span></div>
        {o.tip ? <p className="note" style={{ margin: "6px 0 0" }}>{o.tip}</p> : null}</div>; })}
    <p className="note">Projections use your logged progress over the last 6 months. They are a guide, not a promise — log regularly and they get sharper.</p>
  </>;
}

function Overview() {
  const state = useAppState(), ui = useUi(), P = curPlan(ui.plan), y = fy(), isCur = P.id === G.planOfYear(y).id, scope = state.settings.scope, nxt = G.nextPlan(P.id);
  const q = ui.q.trim().toLowerCase(), matchQ = (g: Goal) => !q || (g.name + " " + g.category).toLowerCase().includes(q);
  const gsAll = state.goals.filter((g) => g.plan === P.id && !g.archived), gs = gsAll.filter(matchQ), act = gsAll.filter((g) => g.status !== "Draft");
  const archAll = state.goals.filter((g) => g.plan === P.id && g.archived), arch = archAll.filter(matchQ), done = gsAll.filter((g) => g.status === "Completed");
  const cats = ["All", ...G.allCats().filter((c) => gsAll.some((g) => g.category === c))], cat = cats.includes(ui.cat) ? ui.cat : "All", inCat = (g: Goal) => cat === "All" || g.category === cat;
  const avg = act.length ? (act.reduce((s, g) => s + pct(g), 0) / act.length) * 100 : 0;
  const cards = (l: Goal[]) => <div className="grid">{G.sortGoals(l).map((g) => <GoalCard key={g.id} g={g} />)}</div>;
  const group = (l: Goal[]) => cats.slice(1).map((c) => { const it = l.filter((g) => g.category === c); return it.length ? <div key={c}><div className="cat" style={{ margin: "12px 4px 6px" }}>{c}</div>{cards(it)}</div> : null; });
  const searching = !!q; let body: any, stats: any, toggle: any, money: any = null;
  if (isCur) {
    const fg = focusGoals(y), foc = gs.filter((g) => isFocus(g, y) && inCat(g)), rest = gs.filter((g) => !isFocus(g, y) && g.status !== "Draft" && inCat(g)), dr = gs.filter((g) => g.status === "Draft").filter(inCat), showAll = scope === "all" || searching;
    body = <>
      <h2 className="focus">🎯 Current focus · {y} ({foc.length})</h2>
      {foc.length ? cards(foc) : <div className="empty">{searching ? "No focus goals match your search." : fg.length ? "No focus goals in this category." : <>No focus goals yet.<br />Star goals in the Yearly tab or open a goal and pick its focus years.</>}</div>}
      {showAll ? <>{rest.length ? <><h2>Other goals</h2>{group(rest)}</> : null}{dr.length ? <><h2>Drafts ({dr.length})</h2>{cards(dr)}</> : null}</>
        : rest.length || dr.length ? <p className="note">{rest.length} other goal{rest.length === 1 ? "" : "s"} parked this year{dr.length ? ` · ${dr.length} draft${dr.length > 1 ? "s" : ""}` : ""} — switch to “All goals” to see {rest.length + dr.length > 1 ? "them" : "it"}.</p> : null}</>;
    toggle = <div className="seg"><button className={scope === "focus" ? "on" : ""} onClick={() => { state.settings.scope = "focus"; commit(); }}>This year ({y})</button><button className={scope === "all" ? "on" : ""} onClick={() => { state.settings.scope = "all"; commit(); }}>All goals</button></div>;
    stats = <><div className="stat"><b>{act.length}</b><span>Goals</span></div><div className="stat"><b>{fg.length}</b><span>In focus</span></div><div className="stat"><b>{runningNow(y).length}</b><span>Focus running now</span></div><div className="stat"><b>{avg.toFixed(1)}%</b><span>Overall progress</span></div></>;
    const rows = G.moneyRows(y); if (rows.length) { const planned = G.moneyPlanned(y), cap = state.capacity[y], has = cap != null && (cap as any) !== "", gap = (cap as number) - planned;
      money = <div className="money-mini" role="button" tabIndex={0} onClick={() => setUi({ gsub: "years", year: y })}><div>💰 Money plan {y}<small>{fmt(planned, "₹")} planned{has ? " · capacity " + fmt(cap as number, "₹") : ""}</small></div>{has ? <b className={gap >= 0 ? "gap-ok" : "gap-bad"}>{gap >= 0 ? "Surplus " : "Short by "}{fmt(Math.abs(gap), "₹")}</b> : <span className="mute">Set savings capacity ›</span>}</div>; }
  } else {
    const l = gs.filter(inCat);
    body = l.length ? group(l) : <div className="empty">{searching ? "No goals match your search." : <>Nothing planned for {G.planLabel(P)} yet.<br />Open a goal and tap “Create next-plan goal”, or use the handover review below.</>}</div>;
    toggle = <p className="note">Planning ahead for {G.planLabel(P).toLowerCase()}. Draft goals don't count toward focus, progress or money checks until you promote them.</p>;
    stats = <><div className="stat"><b>{gsAll.length}</b><span>Goals</span></div><div className="stat"><b>{gsAll.length - act.length}</b><span>Drafts</span></div><div className="stat"><b>{act.length}</b><span>Active</span></div><div className="stat"><b>{avg.toFixed(1)}%</b><span>Overall progress</span></div></>;
  }
  const prev = state.plans[state.plans.findIndex((p) => p.id === P.id) - 1], hp = nxt ? { id: P.id, t: `${G.planLabel(P)} → ${G.planLabel(nxt)}`, s: "Decide what finishes, carries over, or gets dropped" } : prev ? { id: prev.id, t: `${G.planLabel(prev)} → ${G.planLabel(P)}`, s: "See what is carrying into this plan" } : null;
  const doArchive = () => { const L = G.archiveCompleted(P.id); toast(`${L.length} goal${L.length > 1 ? "s" : ""} archived`, { label: "Undo", fn: () => { L.forEach((g) => { g.archived = false; }); commit(); } }); };
  return <>
    <Banners />{planSegUi(P.id, (id) => setUi({ plan: id }))}{toggle}
    <div className="stats">{stats}</div>{money}
    <div className="searchrow"><input id="q" type="search" placeholder="Search goals" value={ui.q} onChange={(e) => setUi({ q: e.target.value })} aria-label="Search goals" />
      <select aria-label="Sort goals" value={state.settings.sort || "default"} onChange={(e) => { state.settings.sort = e.target.value as any; commit(); }}>{[["default", "Order added"], ["deadline", "Deadline"], ["progress", "Progress (lowest first)"], ["name", "Name A–Z"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
    <div className="chips">{cats.map((c) => <button key={c} className={"chip" + (cat === c ? " on" : "")} onClick={() => setUi({ cat: c })}>{c}</button>)}</div>
    <p className="note">Thick bar = overall goal (line = where you should be today). Thin teal bar = this year's target.</p>
    {body}
    {done.length ? <button className="list-btn" style={{ marginTop: 14 }} onClick={async () => { if (await ask(`Archive ${done.length} completed goal${done.length > 1 ? "s" : ""}?`, "Archive", false)) doArchive(); }}><span>🗄 Archive {done.length} completed goal{done.length > 1 ? "s" : ""}<small>Hides them from every list. You can bring them back.</small></span>›</button> : null}
    {archAll.length ? <><button className="list-btn" style={{ marginTop: done.length ? 0 : 14 }} onClick={() => setUi({ showArch: !ui.showArch })}><span>{ui.showArch ? "Hide" : "Show"} archived ({archAll.length})<small>Goals you've put away</small></span>›</button>{ui.showArch ? (arch.length ? cards(arch) : <p className="note">No archived goals match.</p>) : null}</> : null}
    {hp ? <button className="list-btn" style={{ marginTop: 14 }} onClick={() => openSheet("handover", hp.id)}><span>🧭 Handover review · {hp.t}<small>{hp.s}</small></span>›</button> : null}
  </>;
}

function YearRow({ g, y }: { g: Goal; y: number }) {
  const t = yearTarget(g, y) as number | null, a = yearAchieved(g, y), f = isFocus(g, y), ratio = t != null && t > 0 && a != null ? clamp(a / t) : 0, lvl = g.type === "level", simple = g.type === "milestones" || g.type === "habit";
  return <div className={"yrow" + (f ? " yfocus" : "")}>
    <div className="row"><div className="ytitle"><button className={"star" + (f ? " on" : "")} aria-label="Toggle focus" aria-pressed={f} onClick={() => { const e = G.toggleFocus(g, y); if (e) toast(e); }}>{f ? "★" : "☆"}</button>
      <div style={{ minWidth: 0 }}><h3>{g.name}</h3><span className="cat">{g.category}{lvl ? " · level" : ""}{g.status === "Draft" ? " · draft" : ""}</span></div></div>
      <input type="number" inputMode="decimal" step="any" placeholder="Set target" defaultValue={t ?? ""} key={g.id + y + (t ?? "")} disabled={simple} title={simple ? "Set automatically" : undefined} aria-label={`${y} target for ${g.name}`} onBlur={(e) => { if (String(t ?? "") !== e.target.value) G.setTarget(g, y, e.target.value); }} /></div>
    <div className={"bar thin" + (ratio >= 1 ? " done" : "")} style={{ marginTop: 12 }}><i style={{ width: (ratio * 100).toFixed(1) + "%" }} /></div>
    <div className="meta"><span>{lvl ? "Reached" : "Achieved"}: <b style={{ color: "var(--ink)" }}>{a == null ? "—" : fmt(a, g.unit)}</b></span><span>Target: {t == null ? "—" : fmt(t, g.unit)}</span></div>
  </div>;
}
function MoneyPanel({ y }: { y: number }) {
  const s = getState(), rows = G.moneyRows(y), cap = s.capacity[y], has = cap != null && (cap as any) !== "";
  return <div className="panel"><b>💰 Money check · {y}</b>
    {!rows.length ? <p className="note">None of your {y} focus goals use money. Set “Counts toward money check” to Yes in a goal's edit form.</p> : <>
      {rows.map((r) => <div key={r.g.id} className="mrow"><span>{r.g.name}{r.auto ? null : <><br /><small style={{ color: "var(--mute)" }}>{r.g.unit ? r.g.unit + " goal" : "count goal"} – enter ₹ to set aside</small></>}</span>
        {r.auto ? <b>{fmt(r.amt, "₹")}</b> : <input type="number" inputMode="decimal" step="any" placeholder="₹ amount" defaultValue={r.amt || ""} aria-label={`Money for ${r.g.name}`} onBlur={(e) => G.setBudget(y, r.g.id, e.target.value)} />}</div>)}
      <div className="mtot"><span>Planned for {y}</span><span>{fmt(G.moneyPlanned(y), "₹")}</span></div>
      <label>How much can you realistically save in {y}? (₹)</label>
      <input type="number" inputMode="decimal" step="any" placeholder="e.g. 600000" aria-label={`Savings capacity ${y}`} defaultValue={has ? (cap as any) : ""} key={"cap" + y} onBlur={(e) => G.setCapacity(y, e.target.value)} />
      {has ? (() => { const gap = (cap as number) - G.moneyPlanned(y); return <><div className="mtot" style={{ marginTop: 10 }}><span>{gap >= 0 ? "Surplus" : "Shortfall"}</span><span className={gap >= 0 ? "gap-ok" : "gap-bad"}>{fmt(Math.abs(gap), "₹")}</span></div><p className="note">{gap >= 0 ? "Your focus goals fit inside your savings." : "Your focus goals ask for more money than you can save. Park a goal or lower a target."}</p></>; })() : null}</>}
  </div>;
}
function Yearly() {
  const state = useAppState(), ui = useUi(), ys = G.yearRange(), y = ys.includes(ui.year) ? ui.year : ys[0], fyr = fy();
  const inYear = state.goals.filter((g) => !g.archived && ((year(g.start) <= y && y <= year(g.end)) || yearTarget(g, y) != null || isFocus(g, y))), foc = inYear.filter((g) => isFocus(g, y)), parked = inYear.filter((g) => !isFocus(g, y));
  return <>
    <Banners />
    <div className="chips">{ys.map((v) => <button key={v} className={"chip" + (v === y ? " on" : "")} onClick={() => setUi({ year: v })}>{v}{v === fyr ? " ★" : ""}</button>)}</div>
    <div className="panel row"><div><b>{y}</b> · {foc.length} focus goal{foc.length === 1 ? "" : "s"}<br /><small style={{ color: "var(--mute)" }}>{y === fyr ? "This is your current focus year" : "Not your current focus year"}</small></div>
      {y === fyr ? <span className="pill st-completed">Focus year</span> : <button className="btn small" onClick={() => { G.setFocusYear(y); toast(`${y} is now your focus year`); }}>Make focus year</button>}</div>
    <button className="list-btn" onClick={() => openSheet("review", y)}><span>📋 Year-end review · {y}<small>Targets vs achieved, carry unfinished goals forward</small></span>›</button>
    <MoneyPanel y={y} />
    <h2 className="focus">🎯 Focus {y} ({foc.length})</h2>
    {foc.length ? <div className="grid">{foc.map((g) => <YearRow key={g.id} g={g} y={y} />)}</div> : <div className="empty">Tap ☆ on a goal below to add it to your {y} focus.</div>}
    {parked.length ? <><h2>Parked in {y} ({parked.length})</h2><div className="grid">{parked.map((g) => <YearRow key={g.id} g={g} y={y} />)}</div></> : null}
  </>;
}

function TlItem({ g, lo, span, focus, nowLeft, nys }: { g: Goal; lo: number; span: number; focus: boolean; nowLeft: string | null; nys: number }) {
  const pos = (t: number) => clamp((t - lo) / span) * 100, l = pos(ts(g.start)), w = Math.max(1.5, pos(ts(g.end)) - l), dr = g.status === "Draft";
  return <div className="tl-row tl-item" role="button" tabIndex={0} onClick={() => openGoal(g.id)}>
    <div className="tl-name"><div className="nm">{focus ? <span className="st">★ </span> : null}{g.name}{dr ? <small style={{ display: "inline" }}> · draft</small> : null}</div><small><span className="dt">{fmtDate(g.start)} → {fmtDate(g.end)} · </span>{pctText(g)}</small></div>
    <div className="track" style={{ ["--yw" as any]: 100 / nys + "%" }}>{nowLeft === null ? null : <div className="today" style={{ left: nowLeft + "%" }} />}
      <div className={"tbar" + (g.status === "Completed" ? " done" : "") + (focus ? "" : " dim") + (dr ? " draft" : "")} style={{ left: l + "%", width: w + "%" }}><i style={{ width: (pct(g) * 100).toFixed(1) + "%" }} /></div>
      {g.type === "milestones" ? (g.milestones || []).map((m) => <span key={m.id} className={"mk" + (m.done ? " done" : "")} style={{ left: pos(ts(m.date)) + "%" }} title={m.title} />) : null}</div>
  </div>;
}
function Timeline() {
  const state = useAppState(), ui = useUi(), P = curPlan(ui.plan), y = fy(), isCur = P.id === G.planOfYear(y).id;
  const all = state.goals.filter((g) => !g.archived && g.start && g.end && g.plan === P.id), ys: number[] = []; for (let v = year(P.start); v <= year(P.end); v++) ys.push(v);
  const cats = ["All", ...G.allCats().filter((c) => all.some((g) => g.category === c))], cat = cats.includes(ui.cat) ? ui.cat : "All", gs = all.filter((g) => cat === "All" || g.category === cat);
  const head0 = <><Banners />{planSegUi(P.id, (id) => setUi({ plan: id }))}</>;
  if (!all.length) return <>{head0}<div className="empty">Nothing planned for {G.planLabel(P)} yet.</div></>;
  const lo = ts(ys[0] + "-01-01"), hi = ts(ys[ys.length - 1] + 1 + "-01-01"), span = hi - lo, nowLeft = Date.now() >= lo && Date.now() < hi ? (clamp((Date.now() - lo) / span) * 100).toFixed(2) : null;
  const foc = isCur ? gs.filter((g) => isFocus(g, y)) : [], rest = gs.filter((g) => !foc.includes(g));
  return <>{head0}
    <div className="chips">{cats.map((c) => <button key={c} className={"chip" + (cat === c ? " on" : "")} onClick={() => setUi({ cat: c })}>{c}</button>)}</div>
    <div className="tl">
      <div className="tl-row head"><div className="tl-lbl">Goal</div><div className="tl-head">{ys.map((yy) => <span key={yy}><b className="yf">{yy}</b><b className="ys">’{String(yy).slice(2)}</b></span>)}</div></div>
      {isCur ? <><div className="tl-sec f">🎯 Focus {y} · {runningNow(y).length} of {foc.length} running now</div>{foc.length ? foc.map((g) => <TlItem key={g.id} g={g} lo={lo} span={span} focus nowLeft={nowLeft} nys={ys.length} />) : <p className="note">No focus goals chosen.</p>}</> : null}
      {rest.length ? <><div className="tl-sec">{isCur ? "Other goals" : "All goals"}</div>{rest.map((g) => <TlItem key={g.id} g={g} lo={lo} span={span} focus={false} nowLeft={nowLeft} nys={ys.length} />)}</> : null}
    </div></>;
}

function Trends() {
  const state = useAppState(), ui = useUi(), P = curPlan(ui.plan), gs = state.goals.filter((g) => !g.archived && g.status !== "Draft" && g.plan === P.id);
  const n = ui.range || 12, ends = G.monthEnds(n), labels = ends.map(G.monthLabel);
  const overall = ends.map((iso) => { const v = gs.map((g) => G.pctAt(g, iso)).filter((x): x is number => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; });
  const known = overall.filter((v): v is number => v != null), delta = known.length > 1 ? (known[known.length - 1] - known[0]) * 100 : 0, sel = gs.find((g) => g.id === ui.tg);
  let detail: any = null;
  if (sel) {
    const habit = sel.type === "habit", ms = sel.type === "milestones"; let vals: (number | null)[], exp: (number | null)[] | null = null, max: number, fy2: (v: number) => string, tgt: number[] | null = null;
    if (habit) { const per = (sel.habit && sel.habit.perWeek) || 3, target = Math.round(per * 4.33); vals = ends.map((iso) => (iso < sel.start ? null : (sel.checks || []).filter((c) => c.slice(0, 7) === iso.slice(0, 7)).length)); max = Math.max(target + 2, ...vals.filter((v): v is number => v != null), 4); tgt = ends.map(() => target); fy2 = (v) => String(Math.round(v)); }
    else { max = ms ? (sel.milestones || []).length || 1 : sel.total; vals = ends.map((iso) => (iso < sel.start ? null : G.valueAt(sel, iso)));
      exp = ends.map((iso) => { if (iso < sel.start) return null; if (ms) return (sel.milestones || []).filter((m) => m.date <= iso).length; const sp = ts(sel.end) - ts(sel.start); return sp > 0 ? clamp((ts(iso) - ts(sel.start)) / sp) * max : max; }); fy2 = ms ? (v) => String(Math.round(v)) : (v) => fmt(v, sel.unit); }
    const series = [{ vals, cls: "main" }]; if (exp) series.push({ vals: exp, cls: "exp" }); if (tgt) series.push({ vals: tgt, cls: "tgt" });
    detail = <div className="panel"><b>{sel.name}</b><LineChart labels={labels} series={series} max={max} fmtY={fy2} aria={sel.name + " over time"} />
      <div className="legend"><span><i />{habit ? "Check-ins per month" : ms ? "Milestones done" : "Your progress"}</span>{exp ? <span><i className="e" />Expected pace</span> : null}{tgt ? <span><i className="t" />Weekly goal × 4.3</span> : null}</div></div>;
  }
  return <>
    <Banners />{planSegUi(P.id, (id) => setUi({ plan: id }))}
    <div className="chips">{[[6, "6 months"], [12, "12 months"], [24, "24 months"]].map(([v, l]) => <button key={v} className={"chip" + (n === v ? " on" : "")} onClick={() => setUi({ range: v as number })}>{l}</button>)}</div>
    {!gs.length ? <div className="empty">No active goals in {G.planLabel(P)} yet.</div> : <div className="panel"><b>Overall progress</b><span className="note" style={{ marginLeft: 8 }}>{known.length > 1 ? (delta >= 0 ? "+" : "") + delta.toFixed(1) + " pts over this period" : "Needs more history"}</span>
      <LineChart labels={labels} series={[{ vals: overall.map((v) => (v == null ? null : v * 100)), cls: "main" }]} max={100} fmtY={(v) => Math.round(v) + "%"} aria="Overall progress over time" />
      <p className="note">Average of your active {G.planLabel(P)} goals. Before you started logging, each goal shows its starting number, so early months look flat.</p></div>}
    {detail}
    {gs.length ? <><h2>Goals · tap one for its own chart</h2>{gs.map((g) => { const series = ends.map((iso) => G.pctAt(g, iso)), k = series.filter((v): v is number => v != null), d = k.length > 1 ? (k[k.length - 1] - k[0]) * 100 : 0;
      return <div key={g.id} className={"trow" + (sel && sel.id === g.id ? " on" : "")} role="button" tabIndex={0} onClick={() => setUi({ tg: sel && sel.id === g.id ? null : g.id })}><div className="tn">{g.name}<small>{g.category}{k.length > 1 ? " · " + (d >= 0 ? "+" : "") + d.toFixed(1) + " pts" : ""}</small></div><Spark vals={series} /><b style={{ minWidth: 42, textAlign: "right" }}>{pctText(g)}</b></div>; })}</> : null}
  </>;
}

export function GoalsTab() {
  const state = useAppState(), ui = useUi();
  const SUB: [typeof ui.gsub, string][] = [["overview", "Overview"], ["years", "Yearly"], ["timeline", "Timeline"], ["trends", "Trends"], ["outlook", "Outlook"]];
  const tabs = <div className="subtabs" role="tablist">{SUB.map(([k, l]) => <button key={k} role="tab" aria-selected={ui.gsub === k} className={ui.gsub === k ? "on" : ""} onClick={() => setUi({ gsub: k })}>{l}</button>)}</div>;
  if (!state.goals.length) return (
    <><Header /><h1>Goals</h1>{tabs}
      <div className="panel" style={{ textAlign: "center", padding: "26px 18px" }}><div style={{ fontSize: 44 }}>🎯</div><h2 style={{ margin: "8px 0 4px" }}>Start with your first goal</h2>
        <p className="note" style={{ margin: "0 0 16px" }}>Track money, habits or milestones. Nothing is pre-filled, and your data is not shared with anyone.</p>
        <button className="btn" onClick={() => setUi({ sheet: "goalnew" })}>＋ Add a goal</button>
        <button className="btn alt" style={{ marginTop: 8 }} onClick={pickGoalFile}>Import from Excel or CSV</button></div></>
  );
  return (
    <>
      <Header />
      <h1>Goals</h1>
      {tabs}
      {ui.gsub === "outlook" ? <Outlook /> :ui.gsub === "years" ? <Yearly /> : ui.gsub === "timeline" ? <Timeline /> : ui.gsub === "trends" ? <Trends /> : <Overview />}
    </>
  );
}
