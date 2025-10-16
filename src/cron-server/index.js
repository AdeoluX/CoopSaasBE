const ajocron = require("./ajocron");
const {
  startReportingCronJobs,
  stopReportingCronJobs,
} = require("./reporting.cron");

module.exports = {
  ajocron,
  startReportingCronJobs,
  stopReportingCronJobs,
};
