# Troubleshooting Guide

## Common Issues and Solutions

### Server Won't Start

#### Error: "Address already in use"
**Problem:** Port 3000 is already occupied

**Solution:**
```bash
# Find and kill process using port 3000
lsof -ti:3000 | xargs kill -9

# Or use a different port
# Edit .env file:
PORT=3001
```

#### Error: "Cannot find module"
**Problem:** Dependencies not installed

**Solution:**
```bash
npm install
```

#### Error: "ENOENT: no such file or directory"
**Problem:** Missing data directories

**Solution:**
```bash
mkdir -p data/cache data/radar data/satellite data/grib
```

### No Weather Data Displaying

#### Check 1: Verify Internet Connection
```bash
# Test NOAA API access
curl "https://api.weather.gov/points/40.7128,-74.0060"
```

**Expected:** JSON response with weather data
**If fails:** Check your internet connection

#### Check 2: Verify Configuration
```bash
# Check config file exists and is valid JSON
cat config/event.config.json | python -m json.tool
```

**Expected:** Formatted JSON output
**If fails:** Fix JSON syntax errors

#### Check 3: Check Coordinates
- Latitude range: -90 to 90
- Longitude range: -180 to 180
- Must be within US for NOAA data

**Test coordinates:**
```bash
# Should return valid response
curl "https://api.weather.gov/points/YOUR_LAT,YOUR_LON"
```

#### Check 4: Browser Console Errors
1. Open browser Developer Tools (F12)
2. Check Console tab for errors
3. Check Network tab for failed requests

### Radar Not Loading

#### Issue: Blank Radar Display

**Check 1:** NOAA servers accessible
```bash
curl -I "https://radar.weather.gov/ridge/standard/CONUS_loop.gif"
```

**Solution:** If NOAA is down, wait and retry

**Check 2:** Browser blocking images
- Check if CORS errors in console
- Try different browser

**Check 3:** Update radar URL
Edit `frontend/js/app.js` and try different radar:
```javascript
img.src = 'https://radar.weather.gov/ridge/standard/CONUS_loop.gif';
```

### Satellite Not Loading

#### Issue: Satellite images don't appear

**Check 1:** GOES CDN accessible
```bash
curl -I "https://cdn.star.nesdis.noaa.gov/GOES16/ABI/CONUS/GEOCOLOR/latest.jpg"
```

**Check 2:** Try different product
Use dropdown to switch between:
- GeoColor
- Visible
- Infrared
- Water Vapor

**Check 3:** Clear browser cache
```bash
# Hard refresh in browser
Ctrl+Shift+R (Windows/Linux)
Cmd+Shift+R (Mac)
```

### Dashboard Layout Issues

#### Issue: Panels overlapping or misaligned

**Solution 1:** Check screen resolution
- Minimum: 1920x1080
- Recommended: 16:9 aspect ratio

**Solution 2:** Browser zoom
- Reset zoom to 100%
- Press Ctrl+0 (Windows/Linux) or Cmd+0 (Mac)

**Solution 3:** Clear cache and reload
```bash
# In browser
Ctrl+Shift+Delete → Clear cache
```

### Performance Issues

#### Issue: Dashboard running slow

**Check 1:** System resources
```bash
# Check memory usage
top
# or
htop
```

**Solution:** Increase refresh intervals in config:
```json
{
  "dashboard": {
    "refreshInterval": 600000,
    "radarRefreshInterval": 300000,
    "satelliteRefreshInterval": 600000
  }
}
```

**Check 2:** Browser console errors
- Open Dev Tools
- Look for JavaScript errors
- Check network requests

**Solution:** Clear browser data and reload

#### Issue: High memory usage

**Solution 1:** Reduce data retention
```json
{
  "dataRetention": {
    "cacheDurationHours": 12,
    "maxRadarImages": 10,
    "maxSatelliteImages": 5
  }
}
```

**Solution 2:** Restart server periodically
```bash
# Add to crontab for daily restart
0 3 * * * systemctl restart weather-dashboard
```

### API Rate Limiting

#### Issue: 429 Too Many Requests

**Problem:** Exceeding NOAA API rate limits

**Solution 1:** Increase refresh intervals
```json
{
  "dashboard": {
    "refreshInterval": 600000
  }
}
```

**Solution 2:** Check for duplicate requests
- Review browser Network tab
- Ensure only one dashboard instance running

### Data Not Updating

#### Issue: Stale data, last update time not changing

**Check 1:** Server logs
```bash
# If using PM2
pm2 logs weather-dashboard

# If using systemd
journalctl -u weather-dashboard -f

# If running directly
# Check terminal output
```

**Check 2:** Cron jobs running
- Verify background updates are executing
- Check server console for "🔄 Updating..." messages

**Solution:** Restart server
```bash
npm start
# or
pm2 restart weather-dashboard
```

### Browser-Specific Issues

#### Chrome/Edge

**Issue:** High CPU usage
**Solution:** Disable hardware acceleration
- Settings → Advanced → System → Turn off "Use hardware acceleration"

**Issue:** Memory leaks
**Solution:** Use kiosk mode
```bash
chrome --kiosk "http://localhost:3000"
```

#### Firefox

**Issue:** Layout rendering issues
**Solution:** Ensure latest version, try Chrome

