# Large Event Weather Dashboard

A comprehensive weather situational awareness dashboard designed for large outdoor events. Displays real-time weather observations, radar, satellite imagery, and near-term forecasts on a 16:9 display.

## Features

- **Real-time Weather Data**: Current conditions from NOAA weather stations
- **Weather Alerts**: Active watches and warnings for the event location
- **Radar Imagery**: NOAA RIDGE radar displays
- **Satellite Imagery**: GOES-16 satellite products (GeoColor, Visible, IR, Water Vapor)
- **Hourly Forecasts**: Near-term forecast data
- **GRIB Processing**: Framework for high-resolution model data (HRRR, NAM, GFS)
- **Configurable Location**: Easy event location and metadata configuration

## Technology Stack

**Backend:**
- Node.js with Express
- NOAA API integration
- Automated data caching
- Scheduled updates with node-cron

**Frontend:**
- Vanilla JavaScript
- Responsive CSS Grid layout
- Optimized for 16:9 displays
- Auto-refreshing data

**Data Sources:**
- NOAA National Weather Service API
- NOAA RIDGE Radar
- NOAA GOES Satellite
- NOMADS GRIB2 data (planned)

## Setup

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Configure Event Location:**
   Edit `config/event.config.json` with your event details:
   ```json
   {
     "event": {
       "name": "Your Event Name",
       "location": "Venue Name",
       "latitude": 40.7128,
       "longitude": -74.0060,
       "timezone": "America/New_York",
       "startDate": "2026-06-15T09:00:00",
       "endDate": "2026-06-15T22:00:00"
     }
   }
   ```

4. **Start the Server:**
   ```bash
   npm start
   # Or for development with auto-reload:
   npm run dev
   ```

5. **Access Dashboard:**
   Open http://localhost:3000 in your browser

## Project Structure

```
LargeEventDashboard/
├── backend/
│   ├── routes/          # API route handlers
│   ├── services/        # Business logic and data fetching
│   ├── utils/           # Utility functions
│   ├── middleware/      # Express middleware
│   └── server.js        # Main server file
├── frontend/
│   ├── css/            # Stylesheets
│   ├── js/             # Frontend JavaScript
│   └── index.html      # Main dashboard HTML
├── config/
│   └── event.config.json  # Event configuration
├── data/
│   ├── cache/          # Cached weather data
│   ├── radar/          # Radar imagery
│   ├── satellite/      # Satellite imagery
│   └── grib/           # GRIB2 data files
└── package.json
```

## API Endpoints

- `GET /api/config` - Get event configuration
- `GET /api/weather/current` - Current weather conditions
- `GET /api/weather/forecast/hourly` - Hourly forecast
- `GET /api/weather/alerts` - Active weather alerts
- `GET /api/radar/latest` - Latest radar image
- `GET /api/radar/loop` - Radar animation frames
- `GET /api/satellite/latest` - Latest satellite image
- `GET /api/satellite/product/:type` - Specific satellite product
- `GET /api/grib/latest` - Latest GRIB data (planned)

## Development Roadmap

### Phase 1 (Current)
- ✅ Basic project structure
- ✅ NOAA API integration
- ✅ Radar and satellite display
- ✅ Weather alerts
- ✅ Hourly forecasts

### Phase 2 (Planned)
- [ ] GRIB2 data processing (requires `grib2json` or `wgrib2`)
- [ ] Advanced radar features (storm tracks, velocity)
- [ ] Lightning detection integration
- [ ] Historical trend charts
- [ ] WebSocket for real-time updates

### Phase 3 (Future)
- [ ] Multi-location support
- [ ] Custom alert thresholds
- [ ] Mobile companion app
- [ ] Data export capabilities
- [ ] Integration with event management systems

## GRIB Data Implementation

To add GRIB2 processing capabilities:

1. Install wgrib2 or use a Node.js GRIB library
2. Update `backend/services/grib.service.js`
3. Configure NOMADS data sources
4. Add visualization layer to frontend

Example libraries:
- `grib2json` - Convert GRIB2 to JSON
- Node bindings for `wgrib2`

## Display Optimization

The dashboard is optimized for 16:9 displays (1920x1080 or higher). For best results:

- Use fullscreen mode (F11 in most browsers)
- Disable browser UI elements
- Use a dedicated display device
- Consider kiosk mode for production deployments

## Contributing

This is a custom dashboard for event weather monitoring. Contributions and suggestions are welcome.

## License

MIT

## Acknowledgments

- NOAA National Weather Service for weather data
- NOAA RIDGE for radar imagery
- NOAA GOES for satellite imagery
