# Development Guide

## Architecture Overview

### Backend Architecture

The backend uses a layered architecture:

```
Routes → Services → External APIs
         ↓
      Cache/Storage
```

**Routes Layer (`backend/routes/`):**
- Handle HTTP requests
- Validate input
- Call appropriate services
- Return JSON responses

**Services Layer (`backend/services/`):**
- Business logic
- API integration
- Data caching
- Background jobs

**Utilities (`backend/utils/`):**
- Helper functions
- Conversions
- Logging

### Frontend Architecture

The frontend uses a component-based approach with vanilla JavaScript:

- Single-page application
- Grid-based layout optimized for 16:9
- Auto-refreshing data fetching
- Responsive to different screen sizes

## Data Flow

1. **Initial Load:**
   - Frontend loads configuration
   - Fetches all data endpoints
   - Displays on dashboard

2. **Background Updates:**
   - Backend services run on cron schedules
   - Data cached locally
   - Frontend polls for updates

3. **Real-time Updates (Future):**
   - WebSocket connection
   - Push updates to frontend
   - Reduce polling overhead

## API Integration Details

### NOAA Weather API

**Endpoints Used:**
- Points API: Get grid point for lat/lon
- Observations: Current weather conditions
- Forecast: Hourly and daily forecasts
- Alerts: Active watches/warnings

**Authentication:**
- No API key required
- Must include User-Agent header
- Rate limits: ~5 requests per second

**Example Request:**
```javascript
const response = await axios.get(
  `https://api.weather.gov/points/${lat},${lon}`,
  { headers: { 'User-Agent': 'YourApp/1.0' } }
);
```

### NOAA Radar

**Source:** RIDGE (Radar Image Database and Graphics Engine)

**URL Pattern:**
```
https://radar.weather.gov/ridge/standard/[STATION]_loop.gif
```

**Common Stations:**
- KOKX: New York City area
- KLWX: Washington DC area
- KDOX: Philadelphia area
- KLOT: Chicago area

### NOAA GOES Satellite

**Source:** GOES-16 (East) and GOES-17 (West)

**Products:**
- GeoColor: Enhanced color composite
- Band 2: Visible (0.64 μm)
- Band 13: Clean IR Longwave Window (10.3 μm)
- Band 9: Mid-level Water Vapor (6.9 μm)

**URL Pattern:**
```
https://cdn.star.nesdis.noaa.gov/GOES16/ABI/CONUS/[PRODUCT]/latest.jpg
```

### GRIB Data (Planned)

**Sources:**
- NOMADS (NOAA Operational Model Archive)
- HRRR: 3km resolution, hourly updates
- NAM: 12km resolution, 4x daily
- GFS: 0.25° resolution, 4x daily

**Processing:**
- Download GRIB2 files
- Extract parameters (temp, precip, wind)
- Convert to JSON or imagery
- Cache for display

**Tools Needed:**
- `wgrib2` command-line tool
- OR `grib2json` library
- OR Node.js GRIB bindings

## Configuration

### Event Configuration (`config/event.config.json`)

```json
{
  "event": {
    "name": "Event name",
    "location": "Venue",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "timezone": "America/New_York",
    "startDate": "ISO 8601 format",
    "endDate": "ISO 8601 format"
  },
  "dashboard": {
    "refreshInterval": 300000,
    "radarRefreshInterval": 120000,
    "satelliteRefreshInterval": 300000
  }
}
```

### Environment Variables (`.env`)

```bash
PORT=3000
NODE_ENV=development
NOAA_API_TOKEN=optional
WEATHER_UPDATE_INTERVAL=300000
LOG_LEVEL=info
```

## Deployment

### Local Development

```bash
npm run dev
# Server runs with nodemon for auto-reload
```

### Production Deployment

**Option 1: Simple Server**
```bash
npm start
# Run with PM2 for process management:
pm2 start backend/server.js --name weather-dashboard
```

**Option 2: Docker**
```dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

**Option 3: Cloud Hosting**
- AWS EC2 / Lightsail
- Google Cloud Compute
- DigitalOcean Droplet
- Heroku

### Reverse Proxy Setup (nginx)

```nginx
server {
  listen 80;
  server_name your-domain.com;

  location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }
}
```

## Performance Optimization

### Caching Strategy

1. **Weather Data:** Cache for 5 minutes
2. **Radar Images:** Cache last 20 images
3. **Satellite Images:** Cache last 10 images
4. **GRIB Data:** Cache current run

### Database Considerations (Future)

For historical data and analytics:
- SQLite for simple deployment
- PostgreSQL for production
- TimescaleDB for time-series data

## Testing

### Manual Testing

1. Verify all API endpoints return data
2. Check dashboard displays correctly
3. Test auto-refresh functionality
4. Verify alerts display properly

### Automated Testing (Future)

```bash
npm test
```

Consider adding:
- Unit tests for services
- Integration tests for API endpoints
- E2E tests for frontend

## Troubleshooting

### Server won't start
- Check port 3000 is available: `lsof -i :3000`
- Verify node_modules installed: `npm install`
- Check .env file exists

### No weather data displaying
- Verify internet connection
- Check NOAA API is accessible
- Verify lat/lon in config is valid
- Check browser console for errors

### Radar/Satellite not loading
- Check NOAA CDN is accessible
- Verify CORS settings
- Check image URLs are correct
- Look for 404 errors in network tab

## Future Enhancements

### High Priority
- [ ] GRIB2 data processing
- [ ] WebSocket real-time updates
- [ ] Lightning detection integration
- [ ] Storm tracking overlays

### Medium Priority
- [ ] Historical data storage
- [ ] Trend charts and graphs
- [ ] Custom alert thresholds
- [ ] Multi-location support

### Low Priority
- [ ] Mobile companion app
- [ ] Email/SMS notifications
- [ ] Data export (CSV/JSON)
- [ ] API documentation (Swagger)

## Resources

- [NOAA API Documentation](https://www.weather.gov/documentation/services-web-api)
- [NOAA Radar Info](https://radar.weather.gov/)
- [GOES Satellite Info](https://www.star.nesdis.noaa.gov/goes/)
- [NOMADS Data Archive](https://nomads.ncep.noaa.gov/)
- [Express.js Docs](https://expressjs.com/)
