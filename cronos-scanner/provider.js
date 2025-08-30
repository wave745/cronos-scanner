import { WebSocketProvider, JsonRpcProvider } from 'ethers';
import 'dotenv/config';

export function makeProvider() {
  if (process.env.CRONOS_WS) {
    try {
      const p = new WebSocketProvider(process.env.CRONOS_WS);
      // auto-recreate on drop
      p._websocket?.on?.('close', () => {
        console.warn('WS closed — recreating provider');
        setTimeout(() => makeProvider(), 1000);
      });
      return p;
    } catch (error) {
      console.warn('WebSocket provider failed, falling back to HTTP:', error.message);
    }
  }
  // HTTP fallback (keep polling gentle)
  return new JsonRpcProvider(process.env.CRONOS_HTTP, undefined, {
    pollingInterval: 2500,
    batchMaxCount: 10,
    staticNetwork: true
  });
}
