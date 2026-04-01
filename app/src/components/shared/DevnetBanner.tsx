export function DevnetBanner() {
  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 text-center">
      <span className="text-xs text-amber-400 font-medium">
        Solana Devnet
      </span>
      <span className="text-xs text-amber-400/60 ml-2">
        Transactions use test tokens only
      </span>
    </div>
  )
}
