# NOAA MRMS Radar Integration

## Overview

The dashboard now uses **NOAA MRMS (Multi-Radar Multi-Sensor)** data from AWS S3 instead of individual RIDGE radar stations. This provides:

- **Higher Resolution**: Seamless mosaic of all US radars
- **Better Coverage**: Complete CONUS coverage
- **Frequent Updates**: New data every 2 minutes
- **Quality Control**: Automated QC on reflectivity data
- **No Authentication**: Public S3 bucket (no AWS credentials needed)

## Data Source

**AWS S3 Bucket:** `noaa-mrms-pds` (Public Data Set)

**Product:** MergedReflectivityQCComposite_00.50
- Merged reflectivity at 0.50° elevation angle
- Quality-controlled composite from all CONUS radars
- 1km x 1km resolution
- GRIB2 format (compressed with gzip)

**Update Frequency:** Every 2 minutes

**URL Pattern:**
```
https://noaa-mrms-pds.s3.amazonaws.com/CONUS/MergedReflectivityAtLowestAltitude_00.50/{YYYYMMDD}/MergedReflectivityQCComposite_00.50_{YYYYMMDD}-{HHMMSS}.grib2.gz
```

## How It Works

### 1. Automatic Data Fetching

The `radar.service.js` automatically:
- Calculates the current UTC time
- Rounds to the nearest 2-minute interval
- Constructs the MRMS S3 URL
- Downloads the GRIB2 file
- Saves to local cache

### 2. Fallback Mechanism

If the latest file isn't available yet:
- Tries the previous 2-minute interval
- Ensures radar data is always available

### 3. File Format

Downloaded files are **GRIB2** (Gridded Binary Edition 2):
- Industry-standard meteorological data format
- Compressed with gzip to reduce size
- Contains georeferenced radar reflectivity values

## Processing GRIB2 Data

### Option 1: Using AWS CLI (Browse)

List available files:
```bash
# Install AWS CLI (if not already installed)
brew install awscli  # macOS
# or
apt-get install awscli  # Linux

# List files (no credentials needed)
aws s3 ls --no-sign-request s3://noaa-mrms-pds/CONUS/MergedReflectivityAtLowestAltitude_00.50/

# List today's files
aws s3 ls --no-sign-request s3://noaa-mrms-pds/CONUS/MergedReflectivityAtLowestAltitude_00.50/$(date +%Y%m%d)/
```

### Option 2: Convert to Image (wgrib2)

Install wgrib2:
```bash
# macOS
brew install wgrib2

# Linux
sudo apt-get install wgrib2
```

Convert GRIB2 to PNG:
```bash
# Decompress
gunzip radar_*.grib2.gz

# Convert to PNG
wgrib2 radar_*.grib2 -set_grib_type simple -new_grid_winds earth \
  -new_grid latlon 235:3500:0.01 20:1600:0.01 radar.png -rpn sto_1
```

### Option 3: Python Processing

```python
import pygrib
import matplotlib.pyplot as plt
import gzip

# Read GRIB2 file
with gzip.open('radar_file.grib2.gz', 'rb') as f:
    grbs = pygrib.open(f)
    grb = grbs[1]  # First message
    
    # Get data
    data = grb.values
    lats, lons = grb.latlons()
    
    # Plot
    plt.imshow(data, cmap='gist_ncar', vmin=0, vmax=70)
    plt.colorbar(label='Reflectivity (dBZ)')
    plt.savefig('radar.png')
```

### Option 4: Node.js Processing

Install dependencies:
```bash
npm install grib2json
# or
npm install node-grib2
```

Process in Node.js:
```javascript
const { execSync } = require('child_process');
const fs = require('fs');

// Convert GRIB2 to JSON
execSync(`wgrib2 -json radar.grib2 > radar.json`);

// Read and process
const data = JSON.parse(fs.readFileSync('radar.json'));
console.log(data);
```

## Frontend Integration

### Current Status

The backend is now downloading MRMS GRIB2 files. To display them in the frontend:

**Option A: Use Pre-rendered Images**
- Convert GRIB2 to PNG on the backend
- Serve PNG files to frontend
- Simplest for immediate use

**Option B: Process Client-Side**
- Send GRIB2 data to frontend
- Use JavaScript GRIB libraries
- More complex but flexible

**Option C: Use Existing Imagery Services**
- NOAA provides pre-rendered images
- Use WMS (Web Map Service) layers
- Quick implementation

### Recommended: Use NOAA WMS

For immediate display without GRIB processing:

```javascript
// In frontend/js/app.js
async loadRadar() {
  // Iowa State MRMS Viewer
  const wmsUrl = 'https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0q.cgi?';
  const params = new URLSearchParams({
    service: 'WMS',
    version: '1.1.1',
    request: 'GetMap',
    layers: 'nexrad-n0q-900913',
    format: 'image/png',
    transparent: true,
    bbox: '-126,24,-66,50',
    width: 800,
    height: 600,
    srs: 'EPSG:4326'
  });
  
  const img = document.getElementById('radar-image');
  img.src = wmsUrl + params.toString() + '&t=' + Date.now();
}
```

