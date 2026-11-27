import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { boot } from "./helpers";
import { getState } from "../../src/domain/ctx";
import * as V from "../../src/domain/vault";

beforeEach(() => { boot(); getState().vault = { v: 2, items: [], folders: [] } as any; });
afterEach(() => { vi.useRealTimers(); });
const login = (o: any = {}) => V.saveItem({ type: "login", title: "Gmail", username: "me", password: "Tr0ub4dor&3-xyz-Long", uris: ["https://mail.google.com"], ...o });

describe("generators", () => {
  it("password has requested length and every chosen class", () => {
    for (let n = 0; n < 50; n++) { const p = V.genPassword(16, { lower: true, upper: true, digits: true, symbols: true }); expect(p.length).toBe(16); expect(/[a-z]/.test(p) && /[A-Z]/.test(p) && /[0-9]/.test(p) && /[^a-zA-Z0-9]/.test(p)).toBe(true); }
  });
  it("avoids look-alike characters when asked", () => { for (let n = 0; n < 40; n++) expect(/[Il1O0o]/.test(V.genPassword(40, { lower: true, upper: true, digits: true, ambig: true }))).toBe(false); });
  it("falls back to lowercase when nothing is selected", () => { expect(/^[a-z]{12}$/.test(V.genPassword(12, {}))).toBe(true); });
  it("passphrase: word count, separator, capitals and number", () => {
    const p = V.genPassphrase(5, ".", true, true); expect(p.split(".").length).toBe(5); expect(/^[A-Z]/.test(p)).toBe(true); expect(/\d/.test(p)).toBe(true);
  });
  it("randInt stays in range and is not constant", () => { const s = new Set<number>(); for (let i = 0; i < 300; i++) { const x = V.randInt(7); expect(x >= 0 && x < 7).toBe(true); s.add(x); } expect(s.size).toBeGreaterThan(4); });
  it("username looks like a name plus digits", () => { expect(/^[a-z]+[A-Z][a-z]+\d{3}$/.test(V.genUsername())).toBe(true); });
});

describe("password strength", () => {
  it("rates obvious passwords weak and long random ones strong", () => {
    expect(V.pwScore("password123").label).toBe("Weak"); expect(V.pwScore("aaaaaaaaaaaa").label).toBe("Weak"); expect(V.pwScore("").label).toBe("Empty");
    expect(V.pwScore("xK9#mQ2$vL7!pR4&wZ8").label).toBe("Strong");
  });
});

describe("authenticator codes (RFC 6238 test vectors)", () => {
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";   // ASCII "12345678901234567890"
  it("matches the RFC for several timestamps", async () => {
    for (const [t, code] of [[59, "287082"], [1111111109, "081804"], [1111111111, "050471"], [1234567890, "005924"], [2000000000, "279037"]] as [number, string][]) expect((await V.totpCode(secret, t * 1000))!.code).toBe(code);
  });
  it("accepts otpauth:// links with spaces/lowercase and reports seconds left", async () => {
    const r = (await V.totpCode("otpauth://totp/x?secret=" + secret.toLowerCase() + "&period=30", 59000))!; expect(r.code).toBe("287082"); expect(r.left).toBe(1);
  });
  it("rejects garbage keys", async () => { expect(await V.totpCode("not base32 !!")).toBeNull(); expect(await V.totpCode("")).toBeNull(); });
});

