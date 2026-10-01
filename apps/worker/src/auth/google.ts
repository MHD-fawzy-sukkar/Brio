/**
 * Google ID Token Verification Service for Cloudflare Worker
 * Validates cryptographic signature, issuer, audience, expiry, and nonce.
 */

export interface GoogleTokenPayload {
  sub: string;
  email: string;
  name: string;
  iss: string;
  aud: string;
  exp: number;
  nonce?: string;
}

// In-memory JWKS Cache for Workers
interface CachedKeys {
  keys: Array<{ kid: string; n: string; e: string; kty: string; alg: string }>;
  expiresAt: number;
}

let jwksCache: CachedKeys | null = null;

async function fetchGoogleJwks(): Promise<CachedKeys['keys']> {
  const now = Date.now();
  if (jwksCache && jwksCache.expiresAt > now) {
    return jwksCache.keys;
  }

  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/certs');
    if (!res.ok) {
      throw new Error(`Failed to fetch Google JWKS: ${res.status}`);
    }

    const data = await res.json() as any;
    const cacheControl = res.headers.get('Cache-Control');
    let maxAge = 3600; // Default 1 hour
    if (cacheControl) {
      const match = cacheControl.match(/max-age=(\d+)/);
      if (match) {
        maxAge = parseInt(match[1], 10);
      }
    }

    jwksCache = {
      keys: data.keys,
      expiresAt: now + maxAge * 1000
    };

    return data.keys;
  } catch (err) {
    if (jwksCache) {
      return jwksCache.keys; // Fallback to stale cache if fetch fails
    }
    throw err;
  }
}

function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function verifyGoogleIdToken(
  idToken: string,
  expectedClientId: string,
  options?: { allowDevBypass?: boolean; expectedNonce?: string }
): Promise<GoogleTokenPayload> {
  // 1. Development Auth Bypass Guard (Local testing only)
  if (options?.allowDevBypass && idToken.startsWith('mock:')) {
    const parts = idToken.split(':');
    return {
      sub: parts[1] || 'google-mock-id-12345',
      email: parts[2] || 'creator@brio.com',
      name: parts[3] || 'Brio Mock Creator',
      iss: 'https://accounts.google.com',
      aud: expectedClientId,
      exp: Math.floor(Date.now() / 1000) + 3600,
      nonce: options?.expectedNonce
    };
  }

  // 2. Token Format Check
  const tokenParts = idToken.split('.');
  if (tokenParts.length !== 3) {
    throw new Error('Invalid JWT token format');
  }

  const [headerB64, payloadB64, signatureB64] = tokenParts;

  // 3. Decode Header and Payload
  let header: any;
  let payload: GoogleTokenPayload;
  try {
    header = JSON.parse(new TextDecoder().decode(base64UrlDecode(headerB64)));
    payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)));
  } catch {
    throw new Error('Failed to parse JWT header or payload');
  }

  // 4. Validate Issuer
  const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
  if (!validIssuers.includes(payload.iss)) {
    throw new Error(`Invalid token issuer: ${payload.iss}`);
  }

  // 5. Validate Audience
  if (expectedClientId && payload.aud !== expectedClientId) {
    throw new Error(`Invalid token audience: expected ${expectedClientId}, got ${payload.aud}`);
  }

  // 6. Validate Expiration
  const nowInSeconds = Math.floor(Date.now() / 1000);
  if (payload.exp <= nowInSeconds) {
    throw new Error('Token has expired');
  }

  // 7. Validate Nonce if provided
  if (options?.expectedNonce && payload.nonce !== options.expectedNonce) {
    throw new Error('Invalid token nonce');
  }

  // 8. Cryptographic Signature Verification via Web Crypto API & JWKS
  const jwks = await fetchGoogleJwks();
  const matchingKey = jwks.find((k) => k.kid === header.kid);
  if (!matchingKey) {
    throw new Error(`Google JWKS public key with kid '${header.kid}' not found`);
  }

  try {
    const cryptoKey = await crypto.subtle.importKey(
      'jwk',
      matchingKey,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signatureBytes = base64UrlDecode(signatureB64);

    const isValid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      signatureBytes.buffer as ArrayBuffer,
      signedData
    );

    if (!isValid) {
      throw new Error('Google token signature verification failed');
    }
  } catch (err: any) {
    throw new Error(`Cryptographic signature verification error: ${err.message}`);
  }

  return payload;
}
