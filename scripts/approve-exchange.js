#!/usr/bin/env node
/**
 * Approve Polymarket Exchange to spend USDC.e
 * Run this once after funding wallet with USDC.e
 */

const { ethers } = require('ethers');

const USDC_E = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
const CTF_EXCHANGE = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';
const POLYGON_RPC = 'https://polygon-rpc.com';

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)'
];

async function approveExchange() {
  const pk = process.env.PK;
  if (!pk) throw new Error('PK env var required');

  const provider = new ethers.JsonRpcProvider(POLYGON_RPC);
  const wallet = new ethers.Wallet(pk, provider);
  const usdc = new ethers.Contract(USDC_E, ERC20_ABI, wallet);

  console.log('🔍 Checking wallet:', wallet.address);
  
  const balance = await usdc.balanceOf(wallet.address);
  console.log('💰 USDC.e balance:', ethers.formatUnits(balance, 6));

  const currentAllowance = await usdc.allowance(wallet.address, CTF_EXCHANGE);
  console.log('📊 Current allowance:', ethers.formatUnits(currentAllowance, 6));

  if (currentAllowance > 0n) {
    console.log('✅ Already approved!');
    return;
  }

  console.log('📝 Approving Polymarket Exchange...');
  const tx = await usdc.approve(CTF_EXCHANGE, ethers.MaxUint256);
  console.log('⏳ Transaction sent:', tx.hash);
  
  await tx.wait();
  console.log('✅ Approved! You can now trade on Polymarket.');
}

approveExchange().catch(console.error);
