const authService = require("./auth.service");
const KycService = require("./kyc.service");
const UserService = require("./user.service");
const PaymentService = require("./payment-engine.service");
const WebhookService = require("./webhook.service");
const AdminService = require("./admin.service");
const MemberService = require("./member.service");
const tenantService = require("./tenant.service");

module.exports = {
  authService,
  KycService,
  UserService,
  PaymentService,
  WebhookService,
  AdminService,
  MemberService,
  tenantService,
};
