const express = require("express");
const { validate, validateReq } = require("../middleware/validate");
const {
  authValidators: { signInValidator, signUpValidator, verifyEmailValidator },
} = require("../validations/index");
const { authController } = require("../controller");
const { getTenantBySlug } = require("../controller/auth.controller");
const router = express.Router();

router.post("/sign-up", validateReq(signUpValidator), authController.signUp);
router.post("/login", validateReq(signInValidator), authController.logIn);
router.post("/search-cooperative", authController.searchCooperative);
router.post(
  "/verify-email",
  validateReq(verifyEmailValidator),
  authController.activateAccount
);
router.post("/authenticate-2fa", authController.authenticate2FA);
router.post("/onboarding-cooperative", authController.onboardingCooperative);
router.post("/cooperative-login", authController.cooperativeLogin);
router.get("/tenant-by-slug/:slug", getTenantBySlug);

module.exports = router;
