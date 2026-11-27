/* Vault domain logic, ported from the classic app (kept byte-compatible with its stored data). Pure functions over AppState. */
import { getState } from "./ctx";
import { DAY, addDays, todayStr, isoOf, p2 } from "./clock";
import { esc, fmtDate, uid } from "./format";
import { commit } from "../storage/store";
import type { VaultItem } from "./types";

export const IDN_KEYS: [string, string][] = [["first","First name"],["last","Last name"],["email","Email"],["phone","Phone"],["company","Company"],["address1","Address line 1"],["address2","Address line 2"],["city","City"],["state","State"],["postal","PIN / postal code"],["country","Country"],["ssn","Aadhaar / national ID"],["passport","Passport number"],["license","Driving licence"]];
export const V_WORDS: string[] = ("able acid aged also area army atom aunt away baby back ball band bank barn base bath bean bear beat beef bell belt bend bike bird blue boat body bold bone book boom boot born boss bowl bulb bull burn bush busy cafe cake calm camp card care cart case cash cast cave cell chat chef chip city clay clip club coal coat code coin cold come cook cool cope copy cord core corn cost crew crop crow cube cult curb cure dark data dawn days dear deck deep deer desk dial dice diet dirt dish dock dome door dove down draw drop drum duck dust duty each earn ease east easy echo edge else epic even ever exam face fact fade fair fall farm fast fate fern file fill film find fine fire firm fish five flag flat flip flow foam fold folk food foot fork form fort four free frog fuel full fund gain game gate gear gift girl give glad glow goal goat gold golf good grab gray grid grow gulf hair half hall hand hard harm hawk heal heap heat help herb hero hide high hill hint hold hole home hood hope horn host hour huge hunt hurt idea inch iron isle item jade jazz join joke jump june jury just keen keep kind king kiss kite knee knot lake lamp land lane lark last late lawn lazy lead leaf lean left lend lens life lift lily lime line link lion list live load loaf lock loft long look loop lord loud love luck lung made mail main make mall many maps mark mask mass math meal meat melt menu mild milk mind mine mint miss mist moon moss most moth move much nail name navy near neck nest news nice nine node noon norm nose note noun oats ocean odd once only open oral orbit oven over pace pack page paid pain pair palm park part past path peak pear peel pine pink pipe plan play plot plum poem pond pool port pose post pour pray pull pump pure push quad quay quiz race rack rain rank rare rate read real reed rent rest rice rich ride ring ripe rise road roar rock roof room root rope rose rule rush safe sage sail salt sand save seal seat seed self sell send shed ship shoe shop show shut sick side sign silk sing sink site size skip slow snow soap soft soil sold sole some song soon sort soul soup spot star stay stem step stir stop such suit sure swan swim tail take tale talk tall tank tape task team tell tent term test text then tide tile till time tiny tips tire told tone tool tops tour town trap tree trip true tube tuna tune turn twin type unit upon urge used vase vast verb very view vine visa void vote wage wait wake walk wall want warm wash wave weak wear week well west what when whom wide wife wild will wind wine wing wire wise wish wolf wood wool word work worm wrap yard yarn year yoga zero zinc zone zoom").split(" ");
export const V_ADJ: string[] = ["swift","calm","brave","bright","clever","gentle","happy","lucky","quiet","sunny","bold","eager","fancy","jolly","kind","merry","noble","proud","witty","zesty"]
export const V_NOUN: string[] = ["tiger","panda","falcon","otter","maple","river","comet","ember","harbor","lotus","meadow","orchid","pebble","quartz","raven","spruce","tulip","willow","zephyr","cedar"];

export const V_TYPES: Record<string, { i: string; l: string; p: string; d: string }> = {login:{i:"🔑", l:"Login", p:"Logins", d:"Website or app account"}, card:{i:"💳", l:"Card", p:"Cards", d:"Credit or debit card"}, bank:{i:"🏦", l:"Bank account", p:"Bank accounts", d:"Account, IFSC, UPI"},
  govid:{i:"🆔", l:"Government ID", p:"IDs", d:"PAN, Aadhaar, Voter ID…"}, passport:{i:"🛂", l:"Passport", p:"Passports", d:"Number and expiry"}, wifi:{i:"📶", l:"Wi-Fi", p:"Wi-Fi", d:"Network and password"},
  license:{i:"🔖", l:"Software licence", p:"Licences", d:"Product keys"}, identity:{i:"🪪", l:"Identity", p:"Identities", d:"Name, address, contacts"}, note:{i:"📝", l:"Secure note", p:"Notes", d:"Private text"}};
