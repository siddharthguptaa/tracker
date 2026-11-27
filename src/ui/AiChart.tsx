import type { ChartSpec } from "../assistant/online";

const nf = (n: number) => (Math.abs(n) >= 1e7 ? (n / 1e7).toFixed(1) + "Cr" : Math.abs(n) >= 1e5 ? (n / 1e5).toFixed(1) + "L" : Math.abs(n) >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, "") + "k" : String(Math.round(n * 100) / 100));
/** Small responsive bar / line chart drawn as SVG with the app's own colours; a text table backs it up for screen readers. */
export function AiChart({ c }: { c: ChartSpec }) {
  const W = 320, H = 170, L = 8, R = 8, T = 18, B = 34, n = c.values.length, max = Math.max(0, ...c.values), min = Math.min(0, ...c.values), span = max - min || 1;
  const y = (v: number) => T + (1 - (v - min) / span) * (H - T - B), step = (W - L - R) / n, x = (i: number) => L + step * (i + 0.5), zero = y(0);
  const lab = (s: string) => (s.length > 7 ? s.slice(0, 6) + "…" : s), every = n > 12 ? 2 : 1;
  return (
    <figure className="aichart" style={{ margin: "8px 0 2px" }}>
      <figcaption style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{c.title}{c.unit ? ` (${c.unit})` : ""}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${c.kind} chart: ${c.title}`} style={{ display: "block", maxWidth: "100%" }}>
        <line x1={L} x2={W - R} y1={zero} y2={zero} stroke="var(--line)" />
        {c.kind === "bar" ? c.values.map((v, i) => { const h = Math.abs(y(v) - zero), bw = Math.max(3, step * 0.62); return <g key={i}><rect x={x(i) - bw / 2} y={v >= 0 ? y(v) : zero} width={bw} height={Math.max(1, h)} rx={2} fill="var(--accent)" />{n <= 12 ? <text x={x(i)} y={(v >= 0 ? y(v) : y(v) + 10) - (v >= 0 ? 3 : 0)} fontSize="9" textAnchor="middle" fill="var(--mute)">{nf(v)}</text> : null}</g>; })
          : <><polyline fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" points={c.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />{c.values.map((v, i) => <g key={i}><circle cx={x(i)} cy={y(v)} r="3" fill="var(--accent)" />{n <= 8 ? <text x={x(i)} y={y(v) - 7} fontSize="9" textAnchor="middle" fill="var(--mute)">{nf(v)}</text> : null}</g>)}</>}
        {c.labels.map((l, i) => (i % every ? null : <text key={i} x={x(i)} y={H - 14} fontSize="9" textAnchor="middle" fill="var(--mute)">{lab(l)}</text>))}
      </svg>
      <table style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}><tbody>{c.labels.map((l, i) => <tr key={i}><td>{l}</td><td>{c.values[i]}</td></tr>)}</tbody></table>
    </figure>
  );
}
