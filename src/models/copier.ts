import { decryptSecret, encryptSecret } from '../utils/copier-crypto';

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

class CopierStore {
  private delegations = new Map<string, CopierDelegation>();
  private byAgent = new Map<string, string[]>();

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
    const d: CopierDelegation = {
      id: params.id,
      copierAddress: params.copierAddress,
      agentId: params.agentId,
      fixedUsdc: params.fixedUsdc,
      apiKey: params.apiKey,
      apiSecretEnc: encryptSecret(params.apiSecret),
      apiPassphraseEnc: encryptSecret(params.apiPassphrase),
      active: params.active ?? true,
      createdAt: now,
      updatedAt: now,
    };

    this.delegations.set(d.id, d);
    const arr = this.byAgent.get(d.agentId) ?? [];
    arr.push(d.id);
    this.byAgent.set(d.agentId, arr);
    return d;
  }

  listByAgent(agentId: string): CopierDelegation[] {
    const ids = this.byAgent.get(agentId) ?? [];
    return ids.map((id) => this.delegations.get(id)).filter(Boolean) as CopierDelegation[];
  }

  listActiveByAgent(agentId: string): CopierDelegation[] {
    return this.listByAgent(agentId).filter((d) => d.active && d.fixedUsdc > 0);
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
