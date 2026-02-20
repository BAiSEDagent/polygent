/**
 * Encrypted private key storage — backed by SQLite (agent_keys table).
 *
 * Keys are AES-256-GCM encrypted at rest using a master key derived from
 * the KEY_STORE_SECRET env var (or OPERATOR_PRIVATE_KEY as fallback).
 *
 * In production, replace with AWS KMS / Azure Key Vault / HashiCorp Vault.
 */

import crypto from 'crypto';
import { logger } from '../utils/logger';
import { getDb } from './db';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

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

interface KeyRow {
  agent_id: string;
  iv: string;
  tag: string;
  data: string;
  created_at: number;
  updated_at: number;
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

/**
 * Get an agent's private key by their ID (decrypted).
 */
export function getAgentPrivateKey(agentId: string): string | undefined {
  const row = getDb()
    .prepare('SELECT iv, tag, data FROM agent_keys WHERE agent_id = ?')
    .get(agentId) as Pick<KeyRow, 'iv' | 'tag' | 'data'> | undefined;
  if (!row) return undefined;
  try {
    return decrypt({ iv: row.iv, tag: row.tag, data: row.data });
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
  const enc = encrypt(privateKey);
  const now = Date.now();
  getDb().prepare(`
    INSERT INTO agent_keys (agent_id, iv, tag, data, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(agent_id) DO UPDATE SET
      iv = excluded.iv,
      tag = excluded.tag,
      data = excluded.data,
      updated_at = excluded.updated_at
  `).run(agentId, enc.iv, enc.tag, enc.data, now, now);
}

/**
 * Remove an agent's private key from storage.
 */
export function removeAgentPrivateKey(agentId: string): boolean {
  const result = getDb()
    .prepare('DELETE FROM agent_keys WHERE agent_id = ?')
    .run(agentId);
  return result.changes > 0;
}

/**
 * Check if an agent has a private key stored.
 */
export function hasAgentPrivateKey(agentId: string): boolean {
  const row = getDb()
    .prepare('SELECT 1 FROM agent_keys WHERE agent_id = ?')
    .get(agentId);
  return row !== undefined;
}

/**
 * Get count of stored private keys (for monitoring).
 */
export function getKeyCount(): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) as cnt FROM agent_keys')
    .get() as { cnt: number };
  return row.cnt;
}
