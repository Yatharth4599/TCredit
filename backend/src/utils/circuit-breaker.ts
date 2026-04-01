/**
 * Circuit Breaker — prevents cascading failures during RPC outages.
 *
 * States:
 *   CLOSED  → normal operation, requests pass through
 *   OPEN    → requests fail immediately (no RPC call)
 *   HALF_OPEN → allow one probe request to test recovery
 *
 * After `threshold` consecutive failures, the breaker opens for `resetMs`.
 * Then it transitions to half-open. If the probe succeeds, back to closed.
 * If it fails, back to open for another `resetMs`.
 */

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerOptions {
  /** Failures before opening (default 5) */
  threshold?: number;
  /** How long to stay open before half-open probe (default 60_000ms) */
  resetMs?: number;
  /** Called on state transitions */
  onStateChange?: (from: CircuitState, to: CircuitState, label: string) => void;
  /** Label for logging */
  label?: string;
}

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private lastFailureAt = 0;
  /** Guards half-open state so only one probe request runs at a time. */
  private probeInFlight = false;
  private readonly threshold: number;
  private readonly resetMs: number;
  private readonly onStateChange?: CircuitBreakerOptions['onStateChange'];
  readonly label: string;

  constructor(opts: CircuitBreakerOptions = {}) {
    this.threshold = opts.threshold ?? 5;
    this.resetMs = opts.resetMs ?? 60_000;
    this.onStateChange = opts.onStateChange;
    this.label = opts.label ?? 'default';
  }

  /** Execute fn through the circuit breaker. */
  async exec<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      // Check if enough time has passed to try half-open
      if (Date.now() - this.lastFailureAt >= this.resetMs) {
        this.transition('half_open');
      } else {
        throw new CircuitOpenError(this.label, this.resetMs - (Date.now() - this.lastFailureAt));
      }
    }

    // In half-open state, only allow one probe request at a time.
    // Concurrent callers get a circuit-open error instead of all hammering
    // the recovering service simultaneously.
    if (this.state === 'half_open') {
      if (this.probeInFlight) {
        throw new CircuitOpenError(this.label, this.resetMs);
      }
      this.probeInFlight = true;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    } finally {
      this.probeInFlight = false;
    }
  }

  private onSuccess(): void {
    if (this.state === 'half_open' || this.failures > 0) {
      this.failures = 0;
      if (this.state !== 'closed') this.transition('closed');
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureAt = Date.now();

    if (this.state === 'half_open') {
      // Probe failed — go back to open
      this.transition('open');
    } else if (this.failures >= this.threshold) {
      this.transition('open');
    }
  }

  private transition(to: CircuitState): void {
    const from = this.state;
    if (from === to) return;
    this.state = to;
    this.onStateChange?.(from, to, this.label);
  }

  /** Get current breaker status. */
  getStatus(): { state: CircuitState; failures: number; lastFailureAt: number } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureAt: this.lastFailureAt,
    };
  }
}

export class CircuitOpenError extends Error {
  readonly retryAfterMs: number;
  constructor(label: string, retryAfterMs: number) {
    super(`Circuit breaker [${label}] is open — retry after ${Math.ceil(retryAfterMs / 1000)}s`);
    this.name = 'CircuitOpenError';
    this.retryAfterMs = retryAfterMs;
  }
}
