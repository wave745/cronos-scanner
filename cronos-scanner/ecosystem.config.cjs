module.exports = {
  apps: [{
    name: 'cronos-scanner',
    script: './index.mjs',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_restarts: 10,
    min_uptime: '10s',
    kill_timeout: 5000,
    // Enhanced restart policy
    restart_delay: 4000,
    exp_backoff_restart_delay: 100,
    // Better monitoring
    pmx: true,
    // Auto-restart on file changes (optional)
    watch: ['index.mjs', 'provider.js'],
    ignore_watch: ['node_modules', 'logs', '*.db'],
    // Environment-specific configs
    env_production: {
      NODE_ENV: 'production',
      PM2_HOME: './logs'
    }
  }]
};