export interface SchemaField { k: string; l: string; s?: number; o?: string[]; t?: string }
export const V_SCHEMA: Record<string, SchemaField[]> = {
  wifi:[{k:"ssid", l:"Network name"}, {k:"password", l:"Password", s:1}, {k:"security", l:"Security", o:["WPA2","WPA3","WPA","WEP","Open"]}],
  bank:[{k:"bank", l:"Bank"}, {k:"holder", l:"Account holder"}, {k:"number", l:"Account number", s:1}, {k:"ifsc", l:"IFSC"}, {k:"branch", l:"Branch"}, {k:"upi", l:"UPI ID"}, {k:"custid", l:"Customer ID"}, {k:"acctype", l:"Account type", o:["Savings","Current","Salary","Fixed deposit","Other"]}],
  govid:[{k:"kind", l:"ID type", o:["PAN","Aadhaar","Voter ID","Driving licence","Ration card","Other"]}, {k:"number", l:"ID number", s:1}, {k:"name", l:"Name on ID"}, {k:"dob", l:"Date of birth", t:"date"}, {k:"expiry", l:"Valid till", t:"date"}],
  passport:[{k:"country", l:"Country"}, {k:"number", l:"Passport number", s:1}, {k:"name", l:"Name"}, {k:"issued", l:"Issued on", t:"date"}, {k:"expiry", l:"Expiry date", t:"date"}, {k:"place", l:"Place of issue"}],
  license:[{k:"product", l:"Product"}, {k:"key", l:"Licence key", s:1}, {k:"email", l:"Registered email"}, {k:"bought", l:"Purchased on", t:"date"}, {k:"expiry", l:"Expires on", t:"date"}]
};
export const V_QUICK: Record<string, [string, string, string][]> = {login:[["user", "👤", "username"], ["pw", "🔑", "password"], ["totp", "🔢", "code"]], card:[["card:number", "💳", "card number"]], wifi:[["f:password", "🔑", "Wi-Fi password"]], bank:[["f:number", "🏦", "account number"], ["f:upi", "📲", "UPI ID"]],
  govid:[["f:number", "🔢", "ID number"]], passport:[["f:number", "🔢", "passport number"]], license:[["f:key", "🔑", "licence key"]], identity:[["idn:email", "✉️", "email"]]};
export const CARD_BRANDS = ["Visa","Mastercard","RuPay","American Express","Diners Club","Discover","Other"];
export const V_FILTERS: [string, string][] = [["is:weak", "Weak"], ["is:reused", "Reused"], ["no:2fa", "No 2FA"], ["is:old", "Old"], ["is:expiring", "Expiring"], ["has:file", "Has file"], ["is:fav", "★ Favorites"]];

const S = () => getState();
export const vById = (id: string): any => S().vault.items.find((i: any) => i.id === id) || null;
export const vLive = (): any[] => S().vault.items.filter((i: any) => !i.trashed);
export const vTrash = (): any[] => S().vault.items.filter((i: any) => i.trashed);
export const itemUris = (i: any): string[] => (Array.isArray(i.uris) && i.uris.length ? i.uris : i.url ? [i.url] : []);
export const folderById = (id: string) => S().vault.folders.find((f: any) => f.id === id) || null;
export const folderName = (it: any) => { const f = it.folderId ? folderById(it.folderId) : null; return f ? f.name : ""; };
export function ensureFolder(name: string): string {
  const n = (name || "").trim(); if (!n) return "";
  let f = S().vault.folders.find((x: any) => x.name.toLowerCase() === n.toLowerCase());
  if (!f) { f = { id: uid(), name: n }; S().vault.folders.push(f); }
  return f.id;
}
export function renameFolder(id: string, name: string): string | null {
  const f = S().vault.folders.find((x: any) => x.id === id), v = name.trim(); if (!f) return "Folder not found";
  if (!v) return "Folder name can't be empty";
  if (S().vault.folders.some((x: any) => x !== f && x.name.toLowerCase() === v.toLowerCase())) return "That folder already exists";
  f.name = v; commit(); return null;
}
export function deleteFolder(id: string) { S().vault.items.forEach((i: any) => { if (i.folderId === id) i.folderId = ""; }); S().vault.folders = S().vault.folders.filter((f: any) => f.id !== id); commit(); }
export function addFolder(name: string): string | null { const n = name.trim(); if (!n) return "Type a folder name"; if (S().vault.folders.some((x: any) => x.name.toLowerCase() === n.toLowerCase())) return "That folder already exists"; ensureFolder(n); commit(); return null; }

