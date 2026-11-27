import { useSyncExternalStore } from "react";
import { getState } from "../domain/ctx";

export type Tab = "home" | "goals" | "todo" | "money" | "vault" | "settings";
export type SheetKind = null | "chat" | "search" | "goalnew" | "todonew" | "backup" | "vdetail" | "vedit" | "vgen" | "vhealth" | "vemerg" | "vsettings" | "tdedit" | "tdtags" | "tdtpl" | "tdstats" | "tdsettings" | "tdmove" | "quick" | "goaledit" | "review" | "handover" | "gimport";

export interface UiState {
  tab: Tab;
  gsub: "overview" | "years" | "timeline" | "trends" | "outlook";
  year: number; plan: string | null; cat: string; q: string; range: number; tg: string | null; showArch: boolean; editLog: string | null; editMs: string | null; hw: number; prefill: any; importItems: any[];
  tf: string;                    // to-do filter
  sheet: SheetKind;
  sheetArg: any;
  page: { kind: "detail"; id: string } | null;
  tview: "list" | "cal"; cm: string | null; cday: string | null; selMode: boolean; sel: Record<string, boolean>; tagf: string | null; alerts: string[]; tpWhen: "none" | "today" | "tomorrow";
  toast: { msg: string; action?: { label: string; fn: () => void }; key: number } | null;
}
let ui: UiState = { tab: "home", gsub: "overview", year: new Date().getFullYear(), plan: null, cat: "All", q: "", range: 12, tg: null, showArch: false, editLog: null, editMs: null, hw: 0, prefill: null, importItems: [], tf: "today", sheet: null, sheetArg: null, page: null, toast: null, tview: "list", cm: null, cday: null, selMode: false, sel: {}, tagf: null, alerts: [], tpWhen: "none" };
const ls = new Set<() => void>();
let ver = 0;
export const getUi = () => ui;
export function subscribeUi(f: () => void) { ls.add(f); return () => { ls.delete(f); }; }
export function setUi(p: Partial<UiState>) { ui = { ...ui, ...p }; ver++; ls.forEach((l) => l()); }
export function useUi(): UiState { useSyncExternalStore((l) => { ls.add(l); return () => ls.delete(l); }, () => ver); return ui; }

let toastTimer: any;
export function toast(msg: string, action?: { label: string; fn: () => void }) {
  setUi({ toast: { msg, action, key: Date.now() } });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => setUi({ toast: null }), action ? 7000 : 2400);
}
export function dismissToast() { clearTimeout(toastTimer); setUi({ toast: null }); }
export const openSheet = (sheet: SheetKind, sheetArg: any = null) => setUi({ sheet, sheetArg });
export const goTab = (t: Tab) => setUi({ tab: t, page: null });
export const settings = () => getState().settings;
