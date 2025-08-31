import { JsonRpcProvider } from 'ethers';

const RPC_ENDPOINTS = [
  'https://evm.cronos.org',
  'https://cronos.blockpi.network/v1/rpc/public',
  'https://cronos-rpc.publicnode.com',
  'https://cronos.drpc.org'
];

const CRONOS_NETWORK = { name: "cronos", chainId: 25 };

async function testEndpoints() {
  console.log('🧪 Testing RPC endpoints...\n');
  
  for (let i = 0; i < RPC_ENDPOINTS.length; i++) {
    const endpoint = RPC_ENDPOINTS[i];
    console.log(`Testing endpoint ${i + 1}: ${endpoint}`);
    
    try {
      const provider = new JsonRpcProvider(endpoint, CRONOS_NETWORK);
      
      // Test with timeout
      const blockNumber = await Promise.race([
        provider.getBlockNumber(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
      ]);
      
      console.log(`✅ Endpoint ${i + 1} WORKING - Current block: ${blockNumber}\n`);
    } catch (error) {
      console.log(`❌ Endpoint ${i + 1} FAILED - ${error.message}\n`);
    }
  }
}

testEndpoints();
