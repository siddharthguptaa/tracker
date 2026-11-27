import { useEffect, useLayoutEffect, useState } from "react";
import { onMoneyChanged } from "../storage/moneyStore";
import { syncTallyTheme } from "./tally";
import { useUi } from "./uiStore";
import { useAppState } from "../storage/store";

/** Money module in a same-origin iframe. Stays mounted once opened so it keeps its state. */
export function MoneyHost() {
  const ui = useUi(), [opened, setOpened] = useState(false), [gen, setGen] = useState(0), [pos, setPos] = useState<{ top: number | string; bottom?: number }>({ top: "env(safe-area-inset-top,0px)" });
  const visible = ui.tab === "money" && !ui.page;
  useEffect(() => { if (visible) setOpened(true); }, [visible]);
  useEffect(() => onMoneyChanged(() => setGen((g) => g + 1)), []);          // reload after assistant / restore writes
  const st = useAppState().settings; useEffect(() => { syncTallyTheme(); }, [st.theme, st.accent, gen]);
  useLayoutEffect(() => {
    if (!visible) return;
    const place = () => {
      const sb = document.querySelector("#app .subtabs") as HTMLElement | null, nv = document.querySelector("nav") as HTMLElement | null, layered = ((window as any).__tlayers || 0) > 0;
      setPos({ top: layered || !sb ? "env(safe-area-inset-top,0px)" : Math.ceil(sb.getBoundingClientRect().bottom + 4), bottom: nv?.offsetHeight || undefined });
    };
    place(); window.addEventListener("resize", place); window.addEventListener("orientationchange", place);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("orientationchange", place); };
  }, [visible, ui]);
  if (!opened) return null;
  return (
    <div id="moneyhost" hidden={!visible} style={{ top: pos.top, bottom: pos.bottom }}>
      <iframe key={gen} id="tallyframe" title="Money tracker" src="./money.html" allow="clipboard-write" onLoad={syncTallyTheme} />
    </div>
  );
}
