import 'dotenv/config';
import { JsonRpcProvider, Contract, WebSocketProvider } from 'ethers';
import fetch from 'node-fetch';
import sqlite3 from 'sqlite3';
import { makeProvider } from './provider.js';

// Environment variables
const TG_TOKEN = process.env.TG_BOT_TOKEN;
const TG_CHAT = process.env.TG_CHAT_ID;
const MIN_SUPPLY = BigInt(process.env.MIN_SUPPLY || '0');
const FACTORIES = (process.env.FACTORIES || '0x3b44b2a187a7b3824131f8db5a74194d0a42fc15,0x7c9fa4433e491c39765cc44df0b7f2c5d86e6e6b,0x9deB29c9A4c7A88a3C0257393b7f3335338D9A9D').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
const CRO_DEC = Number(process.env.CRO_DECIMALS || '18');

// Multiple RPC endpoints for redundancy
const RPC_ENDPOINTS = [
  'https://evm.cronos.org',
  'https://cronos.blockpi.network/v1/rpc/public',
  'https://cronos-rpc.publicnode.com',
  'https://cronos.drpc.org'
];

const CRONOS_NETWORK = { name: "cronos", chainId: 25 };

// Helper functions
const ago = (unixMs) => {
  const s = Math.max(1, Math.floor((Date.now() - unixMs)/1000));
  const units = [[31536000,'y'],[2592000,'mo'],[604800,'w'],[86400,'d'],[3600,'h'],[60,'m']];
  for (const [sec, tag] of units) if (s >= sec) return `${Math.floor(s/sec)}${tag} ago`;
  return `${s}s ago`;
};

const croFmt = (wei) => {
  const s = wei.toString().padStart(CRO_DEC+1,'0');
  const i = s.length - CRO_DEC;
  return (s.slice(0,i)+'.'+s.slice(i)).replace(/^0+(\d)/,'$1');
};

// Enhanced retry function with exponential backoff
async function retryWithBackoff(fn, maxRetries = 5, baseDelay = 1000) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isRateLimit = error?.code === 'SERVER_ERROR' && 
                         error?.info?.responseStatus?.includes('429');
      const isNetworkError = error?.code === 'NETWORK_ERROR' || 
                            error?.code === 'TIMEOUT';
      
      if (attempt === maxRetries - 1) throw error;
      
      if (isRateLimit) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        console.log(`Rate limited, waiting ${Math.round(delay)}ms before retry ${attempt + 1}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else if (isNetworkError) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`Network error, waiting ${Math.round(delay)}ms before retry ${attempt + 1}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error; // Don't retry other errors
      }
    }
  }
}

// Provider management with fallback
class ProviderManager {
  constructor() {
    this.currentIndex = 0;
    this.providers = RPC_ENDPOINTS.map(url => 
      new JsonRpcProvider(url, CRONOS_NETWORK, {
        batchMaxCount: 10, // Increased from 1 for better performance
        batchStallTime: 10, // Added small stall time
        batchMaxSize: 1000 // Added max size
      })
    );
    this.currentProvider = this.providers[0];
  }

  async switchProvider() {
    this.currentIndex = (this.currentIndex + 1) % this.providers.length;
    this.currentProvider = this.providers[this.currentIndex];
    console.log(`🔄 Switched to RPC endpoint: ${RPC_ENDPOINTS[this.currentIndex]}`);
    
    // Test the new provider
    try {
      await this.currentProvider.getBlockNumber();
      console.log(`✅ New provider is working`);
      return true;
    } catch (error) {
      console.log(`❌ New provider failed, trying next...`);
      return this.switchProvider();
    }
  }

  async executeWithFallback(operation) {
    for (let attempt = 0; attempt < this.providers.length; attempt++) {
      try {
        return await retryWithBackoff(() => operation(this.currentProvider));
      } catch (error) {
        console.log(`❌ Provider ${this.currentIndex} failed:`, error.message);
        if (attempt < this.providers.length - 1) {
          await this.switchProvider();
        } else {
          throw error;
        }
      }
    }
  }
}

