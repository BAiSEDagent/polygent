import { createPublicClient, http, formatUnits, getAddress } from 'viem';
import { polygon } from 'viem/chains';
import { agentStore } from '../models/agent';
import { logger } from '../utils/logger';

// Polymarket contract addresses on Polygon
const CONTRACTS = {
  USDC_E: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  CTF: '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045',
  CTF_EXCHANGE: '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E',
};

const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [
      { name: '_owner', type: 'address' },
      { name: '_spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    type: 'function',
  },
] as const;

const ERC1155_ABI = [
  {
    constant: true,
    inputs: [
      { name: '_owner', type: 'address' },
      { name: '_operator', type: 'address' },
    ],
    name: 'isApprovedForAll',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function',
  },
] as const;

const POLYMARKET_MIN_ORDER_SIZE = 1.01; // Polymarket enforces ~$1 minimum
const MIN_GAS_BALANCE = 0.01; // 0.01 POL minimum for gas (EOA wallets only)

export interface HealthCheckResult {
  healthy: boolean;
  wallet: string;
  balances: {
    usdce: string; // formatted USDC.e balance
    pol: string;   // formatted POL balance (gas)
  };
  approvals: {
    usdceToExchange: boolean;
    ctfToExchange: boolean;
  };
  status: {
    circuitBreaker: boolean;
    agentActive: boolean;
  };
  blockers: string[];
  lastTrade?: number;
}

/**
 * Health check for an agent.
 *
 * Returns:
 * - Wallet balances (USDC.e, POL)
 * - Approval status (USDC → Exchange, CTF → Exchange)
 * - Circuit breaker status
 * - List of blockers preventing trades
 */
export async function checkAgentHealth(agentId: string): Promise<HealthCheckResult> {
  const agent = agentStore.get(agentId);

  if (!agent) {
    throw new Error(`Agent ${agentId} not found`);
  }

  const walletAddress = agent.proxyWallet || agent.walletAddress;

  if (!walletAddress) {
    throw new Error(`Agent ${agentId} has no wallet address`);
  }

  logger.info(`Health check for agent ${agentId} (wallet: ${walletAddress})`);

  const publicClient = createPublicClient({
    chain: polygon,
    transport: http(process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com'),
  });

  const checksumAddress = getAddress(walletAddress);

  // Parallel RPC calls
  const [usdceBalance, polBalance, usdceAllowance, ctfApproval] = await Promise.all([
    // USDC.e balance
    publicClient.readContract({
      address: CONTRACTS.USDC_E as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [checksumAddress],
    }),
    // POL balance (gas token)
    publicClient.getBalance({ address: checksumAddress }),
    // USDC.e → Exchange approval
    publicClient.readContract({
      address: CONTRACTS.USDC_E as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [checksumAddress, CONTRACTS.CTF_EXCHANGE as `0x${string}`],
    }),
    // CTF → Exchange approval (ERC1155)
    publicClient.readContract({
      address: CONTRACTS.CTF as `0x${string}`,
      abi: ERC1155_ABI,
      functionName: 'isApprovedForAll',
      args: [checksumAddress, CONTRACTS.CTF_EXCHANGE as `0x${string}`],
    }),
  ]);

  const usdceBalanceFormatted = parseFloat(formatUnits(usdceBalance as bigint, 6));
  const polBalanceFormatted = parseFloat(formatUnits(polBalance as bigint, 18));
  const usdceAllowanceFormatted = parseFloat(formatUnits(usdceAllowance as bigint, 6));

  const hasUsdceApproval = usdceAllowanceFormatted >= POLYMARKET_MIN_ORDER_SIZE;
  const hasCtfApproval = ctfApproval as boolean;

  const blockers: string[] = [];

  // Check balances
  if (usdceBalanceFormatted < POLYMARKET_MIN_ORDER_SIZE) {
    blockers.push(
      `USDC.e balance ($${usdceBalanceFormatted.toFixed(2)}) below Polymarket minimum ($${POLYMARKET_MIN_ORDER_SIZE})`
    );
  }

  // Only check POL balance for EOA wallets (Safe wallets use gasless relayer)
  const isSafeWallet = agent.proxyWallet && agent.proxyWallet !== agent.walletAddress;
  if (!isSafeWallet && polBalanceFormatted < MIN_GAS_BALANCE) {
    blockers.push(
      `POL balance (${polBalanceFormatted.toFixed(4)} POL) below minimum (${MIN_GAS_BALANCE} POL for gas)`
    );
  }

  // Check approvals
  if (!hasUsdceApproval) {
    blockers.push(
      `Missing USDC.e → Exchange approval (allowance: $${usdceAllowanceFormatted.toFixed(2)})`
    );
  }

  if (!hasCtfApproval) {
    blockers.push('Missing CTF → Exchange approval (setApprovalForAll not called)');
  }

  // Check circuit breaker
  if (agent.status === 'circuit_break') {
    blockers.push('Circuit breaker triggered (reset via POST /api/agents/:id/reset)');
  }

  // Check if agent is active
  if (agent.status !== 'active' && agent.status !== 'circuit_break') {
    blockers.push(`Agent status is '${agent.status}' (must be 'active' to trade)`);
  }

  const healthy = blockers.length === 0;

  return {
    healthy,
    wallet: walletAddress,
    balances: {
      usdce: `$${usdceBalanceFormatted.toFixed(2)}`,
      pol: `${polBalanceFormatted.toFixed(4)} POL`,
    },
    approvals: {
      usdceToExchange: hasUsdceApproval,
      ctfToExchange: hasCtfApproval,
    },
    status: {
      circuitBreaker: agent.status === 'circuit_break',
      agentActive: agent.status === 'active',
    },
    blockers,
    lastTrade: agent.lastActivity,
  };
}
