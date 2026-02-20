import { useState, useEffect, useRef } from 'react';
import { INDUSTRIAL_THEME as T } from '../lib/theme';

interface OperatorBridgeProps {
  onConnect?: () => void;
}

type Phase = 'idle' | 'booting' | 'complete' | 'fading';

interface LogLine {
  prefix:  string;
  body:    string;
  blocks?: string;
  suffix?: string;
  check?:  string;
}

const BOOT_SEQUENCE: LogLine[] = [
  { prefix: '>', body: ' CONNECTING TO EOA...' },
  { prefix: '>', body: ' SIGNATURE VERIFIED ', blocks: '████████', suffix: ' OK' },
  { prefix: '>', body: ' CREATING SESSION KEY...' },
  { prefix: '>', body: ' DELEGATION SCOPE: [BUY, SELL] ', blocks: '████', suffix: ' SET' },
  { prefix: '>', body: ' COPY ENGINE: ARMED' },
  { prefix: '>', body: ' OPERATOR LINK: ESTABLISHED ', check: ' ✓' },
];

const LINE_DELAY_MS  = 300;  // stagger between lines
const HOLD_MS        = 1000; // hold on ESTABLISHED before fade
const FADE_MS        = 500;  // opacity transition duration

export function OperatorBridge({ onConnect }: OperatorBridgeProps) {
  const [watchAddress, setWatchAddress] = useState('');
  const [phase, setPhase]               = useState<Phase>('idle');
  const [visibleLines, setVisibleLines] = useState(0);
  const [opacity, setOpacity]           = useState(1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  const handleConnect = () => {
    if (phase !== 'idle') return;
    setPhase('booting');

    // Reveal each line with staggered delay
    BOOT_SEQUENCE.forEach((_, i) => {
      const t = setTimeout(() => setVisibleLines(i + 1), i * LINE_DELAY_MS);
      timers.current.push(t);
    });

    // After all lines visible → hold → fade
    const totalBoot = (BOOT_SEQUENCE.length - 1) * LINE_DELAY_MS;
    const holdTimer = setTimeout(() => {
      setPhase('complete');
      const fadeTimer = setTimeout(() => {
        setPhase('fading');
        setOpacity(0);
        // After fade transition completes, fire onConnect
        const resolveTimer = setTimeout(() => { onConnect?.(); }, FADE_MS + 50);
        timers.current.push(resolveTimer);
      }, HOLD_MS);
      timers.current.push(fadeTimer);
    }, totalBoot + LINE_DELAY_MS);
    timers.current.push(holdTimer);
  };

  // Cleanup on unmount
  useEffect(() => () => clearTimers(), []);

  const isBooting = phase === 'booting' || phase === 'complete' || phase === 'fading';

  return (
    <>
      <style>{`
        @keyframes auth-cursor {
          0%, 100% { opacity: 0.25; text-shadow: none; }
          50%       { opacity: 1.00; text-shadow: 0 0 10px rgba(168,85,247,0.9), 0 0 20px rgba(168,85,247,0.5); }
        }
        .auth-cursor { animation: auth-cursor 3s ease-in-out infinite; }

        @keyframes dot-pulse {
          0%, 100% { opacity: 0.20; box-shadow: 0 0 3px rgba(168,85,247,0.4); }
          50%       { opacity: 0.95; box-shadow: 0 0 10px rgba(168,85,247,0.95), 0 0 20px rgba(168,85,247,0.4); }
        }
        .dot-pulse { animation: dot-pulse 3s ease-in-out infinite; }

        @keyframes bridge-breathe {
          0%, 100% { box-shadow: 0 0 40px rgba(139,92,246,0.10), 0 0 80px rgba(139,92,246,0.05), inset 0 0 30px rgba(0,0,0,0.80); }
          50%       { box-shadow: 0 0 60px rgba(139,92,246,0.18), 0 0 100px rgba(139,92,246,0.09), inset 0 0 30px rgba(0,0,0,0.80); }
        }
        .bridge-module { animation: bridge-breathe 4s ease-in-out infinite; }

        /* Line entry — slides up + fades in */
        @keyframes line-entry {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .boot-line { animation: line-entry 0.18s ease-out forwards; }

        .connect-btn { transition: background-color 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease; }
      `}</style>

      <div
        className="bridge-module rounded-sm"
        style={{
          backgroundColor:      '#050505',
          backdropFilter:       'blur(25px)',
          WebkitBackdropFilter: 'blur(25px)',
          border:               '1px solid rgba(139,92,246,0.20)',
          display:              'flex',
          flexDirection:        'column',
          overflow:             'hidden',
          // Fade-out transition — opacity controlled by state
          opacity:    opacity,
          transition: `opacity ${FADE_MS}ms ease`,
        }}
      >
        {/* Power rail */}
        <div style={{
          height:     '1px',
          background: 'linear-gradient(to right, transparent, rgba(139,92,246,0.7) 40%, rgba(59,130,246,0.5) 70%, transparent)',
        }} />

        <div style={{ padding: '20px 18px 22px' }}>

          {/* ── IDLE STATE — normal auth content ──────────────────────── */}
          {!isBooting && (
            <>
              <div style={{ marginBottom: '10px' }}>
                <div className="font-bold font-mono flex items-center gap-1"
                  style={{ fontSize: '13px', color: '#f4f4f5', letterSpacing: '0.06em' }}>
                  <span style={{ color: 'rgba(139,92,246,0.8)' }}>&gt;_</span>
                  <span> AUTH_REQUIRED</span>
                  <span className="auth-cursor" style={{ color: 'rgba(139,92,246,0.9)', marginLeft: '2px' }}>▋</span>
                </div>
                <p className="font-mono" style={{
                  fontSize: '10px', lineHeight: 1.5,
                  color: T.text.muted, opacity: 0.30,
                  marginTop: '6px', letterSpacing: '0.02em',
                }}>
                  Initialize EOA link to enable<br />agent copy-trading protocols
                </p>
              </div>

              <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.05)', margin: '14px 0' }} />

              <button
                onClick={handleConnect}
                className="connect-btn w-full font-bold font-mono rounded-sm"
                style={{
                  backgroundColor: T.color.blue,
                  color:           '#000000',
                  fontSize:        '12px',
                  letterSpacing:   '0.12em',
                  padding:         '11px 16px',
                  border:          '1px solid rgba(255,255,255,0.40)',
                  boxShadow:
                    '0 0 15px rgba(59,130,246,0.60), ' +
                    '0 0 30px rgba(59,130,246,0.25), ' +
                    'inset 0 0 5px rgba(255,255,255,0.30), ' +
                    'inset 0 1px 0 rgba(255,255,255,0.40)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = '#5b9eff';
                  e.currentTarget.style.borderColor     = 'rgba(255,255,255,0.70)';
                  e.currentTarget.style.boxShadow =
                    '0 0 4px  rgba(255,255,255,0.90), ' +
                    '0 0 8px  rgba(59,130,246,1.00), '  +
                    '0 0 15px rgba(59,130,246,0.95), '  +
                    '0 0 28px rgba(59,130,246,0.30), '  +
                    'inset 0 0 10px rgba(255,255,255,0.40), ' +
                    'inset 0 1px 0  rgba(255,255,255,0.70)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = T.color.blue;
                  e.currentTarget.style.borderColor     = 'rgba(255,255,255,0.40)';
                  e.currentTarget.style.boxShadow =
                    '0 0 15px rgba(59,130,246,0.60), ' +
                    '0 0 30px rgba(59,130,246,0.25), ' +
                    'inset 0 0 5px rgba(255,255,255,0.30), ' +
                    'inset 0 1px 0 rgba(255,255,255,0.40)';
                }}
              >
                CONNECT OPERATOR
              </button>

              <div style={{ marginTop: '10px' }}>
                <div className="font-mono" style={{
                  fontSize: '8px', letterSpacing: '0.16em',
                  color: T.text.muted, opacity: 0.3,
                  marginBottom: '5px', textTransform: 'uppercase',
                }}>
                  Watch-Only Mode
                </div>
                <input
                  type="text"
                  value={watchAddress}
                  onChange={e => setWatchAddress(e.target.value)}
                  placeholder="ENTER WATCH-ONLY ADDRESS"
                  className="w-full font-mono rounded-sm"
                  style={{
                    backgroundColor:      'rgba(0,0,0,0.80)',
                    backdropFilter:       'blur(4px)',
                    WebkitBackdropFilter: 'blur(4px)',
                    border:               '1px dashed rgba(255,255,255,0.20)',
                    color:                T.text.secondary,
                    fontSize:             '10px',
                    letterSpacing:        '0.06em',
                    padding:              '9px 12px',
                    outline:              'none',
                    boxShadow:            'inset 0 2px 10px rgba(0,0,0,0.80)',
                    WebkitAppearance:     'none',
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = 'rgba(139,92,246,0.45)';
                    e.currentTarget.style.boxShadow   = 'inset 0 2px 8px rgba(0,0,0,0.70), 0 0 10px rgba(139,92,246,0.15)';
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.20)';
                    e.currentTarget.style.boxShadow   = 'inset 0 2px 8px rgba(0,0,0,0.70)';
                  }}
                />
              </div>

              <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.35 }}>
                <div className="dot-pulse" style={{
                  width: '5px', height: '5px', borderRadius: '50%',
                  backgroundColor: 'rgba(168,85,247,0.85)',
                }} />
                <span className="font-mono" style={{ fontSize: '9px', color: T.text.muted, letterSpacing: '0.12em' }}>
                  AWAITING OPERATOR CREDENTIALS
                </span>
              </div>
            </>
          )}

          {/* ── BOOT STATE — initialization sequence ──────────────────── */}
          {isBooting && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '160px' }}>
              {/* Header stays visible during boot */}
              <div className="font-bold font-mono flex items-center gap-1" style={{
                fontSize: '13px', color: '#f4f4f5', letterSpacing: '0.06em', marginBottom: '6px',
              }}>
                <span style={{ color: 'rgba(139,92,246,0.8)' }}>&gt;_</span>
                <span> INITIALIZING...</span>
              </div>

              {/* Terminal log lines — revealed one by one */}
              {BOOT_SEQUENCE.slice(0, visibleLines).map((line, i) => {
                const isLast     = i === BOOT_SEQUENCE.length - 1;
                const isComplete = phase === 'complete' || phase === 'fading';

                return (
                  <div
                    key={i}
                    className="boot-line font-mono"
                    style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '0' }}
                  >
                    {/* Prompt */}
                    <span style={{ color: T.text.muted, opacity: 0.5, marginRight: '4px' }}>
                      {line.prefix}
                    </span>

                    {/* Body text */}
                    <span style={{ color: T.text.secondary }}>{line.body}</span>

                    {/* Progress blocks — Neon Mint */}
                    {line.blocks && (
                      <span style={{
                        color:      T.color.green,
                        fontWeight: 700,
                        textShadow: '0 0 8px rgba(34,197,94,0.6)',
                      }}>
                        {line.blocks}
                      </span>
                    )}

                    {/* Suffix */}
                    {line.suffix && (
                      <span style={{ color: T.text.secondary }}>{line.suffix}</span>
                    )}

                    {/* Checkmark — Neon Mint, only on final line + complete */}
                    {line.check && isLast && (
                      <span style={{
                        color:      T.color.green,
                        fontWeight: 700,
                        fontSize:   '13px',
                        textShadow: `0 0 12px rgba(34,197,94,0.9), 0 0 24px rgba(34,197,94,0.5)`,
                        marginLeft: '2px',
                        // Pulse briefly on complete
                        opacity:    isComplete ? 1 : 0.8,
                      }}>
                        {line.check}
                      </span>
                    )}
                  </div>
                );
              })}

              {/* Blinking cursor on the current line while booting */}
              {phase === 'booting' && visibleLines < BOOT_SEQUENCE.length && (
                <span className="auth-cursor font-mono" style={{
                  fontSize: '11px', color: 'rgba(139,92,246,0.7)',
                }}>▋</span>
              )}

              {/* ESTABLISHED glow — lights up the whole module on resolve */}
              {phase === 'complete' && (
                <div style={{
                  marginTop:   '8px',
                  fontSize:    '9px',
                  fontFamily:  'monospace',
                  letterSpacing: '0.14em',
                  color:       T.color.green,
                  opacity:     0.6,
                  textShadow:  '0 0 10px rgba(34,197,94,0.5)',
                }}>
                  ● OPERATOR LINK ACTIVE
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  );
}
