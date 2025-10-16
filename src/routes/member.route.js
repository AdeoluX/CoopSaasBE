const express = require("express");
const { validateReq } = require("../middleware/validate");
const {
  authValidators: { signInValidator, signUpValidator, verifyEmailValidator },
  bankValidators: { resolveBankAccountValidator, addBankAccountValidator },
} = require("../validations/index");
const MemberController = require("../controller/member.controller");
const { verify } = require("../middleware/verifyToken");

const router = express.Router();

// ===== MEMBER PROFILE =====
router.get("/me", verify("*"), MemberController.getMyProfile);

// ===== TRANSACTIONS =====
router.get("/my-transactions", verify("*"), MemberController.getMyTransactions);

// ===== PORTFOLIO & STATS =====
router.get("/portfolio", verify("*"), MemberController.getMyPortfolio);
router.get("/stats", verify("*"), MemberController.getMyStats);

// ===== ACTIVITIES =====
router.get("/my-activities", verify("*"), MemberController.getMyActivities);

// ===== LOAN REQUESTS =====
router.post("/loans", verify("*"), MemberController.requestLoan);
router.get("/loans", verify("*"), MemberController.getMyLoans);

// ===== ASSET INVESTMENT =====
router.post("/assets/buy", verify("*"), MemberController.buyAsset);
router.get("/assets", verify("*"), MemberController.getMyAssets);
router.get(
  "/assets/available",
  verify("*"),
  MemberController.getAvailableAssets
);

// ===== WITHDRAWAL REQUESTS =====
router.post("/withdrawals", verify("*"), MemberController.requestWithdrawal);
router.get("/withdrawals", verify("*"), MemberController.getMyWithdrawals);

// ===== CONTRIBUTION =====
router.post("/contribute", verify("*"), MemberController.contribute);

// ===== ASSET REDEMPTION =====
router.post(
  "/assets/redemption",
  verify("*"),
  MemberController.requestAssetRedemption
);
router.get(
  "/assets/redemption",
  verify("*"),
  MemberController.getMyAssetRedemptions
);
router.get(
  "/assets/redemption/stats",
  verify("*"),
  MemberController.getAssetRedemptionStats
);

// ===== BANK MANAGEMENT =====
router.get("/banks", verify("*"), MemberController.listBanks);
router.post(
  "/banks/resolve",
  verify("*"),
  validateReq(resolveBankAccountValidator),
  MemberController.resolveBankAccount
);
router.post(
  "/banks",
  verify("*"),
  validateReq(addBankAccountValidator),
  MemberController.addBankAccount
);
router.get("/banks/my", verify("*"), MemberController.getMyBank);
router.put(
  "/banks/my",
  verify("*"),
  validateReq(addBankAccountValidator),
  MemberController.updateMyBank
);
router.delete("/banks/my", verify("*"), MemberController.deleteMyBank);

module.exports = router;
