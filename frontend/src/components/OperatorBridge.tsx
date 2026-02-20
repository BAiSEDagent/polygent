import { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import { INDUSTRIAL_THEME as T } from '../lib/theme';

// ── Window.ethereum type augmentation ────────────────────────────────────────
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      isMetaMask?: boolean;
    };
  }
}

interface OperatorBridgeProps {
  onConnect?: (address: string) => void;
  initialAddress?: string; // pre-load from sessionStorage for soft-refresh persistence
}

// ── State machine ─────────────────────────────────────────────────────────────
type Phase =
  | 'idle'       // default — show CONNECT button
  | 'connecting' // eth_requestAccounts pending
  | 'signing'    // signMessage pending
  | 'booting'    // terminal log sequence
  | 'complete'   // ESTABLISHED — hold 1s
  | 'fading'     // boot sequence opacity → 0
  | 'linked'     // LIVE — connected operator panel
  | 'denied';    // user rejected wallet or signature

const SESSION_KEY   = 'polygent_operator';
const SIGN_MESSAGE  = 'Initialize POLYGENT Operator Link';
const LINE_DELAY    = 300;  // ms between log lines
const HOLD_MS       = 1000; // hold on ESTABLISHED before fade
const FADE_MS       = 500;  // boot fade out
const REVEAL_MS     = 350;  // linked panel fade in

interface LogLine {
  body:    string;
  blocks?: string;
  suffix?: string;
  check?:  string;
}

const POST_SIGN_LINES: LogLine[] = [
  { body: ' CREATING SESSION KEY...' },
  { body: ' DELEGATION SCOPE: [BUY, SELL] ', blocks: '████', suffix: ' SET' },
  { body: ' COPY ENGINE: ARMED' },
  { body: ' OPERATOR LINK: ESTABLISHED', check: ' ✓' },
];

