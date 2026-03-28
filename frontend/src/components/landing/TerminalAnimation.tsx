import { useState, useEffect, useCallback, useRef } from 'react';

const TYPING_SPEED = 40;
const SPINNER_CHARS = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export function TerminalAnimation() {
  const [lines, setLines] = useState<Array<{ text: string; type: string }>>([]);
  const [currentText, setCurrentText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showCursor, setShowCursor] = useState(true);
  const [spinnerText, setSpinnerText] = useState('');
  const terminalRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<boolean>(true);

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const typeText = useCallback(async (text: string) => {
    setIsTyping(true);
    for (let i = 0; i <= text.length; i++) {
      if (!animationRef.current) return;
      setCurrentText(text.slice(0, i));
      await sleep(TYPING_SPEED);
    }
    setIsTyping(false);
  }, []);

  const showSpinner = useCallback(async (text: string, duration: number) => {
    const startTime = Date.now();
    let i = 0;
    while (Date.now() - startTime < duration && animationRef.current) {
      setSpinnerText(`${SPINNER_CHARS[i % SPINNER_CHARS.length]} ${text}`);
      i++;
      await sleep(80);
    }
    setSpinnerText('');
  }, []);

  const addLine = useCallback((text: string, type: string) => {
    setLines(prev => [...prev, { text, type }]);
  }, []);

  const runSequence = useCallback(async () => {
    while (animationRef.current) {
      setLines([]);
      setCurrentText('');

      // Blink cursor 3 times
      for (let i = 0; i < 3; i++) {
        setShowCursor(true);
        await sleep(500);
        setShowCursor(false);
        await sleep(500);
        if (!animationRef.current) return;
      }
      setShowCursor(true);

      // Type first command
      await typeText('npx krexa init');
      await sleep(200);
      addLine('$ npx krexa init', 'command');
      setCurrentText('');
      await sleep(300);

      // Spinner
      await showSpinner('Registering agent...', 1500);

      // Success lines
      addLine('✓ Keypair created: 7xK2mN...3pF4', 'success');
      await sleep(300);
      if (!animationRef.current) return;

      addLine('✓ Agent registered: ResearchBot', 'success');
      await sleep(300);
      if (!animationRef.current) return;

      addLine('✓ PDA wallet created', 'success');
      await sleep(300);
      if (!animationRef.current) return;

      addLine('✓ Krexit Score: 350 (L1)', 'highlight');
      await sleep(500);
      if (!animationRef.current) return;

      addLine('', 'blank');
      addLine('Ready! Borrow up to $500 USDC.', 'info');
      await sleep(1000);
      if (!animationRef.current) return;

      addLine('', 'blank');

      // Type second command
      await typeText('krexa borrow 500');
      await sleep(200);
      addLine('$ krexa borrow 500', 'command');
      setCurrentText('');
      await sleep(300);

      // Spinner
      await showSpinner('Requesting credit...', 1000);

      addLine('✓ Credit line opened: $500.00 USDC', 'success');
      await sleep(800);
      if (!animationRef.current) return;

      // Wait with blinking cursor
      await sleep(4000);
      if (!animationRef.current) return;

      // Clear and loop
      setLines([]);
      setCurrentText('');
      await sleep(200);
    }
  }, [typeText, showSpinner, addLine]);

  useEffect(() => {
    animationRef.current = true;
    runSequence();
    return () => { animationRef.current = false; };
  }, [runSequence]);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines, currentText, spinnerText]);

  const renderLine = (line: { text: string; type: string }, i: number) => {
    const mono = "'Geist Mono', 'JetBrains Mono', monospace";

    if (line.type === 'blank') return <div key={i} className="h-5" />;

    if (line.type === 'command') {
      return (
        <div key={i} style={{ fontFamily: mono }} className="text-sm leading-6">
          <span style={{ color: '#3a3a42' }}>$ </span>
          <span style={{ color: '#f0f0f0' }}>{line.text.replace('$ ', '')}</span>
        </div>
      );
    }

    if (line.type === 'success') {
      // Parse for cyan-colored numbers
      const parts = line.text.split(/(\$[\d,.]+|\d{3,})/);
      return (
        <div key={i} style={{ fontFamily: mono }} className="text-sm leading-6">
          <span style={{ color: '#34d399' }}>✓</span>
          <span style={{ color: '#a0a0a8' }}>
            {parts.map((part, j) =>
              /^\$[\d,.]+$|^\d{3,}$/.test(part)
                ? <span key={j} style={{ color: '#22d3ee' }}>{part}</span>
                : part.startsWith('✓') ? part.slice(1) : part
            )}
          </span>
        </div>
      );
    }

    if (line.type === 'highlight') {
      // "✓ Krexit Score: 350 (L1)" — green check, cyan number
      return (
        <div key={i} style={{ fontFamily: mono }} className="text-sm leading-6">
          <span style={{ color: '#34d399' }}>✓</span>
          <span style={{ color: '#a0a0a8' }}> Krexit Score: </span>
          <span style={{ color: '#22d3ee' }}>350</span>
          <span style={{ color: '#a0a0a8' }}> (L1)</span>
        </div>
      );
    }

    if (line.type === 'info') {
      // "Ready!" in cyan, rest in white
      if (line.text.startsWith('Ready!')) {
        return (
          <div key={i} style={{ fontFamily: mono }} className="text-sm leading-6">
            <span style={{ color: '#22d3ee' }}>Ready!</span>
            <span style={{ color: '#f0f0f0' }}>{line.text.slice(6)}</span>
          </div>
        );
      }
      return (
        <div key={i} style={{ fontFamily: mono, color: '#a0a0a8' }} className="text-sm leading-6">
          {line.text}
        </div>
      );
    }

    return (
      <div key={i} style={{ fontFamily: mono, color: '#a0a0a8' }} className="text-sm leading-6">
        {line.text}
      </div>
    );
  };

  const mono = "'Geist Mono', 'JetBrains Mono', monospace";

  return (
    <div className="w-full max-w-[640px] mx-auto">
      {/* Terminal window */}
      <div
        style={{
          background: '#0c0c0e',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '12px',
          boxShadow: '0 0 80px rgba(34, 211, 238, 0.08), 0 25px 50px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Title bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            background: '#0a0a0c',
          }}
        >
          {/* Traffic lights */}
          <div className="flex gap-2">
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5f57' }} />
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#febc2e' }} />
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#28c840' }} />
          </div>
          {/* Title */}
          <div
            style={{
              flex: 1,
              textAlign: 'center',
              fontFamily: mono,
              fontSize: '12px',
              color: '#3a3a42',
            }}
          >
            krexa
          </div>
          {/* Spacer for centering */}
          <div className="w-12" />
        </div>

        {/* Terminal content */}
        <div
          ref={terminalRef}
          style={{
            padding: '20px 24px',
            minHeight: '280px',
            maxHeight: '340px',
            overflowY: 'auto',
            fontFamily: mono,
            fontSize: '14px',
          }}
        >
          {/* Rendered lines */}
          {lines.map((line, i) => renderLine(line, i))}

          {/* Spinner line */}
          {spinnerText && (
            <div style={{ fontFamily: mono, color: '#22d3ee' }} className="text-sm leading-6">
              {spinnerText}
            </div>
          )}

          {/* Current typing line */}
          {!spinnerText && (
            <div style={{ fontFamily: mono }} className="text-sm leading-6">
              <span style={{ color: '#3a3a42' }}>$ </span>
              <span style={{ color: '#f0f0f0' }}>{currentText}</span>
              {showCursor && (
                <span
                  style={{
                    color: '#f0f0f0',
                    animation: isTyping ? 'none' : 'blink 1.06s step-end infinite',
                  }}
                >
                  █
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
