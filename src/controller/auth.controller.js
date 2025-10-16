const catchAsync = require("../utils/catchAsync");
const { authService, tenantService } = require("../services");
const CooperativeRepo = require("../repo/cooperative.repo");
const { successResponse, abortIf } = require("../utils/responder");
const httpStatus = require("http-status");

const signUp = catchAsync(async (req, res, next) => {
  const create = await authService.userSignUp(req.body);
  return successResponse(res, create);
});

const logIn = catchAsync(async (req, res, next) => {
  const { org_id } = req.query;
  const log_in = await authService.login({ ...req.body, org_id });
  return successResponse(res, log_in);
});

const searchCooperative = catchAsync(async (req, res, next) => {
  const search = await authService.searchCooperative(req.body);
  return successResponse(res, search);
});

const activateAccount = catchAsync(async (req, res, next) => {
  const log_in = await authService.activateAccount({ ...req.body });
  return successResponse(res, log_in);
});

const authenticate2FA = catchAsync(async (req, res, next) => {
  const log_in = await authService.authenticate2FA({ ...req.body });
  return successResponse(res, log_in);
});

const onboardingCooperative = catchAsync(async (req, res, next) => {
  const onboarding = await tenantService.onboardingCooperative({ ...req.body });
  return successResponse(res, onboarding);
});

const cooperativeLogin = catchAsync(async (req, res, next) => {
  const log_in = await tenantService.loginCooperative(req.body);
  return successResponse(res, log_in);
});

module.exports = {
  signUp,
  logIn,
  activateAccount,
  authenticate2FA,
  onboardingCooperative,
  cooperativeLogin,
  searchCooperative,
};

// Resolve tenant by slug
module.exports.getTenantBySlug = catchAsync(async (req, res) => {
  const { slug } = req.params;
  const coop = await CooperativeRepo.findOne({ query: { slug } });
  abortIf(!coop, httpStatus.NOT_FOUND, "Tenant not found");
  return successResponse(res, {
    id: coop._id,
    name: coop.name,
    slug: coop.slug,
  });
});
