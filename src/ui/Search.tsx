import { useMemo, useState, useEffect, useRef } from "react";
import { Sheet } from "./Sheet";
import { gsIndex, gsSearch } from "../domain/search";
import { pctText } from "../domain/goals";
import { fmtDate } from "../domain/format";
import { mAmt, tallyBooks } from "../storage/moneyStore";
import { setUi } from "./uiStore";

const Row = ({ icon, title, sub, onClick }: { icon?: string; title: string; sub?: string; onClick: () => void }) => (
  <button className="list-btn" onClick={onClick}><span>{icon} {title}{sub ? <small>{sub}</small> : null}</span>›</button>
);

export function SearchSheet() {
  const [q, setQ] = useState(""), idx = useMemo(() => gsIndex(), []), ref = useRef<HTMLInputElement>(null);
  useEffect(() => { const t = setTimeout(() => ref.current?.focus(), 80); return () => clearTimeout(t); }, []);
  const r = gsSearch(q, idx), none = !r.short && !r.goals.length && !r.todos.length && !r.money.length && !r.vault.length;
  const Sec = ({ title, n, shown, children }: { title: string; n: number; shown: number; children: any }) => (n ? <><h2>{title}</h2>{children}{n > shown ? <p className="note">+{n - shown} more — refine your search</p> : null}</> : null);
  const go = (p: any) => setUi({ sheet: null, ...p });
  return (
    <Sheet label="Search">
      <h1>Search</h1>
      <input ref={ref} id="gs_q" type="search" placeholder="Goals, to-dos, Money, Vault…" autoComplete="off" aria-label="Search the whole app" value={q} onChange={(e) => setQ(e.target.value)} />
      <div id="gs_res" style={{ marginTop: 6 }}>
        {r.short ? <p className="note">Type at least 2 letters. Searches goals, to-dos, Money records in every book, and Vault titles (never passwords).</p> : null}
        <Sec title="🎯 Goals" n={r.goals.length} shown={6}>{r.goals.slice(0, 6).map((g) => <Row key={g.id} title={g.name} sub={g.category + " · " + pctText(g)} onClick={() => go({ tab: "goals", page: { kind: "detail", id: g.id } })} />)}</Sec>
        <Sec title="✅ To-dos" n={r.todos.length} shown={8}>{r.todos.slice(0, 8).map((t) => <Row key={t.id} icon={t.done ? "☑" : "☐"} title={t.text} sub={(t.due ? fmtDate(t.due) : "No date") + (t.done ? " · done" : "")} onClick={() => go({ tab: "todo", tf: t.done ? "done" : "all", page: null })} />)}</Sec>
        <Sec title="💰 Money" n={r.money.length} shown={8}>{r.money.slice(0, 8).map((m, i) => <Row key={i} icon={m.cat ? m.cat.icon : "⇄"} title={(m.cat ? m.cat.name : "Transfer") + " · " + mAmt(m.r.a, m.cur)} sub={fmtDate(m.r.d) + (m.r.n ? " · " + String(m.r.n).slice(0, 60) : "") + (r.multiBook ? " · " + m.book.name : "")} onClick={() => go({ tab: "money", page: null })} />)}</Sec>
        <Sec title="🔐 Vault" n={r.vault.length} shown={6}>{r.vault.slice(0, 6).map((v) => <Row key={v.id} title={v.title || "Untitled"} sub={v.type} onClick={() => go({ tab: "vault", page: null })} />)}</Sec>
        {none ? <p className="note">Nothing found for “{q.trim()}”.</p> : null}
      </div>
    </Sheet>
  );
}
void tallyBooks;
