import { todayStr } from "./clock";
import { tallyRaw } from "../storage/moneyStore";

export interface MoneyStats { cur: string; inc: number; exp: number; bal: number; top: { name: string; icon: string; v: number }[]; over: number; near: number; n: number; hide: boolean }

/** This-month summary for the Home Money card (per book when `key` is given). Returns null when no usable data. */
export function moneyStats(key?: string): MoneyStats | null {
  let D: any; try { D = JSON.parse(tallyRaw(key) || "null"); } catch { D = null; }
  if (!D || !Array.isArray(D.records)) return null;
  const cur = (D.settings && D.settings.currency) || "₹", mo = todayStr().slice(0, 7);
  let inc = 0, exp = 0; const byCat: Record<string, number> = {}, acc: Record<string, number> = {}, cats: Record<string, any> = {};
  (D.accounts || []).forEach((a: any) => { acc[a.id] = Number(a.open) || 0; });
  (D.categories || []).forEach((c: any) => { cats[c.id] = c; });
  D.records.forEach((r: any) => {
    const a = Number(r.a) || 0;
    if (r.t === "i") acc[r.ac] = (acc[r.ac] || 0) + a; else if (r.t === "e") acc[r.ac] = (acc[r.ac] || 0) - a; else if (r.t === "x") { acc[r.ac] = (acc[r.ac] || 0) - a; acc[r.to] = (acc[r.to] || 0) + a; }
    if (String(r.d || "").slice(0, 7) === mo) { if (r.t === "i") inc += a; else if (r.t === "e") { exp += a; byCat[r.c] = (byCat[r.c] || 0) + a; } }
  });
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, v]) => ({ name: (cats[id] || {}).name || "Uncategorized", icon: (cats[id] || {}).icon || "❔", v }));
  const bud = (D.budgets || []).filter((b: any) => b && b.l > 0 && (!b.m || b.m === mo)).map((b: any) => ({ l: b.l, sp: byCat[b.c] || 0 }));
  return { cur, inc, exp, bal: Object.values(acc).reduce((x, v) => x + v, 0), top, over: bud.filter((x: any) => x.sp > x.l).length, near: bud.filter((x: any) => x.sp <= x.l && x.sp >= x.l * 0.8).length, n: D.records.length, hide: !!(D.settings && D.settings.hide) };
}
