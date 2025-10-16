const authController = require("./auth.controller");
const KycController = require("./kyc.controller");
const UserController = require("./member.controller");
const MemberController = require("./member.controller");
const PaymentController = require("./payment.controller");
const WebhookController = require("./webhook.controller");
const AdminController = require("./admin.controller");
const tenantController = require("./tenant.controller");

module.exports = {
  authController,
  tenantController,
  KycController,
  UserController,
  MemberController,
  PaymentController,
  WebhookController,
  AdminController,
};
