# DigitalOcean Deployment Guide

This guide will help you deploy your Cronos Scanner to DigitalOcean for 24/7 operation.

## Prerequisites

- DigitalOcean account with active subscription
- Your Cronos Scanner code ready
- Telegram bot token and chat ID

## Step 1: Create a Droplet

1. **Log into DigitalOcean**
2. **Click "Create" → "Droplets"**
3. **Choose configuration:**
   - **Image**: Ubuntu 22.04 LTS
   - **Plan**: Basic
   - **CPU**: Regular CPU
   - **Memory**: 1GB RAM (minimum)
   - **Storage**: 25GB SSD
   - **Datacenter**: Choose closest to you
   - **Authentication**: SSH Key (recommended) or Password
   - **Name**: `cronos-scanner`

4. **Click "Create Droplet"**

## Step 2: Connect to Your Droplet

### Option A: Using SSH Key (Recommended)
```bash
ssh root@your-droplet-ip
```

### Option B: Using Password
```bash
ssh root@your-droplet-ip
# Enter the password sent to your email
```

## Step 3: Upload Your Code

### Option A: Using Git (Recommended)
```bash
# On your droplet
cd /opt
git clone https://github.com/yourusername/cronos-scanner.git
cd cronos-scanner
```

### Option B: Using SCP (Manual Upload)
From your local machine:
```bash
scp -r /path/to/your/cronos-scanner root@your-droplet-ip:/opt/
```

### Option C: Using SFTP
Use an SFTP client like FileZilla to upload your files to `/opt/cronos-scanner/`

## Step 4: Run the Setup Script

```bash
# Make the script executable
chmod +x digitalocean-setup.sh

# Run the setup
./digitalocean-setup.sh
```

## Step 5: Configure Environment Variables

```bash
# Copy your .env file
cp .env.template .env

# Edit the .env file with your actual credentials
nano .env
```

Make sure to set:
- `TG_BOT_TOKEN` - Your Telegram bot token
- `TG_CHAT_ID` - Your Telegram chat ID
- `MIN_SUPPLY` - Minimum supply threshold
- `FACTORIES` - Factory contract addresses

## Step 6: Start the Scanner

```bash
# Install dependencies
npm install

# Start with PM2
pm2 start ecosystem.config.cjs

# Save PM2 configuration
pm2 save

# Check status
pm2 status
```

## Step 7: Verify Everything is Working

```bash
# Check if scanner is running
pm2 status

# View logs
pm2 logs

# Check if it's scanning blocks
tail -f logs/combined.log
```

## Monitoring and Maintenance

### Check Status
```bash
pm2 status
pm2 logs
```

### Restart Scanner
```bash
pm2 restart all
```

### Stop Scanner
```bash
pm2 stop all
```

### View System Resources
```bash
# CPU and memory usage
htop

# Disk usage
df -h

# Check monitoring logs
tail -f logs/monitor.log
```

## Security Considerations

### Firewall Setup
The setup script configures a basic firewall. For additional security:

```bash
# Allow only specific IPs (optional)
ufw allow from your-ip-address to any port 22
ufw deny 22
```

### Regular Updates
```bash
# Update system packages
apt update && apt upgrade -y

# Update Node.js dependencies
npm update
```

## Backup Strategy

### Database Backup
```bash
# Create backup script
cat > /opt/cronos-scanner/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
cp /opt/cronos-scanner/cronos.db /opt/cronos-scanner/backups/cronos_${DATE}.db
# Keep only last 7 days of backups
find /opt/cronos-scanner/backups -name "cronos_*.db" -mtime +7 -delete
EOF

chmod +x /opt/cronos-scanner/backup.sh

# Add to crontab (daily backup at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/cronos-scanner/backup.sh") | crontab -
```

## Troubleshooting

### Scanner Not Starting
```bash
# Check logs
pm2 logs

# Check environment variables
cat .env

# Restart PM2
pm2 restart all
```

### High Memory Usage
```bash
# Check memory usage
free -h

# Restart if needed
pm2 restart all
```

### Disk Space Issues
```bash
# Check disk usage
df -h

# Clean old logs
find /opt/cronos-scanner/logs -name "*.log" -mtime +7 -delete
```

## Cost Optimization

- **Droplet Size**: 1GB RAM is sufficient for basic scanning
- **Storage**: 25GB SSD is plenty for logs and database
- **Estimated Cost**: ~$5-6/month for basic droplet

## Scaling Up

If you need more performance:
- Upgrade to 2GB RAM droplet
- Add more CPU cores
- Consider load balancing for multiple scanners

## Support

If you encounter issues:
1. Check the logs: `pm2 logs`
2. Verify your `.env` configuration
3. Ensure your Telegram bot is working
4. Check network connectivity to Cronos RPC endpoints
