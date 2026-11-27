import type { AppState } from "./types";
/** The one place domain logic reads the current app state from (set by the store, or by tests). */
let current: AppState | null = null;
export const getState = (): AppState => { if (!current) throw new Error("state not initialised"); return current; };
export const setState = (s: AppState) => { current = s; };
