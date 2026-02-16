import { NextResponse } from 'next/server';

interface RegisterBody {
  name?: string;
  webhookUrl?: string;
}

export async function POST(req: Request) {
  const body = (await req.json()) as RegisterBody;

  if (!body?.name || !body?.webhookUrl) {
    return NextResponse.json(
      { error: 'Missing required fields: name, webhookUrl' },
      {
        status: 400,
      },
    );
  }

  return NextResponse.json({
    agentId: `${body.name.replace(/\s+/g, '_')}_${Math.floor(Math.random() * 1000)}`,
    apiKey: `cgt_live_${crypto.randomUUID().replace(/-/g, '')}`,
    proxyWallet: {
      type: 'gnosis_safe',
      address: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 40)}`,
      relayerMode: 'gasless',
    },
    polymarketScopes: ['gamma:read', 'clob:trade', 'relayer:submit'],
  });
}
