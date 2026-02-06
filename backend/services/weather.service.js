const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const cron = require('node-cron');

const CONFIG_PATH = path.join(__dirname, '../../config/event.config.json');
const CACHE_PATH = path.join(__dirname, '../../data/cache/weather.json');

class WeatherService {
  constructor() {
    this.config = null;
    this.cache = null;
    this.updateTask = null;
  }

  async loadConfig() {
    const configData = await fs.readFile(CONFIG_PATH, 'utf8');
    this.config = JSON.parse(configData);
    return this.config;
  }

  async getCurrentWeather() {
    if (!this.config) await this.loadConfig();
    
    const { latitude, longitude } = this.config.event;
    
    try {
      // NOAA API: Get grid point
      const pointsUrl = `https://api.weather.gov/points/${latitude},${longitude}`;
      const pointsResponse = await axios.get(pointsUrl, {
        headers: { 'User-Agent': 'LargeEventDashboard/1.0' }
      });
      
      const { observationStations } = pointsResponse.data.properties;
      
      // Get latest observation
      const stationsResponse = await axios.get(observationStations, {
        headers: { 'User-Agent': 'LargeEventDashboard/1.0' }
      });
      
      const stationId = stationsResponse.data.features[0].id;
      const obsResponse = await axios.get(`${stationId}/observations/latest`, {
        headers: { 'User-Agent': 'LargeEventDashboard/1.0' }
      });
      
      const data = {
        timestamp: new Date().toISOString(),
        observation: obsResponse.data.properties,
        location: this.config.event
      };
      
      // Cache the data
      await this.cacheData(data);
      
      return data;
    } catch (error) {
      console.error('Error fetching current weather:', error.message);
      // Return cached data if available
      return this.getCachedData() || { error: 'Unable to fetch weather data' };
    }
  }

  async getHourlyForecast() {
    if (!this.config) await this.loadConfig();
    
    const { latitude, longitude } = this.config.event;
    
    try {
      const pointsUrl = `https://api.weather.gov/points/${latitude},${longitude}`;
      const pointsResponse = await axios.get(pointsUrl, {
        headers: { 'User-Agent': 'LargeEventDashboard/1.0' }
      });
      
      const { forecastHourly } = pointsResponse.data.properties;
      const forecastResponse = await axios.get(forecastHourly, {
        headers: { 'User-Agent': 'LargeEventDashboard/1.0' }
      });
      
      return {
        timestamp: new Date().toISOString(),
        forecast: forecastResponse.data.properties.periods,
        location: this.config.event
      };
    } catch (error) {
      console.error('Error fetching forecast:', error.message);
      return { error: 'Unable to fetch forecast data' };
    }
  }

  async getWeatherAlerts() {
    if (!this.config) await this.loadConfig();
    
    const { latitude, longitude } = this.config.event;
    
    try {
      const alertsUrl = `https://api.weather.gov/alerts/active?point=${latitude},${longitude}`;
      const response = await axios.get(alertsUrl, {
        headers: { 'User-Agent': 'LargeEventDashboard/1.0' }
      });
      
      return {
        timestamp: new Date().toISOString(),
        alerts: response.data.features,
        count: response.data.features.length
      };
    } catch (error) {
      console.error('Error fetching alerts:', error.message);
      return { error: 'Unable to fetch alert data', alerts: [], count: 0 };
    }
  }

  async getObservations() {
    // This will return recent observations for the area
    return this.getCurrentWeather();
  }

  async cacheData(data) {
    try {
      await fs.writeFile(CACHE_PATH, JSON.stringify(data, null, 2));
      this.cache = data;
    } catch (error) {
      console.error('Error caching data:', error.message);
    }
  }

  async getCachedData() {
    if (this.cache) return this.cache;
    
    try {
      const data = await fs.readFile(CACHE_PATH, 'utf8');
      this.cache = JSON.parse(data);
      return this.cache;
    } catch (error) {
      return null;
    }
  }

  startPeriodicUpdates() {
    // Update every 5 minutes
    this.updateTask = cron.schedule('*/5 * * * *', async () => {
      console.log('🔄 Updating weather data...');
      await this.getCurrentWeather();
    });
    
    // Initial update
    this.getCurrentWeather();
  }

  stopPeriodicUpdates() {
    if (this.updateTask) {
      this.updateTask.stop();
    }
  }
}

module.exports = new WeatherService();
