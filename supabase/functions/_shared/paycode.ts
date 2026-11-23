// The buyer's own payment code (like a password). Only a salted PBKDF2 hash is stored, never the code itself.
const enc = new TextEncoder();
const hex = (b: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(b as ArrayBuffer), (x) => x.toString(16).padStart(2, "0")).join("");
const unhex = (s: string) => new Uint8Array((s.match(/../g) || []).map((h) => parseInt(h, 16)));

async function derive(code: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(code), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 150000 }, key, 256));
}

export async function hashCode(code: string): Promise<{ salt: string; hash: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: hex(salt), hash: await derive(code, salt) };
}

export async function checkCode(code: string, salt: string, hash: string): Promise<boolean> {
  const got = await derive(code, unhex(salt));
  if (got.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ hash.charCodeAt(i);   // constant time
  return diff === 0;
}

export const CODE_MIN = 4, CODE_MAX = 32;
export const MAX_TRIES = 5, LOCK_MINUTES = 15;
