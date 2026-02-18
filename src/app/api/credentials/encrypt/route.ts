import { NextRequest, NextResponse } from 'next/server';
import { encryptCredential, isEncryptionConfigured } from '@/lib/crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const value = typeof body?.value === 'string' ? body.value : '';

    if (!value) {
      return NextResponse.json({ error: 'value is required' }, { status: 400 });
    }

    const encrypted = await encryptCredential(value);

    return NextResponse.json({
      encrypted,
      wasEncrypted: isEncryptionConfigured() && encrypted !== value,
    });
  } catch (error) {
    console.error('[encrypt] Error:', error);
    return NextResponse.json({ error: 'Encryption failed', encrypted: '' }, { status: 500 });
  }
}