export function vMigrate(d: any) {
  d.folders = d.folders || []; let ch = false;
  d.items.forEach((i: any) => {
    if (i.category && !i.folderId) { let f = d.folders.find((x: any) => x.name.toLowerCase() === i.category.toLowerCase()); if (!f) { f = { id: uid(), name: i.category }; d.folders.push(f); } i.folderId = f.id; ch = true; }
    if ("category" in i) { delete i.category; ch = true; }
  });
  return ch;
}
/** Trash empties itself after 30 days. */
export function vPurge(): boolean { const n = S().vault.items.length; S().vault.items = S().vault.items.filter((i: any) => !(i.trashed && Date.now() - i.trashed > 30 * DAY)); return n !== S().vault.items.length; }

/* ---- generators (crypto-random, unbiased) ---- */
export function randInt(max: number): number { const lim = Math.floor(4294967296 / max) * max; let x: number; do { x = crypto.getRandomValues(new Uint32Array(1))[0]; } while (x >= lim); return x % max; }
export interface PwOpts { lower?: boolean; upper?: boolean; digits?: boolean; symbols?: boolean; ambig?: boolean }
export function genPassword(len: number, o: PwOpts): string {
  const sets: string[] = [], amb = o.ambig ? /[Il1O0o]/g : null, clean = (s: string) => (amb ? s.replace(amb, "") : s);
  if (o.lower) sets.push(clean("abcdefghijklmnopqrstuvwxyz")); if (o.upper) sets.push(clean("ABCDEFGHIJKLMNOPQRSTUVWXYZ"));
  if (o.digits) sets.push(clean("0123456789")); if (o.symbols) sets.push("!@#$%^&*()-_=+[]{};:,.?");
  if (!sets.length) sets.push(clean("abcdefghijklmnopqrstuvwxyz"));
  const all = sets.join(""), out = sets.map((s) => s[randInt(s.length)]);
  while (out.length < len) out.push(all[randInt(all.length)]);
  for (let i = out.length - 1; i > 0; i--) { const j = randInt(i + 1); [out[i], out[j]] = [out[j], out[i]]; }
  return out.slice(0, len).join("");
}
export function genPassphrase(n: number, sep: string, cap: boolean, num: boolean): string {
  const w: string[] = []; for (let i = 0; i < n; i++) { let x = V_WORDS[randInt(V_WORDS.length)]; if (cap) x = x[0].toUpperCase() + x.slice(1); w.push(x); }
  if (num) w[randInt(w.length)] += String(randInt(10));
  return w.join(sep);
}
export const genUsername = () => V_ADJ[randInt(V_ADJ.length)] + V_NOUN[randInt(V_NOUN.length)][0].toUpperCase() + V_NOUN[randInt(V_NOUN.length)].slice(1) + String(randInt(900) + 100);
export function pwScore(pw: string) {
  if (!pw) return { bits: 0, label: "Empty", c: "var(--bar)", w: 0 };
  let pool = 0; if (/[a-z]/.test(pw)) pool += 26; if (/[A-Z]/.test(pw)) pool += 26; if (/[0-9]/.test(pw)) pool += 10; if (/[^a-zA-Z0-9]/.test(pw)) pool += 33;
  let bits = pw.length * Math.log2(pool || 1);
  if (/^(.)\1+$/.test(pw) || /(password|passw0rd|qwerty|123456|letmein|iloveyou|admin|welcome)/i.test(pw)) bits = Math.min(bits, 24);
  if (new Set(pw).size < pw.length / 3) bits = Math.min(bits, 30);
  const label = bits < 40 ? "Weak" : bits < 60 ? "Fair" : bits < 80 ? "Good" : "Strong";
  return { bits, label, c: bits < 40 ? "var(--red)" : bits < 60 ? "var(--amber)" : "var(--green)", w: Math.min(100, bits) };
}

