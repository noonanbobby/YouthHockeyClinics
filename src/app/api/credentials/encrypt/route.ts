import { NextRequest, NextResponse } from 'next/server';
import { encryptCredential, isEncryptionConfigured } from '@/lib/crypto';

/**
 * POST /api/credentials/encrypt
 *
 * Server-side credential encryption endpoint.
 * Called by the integrations page before persisting sensitive values.
 *
 * Body: { value: string }
 * Response: { encrypted: string }
 *
 * If CREDENTIAL_ENCRYPTION_KEY is not configured the value is returned
 * unchanged — credentials are still protected in transit by TLS.
 *
 * This endpoint intentionally has NO authentication requirement because:
 * - It only encrypts values the caller already possesses
 * - The encryption key never leaves the server
 * - An attacker who can call this endpoint gains nothing — they already
 *   have the plaintext and the encrypted output is useless without the key
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const value = typeof body?.value === 'string' ? body.value : '';

    if (!value) {
      return NextResponse.json(
        { error: 'value is required' },
        { status: 400 },
      );
    }

    const encrypted = await encryptCredential(value);

    return NextResponse.json({
      encrypted,
      wasEncrypted: isEncryptionConfigured() && encrypted !== value,
    });
  } catch (error) {
    console.error('[encrypt] Error:', error);
    // Return the original value on error so the caller can still proceed
    return NextResponse.json(
      { error: 'Encryption failed', encrypted: '' },
      { status: 500 },
    );
  }
}
