import { config } from '../src/config';
import { getOperatorWallet } from '../src/core/wallet';

/**
 * Register as a Polymarket builder.
 *
 * Run: npx ts-node scripts/register-builder.ts
 *
 * This script registers Cogent as a builder with Polymarket's CLOB.
 * After registration, you'll receive a builderId to set in .env.
 */

async function main() {
  console.log('🏗️  Registering as Polymarket builder...\n');

  const wallet = getOperatorWallet();
  if (!wallet) {
    console.error('❌ OPERATOR_PRIVATE_KEY not set in .env');
    process.exit(1);
  }

  console.log(`Operator wallet: ${wallet.address}`);
  console.log(`CLOB URL: ${config.POLYMARKET_CLOB_URL}\n`);

  try {
    // Step 1: Request API key from CLOB
    const nonceRes = await fetch(`${config.POLYMARKET_CLOB_URL}/auth/nonce`, {
      method: 'GET',
    });

    if (!nonceRes.ok) {
      throw new Error(`Failed to get nonce: ${nonceRes.status}`);
    }

    const { nonce } = (await nonceRes.json()) as { nonce: string };

    // Step 2: Sign the nonce
    const signature = await wallet.signMessage(nonce);

    // Step 3: Derive API key
    const deriveRes = await fetch(`${config.POLYMARKET_CLOB_URL}/auth/derive-api-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: wallet.address,
        nonce,
        signature,
      }),
    });

    if (!deriveRes.ok) {
      throw new Error(`Failed to derive API key: ${deriveRes.status} ${await deriveRes.text()}`);
    }

    const result = (await deriveRes.json()) as {
      apiKey: string;
      secret: string;
      passphrase: string;
    };

    console.log('✅ Builder registration successful!\n');
    console.log('Add these to your .env file:');
    console.log(`BUILDER_API_KEY=${result.apiKey}`);
    console.log(`BUILDER_SECRET=${result.secret}`);
    console.log(`BUILDER_PASSPHRASE=${result.passphrase}`);
  } catch (error) {
    console.error(`❌ Registration failed: ${(error as Error).message}`);
    console.log('\nMake sure:');
    console.log('1. OPERATOR_PRIVATE_KEY is set in .env');
    console.log('2. The CLOB API is reachable');
    console.log('3. Your wallet has been approved as a builder');
    process.exit(1);
  }
}

main();
