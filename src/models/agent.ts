import { Agent, AgentConfig, AgentStatus } from '../utils/types';
import { config } from '../config';

const DEFAULT_CONFIG: AgentConfig = {
  maxPositionPct: config.DEFAULT_MAX_POSITION_PCT,
  maxDrawdownPct: config.DEFAULT_MAX_DRAWDOWN_PCT,
  maxOrderSize: config.DEFAULT_MAX_ORDER_SIZE,
  dailyLossLimitPct: config.DEFAULT_DAILY_LOSS_LIMIT_PCT,
  maxExposure: 1.0,
  minDiversification: 3,
};

class AgentStore {
  private agents = new Map<string, Agent>();
  private apiKeyIndex = new Map<string, string>(); // hash → agentId

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
    const agent: Agent = {
      id: params.id,
      name: params.name,
      description: params.description,
      strategy: params.strategy,
      apiKeyHash: params.apiKeyHash,
      walletAddress: params.walletAddress,
      privateKey: params.privateKey,
      proxyWallet: null,
      status: 'active',
      config: { ...DEFAULT_CONFIG, ...params.configOverrides },
      equity: {
        deposited: params.deposit ?? 1000,
        current: params.deposit ?? 1000,
        peakEquity: params.deposit ?? 1000,
        dailyStartEquity: params.deposit ?? 1000,
      },
      lastActivity: now,
      registeredViaApi: params.registeredViaApi ?? false,
      createdAt: now,
      updatedAt: now,
    };
    this.agents.set(agent.id, agent);
    this.apiKeyIndex.set(params.apiKeyHash, agent.id);
    return agent;
  }

  get(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  findByApiKeyHash(hash: string): Agent | undefined {
    const id = this.apiKeyIndex.get(hash);
    return id ? this.agents.get(id) : undefined;
  }

  list(): Agent[] {
    return Array.from(this.agents.values());
  }

  update(id: string, updates: Partial<Agent>): Agent | undefined {
    const agent = this.agents.get(id);
    if (!agent) return undefined;
    const updated = { ...agent, ...updates, updatedAt: Date.now() };
    this.agents.set(id, updated);
    return updated;
  }

  updateEquity(id: string, currentEquity: number): Agent | undefined {
    const agent = this.agents.get(id);
    if (!agent) return undefined;
    agent.equity.current = currentEquity;
    if (currentEquity > agent.equity.peakEquity) {
      agent.equity.peakEquity = currentEquity;
    }
    agent.updatedAt = Date.now();
    return agent;
  }

  deactivate(id: string): Agent | undefined {
    return this.update(id, { status: 'inactive' as AgentStatus });
  }

  setCircuitBreak(id: string): Agent | undefined {
    return this.update(id, { status: 'circuit_break' as AgentStatus });
  }

  resetCircuitBreak(id: string): Agent | undefined {
    const agent = this.agents.get(id);
    if (!agent || agent.status !== 'circuit_break') return undefined;
    agent.status = 'active';
    agent.equity.dailyStartEquity = agent.equity.current;
    agent.updatedAt = Date.now();
    return agent;
  }

  count(): number {
    return this.agents.size;
  }
}

export const agentStore = new AgentStore();
