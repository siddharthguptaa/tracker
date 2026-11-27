/* In-app confirmation dialog (replaces the browser's confirm box). ask() resolves true on OK, false on Cancel / backdrop / Esc. */
import { useEffect, useRef, useSyncExternalStore } from "react";

interface Dlg { msg: string; ok: string; danger: boolean; res: (v: boolean) => void }
let cur: Dlg | null = null, ver = 0; const ls = new Set<() => void>();
const emit = () => { ver++; ls.forEach((l) => l()); };
/** Promise-based confirm. okLabel defaults to "Delete" (red); pass danger=false for neutral actions like Export. */
export function ask(msg: string, okLabel = "Delete", danger = okLabel === "Delete" || /^(discard|erase|delete|permanently)/i.test(okLabel)): Promise<boolean> {
  if (cur) cur.res(false);
  return new Promise((res) => { cur = { msg, ok: okLabel, danger, res: (v) => { cur = null; emit(); res(v); } }; emit(); });
}
export const askOpen = () => !!cur;
export const askClose = () => { if (cur) cur.res(false); };

export function AskHost() {
  useSyncExternalStore((l) => { ls.add(l); return () => ls.delete(l); }, () => ver);
  const d = cur, okRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!d) return; const prev = document.activeElement as HTMLElement | null; okRef.current?.focus();
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); d.res(false); } else if (e.key === "Tab") { e.preventDefault(); (document.activeElement === okRef.current ? (okRef.current!.previousElementSibling as HTMLElement) : okRef.current)?.focus(); } };
    window.addEventListener("keydown", k, true); return () => { window.removeEventListener("keydown", k, true); prev?.focus?.(); };
  }, [d]);
  if (!d) return null;
  return (
    <div className="overlay askov" style={{ zIndex: 70, alignItems: "center" }} onMouseDown={(e) => { if (e.target === e.currentTarget) d.res(false); }}>
      <div className="panel" role="alertdialog" aria-modal="true" aria-label="Please confirm" style={{ width: "100%", maxWidth: 340, margin: 20 }}>
        <p style={{ margin: "0 0 10px", fontWeight: 600, overflowWrap: "anywhere" }}>{d.msg}</p>
        <div className="btns"><button className="btn alt" onClick={() => d.res(false)}>Cancel</button><button ref={okRef} className={"btn" + (d.danger ? " danger" : "")} onClick={() => d.res(true)}>{d.ok}</button></div>
      </div>
    </div>
  );
}
