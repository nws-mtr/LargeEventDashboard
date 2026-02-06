# Sample Event Configurations

## Music Festival

```json
{
  "event": {
    "name": "Summer Music Festival 2026",
    "location": "Central Park - Great Lawn",
    "latitude": 40.7829,
    "longitude": -73.9654,
    "timezone": "America/New_York",
    "startDate": "2026-07-10T12:00:00",
    "endDate": "2026-07-12T23:00:00"
  },
  "dashboard": {
    "refreshInterval": 180000,
    "radarRefreshInterval": 120000,
    "satelliteRefreshInterval": 300000
  },
  "alerts": {
    "enabled": true,
    "checkInterval": 30000
  }
}
```

## Sporting Event (Football Game)

```json
{
  "event": {
    "name": "Championship Game 2026",
    "location": "MetLife Stadium",
    "latitude": 40.8128,
    "longitude": -74.0742,
    "timezone": "America/New_York",
    "startDate": "2026-09-15T13:00:00",
    "endDate": "2026-09-15T17:00:00"
  },
  "dashboard": {
    "refreshInterval": 120000,
    "radarRefreshInterval": 60000,
    "satelliteRefreshInterval": 180000
  },
  "alerts": {
    "enabled": true,
    "checkInterval": 30000
  }
}
```

## Marathon Race

```json
{
  "event": {
    "name": "City Marathon 2026",
    "location": "Downtown Start Line",
    "latitude": 42.3601,
    "longitude": -71.0589,
    "timezone": "America/New_York",
    "startDate": "2026-04-20T08:00:00",
    "endDate": "2026-04-20T15:00:00"
  },
  "dashboard": {
    "refreshInterval": 300000,
    "radarRefreshInterval": 120000,
    "satelliteRefreshInterval": 300000
  },
  "alerts": {
    "enabled": true,
    "checkInterval": 60000
  }
}
```

## Outdoor Wedding

```json
{
  "event": {
    "name": "Smith-Johnson Wedding",
    "location": "Sunset Gardens Venue",
    "latitude": 34.0522,
    "longitude": -118.2437,
    "timezone": "America/Los_Angeles",
    "startDate": "2026-06-15T16:00:00",
    "endDate": "2026-06-15T23:00:00"
  },
  "dashboard": {
    "refreshInterval": 300000,
    "radarRefreshInterval": 180000,
    "satelliteRefreshInterval": 300000
  },
  "alerts": {
    "enabled": true,
    "checkInterval": 60000
  }
}
```

## Film Production

```json
{
  "event": {
    "name": "Movie Production - Outdoor Scenes",
    "location": "On-Location Filming",
    "latitude": 36.1699,
    "longitude": -115.1398,
    "timezone": "America/Los_Angeles",
    "startDate": "2026-03-01T06:00:00",
    "endDate": "2026-03-15T20:00:00"
  },
  "dashboard": {
    "refreshInterval": 300000,
    "radarRefreshInterval": 120000,
    "satelliteRefreshInterval": 300000
  },
  "alerts": {
    "enabled": true,
    "checkInterval": 60000
  }
}
```

## Fair/Carnival (Multi-day)

```json
{
  "event": {
    "name": "State Fair 2026",
    "location": "Fairgrounds Main Gate",
    "latitude": 41.8781,
    "longitude": -87.6298,
    "timezone": "America/Chicago",
    "startDate": "2026-08-01T08:00:00",
    "endDate": "2026-08-14T23:00:00"
  },
  "dashboard": {
    "refreshInterval": 300000,
    "radarRefreshInterval": 120000,
    "satelliteRefreshInterval": 300000
  },
  "alerts": {
    "enabled": true,
    "checkInterval": 45000
  },
  "dataRetention": {
    "cacheDurationHours": 72,
    "maxRadarImages": 50,
    "maxSatelliteImages": 30
  }
}
```

## Emergency Response Command Center

```json
{
  "event": {
    "name": "Hurricane Response Operations",
    "location": "Emergency Operations Center",
    "latitude": 25.7617,
    "longitude": -80.1918,
    "timezone": "America/New_York",
    "startDate": "2026-09-01T00:00:00",
    "endDate": "2026-09-30T23:59:59"
  },
  "dashboard": {
    "refreshInterval": 60000,
    "radarRefreshInterval": 60000,
    "satelliteRefreshInterval": 120000
  },
  "alerts": {
    "enabled": true,
    "checkInterval": 15000
  },
  "dataRetention": {
    "cacheDurationHours": 168,
    "maxRadarImages": 100,
    "maxSatelliteImages": 50
  }
}
```

