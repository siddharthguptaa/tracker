/** Data model — identical to the legacy index.html (localStorage key "goal-tracker.v1"), so existing data loads unchanged. */
export type GoalType = "total" | "level" | "habit" | "milestones";
export type GoalStatus = "Not Started" | "In Progress" | "Completed" | "On Hold" | "Draft";

export interface LogEntry { id: string; date: string; amount: number; note?: string; auto?: boolean }
export interface Milestone { id: string; title: string; date: string; done: boolean; doneDate: string | null }
export interface Goal {
  id: string; name: string; category: string; type: GoalType; unit: string;
  baseline: number; total: number; start: string; end: string; status: GoalStatus;
  logs: LogEntry[]; checks?: string[]; milestones?: Milestone[]; habit?: { perWeek: number };
  focus: Record<string, boolean>; targets: Record<string, number | string>;
  dependsOn: string[]; plan: string; usesMoney?: boolean; archived?: boolean; notes?: string;
  recurring?: { active: boolean; amount: number; day: number; from?: string; last?: string | null };
  handover?: string | null;
  saveLink?: string;
  prevId?: string; [k: string]: any;
}
export interface Subtask { id: string; t: string; d: boolean }
export interface Todo {
  id: string; text: string; done: boolean; doneAt: number | null; created?: number;
  due?: string | null; time?: string; est?: number; someday?: boolean; goalId?: string | null;
  category?: string; repeat?: string; rdom?: number; tags: string[]; subs?: Subtask[]; notes?: string;
  nextId?: string; alerted?: any; [k: string]: any;
}
export interface Tag { id: string; name: string; color?: string; note?: string }
export interface Plan { id: string; age: number | null; start: string; end: string }
export interface VaultItem { id: string; title?: string; username?: string; uris?: string[]; url?: string; type?: string; trashed?: boolean; files?: { id: string; name: string; type: string; size: number }[]; [k: string]: any }
export interface Vault { v: number; items: VaultItem[]; folders: any[]; [k: string]: any }
export interface Settings {
  scope: string; focusYear: number | null; staleDays: number; sort: string; backupDays: number; lastBackup: number | null;
  theme: "system" | "light" | "dark" | "comfort" | "night"; accent: string; todoGroup: string; vaultClip: number;
  fxHaptic: boolean; fxSound: boolean; motivate: boolean; createdAt: number; todoSmart?: boolean; [k: string]: any;
}
export interface Engage { last?: string; streak?: number; best?: number; opens?: number; fresh?: boolean; wins?: Record<string, number>; perfect?: number }
export interface AppState {
  v: number; goals: Goal[]; categories: string[]; todos: Todo[]; tags: Tag[]; plans: Plan[];
  todoTemplates: { id: string; name: string; lines: string }[]; vault: Vault; vaultOld: any;
  settings: Settings; focusMeta: Record<string, number>; capacity: Record<string, any>; budget: Record<string, any>; reviews: Record<string, any>;
  engage?: Engage; [k: string]: any;
}

/** Money tracker data (owned by the embedded Money module; the host only reads it for analysis). */
export interface MoneyCategory { id: string; name: string; icon?: string; type: "income" | "expense"; [k: string]: any }
export interface MoneyAccount { id: string; name: string; icon?: string; open?: number; [k: string]: any }
export interface MoneyRecord { id: string; t: "i" | "e" | "x"; a: number; ac: string; to: string; c: string; n: string; d: string; tm: string; cr: number; rc?: string }
export interface MoneyBudget { id: string; c: string; l: number; m?: string }
export interface MoneyRecurring { id: string; on: boolean; name: string; a: number; c: string; ac: string; freq: "monthly" | "weekly" | "yearly"; next: string; day: number; end: string; auto: boolean }
export interface MoneyData {
  settings: { currency?: string; hide?: boolean; [k: string]: any }; accounts: MoneyAccount[]; categories: MoneyCategory[];
  records: MoneyRecord[]; budgets: MoneyBudget[]; recurring: MoneyRecurring[]; sgoals: any[]; loans: any[]; [k: string]: any;
}
export interface MoneyBookMeta { active: string; list: { id: string; name: string; key: string }[] }
