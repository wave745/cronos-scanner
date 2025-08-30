import http from 'http';
import { makeProvider } from './provider.js';
import 'dotenv/config';

const PORT = process.env.HEALTH_PORT || 3000;

// Simple in-memory stats
let stats = {
  startTime: Date.now(),
  blocksProcessed: 0,
  tokensFound: 0,
  lastBlock: 0,
  status: 'starting'
};

// Update stats (called from main scanner)
export function updateStats(newStats) {
  stats = { ...stats, ...newStats };
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.url === '/health') {
    try {
      // Test provider connection
      const provider = makeProvider();
      const currentBlock = await provider.getBlockNumber();
      
      const healthData = {
        status: 'healthy',
        uptime: Date.now() - stats.startTime,
        currentBlock,
        ...stats,
        timestamp: new Date().toISOString()
      };
      
      res.writeHead(200);
      res.end(JSON.stringify(healthData, null, 2));
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      }, null, 2));
    }
  } else if (req.url === '/') {
    res.writeHead(200);
    res.end(JSON.stringify({
      service: 'Cronos Token Scanner',
      endpoints: {
        health: '/health'
      },
      timestamp: new Date().toISOString()
    }, null, 2));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, () => {
  console.log(`🏥 Health server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

export default server;
