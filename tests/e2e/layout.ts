/**
 * Layout rules for the responsive sweep (responsive.spec.ts).
 *
 * `layoutCheck` is serialised and run inside the page, so every helper it uses is defined inside it.
 * It inspects the top-most layer: an open dialog, else an open sheet, else the app itself.
 */
export type LayoutReport = {
  layer: "app" | "sheet" | "dialog";
  vw: number;
  hOverflow: number;
  items: number;
  offscreen: string[];
  offscreenCount: number;
  overlaps: string[];
  overlapCount: number;
  clipped: string[];
  sheetFit: string;
  smallTargets: number;
  tinyText: number;
  ellipsized: number;
};

export function layoutCheck(): LayoutReport {
  const vw = document.documentElement.clientWidth, vh = window.innerHeight;
  const cs = (e: Element) => getComputedStyle(e);
  const inView = (r: DOMRect) => r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
  const isVis = (e: HTMLElement) => {
    const c = cs(e);
    if (c.display === "none" || c.visibility === "hidden" || parseFloat(c.opacity) < 0.05) return false;
    const r = e.getBoundingClientRect();
    return r.width >= 1 && r.height >= 1;
  };
  const label = (e: HTMLElement) => {
    const t = String(e.getAttribute("aria-label") || e.innerText || (e as HTMLInputElement).placeholder || (e as HTMLInputElement).value || "").replace(/\s+/g, " ").trim();
    if (t) return t.slice(0, 40);
    const cls = typeof e.className === "string" && e.className ? "." + e.className.split(" ")[0] : "";
    return (e.tagName.toLowerCase() + (e.id ? "#" + e.id : "") + cls).slice(0, 40);
  };
  // A scroller that is wider than its box is deliberate (chips, segmented controls), so its overflow is not "off-screen".
  const inScroller = (e: HTMLElement) => {
    for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) {
      const c = cs(a);
      if (/(auto|scroll|hidden)/.test(c.overflowX) && a.scrollWidth > a.clientWidth + 1) return true;
    }
    return false;
  };
  // The part of an element's box that is actually visible: clipped by every ancestor that clips overflow.
  const clipOf = (e: HTMLElement) => {
    let l = -1e9, r = 1e9, t = -1e9, b = 1e9;
    for (let a: HTMLElement | null = e; a && a !== document.documentElement; a = a.parentElement) {
      const c = cs(a);
      if (c.overflowX !== "visible" || c.overflowY !== "visible") {
        const q = a.getBoundingClientRect();
        l = Math.max(l, q.left); r = Math.min(r, q.right); t = Math.max(t, q.top); b = Math.min(b, q.bottom);
      }
    }
    return { l, r, t, b };
  };
  const clampR = (q: DOMRect, c: { l: number; r: number; t: number; b: number }) => {
    const l = Math.max(q.left, c.l), rr = Math.min(q.right, c.r), t = Math.max(q.top, c.t), b = Math.min(q.bottom, c.b);
    return rr - l >= 1 && b - t >= 1 ? { left: l, right: rr, top: t, bottom: b } : null;
  };
  // Closed <details> keep their content in layout but do not paint it, and their clip is not a DOM ancestor.
  const hiddenByDetails = (e: HTMLElement) => {
    const d = e.closest("details:not([open])");
    if (!d) return false;
    const s = e.closest("summary");
    return !(s && s.parentElement === d);
  };
  // Short fixed layers (bottom nav, add button, snackbars) float over scrolled content by design.
  // A full-height fixed layer (the desktop sidebar) is real layout and is compared with the content.
  const fixedGroup = (e: HTMLElement) => {
    for (let a: HTMLElement | null = e; a && a !== document.body; a = a.parentElement) {
      const pos = cs(a).position;
      // Floating buttons and snackbars are positioned absolutely inside the app shell, so they are recognised by class.
      if (/(^|\s)(fab|toast|snack|nudgebar)(\s|$)/.test(String(a.className))) return { el: a, overlay: true };
      if (pos === "fixed" || pos === "sticky") {
        const r = a.getBoundingClientRect();
        return { el: a, overlay: pos === "fixed" && r.height < vh * 0.9 };
      }
    }
    return null;
  };

  const askov = [...document.querySelectorAll<HTMLElement>(".askov")].find((e) => isVis(e) && inView(e.getBoundingClientRect()));
  const sheet = askov ? undefined : [...document.querySelectorAll<HTMLElement>(".sheet")].find((e) => isVis(e) && inView(e.getBoundingClientRect()));
  const root = askov || sheet || document.querySelector<HTMLElement>("#app") || document.body;
  const layer = askov ? "dialog" : sheet ? "sheet" : "app";

  type Item = { el: HTMLElement; rects: { left: number; right: number; top: number; bottom: number }[]; name: string; grp: ReturnType<typeof fixedGroup> };
  const items: Item[] = [];
  let tinyText = 0, smallTargets = 0, ellipsized = 0;
  for (const e of Array.from(root.querySelectorAll<HTMLElement>("*"))) {
    if (!isVis(e) || hiddenByDetails(e)) continue;
    const tag = e.tagName.toLowerCase();
    if (e.closest("svg") && tag !== "svg") continue;
    // transient, dismissible notices (app toasts, the Money backup reminder) are not part of the layout
    if (e.closest("#toast, .toast, [role=status], [role=alert], .nudgebar")) continue;
    const interactive = /^(button|a|input|select|textarea|summary)$/.test(tag) && !(tag === "input" && ((e as HTMLInputElement).type === "file" || (e as HTMLInputElement).type === "hidden"));
    const cl = clipOf(e);
    const rects: Item["rects"] = [];
    const ownText = [...e.childNodes].some((n) => n.nodeType === 3 && (n.textContent || "").trim());
    if (interactive) {
      const b = clampR(e.getBoundingClientRect(), cl);
      if (b) { rects.push(b); if (b.right - b.left < 24 || b.bottom - b.top < 24) smallTargets++; }
    } else {
      for (const n of Array.from(e.childNodes)) {
        if (n.nodeType !== 3 || !(n.textContent || "").trim()) continue;
        const rg = document.createRange();
        rg.selectNodeContents(n);
        for (const q of Array.from(rg.getClientRects())) { const c2 = clampR(q, cl); if (c2) rects.push(c2); }
      }
    }
    if (!rects.length) continue;
    if (ownText && parseFloat(cs(e).fontSize) < 11) tinyText++;
    if (ownText && cs(e).textOverflow === "ellipsis" && e.scrollWidth > e.clientWidth + 1) ellipsized++;
    items.push({ el: e, rects, name: label(e), grp: fixedGroup(e) });
  }

  const overlapOf = (a: Item["rects"][number], b: Item["rects"][number]) => {
    const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left), iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return ix > 2 && iy > 2 ? [ix, iy] : null;
  };
  const overlaps: string[] = [];
  let overlapCount = 0;
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const A = items[i], B = items[j];
      if (A.el.contains(B.el) || B.el.contains(A.el)) continue;
      if (A.grp?.el !== B.grp?.el && ((A.grp && A.grp.overlay) || (B.grp && B.grp.overlay))) continue;
      let hit: number[] | null = null;
      outer: for (const qa of A.rects) for (const qb of B.rects) { const o = overlapOf(qa, qb); if (o) { hit = o; break outer; } }
      if (hit) {
        overlapCount++;
        if (overlaps.length < 8) overlaps.push(`${A.name} ⟷ ${B.name} (${Math.round(hit[0])}×${Math.round(hit[1])})`);
      }
    }
  }

  const offscreen = items
    .filter((it) => it.rects.some((q) => q.right > vw + 1 || q.left < -1) && !inScroller(it.el))
    .map((it) => it.name);

  const clipped: string[] = [];
  for (const e of Array.from(root.querySelectorAll<HTMLElement>("*"))) {
    if (!isVis(e) || hiddenByDetails(e) || !(e.textContent || "").trim()) continue;
    const c = cs(e);
    if (!/(hidden|clip)/.test(c.overflowX) || c.textOverflow === "ellipsis") continue;
    if (e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 2) clipped.push(label(e));
  }

  let sheetFit = "n/a";
  const box = askov ? ([...askov.children].find((c) => isVis(c as HTMLElement)) as HTMLElement | undefined) || askov : sheet;
  if (box) {
    const r = box.getBoundingClientRect();
    const innerScroll = [...box.querySelectorAll<HTMLElement>("*")].some((e) => /(auto|scroll)/.test(cs(e).overflowY) && e.scrollHeight > e.clientHeight + 1);
    const fits = r.top >= -1 && r.bottom <= vh + 1;
    sheetFit = fits || innerScroll || /(auto|scroll)/.test(cs(box).overflowY) ? "ok" : `runs ${Math.round(r.bottom - vh)}px past the bottom and cannot scroll`;
  }

  return {
    layer, vw,
    hOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    items: items.length,
    offscreen: offscreen.slice(0, 6), offscreenCount: offscreen.length,
    overlaps, overlapCount,
    clipped: clipped.slice(0, 6),
    sheetFit,
    smallTargets, tinyText, ellipsized,
  };
}

/** Turns a report into readable problems. Node-side only. */
export function problemsOf(r: LayoutReport, viewport: number, opts: { blankIfFewItems?: boolean; viewportKnown?: boolean } = {}): string[] {
  const out: string[] = [];
  // An embedded frame is narrower than the window (the sidebar takes its share), so its width is not compared.
  if (opts.viewportKnown !== false && r.vw !== viewport) out.push(`viewport is ${r.vw}px wide, expected ${viewport}px`);
  if (r.hOverflow > 1) out.push(`scrolls sideways by ${r.hOverflow}px`);
  if (r.offscreenCount) out.push(`off-screen: ${r.offscreen.slice(0, 3).join(" | ")}`);
  if (r.overlapCount) out.push(`${r.overlapCount} overlapping pairs, e.g. ${r.overlaps.slice(0, 2).join(" ;; ")}`);
  if (r.clipped.length) out.push(`text cut off: ${r.clipped.slice(0, 3).join(" | ")}`);
  if (r.sheetFit.startsWith("runs")) out.push(`sheet ${r.sheetFit}`);
  if (opts.blankIfFewItems !== false && r.layer === "app" && r.items < 8) out.push(`almost empty (${r.items} items), probably not rendered`);
  return out;
}
