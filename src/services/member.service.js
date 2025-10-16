const LoanRepo = require("../repo/loan.repo");
const MemberRepo = require("../repo/member.repo");
const AssetUserRepo = require("../repo/assetUser.repo");
const AssetRedemptionRepo = require("../repo/assetRedemption.repo");
const WalletRepo = require("../repo/wallet.repo");
const TransactionRepo = require("../repo/transaction.repo");
const AssetsRepo = require("../repo/assets.repo");
const CooperativeRepo = require("../repo/cooperative.repo");
const ActivityRepo = require("../repo/activity.repo");
const WithdrawalRepo = require("../repo/withdrawal.repo");
const { abortIf } = require("../utils/responder");
const httpStatus = require("http-status");
const mongoose = require("mongoose");

// Helper function to properly handle errors
const handleServiceError = (error, operation) => {
  // If it's already an HTTP error (has statusCode), re-throw it
  if (error.statusCode) {
    throw error;
  }
  // Otherwise, wrap it in a generic error
  throw new Error(`Failed to ${operation}: ${error.message}`);
};

class MemberService {
  // ===== LOAN REQUESTS =====
  static async requestLoan({ memberId, cooperativeId, loanData }) {
    try {
      // Get cooperative settings for loan validation
      const cooperative = await CooperativeRepo.findById(cooperativeId);
      abortIf(!cooperative, httpStatus.NOT_FOUND, "Cooperative not found");

      const {
        loanType,
        amount,
        term,
        termUnit = "months",
        purpose,
        collateral,
        guarantor,
        disbursementMethod = "wallet",
        disbursementDetails,
        currency = "NGN",
      } = loanData;

      // Validate loan amount against cooperative settings
      const loanSettings = cooperative.settings.loans;
      abortIf(
        amount < loanSettings.min_loan_amount,
        httpStatus.BAD_REQUEST,
        `Minimum loan amount is ${loanSettings.min_loan_amount}`
      );
      abortIf(
        amount > loanSettings.max_loan_amount,
        httpStatus.BAD_REQUEST,
        `Maximum loan amount is ${loanSettings.max_loan_amount}`
      );

      // Validate loan term against cooperative settings
      const termInMonths =
        term *
        (termUnit === "months"
          ? 1
          : termUnit === "years"
          ? 12
          : termUnit === "weeks"
          ? 1 / 4
          : 1 / 30);
      abortIf(
        termInMonths < loanSettings.min_loan_term,
        httpStatus.BAD_REQUEST,
        `Minimum loan term is ${loanSettings.min_loan_term} months`
      );
      abortIf(
        termInMonths > loanSettings.max_loan_term,
        httpStatus.BAD_REQUEST,
        `Maximum loan term is ${loanSettings.max_loan_term} months`
      );

      // Validate collateral requirement
      if (loanSettings.requires_collateral && !collateral) {
        abortIf(
          true,
          httpStatus.BAD_REQUEST,
          "Collateral is required for this loan type"
        );
      }

      // Validate guarantor requirement
      if (loanSettings.requires_guarantor && !guarantor) {
        abortIf(
          true,
          httpStatus.BAD_REQUEST,
          "Guarantor is required for this loan type"
        );
      }

      // Get interest rate from cooperative settings based on loan type
      let interestRate;
      switch (loanType) {
        case "personal":
          interestRate = loanSettings.personal_interest_rate;
          break;
        case "business":
          interestRate = loanSettings.business_interest_rate;
          break;
        case "emergency":
          interestRate = loanSettings.emergency_interest_rate;
          break;
        case "investment":
          interestRate = loanSettings.investment_interest_rate;
          break;
        default:
          abortIf(true, httpStatus.BAD_REQUEST, "Invalid loan type");
      }

      // Calculate monthly payment
      const monthlyInterestRate = interestRate / 100 / 12;
      const numberOfPayments =
        term *
        (termUnit === "months"
          ? 1
          : termUnit === "years"
          ? 12
          : termUnit === "weeks"
          ? 1 / 4
          : 1 / 30);
      const monthlyPayment =
        (amount *
          monthlyInterestRate *
          Math.pow(1 + monthlyInterestRate, numberOfPayments)) /
        (Math.pow(1 + monthlyInterestRate, numberOfPayments) - 1);

      const totalInterest = Math.round(
        monthlyPayment * numberOfPayments - amount
      );
      const totalAmount = amount + totalInterest;

      const loan = await LoanRepo.create({
        member: memberId,
        cooperativeId,
        loanType,
        amount,
        interestRate,
        term,
        termUnit,
        purpose,
        collateral,
        guarantor,
        disbursementMethod,
        disbursementDetails,
        currency,
        monthlyPayment: Math.round(monthlyPayment),
        totalInterest: totalInterest,
        totalAmount: totalAmount,
        remainingBalance: totalAmount,
      });

      return {
        message: "Loan request submitted successfully",
        loan: {
          id: loan._id,
          amount: loan.amount,
          purpose: loan.purpose,
          status: loan.status,
          monthlyPayment: loan.monthlyPayment,
          totalInterest: loan.totalInterest,
        },
      };
    } catch (error) {
      handleServiceError(error, "request loan");
    }
  }

