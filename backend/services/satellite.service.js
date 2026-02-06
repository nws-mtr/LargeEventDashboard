const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const cron = require('node-cron');

const CONFIG_PATH = path.join(__dirname, '../../config/event.config.json');
const SATELLITE_CACHE_PATH = path.join(__dirname, '../../data/satellite');

class SatelliteService {
  constructor() {
    this.config = null;
    this.updateTask = null;
  }

  async loadConfig() {
    const configData = await fs.readFile(CONFIG_PATH, 'utf8');
    this.config = JSON.parse(configData);
    return this.config;
  }

  async getLatestSatellite() {
    if (!this.config) await this.loadConfig();
    
    try {
      // GOES-East (GOES-16) example - visible imagery
      // These URLs are placeholders - actual NOAA GOES imagery requires more complex processing
      const satelliteUrl = 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/CONUS/GEOCOLOR/latest.jpg';
      
      const response = await axios.get(satelliteUrl, {
        responseType: 'arraybuffer'
      });
      
      const timestamp = new Date().toISOString();
      const filename = `satellite_${timestamp.replace(/:/g, '-')}.jpg`;
      const filepath = path.join(SATELLITE_CACHE_PATH, filename);
      
      await fs.writeFile(filepath, response.data);
      
      return {
        timestamp,
        product: 'GEOCOLOR',
        satellite: 'GOES-16',
        imageUrl: `/api/satellite/image/${timestamp}`,
        localPath: filepath
      };
    } catch (error) {
      console.error('Error fetching satellite:', error.message);
      return { error: 'Unable to fetch satellite data' };
    }
  }

  async getSatelliteLoop() {
    try {
      const files = await fs.readdir(SATELLITE_CACHE_PATH);
      const satelliteFiles = files
        .filter(f => f.startsWith('satellite_'))
        .sort()
        .reverse()
        .slice(0, 10);
      
      return satelliteFiles.map(f => ({
        filename: f,
        url: `/data/satellite/${f}`
      }));
    } catch (error) {
      console.error('Error getting satellite loop:', error.message);
      return [];
    }
  }

  async getSatelliteProduct(type) {
    // Different satellite products: visible, infrared, water vapor, etc.
    const productUrls = {
      geocolor: 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/CONUS/GEOCOLOR/latest.jpg',
      visible: 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/CONUS/02/latest.jpg',
      infrared: 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/CONUS/13/latest.jpg',
      watervapor: 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/CONUS/09/latest.jpg'
    };
    
    const url = productUrls[type.toLowerCase()] || productUrls.geocolor;
    
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer'
      });
      
      return {
        timestamp: new Date().toISOString(),
        product: type,
        data: response.data.toString('base64'),
        contentType: 'image/jpeg'
      };
    } catch (error) {
      console.error(`Error fetching ${type} satellite:`, error.message);
      return { error: 'Unable to fetch satellite product' };
    }
  }

  async cleanupOldSatellite() {
    try {
      const files = await fs.readdir(SATELLITE_CACHE_PATH);
      const maxFiles = this.config?.dataRetention?.maxSatelliteImages || 10;
      
      const satelliteFiles = files
        .filter(f => f.startsWith('satellite_'))
        .sort()
        .reverse();
      
      for (let i = maxFiles; i < satelliteFiles.length; i++) {
        await fs.unlink(path.join(SATELLITE_CACHE_PATH, satelliteFiles[i]));
      }
    } catch (error) {
      console.error('Error cleaning up satellite:', error.message);
    }
  }

  startPeriodicUpdates() {
    // Update every 5 minutes
    this.updateTask = cron.schedule('*/5 * * * *', async () => {
      console.log('🔄 Updating satellite data...');
      await this.getLatestSatellite();
      await this.cleanupOldSatellite();
    });
    
    // Initial update
    this.getLatestSatellite();
  }

  stopPeriodicUpdates() {
    if (this.updateTask) {
      this.updateTask.stop();
    }
  }
}

module.exports = new SatelliteService();
