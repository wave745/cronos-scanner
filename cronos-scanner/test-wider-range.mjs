import 'dotenv/config';
import { JsonRpcProvider, Contract } from 'ethers';

// Test configuration - scan a much wider range
const START_BLOCK = 29480000; // Start from an earlier block
const END_BLOCK = 29481000;   // Scan 1000 blocks
const RPC_ENDPOINT = 'https://evm.cronos.org';

// ERC20 ABI
const erc20Abi = [
  { "constant": true, "inputs": [], "name": "name", "outputs": [{"name": "", "type": "string"}], "type": "function" },
  { "constant": true, "inputs": [], "name": "symbol", "outputs": [{"name": "", "type": "string"}], "type": "function" },
  { "constant": true, "inputs": [], "name": "decimals", "outputs": [{"name": "", "type": "uint8"}], "type": "function" },
  { "constant": true, "inputs": [], "name": "totalSupply", "outputs": [{"name": "", "type": "uint256"}], "type": "function" }
];

const provider = new JsonRpcProvider(RPC_ENDPOINT, { name: "cronos", chainId: 25 });

async function probeToken(address) {
  try {
    const code = await provider.getCode(address);
    if (code === '0x') return null;
    
    const contract = new Contract(address, erc20Abi, provider);
    
    const [name, symbol, decimals, totalSupply] = await Promise.allSettled([
      contract.name(),
      contract.symbol(),
      contract.decimals(),
      contract.totalSupply()
    ]);
    
    if (name.status === 'rejected' && symbol.status === 'rejected') return null;
    
    return {
      name: name.status === 'fulfilled' ? name.value : 'Unknown',
      symbol: symbol.status === 'fulfilled' ? symbol.value : 'Unknown',
      decimals: decimals.status === 'fulfilled' ? decimals.value : 18,
      totalSupply: totalSupply.status === 'fulfilled' ? BigInt(totalSupply.value) : 0n
    };
  } catch (error) {
    return null;
  }
}

async function testWiderRange() {
  console.log(`🔍 Testing wider block range ${START_BLOCK} to ${END_BLOCK}`);
  console.log(`RPC Endpoint: ${RPC_ENDPOINT}`);
  console.log('='.repeat(60));
  
  let totalBlocks = 0;
  let totalTransactions = 0;
  let contractDeployments = 0;
  let erc20Tokens = 0;
  let nonErc20Contracts = 0;
  let tokensFound = [];
  
  for (let blockNum = START_BLOCK; blockNum <= END_BLOCK; blockNum++) {
    try {
      const block = await provider.getBlock(blockNum, true);
      if (!block?.transactions) continue;
      
      totalBlocks++;
      totalTransactions += block.transactions.length;
      
      // Only log blocks with contract deployments
      let blockHasDeployments = false;
      
      for (const tx of block.transactions) {
        // Check for contract creation (to is null)
        if (tx.to === null) {
          if (!blockHasDeployments) {
            console.log(`\n📦 Block ${blockNum}: ${block.transactions.length} transactions`);
            blockHasDeployments = true;
          }
          
          contractDeployments++;
          console.log(`  🔧 Contract deployment: ${tx.hash}`);
          
          try {
            const receipt = await provider.getTransactionReceipt(tx.hash);
            const contractAddress = receipt?.contractAddress;
            
            if (contractAddress) {
              console.log(`     📍 Contract address: ${contractAddress}`);
              
              // Probe for ERC20
              const tokenInfo = await probeToken(contractAddress);
              if (tokenInfo) {
                erc20Tokens++;
                tokensFound.push({
                  block: blockNum,
                  address: contractAddress,
                  hash: tx.hash,
                  ...tokenInfo
                });
                console.log(`     ✅ ERC20 Token: ${tokenInfo.symbol} (${tokenInfo.name})`);
                console.log(`        Supply: ${tokenInfo.totalSupply.toString()}`);
                console.log(`        Decimals: ${tokenInfo.decimals}`);
              } else {
                nonErc20Contracts++;
                console.log(`     ❌ Not ERC20 (or failed to probe)`);
              }
            } else {
              console.log(`     ❌ No contract address in receipt`);
            }
          } catch (error) {
            console.log(`     ❌ Error getting receipt: ${error.message}`);
          }
        }
      }
      
      // Progress indicator every 100 blocks
      if (blockNum % 100 === 0) {
        console.log(`\n📊 Progress: Block ${blockNum}/${END_BLOCK} - Found ${erc20Tokens} tokens so far`);
      }
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 50));
      
    } catch (error) {
      console.log(`❌ Error processing block ${blockNum}: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL SCAN SUMMARY:');
  console.log(`Blocks processed: ${totalBlocks}`);
  console.log(`Total transactions: ${totalTransactions}`);
  console.log(`Contract deployments: ${contractDeployments}`);
  console.log(`ERC20 tokens found: ${erc20Tokens}`);
  console.log(`Non-ERC20 contracts: ${nonErc20Contracts}`);
  console.log(`Average transactions per block: ${(totalTransactions / totalBlocks).toFixed(2)}`);
  console.log(`Token deployment frequency: ${(erc20Tokens / totalBlocks * 100).toFixed(2)}% of blocks contain tokens`);
  
  if (tokensFound.length > 0) {
    console.log('\n🎯 TOKENS FOUND:');
    tokensFound.forEach((token, index) => {
      console.log(`${index + 1}. ${token.symbol} (${token.name})`);
      console.log(`   Address: ${token.address}`);
      console.log(`   Block: ${token.block}`);
      console.log(`   Supply: ${token.totalSupply.toString()}`);
      console.log(`   TX: ${token.hash}`);
      console.log('');
    });
  } else {
    console.log('\n⚠️  No ERC20 tokens found in this range!');
    console.log('This suggests:');
    console.log('1. Token deployments are very rare on Cronos');
    console.log('2. Most tokens are deployed through factory contracts');
    console.log('3. We need to monitor factory contracts instead of direct deployments');
  }
}

// Run the test
testWiderRange().catch(console.error);
