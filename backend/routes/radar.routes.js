const express = require('express');
const router = express.Router();
const radarService = require('../services/radar.service');

// Get latest radar image
router.get('/latest', async (req, res) => {
  try {
    const data = await radarService.getLatestRadar();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get radar animation loop
router.get('/loop', async (req, res) => {
  try {
    const frames = await radarService.getRadarLoop();
    res.json(frames);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get radar image by timestamp
router.get('/image/:timestamp', async (req, res) => {
  try {
    const data = await radarService.getRadarByTimestamp(req.params.timestamp);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get list of available MRMS files
router.get('/mrms/available', async (req, res) => {
  try {
    const files = await radarService.listAvailableMRMSFiles();
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