## Construction Site

```json
{
  "event": {
    "name": "Downtown Construction Project",
    "location": "Construction Site Office",
    "latitude": 39.7392,
    "longitude": -104.9903,
    "timezone": "America/Denver",
    "startDate": "2026-05-01T06:00:00",
    "endDate": "2026-10-31T18:00:00"
  },
  "dashboard": {
    "refreshInterval": 600000,
    "radarRefreshInterval": 300000,
    "satelliteRefreshInterval": 600000
  },
  "alerts": {
    "enabled": true,
    "checkInterval": 120000
  }
}
```

## Configuration Tips by Event Type

### High-Frequency Updates (Severe Weather Events)
- `refreshInterval`: 60000-120000 (1-2 minutes)
- `radarRefreshInterval`: 60000 (1 minute)
- `alertCheckInterval`: 15000-30000 (15-30 seconds)

**Use for:** Emergency response, severe weather, critical operations

### Medium-Frequency Updates (Active Events)
- `refreshInterval`: 180000-300000 (3-5 minutes)
- `radarRefreshInterval`: 120000 (2 minutes)
- `alertCheckInterval`: 30000-60000 (30-60 seconds)

**Use for:** Sports events, concerts, festivals, races

### Low-Frequency Updates (Long Events)
- `refreshInterval`: 300000-600000 (5-10 minutes)
- `radarRefreshInterval`: 300000 (5 minutes)
- `alertCheckInterval`: 60000-120000 (1-2 minutes)

**Use for:** Construction sites, long-term monitoring, multi-day events

## US Timezone Reference

```javascript
"America/New_York"      // Eastern Time (ET)
"America/Chicago"       // Central Time (CT)
"America/Denver"        // Mountain Time (MT)
"America/Phoenix"       // Arizona (no DST)
"America/Los_Angeles"   // Pacific Time (PT)
"America/Anchorage"     // Alaska Time
"Pacific/Honolulu"      // Hawaii Time
```

## Major US City Coordinates

```javascript
// Northeast
"New York, NY": { lat: 40.7128, lon: -74.0060 }
"Boston, MA": { lat: 42.3601, lon: -71.0589 }
"Philadelphia, PA": { lat: 39.9526, lon: -75.1652 }

// Southeast
"Miami, FL": { lat: 25.7617, lon: -80.1918 }
"Atlanta, GA": { lat: 33.7490, lon: -84.3880 }
"Charlotte, NC": { lat: 35.2271, lon: -80.8431 }

// Midwest
"Chicago, IL": { lat: 41.8781, lon: -87.6298 }
"Detroit, MI": { lat: 42.3314, lon: -83.0458 }
"Minneapolis, MN": { lat: 44.9778, lon: -93.2650 }

// Southwest
"Dallas, TX": { lat: 32.7767, lon: -96.7970 }
"Houston, TX": { lat: 29.7604, lon: -95.3698 }
"Phoenix, AZ": { lat: 33.4484, lon: -112.0740 }

// West
"Los Angeles, CA": { lat: 34.0522, lon: -118.2437 }
"San Francisco, CA": { lat: 37.7749, lon: -122.4194 }
"Seattle, WA": { lat: 47.6062, lon: -122.3321 }
"Denver, CO": { lat: 39.7392, lon: -104.9903 }
```

## Data Retention Guidelines

### Short Events (< 1 day)
```json
"dataRetention": {
  "cacheDurationHours": 24,
  "maxRadarImages": 20,
  "maxSatelliteImages": 10
}
```

### Multi-Day Events (2-7 days)
```json
"dataRetention": {
  "cacheDurationHours": 72,
  "maxRadarImages": 50,
  "maxSatelliteImages": 30
}
```

### Long-Term Monitoring (weeks/months)
```json
"dataRetention": {
  "cacheDurationHours": 168,
  "maxRadarImages": 100,
  "maxSatelliteImages": 50
}
```

## Performance Considerations

### Low Resource Systems
- Increase refresh intervals
- Reduce data retention
- Disable satellite updates if not needed

### High Resource Systems
- Decrease refresh intervals for more real-time data
- Increase data retention for historical review
- Enable all data sources

### Network Bandwidth Limited
- Use longer refresh intervals
- Reduce image retention
- Consider caching strategies
