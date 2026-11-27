import { getState } from "../domain/ctx";
import { commit } from "../storage/store";
import { vlog, vIsSecret, vLabel } from "../domain/vault";
import { toast } from "./uiStore";
import { vGetVal } from "../domain/vault";

/** Copy a field to the clipboard; secrets are wiped from the clipboard after the user's chosen delay (default 30 s). */
export function copyValue(it: any, k: string, val: string) {
  if (!val) return toast("Nothing to copy");
  const secret = vIsSecret(it, k), s = getState().settings, clr = s.vaultClip == null ? 30 : s.vaultClip;
  navigator.clipboard.writeText(String(val)).then(() => {
    toast(secret && clr ? `Copied — clears in ${clr} seconds` : "Copied"); vlog(it, "Copied " + vLabel(it, k)); commit();
    if (secret && clr) setTimeout(() => { try { navigator.clipboard.writeText(""); } catch { /* ignore */ } }, clr * 1000);
  }, () => toast("Couldn't copy — your browser blocked the clipboard"));
}
export async function copySecret(it: any, k: string) {
  if (k === "totp") { const { totpCode } = await import("../domain/vault"); const r = await totpCode(it.totp); return r ? copyValue(it, k, r.code) : toast("Invalid authenticator key"); }
  copyValue(it, k, vGetVal(it, k));
}
