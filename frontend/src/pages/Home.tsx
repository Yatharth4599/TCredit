import styles from './Home.module.css'

export default function Home() {
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
                        <button className={styles.primaryButton}>
                            Browse Vaults
                        </button>
                        <button className={styles.secondaryButton}>
                            Learn More
                        </button>
                    </div>
                </section>
            </div>
        </div>
    )
}
