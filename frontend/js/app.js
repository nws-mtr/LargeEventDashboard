// Dashboard Application
class WeatherDashboard {
  constructor() {
    this.config = null;
    this.radarInterval = null;
    this.updateInterval = null;
    this.init();
  }

  async init() {
    await this.loadConfig();
    this.setupClock();
    this.setupEventListeners();
    await this.loadAllData();
    this.startAutoRefresh();
  }

  async loadConfig() {
    try {
      const response = await fetch('/api/config');
      this.config = await response.json();
      this.updateEventInfo();
    } catch (error) {
      console.error('Error loading config:', error);
    }
  }

  updateEventInfo() {
    if (!this.config) return;

    document.getElementById('event-name').textContent = this.config.event.name;
    document.getElementById('event-location').textContent = this.config.event.location;
    
    const startDate = new Date(this.config.event.startDate);
    document.getElementById('event-date').textContent = startDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    document.getElementById('timezone').textContent = this.config.event.timezone;
  }

  setupClock() {
    const updateClock = () => {
      const now = new Date();
      const timeString = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      document.getElementById('clock').textContent = timeString;
    };
    
    updateClock();
    setInterval(updateClock, 1000);
  }

  setupEventListeners() {
    // Satellite product selector
    document.getElementById('satellite-product').addEventListener('change', (e) => {
      this.loadSatellite(e.target.value);
    });

    // Radar play button (future implementation)
    document.getElementById('radar-play').addEventListener('click', () => {
      this.toggleRadarAnimation();
    });
  }

  async loadAllData() {
    await Promise.all([
      this.loadCurrentWeather(),
      this.loadHourlyForecast(),
      this.loadWeatherAlerts(),
      this.loadRadar(),
      this.loadSatellite()
    ]);
    
    this.updateLastUpdateTime();
  }

  async loadCurrentWeather() {
    try {
      const response = await fetch('/api/weather/current');
      const data = await response.json();
      
      if (data.error) {
        console.error('Weather error:', data.error);
        return;
      }

      const obs = data.observation;
      
      // Temperature
      const tempC = obs.temperature?.value;
      const tempF = tempC ? (tempC * 9/5 + 32).toFixed(1) : '--';
      document.getElementById('current-temp').textContent = tempF;
      
      // Feels like
      const heatIndexC = obs.heatIndex?.value;
      const windChillC = obs.windChill?.value;
      const feelsLikeC = heatIndexC || windChillC || tempC;
      const feelsLikeF = feelsLikeC ? (feelsLikeC * 9/5 + 32).toFixed(1) + '°F' : '--';
      document.getElementById('feels-like').textContent = feelsLikeF;
      
      // Humidity
      const humidity = obs.relativeHumidity?.value;
      document.getElementById('humidity').textContent = humidity ? humidity.toFixed(0) + '%' : '--';
      
      // Wind
      const windSpeed = obs.windSpeed?.value;
      const windDir = obs.windDirection?.value;
      const windSpeedMph = windSpeed ? (windSpeed * 2.237).toFixed(1) : '--';
      const windText = windSpeed ? `${this.degToCompass(windDir)} ${windSpeedMph} mph` : '--';
      document.getElementById('wind').textContent = windText;
      
      // Pressure
      const pressure = obs.barometricPressure?.value;
      const pressureInHg = pressure ? (pressure / 3386.39).toFixed(2) + ' inHg' : '--';
      document.getElementById('pressure').textContent = pressureInHg;
      
      // Visibility
      const visibility = obs.visibility?.value;
      const visibilityMiles = visibility ? (visibility / 1609.34).toFixed(1) + ' mi' : '--';
      document.getElementById('visibility').textContent = visibilityMiles;
      
      // Dewpoint
      const dewpointC = obs.dewpoint?.value;
      const dewpointF = dewpointC ? (dewpointC * 9/5 + 32).toFixed(1) + '°F' : '--';
      document.getElementById('dewpoint').textContent = dewpointF;
      
    } catch (error) {
      console.error('Error loading current weather:', error);
    }
  }

