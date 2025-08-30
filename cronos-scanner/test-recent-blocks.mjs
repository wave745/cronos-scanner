import 'dotenv/config';
import { JsonRpcProvider } from 'ethers';

// Configuration
const RPC_ENDPOINTS = [
  'https://evm.cronos.org',
  'https://cronos.blockpi.network/v1/rpc/public',
  'https://cronos-rpc.publicnode.com',
  'https://cronos.drpc.org'
];

const CRONOS_NETWORK = { name: "cronos", chainId: 25 };

// Enhanced retry function
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`Retry ${attempt + 1}/${maxRetries} in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Test recent blocks for contract deployments
async function testRecentBlocks(startBlock, endBlock) {
  console.log(`🔍 Testing blocks ${startBlock} to ${endBlock} for contract deployments`);
  console.log('='.repeat(80));
  
  let provider;
  
  // Try to connect to an RPC endpoint
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      console.log(`🔗 Trying endpoint: ${endpoint}`);
      provider = new JsonRpcProvider(endpoint, CRONOS_NETWORK);
      await retryWithBackoff(() => provider.getBlockNumber());
      console.log(`✅ Connected successfully!`);
      break;
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
    }
  }
  
  if (!provider) {
    console.log(`❌ Could not connect to any RPC endpoint`);
    return;
  }
  
  let totalBlocks = 0;
  let blocksWithTx = 0;
  let contractDeployments = 0;
  let failedBlocks = 0;
  
  for (let blockNum = startBlock; blockNum <= endBlock; blockNum++) {
    try {
      totalBlocks++;
      const block = await retryWithBackoff(() => provider.getBlock(blockNum, true));
      
      if (!block || !block.transactions) {
        console.log(`📦 Block ${blockNum}: No block data`);
        continue;
      }
      
      if (block.transactions.length === 0) {
        console.log(`📦 Block ${blockNum}: 0 transactions`);
        continue;
      }
      
      blocksWithTx++;
      console.log(`📦 Block ${blockNum}: ${block.transactions.length} transactions`);
      
      // Check for contract deployments
      for (const tx of block.transactions) {
        if (tx.to === null) {
          contractDeployments++;
          console.log(`  🏗️  Contract deployment: ${tx.hash}`);
          
          try {
            const receipt = await retryWithBackoff(() => provider.getTransactionReceipt(tx.hash));
            if (receipt?.contractAddress) {
              console.log(`    📍 Contract address: ${receipt.contractAddress}`);
            } else {
              console.log(`    ❌ No contract address in receipt`);
            }
          } catch (error) {
            console.log(`    ❌ Could not get receipt: ${error.message}`);
          }
        }
      }
      
      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      failedBlocks++;
      console.log(`❌ Block ${blockNum}: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY:');
  console.log(`  Total blocks scanned: ${totalBlocks}`);
  console.log(`  Blocks with transactions: ${blocksWithTx}`);
  console.log(`  Contract deployments found: ${contractDeployments}`);
  console.log(`  Failed blocks: ${failedBlocks}`);
  console.log(`  Success rate: ${((totalBlocks - failedBlocks) / totalBlocks * 100).toFixed(1)}%`);
  
  if (contractDeployments === 0) {
    console.log('\n💡 No contract deployments found in this range.');
    console.log('   This could mean:');
    console.log('   1. No new tokens were deployed in these blocks');
    console.log('   2. The blocks are too recent (contracts might not be confirmed yet)');
    console.log('   3. Try scanning a larger range or different time period');
  }
}

// Main function
async function main() {
  console.log('🔍 Cronos Recent Blocks Scanner');
  console.log('='.repeat(80));
  
  // Get block range from command line or use defaults
  let startBlock, endBlock;
  
  if (process.argv[2] && process.argv[3]) {
    startBlock = parseInt(process.argv[2]);
    endBlock = parseInt(process.argv[3]);
  } else {
    // Default: scan last 100 blocks
    const provider = new JsonRpcProvider(RPC_ENDPOINTS[0], CRONOS_NETWORK);
    const latest = await retryWithBackoff(() => provider.getBlockNumber());
    endBlock = latest;
    startBlock = Math.max(0, latest - 99);
  }
  
  console.log(`📅 Scanning blocks ${startBlock} to ${endBlock} (${endBlock - startBlock + 1} blocks)`);
  
  await testRecentBlocks(startBlock, endBlock);
}

main().catch(e => {
  console.error('Test failed:', e);
  process.exit(1);
});