## API Endpoints

### Get Latest MRMS Radar
```
GET /api/radar/latest
```

Response:
```json
{
  "timestamp": "2026-02-06T20:52:00.000Z",
  "source": "NOAA MRMS",
  "product": "MergedReflectivityAtLowestAltitude",
  "imageUrl": "/api/radar/image/2026-02-06T20:52:00.000Z",
  "localPath": "/path/to/data/radar/radar_*.grib2.gz",
  "mrmsTime": "20260206-205200"
}
```

### Get Available MRMS Files
```
GET /api/radar/mrms/available
```

Response:
```json
[
  {
    "date": "20260206",
    "time": "205200",
    "url": "https://noaa-mrms-pds.s3.amazonaws.com/..."
  },
  ...
]
```

## Data Specifications

### MRMS Products Available

The S3 bucket contains many products:

1. **MergedReflectivityQCComposite** (Currently Used)
   - Best overall radar composite
   - Quality controlled
   - 0.50° elevation angle

2. **MergedReflectivityAtLowestAltitude**
   - Closest to ground level
   - Good for precipitation detection

3. **SeamlessHSR**
   - Hybrid Scan Reflectivity
   - Multiple elevation angles

4. **PrecipRate**
   - Estimated precipitation rate
   - Derived from radar

### File Naming Convention

```
MergedReflectivityQCComposite_00.50_YYYYMMDD-HHMMSS.grib2.gz
```

Example:
```
MergedReflectivityQCComposite_00.50_20260206-205200.grib2.gz
```

- YYYYMMDD: Date (UTC)
- HHMMSS: Time (UTC)
- Always 2-minute intervals (00, 02, 04... 58 seconds)

## Configuration

No configuration changes needed! The service automatically:
- Detects current UTC time
- Fetches appropriate MRMS file
- Handles timezone conversion
- Manages file cleanup

### Adjust Update Frequency

In `backend/services/radar.service.js`:

```javascript
startPeriodicUpdates() {
  // Update every 2 minutes (matches MRMS update frequency)
  this.updateTask = cron.schedule('*/2 * * * *', async () => {
    console.log('🔄 Updating radar data...');
    await this.getLatestRadar();
    await this.cleanupOldRadar();
  });
}
```

## Troubleshooting

### Issue: Files Not Downloading

**Check S3 Accessibility:**
```bash
curl -I "https://noaa-mrms-pds.s3.amazonaws.com/CONUS/MergedReflectivityAtLowestAltitude_00.50/$(date +%Y%m%d)/"
```

**Check Recent File:**
```bash
# Get current UTC time and round to 2-min interval
aws s3 ls --no-sign-request s3://noaa-mrms-pds/CONUS/MergedReflectivityAtLowestAltitude_00.50/$(date -u +%Y%m%d)/ | tail -20
```

### Issue: Timing Mismatches

MRMS uses **UTC time**. Ensure your server time is accurate:
```bash
# Check system time
date -u

# Sync if needed (Linux)
sudo ntpdate -s time.nist.gov
```

### Issue: Old Files Not Cleaning Up

Check data retention settings in `config/event.config.json`:
```json
{
  "dataRetention": {
    "maxRadarImages": 20
  }
}
```

## Performance Considerations

### File Sizes

- Compressed GRIB2: ~2-5 MB per file
- Uncompressed: ~15-30 MB per file
- Storage: ~100 MB for 20 files (default retention)

### Network Bandwidth

- Download every 2 minutes
- ~2-5 MB per download
- ~150 MB per hour

### Disk Space

Monitor disk usage:
```bash
du -sh data/radar/
```

Clean old files manually:
```bash
find data/radar/ -name "radar_*.grib2.gz" -mtime +1 -delete
```

## Next Steps

### Phase 1: Current (GRIB2 Download) ✅
- Download MRMS GRIB2 files
- Cache locally
- Automatic updates

### Phase 2: Image Conversion (Recommended Next)
- Install wgrib2 or Python tools
- Convert GRIB2 to PNG on backend
- Serve images to frontend
- Display in dashboard

### Phase 3: Advanced Features (Future)
- Real-time GRIB2 parsing
- Custom color scales
- Overlay on maps
- Storm tracking
- Precipitation estimation

## Resources

- [MRMS Documentation](https://www.nssl.noaa.gov/projects/mrms/)
- [AWS Public Dataset](https://registry.opendata.aws/noaa-mrms/)
- [GRIB2 Specification](https://www.nco.ncep.noaa.gov/pmb/docs/grib2/)
- [wgrib2 Manual](https://www.cpc.ncep.noaa.gov/products/wesley/wgrib2/)
