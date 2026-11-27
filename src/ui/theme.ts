import { getState } from "../domain/ctx";
export const ACCENTS: Record<string, { n: string; l: string[]; d: string[] }> = {
  indigo: { n: "Indigo", l: ["#4f46e5", "#eceafd"], d: ["#8b86ff", "#25244a"] },
  teal: { n: "Teal", l: ["#0f766e", "#dcf5f1"], d: ["#2dd4bf", "#12332f"] },
  rose: { n: "Rose", l: ["#be185d", "#fce7f1"], d: ["#f472b6", "#3d1830"] },
  orange: { n: "Orange", l: ["#c2410c", "#ffedd5"], d: ["#fb923c", "#3d2412"] },
  green: { n: "Green", l: ["#15803d", "#dcfce7"], d: ["#4ade80", "#143221"] },
};
export function isDarkNow(): boolean {
  const t = getState().settings.theme;
  if (t === "dark" || t === "night") return true;
  if (t === "light" || t === "comfort") return false;
  try { return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches); } catch { return false; }
}
export function applyTheme() {
  const s = getState().settings, root = document.documentElement;
  if (s.theme === "light" || s.theme === "dark" || s.theme === "comfort" || s.theme === "night") root.setAttribute("data-theme", s.theme); else root.removeAttribute("data-theme");
  const a = ACCENTS[s.accent] || ACCENTS.indigo, c = isDarkNow() ? a.d : a.l;
  if (s.accent === "indigo" || !s.accent) { root.style.removeProperty("--accent"); root.style.removeProperty("--accent-soft"); }
  else { root.style.setProperty("--accent", c[0]); root.style.setProperty("--accent-soft", c[1]); }
  const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (meta) meta.content = s.theme === "comfort" ? "#efe6d2" : s.theme === "night" ? "#1d1a15" : c[0];
}
export function tallyThemeVars() {
  const cs = getComputedStyle(document.documentElement), g = (n: string) => cs.getPropertyValue(n).trim();
  return { "--bg": g("--bg"), "--bar": g("--card"), "--surface": g("--card"), "--soft": g("--grey-soft"), "--ink": g("--ink"), "--muted": g("--mute"), "--line": g("--line"), "--accent": g("--accent"), "--on-accent": g("--accent-ink"), "--accent-soft": g("--accent-soft"), "--income": g("--green"), "--expense": g("--red"), "--track": g("--bar"), "--shadow": g("--shadow"), "--dark": isDarkNow() ? "1" : "0" };
}
