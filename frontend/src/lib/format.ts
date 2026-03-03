import { formatUnits, parseUnits } from 'viem';

const USDC_DECIMALS = 6;

/** Format a wei string (6-decimal USDC) to a display-friendly USD string */
export function formatUSDC(weiString: string | bigint | undefined | null): string {
  if (weiString == null) return '$0';
  const value = typeof weiString === 'string' ? weiString : weiString.toString();
  if (!value || value === '0') return '$0';
  try {
    const num = Number(formatUnits(BigInt(value), USDC_DECIMALS));
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num);
  } catch { return '$0'; }
}

/** Format a wei string to a compact USD string (e.g., $1.2M) */
export function formatUSDCCompact(weiString: string | bigint | undefined | null): string {
  if (weiString == null) return '$0';
  const value = typeof weiString === 'string' ? weiString : weiString.toString();
  if (!value || value === '0') return '$0';
  try {
    const num = Number(formatUnits(BigInt(value), USDC_DECIMALS));
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(num);
  } catch { return '$0'; }
}

/** Convert a human-readable USDC amount (e.g., "100.50") to a wei string */
export function parseUSDCToWei(usdcAmount: string): string {
  return parseUnits(usdcAmount, USDC_DECIMALS).toString();
}

/** Convert a wei string to a plain number (for calculations, charts) */
export function weiToNumber(weiString: string | bigint | undefined | null): number {
  if (weiString == null) return 0;
  const value = typeof weiString === 'string' ? weiString : weiString.toString();
  if (!value || value === '0') return 0;
  try {
    return Number(formatUnits(BigInt(value), USDC_DECIMALS));
  } catch { return 0; }
}

/** Truncate an address to 0x1234...5678 format */
export function truncateAddress(address: string, chars = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/** Format BPS to percentage string (e.g., 1200 -> "12%") */
export function bpsToPercent(bps: number | undefined | null): string {
  if (bps == null) return '0%';
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`;
}

/** Format seconds to a human-readable duration */
export function formatDuration(seconds: number | undefined | null): string {
  if (seconds == null) return '—';
  const days = Math.round(seconds / 86400);
  if (days >= 365) return `${Math.round(days / 365)}y`;
  if (days >= 30) return `${Math.round(days / 30)}mo`;
  return `${days}d`;
}