/* ---- authenticator codes (TOTP, RFC 6238) ---- */
export function b32dec(s: string): Uint8Array | null {
  s = String(s || "").replace(/[\s=-]/g, "").toUpperCase(); const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = 0, val = 0; const out: number[] = [];
  for (const c of s) { const i = A.indexOf(c); if (i < 0) return null; val = (val << 5) | i; bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } }
  return new Uint8Array(out);
}
export function totpParse(raw: string) {
  raw = String(raw || "").trim(); if (!raw) return null;
  if (/^otpauth:/i.test(raw)) { try { const u = new URL(raw); return { secret: u.searchParams.get("secret") || "", period: +(u.searchParams.get("period") || 0) || 30, digits: +(u.searchParams.get("digits") || 0) || 6, algo: (u.searchParams.get("algorithm") || "SHA1").toUpperCase() }; } catch { return null; } }
  return { secret: raw, period: 30, digits: 6, algo: "SHA1" };
}
export async function totpCode(raw: string, now: number = Date.now()): Promise<{ code: string; left: number; period: number } | null> {
  const p = totpParse(raw); if (!p) return null; const key = b32dec(p.secret); if (!key || !key.length) return null;
  const hash = p.algo === "SHA256" ? "SHA-256" : p.algo === "SHA512" ? "SHA-512" : "SHA-1";
  const ctr = Math.floor(now / 1000 / p.period), buf = new ArrayBuffer(8), dv = new DataView(buf); dv.setUint32(0, Math.floor(ctr / 4294967296)); dv.setUint32(4, ctr >>> 0);
  try {
    const k = await crypto.subtle.importKey("raw", key as any, { name: "HMAC", hash }, false, ["sign"]), h = new Uint8Array(await crypto.subtle.sign("HMAC", k, buf)), o = h[h.length - 1] & 15;
    const bin = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
    return { code: String(bin % Math.pow(10, p.digits)).padStart(p.digits, "0"), left: p.period - (Math.floor(now / 1000) % p.period), period: p.period };
  } catch { return null; }
}

