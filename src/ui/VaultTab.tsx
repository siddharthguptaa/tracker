import { useState } from "react";
import { ask } from "./ask";
import { useAppState } from "../storage/store";
import { getState } from "../domain/ctx";
import { addDays, todayStr } from "../domain/clock";
import { Header } from "./Header";
import { openSheet, toast } from "./uiStore";
import { V_TYPES, V_QUICK, V_FILTERS, vLive, vTrash, vAudit, vSearchParse, vMatchItem, vSub, vExpiry, folderById, folderName, itemUris, pwScore, vGetVal, restoreItem, purgeItem, emptyTrash } from "../domain/vault";
import { copySecret } from "./vaultUi";
import { LegacyVault } from "./VaultSheets";

const fs = { q: "", type: "all", fold: "all", sort: "name" };   // remembered while the app is open

function VCard({ i }: { i: any }) {
  const t = V_TYPES[i.type] || V_TYPES.login, sc = i.type === "login" && i.password ? pwScore(i.password) : null, g = i.goalId ? getState().goals.find((x) => x.id === i.goalId) : null, ex = vExpiry(i);
  const expiring = !i.trashed && ex && ex <= addDays(todayStr(), 60);
  const quick = i.trashed ? [] : (V_QUICK[i.type] || []).filter(([k]) => (k === "totp" ? !!i.totp : !!vGetVal(i, k)));
  return (
    <div className="card vcard" role="button" tabIndex={0} onClick={() => openSheet("vdetail", i.id)} onKeyDown={(e) => { if (e.key === "Enter") openSheet("vdetail", i.id); }}>
      <div className="vic">{t.i}</div>
      <div className="vmain">
        <div className="row" style={{ gap: 6 }}><b className="vt">{i.fav ? <span className="st">★ </span> : null}{i.title}</b>
          <span className="vbadges">{!i.trashed && sc && sc.bits < 40 ? <span className="pill" style={{ background: "var(--red-soft)", color: "var(--red)" }}>Weak</span> : null}{expiring ? <span className="pill" style={{ background: "var(--amber-soft)", color: "var(--amber)" }}>{ex! < todayStr() ? "Expired" : "Expires soon"}</span> : null}{!i.trashed && i.totp ? <span className="pill st-notstarted">2FA</span> : null}</span></div>
        <div className="note" style={{ margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{vSub(i)}{(i.files || []).length ? " · 📎" + i.files.length : ""}{g ? " · 🎯 " + g.name : ""}{folderName(i) ? " · 📁 " + folderName(i) : ""}</div>
        {i.trashed ? <div className="btns" style={{ marginTop: 8 }} onClick={(e) => e.stopPropagation()}><button className="btn small alt" onClick={async () => { restoreItem(i); toast("Restored"); }}>Restore</button><button className="btn small danger" onClick={async () => { if (await ask(`Delete “${i.title}” forever?`)) { purgeItem(i); toast("Deleted"); } }}>Delete forever</button></div> : null}
      </div>
      {quick.length ? <div className="vq" onClick={(e) => e.stopPropagation()}>{quick.map(([k, ic, l]) => <button key={k} className="qc" aria-label={"Copy " + l} title={"Copy " + l} onClick={() => copySecret(i, k)}>{ic}</button>)}</div> : null}
    </div>
  );
}

export function VaultTab() {
  const state = useAppState(); const [, force] = useState(0); const set = (p: Partial<typeof fs>) => { Object.assign(fs, p); force((n) => n + 1); };
  const live = vLive(), trash = vTrash(), q = fs.q.trim(), folders = state.vault.folders.slice().sort((a: any, b: any) => a.name.localeCompare(b.name)), au = vAudit(live);
  const nNone = live.filter((i) => !folderById(i.folderId)).length, nFav = live.filter((i) => i.fav).length, tcnt = (t: string) => live.filter((i) => i.type === t).length;
  const tchips: [string, string, number][] = [["all", "All", live.length], ...Object.keys(V_TYPES).filter((t) => tcnt(t)).map((t) => [t, V_TYPES[t].p, tcnt(t)] as [string, string, number])];
  const fchips: [string, string, number][] = [];
  if (nFav) fchips.push(["fav", "★ Favorites", nFav]);
  folders.forEach((f: any) => fchips.push([f.id, "📁 " + f.name, live.filter((i) => i.folderId === f.id).length]));
  if (folders.length && nNone) fchips.push(["none", "No folder", nNone]);
  if (trash.length) fchips.push(["trash", "🗑 Trash", trash.length]);
  const fold = fs.fold !== "all" && !fchips.some((c) => c[0] === fs.fold) ? "all" : fs.fold, type = tchips.some((c) => c[0] === fs.type) ? fs.type : "all";
  const inTrash = fold === "trash", pool = inTrash ? trash : live, P = vSearchParse(q), auP = inTrash ? vAudit([]) : au;
  const inFold = (i: any) => inTrash || fold === "all" || (fold === "fav" ? i.fav : fold === "none" ? !folderById(i.folderId) : i.folderId === fold);
  const list = pool.filter((i) => (type === "all" || i.type === type) && inFold(i) && vMatchItem(i, P, auP))
    .sort((a, b) => (inTrash ? 0 : (b.fav ? 1 : 0) - (a.fav ? 1 : 0)) || (fs.sort === "new" ? (b.created || 0) - (a.created || 0) : fs.sort === "old" ? (a.created || 0) - (b.created || 0) : fs.sort === "upd" ? (b.updated || 0) - (a.updated || 0) : a.title.localeCompare(b.title)));
  const issues = au.reused.length + au.weak.length + au.expiring.length;
  return (
    <>
      <Header />
      <h1>Vault</h1><p className="sub">Logins, cards, IDs and notes · kept on this device</p>
      {state.vaultOld ? <LegacyVault /> : null}
      <div className="vtools"><button className="chip" onClick={() => openSheet("vgen")}>🎲 Generator</button><button className="chip" onClick={() => openSheet("vhealth")}>🛡 Health{issues ? <> · <span className="red">{issues}</span></> : null}</button><button className="chip" onClick={() => openSheet("vemerg")}>🆘 Emergency</button><button className="chip" onClick={() => openSheet("vsettings")}>⚙ Folders &amp; data</button></div>
      <div className="searchrow"><input id="vq" type="search" placeholder="Search · try is:weak or no:2fa" value={fs.q} onChange={(e) => set({ q: e.target.value })} aria-label="Search your vault" autoComplete="off" /></div>
      <div className="chips">{V_FILTERS.map(([tok, l]) => <button key={tok} className={"chip" + (q.split(/\s+/).includes(tok) ? " on" : "")} onClick={() => { const w = q.split(/\s+/).filter(Boolean); set({ q: (w.includes(tok) ? w.filter((x) => x !== tok) : [...w, tok]).join(" ") }); }}>{l}</button>)}</div>
      <div className="chips">{tchips.map(([v, l, n]) => <button key={v} className={"chip" + (type === v ? " on" : "")} onClick={() => set({ type: v })}>{l} · {n}</button>)}</div>
      {fchips.length ? <div className="chips">{fchips.map(([v, l, n]) => <button key={v} className={"chip" + (fold === v ? " on" : "")} onClick={() => set({ fold: v })}>{l} · {n}</button>)}{fold !== "all" ? <button className="chip" onClick={() => set({ fold: "all" })}>Show all</button> : null}</div> : null}
      <div className="row" style={{ margin: "6px 2px" }}><span className="note" style={{ margin: 0 }}>{list.length} item{list.length === 1 ? "" : "s"}{inTrash ? " · emptied after 30 days" : ""}</span>
        <select aria-label="Sort" value={fs.sort} onChange={(e) => set({ sort: e.target.value })} style={{ width: "auto", padding: "6px 10px" }}>{[["name", "Name A–Z"], ["new", "Newest first"], ["old", "Oldest first"], ["upd", "Recently updated"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
      {inTrash && trash.length ? <button className="btn alt small" style={{ margin: "0 0 8px" }} onClick={async () => { if (await ask(`Permanently delete ${trash.length} item(s)?`)) { emptyTrash(); toast("Trash emptied"); } }}>Empty trash now</button> : null}
      {list.length ? <div className="grid">{list.map((i) => <VCard key={i.id} i={i} />)}</div> : <div className="empty">{live.length || trash.length ? "Nothing matches." : <>Nothing saved yet.<br />Tap the + button to add your first login, card, ID or note.</>}</div>}
    </>
  );
}
void itemUris;
