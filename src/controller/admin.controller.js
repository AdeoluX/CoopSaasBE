const catchAsync = require("../utils/catchAsync");
const { successResponse } = require("../utils/responder");
const AdminService = require("../services/admin.service");

class AdminController {
  // ===== MEMBER MANAGEMENT =====
  static addMembers = catchAsync(async (req, res) => {
    const result = await AdminService.addMembers({
      cooperativeId: req.auth.cooperativeId,
      memberData: req.body,
    });
    return successResponse(res, result);
  });

  static getAllMembers = catchAsync(async (req, res) => {
    const { page, limit, search } = req.query;
    const members = await AdminService.getAllMembers({
      cooperativeId: req.auth.cooperativeId,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      search,
    });
    return successResponse(res, members);
  });

  // Add missing methods for routes
  static getMembers = catchAsync(async (req, res) => {
    const { page, limit, search } = req.query;
    const members = await AdminService.getAllMembers({
      cooperativeId: req.auth.cooperativeId,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      search,
    });
    return successResponse(res, members);
  });

  static createMember = catchAsync(async (req, res) => {
    const result = await AdminService.addMembers({
      cooperativeId: req.auth.cooperativeId,
      data: req.body,
    });
    return successResponse(res, result);
  });

  static updateMember = catchAsync(async (req, res) => {
    const result = await AdminService.updateMember({
      cooperativeId: req.auth.cooperativeId,
      memberId: req.params.id,
      updateData: req.body,
    });
    return successResponse(res, result);
  });

  static deleteMember = catchAsync(async (req, res) => {
    const result = await AdminService.deleteMember({
      cooperativeId: req.auth.cooperativeId,
      memberId: req.params.id,
    });
    return successResponse(res, result);
  });

  static getOneMember = catchAsync(async (req, res) => {
    const member = await AdminService.getOneMember({
      cooperativeId: req.auth.cooperativeId,
      memberId: req.params.id,
    });
    return successResponse(res, member);
  });

  // Bulk upload members via CSV
  static uploadMembersCSV = catchAsync(async (req, res) => {
    const file = req.files?.file || req.files?.csv;
    const result = await AdminService.addMembers({
      cooperativeId: req.auth.cooperativeId,
      file,
    });
    return successResponse(res, result);
  });

