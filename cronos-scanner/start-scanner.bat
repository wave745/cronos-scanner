@echo off
cd /d "%~dp0"
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
echo Scanner started successfully!
pause
