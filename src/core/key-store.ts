/**
 * Encrypted private key storage.
 *
 * Keys are AES-256-GCM encrypted at rest using a master key derived from
 * the KEY_STORE_SECRET env var (or OPERATOR_PRIVATE_KEY as fallback).
 *
 * In production, replace with AWS KMS / Azure Key Vault / HashiCorp Vault.
 */

import crypto from 'crypto';
import { logger } from '../utils/logger';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

// Derive a 256-bit master key from the secret
function deriveMasterKey(): Buffer {
  const secret = process.env.KEY_STORE_SECRET || process.env.OPERATOR_PRIVATE_KEY || '';
  if (!secret) {
    logger.warn('No KEY_STORE_SECRET or OPERATOR_PRIVATE_KEY set — key store encryption uses weak default');
  }
  return crypto.pbkdf2Sync(secret, 'polygent-key-store-v1', 100_000, 32, 'sha256');
}

let masterKey: Buffer | null = null;

function getMasterKey(): Buffer {
  if (!masterKey) masterKey = deriveMasterKey();
  return masterKey;
}

interface EncryptedKey {
  iv: string;   // hex
  tag: string;  // hex
  data: string; // hex
}

function encrypt(plaintext: string): EncryptedKey {
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    data: encrypted.toString('hex'),
  };
}

function decrypt(enc: EncryptedKey): string {
  const key = getMasterKey();
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(enc.iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(enc.tag, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(enc.data, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

const keyStore = new Map<string, EncryptedKey>();

/**
 * Get an agent's private key by their ID (decrypted).
 */
export function getAgentPrivateKey(agentId: string): string | undefined {
  const enc = keyStore.get(agentId);
  if (!enc) return undefined;
  try {
    return decrypt(enc);
  } catch (err) {
    logger.error(`Failed to decrypt key for agent ${agentId}`, {
      error: (err as Error).message,
    });
    return undefined;
  }
}

/**
 * Store an agent's private key (encrypted at rest).
 */
export function setAgentPrivateKey(agentId: string, privateKey: string): void {
  if (!agentId || !privateKey) {
    throw new Error('Agent ID and private key are required');
  }
  keyStore.set(agentId, encrypt(privateKey));
}

/**
 * Remove an agent's private key from storage.
 */
export function removeAgentPrivateKey(agentId: string): boolean {
  return keyStore.delete(agentId);
}

/**
 * Check if an agent has a private key stored.
 */
export function hasAgentPrivateKey(agentId: string): boolean {
  return keyStore.has(agentId);
}

/**
 * Get count of stored private keys (for monitoring).
 */
export function getKeyCount(): number {
  return keyStore.size;
}
