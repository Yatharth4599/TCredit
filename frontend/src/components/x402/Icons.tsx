import type { CSSProperties } from 'react'

interface IconProps {
  size?: number
  color?: string
  style?: CSSProperties
  className?: string
}

const p = (d: string, props: IconProps) => {
  const { size = 20, color = 'currentColor', style, className } = props
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={style} className={className}>
      <path d={d} />
    </svg>
  )
}

// Agent avatars
export function TranslateIcon(props: IconProps) {
  return (
    <svg width={props.size ?? 20} height={props.size ?? 20} viewBox="0 0 24 24" fill="none" stroke={props.color ?? 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={props.style} className={props.className}>
      <path d="M5 8l6 6" /><path d="M4 14l6-6 2-3" /><path d="M2 5h12" /><path d="M7 2h1" />
      <path d="M22 22l-5-10-5 10" /><path d="M14 18h6" />
    </svg>
  )
}

export function ShopIcon(props: IconProps) {
  return (
    <svg width={props.size ?? 20} height={props.size ?? 20} viewBox="0 0 24 24" fill="none" stroke={props.color ?? 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={props.style} className={props.className}>
      <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
    </svg>
  )
}

export function DataIcon(props: IconProps) {
  return (
    <svg width={props.size ?? 20} height={props.size ?? 20} viewBox="0 0 24 24" fill="none" stroke={props.color ?? 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={props.style} className={props.className}>
      <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
    </svg>
  )
}

export function CodeIcon(props: IconProps) {
  return (
    <svg width={props.size ?? 20} height={props.size ?? 20} viewBox="0 0 24 24" fill="none" stroke={props.color ?? 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={props.style} className={props.className}>
      <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
    </svg>
  )
}

// Protocol icons
export function BotIcon(props: IconProps) {
  return (
    <svg width={props.size ?? 20} height={props.size ?? 20} viewBox="0 0 24 24" fill="none" stroke={props.color ?? 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={props.style} className={props.className}>
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" /><path d="M12 7v4" />
      <line x1="8" y1="16" x2="8" y2="16" /><line x1="16" y1="16" x2="16" y2="16" />
    </svg>
  )
}

export function VaultIcon(props: IconProps) {
  return (
    <svg width={props.size ?? 20} height={props.size ?? 20} viewBox="0 0 24 24" fill="none" stroke={props.color ?? 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={props.style} className={props.className}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <circle cx="12" cy="12" r="4" /><path d="M12 8v8" /><path d="M8 12h8" />
    </svg>
  )
}

export function CoinsIcon(props: IconProps) {
  return (
    <svg width={props.size ?? 20} height={props.size ?? 20} viewBox="0 0 24 24" fill="none" stroke={props.color ?? 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={props.style} className={props.className}>
      <circle cx="8" cy="8" r="6" /><path d="M18.09 10.37A6 6 0 1110.34 18" />
      <path d="M7 6h2v4" /><path d="M15 12h2v4" />
    </svg>
  )
}

export function SendIcon(props: IconProps) {
  return (
    <svg width={props.size ?? 20} height={props.size ?? 20} viewBox="0 0 24 24" fill="none" stroke={props.color ?? 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={props.style} className={props.className}>
      <path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4z" />
    </svg>
  )
}

export function BoltIcon(props: IconProps) {
  return p("M13 2L3 14h9l-1 8 10-12h-9l1-8z", props)
}

export function WaveIcon(props: IconProps) {
  return (
    <svg width={props.size ?? 20} height={props.size ?? 20} viewBox="0 0 24 24" fill="none" stroke={props.color ?? 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={props.style} className={props.className}>
      <path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
      <path d="M2 6c2-3 4-3 6 0s4 3 6 0 4-3 6 0" opacity="0.4" />
      <path d="M2 18c2-3 4-3 6 0s4 3 6 0 4-3 6 0" opacity="0.4" />
    </svg>
  )
}

export function CheckCircleIcon(props: IconProps) {
  return (
    <svg width={props.size ?? 20} height={props.size ?? 20} viewBox="0 0 24 24" fill="none" stroke={props.color ?? 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={props.style} className={props.className}>
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg width={props.size ?? 20} height={props.size ?? 20} viewBox="0 0 24 24" fill="none" stroke={props.color ?? 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={props.style} className={props.className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

export function UsersIcon(props: IconProps) {
  return (
    <svg width={props.size ?? 20} height={props.size ?? 20} viewBox="0 0 24 24" fill="none" stroke={props.color ?? 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={props.style} className={props.className}>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  )
}

export function SearchIcon(props: IconProps) {
  return (
    <svg width={props.size ?? 20} height={props.size ?? 20} viewBox="0 0 24 24" fill="none" stroke={props.color ?? 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={props.style} className={props.className}>
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  )
}

export function LayersIcon(props: IconProps) {
  return (
    <svg width={props.size ?? 20} height={props.size ?? 20} viewBox="0 0 24 24" fill="none" stroke={props.color ?? 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={props.style} className={props.className}>
      <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m22.39 12.19-8.56 3.9a2 2 0 0 1-1.66 0l-8.56-3.9" />
      <path d="m22.39 16.19-8.56 3.9a2 2 0 0 1-1.66 0l-8.56-3.9" />
    </svg>
  )
}

export function BankIcon(props: IconProps) {
  return (
    <svg width={props.size ?? 20} height={props.size ?? 20} viewBox="0 0 24 24" fill="none" stroke={props.color ?? 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={props.style} className={props.className}>
      <path d="M3 21h18" /><path d="M3 10h18" /><path d="M12 2l9 8H3z" />
      <path d="M5 10v11" /><path d="M19 10v11" /><path d="M9 10v11" /><path d="M15 10v11" />
    </svg>
  )
}

// Map avatar string keys to components
const AVATAR_MAP: Record<string, (props: IconProps) => JSX.Element> = {
  translate: TranslateIcon,
  shop: ShopIcon,
  data: DataIcon,
  code: CodeIcon,
}

export function AgentAvatar({ avatarKey, ...props }: IconProps & { avatarKey: string }) {
  const Icon = AVATAR_MAP[avatarKey] ?? BotIcon
  return <Icon {...props} />
}
