// Set env before importing key-store
process.env.KEY_STORE_SECRET = 'test-master-secret-for-unit-tests';

import {
  getAgentPrivateKey,
  setAgentPrivateKey,
  removeAgentPrivateKey,
  hasAgentPrivateKey,
  getKeyCount,
} from '../src/core/key-store';

jest.mock('../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('Encrypted Key Store', () => {
  const AGENT_ID = 'agent_test_001';
  const PRIVATE_KEY = '0xdeadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678';

  beforeEach(() => {
    // Clear store between tests
    removeAgentPrivateKey(AGENT_ID);
  });

  it('should store and retrieve a private key', () => {
    setAgentPrivateKey(AGENT_ID, PRIVATE_KEY);
    const retrieved = getAgentPrivateKey(AGENT_ID);
    expect(retrieved).toBe(PRIVATE_KEY);
  });

  it('should return undefined for unknown agent', () => {
    expect(getAgentPrivateKey('nonexistent')).toBeUndefined();
  });

  it('should remove a key', () => {
    setAgentPrivateKey(AGENT_ID, PRIVATE_KEY);
    expect(hasAgentPrivateKey(AGENT_ID)).toBe(true);
    removeAgentPrivateKey(AGENT_ID);
    expect(hasAgentPrivateKey(AGENT_ID)).toBe(false);
    expect(getAgentPrivateKey(AGENT_ID)).toBeUndefined();
  });

  it('should throw on empty agentId or privateKey', () => {
    expect(() => setAgentPrivateKey('', PRIVATE_KEY)).toThrow();
    expect(() => setAgentPrivateKey(AGENT_ID, '')).toThrow();
  });

  it('should track key count', () => {
    const before = getKeyCount();
    setAgentPrivateKey(AGENT_ID, PRIVATE_KEY);
    expect(getKeyCount()).toBe(before + 1);
  });

  it('should handle multiple agents independently', () => {
    const key1 = '0x1111111111111111111111111111111111111111111111111111111111111111';
    const key2 = '0x2222222222222222222222222222222222222222222222222222222222222222';
    setAgentPrivateKey('agent_a', key1);
    setAgentPrivateKey('agent_b', key2);
    expect(getAgentPrivateKey('agent_a')).toBe(key1);
    expect(getAgentPrivateKey('agent_b')).toBe(key2);
    // cleanup
    removeAgentPrivateKey('agent_a');
    removeAgentPrivateKey('agent_b');
  });
});
