import { useState, useEffect, useCallback, useRef } from 'react'

interface TerminalLine {
  text: string
  type: 'command' | 'success' | 'info' | 'spinner' | 'blank'
  delay: number // ms before showing this line
}

const LINES: TerminalLine[] = [
  { text: '$ npx krexa init', type: 'command', delay: 0 },
  { text: '', type: 'blank', delay: 800 },
  { text: '  Registering agent on Solana devnet...', type: 'spinner', delay: 200 },
  { text: '  ✓ Keypair created: 7xK2mN9...3pF4', type: 'success', delay: 1200 },
  { text: '  ✓ Agent registered: ResearchBot (Service)', type: 'success', delay: 400 },
  { text: '  ✓ PDA wallet created', type: 'success', delay: 400 },
  { text: '  ✓ Krexit Score: 350 (L1 — Micro)', type: 'success', delay: 400 },
  { text: '', type: 'blank', delay: 200 },
  { text: '  Ready! Borrow up to $500 USDC.', type: 'info', delay: 300 },
  { text: '', type: 'blank', delay: 1000 },
  { text: '$ krexa borrow 500', type: 'command', delay: 0 },
  { text: '', type: 'blank', delay: 600 },
  { text: '  Requesting credit...', type: 'spinner', delay: 200 },
  { text: '  ✓ Oracle approved credit request', type: 'success', delay: 1000 },
  { text: '  ✓ Credit line opened: $500.00 USDC', type: 'success', delay: 400 },
  { text: '', type: 'blank', delay: 200 },
  { text: '  Rate: 36.50% APR · Daily cost: $0.50', type: 'info', delay: 300 },
]

function getLineClass(type: string): string {
  switch (type) {
    case 'command': return 'text-[#22d3ee] font-semibold'
    case 'success': return 'text-[#4ade80]'
    case 'info': return 'text-[#94a3b8]'
    case 'spinner': return 'text-[#64748b]'
    case 'blank': return ''
    default: return 'text-[#e2e8f0]'
  }
}

export default function TerminalAnimation() {
  const [visibleLines, setVisibleLines] = useState<number>(0)
  const [typingIndex, setTypingIndex] = useState<number>(0)
  const [currentTypedText, setCurrentTypedText] = useState<string>('')
  const [isTyping, setIsTyping] = useState<boolean>(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetAnimation = useCallback(() => {
    setVisibleLines(0)
    setTypingIndex(0)
    setCurrentTypedText('')
    setIsTyping(false)
  }, [])

  useEffect(() => {
    if (visibleLines >= LINES.length) {
      // Loop after pause
      timeoutRef.current = setTimeout(resetAnimation, 4000)
      return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
    }

    const line = LINES[visibleLines]

    if (line.type === 'command' && !isTyping) {
      // Start typing animation
      setIsTyping(true)
      setCurrentTypedText('')
      setTypingIndex(0)
      return
    }

    if (isTyping) {
      const text = LINES[visibleLines].text
      if (typingIndex < text.length) {
        timeoutRef.current = setTimeout(() => {
          setCurrentTypedText(text.slice(0, typingIndex + 1))
          setTypingIndex(typingIndex + 1)
        }, 45)
        return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
      } else {
        // Done typing this line
        setIsTyping(false)
        timeoutRef.current = setTimeout(() => {
          setVisibleLines(v => v + 1)
        }, 200)
        return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
      }
    }

    // Non-command lines: show after delay
    timeoutRef.current = setTimeout(() => {
      setVisibleLines(v => v + 1)
    }, line.delay)

    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [visibleLines, typingIndex, isTyping, resetAnimation])

  return (
    <div className="rounded-xl border border-[#1e1e21] bg-[#0a0a0b] overflow-hidden shadow-2xl shadow-black/50">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-3 bg-[#111113] border-b border-[#1e1e21]">
        <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
        <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
        <div className="w-3 h-3 rounded-full bg-[#28c840]" />
        <span className="ml-2 text-xs text-[#64748b] font-mono">krexa — terminal</span>
      </div>

      {/* Terminal content */}
      <div className="p-5 font-mono text-[13px] leading-[1.8] min-h-[340px]">
        {LINES.slice(0, visibleLines).map((line, i) => (
          <div key={i} className={getLineClass(line.type)}>
            {line.type === 'blank' ? '\u00A0' : line.text}
          </div>
        ))}
        {isTyping && (
          <div className={getLineClass('command')}>
            {currentTypedText}
            <span className="animate-pulse">▌</span>
          </div>
        )}
        {visibleLines === 0 && !isTyping && (
          <div className="text-[#64748b]">
            <span className="animate-pulse">▌</span>
          </div>
        )}
      </div>
    </div>
  )
}
