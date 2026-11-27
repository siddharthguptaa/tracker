import { describe, it as _it, expect } from "vitest";
import { boot } from "./helpers";
import { getState } from "../../src/domain/ctx";
import * as V from "../../src/domain/vault";
import { parseTodoSheets } from "../../src/domain/todoCsv";
import { bundleOf, checkForUpdate, NAV_KEY, restoreNav, saveNav } from "../../src/ui/lifecycle";
import { getUi, setUi } from "../../src/ui/uiStore";

const it = (n: string, f: () => any) => _it(n, async () => { boot(); await f(); });
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
async function oldVault(pw: string, data: any) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12)), iter = 1000;
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode("goal-tracker-vault-v1") }, key, new TextEncoder().encode(JSON.stringify(data))));
  return { salt: b64(salt), iv: b64(iv), iter, ct: b64(ct) };
}

describe("old password-protected vault", () => {
  it("wrong password throws and keeps the old vault", async () => {
    getState().vaultOld = await oldVault("right", { items: [{ id: "a", title: "Bank", type: "login", category: "Money" }], folders: [] });
    let threw = false; try { await V.migrateOldVault("wrong"); } catch { threw = true; } expect(threw).toBe(true); expect(getState().vaultOld).toBeTruthy();
  });
  it("right password brings items in as logins, turns categories into folders, clears the old blob", async () => {
    const st = getState(), before = st.vault.items.length; st.vaultOld = await oldVault("right", { items: [{ id: "a", title: "Bank", type: "login", category: "Money", url: "https://b.example" }, { id: "b", title: "Memo", type: "note" }], folders: [] });
    expect(await V.migrateOldVault("right")).toBe(2); expect(st.vault.items.length).toBe(before + 2); expect(st.vaultOld).toBeNull();
    const bank: any = st.vault.items.find((i: any) => i.title === "Bank"); expect(bank.id).not.toBe("a"); expect(bank.uris).toEqual(["https://b.example"]); expect(st.vault.folders.some((f: any) => f.name === "Money" && f.id === bank.folderId)).toBe(true);
  });
  it("discard removes it", () => { getState().vaultOld = { ct: "x" }; V.discardOldVault(); expect(getState().vaultOld).toBeNull(); });
});

describe("to-do workbook parse", () => {
  it("reads a To-do sheet and a Tags sheet", () => {
    const p = parseTodoSheets([[["junk"], ["To-do", "Done", "Due date"], ["Call bank", "No", "2026-05-01"]], [["Tag", "Colour", "Note"], ["Calls", "#2563eb", "after 6"]]]);
    expect(p.todos.length).toBe(1); expect(p.todos[0].text).toBe("Call bank"); expect(p.tags).toEqual([{ name: "Calls", color: "#2563eb", note: "after 6" }]);
  });
  it("ignores sheets with no known header", () => { expect(parseTodoSheets([[["a", "b"], [1, 2]]]).todos.length).toBe(0); });
});

describe("where-you-were restore", () => {
  it("round-trips the tab, sub-tab and open goal", () => {
    const g = getState().goals[0]; setUi({ tab: "goals", gsub: "timeline", page: { kind: "detail", id: g.id }, year: 2031 }); saveNav(); setUi({ tab: "home", gsub: "overview", page: null });
    const n = restoreNav(); expect(n).toBeTruthy(); expect(getUi().tab).toBe("goals"); expect(getUi().gsub).toBe("timeline"); expect(getUi().page).toEqual({ kind: "detail", id: g.id }); expect(getUi().year).toBe(2031);
  });
  it("remembers an old position (no expiry); ignores a bad tab, junk and a deleted goal", () => {
    localStorage.setItem(NAV_KEY, JSON.stringify({ t: Date.now() - 400 * 24 * 3600 * 1000, tab: "vault" })); expect(restoreNav()).toBeTruthy(); expect(getUi().tab).toBe("vault");
    localStorage.setItem(NAV_KEY, JSON.stringify({ t: Date.now(), tab: "nope" })); expect(restoreNav()).toBeNull();
    localStorage.setItem(NAV_KEY, "{bad"); expect(restoreNav()).toBeNull();
    setUi({ tab: "home", page: null }); localStorage.setItem(NAV_KEY, JSON.stringify({ t: Date.now(), tab: "goals", page: "missing-id" })); restoreNav(); expect(getUi().page).toBeNull();
  });
});

describe("update check", () => {
  const page = (b: string) => `<html><script type="module" src="./assets/index-${b}.js"></script></html>`;
  const f = (body: string, ok = true) => (async () => ({ ok, text: async () => body, clone() { return this; } })) as any;
  it("finds the bundle name", () => { expect(bundleOf(page("AbC123"))).toBe("assets/index-AbC123.js"); expect(bundleOf("<html></html>")).toBeNull(); });
  it("same bundle → same; different → new; failures → err", async () => {
    expect(await checkForUpdate(f(page("AAA")), "assets/index-AAA.js")).toBe("same");
    expect(await checkForUpdate(f(page("BBB")), "assets/index-AAA.js")).toBe("new");
    expect(await checkForUpdate(f("nothing"), "assets/index-AAA.js")).toBe("err"); expect(await checkForUpdate(f("", false), "x")).toBe("err");
    expect(await checkForUpdate((async () => { throw new Error("offline"); }) as any, "x")).toBe("err");
  });
});
