import 'dotenv/config';
import fetch from 'node-fetch';

const TG_TOKEN = process.env.TG_BOT_TOKEN;
const TG_CHAT = process.env.TG_CHAT_ID;

async function tg(text, contractAddress = null, txHash = null) {
  if (!TG_TOKEN || !TG_CHAT) {
    console.log('Telegram notification (not sent - missing token or chat ID):', text);
    return;
  }
  
  const url = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
  
  // Prepare message payload
  const payload = {
    chat_id: TG_CHAT,
    text: text,
    disable_web_page_preview: true,
    parse_mode: 'HTML'
  };
  
  // Add inline keyboard if contract address is provided
  if (contractAddress) {
    const buyUrl = `https://t.me/CronusAgentBot?start=${contractAddress}`;
    const cronoScanUrl = `https://cronos.org/explorer/tx/${txHash || ''}`;
    payload.reply_markup = {
      inline_keyboard: [
        [
          {
            text: '🛒 Buy Token',
            url: buyUrl
          },
          {
            text: '🔍 CronoScan',
            url: cronoScanUrl
          }
        ]
      ]
    };
  }
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('TG fail:', errorText);
    } else {
      console.log('✅ Telegram message sent successfully');
    }
  } catch (error) {
    console.error('Telegram request failed:', error.message);
  }
}

async function testButton() {
  console.log('Testing button functionality...');
  
  // Test with a real-looking contract address
  const testContractAddress = '0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23';
  
  const testTxHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
  
  const msg =
`<b>🆕 New Token Detected</b>

<b>Name:</b> Test Token (TEST)
<b>Pair:</b> —
<b>CA:</b> <code>${testContractAddress}</code>
<b>Created:</b> 1m ago
<b>MarketCap:</b> —
<b>Holders:</b> — | <b>TOP 10:</b> —

<b>Creator:</b> <code>0x9876543210987654321098765432109876543210</code>
 ├ <b>CRO:</b> 1,234.56
 └ <b>Token:</b> 50.00%

<i>Click the buttons below to buy or explore this token!</i>`;

  console.log(`Testing with contract address: ${testContractAddress}`);
  console.log(`Buy URL will be: https://t.me/CronusAgentBot?start=${testContractAddress}`);
  console.log(`CronoScan URL will be: https://cronos.org/explorer/tx/${testTxHash}`);
  
  await tg(msg, testContractAddress, testTxHash);
  console.log('🎉 Button test completed!');
}

testButton();
