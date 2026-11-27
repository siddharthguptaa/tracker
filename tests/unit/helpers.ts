import { vi } from "vitest";
import golden from "../fixtures/golden.json";
import { initStore } from "../../src/storage/store";

export const G: any = golden;

/** Load the legacy app's frozen state + Money books into localStorage, freeze the clock, and boot the store. */
export function boot(opts: { state?: any; money?: boolean; time?: string } = {}) {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(opts.time || G.fixed));
  localStorage.setItem("goal-tracker.v1", JSON.stringify(opts.state ?? G.state));
  if (opts.money !== false) {
    Object.entries(G.moneyKeys).forEach(([k, v]) => { if (v) localStorage.setItem(k, v as string); });
    if (G.moneyBooks) localStorage.setItem("tally:books:v1", JSON.stringify(G.moneyBooks));
  }
  return initStore();
}
export const strip = (h: string) => String(h).replace(/data-id="[^"]*"/g, "").replace(/id="[^"]*"/g, "");
