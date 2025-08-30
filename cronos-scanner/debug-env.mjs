import 'dotenv/config';
import fs from 'fs';

console.log('=== Environment Debug ===');
console.log('Current directory:', process.cwd());
console.log('.env file exists:', fs.existsSync('.env'));

if (fs.existsSync('.env')) {
  console.log('.env contents:');
  console.log(fs.readFileSync('.env', 'utf8'));
}

console.log('\nEnvironment variables:');
console.log('CRONOS_WS:', process.env.CRONOS_WS);
console.log('CRONOS_HTTP:', process.env.CRONOS_HTTP);
console.log('NODE_ENV:', process.env.NODE_ENV);
