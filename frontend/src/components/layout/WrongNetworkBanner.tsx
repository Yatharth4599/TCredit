import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'
import styles from './WrongNetworkBanner.module.css'

export default function WrongNetworkBanner() {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain, isPending } = useSwitchChain()

  if (!isConnected || chainId === baseSepolia.id) return null

  return (
    <div className={styles.banner} role="alert">
      <span className={styles.icon}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </span>
      <span className={styles.text}>
        Wrong network — Krexa runs on <strong>Base Sepolia</strong>.
      </span>
      <button
        className={styles.switchBtn}
        onClick={() => switchChain({ chainId: baseSepolia.id })}
        disabled={isPending}
      >
        {isPending ? 'Switching…' : 'Switch Network'}
      </button>
    </div>
  )
}
