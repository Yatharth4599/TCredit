/**
 * Retry with exponential backoff + jitter.
 *
 * Used by keeper, indexer, oracle, and faucet for RPC calls and
 * on-chain transaction submissions.
 */

export interface RetryOptions {
  /** Maximum number of attempts (default 4) */
  maxAttempts?: number;
  /** Base delay in ms (default 1000) */
  baseMs?: number;
  /** Maximum delay in ms (default 30_000) */
  maxMs?: number;
  /** Jitter factor 0-1 (default 0.2) */
  jitter?: number;
  /** Optional label for logging */
  label?: string;
  /** Called on each retry with attempt number and error */
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

/**
 * Execute `fn` with retries. Throws the last error if all attempts fail.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 4,
    baseMs = 1_000,
    maxMs = 30_000,
    jitter = 0.2,
    onRetry,
  } = opts;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt >= maxAttempts) break;

      // Exponential backoff: base * 2^(attempt-1) + random jitter
      const exponential = Math.min(baseMs * 2 ** (attempt - 1), maxMs);
      const jitterMs = exponential * jitter * Math.random();
      const delayMs = Math.round(exponential + jitterMs);

      onRetry?.(attempt, lastError, delayMs);

      await sleep(delayMs);
    }
  }

  throw lastError!;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
