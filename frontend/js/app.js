// Dashboard Application
class WeatherDashboard {
  constructor() {
    this.config = null;
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

      // Data is now from Synoptic API with US units already converted
      const obs = data.observations;
      
      // Temperature (already in °F)
      const temp = obs.temperature?.value;
      document.getElementById('current-temp').textContent = temp !== null ? temp.toFixed(0) : '--';
      
      // Feels like (calculate from temp and wind for now)
      const windSpeed = obs.wind?.speed?.value || 0;
      let feelsLike = temp;
      if (temp !== null && windSpeed > 3) {
        // Simple wind chill approximation for temps below 50°F
        if (temp < 50) {
          feelsLike = 35.74 + (0.6215 * temp) - (35.75 * Math.pow(windSpeed, 0.16)) + (0.4275 * temp * Math.pow(windSpeed, 0.16));
        }
      }
      document.getElementById('feels-like').textContent = feelsLike !== null ? feelsLike.toFixed(0) + '°F' : '--';
      
      // Humidity (already in %)
      const humidity = obs.relativeHumidity?.value;
      document.getElementById('humidity').textContent = humidity !== null ? humidity.toFixed(0) + '%' : '--';
      
      // Wind (already in mph with cardinal direction)
      const windCardinal = obs.wind?.cardinal || '';
      const windSpeedDisplay = obs.wind?.speed?.value;
      const windGust = obs.wind?.gust?.value;
      let windText = '--';
      if (windSpeedDisplay !== null) {
        windText = `${windCardinal} ${windSpeedDisplay.toFixed(0)} mph`;
        if (windGust !== null && windGust > windSpeedDisplay) {
          windText += ` (gusts ${windGust.toFixed(0)})`;
        }
      }
      document.getElementById('wind').textContent = windText;
      
      // Pressure (already in inHg)
      const pressure = obs.pressure?.altimeter?.value;
      document.getElementById('pressure').textContent = pressure !== null ? pressure.toFixed(2) + ' inHg' : '--';
      
      // Visibility (already in miles)
      const visibility = obs.visibility?.value;
      document.getElementById('visibility').textContent = visibility !== null ? visibility.toFixed(1) + ' mi' : '--';
      
      // Dewpoint (already in °F)
      const dewpoint = obs.dewpoint?.value;
      document.getElementById('dewpoint').textContent = dewpoint !== null ? dewpoint.toFixed(0) + '°F' : '--';
      
      // Update data source footer
      if (data.source && data.station) {
        document.querySelector('.data-sources').textContent = 
          `Data: ${data.source} (Station ${data.station.id}: ${data.station.name})`;
      }
      
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

      const imageUrl = data.imageUrl || data.url;
      if (imageUrl) {
        img.src = imageUrl + '?t=' + Date.now();
        img.onload = () => {
          img.classList.add('loaded');
          const loader = img.previousElementSibling;
          if (loader) loader.style.display = 'none';
        };

        if (data.timestamp) {
          const radarTime = new Date(data.timestamp);
          timestamp.textContent = radarTime.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          }) + ' UTC';
        }
      }
    } catch (error) {
      console.error('Error loading radar:', error);
    }
  }

  async loadSatellite(product = 'geocolor') {
    try {
      const response = await fetch(`/api/satellite/latest?product=${product}`);
      const data = await response.json();
      
      if (data.error) {
        console.error('Satellite error:', data.error);
        return;
      }

      const img = document.getElementById('satellite-image');
      const timestamp = document.getElementById('satellite-timestamp');
      
      // Use our locally cached satellite image with cache busting
      const satUrl = data.imageUrl || data.url;
      if (satUrl) {
        img.src = satUrl + '?t=' + Date.now();
        img.onload = () => {
          img.classList.add('loaded');
          img.previousElementSibling.style.display = 'none';
        };
        
        if (data.timestamp) {
          const satTime = new Date(data.timestamp);
          timestamp.textContent = satTime.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });
        }
        
        if (data.product) {
          timestamp.textContent += ` (${data.product})`;
        }
      }
      
    } catch (error) {
      console.error('Error loading satellite:', error);
    }
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
    
    // Refresh radar more frequently (every 2 min)
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
