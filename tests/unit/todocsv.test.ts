import { describe, it as _it, expect } from "vitest";
import { boot } from "./helpers";
import { getState } from "../../src/domain/ctx";
import * as C from "../../src/domain/todoCsv";
import * as O from "../../src/domain/todoOps";

const it = (n: string, f: () => any) => _it(n, async () => { boot(); const s = getState(); s.todos = []; s.tags = []; await f(); });
const add = (t: string, f: any = {}) => O.addTodo(t, O.emptyForm(f)) as any;

describe("to-do CSV", () => {
  it("header row has the classic columns, quotes and newlines survive", () => {
    O.addTag("Calls"); add("Say \"hi\", then bye", { due: "2026-05-01", time: "17:30", est: 15, notes: "line1\nline2", subs: [{ id: "a", t: "one", d: true }, { id: "b", t: "two", d: false }], tags: [getState().tags[0].id] });
    const text = C.csvText(C.exportRows()); expect(text.split("\r\n")[0]).toBe(C.TD_COLS.map((c) => '"' + c + '"').join(","));
    const back = C.parseTodoCsv(text); expect(back.todos.length).toBe(1); const r = back.todos[0]; expect(r.text).toBe('Say "hi", then bye'); expect(r.notes).toBe("line1\nline2"); expect(r.subs.map((x) => x.t + x.d)).toEqual(["onetrue", "twofalse"]); expect(r.time).toBe("17:30"); expect(r.est).toBe(15); expect(r.tags).toEqual(["Calls"]);
  });
  it("re-importing your own export changes nothing", () => { add("A", { due: "2026-05-01", repeat: "weekly" }); add("B", { someday: true }); const before = JSON.stringify(getState().todos); const p = C.buildTodoImport(C.parseTodoCsv(C.csvText(C.exportRows()))); expect(p.items.length).toBe(0); expect(p.same).toBe(2); C.applyTodoImport(p); expect(JSON.stringify(getState().todos)).toBe(before); });
  it("edited rows update by ID; unknown IDs fall back to text+date; nothing is deleted", () => {
    const a = add("Pay rent", { due: "2026-05-01" }); add("Keep me", {});
    const csv = `ID,To-do,Done,Due date\n${a.id},Pay rent,Yes,2026-05-01\n,Brand new,No,2026-06-01\nzzzzzz,Keep me,No,\n`; const p = C.buildTodoImport(C.parseTodoCsv(csv)); expect(p.items.map((x) => x.ch[0])).toEqual(["marked done", "New"]);
    const r = C.applyTodoImport(p); expect(r).toEqual({ nNew: 1, nUp: 1 }); expect(getState().todos.length).toBe(3); expect(a.done).toBe(true); expect(a.doneAt).toBeTruthy();
  });
  it("only columns that are present are touched", () => { const a = add("Task", { due: "2026-05-01", notes: "keep", est: 30 }); C.applyTodoImport(C.buildTodoImport(C.parseTodoCsv(`ID,To-do,Done\n${a.id},Task,Yes\n`))); expect(a.notes).toBe("keep"); expect(a.est).toBe(30); expect(a.done).toBe(true); });
  it("accepts other tools' headers and day-first dates, creates tags and categories, flags missing goals", () => {
    const p = C.buildTodoImport(C.parseTodoCsv(`Task,Deadline,Labels,List,Project\nBuy milk,05/07/2026,"Errands; Home",Chores,No such goal\n`)); expect(p.missingGoals).toEqual(["No such goal"]); expect(p.newTags.sort()).toEqual(["Errands", "Home"]);
    C.applyTodoImport(p); const t: any = getState().todos[0]; expect(t.due).toBe("2026-07-05"); expect(t.tags.length).toBe(2); expect(t.category).toBe("Chores"); expect(getState().categories).toContain("Chores");
  });
  it("blank text rows are skipped and counted; a file with no To-do column imports nothing", () => { const p = C.parseTodoCsv(`To-do,Due\n,2026-01-01\nReal,\n`); expect(p.todos.length).toBe(1); expect(p.skipped).toBe(1); expect(C.parseTodoCsv("a,b\n1,2").todos.length).toBe(0); });
  it("time formats: 6pm, 18.30, 9:05 am", () => { const t = C.parseTodoCsv(`To-do,Time\nA,6:00 pm\nB,18.30\nC,9:05 am\nD,nonsense\n`).todos.map((x) => x.time); expect(t).toEqual(["18:00", "18:30", "09:05", null]); });
  it("a due time/reminder without a due date is dropped on import", () => { C.applyTodoImport(C.buildTodoImport(C.parseTodoCsv(`To-do,Due date,Time,Reminder (min before)\nX,,10:00,10\n`))); const t: any = getState().todos[0]; expect(t.time).toBeUndefined(); expect(t.rem).toBeUndefined(); });
});
