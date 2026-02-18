/**
 * AES-256-GCM credential encryption for sensitive fields
 * (DaySmart password, IceHockeyPro password) before writing to Supabase.
 *
 * Key material: CREDENTIAL_ENCRYPTION_KEY env var — exactly 64 hex chars
 * (32 bytes = 256-bit key).  Generate with: openssl rand -hex 32
 *
 * If the env var is absent the helpers pass values through unchanged so
 * the app still works in development without any setup.
 *
 * Wire format (dot-separated, base64url-encoded):
 *   enc:<iv_b64url>.<ciphertext+tag_b64url>
 *
 * The GCM authentication tag (16 bytes) is appended automatically by
 * SubtleCrypto and included in the ciphertext buffer.
 *
 * NOTE: Uses only Web Crypto API + TextEncoder/TextDecoder — no Node.js
 * Buffer — so this module is safe in both Node.js and Edge runtimes.
 */

const ENV_KEY = process.env.CREDENTIAL_ENCRYPTION_KEY ?? '';
const SENTINEL = 'enc:';

/** Returns true when a valid 64-hex-char key is configured */
export function isEncryptionConfigured(): boolean {
  return ENV_KEY.length === 64 && /^[0-9a-fA-F]+$/.test(ENV_KEY);
}

/** Import the hex key as a CryptoKey for AES-GCM */
async function importKey(): Promise<CryptoKey> {
  if (!isEncryptionConfigured()) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY is not configured');
  }
  // Parse hex string to Uint8Array without using Buffer
  const raw = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    raw[i] = parseInt(ENV_KEY.slice(i * 2, i * 2 + 2), 16);
  }
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

/** Encode ArrayBuffer to base64url string without using Buffer */
function toBase64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Decode base64url string to Uint8Array without using Buffer */
function fromBase64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  // Pad to multiple of 4
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encrypt a plaintext string.
 * Returns a sentinel-prefixed wire string, or the original value if
 * encryption is not configured or the value is already encrypted.
 */
export async function encryptCredential(plaintext: string): Promise<string> {
  if (!plaintext) return plaintext;
  if (plaintext.startsWith(SENTINEL)) return plaintext; // already encrypted
  if (!isEncryptionConfigured()) return plaintext;       // no key — pass through

  try {
    const key = await importKey();
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
    const encoded = new TextEncoder().encode(plaintext);

    const cipherBuf = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded,
    );

    return `${SENTINEL}${toBase64url(iv)}.${toBase64url(cipherBuf)}`;
  } catch {
    // Encryption failure — return plaintext rather than losing the credential
    return plaintext;
  }
}

/**
 * Decrypt a wire string produced by encryptCredential.
 * Returns the original plaintext, or the input unchanged if it was
 * never encrypted (no sentinel prefix).
 */
export async function decryptCredential(wire: string): Promise<string> {
  if (!wire) return wire;
  if (!wire.startsWith(SENTINEL)) return wire; // plaintext pass-through
  if (!isEncryptionConfigured()) return wire;  // no key — return as-is

  try {
    const payload = wire.slice(SENTINEL.length);
    const dotIdx = payload.indexOf('.');
    if (dotIdx === -1) return '';

    const ivB64 = payload.slice(0, dotIdx);
    const cipherB64 = payload.slice(dotIdx + 1);

    const key = await importKey();
    const iv = fromBase64url(ivB64);
    const cipherBuf = fromBase64url(cipherB64);

    const plainBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      cipherBuf,
    );
    return new TextDecoder().decode(plainBuf);
  } catch {
    // Decryption failure — return empty string rather than leaking wire data
    return '';
  }
}

/**
 * Encrypt sensitive credential fields in a settings object before
 * writing to Supabase.  Non-credential fields are passed through unchanged.
 */
export async function encryptSettingsCredentials(
  settings: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const out = { ...settings };

  // DaySmart password
  if (out.daySmartConfig && typeof out.daySmartConfig === 'object') {
    const dsc = { ...(out.daySmartConfig as Record<string, unknown>) };
    if (typeof dsc.password === 'string' && dsc.password) {
      dsc.password = await encryptCredential(dsc.password);
    }
    out.daySmartConfig = dsc;
  }

  // IceHockeyPro password
  if (out.iceHockeyProConfig && typeof out.iceHockeyProConfig === 'object') {
    const ihp = { ...(out.iceHockeyProConfig as Record<string, unknown>) };
    if (typeof ihp.password === 'string' && ihp.password) {
      ihp.password = await encryptCredential(ihp.password);
    }
    out.iceHockeyProConfig = ihp;
  }

  return out;
}

/**
 * Decrypt credential fields after pulling from Supabase.
 */
export async function decryptSettingsCredentials(
  settings: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const out = { ...settings };

  if (out.daySmartConfig && typeof out.daySmartConfig === 'object') {
    const dsc = { ...(out.daySmartConfig as Record<string, unknown>) };
    if (typeof dsc.password === 'string') {
      dsc.password = await decryptCredential(dsc.password);
    }
    out.daySmartConfig = dsc;
  }

  if (out.iceHockeyProConfig && typeof out.iceHockeyProConfig === 'object') {
    const ihp = { ...(out.iceHockeyProConfig as Record<string, unknown>) };
    if (typeof ihp.password === 'string') {
      ihp.password = await decryptCredential(ihp.password);
    }
    out.iceHockeyProConfig = ihp;
  }

  return out;
}
