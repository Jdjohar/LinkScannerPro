const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');
const { protect } = require('../middleware/authMiddleware');
const { updateSchedule } = require('../services/schedulerService');

// Get all settings
router.get('/', protect, async (req, res) => {
  try {
    const settings = await Settings.find({});
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching settings' });
  }
});

// Update or create a setting
router.post('/', protect, async (req, res) => {
  const { key, value } = req.body;
  try {
    const setting = await Settings.findOneAndUpdate(
      { key },
      { value },
      { upsert: true, new: true }
    );

    // If we updated the cronTime, we need to re-initialize the scheduler
    if (key === 'cronTime') {
        console.log(`Re-scheduling daily job to: ${value}`);
        updateSchedule(value);
    }

    res.json(setting);
  } catch (error) {
    res.status(500).json({ message: 'Error updating setting' });
  }
});

module.exports = router;
