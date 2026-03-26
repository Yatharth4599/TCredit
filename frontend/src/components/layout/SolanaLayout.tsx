import { type ReactNode } from 'react'
import { motion } from 'motion/react'
import { Lamp } from '../ui/Lamp'
import DecryptedText from '../ui/DecryptedText'
import { pageVariants } from '../../utils/motionVariants'
import styles from './SolanaLayout.module.css'

interface SolanaLayoutProps {
  children: ReactNode
  title: string
  subtitle: string
  dataLoaded?: boolean
}

export default function SolanaLayout({ children, title, subtitle, dataLoaded = false }: SolanaLayoutProps) {
  return (
    <motion.div
      className={styles.page}
      variants={pageVariants}
      initial="initial"
      animate="animate"
    >
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.lampWrap}>
          <Lamp active={dataLoaded} />
        </div>
        <div className={styles.titleWrap}>
          <h1 className={styles.title}>
            <DecryptedText
              text={title}
              animateOn="view"
              sequential
              speed={30}
              revealDirection="start"
            />
          </h1>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>
      </div>

      {/* Main content */}
      <div className={styles.content}>
        {children}
      </div>

      {/* Aurora bottom glow */}
      <div className={styles.aurora} />
    </motion.div>
  )
}
