import { useSyncExternalStore } from "react";
import type { AppState } from "../domain/types";
import { getState, setState } from "../domain/ctx";
import { KEY, parseStored, seed } from "../domain/normalize";

type Listener = () => void;
const listeners = new Set<Listener>();
let version = 0;
let dirty = false;           // set when something changed behind an open sheet (assistant), so the page refreshes on close
let onSaveError: (() => void) | null = null;

export function initStore(): AppState {
  let s: AppState | null = null;
  try { s = parseStored(localStorage.getItem(KEY)); } catch { s = null; }
  setState(s || seed());
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch { /* optional */ }
  return getState();
}
export const setSaveErrorHandler = (fn: () => void) => { onSaveError = fn; };
export function persist() { try { localStorage.setItem(KEY, JSON.stringify(getState())); } catch { onSaveError && onSaveError(); } }
/** Save and tell React something changed. */
export function commit() { persist(); version++; listeners.forEach((l) => l()); }
export const markDirty = () => { dirty = true; };
export function takeDirty() { const d = dirty; dirty = false; return d; }
export const subscribe = (l: Listener) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const getVersion = () => version;
/** React hook: re-renders on every commit(). Returns the (mutable) state object. */
export function useAppState(): AppState { useSyncExternalStore(subscribe, getVersion); return getState(); }

/** Snapshot used by Undo (same fields as the legacy snapState). */
export function snapState() {
  const s = getState();
  return JSON.stringify({ goals: s.goals, todos: s.todos, tags: s.tags, vault: s.vault, categories: s.categories, plans: s.plans, todoTemplates: s.todoTemplates });
}
export function restoreSnap(snap: string) { Object.assign(getState(), JSON.parse(snap)); commit(); }
