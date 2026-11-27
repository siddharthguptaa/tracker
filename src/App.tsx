import { useEffect } from "react";
import { useAppState } from "./storage/store";
import { useUi, setUi, goTab, getUi, toast } from "./ui/uiStore";
import { Home } from "./ui/Home";
import { GoalsTab, GoalDetail } from "./ui/Goals";
import { TodoTab } from "./ui/Todos";
import { VaultTab } from "./ui/VaultTab";
import { VaultDetail, VaultEdit, VaultPickType, VaultGen, VaultHealth, VaultEmerg, VaultSettings } from "./ui/VaultSheets";
import { Settings } from "./ui/Settings";
import { MoneyHost } from "./ui/MoneyHost";
import { Nav } from "./ui/Nav";
import { ToastHost } from "./ui/Toast";
import { AskHost } from "./ui/ask";
import { ChatSheet } from "./ui/Chat";
import { SearchSheet } from "./ui/Search";
import { NewGoalSheet } from "./ui/NewSheets";
import { GoalEditSheet, HandoverSheet, ReviewSheet, ImportSheet } from "./ui/GoalSheets";
import { NewTodoSheet, EditTodoSheet, MoveSheet, StatsSheet, TagsSheet, TemplatesSheet, TodoSettingsSheet, QuickAddSheet, notifyTodos } from "./ui/TodoSheets";
import { checkReminders } from "./domain/todoOps";
import { BackupSheet } from "./ui/BackupSheet";
import { Header } from "./ui/Header";
import { applyTheme } from "./ui/theme";
import { tallyBooks } from "./storage/moneyStore";
import { tallyApi } from "./ui/tally";

function MoneyTab() {
  const subs: [string, string][] = [["records", "Records"], ["analysis", "Analysis"], ["budgets", "Budgets"], ["plan", "Plan"], ["accounts", "Accounts"], ["categories", "Categories"]];
  const cur = ((window as any).__msub as string) || "records";
  useUi();
  void tallyBooks;
  return <><Header /><h1>Money</h1><div className="subtabs six">{subs.map(([k, l]) => <button key={k} className={cur === k ? "on" : ""} onClick={() => { try { tallyApi()?.setTab(k); } catch { /* not ready */ } (window as any).__msub = k; setUi({}); }}>{l}</button>)}</div></>;
}

export function App() {
  const state = useAppState(), ui = useUi();
  useEffect(() => { applyTheme(); }, [state.settings.theme, state.settings.accent]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setUi({ sheet: "search" }); } };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, []);
  useEffect(() => {
    const run = () => { const hit = checkReminders(); if (!hit.length) return; const ids = [...new Set([...getUi().alerts, ...hit.map((t) => t.id)])]; setUi({ alerts: ids }); toast("⏰ " + hit[0].text + (hit.length > 1 ? ` +${hit.length - 1} more` : "")); notifyTodos(hit); };
    run(); const i = setInterval(run, 30000); document.addEventListener("visibilitychange", run); return () => { clearInterval(i); document.removeEventListener("visibilitychange", run); };
  }, []);
  const detail = ui.page && ui.page.kind === "detail" && state.goals.some((g) => g.id === ui.page!.id);
  const fab = !detail && (ui.tab === "home" || ui.tab === "vault" || (ui.tab === "goals" && ui.gsub === "overview") || ui.tab === "todo");
  const view = detail ? <GoalDetail id={ui.page!.id} /> : ui.tab === "goals" ? <GoalsTab /> : ui.tab === "todo" ? <TodoTab /> : ui.tab === "money" ? <MoneyTab /> : ui.tab === "vault" ? <VaultTab /> : ui.tab === "settings" ? <Settings /> : <Home />;
  return (
    <>
      <div id="app">{view}</div>
      {fab ? <button className="fab" id="fab" aria-label={ui.tab === "vault" ? "Add to vault" : ui.tab === "todo" ? "Add to-do" : ui.tab === "home" ? "Quick add" : "Add goal"} onClick={() => setUi({ sheet: ui.tab === "goals" ? "goalnew" : ui.tab === "vault" ? "vedit" : ui.tab === "home" ? "quick" : "todonew", sheetArg: null })}>+</button> : null}
      <Nav />
      <MoneyHost />
      <ToastHost /><AskHost />
      {ui.sheet === "quick" ? <QuickAddSheet /> : null}
      {ui.sheet === "tdedit" ? <EditTodoSheet key={ui.sheetArg} id={ui.sheetArg} /> : ui.sheet === "tdmove" ? <MoveSheet ids={ui.sheetArg || []} /> : ui.sheet === "tdstats" ? <StatsSheet /> : ui.sheet === "tdtags" ? <TagsSheet /> : ui.sheet === "tdtpl" ? <TemplatesSheet arg={ui.sheetArg} /> : ui.sheet === "tdsettings" ? <TodoSettingsSheet /> : null}
      {ui.sheet === "vdetail" ? <VaultDetail id={ui.sheetArg} /> : ui.sheet === "vedit" ? (ui.sheetArg && ui.sheetArg.new ? <VaultEdit key={"n" + ui.sheetArg.new} id={null} type={ui.sheetArg.new} /> : ui.sheetArg ? <VaultEdit key={ui.sheetArg} id={ui.sheetArg} /> : <VaultPickType />) : ui.sheet === "vgen" ? <VaultGen /> : ui.sheet === "vhealth" ? <VaultHealth /> : ui.sheet === "vemerg" ? <VaultEmerg /> : ui.sheet === "vsettings" ? <VaultSettings /> : ui.sheet === "chat" ? <ChatSheet /> : ui.sheet === "search" ? <SearchSheet /> : ui.sheet === "goalnew" ? <GoalEditSheet key={"g" + ui.plan + ui.cat} arg={null} /> : ui.sheet === "goaledit" ? <GoalEditSheet key={JSON.stringify(ui.sheetArg && (ui.sheetArg.id || ui.sheetArg.prefill?.id))} arg={ui.sheetArg} /> : ui.sheet === "handover" ? <HandoverSheet pid={ui.sheetArg} /> : ui.sheet === "review" ? <ReviewSheet y={+ui.sheetArg} /> : ui.sheet === "gimport" ? <ImportSheet /> : ui.sheet === "todonew" ? <NewTodoSheet key={"n" + (ui.sheetArg || "")} day={typeof ui.sheetArg === "string" ? ui.sheetArg : null} /> : ui.sheet === "backup" ? <BackupSheet /> : null}
    </>
  );
}
void goTab;
