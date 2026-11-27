import { getState } from "../domain/ctx";
let ac: AudioContext | null = null;
const on = (k: "fxHaptic" | "fxSound") => getState().settings[k] !== false;
export function vib(p: number | number[]) { if (!on("fxHaptic")) return; try { navigator.vibrate && navigator.vibrate(p); } catch { /* unsupported */ } }
export function beep(f: number, d: number, v = 0.05) {
  if (!on("fxSound")) return;
  try {
    const A: any = (window as any).AudioContext || (window as any).webkitAudioContext; if (!A) return;
    ac = ac || new A(); const c = ac!; if (c.state === "suspended") c.resume();
    const o = c.createOscillator(), g = c.createGain(), t = c.currentTime; o.type = "sine"; o.frequency.value = f; g.gain.value = 0.0001;
    o.connect(g); g.connect(c.destination); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.start(t); o.stop(t + d + 0.03);
  } catch { /* audio blocked */ }
}
export function play(k: string) {
  if (k === "tick") vib(8);
  else if (k === "ok") { vib([12, 40, 12]); beep(660, 0.09); setTimeout(() => beep(880, 0.12), 90); }
  else if (k === "warn") { vib(25); beep(260, 0.13); }
  else if (k === "win") { vib([20, 50, 20, 50, 40]); [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.15, 0.06), i * 110)); }
}
