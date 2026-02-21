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
  l2PrivateKeyEnc: string;
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
  l2PrivateKey: string;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

class CopierStore {
  private db = getDb();

  create(params: {
    id: string;
    copierAddress: string;
    agentId: string;
    fixedUsdc: number;
    apiKey: string;
    apiSecret: string;
    apiPassphrase: string;
    l2PrivateKey: string;
    active?: boolean;
  }): CopierDelegation {
    const now = Date.now();
    const d: CopierDelegation = {
      id: params.id,
      copierAddress: params.copierAddress,
      agentId: params.agentId,
      fixedUsdc: params.fixedUsdc,
      apiKey: params.apiKey,
      apiSecretEnc: encryptSecret(params.apiSecret),
      apiPassphraseEnc: encryptSecret(params.apiPassphrase),
      l2PrivateKeyEnc: encryptSecret(params.l2PrivateKey),
      active: params.active ?? true,
      createdAt: now,
      updatedAt: now,
    };

    this.db
      .prepare(
        `INSERT INTO copier_delegations
         (id, copier_address, agent_id, fixed_usdc, api_key, api_secret_enc, api_passphrase_enc, l2_private_key_enc, active, created_at, updated_at)
         VALUES (@id, @copier_address, @agent_id, @fixed_usdc, @api_key, @api_secret_enc, @api_passphrase_enc, @l2_private_key_enc, @active, @created_at, @updated_at)`
      )
      .run({
        id: d.id,
        copier_address: d.copierAddress,
        agent_id: d.agentId,
        fixed_usdc: d.fixedUsdc,
        api_key: d.apiKey,
        api_secret_enc: d.apiSecretEnc,
        api_passphrase_enc: d.apiPassphraseEnc,
        l2_private_key_enc: d.l2PrivateKeyEnc,
        active: d.active ? 1 : 0,
        created_at: d.createdAt,
        updated_at: d.updatedAt,
      });

    return d;
  }

  private mapRow(row: any): CopierDelegation {
    return {
      id: row.id,
      copierAddress: row.copier_address,
      agentId: row.agent_id,
      fixedUsdc: Number(row.fixed_usdc),
      apiKey: row.api_key,
      apiSecretEnc: row.api_secret_enc,
      apiPassphraseEnc: row.api_passphrase_enc,
      l2PrivateKeyEnc: row.l2_private_key_enc,
      active: Boolean(row.active),
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
    };
  }

  listByAgent(agentId: string): CopierDelegation[] {
    const rows = this.db
      .prepare('SELECT * FROM copier_delegations WHERE agent_id = ? ORDER BY created_at DESC')
      .all(agentId);
    return rows.map((r: any) => this.mapRow(r));
  }

  listActiveByAgent(agentId: string): CopierDelegation[] {
    const rows = this.db
      .prepare('SELECT * FROM copier_delegations WHERE agent_id = ? AND active = 1 AND fixed_usdc > 0 ORDER BY created_at DESC')
      .all(agentId);
    return rows.map((r: any) => this.mapRow(r));
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
      l2PrivateKey: decryptSecret(d.l2PrivateKeyEnc),
      active: d.active,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }));
  }

  publicViewByAgent(agentId: string): Array<Omit<CopierDelegation, 'apiSecretEnc' | 'apiPassphraseEnc' | 'l2PrivateKeyEnc' | 'apiKey'>> {
    return this.listByAgent(agentId).map(({ apiSecretEnc, apiPassphraseEnc, l2PrivateKeyEnc, apiKey, ...rest }) => rest);
  }
}

export const copierStore = new CopierStore();
