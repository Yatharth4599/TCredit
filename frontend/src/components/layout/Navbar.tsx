import { useNavigate, useLocation } from 'react-router-dom'
import styles from './Navbar.module.css'

export default function Navbar() {
    const navigate = useNavigate()
    const location = useLocation()

    const navLinks = [
        { name: 'Home', path: '/' },
        { name: 'Vaults', path: '/vaults' },
        { name: 'Pools', path: '/pools' },
        { name: 'Portfolio', path: '/portfolio' },
        { name: 'Merchant', path: '/merchant' },
    ]

    return (
        <nav className={styles.navbar}>
            <div className={`container ${styles.container}`}>
                <div className={styles.logo} onClick={() => navigate('/')}>
                    TigerPay<span className={styles.x}>X</span>
                </div>

                <div className={styles.links}>
                    {navLinks.map((link) => (
                        <button
                            key={link.path}
                            className={`${styles.link} ${location.pathname === link.path ? styles.active : ''
                                }`}
                            onClick={() => navigate(link.path)}
                        >
                            {link.name}
                        </button>
                    ))}
                </div>

                <button className={styles.walletButton}>
                    Connect Wallet
                </button>
            </div>
        </nav>
    )
}
