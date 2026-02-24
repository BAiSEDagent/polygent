/**
 * Sanitize objects to prevent prototype pollution attacks.
 * Strips __proto__, constructor, and prototype keys recursively.
 * Enforces max depth to prevent stack overflow on deeply nested payloads.
 */

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_DEPTH = 10;

/**
 * Safe parseFloat wrapper that validates output.
 * Returns fallback value if input is invalid or results in NaN/Infinity.
 * 
 * SECURITY: Prevents NaN injection attacks in price/quantity calculations.
 * @param val - String value to parse
 * @param fallback - Safe default to return on parse failure
 * @returns Validated float or fallback
 */
export function safeParseFloat(val: string | number | any, fallback: number): number {
  if (typeof val === 'number') {
    return isFinite(val) && !isNaN(val) ? val : fallback;
  }
  if (typeof val !== 'string') return fallback;
  
  const parsed = parseFloat(val);
  return isFinite(parsed) && !isNaN(parsed) ? parsed : fallback;
}

/**
 * Safe parseInt wrapper with radix enforcement.
 * Always uses base 10 to prevent octal/hex confusion.
 * 
 * @param val - String value to parse
 * @param fallback - Safe default to return on parse failure
 * @returns Validated integer or fallback
 */
export function safeParseInt(val: string | number | any, fallback: number): number {
  if (typeof val === 'number') {
    const int = Math.floor(val);
    return isFinite(int) && !isNaN(int) ? int : fallback;
  }
  if (typeof val !== 'string') return fallback;
  
  const parsed = parseInt(val, 10);
  return isFinite(parsed) && !isNaN(parsed) ? parsed : fallback;
}

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
