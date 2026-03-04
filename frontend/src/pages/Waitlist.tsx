import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { truncateAddress } from '../lib/format'
import { waitlistApi } from '../api/client'
import styles from './Waitlist.module.css'

export default function Waitlist() {
    const [email, setEmail] = useState('')
    const [submitted, setSubmitted] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const { address, isConnected } = useAccount()
    const { openConnectModal } = useConnectModal()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email.trim()) return

        setLoading(true)
        setError('')

        try {
            await waitlistApi.join(email.trim(), isConnected ? address : undefined)
            setSubmitted(true)
        } catch (err: any) {
            const msg = err.response?.data?.error || 'Something went wrong. Please try again.'
            setError(msg)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className={styles.page}>
            <div className={styles.content}>
                <div className={styles.brand}>
                    <img src="/images/tiger-logo.png" alt="TCredit" className={styles.logoImg} />
                    <span className={styles.logoText}>TCredit</span>
                </div>

                <h1 className={styles.headline}>
                    The future of <span className={styles.headlineAccent}>on-chain credit.</span>
                </h1>
                <p className={styles.subtitle}>
                    Revenue-backed, programmable lending on Base. Join the waitlist to get early access.
                </p>

                {isConnected ? (
                    <div className={styles.walletSection}>
                        <span className={styles.walletConnected}>
                            <span className={styles.walletDot} />
                            {truncateAddress(address!, 6)}
                        </span>
                    </div>
                ) : (
                    <div className={styles.walletSection}>
                        <button
                            className={styles.submitBtn}
                            onClick={() => openConnectModal?.()}
                            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', marginBottom: 0 }}
                        >
                            Connect Wallet (optional)
                        </button>
                    </div>
                )}

                {submitted ? (
                    <div className={styles.successMessage}>
                        You're on the list. We'll be in touch soon.
                    </div>
                ) : (
                    <>
                        {error && <p className={styles.errorMessage}>{error}</p>}
                        <form className={styles.form} onSubmit={handleSubmit}>
                            <input
                                type="email"
                                className={styles.emailInput}
                                placeholder="Enter your email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                            <button
                                type="submit"
                                className={styles.submitBtn}
                                disabled={loading || !email.trim()}
                            >
                                {loading ? 'Joining...' : 'Join Waitlist'}
                            </button>
                        </form>
                    </>
                )}

                <div className={styles.socials}>
                    <a href="https://x.com/tigerbnkHQ" target="_blank" rel="noopener" aria-label="Twitter">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                    </a>
                    <a href="https://github.com/Yatharth4599/TCredit" target="_blank" rel="noopener" aria-label="GitHub">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
                    </a>
                </div>

                <Link to="/" className={styles.backLink}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Back to home
                </Link>
            </div>
        </div>
    )
}
