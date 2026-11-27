import { useEffect, type ReactNode } from "react";
import { setUi } from "./uiStore";

/** Bottom sheet / centered dialog. Esc and backdrop-tap close; body scroll is locked while open. */
export function Sheet({ children, label }: { children: ReactNode; label: string }) {
  const close = () => setUi({ sheet: null, sheetArg: null });
  useEffect(() => {
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", k);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", k); };
  }, []);
  return (
    <div className="overlay" id="ov" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label}><div className="grab" />{children}</div>
    </div>
  );
}
