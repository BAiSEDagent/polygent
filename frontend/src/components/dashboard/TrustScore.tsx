import { Shield, CheckCircle, ExternalLink } from 'lucide-react';

interface TrustScoreProps {
  score: {
    score: number; // 0-100
    attestationCount: number;
    lastUpdate: number | null;
    verified: boolean;
  };
}

export function TrustScore({ score }: TrustScoreProps) {
  // Color coding based on score
  const getScoreColor = (s: number): string => {
    if (s >= 80) return 'text-emerald-400';
    if (s >= 60) return 'text-yellow-400';
    if (s >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  const getScoreLabel = (s: number): string => {
    if (s >= 80) return 'Excellent';
    if (s >= 60) return 'Good';
    if (s >= 40) return 'Fair';
    if (s > 0) return 'Limited';
    return 'Unverified';
  };

  const scoreColor = getScoreColor(score.score);
  const scoreLabel = getScoreLabel(score.score);

  // Placeholder — will be replaced with real EAS schema URL
  const easSchemaUrl = 'https://base.easscan.org/schema/view/0x...';

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-blue-400" />
        <h2 className="text-lg font-semibold text-zinc-100">Trust Score</h2>
      </div>

      {/* Score Display */}
      {score.score > 0 ? (
        <>
          <div className="flex items-baseline gap-2 mb-2">
            <span className={`text-4xl font-bold ${scoreColor}`}>{score.score}</span>
            <span className="text-zinc-500">/100</span>
          </div>
          <div className={`text-sm font-medium ${scoreColor} mb-6`}>{scoreLabel}</div>

          {/* Attestations */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">EAS Attestations</span>
              <span className="text-zinc-100 font-medium">{score.attestationCount}</span>
            </div>
            {score.verified && (
              <div className="flex items-center gap-2 text-sm text-emerald-400">
                <CheckCircle className="w-4 h-4" />
                <span>Verified Agent</span>
              </div>
            )}
            {score.lastUpdate && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-500">Last Update</span>
                <span className="text-zinc-400 font-mono text-xs">
                  {new Date(score.lastUpdate).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          {/* View on EAS */}
          <a
            href={easSchemaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium text-zinc-100 transition-all"
          >
            View Attestations
            <ExternalLink className="w-4 h-4" />
          </a>
        </>
      ) : (
        <>
          {/* Unverified State */}
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-800 flex items-center justify-center">
              <Shield className="w-8 h-8 text-zinc-600" />
            </div>
            <div className="text-zinc-400 text-sm mb-1">No attestations yet</div>
            <div className="text-zinc-600 text-xs mb-6">
              Earn trust by completing trades and building reputation
            </div>
            <a
              href="https://docs.attest.sh/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium text-white transition-all"
            >
              Learn about EAS
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </>
      )}

      {/* EAS Integration Notice */}
      <div className="mt-6 pt-4 border-t border-zinc-800">
        <div className="text-xs text-zinc-500 leading-relaxed">
          <strong className="text-zinc-400">Ethereum Attestation Service (EAS)</strong> integration
          provides cryptographic proof of agent performance, strategy verification, and community reputation.
        </div>
      </div>
    </div>
  );
}
