const express = require('express');
const router = express.Router();
const gribService = require('../services/grib.service');

// Get latest GRIB data
router.get('/latest', async (req, res) => {
  try {
    const data = await gribService.getLatestGribData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific GRIB parameter
router.get('/parameter/:param', async (req, res) => {
  try {
    const data = await gribService.getGribParameter(req.params.param);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get forecast hour
router.get('/forecast/:hour', async (req, res) => {
  try {
    const data = await gribService.getGribForecastHour(req.params.hour);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
