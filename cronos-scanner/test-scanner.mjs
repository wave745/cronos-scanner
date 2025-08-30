import 'dotenv/config';
import { JsonRpcProvider, Contract } from 'ethers';

// Test configuration
const START_BLOCK = 29480800; // Start from an earlier block
const END_BLOCK = 29480900;   // Scan 100 blocks
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

async function testBlockRange() {
  console.log(`🔍 Testing block range ${START_BLOCK} to ${END_BLOCK}`);
  console.log(`RPC Endpoint: ${RPC_ENDPOINT}`);
  console.log('='.repeat(60));
  
  let totalBlocks = 0;
  let totalTransactions = 0;
  let contractDeployments = 0;
  let erc20Tokens = 0;
  let nonErc20Contracts = 0;
  
  for (let blockNum = START_BLOCK; blockNum <= END_BLOCK; blockNum++) {
    try {
      const block = await provider.getBlock(blockNum, true);
      if (!block?.transactions) continue;
      
      totalBlocks++;
      totalTransactions += block.transactions.length;
      
      console.log(`\n📦 Block ${blockNum}: ${block.transactions.length} transactions`);
      
      for (const tx of block.transactions) {
        // Check for contract creation (to is null)
        if (tx.to === null) {
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
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.log(`❌ Error processing block ${blockNum}: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 SCAN SUMMARY:');
  console.log(`Blocks processed: ${totalBlocks}`);
  console.log(`Total transactions: ${totalTransactions}`);
  console.log(`Contract deployments: ${contractDeployments}`);
  console.log(`ERC20 tokens found: ${erc20Tokens}`);
  console.log(`Non-ERC20 contracts: ${nonErc20Contracts}`);
  console.log(`Average transactions per block: ${(totalTransactions / totalBlocks).toFixed(2)}`);
  
  if (erc20Tokens === 0) {
    console.log('\n⚠️  No ERC20 tokens found in this range!');
    console.log('Possible reasons:');
    console.log('1. This block range doesn\'t contain token deployments');
    console.log('2. Tokens are deployed through factory contracts (not direct deployments)');
    console.log('3. The blocks are too recent and no tokens have been deployed yet');
    console.log('\n💡 Try scanning an earlier block range or add factory contract monitoring');
  }
}

// Run the test
testBlockRange().catch(console.error);
