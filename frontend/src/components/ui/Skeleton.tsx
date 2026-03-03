import type { CSSProperties } from 'react'
import styles from './Skeleton.module.css'

interface SkeletonProps {
    width?: string | number
    height?: string | number
    borderRadius?: string | number
    className?: string
    style?: CSSProperties
}

export function Skeleton({ width, height = 16, borderRadius = 8, className, style }: SkeletonProps) {
    return (
        <div
            className={`${styles.skeleton} ${className ?? ''}`}
            style={{ width, height, borderRadius, ...style }}
        />
    )
}
