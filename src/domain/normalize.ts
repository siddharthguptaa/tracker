import type { AppState } from "./types";
import { curYear } from "./clock";

export const KEY = "goal-tracker.v1";
export const STATUSES = ["Not Started", "In Progress", "Completed", "On Hold", "Draft"] as const;
export const REVIEW_DAYS = 182;
export const TPL_SEEDS = [
  { id: "tpl_trip", name: "Travel packing", lines: "Phone, charger and power bank\nWallet, ID and tickets\nMedicines and toiletries\nClothes for each day\nLock the house and switch off the gas" },
  { id: "tpl_week", name: "Weekly review", lines: "Clear the inbox\nReview next week's calendar\nPay pending bills\nPlan three priorities for next week" },
  { id: "tpl_bills", name: "Monthly bills", lines: "Pay rent every month\nPay electricity bill\nPay mobile and internet bill\nPay credit card bill" },
];

/** A brand-new install starts empty: no goals, no personal data. */
export function seed(): AppState {
  return normalize({ v: 2, goals: [], categories: ["Financial", "Personal", "Career", "Health", "Family", "Learning"] });
}

/** Fills defaults and repairs shape. Never drops unknown fields, so data written by the legacy app survives a round-trip. */
export function normalize(d: any): AppState {
  d.settings = Object.assign({ scope: "focus", focusYear: null, staleDays: 180, sort: "default", backupDays: 30, lastBackup: null, theme: "system", accent: "indigo", todoGroup: "category", vaultClip: 30, fxHaptic: true, fxSound: true, motivate: true }, d.settings || {});
  if (!d.settings.createdAt) d.settings.createdAt = Date.now();
  d.goals = Array.isArray(d.goals) ? d.goals.filter((x: any) => x && typeof x === "object") : [];
  d.categories = Array.isArray(d.categories) ? d.categories : [];
  d.todos = Array.isArray(d.todos) ? d.todos.filter((x: any) => x && typeof x === "object") : [];
  if (d.vault && d.vault.ct) { d.vaultOld = d.vault; d.vault = null; }
  if (!d.vault || !Array.isArray(d.vault.items)) d.vault = { v: 2, items: [], folders: [] };
  d.vault.folders = Array.isArray(d.vault.folders) ? d.vault.folders : [];
  d.vault.items = d.vault.items.filter((i: any) => i && typeof i === "object" && i.id);
  d.vaultOld = d.vaultOld && d.vaultOld.ct ? d.vaultOld : null;
  d.tags = Array.isArray(d.tags) ? d.tags : [];
  d.todos.forEach((t: any) => { t.tags = t.tags || []; if (t.subs && !Array.isArray(t.subs)) delete t.subs; });
  if (!Array.isArray(d.todoTemplates)) d.todoTemplates = TPL_SEEDS.map((x) => ({ ...x }));
  d.todoTemplates = d.todoTemplates.filter((x: any) => x && x.id && typeof x.name === "string" && typeof x.lines === "string");
  d.plans = Array.isArray(d.plans) && d.plans.length ? d.plans : (() => { const y0 = new Date().getFullYear(); return [{ id: "p1", age: null, start: y0 + "-01-01", end: y0 + 6 + "-12-31" }]; })();
  d.focusMeta = d.focusMeta || {}; d.capacity = d.capacity || {}; d.budget = d.budget || {}; d.reviews = d.reviews || {};
  d.goals.forEach((g: any) => {
    g.focus = g.focus || {}; g.targets = g.targets || {}; g.logs = g.logs || []; g.dependsOn = g.dependsOn || [];
    if (g.type === "milestones") { g.milestones = g.milestones || []; g.total = Math.max(1, g.milestones.length); }
    if (g.type === "habit") { g.habit = g.habit || { perWeek: 3 }; g.checks = g.checks || []; g.total = 1; }
    if (!g.plan || !d.plans.some((p: any) => p.id === g.plan)) g.plan = (d.plans.find((p: any) => g.start >= p.start && g.start <= p.end) || d.plans[0]).id;
    if (g.usesMoney === undefined) g.usesMoney = g.unit === "₹" ? g.type !== "level" && !/fire/i.test(g.name) : /gold|silver|property/i.test(g.name);
  });
  d.goals.forEach((g: any) => { if (g.category && !d.categories.includes(g.category)) d.categories.push(g.category); });
  const fy = d.settings.focusYear || curYear();
  if (d.focusMeta[fy] === undefined) {
    if (!d.goals.some((g: any) => g.focus[fy])) d.goals.forEach((g: any) => { if (Number(g.targets[fy]) > 0) g.focus[fy] = true; });
    d.focusMeta[fy] = Date.now();
  }
  return d as AppState;
}

export function parseStored(raw: string | null): AppState | null {
  if (!raw) return null;
  try { const d = JSON.parse(raw); if (d && Array.isArray(d.goals)) return normalize(d); } catch { /* corrupt data → caller falls back to seed */ }
  return null;
}
