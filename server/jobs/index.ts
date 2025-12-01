import cron from 'node-cron';
import { weatherMonitor } from './weatherMonitor';

/**
 * Initialize all scheduled jobs
 * Only runs in production or when NODE_APP_INSTANCE is 0 (to avoid duplicates in PM2 cluster mode)
 */
export function initializeJobs() {
  // Only initialize if this is the main process (not PM2 cluster worker)
  const isMainProcess = !process.env.NODE_APP_INSTANCE || process.env.NODE_APP_INSTANCE === '0';
  
  if (!isMainProcess) {
    console.log('⏭️  Skipping job initialization (not main process)');
    return;
  }

  console.log('🚀 Initializing scheduled jobs...');

  // Weather monitoring job - runs every 6 hours
  // Schedule: "0 */6 * * *" = at minute 0 of every 6th hour (12am, 6am, 12pm, 6pm)
  const weatherJob = cron.schedule('0 */6 * * *', async () => {
    console.log('⏰ Running scheduled weather monitor...');
    try {
      await weatherMonitor();
      console.log('✅ Weather monitor completed successfully');
    } catch (error) {
      console.error('❌ Weather monitor error:', error);
    }
  });

  console.log('✓ Weather monitoring job scheduled (every 6 hours)');

  // Optional: Run weather monitor on startup (for testing)
  if (process.env.RUN_JOBS_ON_STARTUP === 'true') {
    console.log('🏃 Running weather monitor on startup...');
    weatherMonitor().catch(error => {
      console.error('Weather monitor startup error:', error);
    });
  }

  // Return job instances for graceful shutdown if needed
  return {
    weatherJob
  };
}

// Graceful shutdown handler
export function shutdownJobs(jobs: ReturnType<typeof initializeJobs>) {
  if (!jobs) return;
  
  console.log('🛑 Stopping scheduled jobs...');
  
  if (jobs.weatherJob) {
    jobs.weatherJob.stop();
  }
  
  console.log('✓ All jobs stopped');
}
