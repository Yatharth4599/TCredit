import type { X402ClientConfig, X402PaymentRequirements, X402FetchOptions } from './types.js';

/**
 * Creates a fetch wrapper that auto-detects HTTP 402 responses,
 * pays via Krexa, and retries the request with payment proof.
 */
export function createX402Client(config: X402ClientConfig) {
  /**
   * Fetch with automatic x402 payment handling.
   * On 402 response, pays the required amount and retries.
   */
  async function x402Fetch(url: string, opts?: X402FetchOptions): Promise<Response> {
    const response = await fetch(url, opts);

    if (response.status !== 402 || opts?.skipAutoPayment) {
      return response;
    }

    // Parse payment requirements
    const requirements: X402PaymentRequirements = await response.json();
    if (!requirements.accepts || requirements.accepts.length === 0) {
      throw new Error('No payment options in 402 response');
    }

    const paymentOption = requirements.accepts[0];

    // Execute payment via Krexa API
    const payRes = await fetch(`${config.kresxaApiUrl}/oracle/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: config.payerAddress,
        to: paymentOption.merchantAddress,
        amount: paymentOption.amount,
      }),
    });

    if (!payRes.ok) {
      const err = await payRes.text();
      throw new Error(`x402 payment failed: ${err}`);
    }

    const payResult = await payRes.json() as { txHash: string; paymentId: string };

    // Retry with payment proof
    const retryHeaders = new Headers(opts?.headers);
    retryHeaders.set('X-402-Payment', JSON.stringify({
      txHash: payResult.txHash,
      resourceHash: paymentOption.resourceHash,
      payer: config.payerAddress,
    }));

    return fetch(url, {
      ...opts,
      headers: retryHeaders,
    });
  }

  return { fetch: x402Fetch };
}
