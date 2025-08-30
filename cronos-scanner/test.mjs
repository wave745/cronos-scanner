import 'dotenv/config';
import { JsonRpcProvider } from "ethers";

const WS = process.env.CRONOS_WS;
const HTTP = process.env.CRONOS_HTTP;

console.log('Testing RPC connection...');
console.log('WS:', WS);
console.log('HTTP:', HTTP);

// Cronos network configuration
const CRONOS_NETWORK = { name: "cronos", chainId: 25 };

async function testConnection() {
  try {
    // Try HTTP first as it's more reliable
    console.log('Testing HTTP provider...');
    const provider = new JsonRpcProvider(HTTP, CRONOS_NETWORK);
    
    const bn = await provider.getBlockNumber();
    console.log('✅ Connected successfully! Latest block:', bn);
    
    // Test getting a recent block
    const block = await provider.getBlock(bn);
    console.log('✅ Block info:', {
      number: block.number,
      hash: block.hash,
      timestamp: new Date(block.timestamp * 1000).toISOString()
    });
    
    return true;
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    return false;
  }
}

testConnection().then(success => {
  if (success) {
    console.log('🎉 RPC connection test passed! Your scanner should work now.');
  } else {
    console.log('💥 RPC connection test failed. Check your endpoints.');
  }
  process.exit(success ? 0 : 1);
});
