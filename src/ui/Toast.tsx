import { useUi, dismissToast } from "./uiStore";
export function ToastHost() {
  const t = useUi().toast;
  return (
    <div id="toast" className={"toast" + (t ? " show" : "") + (t?.action ? " act" : "")} role="status" aria-live="polite">
      {t?.msg}
      {t?.action ? <button type="button" onClick={() => { const f = t.action!.fn; dismissToast(); f(); }}>{t.action.label}</button> : null}
    </div>
  );
}
