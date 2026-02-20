import { useState } from 'react';
import { ethers } from 'ethers';

export default function Connect() {
  const [address, setAddress] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const ensurePolygon = async (provider: any) => {
    const chainHex = '0x89'; // 137
    const current = await provider.send('eth_chainId', []);
    if (current === chainHex) return;
    try {
      await provider.send('wallet_switchEthereumChain', [{ chainId: chainHex }]);
    } catch {
      await provider.send('wallet_addEthereumChain', [{
        chainId: chainHex,
        chainName: 'Polygon Mainnet',
        nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
        rpcUrls: ['https://polygon-rpc.com'],
        blockExplorerUrls: ['https://polygonscan.com'],
      }]);
    }
  };

  const connect = async () => {
    setBusy(true);
    setError('');
    try {
      const eth = (window as any).ethereum;
      if (!eth) throw new Error('No wallet found. Install MetaMask.');
      const provider = new ethers.providers.Web3Provider(eth, 'any');
      await provider.send('eth_requestAccounts', []);
      await ensurePolygon(provider);
      const signer = provider.getSigner();
      const addr = await signer.getAddress();
      setAddress(addr);
    } catch (e: any) {
      setError(e?.message || 'Wallet connection failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold mb-2">Connect Your Wallet</h1>
        <p className="text-gray-500 mb-6">Connect to deploy copy-trading session keys on Polygon</p>
        <button
          onClick={connect}
          disabled={busy}
          className="px-6 py-3 bg-accent-blue hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-colors"
        >
          {busy ? 'Connecting...' : address ? 'Connected' : 'Connect Wallet'}
        </button>
        {address && <p className="mt-3 text-sm text-green-400 font-mono">{address}</p>}
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}
