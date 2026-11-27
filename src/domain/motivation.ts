import { getState } from "./ctx";
import { addDays, isoOf, todayStr } from "./clock";
import { commit } from "../storage/store";
import { readMoney } from "../storage/moneyStore";
export const QUOTES = ["Small steps, taken daily, beat big plans taken never.", "You don't have to be great to start, but you have to start to be great.", "Discipline is choosing what you want most over what you want now.", "One log today keeps the goal alive.", "Progress, not perfection.", "The best time to start was yesterday. The next best is right now.", "Consistency compounds. Show up again today.", "Done is better than perfect.", "Your future self is watching what you do today.", "Make it a little easier to start than to skip.", "Every expert was once a beginner who kept going.", "Motivation gets you started. Habit keeps you going.", "Don't count the days. Make the days count.", "A year from now you'll wish you had started today.", "Tiny wins add up to big results.", "Be stronger than your excuses.", "Focus on the next step, not the whole staircase.", "What you do every day matters more than what you do once in a while.", "Money saved today is freedom bought tomorrow.", "Track it, and it improves.", "Rest if you must, but never quit.", "Start where you are. Use what you have. Do what you can.", "Your goals don't care how you feel — but your actions do.", "Win the morning, win the day.", "Clear the small stuff so the big stuff has room.", "It always seems impossible until it's done.", "Be the person your goals need.", "Slow progress is still progress.", "Five focused minutes beat an hour of intentions.", "Plan the work, then work the plan.", "Today's effort is tomorrow's momentum.", "Little by little, a little becomes a lot.", "Choose the hard thing that makes life easy later.", "Energy follows action. Begin, and it arrives.", "Know your numbers. Own your future.", "Wealth is built in quiet, boring, repeated habits.", "You're closer than you were yesterday.", "Finish what you start, one item at a time.", "Doubt kills more dreams than failure ever will.", "Show up, even when it's small."];
export function engageOpen() {
  const e = getState().engage = getState().engage || {}, t = todayStr();
  if (e.last !== t) { e.streak = e.last === addDays(t, -1) ? (e.streak || 0) + 1 : 1; e.best = Math.max(e.best || 0, e.streak); e.last = t; e.opens = (e.opens || 0) + 1; e.fresh = true; commit(); }
  return e;
}
export function moneyTodayCount() { const D = readMoney(), t = todayStr(); return D ? D.records.filter((r) => r.d === t).length : 0; }
export function todayWins() {
  const t = todayStr();
  return [
    {k:"goal", l:"Log progress on a goal", d:getState().goals.some(g => (g.logs || []).some(x => x.date === t) || (g.checks || []).includes(t) || (g.milestones || []).some(m => m.done && m.doneDate === t)), a:"tab", v:"goals"},
    {k:"todo", l:"Finish a to-do", d:getState().todos.some(x => x.done && x.doneAt && isoOf(x.doneAt) === t), a:"tab", v:"todo"},
    {k:"money", l:"Record today's money", d:moneyTodayCount() > 0, a:"tab", v:"money"}
  ];
}
