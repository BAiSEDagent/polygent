/**
 * Sanitize objects to prevent prototype pollution attacks.
 * Strips __proto__, constructor, and prototype keys recursively.
 */

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => 
      typeof item === 'object' && item !== null ? sanitizeObject(item) : item
    ) as unknown as T;
  }

  const result: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    if (DANGEROUS_KEYS.has(key)) continue;
    const value = obj[key];
    result[key] = typeof value === 'object' && value !== null ? sanitizeObject(value) : value;
  }
  return result as T;
}
