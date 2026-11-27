import { useEffect, useRef, useState } from "react";
import { Sheet } from "./Sheet";
import { setUi, toast } from "./uiStore";
import { chatRoute, A, C_HELP, C_CHIPS, cSnap, cRestore, type Reply, type ChatAct } from "../assistant/engine";
import { play } from "./fx";
import { uid } from "../domain/format";
import * as AI from "../assistant/online";
import { AiChart } from "./AiChart";

interface Msg { id: string; r: "u" | "a"; t?: string; html?: string; acts?: ChatAct[]; pick?: boolean; done?: string; cancelled?: boolean; snap?: any; undone?: boolean; charts?: AI.ChartSpec[]; ai?: boolean; wait?: boolean }
const HELLO = (): Msg => ({ id: uid(), r: "a", html: `Hi! I'm your offline assistant. Ask about your <b>spending, budget and goals</b>, or tell me to <b>add or delete</b> things. Everything runs on this phone.<br><small>Tip: the keyboard's mic button works for dictation.</small>`, acts: [] });
let kept: Msg[] = [];
let aiTurns: AI.Turn[] = [];
/** Commands that change data always go through the offline assistant (it asks first and can undo). */
const isCommand = (t: string) => /^\s*(add|create|new|delete|remove|log|mark|complete|finish|set|rename|move|snooze|reschedule|undo|cancel|edit|update)\b/i.test(t);   // survives closing/reopening the sheet within a session, like the legacy app

export function ChatSheet() {
  const [log, setLog] = useState<Msg[]>(() => (kept.length ? kept : [HELLO()])), [draft, setDraft] = useState(""), end = useRef<HTMLDivElement>(null), inp = useRef<HTMLInputElement>(null);
  useEffect(() => { kept = log.slice(-60); const el = document.getElementById("ch_log"); if (el) el.scrollTop = el.scrollHeight; }, [log]);
  const [cfg, setCfg] = useState(AI.loadAi()), [showSet, setShowSet] = useState(false), [online, setOnline] = useState(typeof navigator === "undefined" || navigator.onLine !== false), [busy, setBusy] = useState(false);
  useEffect(() => { const a = () => setOnline(true), b = () => setOnline(false); window.addEventListener("online", a); window.addEventListener("offline", b); return () => { window.removeEventListener("online", a); window.removeEventListener("offline", b); }; }, []);
  const analyst = cfg.on && !!cfg.key && online;
  const push = (...m: Msg[]) => setLog((l) => [...l, ...m].slice(-60));
  const offline = (text: string, note = "") => {
    let r: Reply | null; try { r = chatRoute(text); } catch { r = A("Sorry, I couldn't work that out. " + C_HELP); }
    push(...(r ? [{ id: uid(), r: "a" as const, html: (note ? `<small>${note}</small><br>` : "") + r.html, acts: r.acts, pick: r.pick }] : []));
  };
  const ask = async (text: string) => {
    text = text.trim(); if (!text || busy) return; setDraft(""); push({ id: uid(), r: "u", t: text });
    if (!analyst || isCommand(text)) return offline(text);
    const wid = uid(), charts: AI.ChartSpec[] = []; setBusy(true); push({ id: wid, r: "a", html: "Analysing your data…", wait: true, acts: [] });
    try {
      const r = await AI.askAnalyst(aiTurns, text, { settings: cfg, onChart: (c) => charts.push(c) }); aiTurns = r.turns.slice(-24);
      setLog((l) => l.map((x) => (x.id === wid ? { ...x, wait: false, ai: true, html: AI.mdLite(r.text) + (r.tools.length ? `<br><small>Used: ${[...new Set(r.tools)].join(", ").replace(/_/g, " ")}</small>` : ""), charts } : x)));
    } catch (e: any) {
      setLog((l) => l.filter((x) => x.id !== wid)); offline(text, AI.friendly(e) + " Answering offline instead.");
    } finally { setBusy(false); }
  };
  const run = (m: Msg, a: ChatAct) => {
    if (m.done) return;
    const snap = cSnap(); let msg: string | null; try { msg = a.run(); } catch { msg = null; }
    if (msg == null) { toast("Couldn't do that — nothing changed"); return; }
    play("ok");
    setLog((l) => [...l.map((x) => (x.id === m.id ? { ...x, done: String(msg).replace(/<[^>]+>/g, ""), acts: [] } : x)), { id: uid(), r: "a", html: msg!, acts: [], snap }].slice(-60));
  };
  const undo = (m: Msg) => { if (!m.snap) return; try { cRestore(m.snap); setLog((l) => [...l.map((x) => (x.id === m.id ? { ...x, snap: null } : x)), { id: uid(), r: "a", html: "Undone — everything is back as it was.", acts: [] } as Msg]); play("warn"); } catch { toast("Couldn't undo"); } };
  return (
    <Sheet label="Assistant">
      <div className="chat">
        <div className="chh"><div><h1 style={{ margin: 0, whiteSpace: "nowrap" }}>💬 Assistant</h1><small id="ch_mode">{analyst ? "Online analyst · read-only, Vault never shared" : cfg.on && cfg.key ? "Offline now · analyst resumes when you're online" : "Offline · reads & changes your real data, always asks first"}</small></div><div style={{ display: "flex", gap: 6 }}><button className="btn alt small" aria-label="Assistant settings" onClick={() => setShowSet((v) => !v)}>⚙</button><button className="btn alt small" aria-label="Close" onClick={() => setUi({ sheet: null })}>✕</button></div></div>
        {showSet ? <AiSettings cfg={cfg} setCfg={setCfg} /> : null}
        <div id="ch_log" className="chlog" aria-live="polite">
          {log.map((m) => m.r === "u" ? <div key={m.id} className="cm u">{m.t}</div> : (
            <div key={m.id} className="cm a">
              <span dangerouslySetInnerHTML={{ __html: m.html || "" }} />{(m.charts || []).map((c, i) => <AiChart key={i} c={c} />)}
              {m.done ? <div className="cdone">✓ {m.done}</div> : m.cancelled ? <div className="cdone mute">Cancelled</div> : m.acts && m.acts.length ? (
                <div className="cacts">{m.acts.map((a) => <button key={a.id} className={"btn small" + (m.pick ? " alt" : "")} onClick={() => run(m, a)}>{a.label}</button>)}
                  <button className="btn alt small" onClick={() => setLog((l) => l.map((x) => (x.id === m.id ? { ...x, cancelled: true, acts: [] } : x)))}>Cancel</button></div>) : null}
              {m.snap ? <div className="cacts"><button className="btn alt small" onClick={() => undo(m)}>↩ Undo</button></div> : null}
            </div>
          ))}
          <div ref={end} />
        </div>
        <div className="cchips">{C_CHIPS.map(([q, send]) => <button key={q} className="cchip" onClick={() => (send ? ask(q) : (setDraft(q), inp.current?.focus()))}>{q}</button>)}</div>
        <div className="chin">
          <input ref={inp} id="ch_in" type="text" enterKeyHint="send" autoComplete="off" autoCapitalize="sentences" placeholder="Ask or tell me what to do…" aria-label="Message the assistant" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); ask(draft); } }} />
          <button className="btn" disabled={busy} onClick={() => ask(draft)}>Send</button>
        </div>
      </div>
    </Sheet>
  );
}