// ── Component ─────────────────────────────────────────────────────────────────
export function OperatorBridge({ onConnect, initialAddress }: OperatorBridgeProps) {
  const [watchAddress, setWatchAddress]     = useState('');
  const [phase,        setPhase]            = useState<Phase>('idle');
  const [errorMsg,     setErrorMsg]         = useState('');
  const [walletAddr,   setWalletAddr]       = useState('');
  const [visibleLines, setVisibleLines]     = useState(0);
  const [bootOpacity,  setBootOpacity]      = useState(1); // boot sequence fades out
  const [linkedOpacity,setLinkedOpacity]    = useState(0); // linked panel fades in
  const [connectedAt,  setConnectedAt]      = useState<string>('');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => () => clearTimers(), []);

  // ── Restore from session on mount ────────────────────────────────────────
  useEffect(() => {
    const saved = initialAddress || sessionStorage.getItem(SESSION_KEY);
    if (saved) {
      setWalletAddr(saved);
      setPhase('linked');
      setLinkedOpacity(1);
      setConnectedAt(sessionStorage.getItem('polygent_connected_at') || '');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Real EOA connect + sign ──────────────────────────────────────────────
  const handleConnect = async () => {
    if (phase !== 'idle' && phase !== 'denied') return;
    setErrorMsg('');

    if (!window.ethereum) {
      setPhase('denied');
      setErrorMsg('NO WALLET DETECTED — install MetaMask');
      return;
    }

    try {
      setPhase('connecting');
      const accounts: string[] = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });
      const address = accounts[0];
      setWalletAddr(address);

      setPhase('signing');
      const provider = new ethers.providers.Web3Provider(window.ethereum as any);
      const signer   = provider.getSigner();
      await signer.signMessage(SIGN_MESSAGE);

      // Signature confirmed — start terminal log sequence
      setPhase('booting');
      setBootOpacity(1);
      setLinkedOpacity(0);
      setVisibleLines(0);

      POST_SIGN_LINES.forEach((_, i) => {
        const t = setTimeout(() => setVisibleLines(i + 1), i * LINE_DELAY);
        timers.current.push(t);
      });

      const totalBoot = (POST_SIGN_LINES.length - 1) * LINE_DELAY;

      // Hold on ESTABLISHED
      const holdTimer = setTimeout(() => {
        setPhase('complete');

        // Fade out boot sequence
        const fadeTimer = setTimeout(() => {
          setPhase('fading');
          setBootOpacity(0);

          // While boot fades, persist and start linked reveal
          const now = new Date().toLocaleTimeString('en-US', { hour12: false });
          sessionStorage.setItem(SESSION_KEY, address);
          sessionStorage.setItem('polygent_connected_at', now);
          setConnectedAt(now);
          onConnect?.(address);

          // Linked panel fades in slightly after boot fade begins
          const revealTimer = setTimeout(() => {
            setPhase('linked');
            setLinkedOpacity(1);
          }, FADE_MS * 0.6); // start revealing before boot fully gone
          timers.current.push(revealTimer);

        }, HOLD_MS);
        timers.current.push(fadeTimer);
      }, totalBoot + LINE_DELAY);
      timers.current.push(holdTimer);

    } catch (err: any) {
      clearTimers();
      const rejected =
        err?.code === 4001 ||
        err?.message?.toLowerCase().includes('reject') ||
        err?.message?.toLowerCase().includes('denied') ||
        err?.message?.toLowerCase().includes('user denied');
      setPhase('denied');
      setErrorMsg(rejected ? 'OPERATOR DENIED LINK — signature rejected' : `ERROR: ${err?.message?.slice(0, 60) ?? 'unknown'}`);
      setVisibleLines(0);
      setBootOpacity(1);
    }
  };

  const handleDisconnect = () => {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem('polygent_connected_at');
    setWalletAddr('');
    setPhase('idle');
    setLinkedOpacity(0);
    setBootOpacity(1);
    setVisibleLines(0);
    setConnectedAt('');
  };

  const isBooting = phase === 'booting' || phase === 'complete' || phase === 'fading';

  const displayLines: (LogLine & { synthetic?: boolean })[] = [
    { body: ' CONNECTING TO EOA...',           synthetic: true },
    { body: ' SIGNATURE VERIFIED ', blocks: '████████', suffix: ' OK', synthetic: true },
    ...POST_SIGN_LINES,
  ];

  const shortAddr = walletAddr
    ? `${walletAddr.slice(0, 6)}…${walletAddr.slice(-4)}`
    : '';

  // Border color by phase
  const borderColor = phase === 'denied'
    ? 'rgba(239,68,68,0.35)'
    : phase === 'linked'
    ? 'rgba(34,197,94,0.25)'
    : 'rgba(139,92,246,0.20)';

  const railGradient = phase === 'denied'
    ? 'linear-gradient(to right, transparent, rgba(239,68,68,0.6) 50%, transparent)'
    : phase === 'linked'
    ? 'linear-gradient(to right, transparent, rgba(34,197,94,0.5) 40%, rgba(59,130,246,0.4) 70%, transparent)'
    : 'linear-gradient(to right, transparent, rgba(139,92,246,0.7) 40%, rgba(59,130,246,0.5) 70%, transparent)';

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

        @keyframes green-pulse {
          0%, 100% { opacity: 0.60; box-shadow: 0 0 4px rgba(34,197,94,0.5); }
          50%       { opacity: 1.00; box-shadow: 0 0 12px rgba(34,197,94,0.95), 0 0 24px rgba(34,197,94,0.4); }
        }
        .green-pulse { animation: green-pulse 3s ease-in-out infinite; }

        @keyframes bridge-breathe {
          0%, 100% { box-shadow: 0 0 40px rgba(139,92,246,0.10), 0 0 80px rgba(139,92,246,0.05), inset 0 0 30px rgba(0,0,0,0.80); }
          50%       { box-shadow: 0 0 60px rgba(139,92,246,0.18), 0 0 100px rgba(139,92,246,0.09), inset 0 0 30px rgba(0,0,0,0.80); }
        }
        .bridge-module { animation: bridge-breathe 4s ease-in-out infinite; }

        @keyframes linked-breathe {
          0%, 100% { box-shadow: 0 0 30px rgba(34,197,94,0.08), 0 0 60px rgba(34,197,94,0.04), inset 0 0 30px rgba(0,0,0,0.80); }
          50%       { box-shadow: 0 0 50px rgba(34,197,94,0.14), 0 0 80px rgba(34,197,94,0.07), inset 0 0 30px rgba(0,0,0,0.80); }
        }
        .linked-module { animation: linked-breathe 4s ease-in-out infinite; }

        @keyframes line-entry {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .boot-line { animation: line-entry 0.18s ease-out forwards; }

        .connect-btn { transition: background-color 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease; }

        @keyframes error-pulse {
          0%, 100% { opacity: 0.7; } 50% { opacity: 1; }
        }
        .error-blink { animation: error-pulse 1.2s ease-in-out infinite; }

        @keyframes linked-row-in {
          from { opacity: 0; transform: translateX(-4px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .linked-row { animation: linked-row-in 0.22s ease-out forwards; }
        .linked-row:nth-child(1) { animation-delay: 0.00s; }
        .linked-row:nth-child(2) { animation-delay: 0.06s; }
        .linked-row:nth-child(3) { animation-delay: 0.12s; }
        .linked-row:nth-child(4) { animation-delay: 0.18s; }
      `}</style>

      <div
        className={phase === 'linked' ? 'linked-module rounded-sm' : 'bridge-module rounded-sm'}
        style={{
          backgroundColor:      '#050505',
          backdropFilter:       'blur(25px)',
          WebkitBackdropFilter: 'blur(25px)',
          border:               `1px solid ${borderColor}`,
          display:              'flex',
          flexDirection:        'column',
          overflow:             'hidden',
          transition:           `border-color 0.6s ease`,
          position:             'relative',
        }}
      >
        {/* Power rail */}
        <div style={{
          height:     '1px',
          background: railGradient,
          transition: 'background 0.6s ease',
        }} />

        <div style={{ padding: '20px 18px 22px', position: 'relative' }}>

          {/* ── IDLE / DENIED — auth gate ─────────────────────────────── */}
          {!isBooting && phase !== 'linked' && (
            <>
              <div style={{ marginBottom: '10px' }}>
                <div className="font-bold font-mono flex items-center gap-1"
                  style={{ fontSize: '13px', color: '#f4f4f5', letterSpacing: '0.06em' }}>
                  <span style={{ color: phase === 'denied' ? 'rgba(239,68,68,0.8)' : 'rgba(139,92,246,0.8)' }}>&gt;_</span>
                  <span> {phase === 'denied' ? 'AUTH_FAILED' : 'AUTH_REQUIRED'}</span>
                  {phase !== 'denied' && (
                    <span className="auth-cursor" style={{ color: 'rgba(139,92,246,0.9)', marginLeft: '2px' }}>▋</span>
                  )}
                </div>

                {phase === 'denied' && errorMsg && (
                  <div className="error-blink font-mono" style={{
                    fontSize: '10px', color: T.color.red,
                    marginTop: '6px', letterSpacing: '0.04em',
                  }}>
                    ✗ {errorMsg}
                  </div>
                )}

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
                disabled={phase === 'connecting' || phase === 'signing'}
                className="connect-btn w-full font-bold font-mono rounded-sm"
                style={{
                  backgroundColor: phase === 'denied' ? 'rgba(239,68,68,0.15)' : T.color.blue,
                  color:           phase === 'denied' ? T.color.red : '#000000',
                  fontSize:        '12px',
                  letterSpacing:   '0.12em',
                  padding:         '11px 16px',
                  border:          phase === 'denied'
                    ? '1px solid rgba(239,68,68,0.50)'
                    : '1px solid rgba(255,255,255,0.40)',
                  boxShadow: phase === 'denied'
                    ? '0 0 10px rgba(239,68,68,0.25)'
                    : '0 0 15px rgba(59,130,246,0.60), 0 0 30px rgba(59,130,246,0.25), inset 0 0 5px rgba(255,255,255,0.30), inset 0 1px 0 rgba(255,255,255,0.40)',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => {
                  if (phase === 'denied') return;
                  e.currentTarget.style.backgroundColor = '#5b9eff';
                  e.currentTarget.style.borderColor     = 'rgba(255,255,255,0.70)';
                  e.currentTarget.style.boxShadow =
                    '0 0 4px rgba(255,255,255,0.90), 0 0 8px rgba(59,130,246,1.00), 0 0 15px rgba(59,130,246,0.95), 0 0 28px rgba(59,130,246,0.30), inset 0 0 10px rgba(255,255,255,0.40), inset 0 1px 0 rgba(255,255,255,0.70)';
                }}
                onMouseLeave={e => {
                  if (phase === 'denied') return;
                  e.currentTarget.style.backgroundColor = T.color.blue;
                  e.currentTarget.style.borderColor     = 'rgba(255,255,255,0.40)';
                  e.currentTarget.style.boxShadow =
                    '0 0 15px rgba(59,130,246,0.60), 0 0 30px rgba(59,130,246,0.25), inset 0 0 5px rgba(255,255,255,0.30), inset 0 1px 0 rgba(255,255,255,0.40)';
                }}
              >
                {phase === 'connecting' ? 'OPENING WALLET...'
                  : phase === 'signing' ? 'AWAITING SIGNATURE...'
                  : phase === 'denied'  ? 'RETRY CONNECTION'
                  : 'CONNECT OPERATOR'}
              </button>

              {/* Watch-only slot */}
              <div style={{ marginTop: '10px' }}>
                <div className="font-mono" style={{
                  fontSize: '8px', letterSpacing: '0.16em',
                  color: T.text.muted, opacity: 0.3,
                  marginBottom: '5px', textTransform: 'uppercase',
                }}>Watch-Only Mode</div>
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
                  backgroundColor: phase === 'denied' ? T.color.red : 'rgba(168,85,247,0.85)',
                }} />
                <span className="font-mono" style={{ fontSize: '9px', color: T.text.muted, letterSpacing: '0.12em' }}>
                  {phase === 'denied' ? 'LINK REJECTED — RETRY TO RECONNECT' : 'AWAITING OPERATOR CREDENTIALS'}
                </span>
              </div>
            </>
          )}

          {/* ── BOOT SEQUENCE ─────────────────────────────────────────── */}
          {isBooting && (
            <div style={{
              display:    'flex',
              flexDirection: 'column',
              gap:        '8px',
              minHeight:  '160px',
              opacity:    bootOpacity,
              transition: `opacity ${FADE_MS}ms ease`,
              // Keep in layout during fade so linked panel can overlap-swap
              position:   phase === 'fading' ? 'absolute' : 'relative',
              inset:      phase === 'fading' ? '20px 18px' : undefined,
            }}>
              <div className="font-bold font-mono flex items-center gap-1" style={{
                fontSize: '13px', color: '#f4f4f5', letterSpacing: '0.06em', marginBottom: '6px',
              }}>
                <span style={{ color: 'rgba(139,92,246,0.8)' }}>&gt;_</span>
                <span> INITIALIZING...</span>
              </div>

              {displayLines.slice(0, visibleLines + 2).map((line, i) => {
                const isLastLine = i === displayLines.length - 1;
                const isResolved = phase === 'complete' || phase === 'fading';
                return (
                  <div key={i} className="boot-line font-mono"
                    style={{ fontSize: '11px', display: 'flex', alignItems: 'center' }}>
                    <span style={{ color: T.text.muted, opacity: 0.5, marginRight: '4px' }}>&gt;</span>
                    <span style={{ color: T.text.secondary }}>{line.body}</span>
                    {line.blocks && (
                      <span style={{ color: T.color.green, fontWeight: 700, textShadow: '0 0 8px rgba(34,197,94,0.6)' }}>
                        {line.blocks}
                      </span>
                    )}
                    {line.suffix && <span style={{ color: T.text.secondary }}>{line.suffix}</span>}
                    {line.check && isLastLine && (
                      <span style={{
                        color: T.color.green, fontWeight: 700, fontSize: '13px', marginLeft: '2px',
                        textShadow: '0 0 12px rgba(34,197,94,0.9), 0 0 24px rgba(34,197,94,0.5)',
                        opacity: isResolved ? 1 : 0.8,
                      }}>
                        {line.check}
                      </span>
                    )}
                  </div>
                );
              })}

              {phase === 'booting' && (
                <span className="auth-cursor font-mono" style={{ fontSize: '11px', color: 'rgba(139,92,246,0.7)' }}>▋</span>
              )}

              {(phase === 'complete' || phase === 'fading') && (
                <div style={{
                  marginTop: '8px', fontSize: '9px', fontFamily: 'monospace',
                  letterSpacing: '0.14em', color: T.color.green, opacity: 0.7,
                  textShadow: '0 0 10px rgba(34,197,94,0.5)',
                }}>
                  ● OPERATOR LINK ACTIVE — {shortAddr}
                </div>
              )}
            </div>
          )}

          {/* ── LINKED — persistent connected panel ───────────────────── */}
          {phase === 'linked' && (
            <div style={{
              opacity:    linkedOpacity,
              transition: `opacity ${REVEAL_MS}ms ease`,
              display:    'flex',
              flexDirection: 'column',
              gap:        '12px',
            }}>
              {/* Header row */}
              <div className="linked-row font-bold font-mono flex items-center justify-between"
                style={{ fontSize: '13px', color: '#f4f4f5', letterSpacing: '0.06em' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div className="green-pulse" style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    backgroundColor: T.color.green, flexShrink: 0,
                  }} />
                  <span style={{ color: T.color.green }}>OPERATOR LINKED</span>
                </div>
                {/* Disconnect */}
                <button
                  onClick={handleDisconnect}
                  className="font-mono"
                  style={{
                    background: 'none', border: 'none',
                    color: 'rgba(239,68,68,0.50)', fontSize: '8px',
                    letterSpacing: '0.12em', cursor: 'pointer',
                    padding: '2px 4px',
                    transition: 'color 0.15s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = T.color.red; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'rgba(239,68,68,0.50)'; }}
                >
                  DISCONNECT
                </button>
              </div>

              <div style={{ height: '1px', backgroundColor: 'rgba(34,197,94,0.10)' }} />

              {/* Address pill */}
              <div className="linked-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="font-mono" style={{ fontSize: '9px', color: T.text.muted, opacity: 0.5, letterSpacing: '0.10em' }}>
                  EOA
                </span>
                <div style={{
                  backgroundColor: 'rgba(34,197,94,0.08)',
                  border:          '1px solid rgba(34,197,94,0.20)',
                  borderRadius:    '3px',
                  padding:         '4px 10px',
                  display:         'flex',
                  alignItems:      'center',
                  gap:             '6px',
                }}>
                  <div style={{
                    width: '4px', height: '4px', borderRadius: '50%',
                    backgroundColor: T.color.green,
                    boxShadow: '0 0 6px rgba(34,197,94,0.8)',
                  }} />
                  <span className="font-mono font-bold" style={{
                    fontSize: '11px', color: T.color.green,
                    letterSpacing: '0.08em',
                    textShadow: '0 0 8px rgba(34,197,94,0.4)',
                  }}>
                    {shortAddr}
                  </span>
                </div>
              </div>

              {/* Status rows */}
              <div className="linked-row" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[
                  { label: 'COPY ENGINE',   value: 'ARMED',    valueColor: T.color.green },
                  { label: 'DELEGATION',    value: '[BUY, SELL]', valueColor: T.color.blue },
                  { label: 'SESSION',       value: connectedAt ? `SINCE ${connectedAt}` : 'ACTIVE', valueColor: 'rgba(255,255,255,0.55)' },
                ].map(row => (
                  <div key={row.label} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span className="font-mono" style={{
                      fontSize: '9px', color: T.text.muted, opacity: 0.45, letterSpacing: '0.10em',
                    }}>
                      {row.label}
                    </span>
                    <span className="font-mono font-bold" style={{
                      fontSize: '9px', color: row.valueColor, letterSpacing: '0.10em',
                    }}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.04)' }} />

              {/* CTA */}
              <div className="linked-row">
                <button
                  className="connect-btn w-full font-bold font-mono rounded-sm"
                  style={{
                    backgroundColor: 'rgba(34,197,94,0.12)',
                    color:           T.color.green,
                    fontSize:        '12px',
                    letterSpacing:   '0.12em',
                    padding:         '10px 16px',
                    border:          '1px solid rgba(34,197,94,0.30)',
                    boxShadow:       '0 0 12px rgba(34,197,94,0.15), inset 0 0 4px rgba(34,197,94,0.08)',
                    cursor:          'pointer',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = 'rgba(34,197,94,0.20)';
                    e.currentTarget.style.boxShadow = '0 0 20px rgba(34,197,94,0.30), inset 0 0 8px rgba(34,197,94,0.10)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = 'rgba(34,197,94,0.12)';
                    e.currentTarget.style.boxShadow = '0 0 12px rgba(34,197,94,0.15), inset 0 0 4px rgba(34,197,94,0.08)';
                  }}
                >
                  COPY STRATEGY →
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