  static async getMyLoans({
    memberId,
    cooperativeId,
    page = 1,
    limit = 10,
    status,
  }) {
    try {
      let query = { member: memberId, cooperativeId };
      if (status) {
        query.status = status;
      }

      const loans = await LoanRepo.paginate({
        query,
        page,
        limit,
        sort: { createdAt: -1 },
      });

      return loans;
    } catch (error) {
      handleServiceError(error, "get loans");
    }
  }

  // ===== ASSET INVESTMENT =====
  static async buyAsset({
    memberId,
    cooperativeId,
    assetId,
    quantity,
    amount,
    currency = "NGN",
    email,
  }) {
    try {
      // Get asset details
      const asset = await AssetsRepo.findById(assetId);
      abortIf(!asset, httpStatus.NOT_FOUND, "Asset not found");
      abortIf(
        asset.cooperativeId.toString() !== cooperativeId,
        httpStatus.FORBIDDEN,
        "Asset not found in this cooperative"
      );

      // Calculate quantity from amount if not provided, or use provided quantity
      let calculatedQuantity, calculatedTotalAmount;

      if (amount && !quantity) {
        // Frontend sent amount, calculate quantity
        calculatedQuantity = Math.floor(amount / asset.settings.pricePerUnit);
        calculatedTotalAmount = amount;
      } else if (quantity && !amount) {
        // Frontend sent quantity, calculate total amount
        calculatedQuantity = quantity;
        calculatedTotalAmount = quantity * asset.settings.pricePerUnit;
      } else if (amount && quantity) {
        // Both provided, use amount as total
        calculatedQuantity = quantity;
        calculatedTotalAmount = amount;
      } else {
        abortIf(
          true,
          httpStatus.BAD_REQUEST,
          "Either amount or quantity must be provided"
        );
      }

      // Validate against cooperative asset settings
      const cooperative = await CooperativeRepo.findById(cooperativeId);
      const assetSettings = cooperative.settings.assets;

      abortIf(
        calculatedTotalAmount < asset.settings.minAmount,
        httpStatus.BAD_REQUEST,
        `Minimum investment amount is ${asset.settings.minAmount}`
      );
      abortIf(
        calculatedTotalAmount < assetSettings.min_investment,
        httpStatus.BAD_REQUEST,
        `Minimum investment amount is ${assetSettings.min_investment}`
      );
      abortIf(
        calculatedTotalAmount > assetSettings.max_investment,
        httpStatus.BAD_REQUEST,
        `Maximum investment amount is ${assetSettings.max_investment}`
      );

      // Get member details for payment
      const member = await MemberRepo.findById(memberId);
      abortIf(!member, httpStatus.NOT_FOUND, "Member not found");

      // Create transaction reference
      const reference = `ASSET-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      // Create pending transaction record
      const transaction = await TransactionRepo.create({
        member: memberId,
        cooperativeId,
        amount: calculatedTotalAmount,
        type: "DR",
        descriptions: `Asset purchase: ${asset.name} (${calculatedQuantity} units)`,
        currency,
        reference,
        status: "pending", // Will be updated by webhook
        assetId,
        metadata: {
          assetId: assetId.toString(),
          quantity: calculatedQuantity,
          assetName: asset.name,
          pricePerUnit: asset.settings.pricePerUnit,
        },
      });

      // Initialize Paystack payment
      const paystackUtils = require("../utils/paystack.utils");
      const paymentResult = await paystackUtils.initiateTransaction({
        amount: calculatedTotalAmount,
        email: email || member.email,
        reference,
        callback_url: `${
          (process.env.BACKEND_URL &&
            `${process.env.ENV === "production" ? "https" : "http"}://${
              process.env.BACKEND_URL
            }`) ||
          "http://localhost:3004"
        }/api/v1/webhook/paystack/webhook`,
        metadata: {
          transactionId: transaction._id.toString(),
          memberId: memberId.toString(),
          cooperativeId: cooperativeId.toString(),
          assetId: assetId.toString(),
          quantity,
          type: "asset_purchase",
        },
      });

      if (!paymentResult.success) {
        // Delete the transaction if payment initiation fails
        await TransactionRepo.delete(transaction._id);
        abortIf(
          true,
          httpStatus.BAD_REQUEST,
          `Payment initiation failed: ${paymentResult.error}`
        );
      }

      return {
        success: true,
        message: "Payment initiated successfully",
        transaction: {
          id: transaction._id,
          reference: transaction.reference,
          amount: transaction.amount,
          asset: asset.name,
          quantity,
          totalAmount: calculatedTotalAmount,
        },
        payment: {
          authorization_url: paymentResult.authorization_url,
          access_code: paymentResult.access_code,
          reference: paymentResult.reference,
        },
      };
    } catch (error) {
      handleServiceError(error, "initiate asset purchase");
    }
  }

  static async getMyAssets({ memberId, cooperativeId, page = 1, limit = 10 }) {
    try {
      const portfolio = await AssetUserRepo.getMemberPortfolio(memberId, {
        page,
        limit,
        status: "active",
      });

      return portfolio;
    } catch (error) {
      handleServiceError(error, "get assets");
    }
  }

  static async getAvailableAssets({ cooperativeId, page = 1, limit = 10 }) {
    try {
      // Get only published assets for members
      const assets = await AssetsRepo.paginate({
        query: { cooperativeId, status: "published" },
        page,
        limit,
        sort: { createdAt: -1 },
      });

      // Get asset wallets for balance information
      const assetWallets = await WalletRepo.findAll({
        query: { cooperativeId, walletType: "asset" },
      });

      const assetsWithBalances = assets.data.map((asset) => {
        const assetWallet = assetWallets.find(
          (wallet) =>
            wallet.assetId && wallet.assetId.toString() === asset._id.toString()
        );
        return {
          ...asset.toJSON(),
          walletBalance: assetWallet ? assetWallet.ledger_balance : 0,
        };
      });

      return {
        ...assets,
        data: assetsWithBalances,
      };
    } catch (error) {
      handleServiceError(error, "get available assets");
    }
  }

  // ===== MEMBER PROFILE =====
  static async getMyProfile({ memberId, cooperativeId }) {
    try {
      const member = await MemberRepo.findById(memberId);
      abortIf(!member, httpStatus.NOT_FOUND, "Member not found");

      // Get member's wallet balance (member wallet for individual member balance)
      const wallet = await WalletRepo.findOne({
        query: { member: memberId, cooperativeId, walletType: "member" },
      });

      // Get member's bank information
      let bank = null;
      if (member.bank) {
        const BankRepo = require("../repo/bank.repo");
        bank = await BankRepo.findById(member.bank);
      }

      return {
        member: {
          id: member._id,
          firstname: member.firstname,
          lastname: member.lastname,
          email: member.email,
          phone: member.phone,
          role: member.role,
          cooperativeId: member.cooperativeId,
          tier: member.tier,
          status: member.status,
          createdAt: member.createdAt,
        },
        wallet: wallet
          ? {
              id: wallet._id,
              balance: wallet.ledger_balance,
              currency: wallet.currency,
            }
          : null,
        bank: bank
          ? {
              id: bank._id,
              bankCode: bank.bankCode,
              bankName: bank.bankName,
              accountNumber: bank.accountNumber,
              nameOnAccount: bank.nameOnAccount,
              isVerified: bank.isVerified,
              createdAt: bank.createdAt,
              updatedAt: bank.updatedAt,
            }
          : null,
      };
    } catch (error) {
      throw new Error(`Failed to get member profile: ${error.message}`);
    }
  }

  // ===== TRANSACTIONS =====
  static async getMyTransactions({
    memberId,
    cooperativeId,
    page = 1,
    limit = 10,
    type,
    status,
  }) {
    try {
      let query = { member: memberId, cooperativeId };

      if (type) {
        if (type === "all") {
          query.type = ["CR", "DR"];
        } else {
          query.type = type;
        }
      } else {
        query.type = ["CR", "DR"];
      }

      if (status) {
        if (status === "all") {
          query.status = ["success", "pending", "failed"];
        } else {
          query.status = status;
        }
      } else {
        query.status = ["success", "pending", "failed"];
      }

      const transactions = await TransactionRepo.findAll({
        query,
        page,
        limit,
        populate: "assetId",
        sort: { createdAt: -1 },
      });

      return transactions;
    } catch (error) {
      throw new Error(`Failed to get member transactions: ${error.message}`);
    }
  }

  // ===== PORTFOLIO & STATS =====
  static async getMyPortfolio({ memberId, cooperativeId }) {
    try {
      // Get member's asset holdings
      const assets = await AssetUserRepo.getMemberPortfolio(memberId, {
        page: 1,
        limit: 100, // Get all assets
        status: "active",
      });

      // Get member's wallet (member wallet for individual member balance)
      const wallet = await WalletRepo.findOne({
        query: { member: memberId, cooperativeId, walletType: "member" },
      });

      // Ensure we have the assets data
      const assetsArray = assets?.data || [];

      // Calculate total portfolio value
      const totalAssetValue = assetsArray.reduce((sum, asset) => {
        return sum + (asset.totalInvestment || 0);
      }, 0);

      const totalPortfolioValue =
        totalAssetValue + (wallet?.ledger_balance || 0);

      return {
        totalPortfolioValue,
        totalAssetValue,
        walletBalance: wallet?.ledger_balance || 0,
        assets: assetsArray,
        assetCount: assetsArray.length,
      };
    } catch (error) {
      throw new Error(`Failed to get member portfolio: ${error.message}`);
    }
  }

  static async getMyStats({ memberId, cooperativeId }) {
    try {
      // Get member's transactions
      const transactions = await TransactionRepo.findAll({
        query: { member: memberId, cooperativeId },
      });

      // Get member's loans
      const loans = await LoanRepo.findAll({
        query: { member: memberId, cooperativeId },
      });

      // Get member's assets
      const assets = await AssetUserRepo.getMemberPortfolio(memberId, {
        page: 1,
        limit: 1000, // Get all assets for stats
        status: "active",
      });

      // Ensure we have arrays to work with
      const transactionsArray = Array.isArray(transactions) ? transactions : [];
      const loansArray = Array.isArray(loans) ? loans : [];
      const assetsArray = assets?.data || [];

      // Calculate stats
      const totalContributions = transactionsArray
        .filter((t) => t.type === "CR" && t.status === "success")
        .reduce((sum, t) => sum + t.amount, 0);

      const totalWithdrawals = transactionsArray
        .filter((t) => t.type === "DR" && t.status === "success")
        .reduce((sum, t) => sum + t.amount, 0);

      const totalAssetInvestment = assetsArray.reduce((sum, asset) => {
        return sum + (asset.totalInvestment || 0);
      }, 0);

      const activeLoans = loansArray.filter(
        (loan) => loan.status === "approved"
      );
      const pendingLoans = loansArray.filter(
        (loan) => loan.status === "pending"
      );

      return {
        totalContributions,
        totalWithdrawals,
        totalAssetInvestment,
        totalTransactions: transactionsArray.length,
        activeLoans: activeLoans.length,
        pendingLoans: pendingLoans.length,
        totalAssets: assetsArray.length,
        netWorth: totalContributions - totalWithdrawals + totalAssetInvestment,
        // Additional fields for Flutter app compatibility
        totalBalance:
          totalContributions - totalWithdrawals + totalAssetInvestment, // Same as netWorth
        investments: totalAssetInvestment,
        cooperatives: 1, // Member belongs to 1 cooperative (current cooperative)
        walletBalance: 0, // Will be calculated separately if needed
      };
    } catch (error) {
      throw new Error(`Failed to get member stats: ${error.message}`);
    }
  }

  // ===== ACTIVITIES =====
  static async getMyActivities({
    memberId,
    cooperativeId,
    page = 1,
    limit = 10,
    type,
  }) {
    try {
      let query = { member: memberId, cooperativeId };

      if (type) query.type = type;

      const activities = await ActivityRepo.findAll({
        query,
        page,
        limit,
        sort: { createdAt: -1 },
      });

      return activities;
    } catch (error) {
      throw new Error(`Failed to get member activities: ${error.message}`);
    }
  }

  // ===== WITHDRAWAL REQUESTS =====
  static async requestWithdrawal({
    memberId,
    cooperativeId,
    amount,
    withdrawalType,
    assetId,
    currency = "NGN",
    reason,
  }) {
    try {
      // Get cooperative settings for withdrawal validation
      const cooperative = await CooperativeRepo.findById(cooperativeId);
      abortIf(!cooperative, httpStatus.NOT_FOUND, "Cooperative not found");

      // Validate withdrawal type
      abortIf(
        !["contribution", "asset"].includes(withdrawalType),
        httpStatus.BAD_REQUEST,
        "Invalid withdrawal type. Must be 'contribution' or 'asset'"
      );

      // Validate amount
      abortIf(
        amount <= 0,
        httpStatus.BAD_REQUEST,
        "Amount must be greater than 0"
      );

      if (withdrawalType === "contribution") {
        // Check member's wallet balance
        const memberWallet = await WalletRepo.findOne({
          query: { member: memberId, cooperativeId },
        });
        abortIf(!memberWallet, httpStatus.NOT_FOUND, "Member wallet not found");
        abortIf(
          memberWallet.ledger_balance < amount,
          httpStatus.BAD_REQUEST,
          "Insufficient balance in your wallet"
        );
      } else if (withdrawalType === "asset") {
        // Validate asset exists and member has holdings
        abortIf(
          !assetId,
          httpStatus.BAD_REQUEST,
          "Asset ID is required for asset withdrawals"
        );

        const asset = await AssetsRepo.findById(assetId);
        abortIf(!asset, httpStatus.NOT_FOUND, "Asset not found");
        abortIf(
          asset.cooperativeId.toString() !== cooperativeId,
          httpStatus.FORBIDDEN,
          "Asset not found in this cooperative"
        );

        // Check member's asset holdings
        const assetUser = await AssetUserRepo.findOne({
          query: { member: memberId, asset: assetId, cooperativeId },
        });
        abortIf(!assetUser, httpStatus.NOT_FOUND, "No asset holdings found");
        abortIf(
          assetUser.totalInvestment < amount,
          httpStatus.BAD_REQUEST,
          "Insufficient asset investment balance"
        );
      }

      // Get member details
      const member = await MemberRepo.findById(memberId);
      abortIf(!member, httpStatus.NOT_FOUND, "Member not found");

      // Create withdrawal request
      const withdrawal = await WithdrawalRepo.create({
        member: memberId,
        cooperativeId,
        amount,
        withdrawalType,
        assetId: withdrawalType === "asset" ? assetId : null,
        currency,
        reason,
        status: "pending",
        requestedAt: new Date(),
      });

      return {
        success: true,
        message: "Withdrawal request submitted successfully",
        withdrawal: {
          id: withdrawal._id,
          amount: withdrawal.amount,
          withdrawalType: withdrawal.withdrawalType,
          assetId: withdrawal.assetId,
          reason: withdrawal.reason,
          status: withdrawal.status,
          requestedAt: withdrawal.requestedAt,
        },
      };
    } catch (error) {
      handleServiceError(error, "request withdrawal");
    }
  }

  static async getMyWithdrawals({
    memberId,
    cooperativeId,
    page = 1,
    limit = 10,
    status,
  }) {
    try {
      let query = { member: memberId, cooperativeId };

      if (status) query.status = status;

      const withdrawals = await WithdrawalRepo.findAll({
        query,
        page,
        limit,
        populate: "assetId",
        sort: { requestedAt: -1 },
      });

      return withdrawals;
    } catch (error) {
      handleServiceError(error, "get member withdrawals");
    }
  }

  // ===== CONTRIBUTION =====
  static async contribute({
    memberId,
    cooperativeId,
    amount,
    currency = "NGN",
    email,
  }) {
    // Get cooperative settings for contribution validation
    const cooperative = await CooperativeRepo.findById(cooperativeId);
    abortIf(!cooperative, httpStatus.NOT_FOUND, "Cooperative not found");

    const contributionSettings = cooperative.settings.contributions;
    abortIf(
      amount < contributionSettings.min_contribution,
      httpStatus.BAD_REQUEST,
      `Minimum contribution amount is ${contributionSettings.min_contribution}`
    );
    abortIf(
      amount > contributionSettings.max_contribution,
      httpStatus.BAD_REQUEST,
      `Maximum contribution amount is ${contributionSettings.max_contribution}`
    );

    // Get member details for payment
    const member = await MemberRepo.findById(memberId);
    abortIf(!member, httpStatus.NOT_FOUND, "Member not found");

    // Create transaction reference
    const reference = `CONT-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Create pending transaction record
    const transaction = await TransactionRepo.create({
      member: memberId,
      cooperativeId,
      amount,
      type: "CR",
      descriptions: "Contribution to cooperative",
      currency,
      reference,
      status: "pending", // Will be updated by webhook
      metadata: {
        type: "contribution",
        memberId: memberId.toString(),
        cooperativeId: cooperativeId.toString(),
      },
    });

    // Initialize Paystack payment
    const paystackUtils = require("../utils/paystack.utils");
    const paymentResult = await paystackUtils.initiateTransaction({
      amount,
      email: email || member.email,
      reference,
      callback_url: `${
        (process.env.BACKEND_URL &&
          `${process.env.ENV === "production" ? "https" : "http"}://${
            process.env.BACKEND_URL
          }`) ||
        "http://localhost:3004"
      }/api/v1/webhook/paystack/webhook`,
      metadata: {
        transactionId: transaction._id.toString(),
        memberId: memberId.toString(),
        cooperativeId: cooperativeId.toString(),
        type: "contribution",
      },
    });

    if (!paymentResult.success) {
      // Delete the transaction if payment initiation fails
      await TransactionRepo.delete(transaction._id);
      abortIf(
        true,
        httpStatus.BAD_REQUEST,
        `Payment initiation failed: ${paymentResult.error}`
      );
    }

    return {
      success: true,
      message: "Payment initiated successfully",
      transaction: {
        id: transaction._id,
        reference: transaction.reference,
        amount: transaction.amount,
      },
      payment: {
        authorization_url: paymentResult.authorization_url,
        access_code: paymentResult.access_code,
        reference: paymentResult.reference,
      },
    };
  }

