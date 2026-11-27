import { p2 } from "./clock";
export const trim2 = (x: number) => String(+x.toFixed(2));
export function fmt(n: any, unit?: string) {
  n = Number(n) || 0; const a = Math.abs(n); let s: string;
  if (unit === "₹") {
    if (a >= 1e7) s = trim2(n / 1e7) + " Cr"; else if (a >= 1e5) s = trim2(n / 1e5) + " L"; else s = n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
    return "₹" + s;
  }
  s = n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  return unit ? s + " " + unit : s;
}
export function fmtDate(s?: string | null) { if (!s) return "—"; return new Date(s + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
export const hm12 = (hm: string) => { if (!hm) return ""; const [h, m] = hm.split(":").map(Number); return ((h % 12) || 12) + ":" + p2(m) + " " + (h >= 12 ? "PM" : "AM"); };
export const estText = (m: number) => (m < 60 ? m + "m" : Math.floor(m / 60) + "h" + (m % 60 ? " " + (m % 60) + "m" : ""));
export const monthsText = (m: number) => (m >= 24 ? (m / 12).toFixed(1) + " years" : m + " month" + (m === 1 ? "" : "s"));
export const esc = (s: any) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c]);
export const uid = () => Math.random().toString(36).slice(2, 10);
