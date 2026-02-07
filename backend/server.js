const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Import routes
const weatherRoutes = require('./routes/weather.routes');
const satelliteRoutes = require('./routes/satellite.routes');
const gribRoutes = require('./routes/grib.routes');
const mrmsRoutes = require('./routes/mrms.routes');
const configRoutes = require('./routes/config.routes');

// API Routes
app.use('/api/weather', weatherRoutes);
app.use('/api/satellite', satelliteRoutes);
app.use('/api/grib', gribRoutes);
app.use('/api/radar', mrmsRoutes); // MRMS is the primary radar source
app.use('/api/mrms', mrmsRoutes);
app.use('/api/config', configRoutes);

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🌦️  Large Event Weather Dashboard running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Initialize services
const weatherService = require('./services/weather.service');
const satelliteService = require('./services/satellite.service');
const mrmsService = require('./services/mrms.service');

// Start background data updates
weatherService.startPeriodicUpdates();
satelliteService.startPeriodicUpdates();
mrmsService.startPeriodicUpdates();

module.exports = app;