// Database setup
const db = new sqlite3.Database('cronos.db');
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS seen(address TEXT PRIMARY KEY, block INTEGER, ts INTEGER)`);
});

const seen = (addr) => {
  return new Promise((resolve) => {
    db.get('SELECT 1 FROM seen WHERE address=?', [addr.toLowerCase()], (err, row) => {
      resolve(!!row);
    });
  });
};

const mark = (addr, block) => {
  return new Promise((resolve) => {
    db.run('INSERT OR IGNORE INTO seen VALUES (?,?,?)', [addr.toLowerCase(), block, Date.now()], resolve);
  });
};

// ERC20 ABI
const erc20Abi = [
  { "constant": true, "inputs": [], "name": "name", "outputs": [{"name": "", "type": "string"}], "type": "function" },
  { "constant": true, "inputs": [], "name": "symbol", "outputs": [{"name": "", "type": "string"}], "type": "function" },
  { "constant": true, "inputs": [], "name": "decimals", "outputs": [{"name": "", "type": "uint8"}], "type": "function" },
  { "constant": true, "inputs": [], "name": "totalSupply", "outputs": [{"name": "", "type": "uint256"}], "type": "function" },
  { "constant": true, "inputs": [{"name": "_owner", "type": "address"}], "name": "balanceOf", "outputs": [{"name": "balance", "type": "uint256"}], "type": "function" }
];

// Transfer event topic for minting detection
const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const zeroAddress = '0x0000000000000000000000000000000000000000';

// Pair detection
const pairCreatedTopic = '0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9';

// LP Token detection
async function detectLPTokens(provider, blockNumber) {
  try {
    // Look for PairCreated events from known factories
    const logs = await provider.getLogs({
      fromBlock: blockNumber,
      toBlock: blockNumber,
      topics: [pairCreatedTopic]
    });

    const lpEvents = [];
    
    for (const log of logs) {
      try {
        // Parse the PairCreated event
        const token0 = '0x' + log.topics[1].slice(26).toLowerCase();
        const token1 = '0x' + log.topics[2].slice(26).toLowerCase();
        const pairAddress = '0x' + log.topics[3].slice(26).toLowerCase();
        
        // Skip if we've already seen this LP pair
        if (await seen(pairAddress)) continue;
        
        // Get token symbols for better identification
        let token0Symbol = 'Unknown';
        let token1Symbol = 'Unknown';
        
        try {
          const token0Contract = new Contract(token0, erc20Abi, provider);
          const token1Contract = new Contract(token1, erc20Abi, provider);
          
          const [symbol0, symbol1] = await Promise.allSettled([
            token0Contract.symbol().catch(() => null),
            token1Contract.symbol().catch(() => null)
          ]);
          
          token0Symbol = symbol0.status === 'fulfilled' ? symbol0.value : 'Unknown';
          token1Symbol = symbol1.status === 'fulfilled' ? symbol1.value : 'Unknown';
        } catch (error) {
          console.log(`Error getting token symbols:`, error.message);
        }
        
        lpEvents.push({
          pairAddress,
          token0,
          token1,
          token0Symbol,
          token1Symbol,
          txHash: log.transactionHash,
          blockNumber
        });
        
        console.log(`🎯 Found LP pair creation: ${token0Symbol} / ${token1Symbol} at ${pairAddress}`);
      } catch (error) {
        console.log(`Error processing LP log:`, error.message);
      }
    }
    
    return lpEvents;
  } catch (error) {
    console.log(`Error detecting LP tokens:`, error.message);
    return [];
  }
}

// Minting detection
async function detectMinting(provider, blockNumber) {
  try {
    // Look for Transfer events from zero address (minting)
    const logs = await provider.getLogs({
      fromBlock: blockNumber,
      toBlock: blockNumber,
      topics: [transferTopic, '0x0000000000000000000000000000000000000000000000000000000000000000'] // from zero address
    });

    const mintingEvents = [];
    
    for (const log of logs) {
      try {
        // Extract token address and recipient
        const tokenAddress = log.address.toLowerCase();
        const recipient = '0x' + log.topics[2].slice(26).toLowerCase();
        const amount = BigInt(log.data);
        
        // Skip if we've already seen this token
        if (await seen(tokenAddress)) continue;
        
        // Probe the token to get metadata
        const meta = await probe(provider, tokenAddress);
        if (!meta) continue;
        
        mintingEvents.push({
          tokenAddress,
          recipient,
          amount,
          metadata: meta,
          txHash: log.transactionHash,
          logIndex: log.logIndex
        });
        
        console.log(`🎯 Found minting event for token ${meta.symbol}: ${amount} tokens to ${recipient}`);
      } catch (error) {
        console.log(`Error processing minting log:`, error.message);
      }
    }
    
    return mintingEvents;
  } catch (error) {
    console.log(`Error detecting minting:`, error.message);
    return [];
  }
}

async function findPair(provider, token, fromBlock, toBlock) {
  if (!FACTORIES.length) return null;
  const topics = [pairCreatedTopic, null, null];
  const addrLower = token.toLowerCase();
  
  for (const factory of FACTORIES) {
    try {
      const logs = await provider.getLogs({
        address: factory,
        topics,
        fromBlock, toBlock
      }).catch(() => []);
      
      for (const lg of logs) {
        const t0 = '0x'+lg.topics[1].slice(26).toLowerCase();
        const t1 = '0x'+lg.topics[2].slice(26).toLowerCase();
        if (t0 === addrLower || t1 === addrLower) return lg;
      }
    } catch (error) {
      console.log(`Error checking factory ${factory}:`, error.message);
    }
  }
  return null;
}

// Token probing - Enhanced for CRC-20 compatibility
async function probe(provider, address) {
  try {
    console.log(`🔍 Probing contract ${address} for CRC-20/ERC-20 compliance...`);
    
    const code = await retryWithBackoff(() => provider.getCode(address));
    if (code === '0x') {
      console.log(`❌ Contract ${address} has no code (not a contract)`);
      return null;
    }
    
    console.log(`✅ Contract ${address} has code, checking CRC-20/ERC-20 methods...`);
    const contract = new Contract(address, erc20Abi, provider);
    
    // Use Promise.allSettled to handle partial compliance gracefully
    const [nameResult, symbolResult, decimalsResult, totalSupplyResult] = await Promise.allSettled([
      contract.name().catch(() => null),
      contract.symbol().catch(() => null),
      contract.decimals().catch(() => null),
      contract.totalSupply().catch(() => null)
    ]);
    
    // Extract values safely
    const name = nameResult.status === 'fulfilled' ? nameResult.value : null;
    const symbol = symbolResult.status === 'fulfilled' ? symbolResult.value : null;
    const decimals = decimalsResult.status === 'fulfilled' ? decimalsResult.value : 18;
    const totalSupply = totalSupplyResult.status === 'fulfilled' ? totalSupplyResult.value : 0n;
    
    // Log results
    if (name) console.log(`✅ name(): "${name}"`);
    else console.log(`⚠️  name() failed or not implemented`);
    
    if (symbol) console.log(`✅ symbol(): "${symbol}"`);
    else console.log(`⚠️  symbol() failed or not implemented`);
    
    if (decimals !== null) console.log(`✅ decimals(): ${decimals}`);
    else console.log(`⚠️  decimals() failed, using default 18`);
    
    if (totalSupply !== null) console.log(`✅ totalSupply(): ${totalSupply.toString()}`);
    else console.log(`⚠️  totalSupply() failed, using 0`);
    
    // Determine if this is a potential CRC-20/ERC-20 token
    // More lenient: only need either name OR symbol to be considered valid
    if (!name && !symbol) {
      console.log(`❌ Contract ${address} is not a valid CRC-20/ERC-20 token (missing both name and symbol)`);
      return null;
    }
    
    // Log token type detection
    if (name && symbol) {
      console.log(`🎉 Contract ${address} is a fully compliant CRC-20/ERC-20 token!`);
    } else {
      console.log(`⚠️  Contract ${address} is a partial CRC-20/ERC-20 token (missing some methods)`);
    }
    
    return {
      name: name || 'Unknown',
      symbol: symbol || 'Unknown',
      decimals: decimals || 18,
      totalSupply: BigInt(totalSupply || 0),
      compliance: name && symbol ? 'full' : 'partial'
    };
  } catch (error) {
    console.log(`❌ Error probing contract ${address}:`, error.message);
    return null;
  }
}

// Telegram notification
async function tg(text, contractAddress = null, txHash = null) {
  if (!TG_TOKEN || !TG_CHAT) {
    console.log('Telegram notification (not sent - missing token or chat ID):', text);
    return;
  }
  
  const url = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
  
  // Prepare message payload
  const payload = {
    chat_id: TG_CHAT,
    text: text,
    disable_web_page_preview: true,
    parse_mode: 'HTML'
  };
  
  // Add inline keyboard if contract address is provided
  if (contractAddress) {
    const buyUrl = `https://t.me/CronusAgentBot?start=${encodeURIComponent('rongaped_' + contractAddress)}`;
    const cronoScanUrl = `https://cronoscan.com/tx/${txHash || ''}`;
    payload.reply_markup = {
      inline_keyboard: [
        [
          {
            text: '🛒 Buy Token',
            url: buyUrl
          },
          {
            text: '🔍 CronoScan',
            url: cronoScanUrl
          }
        ]
      ]
    };
  }
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('TG fail:', errorText);
    } else {
      console.log('✅ Telegram notification sent');
    }
  } catch (error) {
    console.error('Telegram request failed:', error.message);
  }
}

