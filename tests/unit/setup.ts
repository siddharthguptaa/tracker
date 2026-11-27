// Vitest setup: nothing global needed beyond jsdom's localStorage; each test file seeds what it needs via helpers.
// jsdom has no Web Crypto subtle API, and vault.ts uses crypto.subtle, so fall back to Node's implementation when it is missing.
import { webcrypto } from "node:crypto";
try {
  if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
} catch { /* keep whatever the environment provides */ }