  // Download CSV template for member upload
  static downloadMembersTemplate = catchAsync(async (req, res) => {
    const headers = [
      "firstname",
      "lastname",
      "middlename",
      "email",
      "phone",
      "dob",
      "role",
    ];
    const sampleRow = [
      "Jane",
      "Doe",
      "A",
      "jane.doe@example.com",
      "+2348012345678",
      "1990-01-01",
      "user",
    ];
    const csv = `${headers.join(",")}\n${sampleRow.join(",")}\n`;
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="member_upload_template.csv"'
    );
    return res.send(csv);
  });

  // ===== MEMBER DETAILS =====
  static getMemberStats = catchAsync(async (req, res) => {
    const stats = await AdminService.getMemberStats({
      cooperativeId: req.auth.cooperativeId,
      memberId: req.params.id,
    });
    return successResponse(res, stats);
  });

  static getMemberTransactions = catchAsync(async (req, res) => {
    const transactions = await AdminService.getMemberTransactions({
      cooperativeId: req.auth.cooperativeId,
      memberId: req.params.id,
      paginateOptions: {
        page: req.query.page || 1,
        limit: req.query.limit || 10,
      },
    });
    return successResponse(res, transactions);
  });

  static getMemberLoans = catchAsync(async (req, res) => {
    const loans = await AdminService.getMemberLoans({
      cooperativeId: req.auth.cooperativeId,
      memberId: req.params.id,
      paginateOptions: {
        page: req.query.page || 1,
        limit: req.query.limit || 10,
      },
    });
    return successResponse(res, loans);
  });

  static getMemberAssets = catchAsync(async (req, res) => {
    const assets = await AdminService.getMemberAssets({
      cooperativeId: req.auth.cooperativeId,
      memberId: req.params.id,
      paginateOptions: {
        page: req.query.page || 1,
        limit: req.query.limit || 10,
      },
    });
    return successResponse(res, assets);
  });

  static getAllTransactions = catchAsync(async (req, res) => {
    const transactions = await AdminService.getAllTransactions({
      cooperativeId: req.auth.cooperativeId,
      paginateOptions: {
        page: req.query.page || 1,
        limit: req.query.limit || 10,
      },
      search: req.query.search || "",
      dateFilter: {
        startDate: req.query.startDate || "",
        endDate: req.query.endDate || "",
      },
    });
    const { data, pagination } = transactions;
    return successResponse(res, { transactions: data, pagination });
  });

  static getCooperativeBalance = catchAsync(async (req, res) => {
    const balance = await AdminService.getCooperativeBalance({
      cooperativeId: req.auth.cooperativeId,
    });
    return successResponse(res, balance);
  });

  static getAnalytics = catchAsync(async (req, res) => {
    const { dateRange = "30d" } = req.query;
    const analytics = await AdminService.getAnalytics({
      cooperativeId: req.auth.cooperativeId,
      dateRange,
    });
    return successResponse(res, analytics);
  });

  static getCooperativeStats = catchAsync(async (req, res) => {
    const stats = await AdminService.getCooperativeStats({
      cooperativeId: req.auth.cooperativeId,
    });
    return successResponse(res, stats);
  });

  static updateMemberContribution = catchAsync(async (req, res) => {
    const member = await AdminService.updateMemberContribution({
      cooperativeId: req.auth.cooperativeId,
      id: req.params.id,
      data: req.body,
    });
    return successResponse(res, member);
  });

  // ===== INVITATION SYSTEM =====
  static createInvitation = catchAsync(async (req, res) => {
    const result = await AdminService.createInvitation({
      cooperativeId: req.auth.cooperativeId,
      invitationData: req.body,
    });
    return successResponse(res, result);
  });

  static sendInvitation = catchAsync(async (req, res) => {
    const result = await AdminService.createInvitation({
      cooperativeId: req.auth.cooperativeId,
      invitationData: req.body,
    });
    return successResponse(res, result);
  });

  static getPendingInvitations = catchAsync(async (req, res) => {
    const invitations = await AdminService.getPendingInvitations({
      cooperativeId: req.auth.cooperativeId,
    });
    return successResponse(res, invitations);
  });

  static cancelInvitation = catchAsync(async (req, res) => {
    const result = await AdminService.cancelInvitation({
      cooperativeId: req.auth.cooperativeId,
      invitationId: req.params.id,
      cancelledBy: req.auth.id,
    });
    return successResponse(res, result);
  });

  // ===== ASSET MANAGEMENT =====
  static createAsset = catchAsync(async (req, res) => {
    const asset = await AdminService.createAsset({
      cooperativeId: req.auth.cooperativeId,
      assetData: req.body,
    });
    return successResponse(res, asset);
  });

  static getAssets = catchAsync(async (req, res) => {
    const { page, limit } = req.query;
    const assets = await AdminService.getAssets({
      cooperativeId: req.auth.cooperativeId,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
    });
    return successResponse(res, assets);
  });

  static updateAsset = catchAsync(async (req, res) => {
    const asset = await AdminService.updateAsset({
      cooperativeId: req.auth.cooperativeId,
      assetId: req.params.id,
      assetData: req.body,
    });
    return successResponse(res, asset);
  });

  static publishAsset = catchAsync(async (req, res) => {
    const asset = await AdminService.publishAsset({
      cooperativeId: req.auth.cooperativeId,
      assetId: req.params.id,
    });
    return successResponse(res, asset);
  });

  static getAssetById = catchAsync(async (req, res) => {
    const asset = await AdminService.getAssetById({
      cooperativeId: req.auth.cooperativeId,
      assetId: req.params.id,
    });
    return successResponse(res, asset);
  });

  static deleteAsset = catchAsync(async (req, res) => {
    await AdminService.deleteAsset({
      cooperativeId: req.auth.cooperativeId,
      assetId: req.params.id,
    });
    return successResponse(res, { message: "Asset deleted successfully" });
  });

  static getAllActivities = catchAsync(async (req, res) => {
    const {
      page,
      limit,
      category,
      type,
      status,
      severity,
      startDate,
      endDate,
      search,
    } = req.query;

    const activities = await AdminService.getAllActivities({
      cooperativeId: req.auth.cooperativeId,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      category,
      type,
      status,
      severity,
      startDate,
      endDate,
      search,
    });

    const { data, pagination } = activities;
    return successResponse(res, { activities: data, pagination });
  });

  // ===== LOAN MANAGEMENT =====
  static getLoanRequests = catchAsync(async (req, res) => {
    const { page, limit, status } = req.query;
    const loans = await AdminService.getLoanRequests({
      cooperativeId: req.auth.cooperativeId,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      status,
    });
    return successResponse(res, loans);
  });

  static getLoanManagementStats = catchAsync(async (req, res) => {
    const stats = await AdminService.getLoanManagementStats({
      cooperativeId: req.auth.cooperativeId,
    });
    return successResponse(res, stats);
  });

  static approveLoan = catchAsync(async (req, res) => {
    const result = await AdminService.approveLoan({
      cooperativeId: req.auth.cooperativeId,
      loanId: req.params.id,
      approvedBy: req.auth.id,
      approvalData: req.body,
    });
    return successResponse(res, result);
  });

  static rejectLoan = catchAsync(async (req, res) => {
    const result = await AdminService.rejectLoan({
      cooperativeId: req.auth.cooperativeId,
      loanId: req.params.id,
      rejectedBy: req.auth.id,
      rejectionReason: req.body.rejectionReason,
    });
    return successResponse(res, result);
  });

  // ===== WALLET MANAGEMENT =====
  static getCooperativeWallets = catchAsync(async (req, res) => {
    const wallets = await AdminService.getCooperativeWallets({
      cooperativeId: req.auth.cooperativeId,
    });
    return successResponse(res, wallets);
  });

  // ===== WITHDRAWAL MANAGEMENT =====
  static getPendingWithdrawals = catchAsync(async (req, res) => {
    const { page, limit } = req.query;
    const withdrawals = await AdminService.getPendingWithdrawals({
      cooperativeId: req.auth.cooperativeId,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
    });
    return successResponse(res, withdrawals);
  });

  static getWithdrawalById = catchAsync(async (req, res) => {
    const { withdrawalId } = req.params;
    const withdrawal = await AdminService.getWithdrawalById({
      cooperativeId: req.auth.cooperativeId,
      withdrawalId,
    });
    return successResponse(res, withdrawal);
  });

  static approveWithdrawal = catchAsync(async (req, res) => {
    const { withdrawalId } = req.params;
    const result = await AdminService.approveWithdrawal({
      cooperativeId: req.auth.cooperativeId,
      withdrawalId,
      approvedBy: req.auth.id,
    });
    return successResponse(res, result);
  });

  static rejectWithdrawal = catchAsync(async (req, res) => {
    const { withdrawalId } = req.params;
    const { rejectionReason } = req.body;
    const result = await AdminService.rejectWithdrawal({
      cooperativeId: req.auth.cooperativeId,
      withdrawalId,
      rejectedBy: req.auth.id,
      rejectionReason,
    });
    return successResponse(res, result);
  });

  // ===== COOPERATIVE SETTINGS MANAGEMENT =====
  static getCooperativeSettings = catchAsync(async (req, res) => {
    const settings = await AdminService.getCooperativeSettings({
      cooperativeId: req.auth.cooperativeId,
    });
    return successResponse(res, settings);
  });

  static updateCooperativeSettings = catchAsync(async (req, res) => {
    const result = await AdminService.updateCooperativeSettings({
      cooperativeId: req.auth.cooperativeId,
      settings: req.body,
    });
    return successResponse(res, result);
  });

  // ===== SUBSCRIPTION MANAGEMENT =====
  static getSubscriptionPlans = catchAsync(async (req, res) => {
    const plans = await AdminService.getSubscriptionPlans();
    return successResponse(res, plans);
  });

  static getCurrentSubscription = catchAsync(async (req, res) => {
    const subscription = await AdminService.getCurrentSubscription({
      cooperativeId: req.auth.cooperativeId,
    });
    return successResponse(res, subscription);
  });

  static changeSubscription = catchAsync(async (req, res) => {
    const { planId, plan } = req.body;
    const result = await AdminService.changeSubscription({
      cooperativeId: req.auth.cooperativeId,
      planId,
      planTier: plan,
      changedBy: req.auth.id,
    });
    return successResponse(res, result);
  });

  static updateSubscriptionSettings = catchAsync(async (req, res) => {
    const result = await AdminService.updateSubscriptionSettings({
      cooperativeId: req.auth.cooperativeId,
      subscriptionData: req.body,
    });
    return successResponse(res, result);
  });

  // ===== ACCESS CONTROL =====
  static getAvailableFeatures = catchAsync(async (req, res) => {
    const features = await AdminService.getAvailableFeatures({
      cooperativeId: req.auth.cooperativeId,
    });
    return successResponse(res, features);
  });

  static checkFeatureAccess = catchAsync(async (req, res) => {
    const { feature } = req.params;
    const accessCheck = await AdminService.checkFeatureAccess({
      cooperativeId: req.auth.cooperativeId,
      feature,
    });
    return successResponse(res, accessCheck);
  });

  static getUpgradeSuggestions = catchAsync(async (req, res) => {
    const suggestions = await AdminService.getUpgradeSuggestions({
      cooperativeId: req.auth.cooperativeId,
    });
    return successResponse(res, suggestions);
  });

  static checkLimits = catchAsync(async (req, res) => {
    const { limitType, currentValue } = req.query;
    const limitCheck = await AdminService.checkLimits({
      cooperativeId: req.auth.cooperativeId,
      limitType,
      currentValue: parseInt(currentValue) || 0,
    });
    return successResponse(res, limitCheck);
  });

  // ===== ASSET REDEMPTION MANAGEMENT =====
  static getPendingAssetRedemptions = catchAsync(async (req, res) => {
    const { page, limit } = req.query;
    const redemptions = await AdminService.getPendingAssetRedemptions({
      cooperativeId: req.auth.cooperativeId,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
    });
    return successResponse(res, redemptions);
  });

  static approveAssetRedemption = catchAsync(async (req, res) => {
    const { redemptionId } = req.params;
    const result = await AdminService.approveAssetRedemption({
      redemptionId,
      approvedBy: req.auth.id,
      cooperativeId: req.auth.cooperativeId,
    });
    return successResponse(res, result);
  });

  static rejectAssetRedemption = catchAsync(async (req, res) => {
    const { redemptionId } = req.params;
    const { rejectionReason } = req.body;
    const result = await AdminService.rejectAssetRedemption({
      redemptionId,
      rejectedBy: req.auth.id,
      cooperativeId: req.auth.cooperativeId,
      rejectionReason,
    });
    return successResponse(res, result);
  });

  static getAssetRedemptionStats = catchAsync(async (req, res) => {
    const stats = await AdminService.getAssetRedemptionStats({
      cooperativeId: req.auth.cooperativeId,
    });
    return successResponse(res, stats);
  });
}

module.exports = AdminController;
