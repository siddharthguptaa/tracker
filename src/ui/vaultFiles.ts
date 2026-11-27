import type { FileStore } from "../domain/backup";
/** Vault attachments live in IndexedDB ("tracker-files" / "files") — the same store the classic app uses. */
const DB = "tracker-files", ST = "files";
const open = () => new Promise<IDBDatabase>((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(ST)) r.result.createObjectStore(ST); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const b2b64 = (b: Blob) => new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] || ""); r.onerror = () => res(""); r.readAsDataURL(b); });

export async function fput(id: string, blob: Blob): Promise<void> { const db = await open(); await new Promise<void>((res, rej) => { const tx = db.transaction(ST, "readwrite"); tx.objectStore(ST).put(blob, id); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }
export async function fget(id: string): Promise<Blob | null> { try { const db = await open(); return await new Promise<Blob | null>((res) => { const q = db.transaction(ST).objectStore(ST).get(id); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); } catch { return null; } }
export async function fdel(id: string): Promise<void> { try { const db = await open(); await new Promise<void>((res) => { const tx = db.transaction(ST, "readwrite"); tx.objectStore(ST).delete(id); tx.oncomplete = tx.onerror = () => res(); }); } catch { /* ignore */ } }
/** Downscale big photos (max 1600px, JPEG 82%) so attachments don't fill device storage. */
export async function shrinkImage(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file), sc = Math.min(1, 1600 / Math.max(bmp.width, bmp.height)), c = document.createElement("canvas"); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height); return await new Promise<Blob>((res) => c.toBlob((b) => res(b || file), "image/jpeg", 0.82));
  } catch { return file; }
}

export const idbFiles: FileStore = {
  async get(id) { const b = await fget(id); return b ? { type: b.type, b64: await b2b64(b) } : null; },
  async put(id, type, b64) { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); await fput(id, new Blob([u], { type })); },
  dropAll() { /* attachments are replaced by id on restore; stale ones are harmless */ },
};