#### Safari

**Issue:** Some features not working
**Solution:** Use Chrome or Firefox for best compatibility

### Network Issues

#### Issue: Dashboard loads but no external data

**Check 1:** Firewall blocking outbound connections
```bash
# Test NOAA connectivity
curl -v "https://api.weather.gov"
```

**Solution:** Allow outbound HTTPS (port 443)

**Check 2:** Proxy configuration
If behind corporate proxy, set environment variables:
```bash
export HTTP_PROXY="http://proxy.example.com:8080"
export HTTPS_PROXY="http://proxy.example.com:8080"
```

**Check 3:** DNS resolution
```bash
# Test DNS
nslookup api.weather.gov
```

### Configuration Issues

#### Issue: Changes not taking effect

**Solution:** Restart server after config changes
```bash
# Kill server (Ctrl+C)
# Restart
npm start
```

#### Issue: Invalid JSON in config

**Validate JSON:**
```bash
# macOS/Linux
cat config/event.config.json | python -m json.tool

# Or use online validator
# https://jsonlint.com/
```

**Common JSON errors:**
- Trailing commas
- Missing quotes
- Unescaped characters

### Development Issues

#### Issue: nodemon not found

**Solution:**
```bash
npm install -g nodemon
# or use npx
npx nodemon backend/server.js
```

#### Issue: Port permissions (Linux)

**Problem:** Cannot bind to port < 1024

**Solution:**
```bash
# Use port > 1024 (like 3000)
# Or use authbind
sudo apt-get install authbind
```

### Logging and Debugging

#### Enable Debug Logging

Edit `.env`:
```bash
LOG_LEVEL=debug
```

Restart server to see detailed logs.

#### Check All Endpoints

```bash
# Test all API endpoints
curl http://localhost:3000/api/config
curl http://localhost:3000/api/weather/current
curl http://localhost:3000/api/weather/forecast/hourly
curl http://localhost:3000/api/weather/alerts
curl http://localhost:3000/api/radar/latest
curl http://localhost:3000/api/satellite/latest
```

#### Monitor Network Traffic

```bash
# Use browser DevTools
F12 → Network tab → Reload page

# Look for:
# - 200 OK responses
# - Failed requests (red)
# - Slow requests (timing column)
```

### Production Deployment Issues

#### Issue: Works locally but not in production

**Check 1:** Environment variables
```bash
# Ensure .env exists in production
ls -la .env
```

**Check 2:** File permissions
```bash
# Config should be readable
chmod 644 config/event.config.json

# Data directories should be writable
chmod 755 data/cache data/radar data/satellite
```

**Check 3:** Firewall rules
```bash
# Allow port 3000
sudo ufw allow 3000/tcp
```

#### Issue: Nginx reverse proxy not working

**Check config:**
```bash
# Test nginx config
sudo nginx -t

# Check nginx logs
sudo tail -f /var/log/nginx/error.log
```

**Common fix:** Update proxy settings
```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
```

### Emergency Recovery

#### Complete Reset

```bash
# 1. Stop server
pm2 stop weather-dashboard
# or kill process

# 2. Clear all cached data
rm -rf data/cache/* data/radar/* data/satellite/*

# 3. Reinstall dependencies
rm -rf node_modules
npm install

# 4. Restart server
npm start
```

#### Restore from Backup

```bash
# Restore config
tar -xzf backup/config_YYYYMMDD.tar.gz

# Restore data
tar -xzf backup/data_YYYYMMDD.tar.gz

# Restart
npm start
```

## Getting Help

### Check Documentation
1. README.md - Overview
2. QUICKSTART.md - Setup guide
3. DEVELOPMENT.md - Technical details
4. DEPLOYMENT.md - Production setup

### Diagnostic Checklist

Before asking for help, check:
- [ ] Server is running
- [ ] Internet connection works
- [ ] NOAA API is accessible
- [ ] Configuration is valid JSON
- [ ] Lat/lon coordinates are correct
- [ ] Browser console shows no errors
- [ ] Sufficient disk space
- [ ] Correct Node.js version (18+)

### Report Issues

Include:
1. Error message (exact text)
2. Server logs
3. Browser console output
4. Configuration (remove sensitive data)
5. System info (OS, Node version)

### Quick Diagnostic Script

```bash
#!/bin/bash
echo "=== Weather Dashboard Diagnostics ==="
echo ""
echo "Node version:"
node --version
echo ""
echo "Port 3000 status:"
lsof -i :3000
echo ""
echo "Config valid:"
cat config/event.config.json | python -m json.tool > /dev/null && echo "✓ Valid" || echo "✗ Invalid"
echo ""
echo "NOAA API accessible:"
curl -s -o /dev/null -w "%{http_code}" "https://api.weather.gov" | grep -q 200 && echo "✓ Yes" || echo "✗ No"
echo ""
echo "Data directories exist:"
ls -d data/cache data/radar data/satellite > /dev/null && echo "✓ Yes" || echo "✗ No"
echo ""
echo "Dependencies installed:"
[ -d node_modules ] && echo "✓ Yes" || echo "✗ No"
```

Save as `diagnose.sh`, make executable, and run:
```bash
chmod +x diagnose.sh
./diagnose.sh
```
