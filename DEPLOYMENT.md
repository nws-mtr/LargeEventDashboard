# Production Deployment Examples

## Systemd Service (Linux)

Create `/etc/systemd/system/weather-dashboard.service`:

```ini
[Unit]
Description=Large Event Weather Dashboard
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/weather-dashboard
ExecStart=/usr/bin/node backend/server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

Commands:
```bash
sudo systemctl enable weather-dashboard
sudo systemctl start weather-dashboard
sudo systemctl status weather-dashboard
```

## PM2 Process Manager

```bash
# Install PM2
npm install -g pm2

# Start dashboard
pm2 start backend/server.js --name weather-dashboard

# Save PM2 config
pm2 save

# Setup PM2 to start on boot
pm2 startup

# Monitor
pm2 monit

# Logs
pm2 logs weather-dashboard
```

## Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  dashboard:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    volumes:
      - ./data:/app/data
      - ./config:/app/config
    restart: unless-stopped
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application
COPY backend ./backend
COPY frontend ./frontend
COPY config ./config

# Create data directories
RUN mkdir -p data/cache data/radar data/satellite data/grib

EXPOSE 3000

CMD ["node", "backend/server.js"]
```

Commands:
```bash
docker-compose up -d
docker-compose logs -f
docker-compose down
```

## Nginx Reverse Proxy

Create `/etc/nginx/sites-available/weather-dashboard`:

```nginx
server {
    listen 80;
    server_name weather.yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name weather.yourdomain.com;

    # SSL certificates (use certbot for Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/weather.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/weather.yourdomain.com/privkey.pem;

    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        proxy_pass http://localhost:3000;
        expires 1h;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable and reload:
```bash
sudo ln -s /etc/nginx/sites-available/weather-dashboard /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Environment-Specific Configs

### Production `.env`
```bash
NODE_ENV=production
PORT=3000
LOG_LEVEL=warn

# Production settings
WEATHER_UPDATE_INTERVAL=300000
RADAR_UPDATE_INTERVAL=120000
SATELLITE_UPDATE_INTERVAL=300000
```

### Development `.env`
```bash
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# Faster updates for development
WEATHER_UPDATE_INTERVAL=60000
RADAR_UPDATE_INTERVAL=60000
SATELLITE_UPDATE_INTERVAL=60000
```

## Monitoring & Logs

### Log Rotation (logrotate)

Create `/etc/logrotate.d/weather-dashboard`:

```
/var/log/weather-dashboard/*.log {
    daily
    rotate 7
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        systemctl reload weather-dashboard > /dev/null 2>&1 || true
    endscript
}
```

### Health Check Endpoint

Add to `backend/server.js`:

```javascript
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});
```

### Monitoring with UptimeRobot

- Create free account at uptimerobot.com
- Add HTTP monitor for your health endpoint
- Get alerts if dashboard goes down

## Firewall Configuration

```bash
# UFW (Ubuntu/Debian)
sudo ufw allow 3000/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# firewalld (CentOS/RHEL)
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

## Backup Strategy

### Automated Backups

Create `scripts/backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/backup/weather-dashboard"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup config
tar -czf $BACKUP_DIR/config_$DATE.tar.gz config/

# Backup data
tar -czf $BACKUP_DIR/data_$DATE.tar.gz data/

# Keep only last 7 days
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

Add to crontab:
```bash
# Daily backup at 2 AM
0 2 * * * /opt/weather-dashboard/scripts/backup.sh
```

## SSL Certificate (Let's Encrypt)

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d weather.yourdomain.com

# Auto-renewal (already configured by certbot)
sudo certbot renew --dry-run
```

## Performance Tuning

### Node.js Optimization

```bash
# Increase memory limit if needed
node --max-old-space-size=4096 backend/server.js
```

### PM2 Cluster Mode

```bash
pm2 start backend/server.js -i max --name weather-dashboard
```

## Security Hardening

1. **Use HTTPS in production**
2. **Set up firewall rules**
3. **Regular security updates**
4. **Environment variable security**
5. **Rate limiting** (add to Express)

Add rate limiting:
```bash
npm install express-rate-limit
```

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```
