import { sanitizeObject } from '../src/utils/sanitize';

describe('sanitizeObject', () => {
  it('should strip __proto__ keys', () => {
    const malicious = JSON.parse('{"__proto__":{"admin":true},"name":"ok"}');
    const result = sanitizeObject(malicious);
    expect(result.name).toBe('ok');
    expect(Object.prototype.hasOwnProperty.call(result, '__proto__')).toBe(false);
    expect(result.admin).toBeUndefined();
  });

  it('should strip constructor and prototype keys', () => {
    const obj = { constructor: 'evil', prototype: 'also evil', safe: true };
    const result = sanitizeObject(obj);
    expect(result.safe).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(result, 'constructor')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(result, 'prototype')).toBe(false);
  });

  it('should handle nested objects recursively', () => {
    const obj = { a: { __proto__: { hack: true }, b: 'ok' } };
    const result = sanitizeObject(obj);
    expect(result.a.b).toBe('ok');
  });

  it('should handle arrays', () => {
    const arr = [{ __proto__: {}, name: 'safe' }, 'plain'];
    const result = sanitizeObject(arr as any);
    expect(result[0].name).toBe('safe');
    expect(result[1]).toBe('plain');
  });

  it('should pass through primitives', () => {
    expect(sanitizeObject(null as any)).toBeNull();
    expect(sanitizeObject(undefined as any)).toBeUndefined();
    expect(sanitizeObject(42 as any)).toBe(42);
  });

  it('should truncate deeply nested objects at max depth', () => {
    // Build a 15-level deep object
    let deep: any = { value: 'bottom' };
    for (let i = 0; i < 15; i++) {
      deep = { nested: deep };
    }
    const result = sanitizeObject(deep);
    // Should not throw, and deep nesting should be truncated
    let cursor = result;
    let depth = 0;
    while (cursor && cursor.nested) {
      cursor = cursor.nested;
      depth++;
    }
    expect(depth).toBeLessThanOrEqual(10);
  });
});
