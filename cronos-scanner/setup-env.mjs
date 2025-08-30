import fs from 'fs';
import path from 'path';

const envContent = `CRONOS_WS=wss://go.getblock.io/d578c09e7b2841ceba1ff2a5ad79777e
# optional fallback:
CRONOS_HTTP=https://go.getblock.io/d578c09e7b2841ceba1ff2a5ad79777e

# Your existing environment variables (add these if you have them):
# TG_BOT_TOKEN=your_telegram_bot_token
# TG_CHAT_ID=your_telegram_chat_id
# MIN_SUPPLY=1000000000000000000000
`;

const envPath = path.join(process.cwd(), '.env');

if (fs.existsSync(envPath)) {
  console.log('⚠️  .env file already exists. Please manually add these lines:');
  console.log('');
  console.log('CRONOS_WS=wss://go.getblock.io/d578c09e7b2841ceba1ff2a5ad79777e');
  console.log('CRONOS_HTTP=https://go.getblock.io/d578c09e7b2841ceba1ff2a5ad79777e');
  console.log('');
} else {
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Created .env file with WebSocket configuration');
  console.log('');
  console.log('⚠️  IMPORTANT: Please add your other environment variables (TG_BOT_TOKEN, etc.) to the .env file');
}

console.log('🔧 Next steps:');
console.log('1. Add your Telegram bot token and chat ID to .env');
console.log('2. Run: node test-ws.mjs (to test WebSocket connection)');
console.log('3. Run: node index.mjs (to start the scanner)');
