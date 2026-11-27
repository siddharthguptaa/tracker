import { getState } from "../domain/ctx";
import { tallyThemeVars } from "./theme";
import { play } from "./fx";
import { setUi, getUi } from "./uiStore";

export const tallyFrame = () => document.getElementById("tallyframe") as HTMLIFrameElement | null;
export function tallyApi(): any { try { return (tallyFrame()?.contentWindow as any)?.TallyAPI || null; } catch { return null; } }
export function syncTallyTheme() { try { tallyApi()?.applyTheme(); } catch { /* not ready */ } }

/** Hooks the Money module (same-origin iframe) calls on `window.parent`. */
export function installParentHooks() {
  const w = window as any;
  w.tallyThemeVars = tallyThemeVars;
  w.__fx = (k: string) => play(k);
  w.tallyGoals = () => {
    try { return getState().goals.filter((g) => !g.archived).map((g) => ({ id: g.id, name: g.name, category: g.category, unit: g.unit || "", total: g.total, end: g.end, status: g.status, usesMoney: !!g.usesMoney })); } catch { return []; }
  };
  w.tallyLayers = (n: number, sheet: any) => { document.body.classList.toggle("tlayer", n > 0 && !!sheet); if (w.__tlayers !== n) { w.__tlayers = n; setUi({}); } };
  w.tallyTabChanged = (t: string) => { if (w.__msub !== t) { w.__msub = t; if (getUi().tab === "money") setUi({}); } };
}
