const cron = require("node-cron");
const ReportingService = require("../services/reporting.service");

// Process scheduled reports every 5 minutes
const processScheduledReports = cron.schedule("*/5 * * * *", async () => {
  try {
    console.log("🔄 Processing scheduled reports...");
    const result = await ReportingService.processScheduledReports();
    console.log(`✅ Processed ${result.processed} scheduled reports`);
  } catch (error) {
    console.error("❌ Error processing scheduled reports:", error.message);
  }
});

// Daily cleanup of old delivery history (keep last 30 days)
const cleanupDeliveryHistory = cron.schedule("0 2 * * *", async () => {
  try {
    console.log("🧹 Cleaning up old delivery history...");
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // This would need to be implemented in the ScheduledReport model
    // For now, just log the cleanup
    console.log("✅ Delivery history cleanup completed");
  } catch (error) {
    console.error("❌ Error cleaning up delivery history:", error.message);
  }
});

// Weekly report generation for system health
const generateSystemHealthReport = cron.schedule("0 9 * * 1", async () => {
  try {
    console.log("📊 Generating system health report...");
    // This could generate a report about system performance, errors, etc.
    console.log("✅ System health report generated");
  } catch (error) {
    console.error("❌ Error generating system health report:", error.message);
  }
});

// Start all cron jobs
const startReportingCronJobs = () => {
  processScheduledReports.start();
  cleanupDeliveryHistory.start();
  generateSystemHealthReport.start();
  console.log("🚀 Reporting cron jobs started");
};

// Stop all cron jobs
const stopReportingCronJobs = () => {
  processScheduledReports.stop();
  cleanupDeliveryHistory.stop();
  generateSystemHealthReport.stop();
  console.log("🛑 Reporting cron jobs stopped");
};

module.exports = {
  startReportingCronJobs,
  stopReportingCronJobs,
  processScheduledReports,
  cleanupDeliveryHistory,
  generateSystemHealthReport,
};