function AiSettings({ cfg, setCfg }: { cfg: AI.AiSettings; setCfg: (s: AI.AiSettings) => void }) {
  const [key, setKey] = useState(cfg.key), [model, setModel] = useState(cfg.model), [test, setTest] = useState("");
  const save = (p: Partial<AI.AiSettings>) => setCfg(AI.saveAi(p));
  const check = async () => {
    setTest("Checking…");
    try { await AI.askAnalyst([], "Reply with the single word OK.", { settings: { on: true, key, model }, maxRounds: 1 }); setTest("✓ Works"); } catch (e: any) { setTest("✗ " + AI.friendly(e)); }
  };
  return (
    <div className="panel" id="ai_set" style={{ margin: "0 0 8px" }}>
      <label className="chkrow" style={{ paddingTop: 0 }}><input type="checkbox" checked={cfg.on} onChange={(e) => save({ on: e.target.checked })} /> Use the online data analyst when I have internet</label>
      <label htmlFor="ai_key" style={{ marginTop: 6 }}>Your Anthropic API key</label>
      <input id="ai_key" type="password" autoComplete="off" spellCheck={false} placeholder="sk-ant-…" value={key} onChange={(e) => setKey(e.target.value)} onBlur={() => save({ key: key.trim() })} />
      <label htmlFor="ai_model">Model</label><input id="ai_model" type="text" value={model} onChange={(e) => setModel(e.target.value)} onBlur={() => save({ model: model.trim() || AI.DEFAULT_MODEL })} />
      <div className="cacts"><button className="btn small" disabled={!key.trim()} onClick={() => { save({ key: key.trim(), model: model.trim() || AI.DEFAULT_MODEL }); check(); }}>Test</button><button className="btn alt small" onClick={() => { AI.clearAi(); setKey(""); setModel(AI.DEFAULT_MODEL); setCfg(AI.loadAi()); setTest("Key removed"); }}>Remove key</button></div>
      {test ? <p className="note" role="status">{test}</p> : null}
      <p className="note"><b>What is sent:</b> your question plus the goal, to-do and Money numbers it asks for (no Money notes). <b>Never sent:</b> Vault, passwords, backups. It can’t change anything. Data goes straight from this device to Anthropic with your key, and you pay for usage on your own account. The key stays only in this browser and is not in backups. Without internet or a key, the offline assistant answers.</p>
    </div>
  );
}
