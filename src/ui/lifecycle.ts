/* Where-you-were restore, Back-gesture guard, update check, home-screen shortcuts and the blank-screen guard (ported from the classic app). */
import { getState } from "../domain/ctx";
import { getUi, setUi, subscribeUi, toast, openSheet, type Tab } from "./uiStore";
import { tallyApi } from "./tally";
import { askOpen, askClose } from "./ask";

/** The last page is remembered until you move on; there is no expiry. */
export const NAV_KEY = "tracker.nav.v1";
const TABS: Tab[] = ["home", "goals", "todo", "money", "vault"];

export function saveNav(): void {
  try { const u = getUi(); localStorage.setItem(NAV_KEY, JSON.stringify({ t: Date.now(), tab: u.tab, gsub: u.gsub, tview: u.tview, tf: u.tf, tagf: u.tagf || null, cm: u.cm || null, cday: u.cday || null, cat: u.cat, year: u.year, plan: u.plan, y: Math.round((typeof window !== "undefined" && window.scrollY) || 0), page: u.page && u.page.kind === "detail" ? u.page.id : null, msub: (typeof window !== "undefined" && (window as any).__msub) || null })); } catch { /* storage blocked */ }
}
export function restoreNav(): any | null {
  try {
    const raw = localStorage.getItem(NAV_KEY); if (!raw) return null; const n = JSON.parse(raw);
    if (!n || !(TABS.includes(n.tab) || n.tab === "settings")) return null;
    const p: any = { tab: n.tab }; ["gsub", "tview", "tf", "tagf", "cm", "cday", "cat", "year", "plan"].forEach((k) => { if (n[k]) p[k] = n[k]; });
    if (n.page && getState().goals.some((g) => g.id === n.page)) p.page = { kind: "detail", id: n.page };
    setUi(p); if (n.msub) (window as any).__msub = n.msub; return n;
  } catch { return null; }
}
let navT: any; const queueNav = () => { clearTimeout(navT); navT = setTimeout(saveNav, 250); };

/** Close the top-most thing first. Returns true when something was closed. */
export function handleBack(): boolean {
  const u = getUi();
  if (askOpen()) { askClose(); return true; }
  if (u.sheet || document.getElementById("ov")) { setUi({ sheet: null, sheetArg: null, importItems: [], prefill: null }); return true; }
  if (u.tab === "money") { try { const a = tallyApi(); if (a && a.back && a.back()) return true; } catch { /* not ready */ } }
  if (u.page) { setUi({ page: null, editLog: null, editMs: null }); return true; }
  if (u.tab !== "home") { setUi({ tab: "home" }); window.scrollTo(0, 0); return true; }
  return false;
}
export function initBackGuard(): void {
  const arm = () => { try { if (history.state && history.state.tk === 0) history.pushState({ tk: 1 }, "", location.href); } catch { /* ignore */ } };
  const w: any = window;
  w.__armBack = () => { try { if (!history.state || history.state.tk === undefined) { history.replaceState({ tk: 0 }, "", location.href); history.pushState({ tk: 1 }, "", location.href); } else arm(); } catch { /* ignore */ } };
  ["pointerdown", "touchend", "click", "keydown"].forEach((t) => window.addEventListener(t, w.__armBack, true));
  window.addEventListener("popstate", (e) => {
    if (!e.state || e.state.tk !== 0) return;
    if (handleBack()) { try { history.pushState({ tk: 1 }, "", location.href); } catch { /* ignore */ } return; }
    toast("Press back again to exit");
  });
  window.addEventListener("pageshow", (e: any) => { if (e.persisted) w.__armBack(); });
}

/* ---- update check: compare the app bundle this page loaded with the bundle the live index.html points to ---- */
export const bundleOf = (html: string) => { const m = /assets\/index-[\w-]+\.js/.exec(html); return m ? m[0] : null; };
export const loadedBundle = () => { const s = Array.from(document.scripts).map((x) => x.getAttribute("src") || "").find((x) => /assets\/index-[\w-]+\.js/.test(x)); return s ? bundleOf(s) : null; };
export async function checkForUpdate(fetcher: typeof fetch = fetch, loaded: string | null = loadedBundle()): Promise<"same" | "new" | "err"> {
  try {
    const r = await fetcher("./index.html?nocache=" + Date.now(), { cache: "no-store" }); if (!r.ok) return "err";
    const live = bundleOf(await r.clone().text()); if (!live) return "err"; if (!loaded || live === loaded) return "same";
    try { for (const k of await caches.keys()) if (k.startsWith("tracker-")) { const c = await caches.open(k); await c.put(new Request("./index.html"), r.clone()); await c.put(new Request("./"), r.clone()); } } catch { /* no cache API */ }
    toast("An update is ready", { label: "Reload", fn: () => location.reload() }); return "new";
  } catch { return "err"; }
}
let updAt = 0; export const autoUpdate = () => { if (Date.now() - updAt < 20 * 60 * 1000 || !navigator.onLine) return; updAt = Date.now(); void checkForUpdate(); };

export function blankGuard(): void {
  const a = document.getElementById("root"); if (a && !a.children.length) a.innerHTML = '<div class="panel" style="margin:30px 0;text-align:center"><b>Something went wrong</b><p class="note">Your data is safe on this device.</p><button class="btn" onclick="location.reload()">Reload</button></div>';
}

/* ---- home-screen shortcuts: ?add=todo, ?add=expense, ?add=income, ?tab=money ---- */
export const QUICK_LINKS: [string, string][] = [["Add to-do", "?add=todo"], ["Add expense", "?add=expense"], ["Add income", "?add=income"], ["Open Money", "?tab=money"]];
export function quickMoney(t: "e" | "i") {
  setUi({ sheet: null, tab: "money", page: null }); window.scrollTo(0, 0); let n = 0;
  const iv = setInterval(() => { const a = tallyApi(); n++; if (a && a.addRecord) { clearInterval(iv); if (a.addRecord(t) === false) toast("Money is locked — unlock it, then tap +"); } else if (n > 40) { clearInterval(iv); toast("Money is still loading — tap + inside Money"); } }, 150);
}
export function handleLaunch(search = location.search): string | null {
  let q: URLSearchParams; try { q = new URLSearchParams(search); } catch { return null; } const add = q.get("add"), tab = q.get("tab");
  if (!add && !tab) return null;
  try { history.replaceState(null, "", location.pathname + location.hash); } catch { /* ignore */ }
  if (tab && TABS.includes(tab as Tab)) setUi({ tab: tab as Tab, page: null });
  if (add === "todo") { setUi({ tab: "todo", page: null }); openSheet("todonew", null); }
  else if (add === "expense" || add === "income") quickMoney(add === "income" ? "i" : "e");
  return add || tab;
}
export function installLifecycle() {
  subscribeUi(queueNav); window.addEventListener("scroll", queueNav, { passive: true }); document.addEventListener("visibilitychange", () => { if (document.hidden) saveNav(); else setTimeout(autoUpdate, 1500); });
  window.addEventListener("pagehide", saveNav); window.addEventListener("error", () => setTimeout(blankGuard, 50)); window.addEventListener("unhandledrejection", () => setTimeout(blankGuard, 50)); setTimeout(blankGuard, 3000);
  setTimeout(autoUpdate, 5000); initBackGuard();
}
