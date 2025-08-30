import 'dotenv/config';

console.log('🔧 Configuration Check');
console.log('='.repeat(40));

const required = {
  'CRONOS_WS': process.env.CRONOS_WS,
  'CRONOS_HTTP': process.env.CRONOS_HTTP,
  'TG_BOT_TOKEN': process.env.TG_BOT_TOKEN,
  'TG_CHAT_ID': process.env.TG_CHAT_ID
};

const optional = {
  'MIN_SUPPLY': process.env.MIN_SUPPLY || '0',
  'FACTORIES': process.env.FACTORIES || 'default'
};

console.log('✅ Required variables:');
Object.entries(required).forEach(([key, value]) => {
  const status = value ? '✅ Set' : '❌ Missing';
  console.log(`  ${key}: ${status}`);
});

console.log('\n📊 Optional variables:');
Object.entries(optional).forEach(([key, value]) => {
  console.log(`  ${key}: ${value}`);
});

console.log('\n🚀 Ready to start scanner?');
const missing = Object.entries(required).filter(([_, value]) => !value);
if (missing.length === 0) {
  console.log('✅ All required variables are set!');
  console.log('Run: npm start');
} else {
  console.log('❌ Missing required variables:');
  missing.forEach(([key]) => console.log(`  - ${key}`));
  console.log('\nPlease add the missing variables to your .env file');
}
