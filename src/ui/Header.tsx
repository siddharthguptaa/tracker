import { Icon } from "./icons";
import { useUi, setUi, toast } from "./uiStore";
import { getState } from "../domain/ctx";
import { commit } from "../storage/store";
import { applyTheme, isDarkNow } from "./theme";
import { tallyRaw, tallyBooks, isHidden, setHidden } from "../storage/moneyStore";
import { tallyApi } from "./tally";

export function toggleTheme() {
  const s = getState().settings, cur = s.theme, fam = cur === "comfort" || cur === "night";
  s.theme = (fam ? (cur === "night" ? "comfort" : "night") : isDarkNow() ? "light" : "dark") as any;
  commit(); applyTheme(); toast("Theme: " + ({ dark: "Dark", light: "Light", comfort: "Eye comfort", night: "Night comfort" } as any)[s.theme]);
}
export function toggleHide() {
  const v = !isHidden();
  tallyBooks().list.forEach((b: any) => { try { const d = JSON.parse(tallyRaw(b.key) || "null"); if (d && d.settings) { d.settings.hide = v; localStorage.setItem(b.key, JSON.stringify(d)); } } catch { /* corrupt book: skip */ } });
  setHidden(v); try { tallyApi()?.setHide?.(v); } catch { /* iframe not loaded */ }
  commit(); toast(v ? "Money amounts hidden" : "Money amounts shown");
}

/** Header buttons. Position classes (.onhome/.nog) come from the legacy CSS so nothing overlaps at any width. */
export function Header({ nog }: { nog?: boolean }) {
  const ui = useUi(), dark = isDarkNow(), pos = nog ? " nog" : ui.tab === "home" ? " onhome" : "", hid = isHidden();
  const showGear = !nog && (ui.tab === "home" || ui.tab === "goals" || ui.tab === "todo");
  return (
    <>
      {ui.tab === "home" && !nog && tallyRaw() ? (
        <button className="themebtn eyeh" aria-pressed={hid} aria-label={hid ? "Show Money amounts" : "Hide Money amounts"} title={hid ? "Show Money amounts" : "Hide Money amounts"} onClick={toggleHide}>{hid ? Icon.eyeoff : Icon.eye}</button>
      ) : null}
      <button className="themebtn" aria-label={`${dark ? "Dark" : "Light"} theme. Tap to switch to ${dark ? "light" : "dark"}`} onClick={toggleTheme}>{dark ? Icon.moon : Icon.sun}</button>
      <button className={"themebtn asstbtn" + pos} aria-label="Ask the assistant" title="Assistant" onClick={() => setUi({ sheet: "chat" })}>{Icon.chat}</button>
      <button className={"themebtn srchbtn" + pos} aria-label="Search everything" title="Search (Ctrl+K)" onClick={() => setUi({ sheet: "search" })}>{Icon.search}</button>
      {showGear ? <button className="themebtn gearbtn" aria-label="Settings" onClick={() => setUi({ tab: "settings", page: null })}>{Icon.gear}</button> : null}
    </>
  );
}
