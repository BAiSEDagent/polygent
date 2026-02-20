import { useEffect, useState } from 'react';
import { Terminal, Activity, Shield } from 'lucide-react';
import { TERMINAL_STEPS } from './components/landing/TerminalData';

const stats = [
  { label: '24h Volume', value: '$327,109' },
  { label: 'Active Agents', value: '4' },
  { label: 'Total Trades', value: '1,842' },
  { label: 'Network PnL', value: '+11.9%', color: 'text-green-500' },
];

const features = [
  { icon: Terminal, title: 'Simple SDK', desc: 'One line to connect. One line to trade. Full TypeScript support.' },
  { icon: Activity, title: 'Real-Time Data', desc: 'Milliseconds matter. Get live CLOB updates via WebSocket.' },
  { icon: Shield, title: 'Gasless Execution', desc: 'We handle the Polygon gas. You focus on the alpha.' },
];

export function Landing() {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % TERMINAL_STEPS.length);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  const step = TERMINAL_STEPS[stepIndex];

  return (
    <main className="min-h-screen bg-[#050505] text-[#E4E4E7] font-sans selection:bg-blue-500/30 relative">
      <div className="fixed inset-0 pointer-events-none bg-[linear-gradient(to_right,#1f1f22_1px,transparent_1px),linear-gradient(to_bottom,#1f1f22_1px,transparent_1px)] bg-[size:40px_40px] bg-fixed" />

      <nav className="relative z-10 flex items-center justify-between px-8 py-6 border-b border-white/5 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500 rotate-45" />
          <span className="font-mono font-bold tracking-wider">POLYGENT_</span>
        </div>
        <div className="flex gap-6 text-sm font-mono text-zinc-500">
          <span className="text-green-500">● SYSTEMS NORMAL</span>
          <span>v1.0.4</span>
        </div>
      </nav>

      <section className="relative z-10 pt-24 pb-12 text-center px-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 mb-8 border rounded-full border-blue-500/20 bg-blue-500/5 text-blue-400 font-mono text-xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
          </span>
          LIVE ON POLYMARKET CLOB
        </div>
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50">
          Infrastructure for <br />
          <span className="font-mono text-blue-500">Autonomous Capital</span>
        </h1>
        <p className="text-xl text-zinc-400 max-w-2xl mx-auto mb-12 leading-relaxed">
          The non-custodial execution layer for AI Agents.<br />
          Access 50+ prediction markets via one unified API.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href="/skill#deploy"
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-mono font-bold rounded-sm transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)]"
          >
            DEPLOY AGENT
          </a>
          <a
            href="/skill"
            className="px-8 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-zinc-300 font-mono rounded-sm backdrop-blur-md"
          >
            VIEW DOCS
          </a>
          <a
            href="/dashboard"
            className="px-8 py-3 bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/20 text-emerald-200 font-mono rounded-sm"
          >
            OPEN DASHBOARD
          </a>
        </div>
      </section>

      <section className="relative z-10 py-12 border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center px-4">
          {stats.map((stat, i) => (
            <div key={i}>
              <div className={`text-3xl font-mono font-bold mb-1 ${stat.color || 'text-white'}`}>
                {stat.value}
              </div>
              <div className="text-xs font-mono text-zinc-500 uppercase tracking-widest">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 py-24 max-w-6xl mx-auto grid md:grid-cols-2 gap-16 px-6 items-center bg-transparent">
        <div>
          <h2 className="text-3xl font-bold mb-6">Build. Test. Deploy.</h2>
          <div className="space-y-6">
            {features.map((item, i) => (
              <div key={i} className="flex gap-4">
                <div className="mt-1 w-10 h-10 rounded-sm bg-white/5 border border-white/10 flex items-center justify-center">
                  <item.icon className="w-5 h-5 text-zinc-400" />
                </div>
                <div>
                  <h3 className="font-mono font-bold text-zinc-200">{item.title}</h3>
                  <p className="text-sm text-zinc-500 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/20 backdrop-blur-sm p-6 font-mono text-sm shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500" />
          <div className="flex justify-between items-center mb-4">
            <div className="text-xs font-mono uppercase tracking-widest text-zinc-500">{step.action}</div>
            <div className={`text-xs font-mono ${step.color}`}>LIVE</div>
          </div>
          <pre className="space-y-2 text-zinc-500 whitespace-pre-wrap">
            {step.code}
          </pre>
        </div>
      </section>
    </main>
  );
}
