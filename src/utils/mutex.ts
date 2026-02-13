/**
 * Shared async mutex for per-agent order flow protection.
 * Used by both orders.ts (API orders) and paper-trader.ts (internal signals).
 */

export class AsyncMutex {
  private _queue: Array<() => void> = [];
  private _locked = false;

  async acquire(): Promise<void> {
    if (!this._locked) {
      this._locked = true;
      return;
    }

    return new Promise(resolve => {
      this._queue.push(resolve);
    });
  }

  release(): void {
    if (this._queue.length > 0) {
      const next = this._queue.shift()!;
      next();
    } else {
      this._locked = false;
    }
  }
}

const agentMutexes = new Map<string, AsyncMutex>();

export function getAgentMutex(agentId: string): AsyncMutex {
  if (!agentMutexes.has(agentId)) {
    agentMutexes.set(agentId, new AsyncMutex());
  }
  return agentMutexes.get(agentId)!;
}
