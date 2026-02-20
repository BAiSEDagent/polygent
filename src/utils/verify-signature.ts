import { ethers } from 'ethers';
import { logger } from './logger';

/**
 * Polymarket CTF Exchange EIP-712 domain (Polygon mainnet).
 * Used to recover the signer from an externally signed CLOB order.
 */
const POLYMARKET_DOMAIN = {
  name: 'Polymarket CTF Exchange',
  version: '1',
  chainId: 137,
  verifyingContract: '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E',
};

const ORDER_TYPES = {
  Order: [
    { name: 'salt',          type: 'uint256' },
    { name: 'maker',         type: 'address' },
    { name: 'signer',        type: 'address' },
    { name: 'taker',         type: 'address' },
    { name: 'tokenId',       type: 'uint256' },
    { name: 'makerAmount',   type: 'uint256' },
    { name: 'takerAmount',   type: 'uint256' },
    { name: 'expiration',    type: 'uint256' },
    { name: 'nonce',         type: 'uint256' },
    { name: 'feeRateBps',    type: 'uint256' },
    { name: 'side',          type: 'uint8'   },
    { name: 'signatureType', type: 'uint8'   },
  ],
};

export interface SignedCLOBOrder {
  salt: string;
  maker: string;
  signer: string;
  taker: string;
  tokenId: string;
  makerAmount: string;
  takerAmount: string;
  expiration: string;
  nonce: string;
  feeRateBps: string;
  side: number;
  signatureType: number;
  signature: string;
}

/**
 * Recover the EOA signer from a Polymarket EIP-712 signed order.
 * Returns lowercase address or throws on malformed input.
 */
export function recoverOrderSigner(order: SignedCLOBOrder): string {
  const { signature, ...value } = order;

  try {
    const recovered = ethers.utils.verifyTypedData(
      POLYMARKET_DOMAIN,
      ORDER_TYPES,
      value,
      signature,
    );
    return recovered.toLowerCase();
  } catch (err) {
    logger.warn('EIP-712 signature recovery failed', {
      error: (err as Error).message,
    });
    throw new Error('Invalid order signature — cannot recover signer');
  }
}

/**
 * Assert that the recovered signer matches the agent's registered EOA.
 * Throws (401-safe) if mismatch — prevents leaderboard spoofing.
 */
export function assertSignerIsAgent(
  order: SignedCLOBOrder,
  registeredEoa: string,
): void {
  const recovered = recoverOrderSigner(order);
  const expected = registeredEoa.toLowerCase();

  if (recovered !== expected) {
    logger.warn('Signer mismatch — spoofing attempt blocked', {
      recovered,
      expected,
    });
    throw new Error(`Signer mismatch: recovered ${recovered}, expected ${expected}`);
  }
}
