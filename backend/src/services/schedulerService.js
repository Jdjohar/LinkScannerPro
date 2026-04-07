const cron = require('node-cron');
const Domain = require('../models/Domain');
const { startScan } = require('./crawlerService');

/**
 * Initializes the scheduler with daily tasks
 */
const initScheduler = () => {
  console.log('Initializing Scheduler...');

  // Run every day at midnight
  // cron.schedule('0 0 * * *', async () => {

  // For production, maybe run every 6 hours or 12 hours depending on volume
  // For testing, user can trigger "Scan Now"

  cron.schedule('26 18 * * *', async () => {
    console.log('Running daily scan job at midnight...');
    try {
      const domains = await Domain.find({});
      console.log(`Found ${domains.length} domains to scan.`);

      for (const domain of domains) {
        // We run them one by one to avoid overwhelming the server
        // In a real production environment with 1000s of domains, 
        // we would use a queue system like BullMQ.
        console.log(`Auto-triggering scan for ${domain.url}...`);
        await startScan(domain._id);
      }
    } catch (error) {
      console.error('Error in cron job:', error);
    }
  });

  console.log('Daily scan job scheduled at 00:00 (Midnight)');
};

module.exports = { initScheduler };
