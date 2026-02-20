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
}

// ── State machine ─────────────────────────────────────────────────────────────
type Phase =
  | 'idle'       // default — show CONNECT button
  | 'connecting' // eth_requestAccounts pending
  | 'signing'    // signMessage pending
  | 'booting'    // terminal log sequence
  | 'complete'   // ESTABLISHED — hold 1s
  | 'fading'     // opacity → 0
  | 'denied';    // user rejected wallet or signature

const SIGN_MESSAGE = 'Initialize POLYGENT Operator Link';
const LINE_DELAY   = 300;   // ms between log lines
const HOLD_MS      = 1000;  // hold on ESTABLISHED
const FADE_MS      = 500;   // opacity transition

interface LogLine {
  body:    string;
  blocks?: string;
  suffix?: string;
  check?:  string;
}

// Lines 3–6 run after real signature confirmed
const POST_SIGN_LINES: LogLine[] = [
  { body: ' CREATING SESSION KEY...' },
  { body: ' DELEGATION SCOPE: [BUY, SELL] ', blocks: '████', suffix: ' SET' },
  { body: ' COPY ENGINE: ARMED' },
  { body: ' OPERATOR LINK: ESTABLISHED', check: ' ✓' },
];

// ── Component ─────────────────────────────────────────────────────────────────
export function OperatorBridge({ onConnect }: OperatorBridgeProps) {
  const [watchAddress, setWatchAddress]   = useState('');
  const [phase,        setPhase]          = useState<Phase>('idle');
  const [errorMsg,     setErrorMsg]       = useState('');
  const [walletAddr,   setWalletAddr]     = useState('');
  const [visibleLines, setVisibleLines]   = useState(0);
  const [opacity,      setOpacity]        = useState(1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => () => clearTimers(), []);

  // ── Real EOA connect + sign ──────────────────────────────────────────────
  const handleConnect = async () => {
    if (phase !== 'idle' && phase !== 'denied') return;
    setErrorMsg('');

    // 1. Check MetaMask
    if (!window.ethereum) {
      setPhase('denied');
      setErrorMsg('NO WALLET DETECTED — install MetaMask');
      return;
    }

    try {
      // 2. Request accounts — MetaMask account popup
      setPhase('connecting');
      const accounts: string[] = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });
      const address = accounts[0];
      setWalletAddr(address);

      // 3. Sign message — MetaMask sign popup
      setPhase('signing');
      const provider = new ethers.providers.Web3Provider(window.ethereum as any);
      const signer   = provider.getSigner();
      await signer.signMessage(SIGN_MESSAGE);

      // 4. Signature confirmed — start terminal log sequence
      setPhase('booting');
      setVisibleLines(0);

      POST_SIGN_LINES.forEach((_, i) => {
        const t = setTimeout(() => setVisibleLines(i + 1), i * LINE_DELAY);
        timers.current.push(t);
      });

      // 5. After all lines — hold then fade
      const totalBoot = (POST_SIGN_LINES.length - 1) * LINE_DELAY;
      const holdTimer = setTimeout(() => {
        setPhase('complete');
        const fadeTimer = setTimeout(() => {
          setPhase('fading');
          setOpacity(0);
          const resolveTimer = setTimeout(() => {
            onConnect?.(address);
          }, FADE_MS + 50);
          timers.current.push(resolveTimer);
        }, HOLD_MS);
        timers.current.push(fadeTimer);
      }, totalBoot + LINE_DELAY);
      timers.current.push(holdTimer);

    } catch (err: any) {
      clearTimers();
      // User rejected — revert to AUTH_REQUIRED with error
      const rejected =
        err?.code === 4001 ||
        err?.message?.toLowerCase().includes('reject') ||
        err?.message?.toLowerCase().includes('denied') ||
        err?.message?.toLowerCase().includes('user denied');
      setPhase('denied');
      setErrorMsg(rejected ? 'OPERATOR DENIED LINK — signature rejected' : `ERROR: ${err?.message?.slice(0, 60) ?? 'unknown'}`);
      setVisibleLines(0);
    }
  };

  const isBooting = phase === 'booting' || phase === 'complete' || phase === 'fading';

  // ── Log lines shown during boot ──────────────────────────────────────────
  // First two lines are synthetic (happened before boot sequence)
  const displayLines: (LogLine & { synthetic?: boolean })[] = [
    { body: ' CONNECTING TO EOA...',           synthetic: true },
    { body: ' SIGNATURE VERIFIED ', blocks: '████████', suffix: ' OK', synthetic: true },
    ...POST_SIGN_LINES,
  ];

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
      `}</style>

      <div
        className="bridge-module rounded-sm"
        style={{
          backgroundColor:      '#050505',
          backdropFilter:       'blur(25px)',
          WebkitBackdropFilter: 'blur(25px)',
          border:               `1px solid ${phase === 'denied' ? 'rgba(239,68,68,0.35)' : 'rgba(139,92,246,0.20)'}`,
          display:              'flex',
          flexDirection:        'column',
          overflow:             'hidden',
          opacity,
          transition:           `opacity ${FADE_MS}ms ease`,
        }}
      >
        {/* Power rail */}
        <div style={{
          height:     '1px',
          background: phase === 'denied'
            ? 'linear-gradient(to right, transparent, rgba(239,68,68,0.6) 50%, transparent)'
            : 'linear-gradient(to right, transparent, rgba(139,92,246,0.7) 40%, rgba(59,130,246,0.5) 70%, transparent)',
        }} />

        <div style={{ padding: '20px 18px 22px' }}>

          {/* ── IDLE / DENIED — auth gate ──────────────────────────────── */}
          {!isBooting && (
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

                {/* Error message */}
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

              {/* CONNECT OPERATOR button */}
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
                  : phase === 'signing'    ? 'AWAITING SIGNATURE...'
                  : phase === 'denied'     ? 'RETRY CONNECTION'
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

              {/* Status dot */}
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

          {/* ── BOOT SEQUENCE — runs after real signature confirmed ────── */}
          {isBooting && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '160px' }}>
              <div className="font-bold font-mono flex items-center gap-1" style={{
                fontSize: '13px', color: '#f4f4f5', letterSpacing: '0.06em', marginBottom: '6px',
              }}>
                <span style={{ color: 'rgba(139,92,246,0.8)' }}>&gt;_</span>
                <span> INITIALIZING...</span>
              </div>

              {/* All lines (first 2 synthetic, rest from POST_SIGN_LINES) */}
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
                  ● OPERATOR LINK ACTIVE — {walletAddr.slice(0,6)}…{walletAddr.slice(-4)}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  );
}
