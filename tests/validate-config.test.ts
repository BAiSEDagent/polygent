import { validateConfigOverrides } from '../src/utils/validate-config';

describe('validateConfigOverrides', () => {
  it('should return empty object for undefined input', () => {
    expect(validateConfigOverrides(undefined)).toEqual({});
  });

  it('should return empty object for null input', () => {
    expect(validateConfigOverrides(null as any)).toEqual({});
  });

  it('should pass through valid values within bounds', () => {
    const result = validateConfigOverrides({
      maxPositionPct: 0.25,
      maxOrderSize: 5000,
    });
    expect(result.maxPositionPct).toBe(0.25);
    expect(result.maxOrderSize).toBe(5000);
  });

  it('should clamp values above maximum', () => {
    const result = validateConfigOverrides({
      maxPositionPct: 0.99, // max 0.50
      maxOrderSize: 999_999, // max 100_000
      maxExposure: 10.0, // max 2.0
    });
    expect(result.maxPositionPct).toBe(0.50);
    expect(result.maxOrderSize).toBe(100_000);
    expect(result.maxExposure).toBe(2.0);
  });

  it('should clamp values below minimum', () => {
    const result = validateConfigOverrides({
      maxPositionPct: 0.001, // min 0.01
      maxDrawdownPct: 0.001, // min 0.05
      dailyLossLimitPct: 0, // min 0.01
    });
    expect(result.maxPositionPct).toBe(0.01);
    expect(result.maxDrawdownPct).toBe(0.05);
    expect(result.dailyLossLimitPct).toBe(0.01);
  });

  it('should reject non-numeric values', () => {
    const result = validateConfigOverrides({
      maxPositionPct: 'infinity' as any,
      maxOrderSize: NaN,
      maxExposure: Infinity,
    });
    expect(result).toEqual({});
  });

  it('should reject Infinity', () => {
    const result = validateConfigOverrides({
      maxOrderSize: Infinity,
    });
    expect(result.maxOrderSize).toBeUndefined();
  });

  it('should ignore unknown keys', () => {
    const result = validateConfigOverrides({
      maxPositionPct: 0.20,
      hackTheSystem: true,
    } as any);
    expect(result).toEqual({ maxPositionPct: 0.20 });
    expect((result as any).hackTheSystem).toBeUndefined();
  });
});
