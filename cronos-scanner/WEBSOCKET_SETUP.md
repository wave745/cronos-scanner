# WebSocket Setup Guide

## 🚀 Quick Start

### 1. Set up environment variables

Run the setup script to create your `.env` file:

```bash
npm run setup
```

Then manually add your existing environment variables to `.env`:

```env
CRONOS_WS=wss://go.getblock.io/d578c09e7b2841ceba1ff2a5ad79777e
CRONOS_HTTP=https://go.getblock.io/d578c09e7b2841ceba1ff2a5ad79777e

# Your existing variables
TG_BOT_TOKEN=your_telegram_bot_token
TG_CHAT_ID=your_telegram_chat_id
MIN_SUPPLY=1000000000000000000000
```

### 2. Test WebSocket connection

```bash
npm run test-ws
```

You should see:
```
Testing WebSocket connection...
WS URL: Set
current 12345678
✅ block 12345679
✅ block 12345680
...
```

### 3. Start the scanner

```bash
npm start
```

## 🔧 Features

### WebSocket Real-time Block Processing
- **Real-time notifications**: Get new blocks instantly via WebSocket
- **Auto-reconnection**: Automatically reconnects if connection drops
- **HTTP fallback**: Falls back to HTTP polling if WebSocket fails
- **Graceful degradation**: Seamlessly switches between WebSocket and HTTP

### Enhanced Provider Management
- **Multiple RPC endpoints**: Built-in redundancy with public RPCs
- **Exponential backoff**: Smart retry logic for failed requests
- **Rate limiting protection**: Handles rate limits gracefully
- **Connection monitoring**: Tracks connection health

### Production Ready
- **PM2 configuration**: Auto-restart on crashes
- **Health check endpoint**: Monitor scanner status
- **Logging**: Comprehensive error and success logging
- **Memory management**: Automatic restart on memory issues

## 📊 Health Monitoring

### Start health server
```bash
npm run health
```

### Check status
```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "healthy",
  "uptime": 3600000,
  "currentBlock": 12345678,
  "blocksProcessed": 150,
  "tokensFound": 3,
  "lastBlock": 12345678,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 🚀 Production Deployment

### Using PM2
```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start ecosystem.config.js

# Monitor
pm2 monit

# View logs
pm2 logs cronos-scanner

# Restart
pm2 restart cronos-scanner
```

### Using Docker (optional)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 🔍 Troubleshooting

### WebSocket Connection Issues
1. **Check your API key**: Ensure the GetBlock key is valid
2. **Firewall**: Make sure port 443 is open for WebSocket
3. **Rate limits**: Check GetBlock dashboard for usage limits
4. **Fallback**: The scanner will automatically fall back to HTTP polling

### Common Errors
- `WebSocket connection failed`: Check API key and network
- `Rate limited`: Reduce request frequency or upgrade plan
- `Provider failed`: Scanner will automatically switch providers

### Performance Tips
- **Memory usage**: Monitor with `pm2 monit`
- **Database size**: The `cronos.db` file will grow over time
- **Log rotation**: Consider log rotation for long-running instances

## 📈 Expected Performance

With WebSocket:
- **Block latency**: < 1 second
- **Token detection**: Real-time
- **Memory usage**: ~50-100MB
- **CPU usage**: Low (event-driven)

With HTTP fallback:
- **Block latency**: 1.5-3 seconds
- **Token detection**: Near real-time
- **Memory usage**: ~50-100MB
- **CPU usage**: Low

## 🔐 Security Notes

⚠️ **IMPORTANT**: 
- Your GetBlock API key is a **secret**
- If you've shared it publicly, regenerate it immediately
- Never commit `.env` files to version control
- Use environment variables in production

## 📞 Support

If you encounter issues:
1. Check the logs: `pm2 logs cronos-scanner`
2. Test WebSocket: `npm run test-ws`
3. Check health: `curl http://localhost:3000/health`
4. Verify environment variables are set correctly
