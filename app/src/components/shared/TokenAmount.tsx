import { formatUsdc } from '../../lib/utils'

interface TokenAmountProps {
  amount: number | bigint | { toNumber(): number }
  symbol?: string
  className?: string
}

export function TokenAmount({ amount, symbol = 'USDC', className }: TokenAmountProps) {
  return (
    <span className={className}>
      {formatUsdc(amount)} <span className="text-white/40">{symbol}</span>
    </span>
  )
}
