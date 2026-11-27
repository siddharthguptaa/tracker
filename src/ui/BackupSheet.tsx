import { ask } from "./ask";
import { useRef } from "react";
import { Sheet } from "./Sheet";
import { setUi } from "./uiStore";
import { backupNow, restoreFiles, bkAgo } from "./backupUi";
import { idbFiles } from "./vaultFiles";

export function BackupSheet() {
  const fi = useRef<HTMLInputElement>(null);
  return (
    <Sheet label="Backup and restore">
      <h1>Backup &amp; restore</h1>
      <div className="panel"><button className="btn" style={{ width: "100%" }} onClick={() => backupNow(false, idbFiles)}>💾 Back up everything now</button>
        <p className="note">Last backup: <b>{bkAgo()}</b>. One tap saves four files: Goals, To-dos, Vault and Money (all books). Restore any of them separately.</p>
        <div className="btns" style={{ marginTop: 6 }}><button className="btn alt small" onClick={() => backupNow(true, idbFiles)}>Share / save to Drive…</button><button className="btn alt small" onClick={() => fi.current?.click()}>Restore from files…</button></div>
        <input ref={fi} type="file" accept=".json,application/json" multiple hidden onChange={async (e) => { const l = Array.from(e.target.files || []) as File[]; e.target.value = ""; if (l.length) { setUi({ sheet: null }); await restoreFiles(l, (m) => ask(m, "Restore", false), idbFiles); } }} />
      </div>
      <button className="btn alt" style={{ width: "100%" }} onClick={() => setUi({ sheet: null })}>Close</button>
    </Sheet>
  );
}
