import { useState, type ReactNode, type CSSProperties } from 'react'
import styles from './Folder.module.css'

interface FolderProps {
  color?: string
  size?: number
  items?: ReactNode[]
  label?: string
  className?: string
}

function darkenColor(hex: string, percent: number): string {
  let c = hex.startsWith('#') ? hex.slice(1) : hex
  if (c.length === 3) c = c.split('').map(ch => ch + ch).join('')
  const num = parseInt(c, 16)
  const r = Math.max(0, Math.min(255, Math.floor(((num >> 16) & 0xff) * (1 - percent))))
  const g = Math.max(0, Math.min(255, Math.floor(((num >> 8) & 0xff) * (1 - percent))))
  const b = Math.max(0, Math.min(255, Math.floor((num & 0xff) * (1 - percent))))
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
}

export default function Folder({ color = '#3B82F6', size = 1, items = [], label, className = '' }: FolderProps) {
  const maxItems = 3
  const papers = items.slice(0, maxItems)
  while (papers.length < maxItems) papers.push(null)

  const [open, setOpen] = useState(false)
  const [offsets, setOffsets] = useState(
    Array.from({ length: maxItems }, () => ({ x: 0, y: 0 }))
  )

  const handlePaperMove = (e: React.MouseEvent<HTMLDivElement>, i: number) => {
    if (!open) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ox = (e.clientX - rect.left - rect.width / 2) * 0.12
    const oy = (e.clientY - rect.top - rect.height / 2) * 0.12
    setOffsets(prev => { const n = [...prev]; n[i] = { x: ox, y: oy }; return n })
  }

  const handlePaperLeave = (_e: React.MouseEvent<HTMLDivElement>, i: number) => {
    setOffsets(prev => { const n = [...prev]; n[i] = { x: 0, y: 0 }; return n })
  }

  const folderStyle = {
    '--folder-color': color,
    '--folder-back-color': darkenColor(color, 0.1),
    '--paper-1': 'rgba(255,255,255,0.06)',
    '--paper-2': 'rgba(255,255,255,0.08)',
    '--paper-3': 'rgba(255,255,255,0.1)',
  } as CSSProperties

  return (
    <div style={{ transform: `scale(${size})` }} className={className}>
      <div
        className={`${styles.folder} ${open ? styles.open : ''}`}
        style={folderStyle}
        onClick={() => setOpen(prev => !prev)}
      >
        <div className={styles.folderBack}>
          {papers.map((item, i) => (
            <div
              key={i}
              className={`${styles.paper} ${styles[`paper${i + 1}`]}`}
              onMouseMove={e => handlePaperMove(e, i)}
              onMouseLeave={e => handlePaperLeave(e, i)}
              style={open ? {
                '--magnet-x': `${offsets[i]?.x || 0}px`,
                '--magnet-y': `${offsets[i]?.y || 0}px`,
              } as CSSProperties : {}}
            >
              {item}
            </div>
          ))}
          <div className={styles.folderFront} />
          <div className={`${styles.folderFront} ${styles.right}`} />
        </div>
        {label && <span className={styles.folderLabel}>{label}</span>}
      </div>
    </div>
  )
}
