import styles from './Vaults.module.css'

export default function Vaults() {
    return (
        <div className={styles.vaults}>
            <div className="container">
                <h1 className="animate-fade-in">Active Vaults</h1>
                <p className={`${styles.subtitle} animate-slide-up delay-100`}>
                    Browse and invest in merchant funding vaults
                </p>
                <div className={`${styles.grid} animate-slide-up delay-200`}>
                    {/* Vault cards will go here */}
                    <div className={styles.placeholder}>
                        Vault cards coming soon...
                    </div>
                </div>
            </div>
        </div>
    )
}
