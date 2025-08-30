import 'dotenv/config';
import { WebSocketProvider, JsonRpcProvider } from 'ethers';

console.log('Testing WebSocket connection...');
console.log('WS URL:', process.env.CRONOS_WS ? 'Set' : 'Not set');
console.log('HTTP URL:', process.env.CRONOS_HTTP ? 'Set' : 'Not set');

async function testWebSocket() {
  try {
    console.log('🔌 Testing WebSocket...');
    const wsProvider = new WebSocketProvider(process.env.CRONOS_WS);
    
    // Handle WebSocket errors
    wsProvider._websocket?.on?.('error', (error) => {
      console.log(`❌ WebSocket error: ${error.message}`);
      testHttpFallback();
    });
    
    // Test connection
    const currentBlock = await wsProvider.getBlockNumber();
    console.log(`✅ WebSocket connected! Current block: ${currentBlock}`);
    
    // Listen for new blocks
    wsProvider.on('block', (bn) => console.log('✅ New block via WS:', bn));
    
    // Keep alive for 15 seconds
    setTimeout(() => {
      console.log('WebSocket test complete');
      process.exit(0);
    }, 15000);
    
  } catch (wsError) {
    console.log(`❌ WebSocket failed: ${wsError.message}`);
    testHttpFallback();
  }
}

async function testHttpFallback() {
  console.log('🔄 Testing HTTP fallback...');
  
  try {
    const httpProvider = new JsonRpcProvider(process.env.CRONOS_HTTP);
    const currentBlock = await httpProvider.getBlockNumber();
    console.log(`✅ HTTP connected! Current block: ${currentBlock}`);
    console.log('HTTP fallback is working');
    process.exit(0);
  } catch (httpError) {
    console.log(`❌ HTTP also failed: ${httpError.message}`);
    console.log('🔧 Please check your API key and network connection');
    process.exit(1);
  }
}

testWebSocket();
