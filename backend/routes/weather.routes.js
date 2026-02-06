const express = require('express');
const router = express.Router();
const weatherService = require('../services/weather.service');

// Get current weather conditions
router.get('/current', async (req, res) => {
  try {
    const data = await weatherService.getCurrentWeather();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get hourly forecast
router.get('/forecast/hourly', async (req, res) => {
  try {
    const data = await weatherService.getHourlyForecast();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get weather alerts
router.get('/alerts', async (req, res) => {
  try {
    const data = await weatherService.getWeatherAlerts();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get observations (station data)
router.get('/observations', async (req, res) => {
  try {
    const data = await weatherService.getObservations();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
