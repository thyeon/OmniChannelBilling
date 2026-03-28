import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
// TAG_LENGTH and SALT_LENGTH are defined for reference but not currently used
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const TAG_LENGTH = 16;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SALT_LENGTH = 32;

function getKey(): Buffer {
  const key = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY environment variable is not set');
  }
  // Derive a 32-byte key from the env var using scrypt
  return scryptSync(key, 'salt', 32);
}

export function encrypt(plaintext: string): string {
  // Returns: iv:tag:ciphertext (all base64)
  const iv = randomBytes(IV_LENGTH);
  const key = getKey();
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const tag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted}`;
}

export function decrypt(ciphertext: string): string {
  // Parse: iv:tag:ciphertext
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format');
  }
  const [ivB64, tagB64, encrypted] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const key = getKey();

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function maskCredential(credential: string): string {
  // Show last 4 chars, mask the rest: "secretkey1234" -> "****1234"
  if (credential.length <= 4) return '****';
  return '****' + credential.slice(-4);
}