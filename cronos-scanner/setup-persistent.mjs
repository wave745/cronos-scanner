import { execSync } from 'child_process';
import { existsSync } from 'fs';

console.log('🚀 Setting up Cronos Scanner for persistent running...\n');

try {
  // Check if PM2 is installed globally
  console.log('📦 Checking PM2 installation...');
  try {
    execSync('pm2 --version', { stdio: 'pipe' });
    console.log('✅ PM2 is already installed');
  } catch (error) {
    console.log('📥 Installing PM2 globally...');
    execSync('npm install -g pm2', { stdio: 'inherit' });
    console.log('✅ PM2 installed successfully');
  }

  // Start the application with PM2
  console.log('\n🔄 Starting Cronos Scanner with PM2...');
  execSync('pm2 start ecosystem.config.cjs', { stdio: 'inherit' });

  // Save PM2 configuration
  console.log('\n💾 Saving PM2 configuration...');
  execSync('pm2 save', { stdio: 'inherit' });

  // Setup PM2 to start on system boot
  console.log('\n🔧 Setting up PM2 to start on system boot...');
  try {
    execSync('pm2 startup', { stdio: 'inherit' });
    console.log('⚠️  Please run the command shown above as Administrator to complete the setup');
  } catch (error) {
    console.log('ℹ️  PM2 startup command will be shown - run it as Administrator');
  }

  // Show status
  console.log('\n📊 Current PM2 status:');
  execSync('pm2 status', { stdio: 'inherit' });

  console.log('\n🎉 Setup complete! Your Cronos Scanner will now:');
  console.log('   • Restart automatically if it crashes');
  console.log('   • Start automatically when your system boots');
  console.log('   • Log all activity to ./logs/ directory');
  console.log('\n📝 Useful commands:');
  console.log('   pm2 status          - Check status');
  console.log('   pm2 logs            - View logs');
  console.log('   pm2 restart all     - Restart scanner');
  console.log('   pm2 stop all        - Stop scanner');

} catch (error) {
  console.error('❌ Setup failed:', error.message);
  process.exit(1);
}
