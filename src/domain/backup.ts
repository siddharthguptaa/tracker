import { getState, setState } from "./ctx";
import { todayStr } from "./clock";
import { normalize } from "./normalize";
import { tallyBooks, tallyRaw } from "../storage/moneyStore";
import { snapState, restoreSnap, commit } from "../storage/store";

export const BK_APP = "tracker-backup";
export const BK_MODULES = ["goals", "todos", "vault", "money"] as const;
export type BkModule = typeof BK_MODULES[number];
export interface BackupFile { name: string; mod: BkModule; obj: any; text: string }

/** Pluggable vault attachment store (IndexedDB in the browser, a Map in tests). */
export interface FileStore {
  get(id: string): Promise<{ type?: string; b64: string } | null>;
  put(id: string, type: string, b64: string): Promise<void>;
  dropAll(): void;
}
export const noFiles: FileStore = { get: async () => null, put: async () => {}, dropAll() {} };

export async function buildBackups(build: string, files: FileStore = noFiles, now = new Date()): Promise<BackupFile[]> {
  const state = getState();
  const hdr = (m: string) => ({ app: BK_APP, v: 1, module: m, created: now.toISOString(), build });
  const d = todayStr(), out: BackupFile[] = [];
  out.push({ name: `tracker-goals-${d}.json`, mod: "goals", text: "", obj: { ...hdr("goals"), data: { goals: state.goals, plans: state.plans, categories: state.categories, focusMeta: state.focusMeta, capacity: state.capacity, budget: state.budget, reviews: state.reviews, settings: state.settings, engage: state.engage || {} } } });
  out.push({ name: `tracker-todos-${d}.json`, mod: "todos", text: "", obj: { ...hdr("todos"), data: { todos: state.todos, tags: state.tags, todoTemplates: state.todoTemplates } } });
  const fmap: Record<string, any> = {};
  for (const it of state.vault.items) for (const f of (it.files || [])) { try { const bl = await files.get(f.id); if (bl) fmap[f.id] = { type: bl.type || f.type || "", b64: bl.b64 }; } catch (e) {} }
  out.push({ name: `tracker-vault-${d}.json`, mod: "vault", text: "", obj: { ...hdr("vault"), data: { vault: state.vault, vaultOld: state.vaultOld || null, files: fmap } } });
  const bk = tallyBooks(), keys: Record<string, string> = {};
  bk.list.forEach((b: any) => { const r = tallyRaw(b.key); if (r) keys[b.key] = r; });
  if (Object.keys(keys).length) out.push({ name: `tracker-money-${d}.json`, mod: "money", text: "", obj: { ...hdr("money"), data: { books: bk, keys } } });
  out.forEach(o => { o.text = JSON.stringify(o.obj); });
  return out;
}

/** Parse backup file contents; newest file per module wins. Non-backup files are ignored. */
export function parseBackups(texts: string[]): Partial<Record<BkModule, any>> {
  const mods: Partial<Record<BkModule, any>> = {};
  for (const t of texts) {
    try {
      const o = JSON.parse(t);
      if (o && o.app === BK_APP && o.data && (BK_MODULES as readonly string[]).includes(o.module)) {
        const m = o.module as BkModule;
        if (!mods[m] || o.created > mods[m].created) mods[m] = o;
      }
    } catch (e) {}
  }
  return mods;
}

export function describeBackups(mods: Partial<Record<BkModule, any>>): string {
  const line = (m: BkModule) => {
    const d = mods[m].data;
    return m === "goals" ? `Goals (${(d.goals || []).length})` : m === "todos" ? `To-dos (${(d.todos || []).length})` : m === "vault" ? `Vault (${((d.vault || {}).items || []).length} items)` : `Money (${Object.keys(d.keys || {}).length} book${Object.keys(d.keys || {}).length === 1 ? "" : "s"})`;
  };
  return (Object.keys(mods) as BkModule[]).map(line).join(", ");
}

export interface RestoreUndo { snap: string; money: { meta: string | null; keys: Record<string, string | null> } }

/** Apply parsed backups to state. Returns data needed to undo. */
export async function applyRestore(mods: Partial<Record<BkModule, any>>, files: FileStore = noFiles): Promise<RestoreUndo> {
  const state = getState();
  const found = Object.keys(mods) as BkModule[];
  const undo: RestoreUndo = { snap: snapState(), money: { meta: localStorage.getItem("tally:books:v1"), keys: {} } };
  tallyBooks().list.forEach((b: any) => { undo.money.keys[b.key] = tallyRaw(b.key); });
  for (const m of found) {
    const d = mods[m].data;
    if (m === "goals") {
      ["goals", "plans", "categories", "focusMeta", "capacity", "budget", "reviews"].forEach(k => { if (d[k] !== undefined) state[k] = d[k]; });
      if (d.settings) {
        const keep = { fxHaptic: state.settings.fxHaptic, fxSound: state.settings.fxSound, motivate: state.settings.motivate, lastBackup: state.settings.lastBackup, createdAt: state.settings.createdAt };
        state.settings = Object.assign({}, state.settings, d.settings, keep);
      }
      if (d.engage) state.engage = d.engage;
    } else if (m === "todos") {
      state.todos = d.todos || []; state.tags = d.tags || [];
      if (d.todoTemplates) state.todoTemplates = d.todoTemplates;
    } else if (m === "vault") {
      files.dropAll();
      for (const id of Object.keys(d.files || {})) { try { await files.put(id, d.files[id].type, d.files[id].b64); } catch (e) {} }
      state.vault = d.vault || { v: 2, items: [], folders: [] }; state.vaultOld = d.vaultOld || null;
    } else if (m === "money") {
      Object.keys(d.keys || {}).forEach(k => { try { localStorage.setItem(k, d.keys[k]); } catch (e) {} });
      if (d.books && d.books.list) try { localStorage.setItem("tally:books:v1", JSON.stringify(d.books)); } catch (e) {}
    }
  }
  setState(normalize(state)); commit();
  return undo;
}

export function undoRestore(u: RestoreUndo) {
  restoreSnap(u.snap);
  Object.keys(u.money.keys).forEach(k => { if (u.money.keys[k] === null) localStorage.removeItem(k); else localStorage.setItem(k, u.money.keys[k] as string); });
  if (u.money.meta === null) localStorage.removeItem("tally:books:v1"); else localStorage.setItem("tally:books:v1", u.money.meta);
}
export { normalize };
