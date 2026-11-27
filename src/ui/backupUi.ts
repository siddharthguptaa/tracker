import { getState } from "../domain/ctx";
import { DAY } from "../domain/clock";
import { commit } from "../storage/store";
import { buildBackups, parseBackups, describeBackups, applyRestore, undoRestore, type FileStore } from "../domain/backup";
import { toast } from "./uiStore";
import { play } from "./fx";
import { onBuild } from "./build";
import { tallyBooks, tallyRaw, moneyChanged } from "../storage/moneyStore";
import { tallyApi } from "./tally";

export const bkAgo = () => { const t = getState().settings.lastBackup; if (!t) return "never"; const d = Math.floor((Date.now() - t) / DAY); return d <= 0 ? "today" : d === 1 ? "yesterday" : d + " days ago"; };

function stampMoney() {
  try {
    const a = tallyApi(); if (a && a.markBackup) { a.markBackup(); return; }
    tallyBooks().list.forEach((b: any) => { const raw = tallyRaw(b.key); if (!raw) return; const d = JSON.parse(raw); d.meta = d.meta || {}; d.meta.lastBackup = new Date().toISOString(); localStorage.setItem(b.key, JSON.stringify(d)); });
  } catch { /* best effort */ }
}
export function markBackedUp() { getState().settings.lastBackup = Date.now(); commit(); stampMoney(); }

function download(name: string, text: string) {
  const a = document.createElement("a"), u = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
}
let busy = false;
export async function backupNow(share = false, files?: FileStore) {
  if (busy) return; busy = true; toast("Preparing backup…");
  try {
    const out = await buildBackups(onBuild(), files);
    const nav: any = navigator;
    if (share && nav.canShare && nav.share) {
      const fl = out.map((o) => new File([o.text], o.name, { type: "application/json" }));
      if (nav.canShare({ files: fl })) { try { await nav.share({ files: fl, title: "Tracker backup" }); markBackedUp(); play("ok"); toast("Backup shared"); busy = false; return; } catch (e: any) { if (e && e.name === "AbortError") { busy = false; return; } } }
    }
    for (const o of out) { download(o.name, o.text); await new Promise((r) => setTimeout(r, 450)); }
    markBackedUp(); toast(`Backed up ${out.length} files — saved to your Downloads`);
  } catch { toast("Backup failed — try again"); }
  busy = false;
}

/** Returns after the user confirms (or cancels) the restore. */
export async function restoreFiles(list: File[], confirm: (msg: string) => boolean | Promise<boolean>, files?: FileStore) {
  const texts: string[] = []; for (const f of list) { try { texts.push(await f.text()); } catch { /* unreadable */ } }
  const mods = parseBackups(texts), found = Object.keys(mods);
  if (!found.length) { toast("These files aren't Tracker backups"); return; }
  if (!(await confirm("Restore " + describeBackups(mods) + "? This replaces the current " + found.join(", ") + " data on this device. Undo stays available for a few seconds."))) return;
  const u = await applyRestore(mods, files);
  if (found.includes("money")) moneyChanged();
  play("ok");
  toast("Restored " + found.join(", "), { label: "Undo", fn: () => { try { undoRestore(u); moneyChanged(); toast("Restored the previous data"); } catch { toast("Couldn’t undo"); } } });
}
