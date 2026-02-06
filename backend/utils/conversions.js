// Utility functions for the weather dashboard

/**
 * Convert Celsius to Fahrenheit
 */
function celsiusToFahrenheit(celsius) {
  if (celsius === null || celsius === undefined) return null;
  return (celsius * 9/5) + 32;
}

/**
 * Convert meters to miles
 */
function metersToMiles(meters) {
  if (meters === null || meters === undefined) return null;
  return meters / 1609.34;
}

/**
 * Convert m/s to mph
 */
function msToMph(ms) {
  if (ms === null || ms === undefined) return null;
  return ms * 2.237;
}

/**
 * Convert pascals to inches of mercury
 */
function pascalsToInHg(pascals) {
  if (pascals === null || pascals === undefined) return null;
  return pascals / 3386.39;
}

/**
 * Convert degrees to compass direction
 */
function degToCompass(deg) {
  if (deg === null || deg === undefined) return 'N';
  const val = Math.floor((deg / 22.5) + 0.5);
  const arr = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
               'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return arr[(val % 16)];
}

/**
 * Format timestamp for display
 */
function formatTimestamp(date) {
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Calculate distance between two lat/lon points (Haversine formula)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI/180);
}

module.exports = {
  celsiusToFahrenheit,
  metersToMiles,
  msToMph,
  pascalsToInHg,
  degToCompass,
  formatTimestamp,
  calculateDistance
};
