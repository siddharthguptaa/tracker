import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/legacy.css";
import "./styles/fixes.css";
import { App } from "./App";
import { initStore, setSaveErrorHandler } from "./storage/store";
import { applyTheme } from "./ui/theme";
import { installParentHooks } from "./ui/tally";
import { toast } from "./ui/uiStore";
import { restoreNav, handleLaunch, installLifecycle } from "./ui/lifecycle";
import { applyRecurring } from "./domain/goalOps";

initStore();
setSaveErrorHandler(() => toast("Couldn’t save — storage may be full"));
installParentHooks();
applyTheme();
try { const n = applyRecurring(); if (n) setTimeout(() => toast(`${n} recurring entr${n > 1 ? "ies" : "y"} added`), 600); } catch { /* never block boot */ }
restoreNav(); handleLaunch(); installLifecycle();
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);

if ("serviceWorker" in navigator && import.meta.env?.PROD) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
