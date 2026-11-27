import { useEffect, useRef, useState } from "react";
import { ask } from "./ask";
import { writeWorkbook } from "./goalIo";
import { Sheet } from "./Sheet";
import { useAppState, commit } from "../storage/store";
import { getState } from "../domain/ctx";
import { openSheet, setUi, toast } from "./uiStore";
import { fmtDate, esc, uid } from "../domain/format";
import { addDays, todayStr, isoOf } from "../domain/clock";
import * as V from "../domain/vault";
import { copyValue, copySecret } from "./vaultUi";
import { fput, fget, fdel, shrinkImage } from "./vaultFiles";
import { play } from "./fx";

const agoShort = (t: number) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "just now" : m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : fmtDate(isoOf(t)); };

/* ------------------------------ detail ------------------------------ */
function Row({ it, label, k, val, secret }: { it: any; label: string; k: string; val: any; secret?: boolean }) {
  const [show, setShow] = useState(false);
  useEffect(() => { if (!show) return; const t = setTimeout(() => setShow(false), 10000); return () => clearTimeout(t); }, [show]);   // revealed secrets hide again after 10 s
  if (val == null || val === "") return null;
  const shown = !secret || show;
  return (
    <div className="vrow"><div style={{ minWidth: 0, flex: 1 }}><small>{label}</small><span className={secret && !shown ? "pwbox" : ""} style={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>{shown ? String(val) : "••••••••••••"}</span></div>
      <div style={{ display: "flex", gap: 6, flex: "none" }}>{secret ? <button className="btn small alt" onClick={() => setShow(!show)}>{shown ? "Hide" : "Show"}</button> : null}<button className="btn small alt" onClick={() => copyValue(it, k, String(val))}>Copy</button></div></div>
  );
}
function Totp({ it }: { it: any }) {
  const [r, setR] = useState<{ code: string; left: number; period: number } | null | undefined>(undefined);
  useEffect(() => { let on = true; const tick = async () => { const x = await V.totpCode(it.totp); if (on) setR(x); }; tick(); const t = setInterval(tick, 1000); return () => { on = false; clearInterval(t); }; }, [it.totp]);
  return (
    <div className="vrow totpbox"><div style={{ minWidth: 0, flex: 1 }}><small>Authenticator code <span className="totpleft">{r ? r.left + "s" : ""}</span></small>
      <span className="totpcode">{r === null ? "Invalid key" : r ? (r.code.length === 6 ? r.code.slice(0, 3) + " " + r.code.slice(3) : r.code) : "······"}</span>
      <div className="totpbar"><i style={{ width: r ? (r.left / r.period) * 100 + "%" : 0, background: r && r.left <= 5 ? "var(--red)" : "var(--accent)" }} /></div></div>
      <button className="btn small alt" onClick={() => copySecret(it, "totp")}>Copy</button></div>
  );
}
function Files({ it }: { it: any }) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => { let on = true; (async () => { const o: Record<string, string> = {}; for (const f of it.files || []) { if (!/^image\//.test(f.type)) continue; const b = await fget(f.id); if (b) o[f.id] = URL.createObjectURL(b); } if (on) setUrls(o); })(); return () => { on = false; }; }, [it.id, (it.files || []).length]);
  if (!(it.files || []).length) return null;
  const open = async (f: any) => { const b = await fget(f.id); if (!b) return toast("That file is missing on this device"); window.open(URL.createObjectURL(b), "_blank", "noopener"); };
  return <div className="panel"><b>Attachments</b><div className="vfiles">{it.files.map((f: any) => <button key={f.id} className="vfile" aria-label={"Open " + f.name} onClick={() => open(f)}>{urls[f.id] ? <img src={urls[f.id]} alt={f.name} /> : <span style={{ fontSize: 26 }}>📄</span>}<small>{f.name}</small></button>)}</div></div>;
}
export function VaultDetail({ id }: { id: string }) {
  useAppState(); const it = V.vById(id); const [hist, setHist] = useState<Record<number, boolean>>({});
  if (!it) return null;
  const t = V.V_TYPES[it.type] || V.V_TYPES.login, g = it.goalId ? getState().goals.find((x) => x.id === it.goalId) : null, ex = V.vExpiry(it), s = getState().settings;
  const uris = V.itemUris(it), reused = it.password ? getState().vault.items.filter((x: any) => !x.trashed && x.id !== it.id && x.password === it.password).length : 0, sc = it.password ? V.pwScore(it.password) : null;
  return (
    <Sheet label={it.title}>
      <div className="row"><span className="cat">{t.i} {t.l}{V.folderName(it) ? " · " + V.folderName(it) : ""}</span><button className="x" aria-label={it.fav ? "Remove favourite" : "Favourite"} onClick={() => V.toggleFav(it)}>{it.fav ? "★" : "☆"}</button></div>
      <h1 style={{ marginTop: 2 }}>{it.title}</h1>
      {ex && ex <= addDays(todayStr(), 60) ? <div className="alert" style={{ cursor: "default" }}>⏳ <b>{ex < todayStr() ? "Expired" : "Expires soon"}</b> — {fmtDate(ex)}</div> : null}
      <div className="panel">
        {it.type === "login" ? <>
          <Row it={it} label="Username" k="user" val={it.username} />
          {it.password ? <div className="vrow"><div style={{ minWidth: 0, flex: 1 }}><small>Password · {sc!.label}{reused ? <> · <span className="red">reused in {reused} other{reused > 1 ? "s" : ""}</span></> : null}</small></div></div> : null}
          <Row it={it} label="Password" k="pw" val={it.password} secret />
          {it.totp ? <Totp it={it} /> : null}
          {uris.map((u, n) => <div key={n} className="vrow"><div style={{ minWidth: 0, flex: 1 }}><small>Website{uris.length > 1 ? " " + (n + 1) : ""}</small><span style={{ overflowWrap: "anywhere" }}>{/^https?:\/\//i.test(u) ? <a href={u} target="_blank" rel="noopener noreferrer">{u}</a> : u}</span></div><button className="btn small alt" onClick={() => copyValue(it, "url", u)}>Copy</button></div>)}
        </> : null}
        {it.type === "card" ? (() => { const c = it.card || {}; return <><Row it={it} label="Cardholder" k="card:holder" val={c.holder} /><Row it={it} label="Brand" k="card:brand" val={c.brand} /><Row it={it} label="Number" k="card:number" val={c.number} secret /><Row it={it} label="Expiry" k="card:exp" val={c.exp} /><Row it={it} label="Security code (CVV)" k="card:cvv" val={c.cvv} secret /></>; })() : null}
        {it.type === "identity" ? V.IDN_KEYS.map(([k, l]) => <Row key={k} it={it} label={l} k={"idn:" + k} val={(it.idn || {})[k]} secret={k === "ssn" || k === "passport" || k === "license"} />) : null}
        {V.V_SCHEMA[it.type] ? V.V_SCHEMA[it.type].map((f) => <Row key={f.k} it={it} label={f.l} k={"f:" + f.k} val={(it.f || {})[f.k] && f.t === "date" ? fmtDate(it.f[f.k]) : (it.f || {})[f.k]} secret={!!f.s} />) : null}
        {it.type === "note" ? <Row it={it} label="Note" k="note" val={it.notes || "(empty)"} secret /> : null}
        {(it.fields || []).map((f: any, n: number) => <Row key={n} it={it} label={f.n || "Field"} k={"cf:" + n} val={f.v} secret={!!f.h} />)}
        {it.type !== "note" && it.notes ? <Row it={it} label="Notes" k="note" val={it.notes} /> : null}
        {g ? <div className="vrow"><div><small>Linked goal</small>🎯 {g.name}</div></div> : null}
        {!document ? null : <EmptyHint it={it} />}
      </div>
      <Files it={it} />
      {(it.history || []).length ? <details className="panel acc"><summary>Password history<span className="accs">{it.history.length}</span></summary>{it.history.map((h: any, n: number) => <div key={n} className="vrow"><div style={{ minWidth: 0, flex: 1 }}><small>{fmtDate(isoOf(h.t))}</small><span className={hist[n] ? "" : "pwbox"} style={{ overflowWrap: "anywhere" }}>{hist[n] ? h.pw : "••••••••••••"}</span></div><div style={{ display: "flex", gap: 6 }}><button className="btn small alt" onClick={() => setHist({ ...hist, [n]: !hist[n] })}>{hist[n] ? "Hide" : "Show"}</button><button className="btn small alt" onClick={() => copyValue(it, "hist:" + n, h.pw)}>Copy</button></div></div>)}</details> : null}
      {(it.log || []).length ? <details className="panel acc"><summary>Activity<span className="accs">last {Math.min(10, it.log.length)}</span></summary>{it.log.slice(-10).reverse().map((l: any, n: number) => <div key={n} className="vrow" style={{ padding: "6px 0" }}><span>{l.a}</span><small>{agoShort(l.t)}</small></div>)}</details> : null}
      <p className="note">{it.trashed ? "In trash · " : ""}Updated {fmtDate(isoOf(it.updated || it.created || Date.now()))}. Copied secrets are cleared from the clipboard after {s.vaultClip === 0 ? "never" : (s.vaultClip || 30) + " seconds"}; revealed ones hide again after 10 s.</p>
      {it.trashed ? <div className="btns"><button className="btn alt" onClick={() => setUi({ sheet: null })}>Close</button><button className="btn" onClick={() => { V.restoreItem(it); setUi({ sheet: null }); toast("Restored"); }}>Restore</button></div> : <>
        <div className="btns"><button className="btn alt" onClick={() => setUi({ sheet: null })}>Close</button><button className="btn" onClick={() => openSheet("vedit", it.id)}>Edit</button></div>
        <div className="btns"><button className="btn alt" onClick={async () => { const c = V.cloneItem(it); for (const f of it.files || []) { const b = await fget(f.id); if (b) { const nid = uid(); await fput(nid, b); c.files.push({ ...f, id: nid }); } } commit(); openSheet("vdetail", c.id); toast("Cloned — edit the copy as needed"); }}>Clone</button>
          <button className="btn danger" onClick={() => { const snap = JSON.stringify(it); V.trashItem(it); setUi({ sheet: null }); toast(`“${it.title}” moved to trash`, { label: "Undo", fn: () => { delete it.trashed; commit(); void snap; } }); play("warn"); }}>Move to trash</button></div></>}
    </Sheet>
  );
}
const EmptyHint = ({ it }: { it: any }) => { const empty = !(it.username || it.password || it.totp || V.itemUris(it).length || it.notes || (it.fields || []).length || it.card || it.idn || it.f); return empty ? <p className="note">Nothing saved in this item yet. Tap Edit to add details.</p> : null; };

/* ------------------------------ editor ------------------------------ */
export function VaultEdit({ id, type }: { id: string | null; type?: string }) {
  const s = useAppState(), cur = id ? V.vById(id) : null, t0 = cur ? cur.type : type || "login";
  const [title, setTitle] = useState(cur?.title || ""), [folder, setFolder] = useState(cur?.folderId || ""), [goal, setGoal] = useState(cur?.goalId || ""), [fav, setFav] = useState(!!cur?.fav), [notes, setNotes] = useState(cur?.notes || "");
  const [uris, setUris] = useState<string[]>(cur ? (V.itemUris(cur).length ? V.itemUris(cur) : [""]) : [""]), [user, setUser] = useState(cur?.username || ""), [pw, setPw] = useState(cur?.password || ""), [showPw, setShowPw] = useState(false), [totp, setTotp] = useState(cur?.totp || "");
  const [card, setCard] = useState<any>(cur?.card || {}), [idn, setIdn] = useState<any>(cur?.idn || {}), [fd, setFd] = useState<any>(cur?.f || {}), [fields, setFields] = useState<any[]>(cur?.fields ? cur.fields.map((x: any) => ({ ...x })) : []);
  const [pend, setPend] = useState<{ id: string; blob: Blob; name: string; type: string; size: number }[]>([]), [rem, setRem] = useState<Record<string, boolean>>({}), fi = useRef<HTMLInputElement>(null);
  const T = V.V_TYPES[t0] || V.V_TYPES.login, folders = s.vault.folders.slice().sort((a: any, b: any) => a.name.localeCompare(b.name)), goals = s.goals.filter((g) => !g.archived), score = V.pwScore(pw);
  const save = async () => {
    const input: V.ItemInput = { type: t0, title, folderId: folder, goalId: goal, fav, notes, fields, uris, username: user, password: pw, totp, card, idn, f: fd };
    const err = V.validateItem(input); if (err) return toast(err);
    const it = V.saveItem(input, id || undefined);
    it.files = (it.files || []).filter((x: any) => { if (rem[x.id]) { fdel(x.id); return false; } return true; });
    for (const p of pend) { try { await fput(p.id, p.blob); it.files.push({ id: p.id, name: p.name, type: p.type, size: p.size }); } catch { toast("Couldn't store " + p.name + " on this device"); } }
    commit(); openSheet("vdetail", it.id); toast("Saved"); play("ok");
    try { navigator.storage?.persist?.(); } catch { /* optional */ }
  };
  const attach = async (list: FileList | null) => { const out = [...pend]; for (const f of Array.from(list || [])) { if (f.size > 15 * 1024 * 1024) { toast(f.name + " is over 15 MB"); continue; } const blob = /^image\//.test(f.type) ? await shrinkImage(f) : f; out.push({ id: uid(), blob, name: f.name, type: blob.type || f.type, size: blob.size }); } setPend(out); };
  const inp = (label: string, v: string, set: (x: string) => void, extra: any = {}) => <><label>{label}</label><input type={extra.type || "text"} value={v} onChange={(e) => set(e.target.value)} autoComplete="off" aria-label={label} {...(extra.props || {})} /></>;
  return (
    <Sheet label={id ? "Edit item" : "New " + T.l}>
      <h1>{id ? "Edit" : "New"} {T.l.toLowerCase()}</h1>
      {inp("Name", title, setTitle, { props: { id: "ve_title", placeholder: "e.g. Gmail", autoFocus: !id } })}
      {t0 === "login" ? <>
        <label>Website(s)</label>{uris.map((u, n) => <div key={n} className="vfrow"><input type="text" inputMode="url" placeholder="https://" aria-label={"Website " + (n + 1)} value={u} onChange={(e) => setUris(uris.map((x, i) => (i === n ? e.target.value : x)))} /><button className="x" type="button" aria-label="Remove website" onClick={() => setUris(uris.length > 1 ? uris.filter((_, i) => i !== n) : [""])}>✕</button></div>)}
        <button className="btn small alt" type="button" style={{ marginTop: 6 }} onClick={() => setUris([...uris, ""])}>＋ Add website</button>
        <label>Username or email</label><div style={{ display: "flex", gap: 8 }}><input type="text" value={user} onChange={(e) => setUser(e.target.value)} autoComplete="off" aria-label="Username or email" style={{ flex: 1 }} /><button className="btn small alt" type="button" aria-label="Generate username" onClick={() => setUser(V.genUsername())}>🎲</button></div>
        <label>Password</label><div style={{ display: "flex", gap: 8 }}><input type={showPw ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="off" aria-label="Password" style={{ flex: 1 }} /><button className="btn small alt" type="button" onClick={() => setShowPw(!showPw)}>{showPw ? "Hide" : "Show"}</button><button className="btn small alt" type="button" aria-label="Generate password" onClick={() => { setPw(V.genPassword(20, { lower: true, upper: true, digits: true, symbols: true })); setShowPw(true); }}>🎲</button></div>
        <div className="meter"><i style={{ width: score.w + "%", background: score.c }} /></div><div className="note" style={{ margin: "3px 0 0" }}>{score.label}{pw ? ` · about ${Math.round(score.bits)} bits` : ""}</div>
        {inp("Authenticator key (optional)", totp, setTotp, { props: { placeholder: "Setup key or otpauth:// link" } })}
      </> : null}
      {t0 === "card" ? <>{inp("Cardholder", card.holder || "", (x) => setCard({ ...card, holder: x }))}<label>Brand</label><select value={card.brand || ""} onChange={(e) => setCard({ ...card, brand: e.target.value })} aria-label="Brand"><option value="">—</option>{V.CARD_BRANDS.map((b) => <option key={b}>{b}</option>)}</select>{inp("Card number", card.number || "", (x) => setCard({ ...card, number: x }), { props: { inputMode: "numeric" } })}<div className="g2"><div>{inp("Expiry (MM/YY)", card.exp || "", (x) => setCard({ ...card, exp: x }))}</div><div>{inp("CVV", card.cvv || "", (x) => setCard({ ...card, cvv: x }), { props: { inputMode: "numeric" } })}</div></div></> : null}
      {t0 === "identity" ? V.IDN_KEYS.map(([k, l]) => <div key={k}>{inp(l, idn[k] || "", (x) => setIdn({ ...idn, [k]: x }))}</div>) : null}
      {V.V_SCHEMA[t0] ? V.V_SCHEMA[t0].map((f) => <div key={f.k}><label>{f.l}</label>{f.o ? <select value={fd[f.k] || ""} aria-label={f.l} onChange={(e) => setFd({ ...fd, [f.k]: e.target.value })}><option value="">—</option>{f.o.map((o) => <option key={o}>{o}</option>)}</select> : <input type={f.t === "date" ? "date" : "text"} value={fd[f.k] || ""} aria-label={f.l} autoComplete="off" onChange={(e) => setFd({ ...fd, [f.k]: e.target.value })} />}</div>) : null}
      <label>{t0 === "note" ? "Note" : "Notes"}</label><textarea rows={t0 === "note" ? 8 : 3} value={notes} aria-label="Notes" onChange={(e) => setNotes(e.target.value)} />
      <details className="acc" style={{ marginTop: 10 }} open={fields.length > 0}><summary>Custom fields</summary>
        {fields.map((f, n) => <div key={n} className="vfrow"><input type="text" placeholder="Field name" aria-label="Field name" value={f.n} onChange={(e) => setFields(fields.map((x, i) => (i === n ? { ...x, n: e.target.value } : x)))} /><input type="text" placeholder="Value" aria-label="Field value" value={f.v} onChange={(e) => setFields(fields.map((x, i) => (i === n ? { ...x, v: e.target.value } : x)))} /><select aria-label="Field type" value={f.h ? "1" : ""} onChange={(e) => setFields(fields.map((x, i) => (i === n ? { ...x, h: e.target.value === "1" } : x)))}><option value="">Text</option><option value="1">Hidden</option></select><button className="x" type="button" aria-label="Remove field" onClick={() => setFields(fields.filter((_, i) => i !== n))}>✕</button></div>)}
        <button className="btn small alt" type="button" style={{ marginTop: 6 }} onClick={() => setFields([...fields, { n: "", v: "", h: false }])}>＋ Add field</button></details>
      <details className="acc" style={{ marginTop: 6 }} open={!!(cur?.files || []).length}><summary>Photos &amp; files</summary>
        {(cur?.files || []).filter((f: any) => !rem[f.id]).map((f: any) => <div key={f.id} className="vfrow"><span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{/^image\//.test(f.type) ? "🖼" : "📄"} {f.name}</span><button className="x" type="button" aria-label={"Remove " + f.name} onClick={() => setRem({ ...rem, [f.id]: true })}>✕</button></div>)}
        {pend.map((f) => <div key={f.id} className="vfrow"><span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{/^image\//.test(f.type) ? "🖼" : "📄"} {f.name} <small>(new)</small></span><button className="x" type="button" aria-label={"Remove " + f.name} onClick={() => setPend(pend.filter((x) => x.id !== f.id))}>✕</button></div>)}
        <input ref={fi} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => { attach(e.target.files); e.target.value = ""; }} /><button className="btn small alt" type="button" style={{ marginTop: 6 }} onClick={() => fi.current?.click()}>＋ Add photo or PDF</button></details>
      <label>Folder</label><select value={folder} aria-label="Folder" onChange={(e) => setFolder(e.target.value)}><option value="">No folder</option>{folders.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
      <label>Linked goal</label><select value={goal} aria-label="Linked goal" onChange={(e) => setGoal(e.target.value)}><option value="">None</option>{goals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
      <label className="chkrow"><input type="checkbox" checked={fav} onChange={(e) => setFav(e.target.checked)} /> ★ Favourite</label>
      <div className="btns" style={{ marginTop: 14 }}><button className="btn alt" onClick={() => (id ? openSheet("vdetail", id) : setUi({ sheet: null }))}>Cancel</button><button className="btn" onClick={save}>Save</button></div>
    </Sheet>
  );
}
export function VaultPickType() {
  return (
    <Sheet label="New vault item"><h1>Add to vault</h1><p className="sub">What are you saving?</p>
      {Object.entries(V.V_TYPES).map(([k, t]) => <button key={k} className="list-btn" onClick={() => openSheet("vedit", { new: k })}><span>{t.i} {t.l}<small>{t.d}</small></span>›</button>)}
    </Sheet>
  );
}

/* ----------------------------- generator ----------------------------- */
export function VaultGen() {
  const [o, setO] = useState<any>({ mode: "password", len: 20, lo: 1, up: 1, di: 1, sy: 1, am: 0, words: 5, sep: "-", cap: 1, num: 0 }), [out, setOut] = useState("");
  const gen = (x = o) => setOut(x.mode === "phrase" ? V.genPassphrase(x.words, x.sep, !!x.cap, !!x.num) : x.mode === "user" ? V.genUsername() : V.genPassword(x.len, { lower: !!x.lo, upper: !!x.up, digits: !!x.di, symbols: !!x.sy, ambig: !!x.am }));
  useEffect(() => { gen(); /* eslint-disable-next-line */ }, []);
  const up = (p: any) => { const n = { ...o, ...p }; setO(n); gen(n); };
  const tog = (k: string, l: string) => <button className={"chip" + (o[k] ? " on" : "")} aria-pressed={!!o[k]} onClick={() => up({ [k]: o[k] ? 0 : 1 })}>{l}</button>;
  const step = (k: string, v: number, min: number, max: number) => <div className="stepper"><button disabled={v <= min} aria-label="Less" onClick={() => up({ [k]: v - 1 })}>−</button><b>{v}</b><button disabled={v >= max} aria-label="More" onClick={() => up({ [k]: v + 1 })}>＋</button></div>;
  const sc = V.pwScore(out);
  return (
    <Sheet label="Generator"><h1>Generator</h1>
      <div className="seg">{[["password", "Password"], ["phrase", "Passphrase"], ["user", "Username"]].map(([v, l]) => <button key={v} className={o.mode === v ? "on" : ""} onClick={() => up({ mode: v })}>{l}</button>)}</div>
      <div className="panel"><div className="vgout">{out}</div>{o.mode === "user" ? null : <><div className="meter"><i style={{ width: sc.w + "%", background: sc.c }} /></div><div className="note" style={{ margin: "3px 0 0" }}>{sc.label}{out ? ` · about ${Math.round(sc.bits)} bits` : ""}</div></>}
        <div className="btns"><button className="btn alt" onClick={() => gen()}>🎲 Generate again</button><button className="btn" onClick={() => { navigator.clipboard.writeText(out).then(() => toast("Copied"), () => toast("Couldn't copy")); }}>Copy</button></div></div>
      {o.mode === "password" ? <div className="panel"><div className="row"><span>Length</span>{step("len", o.len, 6, 64)}</div><div className="chips" style={{ marginTop: 10 }}>{tog("up", "A–Z")}{tog("lo", "a–z")}{tog("di", "0–9")}{tog("sy", "!@#$")}{tog("am", "Avoid look-alikes")}</div></div>
        : o.mode === "phrase" ? <div className="panel"><div className="row"><span>Words</span>{step("words", o.words, 3, 12)}</div><div className="chips" style={{ marginTop: 10 }}>{tog("cap", "Capitalise")}{tog("num", "Add a number")}{["-", ".", " ", "_"].map((s2) => <button key={s2} className={"chip" + (o.sep === s2 ? " on" : "")} onClick={() => up({ sep: s2 })}>{s2 === " " ? "space" : "“" + s2 + "”"}</button>)}</div><p className="note">Each word is picked at random from {V.V_WORDS.length} words (about {Math.log2(V.V_WORDS.length).toFixed(1)} bits per word).</p></div>
        : <p className="note">A random, easy-to-read username. Use it where the site doesn't need your real name.</p>}
      <button className="btn alt" onClick={() => setUi({ sheet: null })}>Close</button></Sheet>
  );
}

/* ------------------------------- health ------------------------------ */
export function VaultHealth() {
  useAppState(); const [pw, setPw] = useState<Record<string, number>>({}), [busy, setBusy] = useState(false), [info, setInfo] = useState("");
  const au = V.vAudit(V.vLive(), pw);
  const sections: [string, any[], string][] = [["🔁 Reused passwords", au.reused, "Use a different password for every site."], ["⚠️ Weak passwords", au.weak, "Replace with a generated one."], ["🌐 Insecure websites (http)", au.http, "Switch to https if the site supports it."], ["⏳ Expiring or expired", au.expiring, "Renew these soon."], ["📅 Not changed in a year", au.old, "Consider rotating."], ["🔓 No authenticator (2FA)", au.no2fa, "Turn on 2-step verification where offered."], ["🕳 Found in data breaches", au.exposed, "Change these passwords now."], ["❔ Logins without a password", au.nopw, ""]];
  const total = au.reused.length + au.weak.length + au.expiring.length + au.exposed.length;
  const check = async () => { setBusy(true); setInfo(""); const r = await V.checkExposed(); setPw(r.pwned); setBusy(false); setInfo(!r.checked ? "No passwords to check." : r.fails === r.checked ? "Couldn't reach the breach service — are you online?" : `Checked ${r.checked - r.fails} password${r.checked - r.fails === 1 ? "" : "s"}. Only the first 5 characters of a one-way hash left this device.`); };
  return (
    <Sheet label="Vault health"><h1>Vault health</h1><p className="sub">{total ? `${total} thing${total === 1 ? "" : "s"} to fix` : "Looking good 👍"}</p>
      <div className="panel"><button className="btn" style={{ width: "100%" }} disabled={busy} onClick={check}>{busy ? "Checking…" : "🌐 Check for breached passwords (online)"}</button>{info ? <p className="note">{info}</p> : <p className="note">Needs internet. Uses the k-anonymity range service, so your passwords are never sent.</p>}</div>
      {sections.filter(([, l]) => l.length).map(([t, l, hint]) => <details key={t} className="panel acc" open={t.startsWith("🔁") || t.startsWith("⚠️") || t.startsWith("🕳")}><summary>{t}<span className="accs">{l.length}</span></summary>{hint ? <p className="note">{hint}</p> : null}{l.map((i: any) => <button key={i.id} className="list-btn" onClick={() => openSheet("vdetail", i.id)}><span>{V.V_TYPES[i.type].i} {i.title}<small>{V.vSub(i)}</small></span>›</button>)}</details>)}
      <button className="btn alt" onClick={() => setUi({ sheet: null })}>Close</button></Sheet>
  );
}

/* ----------------------------- emergency ----------------------------- */
export function VaultEmerg() {
  const s = getState(), items = V.vLive().filter((i) => i.type !== "note").sort((a, b) => a.title.localeCompare(b.title));
  const [sel, setSel] = useState<Record<string, boolean>>(() => { const o: Record<string, boolean> = {}; items.forEach((i) => { if (i.fav || /emergency/i.test(V.folderName(i))) o[i.id] = true; }); return o; }), [secrets, setSecrets] = useState(false), [note, setNote] = useState(s.settings.emergencyNote || "");
  const print = () => {
    s.settings.emergencyNote = note; commit(); const mask = "•••••• (see the Vault)", chosen = items.filter((i) => sel[i.id]);
    const rows = (i: any) => { const f = i.f || {}, out: [string, any][] = [];
      if (i.type === "login") { V.itemUris(i).forEach((u) => out.push(["Website", u])); out.push(["Username", i.username], ["Password", secrets ? i.password : i.password ? mask : ""], ["2FA", i.totp ? "Authenticator code needed" : ""]); }
      else if (i.type === "card") { const c = i.card || {}; out.push(["Cardholder", c.holder], ["Brand", c.brand], ["Number", secrets ? c.number : c.number ? "•••• " + c.number.replace(/\D/g, "").slice(-4) : ""], ["Expiry", c.exp]); }
      else if (i.type === "identity") { const d = i.idn || {}; V.IDN_KEYS.forEach(([k, l]) => out.push([l, k === "ssn" || k === "passport" || k === "license" ? (secrets ? d[k] : d[k] ? mask : "") : d[k]])); }
      else if (V.V_SCHEMA[i.type]) V.V_SCHEMA[i.type].forEach((sc) => out.push([sc.l, sc.s && !secrets ? (f[sc.k] ? mask : "") : sc.t === "date" && f[sc.k] ? fmtDate(f[sc.k]) : f[sc.k]]));
      (i.fields || []).forEach((x: any) => out.push([x.n, x.h && !secrets ? mask : x.v])); if (i.notes) out.push(["Notes", i.notes]);
      return out.filter((r) => r[1]).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join(""); };
    const html = `<!doctype html><meta charset="utf-8"><title>Emergency information</title><style>body{font:14px system-ui,sans-serif;margin:24px;color:#111}h1{font-size:22px}h2{font-size:16px;margin:18px 0 4px;border-bottom:1px solid #999}table{border-collapse:collapse;width:100%}td{padding:3px 6px;vertical-align:top;border-bottom:1px solid #ddd}td:first-child{width:34%;color:#555}</style><h1>Emergency information</h1><p style="color:#555">Prepared on ${esc(fmtDate(todayStr()))}${secrets ? " · contains passwords, keep it safe" : ""}</p>${note ? `<div style="border:1px solid #999;padding:10px;margin-bottom:14px;white-space:pre-wrap">${esc(note)}</div>` : ""}${chosen.map((i) => `<h2>${V.V_TYPES[i.type].i} ${esc(i.title)}</h2><table>${rows(i)}</table>`).join("")}<script>onload=()=>setTimeout(()=>print(),300)</script>`;
    const w = window.open("", "_blank"); if (!w) return toast("Allow pop-ups to print"); w.document.open(); w.document.write(html); w.document.close();
  };
  return (
    <Sheet label="Emergency sheet"><h1>Emergency sheet</h1><p className="sub">A printed page your family can use if you can't</p>
      <label style={{ marginTop: 0 }}>Message for your family</label><textarea rows={3} value={note} aria-label="Message for your family" placeholder="Where to find documents, who to call first, what to do…" onChange={(e) => setNote(e.target.value)} />
      <label>Include</label><div className="panel" style={{ maxHeight: "34vh", overflow: "auto" }}>{items.length ? items.map((i) => <label key={i.id} className="chkrow"><input type="checkbox" checked={!!sel[i.id]} onChange={(e) => setSel({ ...sel, [i.id]: e.target.checked })} /> {V.V_TYPES[i.type].i} {i.title}</label>) : <p className="note">Add some logins, cards or IDs first.</p>}</div>
      <label className="chkrow"><input type="checkbox" checked={secrets} onChange={(e) => setSecrets(e.target.checked)} /> Print passwords and account numbers too</label>
      <p className="note">Off: the page lists what exists and where, but hides secrets. On: everything is printed, so keep the paper somewhere safe.</p>
      <button className="btn" disabled={!items.some((i) => sel[i.id])} onClick={print}>🖨 Print or save as PDF</button><button className="btn alt" style={{ marginTop: 8 }} onClick={() => setUi({ sheet: null })}>Close</button></Sheet>
  );
}

/* ------------------------ folders, clipboard, CSV ------------------------ */
export function VaultSettings() {
  const st = useAppState(), [nf, setNf] = useState(""), fi = useRef<HTMLInputElement>(null), n = V.vLive().length, tr = V.vTrash().length, folders = st.vault.folders.slice().sort((a: any, b: any) => a.name.localeCompare(b.name));
  const download = (name: string, text: string, type: string) => { const a = document.createElement("a"), u = URL.createObjectURL(new Blob([text], { type })); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); };
  return (
    <Sheet label="Vault settings"><h1>Folders &amp; data</h1>
      {st.vaultOld ? <LegacyVault /> : null}
      <h2>Folders</h2>
      <div className="panel"><input type="text" placeholder="New folder, e.g. Banking, Work, Family" aria-label="New folder name" value={nf} onChange={(e) => setNf(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { const m = V.addFolder(nf); m ? toast(m) : setNf(""); } }} /><button className="btn small" style={{ marginTop: 8 }} onClick={() => { const m = V.addFolder(nf); m ? toast(m) : (setNf(""), toast("Folder added")); }}>Add folder</button></div>
      {folders.map((f: any) => <FolderRow key={f.id} f={f} n={V.vLive().filter((i) => i.folderId === f.id).length} />)}
      {folders.length ? <p className="note">Deleting a folder keeps everything inside it and moves it to “No folder”.</p> : <p className="note">No folders yet.</p>}
      <h2>Clipboard</h2><div className="panel"><label style={{ marginTop: 0 }}>Clear copied passwords after</label><select aria-label="Clear copied passwords after" value={st.settings.vaultClip == null ? 30 : st.settings.vaultClip} onChange={(e) => { st.settings.vaultClip = +e.target.value; commit(); }}>{[[15, "15 seconds"], [30, "30 seconds"], [60, "1 minute"], [0, "Never"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
      <h2>Excel &amp; CSV</h2>
      <button className="list-btn" onClick={async () => { if (!n) return toast("Nothing to export yet"); if (!await ask("This file will contain your passwords and card details in plain text. Anyone who gets it can read them. Export anyway?", "Export")) return; writeWorkbook("vault-" + todayStr(), [{ name: "Vault", rows: [V.V_COLS, ...V.vRowsForExport()] }], [V.V_COLS, ...V.vRowsForExport()], () => toast(n + " items exported — delete the file when you're done")); }}><span>Export to Excel (.xlsx)<small>{n} item{n === 1 ? "" : "s"} · one sheet · includes logins, cards, identities and notes</small></span>›</button>
      <button className="list-btn" onClick={async () => { if (!n) return toast("Nothing to export yet"); if (!await ask("This file will contain your passwords and card details in plain text. Anyone who gets it can read them. Export anyway?", "Export")) return; download("vault-" + todayStr() + ".csv", V.vCsvText(), "text/csv"); toast(n + " items exported — delete the file when you're done"); }}><span>Export to CSV<small>{n} item{n === 1 ? "" : "s"} · Bitwarden-compatible columns</small></span>›</button>
      <input ref={fi} type="file" accept=".csv,text/csv" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; const r = V.vImportRows(V.parseCSV(await f.text())); r.err ? toast(r.err) : toast(`Imported ${r.added} item${r.added === 1 ? "" : "s"}${r.skipped ? ` · skipped ${r.skipped} duplicate or empty` : ""}`); }} />
      <button className="list-btn" onClick={() => fi.current?.click()}><span>Import from CSV<small>Bitwarden, Chrome, Edge, Firefox, LastPass, 1Password or this app's own export</small></span>›</button>
      <p className="note">Exported files are not encrypted. Delete them after use. Importing skips items that already exist. Excel needs internet once to load its writer; CSV always works offline.</p>
      <h2>Danger zone</h2>
      {tr ? <button className="list-btn" onClick={async () => { if (await ask(`Permanently delete ${tr} item(s)?`)) { V.emptyTrash(); toast("Trash emptied"); } }}><span>Empty trash<small>{tr} item{tr === 1 ? "" : "s"} will be deleted permanently</small></span>›</button> : null}
      <button className="list-btn" onClick={async () => { if (await ask("Delete EVERY item in the vault on this device? This can't be undone.", "Erase") && await ask("Really erase the whole vault?", "Erase")) { V.eraseVault(); toast("Vault erased"); } }}><span>Erase the vault<small>Deletes every saved item on this device</small></span>›</button>
      <p className="note">The vault has no master password. Items are stored in this browser on this device, so anyone who can open this app here can read them. Use your phone's screen lock, and don't use this on a shared device.</p>
      <button className="btn alt" onClick={() => setUi({ sheet: null })}>Close</button></Sheet>
  );
}
function FolderRow({ f, n }: { f: any; n: number }) {
  const [v, setV] = useState(f.name);
  return <details className="acc tgd"><summary><span style={{ fontWeight: 650 }}>{f.name}</span><span className="accs">{n} item{n === 1 ? "" : "s"}</span></summary>
    <input type="text" value={v} aria-label="Folder name" onChange={(e) => setV(e.target.value)} onBlur={() => { if (v !== f.name) { const m = V.renameFolder(f.id, v); m ? (toast(m), setV(f.name)) : toast("Folder renamed"); } }} />
    <button className="btn small alt" style={{ marginTop: 6 }} onClick={() => { V.deleteFolder(f.id); toast("Folder deleted"); }}>Delete folder</button></details>;
}

export function LegacyVault() {
  const [pw, setPw] = useState(""), [busy, setBusy] = useState(false);
  const go = async () => { if (!pw) return toast("Enter your old master password"); setBusy(true); toast("Opening your old vault…"); try { const n = await V.migrateOldVault(pw); setPw(""); toast(n + " item" + (n === 1 ? "" : "s") + " brought in"); } catch { toast("Wrong master password"); } setBusy(false); };
  return <div className="panel"><b>🔓 Bring in your old vault</b><p className="note" style={{ marginTop: 4 }}>You have items saved with the old master password. Enter it <b>once</b> to move them into the new vault, which opens without a password.</p>
    <input id="vo_pw" type="password" autoComplete="off" placeholder="Old master password" aria-label="Old master password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void go(); }} />
    <div className="btns"><button className="btn" disabled={busy} onClick={async () => void go()}>Bring items in</button><button className="btn alt" onClick={async () => { if (await ask("Discard the old password-protected vault? Its items will be gone for good.", "Discard")) { V.discardOldVault(); toast("Old vault discarded"); } }}>Discard old vault</button></div></div>;
}
