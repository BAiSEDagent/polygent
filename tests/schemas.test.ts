/**
 * Zod schema validation tests
 * 
 * Covers: orderRequestSchema, signedOrderPayloadSchema, agentRegisterSchema,
 *         agentPatchSchema, builderSignSchema, copierCreateSchema
 */

import {
  orderRequestSchema,
  signedOrderPayloadSchema,
  agentRegisterSchema,
  agentPatchSchema,
  builderSignSchema,
  copierCreateSchema,
} from '../src/validation/schemas';

// ── orderRequestSchema ────────────────────────────────────────────────────────

describe('orderRequestSchema', () => {
  const valid = { marketId: 'mkt_123', side: 'BUY', outcome: 'YES', amount: 5, price: 0.5 };

  it('passes a valid order', () => {
    expect(orderRequestSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects missing marketId', () => {
    const { marketId, ...rest } = valid;
    expect(orderRequestSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects invalid side', () => {
    expect(orderRequestSchema.safeParse({ ...valid, side: 'LONG' }).success).toBe(false);
  });

  it('rejects price > 0.99', () => {
    expect(orderRequestSchema.safeParse({ ...valid, price: 1.0 }).success).toBe(false);
  });

  it('rejects price < 0.01', () => {
    expect(orderRequestSchema.safeParse({ ...valid, price: 0.001 }).success).toBe(false);
  });

  it('rejects negative amount', () => {
    expect(orderRequestSchema.safeParse({ ...valid, amount: -5 }).success).toBe(false);
  });

  it('rejects maxSlippage > 0.5', () => {
    expect(orderRequestSchema.safeParse({ ...valid, maxSlippage: 0.9 }).success).toBe(false);
  });

  it('strips HTML from marketId', () => {
    const r = orderRequestSchema.safeParse({ ...valid, marketId: '<b>mkt_123</b>' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.marketId).toBe('mkt_123');
  });
});

// ── signedOrderPayloadSchema ──────────────────────────────────────────────────

describe('signedOrderPayloadSchema', () => {
  const validSignedOrder = {
    salt: '12345',
    maker: '0x742d35cc6634c0532925a3b8d4c9b5c9e2b5a6e8',
    signer: '0x742d35cc6634c0532925a3b8d4c9b5c9e2b5a6e8',
    taker: '0x0000000000000000000000000000000000000000',
    tokenId: 'TOKEN_123',
    makerAmount: '1000000',
    takerAmount: '2000000',
    expiration: '0',
    nonce: '0',
    feeRateBps: '0',
    side: 0,
    signatureType: 0,
    signature: '0xabcdef1234',
  };

  it('passes valid signed order payload', () => {
    expect(signedOrderPayloadSchema.safeParse({ signedOrder: validSignedOrder }).success).toBe(true);
  });

  it('rejects missing signedOrder', () => {
    expect(signedOrderPayloadSchema.safeParse({}).success).toBe(false);
  });

  it('rejects non-hex signature', () => {
    const bad = { ...validSignedOrder, signature: 'not-hex' };
    expect(signedOrderPayloadSchema.safeParse({ signedOrder: bad }).success).toBe(false);
  });

  it('rejects non-numeric makerAmount', () => {
    const bad = { ...validSignedOrder, makerAmount: 'abc' };
    expect(signedOrderPayloadSchema.safeParse({ signedOrder: bad }).success).toBe(false);
  });

  it('rejects invalid maker address', () => {
    const bad = { ...validSignedOrder, maker: 'not-an-address' };
    expect(signedOrderPayloadSchema.safeParse({ signedOrder: bad }).success).toBe(false);
  });
});

// ── agentRegisterSchema ───────────────────────────────────────────────────────

describe('agentRegisterSchema', () => {
  const valid = {
    name: 'My Agent',
    eoaAddress: '0x742d35cc6634c0532925a3b8d4c9b5c9e2b5a6e8',
    proxyAddress: '0x1234567890123456789012345678901234567890',
  };

  it('passes valid registration', () => {
    expect(agentRegisterSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects missing name', () => {
    const { name, ...rest } = valid;
    expect(agentRegisterSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects invalid eoaAddress', () => {
    expect(agentRegisterSchema.safeParse({ ...valid, eoaAddress: 'bad' }).success).toBe(false);
  });

  it('strips HTML from name', () => {
    const r = agentRegisterSchema.safeParse({ ...valid, name: '<script>alert(1)</script>Bot' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.name).not.toContain('<script>');
  });

  it('checksums the address', () => {
    const lower = { ...valid, eoaAddress: valid.eoaAddress.toLowerCase() };
    const r = agentRegisterSchema.safeParse(lower);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.eoaAddress).toMatch(/^0x[0-9A-Fa-f]{40}$/);
  });
});

// ── agentPatchSchema ──────────────────────────────────────────────────────────

describe('agentPatchSchema', () => {
  it('accepts boolean autoRedeem', () => {
    expect(agentPatchSchema.safeParse({ autoRedeem: true }).success).toBe(true);
  });

  it('accepts string "true" for autoRedeem', () => {
    const r = agentPatchSchema.safeParse({ autoRedeem: 'true' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.autoRedeem).toBe(true);
  });

  it('accepts empty patch', () => {
    expect(agentPatchSchema.safeParse({}).success).toBe(true);
  });

  it('rejects invalid autoRedeem value', () => {
    expect(agentPatchSchema.safeParse({ autoRedeem: 'yes' }).success).toBe(false);
  });
});

// ── builderSignSchema ─────────────────────────────────────────────────────────

describe('builderSignSchema', () => {
  it('passes valid sign request', () => {
    expect(builderSignSchema.safeParse({ method: 'POST', path: '/v1/order' }).success).toBe(true);
  });

  it('rejects missing method', () => {
    expect(builderSignSchema.safeParse({ path: '/v1/order' }).success).toBe(false);
  });

  it('rejects missing path', () => {
    expect(builderSignSchema.safeParse({ method: 'POST' }).success).toBe(false);
  });
});

// ── copierCreateSchema ────────────────────────────────────────────────────────

describe('copierCreateSchema', () => {
  const valid = {
    copierAddress: '0x742d35cc6634c0532925a3b8d4c9b5c9e2b5a6e8',
    agentId: 'agent_123',
    fixedUsdc: 10,
    apiKey: 'key_abc',
    apiSecret: 'secret_abc',
    apiPassphrase: 'pass_abc',
    l2PrivateKey: '0x' + 'a'.repeat(64),
  };

  it('passes valid copier', () => {
    expect(copierCreateSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects invalid address', () => {
    expect(copierCreateSchema.safeParse({ ...valid, copierAddress: 'bad' }).success).toBe(false);
  });

  it('rejects fixedUsdc > 1000', () => {
    expect(copierCreateSchema.safeParse({ ...valid, fixedUsdc: 2000 }).success).toBe(false);
  });

  it('rejects invalid l2PrivateKey', () => {
    expect(copierCreateSchema.safeParse({ ...valid, l2PrivateKey: '0xshort' }).success).toBe(false);
  });

  it('rejects missing apiKey', () => {
    const { apiKey, ...rest } = valid;
    expect(copierCreateSchema.safeParse(rest).success).toBe(false);
  });
});
