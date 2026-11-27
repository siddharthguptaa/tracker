// Differential tests: every value below was produced by the ORIGINAL index.html at a frozen clock (see scripts/capture-golden).
// If one of these fails, the React port no longer behaves like the app you already use.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { boot, G, strip } from "./helpers";
import { current, pct, pctText, expected, paceInfo, timeLeft, habitStats, forecast } from "../../src/domain/goals";
import { goalOutlook, outlookAll, outlookLabel } from "../../src/domain/outlook";
import { dueLabel, parseQuick } from "../../src/domain/todos";
import { chatRoute, cAmt, cDate } from "../../src/assistant/engine";
import { gsSearch, gsIndex } from "../../src/domain/search";
import { getState } from "../../src/domain/ctx";

beforeEach(() => { boot(); });
afterEach(() => { vi.useRealTimers(); });

describe("goal maths matches the original app", () => {
  it("has the same goals", () => { expect(getState().goals.map((g) => g.id)).toEqual(G.goals.map((g: any) => g.id)); });
  for (const exp of G.goals) {
    describe(exp.name, () => {
      const g = () => getState().goals.find((x) => x.id === exp.id)!;
      it("current / pct / expected", () => {
        expect(current(g())).toBeCloseTo(exp.current, 6); expect(pct(g())).toBeCloseTo(exp.pct, 9);
        expect(pctText(g())).toBe(exp.pctText); expect(expected(g())).toBeCloseTo(exp.expected, 9);
      });
      it("pace / time left / forecast", () => {
        expect(paceInfo(g())).toEqual(exp.pace); expect(timeLeft(g())).toBe(exp.timeLeft);
        expect(forecast(g())).toEqual(exp.forecast);
      });
      it("outlook", () => {
        const o = goalOutlook(g());
        expect({ key: o.key, like: o.like, tip: o.tip }).toEqual({ key: exp.outlook.key, like: exp.outlook.like, tip: exp.outlook.tip });
        if (exp.outlook.have != null) expect(o.have).toBeCloseTo(exp.outlook.have, 6);
        if (exp.outlook.need != null) expect(o.need).toBeCloseTo(exp.outlook.need, 6);
      });
      if (exp.habit) it("habit stats", () => { expect(JSON.parse(JSON.stringify(habitStats(g())))).toEqual(exp.habit); });
    });
  }
  it("overall outlook", () => {
    const O = outlookAll();
    expect({ score: O.score, n: O.n, ahead: O.ahead, ontrack: O.ontrack, risk: O.risk, behind: O.behind, stalled: O.stalled, done: O.done, label: outlookLabel(O.score) }).toEqual(G.outlookAll);
  });
});

describe("to-do parsing matches", () => {
  for (const [d, label] of G.dueLabels) it("dueLabel " + d, () => { expect(dueLabel(d)).toBe(label); });
  for (const [txt, want] of G.quick) it("quick-add: " + txt, () => {
    const q: any = parseQuick(txt);
    expect({ text: q.text, due: q.due || null, repeat: q.repeat || "", time: q.time || null, tags: (q.tags || []).length }).toEqual(want);
  });
});

describe("assistant parsers match", () => {
  for (const [t, want] of G.amts) it("amount: " + t, () => { expect(cAmt(t)).toEqual(want); });
  for (const [t, want] of G.dates) it("date: " + t, () => { expect(cDate(t)).toEqual(want); });
});

describe("assistant replies are word-for-word identical", () => {
  for (const [q, html, acts] of G.replies) it(q, () => {
    const r: any = chatRoute(q);
    expect(r ? strip(r.html) : null).toBe(html);
    expect(r && r.acts ? r.acts.map((a: any) => a.label) : []).toEqual(acts);
  });
  for (const [q, html, acts] of G.actReplies) it("action prompt: " + q, () => {
    const r: any = chatRoute(q);
    expect(r ? strip(r.html) : null).toBe(html);
    expect(r && r.acts ? r.acts.map((a: any) => a.label) : []).toEqual(acts);
  });
});

describe("global search matches", () => {
  for (const [q, want] of G.search) it("query: " + q, () => {
    const r = gsSearch(q, gsIndex());
    expect({ goals: Math.min(r.goals.length, 6), todos: Math.min(r.todos.length, 8), money: Math.min(r.money.length, 8), vault: Math.min(r.vault.length, 6), none: !r.short && !r.goals.length && !r.todos.length && !r.money.length && !r.vault.length }).toEqual(want);
  });
});
