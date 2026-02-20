import crypto from 'crypto';

interface EncryptedBlob {
  iv: string;
  tag: string;
  data: string;
}

function getKey(): Buffer {
  const raw = process.env.COPIER_ENCRYPTION_KEY || '';
  if (!raw) throw new Error('COPIER_ENCRYPTION_KEY is required');
  // accept 64-char hex (preferred) or fallback to sha256(passphrase)
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  return crypto.createHash('sha256').update(raw).digest();
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload: EncryptedBlob = {
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    data: encrypted.toString('hex'),
  };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

export function decryptSecret(ciphertext: string): string {
  const key = getKey();
  const decoded = Buffer.from(ciphertext, 'base64').toString('utf8');
  const payload = JSON.parse(decoded) as EncryptedBlob;
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(payload.tag, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.data, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
