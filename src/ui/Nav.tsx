import { Icon } from "./icons";
import { useUi, setUi, type Tab } from "./uiStore";
const TABS: [Tab, string][] = [["home", "Home"], ["goals", "Goals"], ["todo", "To-do"], ["money", "Money"], ["vault", "Vault"]];
export function Nav() {
  const ui = useUi();
  return (
    <nav aria-label="Main"><div className="in" id="nav">
      {TABS.map(([k, l]) => (
        <button key={k} className={ui.tab === k ? "on" : ""} aria-current={ui.tab === k ? "page" : undefined} onClick={() => setUi({ tab: k, page: null })}>{(Icon as any)[k]}{l}</button>
      ))}
    </div></nav>
  );
}
