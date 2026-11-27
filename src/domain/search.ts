import { getState } from "./ctx";
import { tallyBooks, tallyRaw } from "../storage/moneyStore";

export interface MoneyHit { book: any; r: any; cur: string; cat: any; hay: string }
export interface SearchResults {
  short: boolean;
  goals: any[]; todos: any[]; money: MoneyHit[]; vault: any[];
  multiBook: boolean;
}

/** Index of every Money record in every book (built once per search sheet open). */
export function gsIndex(): { money: MoneyHit[] } {
  const idx = { money: [] as MoneyHit[] };
  tallyBooks().list.forEach((b: any) => {
    let D: any; try { D = JSON.parse(tallyRaw(b.key) || "null"); } catch (e) { D = null; }
    if (!D || !Array.isArray(D.records)) return;
    const cat: Record<string, any> = {}, acc: Record<string, any> = {};
    (D.categories || []).forEach((c: any) => { cat[c.id] = c; });
    (D.accounts || []).forEach((a: any) => { acc[a.id] = a; });
    const cur = (D.settings && D.settings.currency) || "₹";
    D.records.forEach((r: any) => {
      const c = cat[r.c], a = acc[r.ac], plain = (Number(r.a) / 100).toFixed(2);
      idx.money.push({ book: b, r, cur, cat: c, hay: ((r.n || "") + " " + (c ? c.name : r.t === "x" ? "transfer" : "") + " " + (a ? a.name : "") + " " + plain + " " + plain.replace(/\.00$/, "")).toLowerCase() });
    });
  });
  return idx;
}

/** Search goals, to-dos, Money records and Vault titles (never passwords). */
export function gsSearch(query: string, idx: { money: MoneyHit[] } = gsIndex()): SearchResults {
  const q = query.trim().toLowerCase(), state = getState();
  const empty: SearchResults = { short: true, goals: [], todos: [], money: [], vault: [], multiBook: false };
  if (q.length < 2) return empty;
  const has = (s: any) => String(s || "").toLowerCase().includes(q);
  const goals = state.goals.filter((g: any) => has(g.name) || has(g.category) || has(g.notes));
  const todos = state.todos.filter((t: any) => has(t.text) || has(t.notes) || (t.tags || []).some((id: string) => { const tg = state.tags.find((x: any) => x.id === id); return tg && has(tg.name); }) || (t.subs || []).some((s: any) => has(s.t || s.text)));
  const vault = state.vault.items.filter((i: any) => !i.trashed).filter((i: any) => has(i.title) || has(i.username) || (i.uris || []).some(has) || has(i.url));
  const money = idx.money.filter(m => m.hay.includes(q)).sort((a, b) => (a.r.d < b.r.d ? 1 : -1));
  return { short: false, goals, todos, money, vault, multiBook: tallyBooks().list.length > 1 };
}
