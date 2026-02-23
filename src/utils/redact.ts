const SENSITIVE_KEY_RE = /(secret|passphrase|signature|api[_-]?key|authorization|token|private|pk|seed|mnemonic)/i;

function redactValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(redactValue);

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY_RE.test(k) ? '***REDACTED***' : redactValue(v);
    }
    return out;
  }

  if (typeof value === 'string') {
    return value
      .replace(/0x[a-fA-F0-9]{64}\b/g, '0x***REDACTED***')
      .replace(/(POLY_[A-Z_]+|CLOB_[A-Z_]+|X-API-Key|X-Admin-Key|Authorization|authorization|api[_-]?key|passphrase|secret|signature|token|private[_-]?key|pk)\s*[:=]\s*"?[^",\s}]+"?/gi, '$1:***REDACTED***');
  }

  return value;
}

export function redactForLog(...args: unknown[]): unknown[] {
  return args.map((arg) => redactValue(arg));
}

export function installConsoleRedaction(): void {
  const methods: Array<'error' | 'warn' | 'log' | 'info' | 'debug'> = ['error', 'warn', 'log', 'info', 'debug'];

  for (const method of methods) {
    const original = console[method].bind(console);
    console[method] = (...args: unknown[]) => {
      const safe = redactForLog(...args);
      original(...safe);
    };
  }
}
