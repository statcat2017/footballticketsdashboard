const encoder = new TextEncoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

async function importKey(secret: string): Promise<CryptoKey> {
  const secretBytes = encoder.encode(secret);

  return crypto.subtle.importKey(
    "raw",
    secretBytes.buffer.slice(secretBytes.byteOffset, secretBytes.byteOffset + secretBytes.byteLength),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function encodeJsonPayload(payload: unknown): string {
  return base64UrlEncode(encoder.encode(JSON.stringify(payload)));
}

export function decodeJsonPayload<T>(value: string): T {
  const bytes = base64UrlDecode(value);
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json) as T;
}

export async function signValue(value: string, secret: string): Promise<string> {
  const key = await importKey(secret);
  const valueBytes = encoder.encode(value);
  const signature = await crypto.subtle.sign("HMAC", key, toArrayBuffer(valueBytes));
  return base64UrlEncode(new Uint8Array(signature));
}

export async function verifySignature(value: string, signature: string, secret: string): Promise<boolean> {
  const key = await importKey(secret);
  const valueBytes = encoder.encode(value);
  return crypto.subtle.verify("HMAC", key, toArrayBuffer(base64UrlDecode(signature)), toArrayBuffer(valueBytes));
}

export async function createSignedToken(payload: unknown, secret: string): Promise<string> {
  const encodedPayload = encodeJsonPayload(payload);
  const signature = await signValue(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export async function verifySignedToken<T>(token: string, secret: string): Promise<T | null> {
  const [encodedPayload, signature, extra] = token.split(".");

  if (!encodedPayload || !signature || extra !== undefined) {
    return null;
  }

  const valid = await verifySignature(encodedPayload, signature, secret).catch(() => false);

  if (!valid) {
    return null;
  }

  try {
    return decodeJsonPayload<T>(encodedPayload);
  } catch {
    return null;
  }
}

export function secureCompare(left: string, right: string): boolean {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const maxLength = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;

  for (let i = 0; i < maxLength; i += 1) {
    difference |= (leftBytes[i] ?? 0) ^ (rightBytes[i] ?? 0);
  }

  return difference === 0;
}
