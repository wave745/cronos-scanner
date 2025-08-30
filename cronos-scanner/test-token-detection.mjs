import 'dotenv/config';
import { JsonRpcProvider, Contract } from 'ethers';

// Test configuration
const RPC_ENDPOINTS = [
  'https://evm.cronos.org',
  'https://cronos.blockpi.network/v1/rpc/public',
  'https://cronos-rpc.publicnode.com',
  'https://cronos.drpc.org'
];

const CRONOS_NETWORK = { name: "cronos", chainId: 25 };

// ERC20 ABI
const erc20Abi = [
  { "constant": true, "inputs": [], "name": "name", "outputs": [{"name": "", "type": "string"}], "type": "function" },
  { "constant": true, "inputs": [], "name": "symbol", "outputs": [{"name": "", "type": "string"}], "type": "function" },
  { "constant": true, "inputs": [], "name": "decimals", "outputs": [{"name": "", "type": "uint8"}], "type": "function" },
  { "constant": true, "inputs": [], "name": "totalSupply", "outputs": [{"name": "", "type": "uint256"}], "type": "function" },
  { "constant": true, "inputs": [{"name": "_owner", "type": "address"}], "name": "balanceOf", "outputs": [{"name": "balance", "type": "uint256"}], "type": "function" }
];

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

// Token probing function (same as in main script)
async function probe(provider, address) {
  try {
    console.log(`🔍 Probing contract ${address} for ERC-20 compliance...`);
    
    const code = await retryWithBackoff(() => provider.getCode(address));
    if (code === '0x') {
      console.log(`❌ Contract ${address} has no code (not a contract)`);
      return null;
    }
    
    console.log(`✅ Contract ${address} has code, checking ERC-20 methods...`);
    const contract = new Contract(address, erc20Abi, provider);
    
    // Test each ERC-20 method individually with detailed logging
    const results = {};
    
    // Test name()
    try {
      results.name = await contract.name();
      console.log(`✅ name(): "${results.name}"`);
    } catch (error) {
      console.log(`❌ name() failed: ${error.message}`);
      results.name = null;
    }
    
    // Test symbol()
    try {
      results.symbol = await contract.symbol();
      console.log(`✅ symbol(): "${results.symbol}"`);
    } catch (error) {
      console.log(`❌ symbol() failed: ${error.message}`);
      results.symbol = null;
    }
    
    // Test decimals()
    try {
      results.decimals = await contract.decimals();
      console.log(`✅ decimals(): ${results.decimals}`);
    } catch (error) {
      console.log(`❌ decimals() failed: ${error.message}, using default 18`);
      results.decimals = 18;
    }
    
    // Test totalSupply()
    try {
      results.totalSupply = await contract.totalSupply();
      console.log(`✅ totalSupply(): ${results.totalSupply.toString()}`);
    } catch (error) {
      console.log(`❌ totalSupply() failed: ${error.message}, using 0`);
      results.totalSupply = 0n;
    }
    
    // Determine if this is a valid ERC-20 token
    if (!results.name && !results.symbol) {
      console.log(`❌ Contract ${address} is not a valid ERC-20 token (missing both name and symbol)`);
      return null;
    }
    
    console.log(`🎉 Contract ${address} is a valid ERC-20 token!`);
    return {
      name: results.name || 'Unknown',
      symbol: results.symbol || 'Unknown',
      decimals: results.decimals || 18,
      totalSupply: BigInt(results.totalSupply || 0)
    };
  } catch (error) {
    console.log(`❌ Error probing contract ${address}:`, error.message);
    return null;
  }
}

// Test function
async function testAddress(address) {
  console.log(`🧪 Testing address: ${address}`);
  console.log('='.repeat(60));
  
  // Try each RPC endpoint
  for (let i = 0; i < RPC_ENDPOINTS.length; i++) {
    const endpoint = RPC_ENDPOINTS[i];
    console.log(`\n🔗 Testing with RPC endpoint ${i + 1}/${RPC_ENDPOINTS.length}: ${endpoint}`);
    
    try {
      const provider = new JsonRpcProvider(endpoint, CRONOS_NETWORK);
      
      // Test connection
      const blockNumber = await retryWithBackoff(() => provider.getBlockNumber());
      console.log(`✅ Connected! Current block: ${blockNumber}`);
      
      // Test the address
      const meta = await probe(provider, address);
      if (meta) {
        console.log(`\n🎉 SUCCESS! Token found:`);
        console.log(`   Name: ${meta.name}`);
        console.log(`   Symbol: ${meta.symbol}`);
        console.log(`   Decimals: ${meta.decimals}`);
        console.log(`   Total Supply: ${meta.totalSupply.toString()}`);
        console.log(`   Formatted Supply: ${(Number(meta.totalSupply) / Math.pow(10, meta.decimals)).toLocaleString()}`);
        return meta;
      } else {
        console.log(`❌ Address is not a valid ERC-20 token`);
      }
    } catch (error) {
      console.log(`❌ Failed with this endpoint: ${error.message}`);
    }
  }
  
  console.log(`\n❌ All RPC endpoints failed for address ${address}`);
  return null;
}

// Main test function
async function main() {
  console.log('🧪 Cronos Token Detection Test');
  console.log('='.repeat(60));
  
  // Test addresses (some known Cronos tokens)
  const testAddresses = [
    '0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23', // WCRO (Wrapped CRO)
    '0xc21223249CA28397B4B6541dfFaEcC539BfF0c59', // USDC
    '0x66e428de3f271d09565c6214884e54cc1d84bf2e', // USDT
    '0x062E66477Faf219F25D27dCED647BF57C3107d52', // WBTC
  ];
  
  if (process.argv[2]) {
    // Test specific address
    await testAddress(process.argv[2]);
  } else {
    // Test known addresses
    console.log('Testing known Cronos tokens...\n');
    for (const addr of testAddresses) {
      await testAddress(addr);
      console.log('\n' + '='.repeat(60) + '\n');
    }
  }
}

main().catch(e => {
  console.error('Test failed:', e);
  process.exit(1);
});
