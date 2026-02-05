import styles from './Lamp.module.css'

interface LampProps {
    children?: React.ReactNode
    active?: boolean
}

export function Lamp({ children, active = false }: LampProps) {
    return (
        <div className={`${styles.lampContainer} ${active ? styles.lampActive : ''}`}>
            <div className={styles.lampWrapper}>
                <div className={styles.lamp}>
                    <div className={styles.lampGlow} />
                    <div className={styles.lampBeamLeft} />
                    <div className={styles.lampBeamRight} />
                    <div className={styles.lampCore} />
                    <div className={styles.lampLine} />
                </div>
            </div>
            <div className={styles.spotlight} />
            <div className={styles.lampContent}>
                {children}
            </div>
        </div>
    )
}
