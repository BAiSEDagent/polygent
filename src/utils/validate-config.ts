/**
 * Validate and clamp agent config overrides to sane bounds.
 * Prevents agents from disabling risk controls via config injection.
 */

import { AgentConfig } from './types';

interface ConfigBounds {
  min: number;
  max: number;
}

const CONFIG_BOUNDS: Record<keyof AgentConfig, ConfigBounds> = {
  maxPositionPct:    { min: 0.01, max: 0.50 },   // 1% - 50% of portfolio per position
  maxDrawdownPct:    { min: 0.05, max: 0.50 },   // 5% - 50% drawdown breaker
  maxOrderSize:      { min: 1,    max: 100_000 }, // $1 - $100K per order
  dailyLossLimitPct: { min: 0.01, max: 0.30 },   // 1% - 30% daily loss limit
  maxExposure:       { min: 0.10, max: 2.0 },     // 10% - 200% of equity
  minDiversification:{ min: 1,    max: 20 },      // 1 - 20 markets
};

/**
 * Validate and clamp partial config overrides.
 * Returns only valid, clamped values. Rejects non-numeric or out-of-range values.
 */
export function validateConfigOverrides(
  overrides: Partial<AgentConfig> | undefined
): Partial<AgentConfig> {
  if (!overrides || typeof overrides !== 'object') return {};

  const result: Partial<AgentConfig> = {};

  for (const [key, bounds] of Object.entries(CONFIG_BOUNDS)) {
    const k = key as keyof AgentConfig;
    if (k in overrides) {
      const val = overrides[k];
      if (typeof val !== 'number' || !isFinite(val)) continue; // Skip non-numeric
      result[k] = Math.max(bounds.min, Math.min(bounds.max, val));
    }
  }

  return result;
}
