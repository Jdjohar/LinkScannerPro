const cron = require('node-cron');
const Domain = require('../models/Domain');
const Settings = require('../models/Settings');
const { startScan } = require('./crawlerService');

let currentJob = null;

/**
 * Initializes the scheduler with daily tasks from database
 */
const initScheduler = async () => {
  console.log('Initializing Scheduler...');

  try {
    // 1. Get cronTime from Settings (fallback to midnight)
    let cronConfig = await Settings.findOne({ key: 'cronTime' });
    let cronTime = cronConfig ? cronConfig.value : '0 0 * * *'; // Default to 00:00

    console.log(`Setting up daily scan job at: ${cronTime}`);
    scheduleJob(cronTime);
    
  } catch (error) {
    console.error('Error initializing scheduler:', error);
    // Fallback if settings fail
    scheduleJob('0 0 * * *');
  }
};

/**
 * Creates the cron job
 */
const scheduleJob = (time) => {
    if (currentJob) {
        currentJob.stop();
    }

    // Convert "HH:mm" to cron format "mm HH * * *" if needed
    let cronPattern = time;
    if (time.includes(':') && !time.includes('*')) {
        const [hour, minute] = time.split(':');
        cronPattern = `${minute} ${hour} * * *`;
    }

    currentJob = cron.schedule(cronPattern, async () => {
        console.log(`Running scheduled daily scan job (${time})...`);
        try {
            const domains = await Domain.find({});
            for (const domain of domains) {
                console.log(`[Auto-Scan] Starting for ${domain.url}...`);
                await startScan(domain._id);
            }
        } catch (error) {
            console.error('Error in cron job execution:', error);
        }
    });

    console.log(`Daily scan job scheduled with pattern: ${cronPattern}`);
};

/**
 * External interface to update schedule
 */
const updateSchedule = (newTime) => {
    console.log(`Updating scheduler to new time: ${newTime}`);
    scheduleJob(newTime);
};

module.exports = { initScheduler, updateSchedule };
