import { NextResponse } from 'next/server';
import { config } from '@/lib/config';

// Serve Farcaster manifest at /.well-known/farcaster.json
export async function GET() {
  const manifest = {
    // accountAssociation will be filled in after domain verification
    accountAssociation: {
      header: '',
      payload: '',
      signature: '',
    },
    miniapp: {
      version: '1',
      name: config.APP_NAME,
      iconUrl: `${config.APP_URL}/icon.png`,
      homeUrl: config.APP_URL,
      splashImageUrl: `${config.APP_URL}/splash.png`,
      splashBackgroundColor: '#0A0A0F',
      webhookUrl: `${config.APP_URL}/api/webhook`,
      requiredChains: ['eip155:8453'], // Base
      requiredCapabilities: [
        'wallet.getEthereumProvider',
        'actions.composeCast',
      ],
      description: config.APP_DESCRIPTION,
      tags: ['trading', 'ai', 'prediction-markets', 'agents'],
    },
  };

  return NextResponse.json(manifest, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
