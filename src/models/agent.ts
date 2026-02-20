import { Agent, AgentConfig, AgentStatus } from '../utils/types';
import { config } from '../config';
import { setAgentPrivateKey } from '../core/key-store';
import { sanitizeObject } from '../utils/sanitize';
import { validateConfigOverrides } from '../utils/validate-config';
import { getDb } from '../core/db';

const DEFAULT_CONFIG: AgentConfig = {
  maxPositionPct: config.DEFAULT_MAX_POSITION_PCT,
  maxDrawdownPct: config.DEFAULT_MAX_DRAWDOWN_PCT,
  maxOrderSize: config.DEFAULT_MAX_ORDER_SIZE,
  dailyLossLimitPct: config.DEFAULT_DAILY_LOSS_LIMIT_PCT,
  maxExposure: 1.0,
  minDiversification: 3,
};

interface AgentRow {
  id: string;
  name: string;
  description: string | null;
  strategy: string | null;
  api_key_hash: string;
  wallet_address: string | null;
  proxy_wallet: string | null;
  status: string;
  config_json: string;
  equity_json: string;
  last_activity: number | null;
  registered_via_api: number;
  created_at: number;
  updated_at: number;
}

function rowToModel(row: AgentRow): Agent {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    strategy: row.strategy ?? undefined,
    apiKeyHash: row.api_key_hash,
    walletAddress: row.wallet_address,
    proxyWallet: row.proxy_wallet,
    status: row.status as AgentStatus,
    config: JSON.parse(row.config_json),
    equity: JSON.parse(row.equity_json),
    lastActivity: row.last_activity ?? undefined,
    registeredViaApi: row.registered_via_api === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

class AgentStore {
  create(params: {
    id: string;
    name: string;
    description?: string;
    strategy?: string;
    apiKeyHash: string;
    privateKey: string;
    walletAddress: string;
    configOverrides?: Partial<AgentConfig>;
    deposit?: number;
    registeredViaApi?: boolean;
  }): Agent {
    const now = Date.now();
    const agentConfig = {
      ...DEFAULT_CONFIG,
      ...validateConfigOverrides(params.configOverrides ? sanitizeObject(params.configOverrides) : undefined),
    };
    const equity = {
      deposited: params.deposit ?? 1000,
      current: params.deposit ?? 1000,
      peakEquity: params.deposit ?? 1000,
      dailyStartEquity: params.deposit ?? 1000,
    };

    getDb().prepare(`
      INSERT INTO agents
        (id, name, description, strategy, api_key_hash, wallet_address, proxy_wallet, status,
         config_json, equity_json, last_activity, registered_via_api, created_at, updated_at)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.id,
      params.name,
      params.description ?? null,
      params.strategy ?? null,
      params.apiKeyHash,
      params.walletAddress,
      null,
      'active',
      JSON.stringify(agentConfig),
      JSON.stringify(equity),
      now,
      (params.registeredViaApi ?? false) ? 1 : 0,
      now,
      now,
    );

    // Store private key securely
    setAgentPrivateKey(params.id, params.privateKey);

    return this.get(params.id)!;
  }

  get(id: string): Agent | undefined {
    const row = getDb()
      .prepare('SELECT * FROM agents WHERE id = ?')
      .get(id) as AgentRow | undefined;
    return row ? rowToModel(row) : undefined;
  }

  findByApiKeyHash(hash: string): Agent | undefined {
    const row = getDb()
      .prepare('SELECT * FROM agents WHERE api_key_hash = ?')
      .get(hash) as AgentRow | undefined;
    return row ? rowToModel(row) : undefined;
  }

  list(): Agent[] {
    const rows = getDb()
      .prepare('SELECT * FROM agents')
      .all() as AgentRow[];
    return rows.map(rowToModel);
  }

  update(id: string, updates: Partial<Agent>): Agent | undefined {
    const existing = this.get(id);
    if (!existing) return undefined;

    const merged = { ...existing, ...sanitizeObject(updates), updatedAt: Date.now() };

    getDb().prepare(`
      UPDATE agents SET
        name = ?,
        description = ?,
        strategy = ?,
        api_key_hash = ?,
        wallet_address = ?,
        proxy_wallet = ?,
        status = ?,
        config_json = ?,
        equity_json = ?,
        last_activity = ?,
        registered_via_api = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      merged.name,
      merged.description ?? null,
      merged.strategy ?? null,
      merged.apiKeyHash,
      merged.walletAddress,
      merged.proxyWallet,
      merged.status,
      JSON.stringify(merged.config),
      JSON.stringify(merged.equity),
      merged.lastActivity ?? null,
      merged.registeredViaApi ? 1 : 0,
      merged.updatedAt,
      id,
    );

    return this.get(id);
  }

  updateEquity(id: string, currentEquity: number): Agent | undefined {
    const agent = this.get(id);
    if (!agent) return undefined;

    const equity = { ...agent.equity, current: currentEquity };
    if (currentEquity > equity.peakEquity) equity.peakEquity = currentEquity;
    const now = Date.now();

    getDb().prepare(`
      UPDATE agents SET equity_json = ?, updated_at = ? WHERE id = ?
    `).run(JSON.stringify(equity), now, id);

    return this.get(id);
  }

  deactivate(id: string): Agent | undefined {
    return this.update(id, { status: 'inactive' as AgentStatus });
  }

  setCircuitBreak(id: string): Agent | undefined {
    return this.update(id, { status: 'circuit_break' as AgentStatus });
  }

  resetCircuitBreak(id: string): Agent | undefined {
    const agent = this.get(id);
    if (!agent || agent.status !== 'circuit_break') return undefined;

    const equity = { ...agent.equity, dailyStartEquity: agent.equity.current };
    const now = Date.now();

    getDb().prepare(`
      UPDATE agents SET status = 'active', equity_json = ?, updated_at = ? WHERE id = ?
    `).run(JSON.stringify(equity), now, id);

    return this.get(id);
  }

  /**
   * Create an external agent — one that brings their own wallets.
   * No private key is stored; the EOA address is used for EIP-712 verification
   * on the /relay endpoint. The proxy wallet is the Polymarket Gnosis Safe.
   * The agent appears on the Leaderboard immediately with zeroed equity.
   */
  createExternal(params: {
    id: string;
    name: string;
    description?: string;
    strategy?: string;
    apiKeyHash: string;
    walletAddress: string;  // EOA — signer
    proxyWallet: string;    // Gnosis Safe — order maker / USDC holder
  }): Agent {
    const now = Date.now();
    const equity = {
      deposited: 0,
      current: 0,
      peakEquity: 0,
      dailyStartEquity: 0,
    };

    getDb().prepare(`
      INSERT INTO agents
        (id, name, description, strategy, api_key_hash, wallet_address, proxy_wallet, status,
         config_json, equity_json, last_activity, registered_via_api, created_at, updated_at)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.id,
      params.name,
      params.description ?? null,
      params.strategy ?? null,
      params.apiKeyHash,
      params.walletAddress,
      params.proxyWallet,
      'active',
      JSON.stringify({ ...DEFAULT_CONFIG }),
      JSON.stringify(equity),
      now,
      1,
      now,
      now,
    );

    // No private key stored — external agents sign their own orders.
    return this.get(params.id)!;
  }

  count(): number {
    const row = getDb()
      .prepare('SELECT COUNT(*) as cnt FROM agents')
      .get() as { cnt: number };
    return row.cnt;
  }
}

export const agentStore = new AgentStore();
