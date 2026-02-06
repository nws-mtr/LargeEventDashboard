const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../../config/event.config.json');

// Get event configuration
router.get('/', async (req, res) => {
  try {
    const config = await fs.readFile(CONFIG_PATH, 'utf8');
    res.json(JSON.parse(config));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update event configuration
router.put('/', async (req, res) => {
  try {
    await fs.writeFile(CONFIG_PATH, JSON.stringify(req.body, null, 2));
    res.json({ success: true, message: 'Configuration updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
