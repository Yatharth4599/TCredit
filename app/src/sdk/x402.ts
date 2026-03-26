/**
 * x402 Payment SDK — client-side wrapper for HTTP 402 payment flow.
 *
 * Usage:
 *   import { X402Client } from './x402';
 *   const x402 = new X402Client({ apiUrl: 'https://api.krexa.xyz/api/v1' });
 *   const result = await x402.pay({ url: 'https://agent.example/api/data', agent: 'AgntVx9d...' });
 */

export interface X402ClientConfig {
  /** Base API URL (e.g. 'https://api.krexa.xyz/api/v1') */
  apiUrl: string;
  /** Optional API key for authenticated requests */
  apiKey?: string;
}

export interface X402PayParams {
  /** The x402-protected resource URL to pay for */
  url: string;
  /** The agent public key (base58) making the payment */
  agent: string;
  /** Optional max price in USDC (6 decimals). Rejects if resource costs more. */
  maxPriceUsdc?: number;
}

export interface X402PayResult {
  /** Whether payment was successful */
  success: boolean;
  /** The resource response body (if payment succeeded) */
  data?: unknown;
  /** Payment transaction signature (if on-chain) */
  txSignature?: string;
  /** Amount paid in USDC base units */
  amountPaid?: string;
  /** Error message (if failed) */
  error?: string;
}

export interface X402Resource {
  /** Resource URL hash (storage key) */
  key: string;
  /** Resource owner public key */
  owner: string;
  /** Price per call in USDC base units */
  pricePerCall: string;
  /** Whether the resource is active */
  active: boolean;
}

export class X402Client {
  private readonly apiUrl: string;
  private readonly headers: Record<string, string>;

  constructor(config: X402ClientConfig) {
    this.apiUrl = config.apiUrl.replace(/\/$/, '');
    this.headers = { 'Content-Type': 'application/json' };
    if (config.apiKey) {
      this.headers['X-API-Key'] = config.apiKey;
    }
  }

  /**
   * Pay for an x402-protected resource.
   *
   * Flow:
   * 1. Fetches resource pricing via GET /x402/resource-key/{hash}/{agent}
   * 2. Verifies price is within maxPriceUsdc (if set)
   * 3. Calls POST /x402/verify to process payment
   * 4. Returns result with paid amount and response data
   */
  async pay(params: X402PayParams): Promise<X402PayResult> {
    try {
      // Step 1: Get resource info to verify pricing
      const resourceHash = await this.hashUrl(params.url);
      const resourceRes = await fetch(
        `${this.apiUrl}/x402/resource-key/${resourceHash}/${params.agent}`,
        { headers: this.headers },
      );

      if (!resourceRes.ok) {
        return {
          success: false,
          error: `Resource not found or not registered for x402 (HTTP ${resourceRes.status})`,
        };
      }

      const resource: X402Resource = await resourceRes.json();

      // Step 2: Check max price guard
      if (params.maxPriceUsdc !== undefined) {
        const priceUsdc = Number(resource.pricePerCall) / 1_000_000;
        if (priceUsdc > params.maxPriceUsdc) {
          return {
            success: false,
            error: `Resource costs ${priceUsdc} USDC, exceeds max ${params.maxPriceUsdc} USDC`,
          };
        }
      }

      // Step 3: Verify/process payment
      const verifyRes = await fetch(`${this.apiUrl}/x402/verify`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          url: params.url,
          agent: params.agent,
        }),
      });

      if (!verifyRes.ok) {
        const errBody = await verifyRes.json().catch(() => ({}));
        return {
          success: false,
          error: (errBody as Record<string, string>).error ?? `Payment verification failed (HTTP ${verifyRes.status})`,
        };
      }

      const verifyData = await verifyRes.json();

      return {
        success: true,
        data: (verifyData as Record<string, unknown>).data,
        txSignature: (verifyData as Record<string, string>).txSignature,
        amountPaid: resource.pricePerCall,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error during x402 payment',
      };
    }
  }

  /**
   * Look up an x402 resource by its storage key.
   */
  async getResource(key: string): Promise<X402Resource | null> {
    const res = await fetch(`${this.apiUrl}/x402/resource/${key}`, {
      headers: this.headers,
    });
    if (!res.ok) return null;
    return res.json();
  }

  /**
   * Hash a URL to derive the x402 resource key.
   * Uses SHA-256, matching the on-chain derivation.
   */
  private async hashUrl(url: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(url);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}
