const authRoutes = require("./auth.route");
const adminRoutes = require("./admin.route");
const memberRoutes = require("./member.route");
const webhookRoutes = require("./webhook.routes");
const reportingRoutes = require("./reporting.route");

module.exports = {
  authRoutes,
  adminRoutes,
  memberRoutes,
  webhookRoutes,
  reportingRoutes,
};
