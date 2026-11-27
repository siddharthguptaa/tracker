import type { MoneyBookMeta, MoneyData } from "../domain/types";
/** Read/write access to the embedded Money tracker's data (it lives in localStorage under its own keys). */
export const TALLY_KEY = "tally:app:v1";
export const TALLY_BOOKS_KEY = "tally:books:v1";

let hidden = false;           // the Money "hide amounts" eye, mirrored on Home
const moneyListeners = new Set<() => void>();
export const isHidden = () => hidden;
export const setHidden = (v: boolean) => { hidden = v; };
/** UI subscribes so the embedded Money frame reloads after the host changed its data. */
export const onMoneyChanged = (fn: () => void) => { moneyListeners.add(fn); return () => { moneyListeners.delete(fn); }; };
export const moneyChanged = () => moneyListeners.forEach((f) => f());

export function tallyBooks(): MoneyBookMeta {
  try {
    const b = JSON.parse(localStorage.getItem(TALLY_BOOKS_KEY) || "null");
    if (b && Array.isArray(b.list) && b.list.length) { b.list = b.list.filter((x: any) => x && x.id && x.key && x.name); if (b.list.some((x: any) => x.id === b.active)) return b; }
  } catch { /* fall through to default */ }
  return { active: "b1", list: [{ id: "b1", name: "My money", key: TALLY_KEY }] };
}
export const tallyActiveKey = () => { const b = tallyBooks(); return (b.list.find((x) => x.id === b.active) || b.list[0]).key; };
export function tallyRaw(key?: string): string | null { try { return localStorage.getItem(key || tallyActiveKey()); } catch { return null; } }
export function readMoney(key?: string): MoneyData | null {
  try { const d = JSON.parse(tallyRaw(key) || "null"); return d && Array.isArray(d.records) ? d : null; } catch { return null; }
}
export const mAmt = (cents: number, cur: string) => hidden ? cur + "••••" : (cents < 0 ? "−" : "") + cur + Math.abs(Math.round(cents / 100)).toLocaleString("en-IN");

