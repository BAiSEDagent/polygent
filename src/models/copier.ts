import { decryptSecret, encryptSecret } from '../utils/copier-crypto';
import { getDb } from '../core/db';

export interface CopierDelegation {
  id: string;
  copierAddress: string; // user's proxy wallet
  agentId: string;
  fixedUsdc: number;
  apiKey: string;
  apiSecretEnc: string;
  apiPassphraseEnc: string;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CopierDelegationPlain {
  id: string;
  copierAddress: string;
  agentId: string;
  fixedUsdc: number;
  apiKey: string;
  apiSecret: string;
  apiPassphrase: string;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

interface CopierRow {
  id: string;
  copier_address: string;
  agent_id: string;
  fixed_usdc: number;
  api_key: string;
  api_secret_enc: string;
  api_passphrase_enc: string;
  active: number;
  created_at: number;
  updated_at: number;
}

function rowToModel(row: CopierRow): CopierDelegation {
  return {
    id: row.id,
    copierAddress: row.copier_address,
    agentId: row.agent_id,
    fixedUsdc: row.fixed_usdc,
    apiKey: row.api_key,
    apiSecretEnc: row.api_secret_enc,
    apiPassphraseEnc: row.api_passphrase_enc,
    active: row.active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

class CopierStore {
  create(params: {
    id: string;
    copierAddress: string;
    agentId: string;
    fixedUsdc: number;
    apiKey: string;
    apiSecret: string;
    apiPassphrase: string;
    active?: boolean;
  }): CopierDelegation {
    const now = Date.now();
    const db = getDb();
    db.prepare(`
      INSERT INTO copier_delegations
        (id, copier_address, agent_id, fixed_usdc, api_key, api_secret_enc, api_passphrase_enc, active, created_at, updated_at)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.id,
      params.copierAddress,
      params.agentId,
      params.fixedUsdc,
      params.apiKey,
      encryptSecret(params.apiSecret),
      encryptSecret(params.apiPassphrase),
      (params.active ?? true) ? 1 : 0,
      now,
      now,
    );
    return rowToModel(
      db.prepare('SELECT * FROM copier_delegations WHERE id = ?').get(params.id) as CopierRow,
    );
  }

  listByAgent(agentId: string): CopierDelegation[] {
    const rows = getDb()
      .prepare('SELECT * FROM copier_delegations WHERE agent_id = ?')
      .all(agentId) as CopierRow[];
    return rows.map(rowToModel);
  }

  listActiveByAgent(agentId: string): CopierDelegation[] {
    const rows = getDb()
      .prepare('SELECT * FROM copier_delegations WHERE agent_id = ? AND active = 1 AND fixed_usdc > 0')
      .all(agentId) as CopierRow[];
    return rows.map(rowToModel);
  }

  listActiveByAgentDecrypted(agentId: string): CopierDelegationPlain[] {
    return this.listActiveByAgent(agentId).map((d) => ({
      id: d.id,
      copierAddress: d.copierAddress,
      agentId: d.agentId,
      fixedUsdc: d.fixedUsdc,
      apiKey: d.apiKey,
      apiSecret: decryptSecret(d.apiSecretEnc),
      apiPassphrase: decryptSecret(d.apiPassphraseEnc),
      active: d.active,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }));
  }

  publicViewByAgent(agentId: string): Array<Omit<CopierDelegation, 'apiSecretEnc' | 'apiPassphraseEnc' | 'apiKey'>> {
    return this.listByAgent(agentId).map(({ apiSecretEnc, apiPassphraseEnc, apiKey, ...rest }) => rest);
  }
}

export const copierStore = new CopierStore();