/* ---- expiry, audit, search ---- */
export function vExpiry(i: any): string | null {
  if (i.type === "card") { const m = /^(\d{1,2})\s*[\/\-]\s*(\d{2,4})$/.exec(((i.card || {}).exp || "").trim()); if (!m) return null; const y = +m[2] < 100 ? 2000 + +m[2] : +m[2]; return new Date(y, +m[1], 0).getFullYear() + "-" + p2(+m[1]) + "-" + p2(new Date(y, +m[1], 0).getDate()); }
  const e = V_SCHEMA[i.type] && (i.f || {}).expiry; return e && /^\d{4}-\d{2}-\d{2}$/.test(e) ? e : null;
}
export const vExpiring = (i: any, days = 60) => { const e = vExpiry(i); return !!e && e <= addDays(todayStr(), days); };
export function vAudit(items: any[], pwned: Record<string, number> = {}) {
  const logins = items.filter((i) => i.type === "login" && i.password), cnt: Record<string, number> = {}; logins.forEach((i) => { cnt[i.password] = (cnt[i.password] || 0) + 1; });
  const old = Date.now() - 365 * DAY;
  return { reused: logins.filter((i) => cnt[i.password] > 1), weak: logins.filter((i) => pwScore(i.password).bits < 40), old: logins.filter((i) => (i.updated || i.created || Date.now()) < old),
    http: items.filter((i) => i.type === "login" && itemUris(i).some((u) => /^http:\/\//i.test(u))), no2fa: items.filter((i) => i.type === "login" && !i.totp && itemUris(i).length), nopw: items.filter((i) => i.type === "login" && !i.password),
    exposed: items.filter((i) => pwned[i.id] > 0), expiring: items.filter((i) => vExpiring(i, 60)) };
}
export function vSub(i: any): string {
  const f = i.f || {};
  if (i.type === "card") { const n = ((i.card || {}).number || "").replace(/\D/g, ""); return (i.card && i.card.brand ? i.card.brand + " " : "") + (n ? "•••• " + n.slice(-4) : "Card"); }
  if (i.type === "identity") { const d = i.idn || {}; return [d.first, d.last].filter(Boolean).join(" ") || d.email || "Identity"; }
  if (i.type === "note") return "Secure note · hidden until you open it";
  if (i.type === "bank") { const n = (f.number || "").replace(/\s/g, ""); return [f.bank, n ? "•••• " + n.slice(-4) : ""].filter(Boolean).join(" ") || "Bank account"; }
  if (i.type === "wifi") return f.ssid || "Wi-Fi";
  if (i.type === "govid") return f.kind || "Government ID";
  if (i.type === "passport") return [f.country, f.expiry ? "expires " + fmtDate(f.expiry) : ""].filter(Boolean).join(" · ") || "Passport";
  if (i.type === "license") return f.product || "Software licence";
  return i.username || itemUris(i)[0] || "No username";
}
/** Smart search: plain words plus filters like is:weak  no:2fa  type:card  folder:bank  has:file  is:expiring */
export function vSearchParse(q: string) {
  const terms: string[] = [], flt: [string, string][] = []; (String(q || "").match(/"[^"]+"|\S+/g) || []).forEach((tok) => { const m = /^(is|has|no|type|folder|in):(.+)$/i.exec(tok); if (m) flt.push([m[1].toLowerCase(), m[2].replace(/"/g, "").toLowerCase()]); else terms.push(tok.replace(/"/g, "").toLowerCase()); });
  return { terms, flt };
}
export function vMatchItem(i: any, P: ReturnType<typeof vSearchParse>, au: ReturnType<typeof vAudit>): boolean {
  const ids = (k: keyof ReturnType<typeof vAudit>) => au[k].some((x: any) => x.id === i.id);
  for (const [op, v] of P.flt) {
    if (op === "is") { if (v === "weak" ? !ids("weak") : v === "reused" ? !ids("reused") : v === "old" ? !ids("old") : v === "http" ? !ids("http") : v === "fav" || v === "favorite" || v === "favourite" ? !i.fav : v === "expiring" ? !vExpiring(i, 60) : v === "expired" ? !(vExpiry(i) && vExpiry(i)! < todayStr()) : v === "breached" ? !ids("exposed") : false) return false; }
    else if (op === "no") { if (v === "2fa" ? !(i.type === "login" && !i.totp) : v === "password" ? !(i.type === "login" && !i.password) : v === "folder" ? !!folderById(i.folderId) : false) return false; }
    else if (op === "has") { if (v === "2fa" ? !i.totp : v === "file" || v === "files" || v === "attachment" || v === "photo" ? !(i.files || []).length : v === "note" || v === "notes" ? !i.notes : v === "url" || v === "website" ? !itemUris(i).length : false) return false; }
    else if (op === "type") { const T = V_TYPES[i.type] || V_TYPES.login; if (!(i.type.startsWith(v) || T.l.toLowerCase().startsWith(v) || T.p.toLowerCase().startsWith(v))) return false; }
    else if (op === "folder" || op === "in") { if (!folderName(i).toLowerCase().includes(v)) return false; }
  }
  if (!P.terms.length) return true;
  const hay = [i.title, i.username, itemUris(i).join(" "), folderName(i), i.type === "note" ? i.notes : "", (i.fields || []).map((f: any) => f.n).join(" "), vSub(i), (V_TYPES[i.type] || V_TYPES.login).l].join(" ").toLowerCase();
  return P.terms.every((t) => hay.includes(t));
}
export function vGetVal(it: any, k: string): string {
  if (k === "user") return it.username || ""; if (k === "pw") return it.password || ""; if (k === "totp") return it.totp || ""; if (k === "note") return it.notes || "";
  if (k.startsWith("card:")) return (it.card || {})[k.slice(5)] || ""; if (k.startsWith("idn:")) return (it.idn || {})[k.slice(4)] || ""; if (k.startsWith("f:")) return (it.f || {})[k.slice(2)] || "";
  if (k.startsWith("cf:")) return ((it.fields || [])[+k.slice(3)] || {}).v || ""; if (k.startsWith("hist:")) return ((it.history || [])[+k.slice(5)] || {}).pw || "";
  return "";
}
export function vIsSecret(it: any, k: string): boolean {
  return ["pw", "totp", "note", "card:number", "card:cvv"].includes(k) || /^hist:/.test(k) || (/^cf:/.test(k) && ((it.fields || [])[+k.slice(3)] || {}).h) || (/^f:/.test(k) && ((V_SCHEMA[it.type] || []).find((x) => x.k === k.slice(2)) || ({} as any)).s) || (it.type === "identity" && /^idn:(ssn|passport|license)$/.test(k));
}
export function vLabel(it: any, k: string): string {
  const m: Record<string, string> = { pw: "password", user: "username", totp: "code", note: "note", "card:number": "card number", "card:cvv": "CVV" }; if (m[k]) return m[k];
  if (/^f:/.test(k)) { const s = (V_SCHEMA[it.type] || []).find((x) => x.k === k.slice(2)); return s ? s.l.toLowerCase() : "field"; }
  if (/^cf:/.test(k)) return ((it.fields || [])[+k.slice(3)] || {}).n || "field"; if (/^idn:/.test(k)) { const s = IDN_KEYS.find((x) => x[0] === k.slice(4)); return s ? s[1].toLowerCase() : "field"; }
  if (/^hist:/.test(k)) return "old password"; if (/^card:/.test(k)) return k.slice(5); return "value";
}
export function vlog(it: any, a: string) {
  it.log = it.log || []; const last = it.log[it.log.length - 1];
  if (last && last.a === a && Date.now() - last.t < 60000) return; it.log.push({ t: Date.now(), a }); if (it.log.length > 30) it.log.splice(0, it.log.length - 30);
}

/* ---- item create / edit / trash (pure; the UI passes plain values) ---- */
export interface ItemInput { type: string; title: string; folderId?: string; goalId?: string; fav?: boolean; notes?: string; fields?: { n: string; v: string; h: boolean }[]; uris?: string[]; username?: string; password?: string; totp?: string; card?: any; idn?: any; f?: Record<string, string> }
export function validateItem(i: ItemInput): string | null {
  if (!i.title.trim()) return "Give this item a name";
  if (i.type === "login" && i.totp && i.totp.trim()) { const p = totpParse(i.totp), k = p && b32dec(p.secret); if (!k || !k.length) return "That authenticator key doesn't look right"; }
  return null;
}
export function saveItem(input: ItemInput, id?: string): any {
  const err = validateItem(input); if (err) throw new Error(err);
  const type = input.type; let it = id ? vById(id) : null;
  const f: any = { type, title: input.title.trim(), folderId: input.folderId || "", goalId: input.goalId || "", fav: !!input.fav, updated: Date.now() };
  f.notes = type === "note" ? (input.notes || "").replace(/\s+$/, "") : (input.notes || "").trim();
  f.fields = (input.fields || []).map((x) => ({ n: x.n.trim(), v: x.v, h: !!x.h })).filter((x) => x.n || x.v);
  if (type === "login") {
    f.uris = (input.uris || []).map((u) => u.trim()).filter(Boolean); f.url = f.uris[0] || ""; f.username = (input.username || "").trim(); f.password = input.password || ""; f.totp = (input.totp || "").trim();
    if (it && it.password && it.password !== f.password) f.history = [{ pw: it.password, t: Date.now() }, ...(it.history || [])].slice(0, 5);
  } else if (type === "card") { const c = input.card || {}; f.card = { holder: (c.holder || "").trim(), brand: c.brand || "", number: (c.number || "").trim(), exp: (c.exp || "").trim(), cvv: (c.cvv || "").trim() }; }
  else if (type === "identity") { f.idn = {}; IDN_KEYS.forEach(([k]) => { f.idn[k] = ((input.idn || {})[k] || "").trim(); }); }
  else if (V_SCHEMA[type]) { f.f = {}; V_SCHEMA[type].forEach((s) => { f.f[s.k] = ((input.f || {})[s.k] || "").trim(); }); }
  const created = !it;
  if (it) Object.assign(it, f); else { it = { id: uid(), created: Date.now(), history: [], files: [], log: [], ...f }; S().vault.items.push(it); }
  vlog(it, created ? "Created" : "Edited"); commit(); return it;
}
export function trashItem(it: any) { it.trashed = Date.now(); vlog(it, "Moved to trash"); commit(); }
export function restoreItem(it: any) { delete it.trashed; it.updated = Date.now(); vlog(it, "Restored"); commit(); }
export function purgeItem(it: any) { S().vault.items = S().vault.items.filter((x: any) => x !== it); commit(); }
export function emptyTrash(): number { const n = vTrash().length; S().vault.items = S().vault.items.filter((i: any) => !i.trashed); commit(); return n; }
export function eraseVault() { S().vault.items = []; S().vault.folders = []; commit(); }
export function cloneItem(it: any): any { const c = JSON.parse(JSON.stringify(it)); c.id = uid(); c.title = it.title + " (copy)"; c.history = []; c.log = []; c.created = c.updated = Date.now(); delete c.trashed; c.files = []; vlog(c, "Cloned"); S().vault.items.push(c); commit(); return c; }
export function toggleFav(it: any) { it.fav = !it.fav; commit(); }

/* ---- CSV / import / export (Bitwarden-compatible) ---- */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(f); f = ""; if (row.some((x) => x !== "")) rows.push(row); row = []; }
    else f += c;
  }
  row.push(f); if (row.some((x) => x !== "")) rows.push(row); return rows;
}
const tdKey = (s: any) => String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9]/g, "");
export const V_COLS = ["folder","favorite","type","name","notes","fields","reprompt","login_uri","login_username","login_password","login_totp","card_holder","card_brand","card_number","card_exp","card_cvv", ...IDN_KEYS.map((k) => "identity_" + k[0]), "details"];
export function vRowsForExport(): any[][] {
  return vLive().map((i) => { const c = i.card || {}, d = i.idn || {}, det = V_SCHEMA[i.type] ? V_SCHEMA[i.type].map((s) => s.l + ": " + ((i.f || {})[s.k] || "")).join("\n") : "";
    return [folderName(i), i.fav ? 1 : "", i.type, i.title, i.notes || "", (i.fields || []).map((f: any) => f.n + ": " + f.v).join("\n"), 0, itemUris(i).join("\n"), i.username || "", i.password || "", i.totp || "", c.holder || "", c.brand || "", c.number || "", c.exp || "", c.cvv || "", ...IDN_KEYS.map((k) => d[k[0]] || ""), det]; });
}
export function vCsvText(): string { const q = (v: any) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; return [V_COLS, ...vRowsForExport()].map((r) => r.map(q).join(",")).join("\n"); }
export function vImportRows(rows: any[][]): { err?: string; added?: number; skipped?: number } {
  if (!rows || rows.length < 2) return { err: "That file has no rows" };
  const head = rows[0].map(tdKey), col = (names: string[]) => head.findIndex((k) => names.includes(k));
  const c = { t: col(["name","title","account","site"]), u: col(["loginuri","url","website","uri","loginurl","web"]), n: col(["loginusername","username","user","userid","email"]), p: col(["loginpassword","password","pass"]), tp: col(["logintotp","totp","otp","authenticator","twofactor"]),
    no: col(["notes","note","extra","comments"]), f: col(["folder","grouping","category","group"]), fav: col(["favorite","fav","favourite"]), ty: col(["type"]), fl: col(["fields","customfields"]), dt: col(["details"]),
    ch: col(["cardholder"]), cb: col(["cardbrand"]), cn: col(["cardnumber"]), ce: col(["cardexp","cardexpiry"]), cv: col(["cardcvv","cardcode"]) };
  if (c.t < 0 && c.u < 0) return { err: "Couldn't find a Name or URL column" };
  const idn = IDN_KEYS.map(([k]) => [k, col(["identity" + k])] as [string, number]), g = (r: any[], i: number) => (i >= 0 && r[i] != null ? String(r[i]) : "");
  const host = (u: string) => { try { return new URL(/^[a-z]+:\/\//i.test(u) ? u : "https://" + u).hostname.replace(/^www\./, ""); } catch { return u; } };
  const key = (i: any) => [i.type, i.title.toLowerCase(), (i.username || "").toLowerCase(), (itemUris(i)[0] || "").toLowerCase(), (i.card || {}).number || "", (i.f || {}).number || (i.f || {}).key || ""].join("|");
  const have = new Set(S().vault.items.map(key)); let added = 0, skipped = 0;
  const alias: Record<string, string> = { note:"note", securenote:"note", card:"card", creditcard:"card", identity:"identity", bank:"bank", bankaccount:"bank", govid:"govid", governmentid:"govid", passport:"passport", wifi:"wifi", license:"license", licence:"license", softwarelicence:"license", softwarelicense:"license", login:"login" };
  rows.slice(1).forEach((r) => {
    const uris = g(r, c.u).split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    const title = g(r, c.t).trim() || (uris[0] ? host(uris[0]) : ""), tv = g(r, c.ty).trim().toLowerCase().replace(/[^a-z]/g, "");
    const type = alias[tv] || (tv === "" && g(r, c.cn) ? "card" : "login");
    if (!title) { skipped++; return; }
    const it: any = { id: uid(), type, title, folderId: ensureFolder(g(r, c.f)), fav: /^(1|true|yes|y)$/i.test(g(r, c.fav).trim()), notes: g(r, c.no).replace(/\s+$/, ""), goalId: "", fields: [], history: [], files: [], created: Date.now(), updated: Date.now() };
    g(r, c.fl).split(/\r?\n/).forEach((l) => { const m = /^([^:]+):\s?(.*)$/.exec(l); if (m) it.fields.push({ n: m[1].trim(), v: m[2], h: /pass|pin|secret|cvv|key|token/i.test(m[1]) }); });
    if (type === "login") { it.uris = uris; it.url = uris[0] || ""; it.username = g(r, c.n).trim(); it.password = g(r, c.p); it.totp = g(r, c.tp).trim(); }
    if (type === "card") it.card = { holder: g(r, c.ch), brand: g(r, c.cb), number: g(r, c.cn), exp: g(r, c.ce), cvv: g(r, c.cv) };
    if (type === "identity") { it.idn = {}; idn.forEach(([k, i]) => { if (i >= 0) it.idn[k] = g(r, i); }); }
    if (V_SCHEMA[type]) { it.f = {}; g(r, c.dt).split(/\r?\n/).forEach((l) => { const m = /^([^:]+):\s?(.*)$/.exec(l); if (!m) return; const s = V_SCHEMA[type].find((x) => x.l.toLowerCase() === m[1].trim().toLowerCase()); if (s && m[2]) it.f[s.k] = m[2]; }); }
    if (have.has(key(it))) { skipped++; return; } have.add(key(it)); S().vault.items.push(it); added++;
  });
  if (added) commit();
  return { added, skipped };
}

/* ---- online breach check (k-anonymity: only the first 5 characters of a SHA-1 hash leave the device) ---- */
export async function sha1hex(s: string): Promise<string> { const h = new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s))); return Array.from(h, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase(); }
export async function checkExposed(fetcher: typeof fetch = fetch): Promise<{ pwned: Record<string, number>; checked: number; fails: number }> {
  const items = vLive().filter((i) => i.type === "login" && i.password), by: Record<string, any[]> = {}; items.forEach((i) => { (by[i.password] = by[i.password] || []).push(i); });
  const pws = Object.keys(by).slice(0, 150), pwned: Record<string, number> = {}; let fails = 0;
  for (const pw of pws) {
    try {
      const h = await sha1hex(pw), r = await fetcher("https://api.pwnedpasswords.com/range/" + h.slice(0, 5), { headers: { "Add-Padding": "true" } });
      if (!r.ok) throw 0; const t = await r.text(), line = t.split(/\r?\n/).find((l) => l.toUpperCase().startsWith(h.slice(5) + ":")), n = line ? Number(line.split(":")[1]) : 0;
      by[pw].forEach((i) => { pwned[i.id] = n; });
    } catch { fails++; }
  }
  return { pwned, checked: pws.length, fails };
}
export type { VaultItem };
export { esc };


/* ---- old password-protected vault (kept only so people can bring their items into the passwordless vault once) ---- */
const V_AAD = new TextEncoder().encode("goal-tracker-vault-v1");
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export async function vOpen(pw: string, blob: any): Promise<any> {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: unb64(blob.salt), iterations: blob.iter }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(blob.iv), additionalData: V_AAD }, key, unb64(blob.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}
/** Returns the number of items brought in; throws on a wrong password. */
export async function migrateOldVault(pw: string): Promise<number> {
  const st = S(); if (!st.vaultOld) return 0;
  const d: any = (await vOpen(pw, st.vaultOld)) || {}; d.items = Array.isArray(d.items) ? d.items : []; d.folders = Array.isArray(d.folders) ? d.folders : []; vMigrate(d);
  const map: Record<string, string> = {}; d.folders.forEach((f: any) => { map[f.id] = ensureFolder(f.name); }); let n = 0;
  d.items.forEach((i: any) => { const it = { ...i, folderId: map[i.folderId] || "", id: uid(), history: i.history || [], fields: i.fields || [] }; if (it.type !== "note") it.type = "login"; if (it.url && !it.uris) it.uris = [it.url]; st.vault.items.push(it); n++; });
  st.vaultOld = null; commit(); return n;
}
export function discardOldVault() { S().vaultOld = null; commit(); }
