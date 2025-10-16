const express = require("express");
const { validate, validateReq } = require("../middleware/validate");
const {
  authValidators: { signInValidator, signUpValidator, verifyEmailValidator },
} = require("../validations/index");
const { PaymentController } = require("../controller");
const { verify } = require("../middleware/verifyToken");
const router = express.Router();

router.post("/fund-wallet", verify("user"), PaymentController.fundWallet);
router.post("/buy-token/:asset_id", verify("user"), PaymentController.buyToken);

module.exports = router;