  // ===== ASSET REDEMPTION =====
  static async requestAssetRedemption({
    memberId,
    cooperativeId,
    assetId,
    quantity,
    reason,
    currency = "NGN",
  }) {
    try {
      // Get cooperative settings for validation
      const cooperative = await CooperativeRepo.findById(cooperativeId);
      abortIf(!cooperative, httpStatus.NOT_FOUND, "Cooperative not found");

      // Get asset details
      const asset = await AssetsRepo.findById(assetId);
      abortIf(!asset, httpStatus.NOT_FOUND, "Asset not found");
      abortIf(
        asset.cooperativeId.toString() !== cooperativeId,
        httpStatus.FORBIDDEN,
        "Asset not found in this cooperative"
      );

      // Get member's asset holdings
      const assetHolding = await AssetUserRepo.findOne({
        member: memberId,
        asset: assetId,
        cooperativeId,
      });
      abortIf(!assetHolding, httpStatus.NOT_FOUND, "Asset holding not found");
      abortIf(
        assetHolding.quantity < quantity,
        httpStatus.BAD_REQUEST,
        `Insufficient units. You have ${assetHolding.quantity} units, requesting ${quantity}`
      );

      // Calculate redemption amount based on current asset price
      const currentPricePerUnit = asset.settings.pricePerUnit;
      const redemptionAmount = quantity * currentPricePerUnit;

      // Calculate original investment for these units
      const averagePrice = assetHolding.totalInvested / assetHolding.quantity;
      const originalInvestment = quantity * averagePrice;
      const profitLoss = redemptionAmount - originalInvestment;

      // Create redemption request
      const redemption = await AssetRedemptionRepo.create({
        member: memberId,
        asset: assetId,
        cooperativeId,
        quantity,
        redemptionAmount,
        currentPricePerUnit,
        reason,
        currency,
        metadata: {
          originalInvestment,
          profitLoss,
          averagePrice,
        },
      });

      // Log activity
      await ActivityRepo.create({
        member: memberId,
        cooperativeId,
        type: "asset_redemption_requested",
        title: "Asset Redemption Requested",
        description: `Requested redemption of ${quantity} units of ${
          asset.name
        } for ${currency} ${redemptionAmount.toLocaleString()}`,
        category: "asset",
        status: "success",
        metadata: {
          assetId: assetId.toString(),
          quantity,
          redemptionAmount,
          redemptionId: redemption._id.toString(),
        },
      });

      return {
        success: true,
        message: "Asset redemption request submitted successfully",
        redemption: {
          id: redemption._id,
          quantity,
          redemptionAmount,
          currentPricePerUnit,
          status: redemption.status,
          profitLoss,
          profitLossPercentage: (profitLoss / originalInvestment) * 100,
        },
      };
    } catch (error) {
      handleServiceError(error, "request asset redemption");
    }
  }

  static async getMyAssetRedemptions({
    memberId,
    cooperativeId,
    page = 1,
    limit = 10,
    status,
  }) {
    try {
      return await AssetRedemptionRepo.getMemberRedemptions(
        memberId,
        cooperativeId,
        { page, limit, status }
      );
    } catch (error) {
      handleServiceError(error, "get asset redemptions");
    }
  }

  static async getAssetRedemptionStats({ memberId, cooperativeId }) {
    try {
      return await AssetRedemptionRepo.getMemberRedemptionStats(
        memberId,
        cooperativeId
      );
    } catch (error) {
      handleServiceError(error, "get asset redemption stats");
    }
  }
}

module.exports = MemberService;
