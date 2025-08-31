#!/bin/bash

echo "🚀 Setting up Cronos Scanner on DigitalOcean..."

# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install Node.js 18.x
echo "📥 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs

# Install PM2 globally
echo "📥 Installing PM2..."
npm install -g pm2

# Install Git
echo "📥 Installing Git..."
apt install -y git

# Create application directory
echo "📁 Creating application directory..."
mkdir -p /opt/cronos-scanner
cd /opt/cronos-scanner

# Clone your repository (replace with your actual repo URL)
echo "📥 Cloning repository..."
# git clone https://github.com/yourusername/cronos-scanner.git .
# OR upload files manually via SCP/SFTP

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create logs directory
mkdir -p logs

# Create environment file template
echo "📝 Creating .env template..."
cat > .env.template << EOF
# Telegram Bot Configuration
TG_BOT_TOKEN=your_telegram_bot_token_here
TG_CHAT_ID=your_chat_id_here

# Scanner Configuration
MIN_SUPPLY=1000000
FACTORIES=0x3b44b2a187a7b3824131f8db5a74194d0a42fc15,0x7c9fa4433e491c39765cc44df0b7f2c5d86e6e6b,0x9deB29c9A4c7A88a3C0257393b7f3335338D9A9D

# Optional: Custom RPC endpoints
# RPC_ENDPOINTS=https://evm.cronos.org,https://cronos.blockpi.network/v1/rpc/public
EOF

# Set up PM2
echo "🔧 Setting up PM2..."
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup

# Create systemd service for PM2
echo "🔧 Creating systemd service..."
pm2 startup systemd -u root --hp /root

# Set up firewall (optional)
echo "🔥 Setting up firewall..."
ufw allow ssh
ufw allow 22
ufw --force enable

# Create monitoring script
echo "📊 Creating monitoring script..."
cat > /opt/cronos-scanner/monitor.sh << 'EOF'
#!/bin/bash
cd /opt/cronos-scanner

# Check if PM2 is running
if ! pm2 list | grep -q "cronos-scanner"; then
    echo "$(date): Cronos Scanner not running, restarting..."
    pm2 start ecosystem.config.cjs
    pm2 save
fi

# Check disk space
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "$(date): Warning: Disk usage is ${DISK_USAGE}%"
fi

# Check memory usage
MEMORY_USAGE=$(free | grep Mem | awk '{printf("%.0f", $3/$2 * 100.0)}')
if [ $MEMORY_USAGE -gt 80 ]; then
    echo "$(date): Warning: Memory usage is ${MEMORY_USAGE}%"
fi
EOF

chmod +x /opt/cronos-scanner/monitor.sh

# Add monitoring to crontab
echo "⏰ Setting up monitoring cron job..."
(crontab -l 2>/dev/null; echo "*/5 * * * * /opt/cronos-scanner/monitor.sh >> /opt/cronos-scanner/logs/monitor.log 2>&1") | crontab -

# Create log rotation
echo "📄 Setting up log rotation..."
cat > /etc/logrotate.d/cronos-scanner << EOF
/opt/cronos-scanner/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 644 root root
}
EOF

echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Copy your .env file to /opt/cronos-scanner/.env"
echo "2. Update the .env file with your actual credentials"
echo "3. Restart the scanner: pm2 restart all"
echo ""
echo "📊 Useful commands:"
echo "   pm2 status          - Check status"
echo "   pm2 logs            - View logs"
echo "   pm2 restart all     - Restart scanner"
echo "   pm2 stop all        - Stop scanner"
echo ""
echo "📁 Application location: /opt/cronos-scanner"
echo "📄 Logs location: /opt/cronos-scanner/logs/"
