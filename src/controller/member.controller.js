const catchAsync = require("../utils/catchAsync");
const { successResponse } = require("../utils/responder");
const MemberService = require("../services/member.service");
const BankService = require("../services/bank.service");

class MemberController {
  // ===== MEMBER PROFILE =====
  static getMyProfile = catchAsync(async (req, res) => {
    const profile = await MemberService.getMyProfile({
      memberId: req.auth.id,
      cooperativeId: req.auth.cooperativeId,
    });
    return successResponse(res, profile);
  });

  // ===== TRANSACTIONS =====
  static getMyTransactions = catchAsync(async (req, res) => {
    const { page, limit, type, status } = req.query;
    const transactions = await MemberService.getMyTransactions({
      memberId: req.auth.id,
      cooperativeId: req.auth.cooperativeId,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      type,
      status,
    });
    return successResponse(res, transactions);
  });

  // ===== PORTFOLIO & STATS =====
  static getMyPortfolio = catchAsync(async (req, res) => {
    const portfolio = await MemberService.getMyPortfolio({
      memberId: req.auth.id,
      cooperativeId: req.auth.cooperativeId,
    });
    return successResponse(res, portfolio);
  });

  static getMyStats = catchAsync(async (req, res) => {
    const stats = await MemberService.getMyStats({
      memberId: req.auth.id,
      cooperativeId: req.auth.cooperativeId,
    });
    return successResponse(res, stats);
  });

  // ===== ACTIVITIES =====
  static getMyActivities = catchAsync(async (req, res) => {
    const { page, limit, type } = req.query;
    const activities = await MemberService.getMyActivities({
      memberId: req.auth.id,
      cooperativeId: req.auth.cooperativeId,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      type,
    });
    return successResponse(res, activities);
  });

  // ===== LOAN REQUESTS =====
  static requestLoan = catchAsync(async (req, res) => {
    const result = await MemberService.requestLoan({
      memberId: req.auth.id,
      cooperativeId: req.auth.cooperativeId,
      loanData: req.body,
    });
    return successResponse(res, result);
  });

  static getMyLoans = catchAsync(async (req, res) => {
    const { page, limit, status } = req.query;
    const loans = await MemberService.getMyLoans({
      memberId: req.auth.id,
      cooperativeId: req.auth.cooperativeId,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      status,
    });
    return successResponse(res, loans);
  });

  // ===== ASSET INVESTMENT =====
  static buyAsset = catchAsync(async (req, res) => {
    const { assetId, quantity, amount, currency, email } = req.body;
    const result = await MemberService.buyAsset({
      memberId: req.auth.id,
      cooperativeId: req.auth.cooperativeId,
      assetId,
      quantity,
      amount,
      currency,
      email,
    });
    return successResponse(res, result);
  });

  static getMyAssets = catchAsync(async (req, res) => {
    const { page, limit } = req.query;
    const assets = await MemberService.getMyAssets({
      memberId: req.auth.id,
      cooperativeId: req.auth.cooperativeId,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
    });
    return successResponse(res, assets);
  });

  static getAvailableAssets = catchAsync(async (req, res) => {
    const { page, limit } = req.query;
    const assets = await MemberService.getAvailableAssets({
      cooperativeId: req.auth.cooperativeId,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
    });
    return successResponse(res, assets);
  });

  // ===== WITHDRAWAL REQUESTS =====
  static requestWithdrawal = catchAsync(async (req, res) => {
    const { amount, withdrawalType, assetId, currency, reason } = req.body;
    const result = await MemberService.requestWithdrawal({
      memberId: req.auth.id,
      cooperativeId: req.auth.cooperativeId,
      amount,
      withdrawalType,
      assetId,
      currency,
      reason,
    });
    return successResponse(res, result);
  });

  static getMyWithdrawals = catchAsync(async (req, res) => {
    const { page, limit, status } = req.query;
    const withdrawals = await MemberService.getMyWithdrawals({
      memberId: req.auth.id,
      cooperativeId: req.auth.cooperativeId,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      status,
    });
    return successResponse(res, withdrawals);
  });

  // ===== CONTRIBUTION =====
  static contribute = catchAsync(async (req, res) => {
    const { amount, currency, email } = req.body;
    const result = await MemberService.contribute({
      memberId: req.auth.id,
      cooperativeId: req.auth.cooperativeId,
      amount,
      currency,
      email,
    });
    return successResponse(res, result);
  });

  // ===== ASSET REDEMPTION =====
  static requestAssetRedemption = catchAsync(async (req, res) => {
    const { assetId, quantity, reason, currency } = req.body;
    const result = await MemberService.requestAssetRedemption({
      memberId: req.auth.id,
      cooperativeId: req.auth.cooperativeId,
      assetId,
      quantity,
      reason,
      currency,
    });
    return successResponse(res, result);
  });

  static getMyAssetRedemptions = catchAsync(async (req, res) => {
    const { page, limit, status } = req.query;
    const redemptions = await MemberService.getMyAssetRedemptions({
      memberId: req.auth.id,
      cooperativeId: req.auth.cooperativeId,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      status,
    });
    return successResponse(res, redemptions);
  });

  static getAssetRedemptionStats = catchAsync(async (req, res) => {
    const result = await MemberService.getAssetRedemptionStats({
      memberId: req.auth.id,
      cooperativeId: req.auth.cooperativeId,
    });
    return successResponse(res, result);
  });

  // ===== BANK MANAGEMENT =====
  static listBanks = catchAsync(async (req, res) => {
    const result = await BankService.listBanks();
    return successResponse(res, result);
  });

  static resolveBankAccount = catchAsync(async (req, res) => {
    const { accountNumber, bankCode } = req.body;
    const result = await BankService.resolveBankAccount({
      accountNumber,
      bankCode,
    });
    return successResponse(res, result);
  });

  static addBankAccount = catchAsync(async (req, res) => {
    const result = await BankService.addBankToMember({
      memberId: req.auth.id,
      bankData: req.body,
    });
    return successResponse(res, result);
  });

  static getMyBank = catchAsync(async (req, res) => {
    const result = await BankService.getMemberBank({
      memberId: req.auth.id,
    });
    return successResponse(res, result);
  });

  static updateMyBank = catchAsync(async (req, res) => {
    const result = await BankService.updateMemberBank({
      memberId: req.auth.id,
      bankData: req.body,
    });
    return successResponse(res, result);
  });

  static deleteMyBank = catchAsync(async (req, res) => {
    const result = await BankService.deleteMemberBank({
      memberId: req.auth.id,
    });
    return successResponse(res, result);
  });
}

module.exports = MemberController;
