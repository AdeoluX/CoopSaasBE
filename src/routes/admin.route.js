const express = require("express");
const router = express.Router();
const AdminController = require("../controller/admin.controller");
const verifyToken = require("../middleware/verifyToken");
const {
  requireFeature,
  requireWithinLimit,
  requireAction,
  addFeatureInfo,
  getMemberCountFromRequest,
  getTransactionAmountFromRequest,
} = require("../middleware/access-control.middleware");

// Apply feature info middleware to all admin routes
router.use(addFeatureInfo);

// ===== MEMBER MANAGEMENT =====
router.get(
  "/members",
  verifyToken.verifyAdmin,
  // requireFeature("member_management"),
  AdminController.getMembers
);

// Download CSV template for member upload
router.get(
  "/members/upload-template",
  verifyToken.verifyAdmin,
  AdminController.downloadMembersTemplate
);

router.get(
  "/members/:id",
  verifyToken.verifyAdmin,
  // requireFeature("member_management"),
  AdminController.getOneMember
);

router.post(
  "/create-member",
  verifyToken.verifyAdmin,
  // requireFeature("create_member"),
  // requireWithinLimit("member_limit", getMemberCountFromRequest),
  AdminController.createMember
);

// Bulk upload members via CSV
router.post(
  "/members/upload",
  verifyToken.verifyAdmin,
  AdminController.uploadMembersCSV
);

router.put(
  "/members/:id",
  verifyToken.verifyAdmin,
  // requireFeature("update_member"),
  AdminController.updateMember
);

router.delete(
  "/members/:id",
  verifyToken.verifyAdmin,
  // requireFeature("delete_member"),
  AdminController.deleteMember
);

// ===== MEMBER DETAILS =====
router.get(
  "/members/:id/stats",
  verifyToken.verifyAdmin,
  AdminController.getMemberStats
);

router.get(
  "/members/:id/transactions",
  verifyToken.verifyAdmin,
  AdminController.getMemberTransactions
);

router.get(
  "/members/:id/loans",
  verifyToken.verifyAdmin,
  AdminController.getMemberLoans
);

router.get(
  "/members/:id/assets",
  verifyToken.verifyAdmin,
  AdminController.getMemberAssets
);

// ===== INVITATION MANAGEMENT =====
router.get(
  "/invitations",
  verifyToken.verifyAdmin,
  // requireFeature("member_management"),
  AdminController.getPendingInvitations
);

router.post(
  "/invitations",
  verifyToken.verifyAdmin,
  // requireFeature("create_member"),
  // requireWithinLimit("member_limit", getMemberCountFromRequest),
  AdminController.sendInvitation
);

// ===== ASSET MANAGEMENT =====
router.get(
  "/assets",
  verifyToken.verifyAdmin,
  // requireFeature("asset_management"),
  AdminController.getAssets
);

router.post(
  "/assets",
  verifyToken.verifyAdmin,
  // requireFeature("asset_management"),
  AdminController.createAsset
);

router.get(
  "/assets/:id",
  verifyToken.verifyAdmin,
  // requireFeature("asset_management"),
  AdminController.getAssetById
);

router.put(
  "/assets/:id",
  verifyToken.verifyAdmin,
  // requireFeature("update_asset"),
  AdminController.updateAsset
);

router.put(
  "/assets/:id/publish",
  verifyToken.verifyAdmin,
  // requireFeature("publish_asset"),
  AdminController.publishAsset
);

router.delete(
  "/assets/:id",
  verifyToken.verifyAdmin,
  // requireFeature("delete_asset"),
  AdminController.deleteAsset
);

// ===== ACTIVITIES =====
router.get(
  "/activities",
  verifyToken.verifyAdmin,
  // requireFeature("activity_logs"),
  AdminController.getAllActivities
);

// ===== LOAN MANAGEMENT =====
router.get(
  "/loans",
  verifyToken.verifyAdmin,
  // requireFeature("loan_management"),
  AdminController.getLoanRequests
);

router.get(
  "/loans/stats",
  verifyToken.verifyAdmin,
  // requireFeature("loan_tracking"),
  AdminController.getLoanManagementStats
);

