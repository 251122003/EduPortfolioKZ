import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

// Personal data rules (specifications.md NFR-5, claude.md rule 1):
// - IIN and phone are stored encrypted (AES-256-GCM) so they can be shown to their owner;
// - lookups use a keyed HMAC-SHA256 hash, so the database can find a student by IIN
//   without ever holding the IIN in plain text;
// - neither value is ever written to logs.

const FORMAT_VERSION = 1;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_PATTERN = /^[0-9a-f]{64}$/i;

export type HashKind = 'iin' | 'phone';

export class IdentityCrypto {
  private readonly hmacKey: Buffer;
  private readonly encryptionKey: Buffer;

  constructor(hmacKeyHex: string, encryptionKeyHex: string) {
    if (!KEY_PATTERN.test(hmacKeyHex) || !KEY_PATTERN.test(encryptionKeyHex)) {
      throw new Error('IdentityCrypto keys must be 32 bytes written as 64 hex characters');
    }
    if (hmacKeyHex.toLowerCase() === encryptionKeyHex.toLowerCase()) {
      throw new Error('IIN_HMAC_KEY and IIN_ENCRYPTION_KEY must be different');
    }
    this.hmacKey = Buffer.from(hmacKeyHex, 'hex');
    this.encryptionKey = Buffer.from(encryptionKeyHex, 'hex');
  }

  /** Reads IIN_HMAC_KEY and IIN_ENCRYPTION_KEY from the environment (backend/.env). */
  static fromEnv(env: NodeJS.ProcessEnv = process.env): IdentityCrypto {
    const hmacKey = env.IIN_HMAC_KEY;
    const encryptionKey = env.IIN_ENCRYPTION_KEY;
    if (!hmacKey || !encryptionKey) {
      throw new Error('IIN_HMAC_KEY and IIN_ENCRYPTION_KEY must be set in backend/.env');
    }
    return new IdentityCrypto(hmacKey, encryptionKey);
  }

  /**
   * Keyed hash for lookups: 64 hex characters, fits the CHAR(64) *_hash columns.
   * The kind is mixed in, so an IIN and a phone with the same digits never collide.
   */
  hash(kind: HashKind, normalizedValue: string): string {
    return createHmac('sha256', this.hmacKey).update(`${kind}:${normalizedValue}`).digest('hex');
  }

  /** Encrypts with AES-256-GCM. Layout: version (1 byte) | IV (12) | auth tag (16) | ciphertext. */
  encrypt(plaintext: string): Uint8Array<ArrayBuffer> {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const packed = Buffer.concat([Buffer.from([FORMAT_VERSION]), iv, cipher.getAuthTag(), ciphertext]);
    return new Uint8Array(packed);
  }

  /** Reverses encrypt(). Throws if the data was changed or encrypted with another key. */
  decrypt(data: Uint8Array): string {
    const packed = Buffer.from(data);
    if (packed.length < 1 + IV_LENGTH + TAG_LENGTH || packed[0] !== FORMAT_VERSION) {
      throw new Error('Unknown encrypted data format');
    }
    const iv = packed.subarray(1, 1 + IV_LENGTH);
    const tag = packed.subarray(1 + IV_LENGTH, 1 + IV_LENGTH + TAG_LENGTH);
    const ciphertext = packed.subarray(1 + IV_LENGTH + TAG_LENGTH);
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }
}

/**
 * Brings a Kazakhstan mobile number to one form, +7XXXXXXXXXX, so that
 * "8 701 123 45 67" and "+7 (701) 123-45-67" give the same hash.
 * Returns null when it is not a Kazakhstan mobile number.
 */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  let national: string;
  if (digits.length === 11 && (digits.startsWith('8') || digits.startsWith('7'))) {
    national = digits.slice(1);
  } else if (digits.length === 10) {
    national = digits;
  } else {
    return null;
  }
  // Kazakhstan mobile numbers start with 7 after the country code (+7 7XX ...).
  return national.startsWith('7') ? `+7${national}` : null;
}

/**
 * Brings a full name to one form for matching (UC-1 step 7):
 * trims, collapses inner spaces, upper-cases and treats Ё as Е.
 */
export function normalizeName(input: string): string {
  return input
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleUpperCase('kk-KZ')
    .replace(/Ё/g, 'Е');
}