describe("items", () => {
  it("validates", () => { expect(V.validateItem({ type: "login", title: " " })).toMatch(/name/); expect(V.validateItem({ type: "login", title: "x", totp: "!!!" })).toMatch(/authenticator/); expect(V.validateItem({ type: "login", title: "x" })).toBeNull(); });
  it("saves each type with the classic data shape", () => {
    const l = login(), c = V.saveItem({ type: "card", title: "HDFC", card: { holder: "A", number: "4111 1111 1111 1111", exp: "12/30", cvv: "123", brand: "Visa" } }), w = V.saveItem({ type: "wifi", title: "Home", f: { ssid: "net", password: "pw", security: "WPA2" } }), i = V.saveItem({ type: "identity", title: "Me", idn: { first: "A", last: "B" } }), n = V.saveItem({ type: "note", title: "N", notes: "secret  \n " });
    expect(l.uris).toEqual(["https://mail.google.com"]); expect(l.url).toBe("https://mail.google.com"); expect(c.card.number).toBe("4111 1111 1111 1111"); expect(w.f.ssid).toBe("net"); expect(i.idn.first).toBe("A"); expect(n.notes).toBe("secret");
    expect(l.log[0].a).toBe("Created"); expect(getState().vault.items.length).toBe(5);
  });
  it("keeps password history (max 5) when the password changes", () => {
    const it = login(); for (let n = 1; n <= 7; n++) V.saveItem({ type: "login", title: "Gmail", password: "pw" + n }, it.id);
    expect(it.history.length).toBe(5); expect(it.history[0].pw).toBe("pw6"); expect(it.password).toBe("pw7");
  });
  it("trash → restore → purge, and 30-day auto-empty", () => {
    const it = login(); V.trashItem(it); expect(V.vLive().length).toBe(0); expect(V.vTrash().length).toBe(1); V.restoreItem(it); expect(V.vLive().length).toBe(1);
    V.trashItem(it); it.trashed = Date.now() - 31 * 86400000; expect(V.vPurge()).toBe(true); expect(getState().vault.items.length).toBe(0);
  });
  it("clone gets a new id, fresh history and '(copy)' title", () => { const it = login(); const c = V.cloneItem(it); expect(c.id).not.toBe(it.id); expect(c.title).toBe("Gmail (copy)"); expect(c.history).toEqual([]); });
  it("folders: add, duplicate, rename, delete keeps items", () => {
    expect(V.addFolder("Bank")).toBeNull(); expect(V.addFolder("bank")).toMatch(/exists/); expect(V.addFolder(" ")).toMatch(/Type/);
    const id = getState().vault.folders[0].id, it = login({ folderId: id }); expect(V.folderName(it)).toBe("Bank");
    expect(V.renameFolder(id, "Banking")).toBeNull(); expect(V.renameFolder(id, "")).toMatch(/empty/); V.deleteFolder(id); expect(V.vById(it.id).folderId).toBe("");
  });
  it("migrates old free-text categories to folders", () => { const d: any = { items: [{ id: "a", category: "Work" }, { id: "b", category: "work" }], folders: [] }; expect(V.vMigrate(d)).toBe(true); expect(d.folders.length).toBe(1); expect(d.items[0].folderId).toBe(d.items[1].folderId); expect("category" in d.items[0]).toBe(false); });
});

describe("expiry & health audit", () => {
  it("reads card and document expiry", () => {
    expect(V.vExpiry({ type: "card", card: { exp: "02/28" } })).toBe("2028-02-29"); expect(V.vExpiry({ type: "card", card: { exp: "13/2030" } })).not.toBeNull(); expect(V.vExpiry({ type: "card", card: { exp: "soon" } })).toBeNull();
    expect(V.vExpiry({ type: "passport", f: { expiry: "2027-01-05" } })).toBe("2027-01-05"); expect(V.vExpiry({ type: "passport", f: { expiry: "05/01/2027" } })).toBeNull();
  });
  it("flags reused, weak, old, http, no-2fa and expiring items", () => {
    login({ title: "A", password: "samesame" }); login({ title: "B", password: "samesame", uris: ["http://old.example"] }); const o = login({ title: "C", password: "Xk9#mQ2$vL7!pR4&" }); o.updated = o.created = Date.now() - 400 * 86400000;
    V.saveItem({ type: "card", title: "Card", card: { exp: "11/26" } });
    const au = V.vAudit(V.vLive()); expect(au.reused.length).toBe(2); expect(au.weak.length).toBe(2); expect(au.http.length).toBe(1); expect(au.old.length).toBe(1); expect(au.no2fa.length).toBe(3); expect(au.expiring.length).toBe(1);
  });
  it("breach check sends only a 5-char hash prefix and flags matches", async () => {
    const it = login({ password: "hunter2" }); const h = await V.sha1hex("hunter2"); const seen: string[] = [];
    const fake: any = async (u: string) => { seen.push(u); return { ok: true, text: async () => `${h.slice(5)}:42\nAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:0` }; };
    const r = await V.checkExposed(fake); expect(seen[0]).toBe("https://api.pwnedpasswords.com/range/" + h.slice(0, 5)); expect(seen[0].includes(h.slice(5))).toBe(false); expect(r.pwned[it.id]).toBe(42);
  });
  it("breach check survives being offline", async () => { login(); const r = await V.checkExposed((async () => { throw new Error("offline"); }) as any); expect(r.fails).toBe(1); expect(Object.keys(r.pwned).length).toBe(0); });
});