router.put(
  "/loans/:id/approve",
  verifyToken.verifyAdmin,
  //   requireFeature("approve_loan"),
  AdminController.approveLoan
);

router.put(
  "/loans/:id/reject",
  verifyToken.verifyAdmin,
  // requireFeature("reject_loan"),
  AdminController.rejectLoan
);

// ===== WALLET MANAGEMENT =====
router.get(
  "/wallets",
  verifyToken.verifyAdmin,
  // requireFeature("wallet_management"),
  AdminController.getCooperativeWallets
);

// ===== WITHDRAWAL MANAGEMENT =====
router.get(
  "/withdrawals",
  verifyToken.verifyAdmin,
  // requireFeature("withdrawal_management"),
  AdminController.getPendingWithdrawals
);

router.get(
  "/withdrawals/:withdrawalId",
  verifyToken.verifyAdmin,
  // requireFeature("withdrawal_management"),
  AdminController.getWithdrawalById
);

router.post(
  "/withdrawals/:withdrawalId/approve",
  verifyToken.verifyAdmin,
  // requireFeature("withdrawal_management"),
  AdminController.approveWithdrawal
);

router.post(
  "/withdrawals/:withdrawalId/reject",
  verifyToken.verifyAdmin,
  // requireFeature("withdrawal_management"),
  AdminController.rejectWithdrawal
);

// ===== COOPERATIVE SETTINGS MANAGEMENT =====
router.get(
  "/settings",
  verifyToken.verifyAdmin,
  // requireFeature("settings_management"),
  AdminController.getCooperativeSettings
);

router.put(
  "/settings",
  verifyToken.verifyAdmin,
  // requireFeature("settings_management"),
  AdminController.updateCooperativeSettings
);

// ===== SUBSCRIPTION MANAGEMENT =====
router.get(
  "/subscription/plans",
  verifyToken.verifyAdmin,
  AdminController.getSubscriptionPlans
);

router.get(
  "/subscription/current",
  verifyToken.verifyAdmin,
  AdminController.getCurrentSubscription
);

router.post(
  "/subscription/change",
  verifyToken.verifyAdmin,
  AdminController.changeSubscription
);

router.put(
  "/subscription/settings",
  verifyToken.verifyAdmin,
  AdminController.updateSubscriptionSettings
);

// ===== ACCESS CONTROL =====
router.get(
  "/access/features",
  verifyToken.verifyAdmin,
  AdminController.getAvailableFeatures
);

router.get(
  "/access/features/:feature",
  verifyToken.verifyAdmin,
  AdminController.checkFeatureAccess
);

router.get(
  "/access/upgrade-suggestions",
  verifyToken.verifyAdmin,
  AdminController.getUpgradeSuggestions
);

router.get(
  "/access/limits",
  verifyToken.verifyAdmin,
  AdminController.checkLimits
);

// ===== ANALYTICS & TRANSACTIONS =====
router.get(
  "/transactions",
  verifyToken.verifyAdmin,
  // requireFeature("view_transactions"),
  AdminController.getAllTransactions
);

router.get(
  "/analytics",
  verifyToken.verifyAdmin,
  // requireFeature("view_analytics"),
  AdminController.getAnalytics
);

// ===== COOPERATIVE STATS =====
router.get(
  "/stats",
  verifyToken.verifyAdmin,
  // requireFeature("basic_reporting"),
  AdminController.getCooperativeStats
);

// ===== ASSET REDEMPTION MANAGEMENT =====
router.get(
  "/asset-redemptions",
  verifyToken.verifyAdmin,
  // requireFeature("asset_redemption_management"),
  AdminController.getPendingAssetRedemptions
);

router.put(
  "/asset-redemptions/:redemptionId/approve",
  verifyToken.verifyAdmin,
  // requireFeature("asset_redemption_management"),
  AdminController.approveAssetRedemption
);

router.put(
  "/asset-redemptions/:redemptionId/reject",
  verifyToken.verifyAdmin,
  // requireFeature("asset_redemption_management"),
  AdminController.rejectAssetRedemption
);

router.get(
  "/asset-redemptions/stats",
  verifyToken.verifyAdmin,
  // requireFeature("asset_redemption_management"),
  AdminController.getAssetRedemptionStats
);

module.exports = router;
