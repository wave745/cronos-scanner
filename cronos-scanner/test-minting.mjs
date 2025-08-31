import 'dotenv/config';
import { JsonRpcProvider, Contract } from 'ethers';
import sqlite3 from 'sqlite3';

// Environment variables
const MIN_SUPPLY = BigInt(process.env.MIN_SUPPLY || '0');
const CRO_DEC = Number(process.env.CRO_DECIMALS || '18');

// Transfer event topic for minting detection
const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

// ERC20 ABI
const erc20Abi = [
  { "constant": true, "inputs": [], "name": "name", "outputs": [{"name": "", "type": "string"}], "type": "function" },
  { "constant": true, "inputs": [], "name": "symbol", "outputs": [{"name": "", "type": "string"}], "type": "function" },
  { "constant": true, "inputs": [], "name": "decimals", "outputs": [{"name": "", "type": "uint8"}], "type": "function" },
  { "constant": true, "inputs": [], "name": "totalSupply", "outputs": [{"name": "", "type": "uint256"}], "type": "function" },
  { "constant": true, "inputs": [{"name": "_owner", "type": "address"}], "name": "balanceOf", "outputs": [{"name": "balance", "type": "uint256"}], "type": "function" }
];

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

// Token probing
async function probe(provider, address) {
  try {
    console.log(`🔍 Probing contract ${address} for CRC-20/ERC-20 compliance...`);
    
    const code = await provider.getCode(address);
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

// Minting detection
async function detectMinting(provider, blockNumber) {
  try {
    console.log(`🔍 Checking block ${blockNumber} for minting events...`);
    
    // Look for Transfer events from zero address (minting)
    const logs = await provider.getLogs({
      fromBlock: blockNumber,
      toBlock: blockNumber,
      topics: [transferTopic, '0x0000000000000000000000000000000000000000000000000000000000000000'] // from zero address
    });

    console.log(`📊 Found ${logs.length} transfer events from zero address`);

    const mintingEvents = [];
    
    for (const log of logs) {
      try {
        // Extract token address and recipient
        const tokenAddress = log.address.toLowerCase();
        const recipient = '0x' + log.topics[2].slice(26).toLowerCase();
        const amount = BigInt(log.data);
        
        console.log(`🔍 Processing transfer: ${amount} tokens from zero address to ${recipient} (token: ${tokenAddress})`);
        
        // Skip if we've already seen this token
        if (await seen(tokenAddress)) {
          console.log(`⚠️  Token ${tokenAddress} already seen, skipping`);
          continue;
        }
        
        // Probe the token to get metadata
        const meta = await probe(provider, tokenAddress);
        if (!meta) {
          console.log(`❌ Token ${tokenAddress} is not a valid ERC-20 token`);
          continue;
        }
        
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

async function testMintingDetection() {
  console.log('🧪 Testing minting detection for block 29566728 (LOCKCAPS minting)...');
  
  const provider = new JsonRpcProvider('https://evm.cronos.org');
  
  try {
    const mintingEvents = await detectMinting(provider, 29566728);
    
    if (mintingEvents.length > 0) {
      console.log(`✅ Found ${mintingEvents.length} minting events!`);
      for (const event of mintingEvents) {
        console.log(`🎯 Token: ${event.metadata.symbol} (${event.metadata.name})`);
        console.log(`   Address: ${event.tokenAddress}`);
        console.log(`   Amount: ${event.amount.toString()}`);
        console.log(`   Recipient: ${event.recipient}`);
        console.log(`   Transaction: ${event.txHash}`);
      }
    } else {
      console.log('❌ No minting events found in this block');
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testMintingDetection();
