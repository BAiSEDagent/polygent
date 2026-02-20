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
        /* 3s Purple Pulse — cursor and status dot share the same rhythm */
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
      `}</style>

      {/* ── Operator Bridge — Obsidian gate with ghost purple glow ─────── */}
      <div
        className="bridge-module rounded-sm"
        style={{
          // Deep Obsidian base
          backgroundColor:      '#050505',
          backdropFilter:       'blur(25px)',
          WebkitBackdropFilter: 'blur(25px)',
          // Ghost purple ambient under-glow spills onto grid behind module
          border:               '1px solid rgba(139,92,246,0.20)',
          display:              'flex',
          flexDirection:        'column',
          gap:                  '0',
          overflow:             'hidden',
        }}
      >
        {/* Purple accent rail — 1px top border power indicator */}
        <div style={{
          height:          '1px',
          background:      'linear-gradient(to right, transparent, rgba(139,92,246,0.7) 40%, rgba(59,130,246,0.5) 70%, transparent)',
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

            {/* Subtext — dimmed metadata */}
            <p
              className="font-mono"
              style={{
                fontSize:    '10px',
                lineHeight:  1.5,
                color:       T.text.muted,
                opacity:     0.30,
                marginTop:   '6px',
                letterSpacing: '0.02em',
              }}
            >
              Initialize EOA link to enable<br />agent copy-trading protocols
            </p>
          </div>

          {/* Divider */}
          <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.05)', margin: '14px 0' }} />

          {/* ── PRIMARY CTA — CONNECT OPERATOR ──────────────────────────── */}
          <button
            onClick={onConnect}
            className="w-full font-bold font-mono rounded-sm transition-all"
            style={{
              // Solid Electric Blue with physical raised feel
              backgroundColor: T.color.blue,
              color:           '#000000',
              fontSize:        '12px',
              letterSpacing:   '0.12em',
              padding:         '11px 16px',
              // 15px outer glow + 1px white top-edge highlight (raised hardware)
              // High-voltage: white edge defines physical boundary
              // Inset glow = backlit hardware panel
              border:    '1px solid rgba(255,255,255,0.40)',
              boxShadow:
                '0 0 15px rgba(59,130,246,0.60), ' +
                '0 0 30px rgba(59,130,246,0.25), ' +
                'inset 0 0 5px rgba(255,255,255,0.30), ' +
                'inset 0 1px 0 rgba(255,255,255,0.40)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = '#60a5fa';
              e.currentTarget.style.boxShadow =
                '0 0 22px rgba(59,130,246,0.90), ' +
                '0 0 50px rgba(59,130,246,0.45), ' +
                'inset 0 0 8px rgba(255,255,255,0.35), ' +
                'inset 0 1px 0 rgba(255,255,255,0.50)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = T.color.blue;
              e.currentTarget.style.boxShadow =
                '0 0 15px rgba(59,130,246,0.70), ' +
                '0 0 30px rgba(59,130,246,0.30), ' +
                'inset 0 1px 0 rgba(255,255,255,0.30)';
            }}
          >
            CONNECT OPERATOR
          </button>

          {/* ── SECONDARY SLOT — WATCH-ONLY ADDRESS ─────────────────────── */}
          <div style={{ marginTop: '10px', position: 'relative' }}>
            {/* Recessed trench label */}
            <div
              className="font-mono"
              style={{
                fontSize:      '8px',
                letterSpacing: '0.16em',
                color:         T.text.muted,
                opacity:       0.3,
                marginBottom:  '5px',
                textTransform: 'uppercase',
              }}
            >
              Watch-Only Mode
            </div>

            <input
              type="text"
              value={watchAddress}
              onChange={e => setWatchAddress(e.target.value)}
              placeholder="ENTER WATCH-ONLY ADDRESS"
              className="w-full font-mono rounded-sm"
              style={{
                // Recessed slot — dashed border at 20% opacity
                // Recessed glass bay — matches Leaderboard smoked glass
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
                e.currentTarget.style.borderColor  = 'rgba(139,92,246,0.45)';
                e.currentTarget.style.boxShadow    = 'inset 0 2px 8px rgba(0,0,0,0.70), 0 0 10px rgba(139,92,246,0.15)';
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor  = 'rgba(255,255,255,0.20)';
                e.currentTarget.style.boxShadow    = 'inset 0 2px 8px rgba(0,0,0,0.70)';
              }}
            />
          </div>

          {/* ── STATUS RAIL — bottom of module ──────────────────────────── */}
          <div
            style={{
              marginTop:     '16px',
              display:       'flex',
              alignItems:    'center',
              gap:           '6px',
              opacity:       0.35,
            }}
          >
            <div
              className="dot-pulse"
              style={{
                width: '5px', height: '5px', borderRadius: '50%',
                backgroundColor: 'rgba(168,85,247,0.85)',
              }}
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
