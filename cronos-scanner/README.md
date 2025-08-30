# Enhanced Cronos Token Scanner

A real-time token detection scanner for the Cronos blockchain that monitors for new ERC-20 token deployments and sends Telegram notifications.

## Features

- 🔍 **Real-time monitoring** of Cronos blockchain for contract deployments
- 🎯 **ERC-20 detection** with detailed probing of token contracts
- 📱 **Telegram notifications** with comprehensive token information and buy buttons
- 🔄 **RPC redundancy** with automatic failover between multiple endpoints
- 📊 **Enhanced logging** with detailed debugging information
- 🧪 **Test scripts** for validation and debugging

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Environment Variables

Create a `.env` file:

```env
# Telegram Configuration
TG_BOT_TOKEN=your_telegram_bot_token
TG_CHAT_ID=your_chat_id

# Scanner Configuration
MIN_SUPPLY=1000000000000000000000  # Minimum token supply (in wei)
FACTORIES=0x3b44b2a187a7b3824131f8db5a74194d0a42fc15,0x7c9fa4433e491c39765cc44df0b7f2c5d86e6e6b
CRO_DECIMALS=18
```

### 3. Run the Scanner

```bash
node index.mjs
```

## Test Scripts

### Test Token Detection

Test the scanner with known Cronos tokens:

```bash
# Test with known tokens
node test-token-detection.mjs

# Test specific address
node test-token-detection.mjs 0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23
```

### Test Recent Blocks

Scan recent blocks for contract deployments:

```bash
# Scan last 100 blocks (default)
node test-recent-blocks.mjs

# Scan specific block range
node test-recent-blocks.mjs 29480896 29480933
```

### Test Main Scanner

Test the main scanner with a specific address:

```bash
node index.mjs 0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23
```

### Test Buy Button

Test the buy button functionality:

```bash
# Test notification with button
node test-notification.mjs

# Test button with specific contract address
node test-button.mjs
```

## Enhanced Features

### 1. Improved Debugging

The scanner now provides detailed logging:

- 📦 Block processing status
- 🏗️ Contract deployment detection
- 🔍 ERC-20 probing details
- ✅/❌ Success/failure indicators
- 📊 Statistics and summaries

### 2. RPC Optimization

- **Batch processing**: Increased `batchMaxCount` to 10 for better performance
- **Multiple endpoints**: Automatic failover between 4 RPC endpoints
- **Retry logic**: Exponential backoff for failed requests
- **Connection testing**: Validates endpoints before use

### 3. Enhanced Token Detection

- **Individual method testing**: Tests each ERC-20 method separately
- **Detailed error reporting**: Shows exactly which methods fail
- **Flexible validation**: Accepts tokens with partial ERC-20 compliance

### 4. Dual Button Integration

- **Inline keyboard buttons**: Each token notification includes two buttons side by side
- **Buy Token button**: Links to `https://t.me/CronusAgentBot?start={contract_address}`
- **CronoScan button**: Links to `https://cronos.org/explorer/tx/{transaction_hash}`
- **Clean message body**: Removed long URLs from message text for cleaner presentation
- **Contract address embedding**: The contract address is automatically embedded in the buy URL
- **HTML formatting**: Enhanced message formatting with bold text and code blocks
- **Supply filtering**: Configurable minimum supply requirements

## Troubleshooting

### No Tokens Detected

If the scanner isn't finding tokens, try these steps:

1. **Test with known tokens**:
   ```bash
   node test-token-detection.mjs
   ```

2. **Check recent blocks**:
   ```bash
   node test-recent-blocks.mjs
   ```

3. **Verify RPC connectivity**:
   - The scanner will automatically test and switch between RPC endpoints
   - Check console output for connection status

4. **Check block range**:
   - Token deployments are rare on Cronos
   - Try scanning a larger range of blocks
   - Check Cronos Explorer for recent token creations

### Common Issues

1. **"No contract deployments found"**
   - This is normal - token deployments are infrequent
   - Try scanning more blocks or a different time period

2. **"RPC endpoint failed"**
   - The scanner will automatically switch to backup endpoints
   - Check your internet connection

3. **"Telegram notification failed"**
   - Verify your bot token and chat ID
   - Check if the bot has permission to send messages

## Configuration Options

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TG_BOT_TOKEN` | Telegram bot token | Required |
| `TG_CHAT_ID` | Telegram chat ID | Required |
| `MIN_SUPPLY` | Minimum token supply (wei) | 0 |
| `FACTORIES` | Comma-separated factory addresses | Default list |
| `CRO_DECIMALS` | CRO token decimals | 18 |

### RPC Endpoints

The scanner uses these endpoints with automatic failover:

1. `https://evm.cronos.org`
2. `https://cronos.public.blastapi.io`
3. `https://cronos-evm-rpc.publicnode.com`
4. `https://rpc.cronos.org`

## Database

The scanner uses SQLite to track seen contracts:

- **File**: `cronos.db`
- **Table**: `seen(address, block, ts)`
- **Purpose**: Prevents duplicate notifications

## Monitoring

The scanner provides real-time statistics:

- Blocks processed
- Contract deployments found
- Valid tokens detected
- Error rates and RPC performance

## Support

If you encounter issues:

1. Check the console output for detailed error messages
2. Run the test scripts to validate functionality
3. Verify your environment variables
4. Check Cronos network status

## License

MIT License - feel free to modify and distribute.
