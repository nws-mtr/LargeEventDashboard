const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const cron = require('node-cron');

const CONFIG_PATH = path.join(__dirname, '../../config/event.config.json');
const GRIB_CACHE_PATH = path.join(__dirname, '../../data/grib');

class GribService {
  constructor() {
    this.config = null;
    this.updateTask = null;
    this.model = process.env.GRIB_MODEL || 'HRRR'; // HRRR, NAM, GFS, etc.
  }

  async loadConfig() {
    const configData = await fs.readFile(CONFIG_PATH, 'utf8');
    this.config = JSON.parse(configData);
    return this.config;
  }

  async getLatestGribData() {
    if (!this.config) await this.loadConfig();
    
    const { latitude, longitude } = this.config.event;
    
    try {
      // NOAA NOMADS server for GRIB2 data
      // This is a placeholder - actual GRIB2 processing requires libraries like grib2json or wgrib2
      // For now, we'll structure the API to support future GRIB implementation
      
      const data = {
        timestamp: new Date().toISOString(),
        model: this.model,
        location: { latitude, longitude },
        status: 'GRIB processing not yet implemented',
        note: 'Will require grib2json or similar library for full implementation'
      };
      
      return data;
    } catch (error) {
      console.error('Error fetching GRIB data:', error.message);
      return { error: 'Unable to fetch GRIB data' };
    }
  }

  async getGribParameter(param) {
    // Parameters: temperature, precipitation, wind, etc.
    // This will be implemented with actual GRIB processing
    return {
      parameter: param,
      status: 'Not yet implemented',
      message: 'GRIB parameter extraction will be added with grib2json library'
    };
  }

  async getGribForecastHour(hour) {
    // Get forecast for specific hour (0-48 for HRRR, 0-84 for NAM, etc.)
    return {
      forecastHour: hour,
      status: 'Not yet implemented',
      message: 'GRIB forecast extraction will be added with grib2json library'
    };
  }

  async downloadGribFile(model, runtime, forecastHour) {
    // Download GRIB2 file from NOMADS
    // URL structure varies by model
    const nomadsUrls = {
      HRRR: `https://nomads.ncep.noaa.gov/pub/data/nccf/com/hrrr/prod/`,
      NAM: `https://nomads.ncep.noaa.gov/pub/data/nccf/com/nam/prod/`,
      GFS: `https://nomads.ncep.noaa.gov/pub/data/nccf/com/gfs/prod/`
    };
    
    // Placeholder for actual download logic
    console.log(`Would download ${model} GRIB for ${runtime}F${forecastHour}`);
    return { status: 'Download placeholder' };
  }

  startPeriodicUpdates() {
    // Update every hour (GRIB data updates vary by model)
    this.updateTask = cron.schedule('0 * * * *', async () => {
      console.log('🔄 Checking for new GRIB data...');
      // await this.getLatestGribData();
    });
  }

  stopPeriodicUpdates() {
    if (this.updateTask) {
      this.updateTask.stop();
    }
  }
}

module.exports = new GribService();
