import { useState } from 'react';
import { Shield, Zap, X, Terminal, CheckCircle2 } from 'lucide-react';
import { ethers } from 'ethers';
import { ClobClient } from '@polymarket/clob-client';

type Props = {
  agentId: string;
  agentName: string;
  onClose: () => void;
};

export default function CopyDelegationModal({ agentId, agentName, onClose }: Props) {
  const [allocation, setAllocation] = useState<number>(50);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState<string>('');

  const handleDeploy = async () => {
    setError('');
    setStep(2);

    try {
      const eth = (window as any).ethereum;
      if (!eth) throw new Error('No wallet detected. Install MetaMask.');

      const provider = new ethers.providers.Web3Provider(eth, 'any');
      await provider.send('eth_requestAccounts', []);
      const signer = provider.getSigner();
      const copierAddress = await signer.getAddress();

      const clobClient = new ClobClient('https://clob.polymarket.com', 137, signer as any);
      const creds = await clobClient.createOrDeriveApiKey();

      const resp = await fetch('/api/copiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          copierAddress,
          agentId,
          fixedUsdc: allocation,
          apiKey: creds.key,
          apiSecret: creds.secret,
          apiPassphrase: creds.passphrase,
        }),
      });

      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.error || `Failed (${resp.status})`);
      }

      setStep(3);
    } catch (e: any) {
      setError(e?.message || 'Failed to deploy copier');
      setStep(1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md border border-[#1f1f22] bg-[#050505] rounded-sm shadow-[0_0_40px_rgba(0,0,0,0.8)] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-[#1f1f22] bg-[linear-gradient(to_right,#1f1f22_1px,transparent_1px),linear-gradient(to_bottom,#1f1f22_1px,transparent_1px)] bg-[size:20px_20px]">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-500" />
            <span className="font-mono text-sm font-bold text-white uppercase tracking-widest">Deploy_Copier</span>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {step === 1 && (
          <div className="p-6 space-y-6">
            <div>
              <div className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-1">Target Agent</div>
              <div className="text-lg font-mono font-bold text-white">{agentName}</div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <div className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Fixed Trade Size</div>
                <div className="text-sm font-mono text-blue-400 font-bold">${allocation} USDC</div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[10, 25, 50, 100].map((val) => (
                  <button
                    key={val}
                    onClick={() => setAllocation(val)}
                    className={`py-2 font-mono text-xs border rounded-sm transition-all ${
                      allocation === val
                        ? 'bg-blue-500/10 border-blue-500 text-blue-400'
                        : 'bg-transparent border-[#1f1f22] text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    ${val}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-sm space-y-2">
              <div className="flex items-center gap-2 text-green-400 font-mono text-xs font-bold uppercase">
                <Shield className="w-3 h-3" /> Non-Custodial
              </div>
              <p className="text-xs font-mono text-zinc-400 leading-relaxed">
                You will sign a trade-only session key. Polygent cannot withdraw funds.
              </p>
            </div>

            {error && <div className="text-xs text-red-400 font-mono">{error}</div>}

            <button
              onClick={handleDeploy}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-mono font-bold text-sm rounded-sm transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)]"
            >
              GENERATE SESSION KEY
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="p-12 flex flex-col items-center justify-center space-y-4">
            <div className="relative flex h-12 w-12 items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-20"></span>
              <Terminal className="relative w-6 h-6 text-blue-500" />
            </div>
            <div className="text-center space-y-1">
              <div className="font-mono font-bold text-white">Awaiting Signature</div>
              <div className="font-mono text-xs text-zinc-500">Please check your wallet...</div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="p-12 flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
            </div>
            <div className="text-center space-y-1">
              <div className="font-mono font-bold text-green-400">Copier Deployed</div>
              <div className="font-mono text-xs text-zinc-400">Shadow engine is now mirroring {agentName}</div>
            </div>
            <button onClick={onClose} className="mt-4 px-6 py-2 bg-[#1f1f22] hover:bg-zinc-800 text-white font-mono text-xs rounded-sm transition-colors">
              RETURN TO TERMINAL
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
