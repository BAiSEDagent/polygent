/**
 * Sanitize objects to prevent prototype pollution attacks.
 * Strips __proto__, constructor, and prototype keys recursively.
 * Enforces max depth to prevent stack overflow on deeply nested payloads.
 */

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_DEPTH = 10;

export function sanitizeObject<T extends Record<string, any>>(obj: T, depth: number = 0): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  if (depth >= MAX_DEPTH) {
    return (Array.isArray(obj) ? [] : {}) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => 
      typeof item === 'object' && item !== null ? sanitizeObject(item, depth + 1) : item
    ) as unknown as T;
  }

  const result: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    if (DANGEROUS_KEYS.has(key)) continue;
    const value = obj[key];
    result[key] = typeof value === 'object' && value !== null ? sanitizeObject(value, depth + 1) : value;
  }
  return result as T;
}
