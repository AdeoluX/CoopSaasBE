const express = require("express");
const { validate, validateReq } = require("../middleware/validate");
const {
  authValidators: { signInValidator, signUpValidator, verifyEmailValidator },
} = require("../validations/index");
const { WebhookController } = require("../controller");
const { verify } = require("../middleware/verifyToken");

const router = express.Router();

router.post("/fund-wallet", WebhookController.fundWallet);

router.use("/paystack/webhook", WebhookController.paystackWebhook);

module.exports = router;
