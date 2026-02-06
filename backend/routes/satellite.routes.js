const express = require('express');
const router = express.Router();
const satelliteService = require('../services/satellite.service');

// Get latest satellite image
router.get('/latest', async (req, res) => {
  try {
    const data = await satelliteService.getLatestSatellite();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get satellite loop
router.get('/loop', async (req, res) => {
  try {
    const frames = await satelliteService.getSatelliteLoop();
    res.json(frames);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific product (visible, infrared, water vapor, etc.)
router.get('/product/:type', async (req, res) => {
  try {
    const data = await satelliteService.getSatelliteProduct(req.params.type);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
