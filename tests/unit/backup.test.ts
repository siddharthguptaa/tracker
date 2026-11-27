import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { boot, G } from "./helpers";
import { getState } from "../../src/domain/ctx";
import { buildBackups, parseBackups, applyRestore, undoRestore, describeBackups, type FileStore } from "../../src/domain/backup";
import { addTodoFromText } from "../../src/domain/actions";

beforeEach(() => { boot(); });
afterEach(() => { vi.useRealTimers(); });
const files = (): FileStore & { m: Map<string, any> } => { const m = new Map<string, any>(); return { m, get: async (id) => m.get(id) || null, put: async (id, type, b64) => { m.set(id, { type, b64 }); }, dropAll() { m.clear(); } }; };

describe("backup & restore", () => {
  it("writes one file per module with the original file format", async () => {
    const out = await buildBackups("test", files());
    expect(out.map((o) => o.mod).sort()).toEqual(["goals", "money", "todos", "vault"]);
    out.forEach((o) => { const j = JSON.parse(o.text); expect(j.app).toBe("tracker-backup"); expect(j.v).toBe(1); expect(j.module).toBe(o.mod); expect(o.name).toMatch(/^tracker-(goals|todos|vault|money)-\d{4}-\d{2}-\d{2}\.json$/); });
  });
  it("round-trips: change everything, restore, get the original back", async () => {
    const before = JSON.stringify({ g: getState().goals, t: getState().todos });
    const out = await buildBackups("test", files()), texts = out.map((o) => o.text);
    getState().goals.length = 0; addTodoFromText("junk"); localStorage.setItem("tally:app:v1", "{}");
    await applyRestore(parseBackups(texts), files());
    expect(JSON.stringify({ g: getState().goals, t: getState().todos })).toBe(before);
  });
  it("Undo brings back what was there before the restore", async () => {
    const out = await buildBackups("test", files()); addTodoFromText("added after backup"); const n = getState().todos.length;
    const u = await applyRestore(parseBackups(out.map((o) => o.text)), files()); expect(getState().todos.length).toBe(n - 1);
    undoRestore(u); expect(getState().todos.length).toBe(n);
  });
  it("ignores files that are not Tracker backups", () => {
    expect(parseBackups(["not json", "{}", '{"app":"other","module":"goals","data":{}}', '{"app":"tracker-backup","module":"evil","data":{}}', "null"])).toEqual({});
  });
  it("newest file wins when two of the same module are given", () => {
    const mk = (c: string, n: number) => JSON.stringify({ app: "tracker-backup", module: "todos", created: c, data: { todos: Array(n).fill({ id: "a", text: "x", tags: [] }) } });
    expect((parseBackups([mk("2026-01-02", 2), mk("2026-01-01", 1)]).todos as any).data.todos.length).toBe(2);
  });
  it("restoring one module leaves the others untouched", async () => {
    const out = await buildBackups("test", files()), only = out.filter((o) => o.mod === "todos").map((o) => o.text), goals = JSON.stringify(getState().goals);
    getState().todos.length = 0; await applyRestore(parseBackups(only), files());
    expect(getState().todos.length).toBe(G.state.todos.length); expect(JSON.stringify(getState().goals)).toBe(goals);
  });
  it("restoring goals keeps this device's sound/haptic/last-backup settings", async () => {
    const out = await buildBackups("test", files()); getState().settings.fxSound = false; getState().settings.lastBackup = 12345;
    await applyRestore(parseBackups(out.map((o) => o.text)), files()); expect(getState().settings.fxSound).toBe(false); expect(getState().settings.lastBackup).toBe(12345);
  });
  it("vault attachments travel with the backup", async () => {
    const f = files(); getState().vault.items.push({ id: "v1", title: "Passport", type: "note", files: [{ id: "f1", name: "p.png", type: "image/png", size: 3 }] } as any);
    f.m.set("f1", { type: "image/png", b64: "AAEC" }); const out = await buildBackups("t", f), v = out.find((o) => o.mod === "vault")!;
    expect(JSON.parse(v.text).data.files.f1.b64).toBe("AAEC");
    const g = files(); await applyRestore(parseBackups([v.text]), g); expect(g.m.get("f1").b64).toBe("AAEC");
  });
  it("describes what will be restored", async () => { const out = await buildBackups("t", files()); expect(describeBackups(parseBackups(out.map((o) => o.text)))).toMatch(/Goals \(\d+\), To-dos \(\d+\), Vault \(\d+ items\), Money \(\d+ books?\)/); });
});