// Block processing - Enhanced to handle both hash strings and full transaction objects
async function handleBlock(provider, bn) {
  const block = await retryWithBackoff(() => provider.getBlock(bn, true), 'getBlock').catch(() => null);
  if (!block) return;

  const txs = block.transactions || [];
  let deployments = 0;
  let mintings = 0;
  let lpTokens = 0;

  // First, check for LP token events
  const lpEvents = await detectLPTokens(provider, bn);
  for (const event of lpEvents) {
    console.log(`🎯 Processing LP event for ${event.token0Symbol} / ${event.token1Symbol}`);
    
    const text =
`🆕 New LP Token Added!

Name: ${event.token0Symbol} / ${event.token1Symbol}
Address: ${event.pairAddress}
Block: ${bn}
Transaction: ${event.txHash}

Created: ${ago(Number(block.timestamp) * 1000)}`;

    await tg(text, event.pairAddress, event.txHash);
    await mark(event.pairAddress, bn);
    lpTokens++;
  }

  // Second, check for minting events
  const mintingEvents = await detectMinting(provider, bn);
  for (const event of mintingEvents) {
    console.log(`🎯 Processing minting event for ${event.metadata.symbol}`);
    
    // Format amount with decimals using BigInt arithmetic
    const decimals = event.metadata.decimals || 18;
    const divisor = BigInt(10 ** decimals);
    const wholePart = event.amount / divisor;
    const fractionalPart = event.amount % divisor;
    const formattedAmount = wholePart.toString() + (fractionalPart > 0n ? '.' + fractionalPart.toString().padStart(Number(decimals), '0').replace(/0+$/, '') : '');
    
    const text =
`🆕 New Token Minted!

Name: ${event.metadata.name || '-'} (${event.metadata.symbol || '-'})
Amount: ${formattedAmount} ${event.metadata.symbol}
CA: ${event.tokenAddress}
Block: ${bn}
Recipient: ${event.recipient}

Created: ${ago(Number(block.timestamp) * 1000)}`;

    await tg(text, event.tokenAddress, event.txHash);
    await mark(event.tokenAddress, bn);
    mintings++;
  }

  // Then check for contract deployments
  for (const raw of txs) {
    // Support both "hash string" and "full tx object"
    const isHash = typeof raw === 'string';
    const txHash = isHash ? raw : (raw?.hash || null);
    if (!txHash) continue;

    // Always drive off the receipt (works for factory/proxy creations too)
    const rc = await retryWithBackoff(() => provider.getTransactionReceipt(txHash), 'getReceipt').catch(() => null);
    if (!rc) continue;

    const addr = rc.contractAddress;
    if (!addr) {
      // Not a deployment; mint listener will catch first mints
      continue;
    }
    if (await seen(addr)) continue;

    console.log(`🏗️  Found contract deployment transaction: ${txHash}`);
    console.log(`📍 Contract deployed at: ${addr}`);

    // Probe token (CRC-20 == ERC-20 ABI with relaxed check)
    const meta = await probe(provider, addr).catch(() => null);
    if (!meta) {
      console.log(`❌ Contract ${addr} is not a valid CRC-20/ERC-20 token`);
      await mark(addr, bn); // Mark as seen even if not fully ERC-20 compliant
      continue;
    }

    // Optional MIN_SUPPLY filter
    if (MIN_SUPPLY > 0n && meta.totalSupply < MIN_SUPPLY) {
      console.log(`⚠️  Token ${meta.symbol} supply too low (${meta.totalSupply}), skipping`);
      await mark(addr, bn);
      continue;
    }

    console.log(`🎉 Found ${meta.compliance} CRC-20/ERC-20 token: ${meta.symbol} (${meta.name})`);

    // Compose alert + buttons
    const creator = rc.from ?? '0x0000000000000000000000000000000000000000';
    const croBal = croFmt(await retryWithBackoff(() => provider.getBalance(creator)).catch(() => 0n));
    let creatorPct = '0.00%';
    try {
      const c = new Contract(addr, erc20Abi, provider);
      const bal = BigInt(await c.balanceOf(creator).catch(() => 0n));
      creatorPct = meta.totalSupply > 0n ? (Number((bal * 10000n) / meta.totalSupply) / 100).toFixed(2) + '%' : '0.00%';
    } catch {}

    const text =
`🆕 New CRC-20 Token Detected

Name: ${meta.name || '-'} (${meta.symbol || '-'})
Pair: —
CA: ${addr}
Created: ${ago(Number(block.timestamp) * 1000)}
MarketCap: —
Holders: — | TOP 10: —

Creator: ${creator}
 ├CRO: ${croBal}
 └Token: ${creatorPct}`;

    const buyUrl = `https://t.me/CronusAgentBot?start=${encodeURIComponent('rongaped_' + addr)}`;
    const txUrl = `https://cronoscan.com/tx/${txHash}`;

    await tg(text, addr, txHash);

    await mark(addr, bn);
    deployments++;
  }

  if (deployments === 0 && mintings === 0 && lpTokens === 0) {
    // Keep logs clean; no more "malformed" spam
    // console.log(`📊 Block ${bn}: no token deployments, mintings, or LP tokens`);
  } else {
    console.log(`📊 Block ${bn}: ${deployments} deployments, ${mintings} mintings, ${lpTokens} LP tokens`);
  }
}



