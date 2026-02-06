const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const cron = require('node-cron');

const CONFIG_PATH = path.join(__dirname, '../../config/event.config.json');
const RADAR_CACHE_PATH = path.join(__dirname, '../../data/radar');

class RadarService {
  constructor() {
    this.config = null;
    this.updateTask = null;
    this.radarStation = null;
  }

  async loadConfig() {
    const configData = await fs.readFile(CONFIG_PATH, 'utf8');
    this.config = JSON.parse(configData);
    return this.config;
  }

  async findNearestRadarStation() {
    if (!this.config) await this.loadConfig();
    
    // For now, we'll use a static mapping. In production, calculate nearest station
    // based on lat/lon. Common stations: KOKX (NYC), KDOX (Philadelphia), etc.
    // This is a placeholder - implement proper station lookup
    this.radarStation = 'KMUX'; // Example for NYC area
    
    return this.radarStation;
  }

  async getLatestRadar() {
    try {
      // NOAA MRMS (Multi-Radar Multi-Sensor) from AWS S3
      // High resolution radar mosaic data
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
      
      // MRMS updates every 2 minutes, get latest available
      // Round down to nearest 2-minute interval
      const minutes = Math.floor(now.getUTCMinutes() / 2) * 2;
      const timeStr = `${now.getUTCHours().toString().padStart(2, '0')}${minutes.toString().padStart(2, '0')}00`;
      
      // MRMS MergedReflectivityAtLowestAltitude product
      const mrmsUrl = `https://noaa-mrms-pds.s3.amazonaws.com/CONUS/MergedReflectivityAtLowestAltitude_00.50/${dateStr}/MergedReflectivityQCComposite_00.50_${dateStr}-${timeStr}.grib2.gz`;
      
      console.log(`Fetching MRMS radar: ${mrmsUrl}`);
      
      const response = await axios.get(mrmsUrl, {
        responseType: 'arraybuffer',
        timeout: 30000
      });
      
      const timestamp = new Date().toISOString();
      const filename = `radar_${timestamp.replace(/:/g, '-')}.grib2.gz`;
      const filepath = path.join(RADAR_CACHE_PATH, filename);
      
      await fs.writeFile(filepath, response.data);
      
      return {
        timestamp,
        source: 'NOAA MRMS',
        product: 'MergedReflectivityAtLowestAltitude',
        imageUrl: `/api/radar/image/${timestamp}`,
        localPath: filepath,
        mrmsTime: `${dateStr}-${timeStr}`
      };
    } catch (error) {
      console.error('Error fetching MRMS radar:', error.message);
      
      // Fallback: Try previous 2-minute interval
      try {
        const now = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const minutes = Math.floor(now.getUTCMinutes() / 2) * 2;
        const timeStr = `${now.getUTCHours().toString().padStart(2, '0')}${minutes.toString().padStart(2, '0')}00`;
        
        const mrmsUrl = `https://noaa-mrms-pds.s3.amazonaws.com/CONUS/MergedReflectivityAtLowestAltitude_00.50/${dateStr}/MergedReflectivityQCComposite_00.50_${dateStr}-${timeStr}.grib2.gz`;
        
        console.log(`Trying fallback MRMS radar: ${mrmsUrl}`);
        
        const response = await axios.get(mrmsUrl, {
          responseType: 'arraybuffer',
          timeout: 30000
        });
        
        const timestamp = new Date().toISOString();
        const filename = `radar_${timestamp.replace(/:/g, '-')}.grib2.gz`;
        const filepath = path.join(RADAR_CACHE_PATH, filename);
        
        await fs.writeFile(filepath, response.data);
        
        return {
          timestamp,
          source: 'NOAA MRMS (fallback)',
          product: 'MergedReflectivityAtLowestAltitude',
          imageUrl: `/api/radar/image/${timestamp}`,
          localPath: filepath,
          mrmsTime: `${dateStr}-${timeStr}`
        };
      } catch (fallbackError) {
        console.error('Fallback MRMS fetch failed:', fallbackError.message);
        return { error: 'Unable to fetch MRMS radar data' };
      }
    }
  }

  async getRadarLoop() {
    // Return list of recent radar images for animation
    try {
      const files = await fs.readdir(RADAR_CACHE_PATH);
      const radarFiles = files
        .filter(f => f.startsWith('radar_') && f.endsWith('.grib2.gz'))
        .sort()
        .reverse()
        .slice(0, 10); // Last 10 frames
      
      return radarFiles.map(f => ({
        filename: f,
        url: `/data/radar/${f}`
      }));
    } catch (error) {
      console.error('Error getting radar loop:', error.message);
      return [];
    }
  }

  async getRadarByTimestamp(timestamp) {
    const filename = `radar_${timestamp.replace(/:/g, '-')}.grib2.gz`;
    const filepath = path.join(RADAR_CACHE_PATH, filename);
    
    try {
      const data = await fs.readFile(filepath);
      return {
        timestamp,
        data: data.toString('base64'),
        contentType: 'application/gzip'
      };
    } catch (error) {
      return { error: 'Radar image not found' };
    }
  }

  async listAvailableMRMSFiles(date = new Date()) {
    // List available MRMS files for a given date
    // This helps find the most recent available data
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    
    try {
      // Since S3 bucket is public, we can construct URLs for recent times
      const files = [];
      const now = new Date();
      
      // Check last 30 minutes worth of 2-minute intervals
      for (let i = 0; i < 15; i++) {
        const checkTime = new Date(now.getTime() - (i * 2 * 60 * 1000));
        const minutes = Math.floor(checkTime.getUTCMinutes() / 2) * 2;
        const timeStr = `${checkTime.getUTCHours().toString().padStart(2, '0')}${minutes.toString().padStart(2, '0')}00`;
        const checkDateStr = checkTime.toISOString().slice(0, 10).replace(/-/g, '');
        
        files.push({
          date: checkDateStr,
          time: timeStr,
          url: `https://noaa-mrms-pds.s3.amazonaws.com/CONUS/MergedReflectivityAtLowestAltitude_00.50/${checkDateStr}/MergedReflectivityQCComposite_00.50_${checkDateStr}-${timeStr}.grib2.gz`
        });
      }
      
      return files;
    } catch (error) {
      console.error('Error listing MRMS files:', error.message);
      return [];
    }
  }

  async cleanupOldRadar() {
    try {
      const files = await fs.readdir(RADAR_CACHE_PATH);
      const maxFiles = this.config?.dataRetention?.maxRadarImages || 20;
      
      const radarFiles = files
        .filter(f => f.startsWith('radar_'))
        .sort()
        .reverse();
      
      // Delete old files
      for (let i = maxFiles; i < radarFiles.length; i++) {
        await fs.unlink(path.join(RADAR_CACHE_PATH, radarFiles[i]));
      }
    } catch (error) {
      console.error('Error cleaning up radar:', error.message);
    }
  }

  startPeriodicUpdates() {
    // Update every 2 minutes
    this.updateTask = cron.schedule('*/2 * * * *', async () => {
      console.log('🔄 Updating radar data...');
      await this.getLatestRadar();
      await this.cleanupOldRadar();
    });
    
    // Initial update
    this.getLatestRadar();
  }

  stopPeriodicUpdates() {
    if (this.updateTask) {
      this.updateTask.stop();
    }
  }
}

module.exports = new RadarService();