describe("search", () => {
  it("plain words, filters and combinations", () => {
    login({ title: "Gmail", password: "weak" }); V.saveItem({ type: "card", title: "Visa", fav: true, card: { number: "4111111111111111" } }); V.saveItem({ type: "note", title: "Wifi codes", notes: "router admin" });
    const find = (q: string) => { const au = V.vAudit(V.vLive()); return V.vLive().filter((i) => V.vMatchItem(i, V.vSearchParse(q), au)).map((i) => i.title); };
    expect(find("gmail")).toEqual(["Gmail"]); expect(find("is:weak")).toEqual(["Gmail"]); expect(find("type:card")).toEqual(["Visa"]); expect(find("is:fav")).toEqual(["Visa"]); expect(find("router")).toEqual(["Wifi codes"]); expect(find('"wifi codes"')).toEqual(["Wifi codes"]); expect(find("no:2fa")).toEqual(["Gmail"]); expect(find("zzz")).toEqual([]); expect(find("")).toHaveLength(3);
  });
});

describe("CSV import / export", () => {
  it("parses quotes, escaped quotes, commas and newlines inside fields, CRLF", () => { expect(V.parseCSV('a,b\r\n"x, y","he said ""hi""\nline2"\n')).toEqual([["a", "b"], ["x, y", 'he said "hi"\nline2']]); });
  it("exports and re-imports without loss or duplicates", () => {
    login({ title: "Gmail", notes: "n", fields: [{ n: "PIN", v: "1234", h: true }] }); V.saveItem({ type: "bank", title: "SBI", f: { bank: "SBI", number: "123456", ifsc: "SBIN0001" } }); V.saveItem({ type: "card", title: "C", card: { number: "4111", exp: "01/30" } });
    const csv = V.vCsvText(); const snap = () => JSON.stringify(V.vLive().map((i) => [i.type, i.title, i.username, i.password, i.f, i.card]), (_k, v) => (v === "" ? undefined : v)), before = snap();   // empty fields are not stored by import, same as the classic app
    getState().vault = { v: 2, items: [], folders: [] } as any; const r = V.vImportRows(V.parseCSV(csv)); expect(r.added).toBe(3);
    expect(snap()).toBe(before);
    expect(V.vImportRows(V.parseCSV(csv)).added).toBe(0);
  });
  it("imports a Chrome-style export", () => { const r = V.vImportRows(V.parseCSV("name,url,username,password\nGitHub,https://github.com,me,pw1\n,https://x.org,u,p2\n,,,")); expect(r.added).toBe(2); expect(V.vLive()[1].title).toBe("x.org"); });
  it("rejects files without a name/url column or rows", () => { expect(V.vImportRows([["foo"], ["bar"]]).err).toMatch(/Name or URL/); expect(V.vImportRows([["name"]]).err).toMatch(/no rows/); });
  it("CSV cells starting with = are exported as plain text (no formula execution on re-open is the user's tool risk, but quotes must stay intact)", () => { login({ title: "=SUM(1,1)" }); expect(V.vCsvText()).toContain('"=SUM(1,1)"'); });
});
