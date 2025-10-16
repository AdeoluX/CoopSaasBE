const express = require("express");
const {validate, validateReq} = require('../middleware/validate')
const {authValidators: {signInValidator, signUpValidator, verifyEmailValidator}} = require('../validations/index')
const {
  KycController
} = require("../controller");
const router = express.Router();

router.post("/verify-nin", KycController.prototype.verifyNIN);

module.exports = router; 