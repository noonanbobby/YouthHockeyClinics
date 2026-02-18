const SENTINEL = 'enc:';

function getEnvKey(): string {
  return process.env.CREDENTIAL_ENCRYPTION_KEY ?? '';
}

export function isEncryptionConfigured(): boolean {
  const key = getEnvKey();
  return key.length === 64 && /^[0-9a-fA-F]+$/.test(key);
}

async function importKey(): Promise<CryptoKey> {
  if (!isEncryptionConfigured()) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY is not configured or invalid');
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

function toBase64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function encryptCredential(plaintext: string): Promise<string> {
  if (!plaintext) return plaintext;
  if (plaintext.startsWith(SENTINEL)) return plaintext; // already encrypted
  if (!isEncryptionConfigured()) {
    console.warn('[crypto] encryptCredential: CREDENTIAL_ENCRYPTION_KEY not configured — storing plaintext');
    return plaintext;
  }
  try {
    const key = await importKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    return `${SENTINEL}${toBase64url(iv)}.${toBase64url(cipherBuf)}`;
  } catch (err) {
    console.error('[crypto] encryptCredential failed:', err);
    return plaintext;
  }
}

export async function decryptCredential(wire: string): Promise<string> {
  if (!wire) return wire;
  if (!wire.startsWith(SENTINEL)) return wire; // not encrypted — pass through
  if (!isEncryptionConfigured()) {
    console.warn(
      '[crypto] decryptCredential: encrypted value found but CREDENTIAL_ENCRYPTION_KEY is not set — returning empty string',
    );
    return '';
  }
  try {
    const payload = wire.slice(SENTINEL.length);
    const dotIdx = payload.indexOf('.');
    if (dotIdx === -1) {
      console.error('[crypto] decryptCredential: malformed payload (no dot separator)');
      return '';
    }
    const key = await importKey();
    const iv = fromBase64url(payload.slice(0, dotIdx));
    const cipherBuf = fromBase64url(payload.slice(dotIdx + 1));
    const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBuf);
    return new TextDecoder().decode(plainBuf);
  } catch (err) {
    console.error('[crypto] decryptCredential failed (wrong key or corrupt data):', err);
    return '';
  }
}

export async function encryptSettingsCredentials(
  settings: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const out = { ...settings };

  if (out.daySmartConfig && typeof out.daySmartConfig === 'object') {
    const dsc = { ...(out.daySmartConfig as Record<string, unknown>) };
    if (typeof dsc.password === 'string' && dsc.password)
      dsc.password = await encryptCredential(dsc.password);
    // Never persist the raw session cookie
    delete dsc.sessionCookie;
    out.daySmartConfig = dsc;
  }

  if (out.iceHockeyProConfig && typeof out.iceHockeyProConfig === 'object') {
    const ihp = { ...(out.iceHockeyProConfig as Record<string, unknown>) };
    if (typeof ihp.password === 'string' && ihp.password)
      ihp.password = await encryptCredential(ihp.password);
    delete ihp.sessionCookie;
    out.iceHockeyProConfig = ihp;
  }

  if (out.emailScanConfig && typeof out.emailScanConfig === 'object') {
    const esc = { ...(out.emailScanConfig as Record<string, unknown>) };
    if (typeof esc.password === 'string' && esc.password)
      esc.password = await encryptCredential(esc.password);
    if (typeof esc.accessToken === 'string' && esc.accessToken)
      esc.accessToken = await encryptCredential(esc.accessToken);
    if (typeof esc.refreshToken === 'string' && esc.refreshToken)
      esc.refreshToken = await encryptCredential(esc.refreshToken);
    out.emailScanConfig = esc;
  }

  return out;
}

export async function decryptSettingsCredentials(
  settings: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const out = { ...settings };

  if (out.daySmartConfig && typeof out.daySmartConfig === 'object') {
    const dsc = { ...(out.daySmartConfig as Record<string, unknown>) };
    if (typeof dsc.password === 'string') dsc.password = await decryptCredential(dsc.password);
    out.daySmartConfig = dsc;
  }

  if (out.iceHockeyProConfig && typeof out.iceHockeyProConfig === 'object') {
    const ihp = { ...(out.iceHockeyProConfig as Record<string, unknown>) };
    if (typeof ihp.password === 'string') ihp.password = await decryptCredential(ihp.password);
    delete ihp.sessionCookie;
    out.iceHockeyProConfig = ihp;
  }

  if (out.emailScanConfig && typeof out.emailScanConfig === 'object') {
    const esc = { ...(out.emailScanConfig as Record<string, unknown>) };
    if (typeof esc.password === 'string') esc.password = await decryptCredential(esc.password);
    if (typeof esc.accessToken === 'string')
      esc.accessToken = await decryptCredential(esc.accessToken);
    if (typeof esc.refreshToken === 'string')
      esc.refreshToken = await decryptCredential(esc.refreshToken);
    out.emailScanConfig = esc;
  }

  return out;
}
