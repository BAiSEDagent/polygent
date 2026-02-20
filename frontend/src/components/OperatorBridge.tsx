import { useState } from 'react';
import { INDUSTRIAL_THEME as T } from '../lib/theme';

interface OperatorBridgeProps {
  onConnect?: () => void;
}

export function OperatorBridge({ onConnect }: OperatorBridgeProps) {
  const [watchAddress, setWatchAddress] = useState('');

  return (
    <>
      <style>{`
        /* 3s Purple Pulse — cursor and status dot share the same rhythm as badge heartbeat */
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

        /* Button haptic transition — smooth flare on hover */
        .connect-btn { transition: background-color 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease; }
      `}</style>

      {/* ── Operator Bridge — Obsidian gate, ghost purple ambient glow ──── */}
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
        }}
      >
        {/* Purple→Blue power rail — 1px gradient top border */}
        <div style={{
          height:     '1px',
          background: 'linear-gradient(to right, transparent, rgba(139,92,246,0.7) 40%, rgba(59,130,246,0.5) 70%, transparent)',
        }} />

        <div style={{ padding: '20px 18px 22px' }}>

          {/* ── TERMINAL HEADER ─────────────────────────────────────────── */}
          <div style={{ marginBottom: '10px' }}>
            <div
              className="font-bold font-mono flex items-center gap-1"
              style={{ fontSize: '13px', color: '#f4f4f5', letterSpacing: '0.06em' }}
            >
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

          {/* ── PRIMARY CTA — CONNECT OPERATOR ──────────────────────────── */}
          <button
            onClick={onConnect}
            className="connect-btn w-full font-bold font-mono rounded-sm"
            style={{
              backgroundColor: T.color.blue,
              color:           '#000000',
              fontSize:        '12px',
              letterSpacing:   '0.12em',
              padding:         '11px 16px',
              // Rest state: soft 15px halo — warm, powered, waiting
              border:    '1px solid rgba(255,255,255,0.40)',
              boxShadow:
                '0 0 15px rgba(59,130,246,0.60), ' +
                '0 0 30px rgba(59,130,246,0.25), ' +
                'inset 0 0 5px rgba(255,255,255,0.30), ' +
                'inset 0 1px 0 rgba(255,255,255,0.40)',
            }}
            onMouseEnter={e => {
              // Hover: sharp neon flare — concentrated inner corona, not a wide bloom
              // White core (4px) → full-opacity blue (8px) → tight 15px halo
              e.currentTarget.style.backgroundColor = '#5b9eff';
              e.currentTarget.style.borderColor      = 'rgba(255,255,255,0.70)';
              e.currentTarget.style.boxShadow =
                '0 0 4px  rgba(255,255,255,0.90), ' +   // sharp white inner core
                '0 0 8px  rgba(59,130,246,1.00), ' +    // concentrated blue at full opacity
                '0 0 15px rgba(59,130,246,0.95), ' +    // tight 15px neon halo
                '0 0 28px rgba(59,130,246,0.30), ' +    // soft ambient (kept narrow)
                'inset 0 0 10px rgba(255,255,255,0.40), ' +
                'inset 0 1px 0  rgba(255,255,255,0.70)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = T.color.blue;
              e.currentTarget.style.borderColor      = 'rgba(255,255,255,0.40)';
              e.currentTarget.style.boxShadow =
                '0 0 15px rgba(59,130,246,0.60), ' +
                '0 0 30px rgba(59,130,246,0.25), ' +
                'inset 0 0 5px rgba(255,255,255,0.30), ' +
                'inset 0 1px 0 rgba(255,255,255,0.40)';
            }}
          >
            CONNECT OPERATOR
          </button>

          {/* ── SECONDARY SLOT — WATCH-ONLY ADDRESS ─────────────────────── */}
          <div style={{ marginTop: '10px', position: 'relative' }}>
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

          {/* ── STATUS RAIL ─────────────────────────────────────────────── */}
          <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.35 }}>
            <div
              className="dot-pulse"
              style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'rgba(168,85,247,0.85)' }}
            />
            <span className="font-mono" style={{ fontSize: '9px', color: T.text.muted, letterSpacing: '0.12em' }}>
              AWAITING OPERATOR CREDENTIALS
            </span>
          </div>

        </div>
      </div>
    </>
  );
}