// Test function to probe a specific address
async function testAddress(address) {
  console.log(`🧪 Testing address: ${address}`);
  const providerManager = new ProviderManager();
  
  try {
    const meta = await probe(providerManager.currentProvider, address);
    if (meta) {
      console.log(`✅ Test successful! Token found:`);
      console.log(`   Name: ${meta.name}`);
      console.log(`   Symbol: ${meta.symbol}`);
      console.log(`   Decimals: ${meta.decimals}`);
      console.log(`   Total Supply: ${meta.totalSupply.toString()}`);
    } else {
      console.log(`❌ Test failed: Address is not a valid ERC-20 token`);
    }
  } catch (error) {
    console.error(`❌ Test error:`, error.message);
  }
}

// Main function
async function main() {
  console.log('🚀 Starting enhanced Cronos CRC-20/ERC-20 & LP token scanner with WebSocket...');
  console.log('='.repeat(60));
  console.log('Environment variables loaded:');
  console.log('  TG_TOKEN:', TG_TOKEN ? '✅ Set' : '❌ Not set');
  console.log('  TG_CHAT:', TG_CHAT ? '✅ Set' : '❌ Not set');
  console.log('  MIN_SUPPLY:', MIN_SUPPLY.toString());
  console.log('  CRONOS_WS:', process.env.CRONOS_WS ? '✅ Set' : '❌ Not set');
  console.log('  CRONOS_HTTP:', process.env.CRONOS_HTTP ? '✅ Set' : '❌ Not set');
  console.log('  RPC Endpoints:', RPC_ENDPOINTS.length);
  console.log('  Factories:', FACTORIES.length);
  console.log('='.repeat(60));

  // Check if we're testing a specific address
  const testAddr = process.argv[2];
  if (testAddr) {
    console.log(`🧪 Test mode: Testing address ${testAddr}`);
    await testAddress(testAddr);
    process.exit(0);
  }

  // Initialize provider manager
  const providerManager = new ProviderManager();
  let provider;

  try {
    // Try WebSocket first
    if (process.env.CRONOS_WS) {
      console.log('🔌 Attempting WebSocket connection...');

      try {
        provider = makeProvider();
        const currentBlock = await Promise.race([
          provider.getBlockNumber(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('WebSocket timeout')), 10000))
        ]);
        console.log(`✅ WebSocket connected! Current block: ${currentBlock}`);
      } catch (wsTestError) {
        console.log(`❌ WebSocket test failed: ${wsTestError.message}`);
        throw wsTestError;
      }

      console.log('🎧 Setting up efficient event listeners...');

      // Set up efficient log-based event listeners
      setupEventListeners(provider);

      console.log('✅ Event listeners active - monitoring for new events...');

      // Handle WebSocket errors
      provider._websocket?.on?.('error', (error) => {
        console.error(`❌ WebSocket error: ${error.message}`);
        console.log('🔄 Falling back to HTTP polling...');
        throw error;
      });

      // Handle WebSocket close
      provider._websocket?.on?.('close', (code, reason) => {
        console.error(`❌ WebSocket closed: ${code} - ${reason}`);
        console.log('🔄 Falling back to HTTP polling...');
        throw new Error('WebSocket connection closed');
      });

      // Keep the process alive
      process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down gracefully...');
        process.exit(0);
      });

    } else {
      throw new Error('No WebSocket URL configured');
    }
  } catch (wsError) {
    console.log(`⚠️  WebSocket failed: ${wsError.message}`);
    console.log('🔄 Falling back to HTTP polling...');

    // Fallback to HTTP polling with current block start
    provider = providerManager.currentProvider;
    let lastProcessed = await providerManager.executeWithFallback(provider => provider.getBlockNumber());
    console.log(`📍 Starting from current block: ${lastProcessed}`);

    let running = false;
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 10;
    let totalBlocksProcessed = 0;

    async function pollLoop() {
      if (running) return;
      running = true;

      try {
        while (true) {
          try {
            const latest = await providerManager.executeWithFallback(provider => provider.getBlockNumber());
            console.log(`Latest block: ${latest}, processing from ${lastProcessed + 1}`);

            while (lastProcessed < latest) {
              lastProcessed += 1;
              totalBlocksProcessed++;

              try {
                await handleBlock(providerManager.currentProvider, lastProcessed);
                consecutiveErrors = 0; // Reset error counter on success
              } catch (blockError) {
                console.error(`❌ Error processing block ${lastProcessed}:`, blockError.message);
                consecutiveErrors++;

                if (consecutiveErrors >= maxConsecutiveErrors) {
                  console.log(`⚠️  Too many consecutive errors (${consecutiveErrors}), switching provider...`);
                  await providerManager.switchProvider();
                  consecutiveErrors = 0;
                }
              }

              // Print statistics every 100 blocks
              if (totalBlocksProcessed % 100 === 0) {
                console.log(`📊 Statistics: ${totalBlocksProcessed} blocks processed`);
              }
            }

            // Adaptive delay based on error rate
            const delay = consecutiveErrors > 0 ? 3000 : 1500;
            await new Promise(resolve => setTimeout(resolve, delay));

          } catch (error) {
            console.error('❌ Polling error:', error.message);
            consecutiveErrors++;

            if (consecutiveErrors >= maxConsecutiveErrors) {
              console.log(`⚠️  Too many consecutive errors (${consecutiveErrors}), switching provider...`);
              await providerManager.switchProvider();
              consecutiveErrors = 0;
            }

            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      } catch (e) {
        console.error('💥 pollLoop crash:', e);
        running = false;
        setTimeout(pollLoop, 5000); // Auto-recover
      }
    }

    // Set up event listeners even in HTTP fallback mode
    setupEventListeners(provider);

    pollLoop();
  }
}

// Efficient event listeners for minting, LP detection, and contract deployments
async function setupEventListeners(provider) {
  console.log('🔧 Setting up event listeners...');

  // CRC-20 minting events: Transfer(from=0x0, *, amount)
  provider.on({ topics: [transferTopic, zeroAddress] }, async (log) => {
    try {
      console.log(`🎯 Minting event detected: ${log.transactionHash}`);

      const tokenAddress = log.address.toLowerCase();
      const recipient = '0x' + log.topics[2].slice(26).toLowerCase();
      const amount = BigInt(log.data);

      // Skip if we've already seen this token
      if (await seen(tokenAddress)) {
        console.log(`⚠️  Token ${tokenAddress} already seen, skipping`);
        return;
      }

      // Probe the token to get metadata
      const meta = await probe(provider, tokenAddress);
      if (!meta) {
        console.log(`❌ Token ${tokenAddress} is not a valid ERC-20 token`);
        return;
      }

      // Format amount with decimals
      const decimals = meta.decimals || 18;
      const divisor = BigInt(10 ** decimals);
      const wholePart = amount / divisor;
      const fractionalPart = amount % divisor;
      const formattedAmount = wholePart.toString() + (fractionalPart > 0n ? '.' + fractionalPart.toString().padStart(Number(decimals), '0').replace(/0+$/, '') : '');

      const text = `🆕 New Token Minted!

Name: ${meta.name || '-'} (${meta.symbol || '-'})
Amount: ${formattedAmount} ${meta.symbol}
CA: ${tokenAddress}
Block: ${log.blockNumber}
Recipient: ${recipient}

Created: ${ago(Date.now())}`;

      await tg(text, tokenAddress, log.transactionHash);
      await mark(tokenAddress, log.blockNumber);

      console.log(`✅ Processed minting event for ${meta.symbol}`);
    } catch (error) {
      console.error('❌ Error processing minting event:', error.message);
    }
  });

  // LP pair creation events for each factory
  for (const factory of FACTORIES) {
    if (!factory) continue;

    provider.on({ address: factory, topics: [pairCreatedTopic] }, async (log) => {
      try {
        console.log(`🎯 LP creation event detected at factory ${factory}: ${log.transactionHash}`);

        // Parse the PairCreated event
        const token0 = '0x' + log.topics[1].slice(26).toLowerCase();
        const token1 = '0x' + log.topics[2].slice(26).toLowerCase();
        const pairAddress = '0x' + log.topics[3].slice(26).toLowerCase();

        // Skip if we've already seen this LP pair
        if (await seen(pairAddress)) {
          console.log(`⚠️  LP pair ${pairAddress} already seen, skipping`);
          return;
        }

        // Get token symbols for better identification
        let token0Symbol = 'Unknown';
        let token1Symbol = 'Unknown';

        try {
          const token0Contract = new Contract(token0, erc20Abi, provider);
          const token1Contract = new Contract(token1, erc20Abi, provider);

          const [symbol0, symbol1] = await Promise.allSettled([
            token0Contract.symbol().catch(() => null),
            token1Contract.symbol().catch(() => null)
          ]);

          token0Symbol = symbol0.status === 'fulfilled' ? symbol0.value : 'Unknown';
          token1Symbol = symbol1.status === 'fulfilled' ? symbol1.value : 'Unknown';
        } catch (error) {
          console.log(`Error getting token symbols:`, error.message);
        }

        const text = `🆕 New LP Token Added!

Name: ${token0Symbol} / ${token1Symbol}
Pair Address: ${pairAddress}
Block: ${log.blockNumber}
Transaction: ${log.transactionHash}

Created: ${ago(Date.now())}`;

        await tg(text, pairAddress, log.transactionHash);
        await mark(pairAddress, log.blockNumber);

        console.log(`✅ Processed LP creation for ${token0Symbol}/${token1Symbol}`);
      } catch (error) {
        console.error('❌ Error processing LP event:', error.message);
      }
    });
  }

  // New block listener for contract deployments
  provider.on('block', async (blockNumber) => {
    try {
      console.log(`📦 Processing block ${blockNumber} for contract deployments...`);
      
      const block = await provider.getBlock(blockNumber, true);
      if (!block || !block.transactions) return;

      for (const tx of block.transactions) {
        try {
          // Check if this is a contract deployment (to address is null)
          if (tx.to === null) {
            console.log(`🏗️  Contract deployment detected in tx: ${tx.hash}`);
            
            // Get transaction receipt to find contract address
            const receipt = await provider.getTransactionReceipt(tx.hash);
            if (!receipt || !receipt.contractAddress) {
              console.log(`❌ No contract address found in receipt for ${tx.hash}`);
              continue;
            }

            const contractAddress = receipt.contractAddress.toLowerCase();
            
            // Skip if we've already seen this contract
            if (await seen(contractAddress)) {
              console.log(`⚠️  Contract ${contractAddress} already seen, skipping`);
              continue;
            }

            // Try to probe if it's a token
            const meta = await probe(provider, contractAddress);
            
            let text;
            if (meta) {
              // It's a token contract
              text = `🆕 New CRC-20 Token Contract Created!

Name: ${meta.name || '-'} (${meta.symbol || '-'})
CA: ${contractAddress}
Block: ${blockNumber}
Creator: ${tx.from}
Supply: ${meta.totalSupply.toString()}

Created: ${ago(Date.now())}`;
            } else {
              // It's a regular contract
              text = `🚀 New Contract Created!

CA: ${contractAddress}
Block: ${blockNumber}
Creator: ${tx.from}
Tx: ${tx.hash}

Created: ${ago(Date.now())}`;
            }

            await tg(text, contractAddress, tx.hash);
            await mark(contractAddress, blockNumber);

            console.log(`✅ Processed contract deployment: ${contractAddress}`);
          }
        } catch (error) {
          console.error(`❌ Error processing transaction ${tx.hash}:`, error.message);
        }
      }
    } catch (error) {
      console.error(`❌ Error processing block ${blockNumber}:`, error.message);
    }
  });

  console.log(`✅ Event listeners set up for ${FACTORIES.length} factories + contract deployments`);
}

main().catch(e => { console.error(e); process.exit(1); });
