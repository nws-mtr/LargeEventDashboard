# Quick Start Guide

## 🚀 Getting Started in 5 Minutes

### Step 1: Configure Your Event

Edit `config/event.config.json`:

```json
{
  "event": {
    "name": "Your Event Name Here",
    "location": "Venue Name",
    "latitude": YOUR_LATITUDE,
    "longitude": YOUR_LONGITUDE,
    "timezone": "America/New_York",
    "startDate": "2026-06-15T09:00:00",
    "endDate": "2026-06-15T22:00:00"
  }
}
```

**Find Your Coordinates:**
- Google Maps: Right-click → "What's here?"
- Or use: https://www.latlong.net/

### Step 2: Start the Server

```bash
npm start
```

### Step 3: Open Dashboard

Open your browser to: **http://localhost:3000**

That's it! Your weather dashboard is now running.

## 📊 What You'll See

### Header
- Event name and location
- Current date and time

### Main Panels

1. **Current Conditions** (Top Left)
   - Temperature, humidity, wind
   - Pressure, visibility, dewpoint

2. **Weather Alerts** (Bottom Left)
   - Active watches and warnings
   - Color-coded by severity

3. **Radar** (Center)
   - Live weather radar
   - Auto-updates every 2 minutes

4. **Satellite** (Right)
   - GOES satellite imagery
   - Multiple products available

5. **Hourly Forecast** (Bottom Center)
   - Next 12 hours
   - Temperature and conditions

6. **Forecast Summary** (Bottom Right)
   - Detailed text forecasts

## 🎨 Display Setup

### For Best Results

**Recommended Display:**
- 16:9 aspect ratio (1920x1080 or higher)
- Full screen mode (press F11)
- Dedicated monitor or TV

**Browser Settings:**
- Disable auto-sleep
- Turn off notifications
- Use kiosk mode for production

### Kiosk Mode (Chrome)

```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --kiosk "http://localhost:3000"

# Linux
google-chrome --kiosk "http://localhost:3000"

# Windows
chrome.exe --kiosk "http://localhost:3000"
```

## 🔄 Data Updates

Updates happen automatically:

- **Weather Data:** Every 5 minutes
- **Radar:** Every 2 minutes
- **Satellite:** Every 5 minutes
- **Alerts:** Every 1 minute

You can modify these intervals in `config/event.config.json`

## 🛠️ Customization

### Change Refresh Rates

Edit `config/event.config.json`:

```json
{
  "dashboard": {
    "refreshInterval": 300000,
    "radarRefreshInterval": 120000,
    "satelliteRefreshInterval": 300000
  }
}
```

Times are in milliseconds (1000 ms = 1 second)

### Change Colors/Styling

Edit `frontend/css/style.css` - look for the `:root` variables:

```css
:root {
  --bg-primary: #0a0e27;
  --accent-blue: #2196f3;
  /* etc... */
}
```

## 🐛 Common Issues

### "Address already in use"
Another process is using port 3000.

**Fix:**
```bash
# Find and kill the process
lsof -ti:3000 | xargs kill -9
```

### No Weather Data
Check your internet connection and verify the lat/lon in config.

**Test API:**
```bash
curl "https://api.weather.gov/points/40.7128,-74.0060"
```

### Radar Not Loading
NOAA servers might be temporarily unavailable. Wait a few minutes and refresh.

## 📱 Access from Other Devices

### Find Your IP Address

```bash
# macOS/Linux
ifconfig | grep "inet "

# Or use hostname
hostname -I
```

Then access from other devices on your network:
- `http://YOUR_IP_ADDRESS:3000`
- Example: `http://192.168.1.100:3000`

## 🎯 Tips for Events

1. **Test Before Event Day**
   - Verify location is correct
   - Check all data is loading
   - Test display on actual screen

2. **Backup Internet**
   - Have redundant internet connection
   - Consider mobile hotspot backup

3. **Power Management**
   - Disable sleep modes
   - Use UPS for critical equipment

4. **Monitoring**
   - Keep server logs visible
   - Monitor API rate limits
   - Have backup weather source

## 📞 Need Help?

Check the full documentation:
- `README.md` - Overview and features
- `DEVELOPMENT.md` - Technical details

## 🎉 You're All Set!

Your weather dashboard is ready for your event. Monitor conditions in real-time and stay ahead of changing weather.

**Pro Tip:** Take a screenshot of the dashboard when it's working perfectly - you can use it as a reference if you need to troubleshoot later.
