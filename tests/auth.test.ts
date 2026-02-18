import { hashApiKey, generateApiKey } from '../src/utils/auth';

describe('Auth Utilities', () => {
  describe('generateApiKey', () => {
    it('should generate a key with cog_live_ prefix', () => {
      const key = generateApiKey();
      expect(key).toMatch(/^cog_live_[A-Za-z0-9_-]+$/);
    });

    it('should generate unique keys', () => {
      const keys = new Set(Array.from({ length: 100 }, () => generateApiKey()));
      expect(keys.size).toBe(100);
    });
  });

  describe('hashApiKey', () => {
    it('should produce a consistent SHA-256 hex hash', () => {
      const hash1 = hashApiKey('test-key-123');
      const hash2 = hashApiKey('test-key-123');
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce different hashes for different keys', () => {
      const hash1 = hashApiKey('key-a');
      const hash2 = hashApiKey('key-b');
      expect(hash1).not.toBe(hash2);
    });
  });
});
