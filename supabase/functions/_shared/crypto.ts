/**
 * Token-Verschlüsselung (AES-256-GCM) und signierter OAuth-State (HMAC-SHA256).
 * Nutzt ausschließlich Web-Crypto (Deno + Node ≥ 20). Schlüssel kommen aus Server-Secrets, nie aus dem Client.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

export const b64 = (buf: ArrayBuffer | Uint8Array): string => {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of u) s += String.fromCharCode(b);
  return btoa(s);
};
export function unb64(s: string) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const b64url = (buf: ArrayBuffer | Uint8Array) => b64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s: string) => unb64(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));

async function aesKey(keyB64: string): Promise<CryptoKey> {
  const raw = unb64(keyB64);
  if (raw.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY muss 32 Byte (base64) lang sein.');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/** Format: v1.<iv>.<ciphertext> (base64). Zufälliger 96-Bit-IV je Verschlüsselung. */
export async function encryptSecret(plain: string, keyB64: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(keyB64), enc.encode(plain));
  return `v1.${b64(iv)}.${b64(ct)}`;
}

export async function decryptSecret(token: string, keyB64: string): Promise<string> {
  const [v, iv, ct] = token.split('.');
  if (v !== 'v1' || !iv || !ct) throw new Error('Unbekanntes Token-Format.');
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await aesKey(keyB64), unb64(ct));
  return dec.decode(pt);
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export interface OAuthStatePayload {
  uid: string;
  nonce: string;
  /** Ablaufzeit (Unix-Sekunden) */
  exp: number;
}

export async function signState(payload: OAuthStatePayload, secret: string): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body));
  return `${body}.${b64url(sig)}`;
}

export async function verifyState(state: string, secret: string, nowSec = Math.floor(Date.now() / 1000)): Promise<OAuthStatePayload | null> {
  const [body, sig] = state.split('.');
  if (!body || !sig) return null;
  let ok = false;
  try {
    ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), unb64url(sig), enc.encode(body));
  } catch {
    return null;
  }
  if (!ok) return null;
  try {
    const p = JSON.parse(dec.decode(unb64url(body))) as OAuthStatePayload;
    if (typeof p.uid !== 'string' || typeof p.exp !== 'number' || p.exp < nowSec) return null;
    return p;
  } catch {
    return null;
  }
}

/** Zeitkonstanter String-Vergleich (für Webhook-Authorization-Header). */
export function timingSafeEqual(a: string, b: string): boolean {
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}
