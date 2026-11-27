/** Date helpers. All of them read `Date` at call time, so tests can freeze time with vi.setSystemTime(). */
export const DAY = 86400000;
export const p2 = (n: number | string) => String(n).padStart(2, "0");
export const isoOf = (ms: number) => { const d = new Date(ms); return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()); };
export const todayStr = () => isoOf(Date.now());
export const ts = (s: string) => new Date(s + "T00:00:00").getTime();
export const curYear = () => new Date().getFullYear();
export function addDays(iso: string, n: number) { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return isoOf(d.getTime()); }
export function mondayOf(iso: string) { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return isoOf(d.getTime()); }
export const dowOf = (iso: string) => new Date(iso + "T00:00:00").getDay();
export function nextDow(dow: number, from: string, strict: boolean) { let add = (dow - dowOf(from) + 7) % 7; if (add === 0 && strict) add = 7; return addDays(from, add); }
export function addMonthsIso(iso: string, n: number, dom?: number) {
  const [y, m, d] = iso.split("-").map(Number), t = new Date(y, m - 1 + n, 1), dim = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  return t.getFullYear() + "-" + p2(t.getMonth() + 1) + "-" + p2(Math.min(dom || d, dim));
}
export const nowHM = () => { const d = new Date(); return p2(d.getHours()) + ":" + p2(d.getMinutes()); };
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const byDate = (a: { date: string }, b: { date: string }) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
export const year = (s: string) => +String(s).slice(0, 4);
