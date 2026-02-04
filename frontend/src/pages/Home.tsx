import { useNavigate } from 'react-router-dom'
import styles from './Home.module.css'

export default function Home() {
    const navigate = useNavigate()

    const scrollToFeatures = () => {
        const featuresSection = document.getElementById('features')
        if (featuresSection) {
            featuresSection.scrollIntoView({ behavior: 'smooth' })
        }
    }

    return (
        <div className={styles.home}>
            <div className="container">
                <section className={styles.hero}>
                    <h1 className="animate-fade-in">
                        Decentralized Lending
                        <br />
                        <span className={styles.gradient}>on Solana</span>
                    </h1>
                    <p className="animate-slide-up delay-200">
                        Uncollateralized lending powered by on-chain credit scores.
                        <br />
                        Fast, transparent, and built for the future of finance.
                    </p>
                    <div className={`${styles.cta} animate-slide-up delay-300`}>
                        <button
                            className={styles.primaryButton}
                            onClick={() => navigate('/vaults')}
                        >
                            Browse Vaults
                        </button>
                        <button
                            className={styles.secondaryButton}
                            onClick={scrollToFeatures}
                        >
                            Learn More
                        </button>
                    </div>
                </section>

                <section id="features" className={styles.features}>
                    <h2 className="animate-fade-in">Why TigerPay?</h2>
                    <div className={styles.featureGrid}>
                        <div className={`${styles.featureCard} animate-slide-up delay-100`}>
                            <h3>Lightning Fast</h3>
                            <p>400ms finality on Solana. Instant settlements, no waiting.</p>
                        </div>
                        <div className={`${styles.featureCard} animate-slide-up delay-200`}>
                            <h3>Uncollateralized</h3>
                            <p>Credit scoring via FairScale. No collateral required.</p>
                        </div>
                        <div className={`${styles.featureCard} animate-slide-up delay-300`}>
                            <h3>Low Fees</h3>
                            <p>$0.00025 per transaction vs 2.9% on traditional platforms.</p>
                        </div>
                        <div className={`${styles.featureCard} animate-slide-up delay-400`}>
                            <h3>Transparent</h3>
                            <p>All transactions on-chain. Full audit trail.</p>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    )
}
