import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { boot } from "./helpers";
import { gsSearch, gsIndex } from "../../src/domain/search";
import { getState } from "../../src/domain/ctx";

beforeEach(() => { boot(); });
afterEach(() => { vi.useRealTimers(); });

describe("search", () => {
  it("needs two characters", () => { expect(gsSearch("a").short).toBe(true); expect(gsSearch(" ").short).toBe(true); });
  it("is case-insensitive and finds goals, to-dos and money", () => {
    getState().goals[0].name = "Zebra Fund"; getState().todos[0].text = "Feed the ZEBRA";
    const r = gsSearch("zebra", gsIndex()); expect(r.goals.length).toBe(1); expect(r.todos.length).toBe(1);
  });
  it("never searches passwords", () => {
    getState().vault.items.push({ id: "v", title: "Bank", type: "login", username: "me", password: "hunter2-secret" } as any);
    expect(gsSearch("hunter2", gsIndex()).vault.length).toBe(0); expect(gsSearch("bank", gsIndex()).vault.length).toBe(1);
  });
  it("hides trashed vault items", () => { getState().vault.items.push({ id: "v", title: "Old card", type: "card", trashed: true } as any); expect(gsSearch("old card", gsIndex()).vault.length).toBe(0); });
  it("tolerates corrupt Money data", () => { localStorage.setItem("tally:app:v1", "{{{"); expect(() => gsSearch("rent", gsIndex())).not.toThrow(); });
  it("special characters do not break matching", () => { expect(() => gsSearch("(*[", gsIndex())).not.toThrow(); });
});
