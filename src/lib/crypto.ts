/**
 * AES-256-GCM credential encryption for sensitive fields
 * (DaySmart password, IceHockeyPro password, EmailScan credentials)
 * before writing to Supabase.
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
 *
 * SECURITY NOTES:
 * - ENV_KEY is read lazily (inside functions) so it picks up the correct
 *   runtime value even in environments where env vars are injected after
 *   module load (e.g. some edge runtimes).
 * - decryptCredential returns an empty string (not the raw wire string)
 *   when encryption is configured but decryption fails, preventing
 *   encrypted blobs from leaking to the client.
 * - encryptSettingsCredentials / decryptSettingsCredentials cover all
 *   known credential-bearing config objects: daySmartConfig,
 *   iceHockeyProConfig, and emailScanConfig.
 */

const SENTINEL = 'enc:';

// ── Key helpers ────────────────────────────────────────────────────────

/** Read the encryption key from the environment at call time (lazy). */
function getEnvKey(): string {
  return process.env.CREDENTIAL_ENCRYPTION_KEY ?? '';
}

/** Returns true when a valid 64-hex-char key is configured */
export function isEncryptionConfigured(): boolean {
  const key = getEnvKey();
  return key.length === 64 && /^[0-9a-fA-F]+$/.test(key);
}

/** Import the hex key as a CryptoKey for AES-GCM */
async function importKey(): Promise<CryptoKey> {
  if (!isEncryptionConfigured()) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY is not configured');
  }
  const envKey = getEnvKey();
  const raw = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    raw[i] = parseInt(envKey.slice(i * 2, i * 2 + 2), 16);
  }
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

// ── Base64url helpers ──────────────────────────────────────────────────

/** Encode ArrayBuffer to base64url string — no Node.js Buffer */
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

/** Decode base64url string to Uint8Array — no Node.js Buffer */
function fromBase64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ── Core encrypt / decrypt ─────────────────────────────────────────────

/**
 * Encrypt a plaintext string.
 * Returns a sentinel-prefixed wire string, or the original value if
 * encryption is not configured or the value is already encrypted.
 */
export async function encryptCredential(plaintext: string): Promise<string> {
  if (!plaintext) return plaintext;
  if (plaintext.startsWith(SENTINEL)) return plaintext; // Already encrypted
  if (!isEncryptionConfigured()) return plaintext;       // Pass-through in dev

  try {
    const key = await importKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
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
 *
 * Returns an empty string (NOT the raw wire string) when:
 *   - The wire string is malformed
 *   - Decryption fails (wrong key, tampered ciphertext)
 *   - Encryption is configured but the key doesn't match
 *
 * This prevents encrypted blobs from leaking to the client.
 */
export async function decryptCredential(wire: string): Promise<string> {
  if (!wire) return wire;

  // Not encrypted — return as-is
  if (!wire.startsWith(SENTINEL)) return wire;

  // Encrypted but no key configured — return empty string (safe failure)
  if (!isEncryptionConfigured()) {
    console.warn('[crypto] Encrypted credential found but CREDENTIAL_ENCRYPTION_KEY is not set');
    return '';
  }

  try {
    const payload = wire.slice(SENTINEL.length);
    const dotIdx = payload.indexOf('.');
    if (dotIdx === -1) return '';

    const key = await importKey();
    const iv = fromBase64url(payload.slice(0, dotIdx));
    const cipherBuf = fromBase64url(payload.slice(dotIdx + 1));

    const plainBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      cipherBuf,
    );
    return new TextDecoder().decode(plainBuf);
  } catch {
    // Decryption failure — return empty string, never the raw wire string
    return '';
  }
}

// ── Settings-level helpers ─────────────────────────────────────────────

/**
 * Encrypt sensitive credential fields in a settings object before
 * writing to Supabase.
 *
 * Covers: daySmartConfig.password, iceHockeyProConfig.password,
 *         emailScanConfig (no password field currently, but future-proofed).
 */
export async function encryptSettingsCredentials(
  settings: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const out = { ...settings };

  // ── DaySmart ────────────────────────────────────────────────────────
  if (out.daySmartConfig && typeof out.daySmartConfig === 'object') {
    const dsc = { ...(out.daySmartConfig as Record<string, unknown>) };
    if (typeof dsc.password === 'string' && dsc.password) {
      dsc.password = await encryptCredential(dsc.password);
    }
    out.daySmartConfig = dsc;
  }

  // ── IceHockeyPro ────────────────────────────────────────────────────
  if (out.iceHockeyProConfig && typeof out.iceHockeyProConfig === 'object') {
    const ihp = { ...(out.iceHockeyProConfig as Record<string, unknown>) };
    if (typeof ihp.password === 'string' && ihp.password) {
      ihp.password = await encryptCredential(ihp.password);
    }
    // Never persist the session cookie — it's ephemeral and per-device
    delete ihp.sessionCookie;
    out.iceHockeyProConfig = ihp;
  }

  // ── EmailScan (future-proofed — no password field today) ────────────
  // If a password or token field is added to EmailScanConfig, encrypt it here.
  if (out.emailScanConfig && typeof out.emailScanConfig === 'object') {
    const esc = { ...(out.emailScanConfig as Record<string, unknown>) };
    if (typeof esc.password === 'string' && esc.password) {
      esc.password = await encryptCredential(esc.password);
    }
    if (typeof esc.accessToken === 'string' && esc.accessToken) {
      esc.accessToken = await encryptCredential(esc.accessToken);
    }
    if (typeof esc.refreshToken === 'string' && esc.refreshToken) {
      esc.refreshToken = await encryptCredential(esc.refreshToken);
    }
    out.emailScanConfig = esc;
  }

  return out;
}

/**
 * Decrypt credential fields after pulling from Supabase.
 *
 * Mirrors encryptSettingsCredentials exactly — any field encrypted on
 * write must be decrypted on read.
 */
export async function decryptSettingsCredentials(
  settings: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const out = { ...settings };

  // ── DaySmart ────────────────────────────────────────────────────────
  if (out.daySmartConfig && typeof out.daySmartConfig === 'object') {
    const dsc = { ...(out.daySmartConfig as Record<string, unknown>) };
    if (typeof dsc.password === 'string') {
      dsc.password = await decryptCredential(dsc.password);
    }
    out.daySmartConfig = dsc;
  }

  // ── IceHockeyPro ────────────────────────────────────────────────────
  if (out.iceHockeyProConfig && typeof out.iceHockeyProConfig === 'object') {
    const ihp = { ...(out.iceHockeyProConfig as Record<string, unknown>) };
    if (typeof ihp.password === 'string') {
      ihp.password = await decryptCredential(ihp.password);
    }
    // sessionCookie is never stored — ensure it's absent after decrypt too
    delete ihp.sessionCookie;
    out.iceHockeyProConfig = ihp;
  }

  // ── EmailScan ───────────────────────────────────────────────────────
  if (out.emailScanConfig && typeof out.emailScanConfig === 'object') {
    const esc = { ...(out.emailScanConfig as Record<string, unknown>) };
    if (typeof esc.password === 'string') {
      esc.password = await decryptCredential(esc.password);
    }
    if (typeof esc.accessToken === 'string') {
      esc.accessToken = await decryptCredential(esc.accessToken);
    }
    if (typeof esc.refreshToken === 'string') {
      esc.refreshToken = await decryptCredential(esc.refreshToken);
    }
    out.emailScanConfig = esc;
  }

  return out;
}
