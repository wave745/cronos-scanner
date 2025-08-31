# Keeping Cronos Scanner Running Persistently

This guide shows you how to keep your Cronos Scanner running even when you're offline or shut down your PC.

## Quick Setup (Recommended)

Run this command to set up persistent running:

```bash
npm run persistent
```

This will:
- Install PM2 globally
- Start your scanner with PM2
- Configure auto-restart on crashes
- Set up startup on system boot

## Manual Setup

### 1. Install PM2
```bash
npm install -g pm2
```

### 2. Start with PM2
```bash
pm2 start ecosystem.config.cjs
```

### 3. Save Configuration
```bash
pm2 save
```

### 4. Setup Auto-Start (Run as Administrator)
```bash
pm2 startup
```
Follow the instructions shown by the command above.

## Useful Commands

```bash
# Check status
npm run pm2:status
# or
pm2 status

# View logs
npm run pm2:logs
# or
pm2 logs

# Restart scanner
npm run pm2:restart
# or
pm2 restart all

# Stop scanner
npm run pm2:stop
# or
pm2 stop all
```

## Cloud Hosting Options

### Option 1: Railway.app (Easiest)
1. Go to [railway.app](https://railway.app)
2. Connect your GitHub repository
3. Deploy automatically
4. Free tier available

### Option 2: Render.com
1. Go to [render.com](https://render.com)
2. Create new Web Service
3. Connect your GitHub repo
4. Set build command: `npm install`
5. Set start command: `npm start`

### Option 3: VPS (DigitalOcean, AWS, etc.)
1. Rent a VPS ($5-20/month)
2. Upload your code
3. Install Node.js and PM2
4. Run the persistent setup

## Local Options

### Keep PC Running
- Disable sleep/hibernation in Windows Power Settings
- Use the provided batch file: `start-scanner.bat`

### Raspberry Pi
- Buy a Raspberry Pi (~$35-50)
- Install Node.js and your scanner
- Very low power consumption (~5W)
- Perfect for 24/7 running

## Monitoring

Your scanner will log to:
- `./logs/combined.log` - All logs
- `./logs/out.log` - Standard output
- `./logs/err.log` - Error logs

## Troubleshooting

### Scanner not starting on boot
1. Run `pm2 startup` as Administrator
2. Follow the exact command shown
3. Restart your computer

### Scanner keeps crashing
1. Check logs: `pm2 logs`
2. Verify your `.env` file is configured
3. Check network connectivity
4. Ensure sufficient disk space

### PM2 not found
```bash
npm install -g pm2
```

## Environment Variables

Make sure your `.env` file is properly configured:
```
TG_BOT_TOKEN=your_telegram_bot_token
TG_CHAT_ID=your_chat_id
MIN_SUPPLY=1000000
FACTORIES=0x3b44b2a187a7b3824131f8db5a74194d0a42fc15,0x7c9fa4433e491c39765cc44df0b7f2c5d86e6e6b
```

## Security Notes

- Keep your `.env` file secure
- Don't commit API keys to version control
- Use strong passwords for cloud services
- Regularly update dependencies
