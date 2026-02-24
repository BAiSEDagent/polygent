#!/usr/bin/env node
/**
 * Approve Polymarket Exchange to spend USDC.e
 * Run this once after funding wallet with USDC.e
 */

const { ethers } = require('ethers');

const USDC_E = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
const CTF = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045';
const CTF_EXCHANGE = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';
const POLYGON_RPC = 'https://polygon-pokt.nodies.app';

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)'
];

const ERC1155_ABI = [
  'function setApprovalForAll(address operator, bool approved)',
  'function isApprovedForAll(address account, address operator) view returns (bool)'
];

async function approveExchange() {
  const pk = process.env.PK || process.env.PRIVATE_KEY;
  if (!pk) throw new Error('PK or PRIVATE_KEY env var required');

  const provider = new ethers.providers.JsonRpcProvider(POLYGON_RPC);
  const wallet = new ethers.Wallet(pk, provider);
  const usdc = new ethers.Contract(USDC_E, ERC20_ABI, wallet);

  console.log('🔍 Wallet:', wallet.address);
  console.log('');
  
  const balance = await usdc.balanceOf(wallet.address);
  console.log('💰 USDC.e balance:', ethers.formatUnits(balance, 6));
  console.log('');

  // Check and approve USDC.e for Exchange directly (BUY orders)
  console.log('📊 Checking USDC.e → Exchange approval...');
  const exchangeAllowance = await usdc.allowance(wallet.address, CTF_EXCHANGE);
  console.log('   Current:', ethers.formatUnits(exchangeAllowance, 6));

  if (exchangeAllowance === 0n) {
    console.log('📝 Approving Exchange to spend USDC.e...');
    const tx1 = await usdc.approve(CTF_EXCHANGE, ethers.MaxUint256);
    console.log('⏳ TX:', tx1.hash);
    await tx1.wait();
    console.log('✅ Exchange approved!');
    console.log('');
  } else {
    console.log('✅ Exchange already approved');
    console.log('');
  }

  // Check and approve USDC.e for CTF (splits collateral into outcome tokens)
  console.log('📊 Checking USDC.e → CTF approval...');
  const ctfAllowance = await usdc.allowance(wallet.address, CTF);
  console.log('   Current:', ethers.formatUnits(ctfAllowance, 6));

  if (ctfAllowance === 0n) {
    console.log('📝 Approving CTF to spend USDC.e...');
    const tx2 = await usdc.approve(CTF, ethers.MaxUint256);
    console.log('⏳ TX:', tx2.hash);
    await tx2.wait();
    console.log('✅ CTF approved!');
    console.log('');
  } else {
    console.log('✅ CTF already approved');
    console.log('');
  }

  // Check and approve CTF for Exchange (trades outcome tokens)
  console.log('📊 Checking CTF → Exchange approval...');
  const ctf = new ethers.Contract(CTF, ERC1155_ABI, wallet);
  const exchangeApproved = await ctf.isApprovedForAll(wallet.address, CTF_EXCHANGE);
  console.log('   Approved:', exchangeApproved);

  if (!exchangeApproved) {
    console.log('📝 Approving Exchange to trade outcome tokens...');
    const tx3 = await ctf.setApprovalForAll(CTF_EXCHANGE, true);
    console.log('⏳ TX:', tx3.hash);
    await tx3.wait();
    console.log('✅ Exchange approved!');
    console.log('');
  } else {
    console.log('✅ Exchange already approved');
    console.log('');
  }

  console.log('✅ All approvals set! You can now trade on Polymarket.');
}

approveExchange().catch(console.error);