  async loadHourlyForecast() {
    try {
      const response = await fetch('/api/weather/forecast/hourly');
      const data = await response.json();
      
      if (data.error) {
        console.error('Forecast error:', data.error);
        return;
      }

      const container = document.getElementById('hourly-container');
      container.innerHTML = '';
      
      // Show next 12 hours
      const periods = data.forecast.slice(0, 12);
      
      periods.forEach(period => {
        const item = document.createElement('div');
        item.className = 'hourly-item';
        
        const time = new Date(period.startTime).toLocaleTimeString('en-US', {
          hour: 'numeric',
          hour12: true
        });
        
        item.innerHTML = `
          <div class="hour-time">${time}</div>
          <div class="hour-temp">${period.temperature}°${period.temperatureUnit}</div>
          <div class="hour-condition">${period.shortForecast}</div>
          <div class="hour-precip">${period.probabilityOfPrecipitation?.value || 0}% precip</div>
        `;
        
        container.appendChild(item);
      });
      
      // Update summary
      if (data.forecast.length > 0) {
        const summary = document.getElementById('forecast-summary');
        summary.innerHTML = data.forecast.slice(0, 6).map(period => `
          <div class="summary-item">
            <strong>${new Date(period.startTime).toLocaleTimeString('en-US', { hour: 'numeric' })}</strong>: 
            ${period.detailedForecast}
          </div>
        `).join('');
      }
      
    } catch (error) {
      console.error('Error loading forecast:', error);
    }
  }

  async loadWeatherAlerts() {
    try {
      const response = await fetch('/api/weather/alerts');
      const data = await response.json();
      
      const container = document.getElementById('alerts-container');
      
      if (data.alerts && data.alerts.length > 0) {
        container.innerHTML = data.alerts.map(alert => {
          const props = alert.properties;
          const severity = props.severity?.toLowerCase() || '';
          const isSevere = ['extreme', 'severe'].includes(severity);
          
          return `
            <div class="alert-item ${isSevere ? 'severe' : ''}">
              <div class="alert-title">${props.event}</div>
              <div class="alert-description">${props.headline}</div>
              <div class="alert-time" style="font-size: 0.8rem; margin-top: 0.5rem; color: var(--text-secondary)">
                ${new Date(props.effective).toLocaleString()}
              </div>
            </div>
          `;
        }).join('');
      } else {
        container.innerHTML = '<p class="no-alerts">No active alerts</p>';
      }
      
    } catch (error) {
      console.error('Error loading alerts:', error);
    }
  }

  async loadRadar() {
    try {
      const response = await fetch('/api/radar/latest');
      const data = await response.json();
      
      if (data.error) {
        console.error('Radar error:', data.error);
        return;
      }

      const img = document.getElementById('radar-image');
      const timestamp = document.getElementById('radar-timestamp');
      
      // For now, use NOAA radar composite
      // In production, use the locally cached radar image
      img.src = 'https://radar.weather.gov/ridge/standard/CONUS_loop.gif';
      img.onload = () => {
        img.classList.add('loaded');
        img.previousElementSibling.style.display = 'none';
      };
      
      if (data.timestamp) {
        timestamp.textContent = new Date(data.timestamp).toLocaleTimeString();
      }
      
    } catch (error) {
      console.error('Error loading radar:', error);
    }
  }

  async loadSatellite(product = 'geocolor') {
    try {
      const response = await fetch(`/api/satellite/product/${product}`);
      const data = await response.json();
      
      if (data.error) {
        console.error('Satellite error:', data.error);
        return;
      }

      const img = document.getElementById('satellite-image');
      const timestamp = document.getElementById('satellite-timestamp');
      
      // Use NOAA GOES imagery
      const productUrls = {
        geocolor: 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/CONUS/GEOCOLOR/latest.jpg',
        visible: 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/CONUS/02/latest.jpg',
        infrared: 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/CONUS/13/latest.jpg',
        watervapor: 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/CONUS/09/latest.jpg'
      };
      
      img.src = productUrls[product] + '?t=' + Date.now();
      img.onload = () => {
        img.classList.add('loaded');
        img.previousElementSibling.style.display = 'none';
      };
      
      timestamp.textContent = new Date().toLocaleTimeString();
      
    } catch (error) {
      console.error('Error loading satellite:', error);
    }
  }

  toggleRadarAnimation() {
    // Future implementation: cycle through radar loop images
    console.log('Radar animation toggle');
  }

  updateLastUpdateTime() {
    const now = new Date().toLocaleTimeString('en-US');
    document.getElementById('last-update').textContent = now;
  }

  startAutoRefresh() {
    // Refresh all data every 5 minutes
    this.updateInterval = setInterval(() => {
      this.loadAllData();
    }, 5 * 60 * 1000);
    
    // Refresh radar more frequently
    setInterval(() => {
      this.loadRadar();
    }, 2 * 60 * 1000);
    
    // Refresh satellite
    setInterval(() => {
      const product = document.getElementById('satellite-product').value;
      this.loadSatellite(product);
    }, 5 * 60 * 1000);
  }

  degToCompass(deg) {
    if (deg == null) return 'N';
    const val = Math.floor((deg / 22.5) + 0.5);
    const arr = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return arr[(val % 16)];
  }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new WeatherDashboard();
});
