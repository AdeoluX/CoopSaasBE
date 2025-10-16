const MemberRepo = require("../repo/member.repo");
const AssetsRepo = require("../repo/assets.repo");
const LoanRepo = require("../repo/loan.repo");
const AssetUserRepo = require("../repo/assetUser.repo");
const ActivityRepo = require("../repo/activity.repo");
const { v4: uuidv4 } = require("uuid");
const { initiateTransaction } = require("../utils/paystack.utils");
const { abortIf } = require("../utils/responder");
const httpStatus = require("http-status");
const TransactionRepo = require("../repo/transaction.repo");
const WalletRepo = require("../repo/wallet.repo");
const mongoose = require("mongoose");

class UserService {
  static me = async ({ auth: { id } }) => {
    const user = await MemberRepo.findOne({
      query: { _id: id },
      populate: ["wallets", { path: "cooperativeId", select: "name code" }],
    });
    return user;
  };

  static contribute = async ({
    auth: { id },
    amount,
    currency = "NGN",
    assetId = null,
  }) => {
    try {
      const user = await MemberRepo.findOne({
        query: { _id: id },
        populate: [{ path: "cooperativeId", select: "name code" }],
      });
      abortIf(!user, httpStatus.NOT_FOUND, "User not found");

      //get the wallet
      let wallet = await WalletRepo.findOne({
        query: { member: id, assetId: assetId || null },
      });

      //create a wallet if it doesn't exist
      if (!wallet) {
        const newWallet = await WalletRepo.create({
          member: id,
          assetId: assetId || null,
          cooperativeId: user.cooperativeId,
          currency: currency, // ✅ Add currency to wallet creation
        });
        wallet = newWallet;

        // Log activity for wallet creation
        await ActivityRepo.logActivity({
          type: "wallet_created",
          category: "wallet", // ✅ Explicitly set category
          member: id,
          cooperativeId: user.cooperativeId._id,
          status: "success",
          title: "Wallet Created",
          description: `New wallet created for ${currency} currency${
            assetId ? " with specific asset" : " for general contributions"
          }`,
          metadata: {
            currency,
            assetId: assetId || null,
            walletId: newWallet._id,
          },
          relatedEntities: {
            wallet: newWallet._id,
          },
        });
      }

      const reference = `CNT-${uuidv4().split("-").join("")}`;

      // Create transaction record (pending status)
      const contribution = await TransactionRepo.create({
        member: id,
        cooperativeId: user.cooperativeId._id,
        amount,
        type: "CR",
        descriptions: `Contribution to ${user.cooperativeId.name}`,
        currency,
        reference,
        status: "pending", // Set as pending initially
        assetId: assetId || null, // Store the assetId for wallet lookup in webhook
      });

      // Log activity for transaction initiation
      await ActivityRepo.logTransactionActivity(
        "transaction_initiated",
        id,
        user.cooperativeId._id,
        contribution._id,
        {
          amount,
          currency,
          type: "CR",
          reference,
          descriptions: `Contribution to ${user.cooperativeId.name}`,
          assetId: assetId || null,
        }
      );

      // Initiate payment transaction
      const transaction = await initiateTransaction({
        amount,
        email: user.email,
        reference,
        metadata: {
          contribution: contribution._id,
          wallet: wallet._id,
        },
      });

      return {
        ...transaction.data,
        contribution: contribution,
      };
    } catch (error) {
      // If any error occurs, we don't need to rollback since we're not using transactions
      // The webhook will handle the wallet updates when payment is confirmed
      throw error;
    }
  };

  static myTransaction = async ({
    auth: { id },
    paginateOptions,
    search,
    dateFilter,
  }) => {
    const { startDate, endDate } = dateFilter;
    const transactions = await TransactionRepo.paginate({
      query: {
        member: id,
        ...(search && {
          $or: [
            { descriptions: { $regex: search, $options: "i" } },
            { reference: { $regex: search, $options: "i" } },
          ],
        }),
        ...(startDate && { createdAt: { $gte: new Date(startDate) } }),
        ...(endDate && { createdAt: { $lte: new Date(endDate) } }),
      },
      ...paginateOptions,
      sort: { createdAt: -1 },
    });
    return transactions;
  };

  static stats = async ({ auth: { id } }) => {
    // Get member's cooperative ID
    const member = await MemberRepo.findOne({
      query: { _id: id },
      select: "cooperativeId",
    });
    if (!member) {
      throw new Error("Member not found");
    }

    const cooperativeId = member.cooperativeId;

    // Aggregate pipeline for comprehensive stats
    const stats = await MemberRepo.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(id) } },
      {
        $lookup: {
          from: "wallets",
          localField: "_id",
          foreignField: "member",
          as: "wallets",
        },
      },
      {
        $lookup: {
          from: "loans",
          localField: "_id",
          foreignField: "member",
          as: "loans",
        },
      },
      {
        $lookup: {
          from: "transactions",
          localField: "_id",
          foreignField: "member",
          as: "transactions",
        },
      },
      {
        $lookup: {
          from: "assetusers",
          localField: "_id",
          foreignField: "member",
          as: "assetHoldings",
        },
      },
      {
        $project: {
          _id: 1,
          wallets: 1,
          loans: 1,
          transactions: 1,
          assetHoldings: 1,
        },
      },
      {
        $addFields: {
          // Total wallet balance (all currencies)
          totalWalletBalance: {
            $sum: "$wallets.ledger_balance",
          },
          // Total number of loans
          totalLoans: { $size: "$loans" },
          // Active loans count
          activeLoans: {
            $size: {
              $filter: {
                input: "$loans",
                cond: { $eq: ["$$this.status", "active"] },
              },
            },
          },
          // Pending loans count
          pendingLoans: {
            $size: {
              $filter: {
                input: "$loans",
                cond: { $eq: ["$$this.status", "pending"] },
              },
            },
          },
          // Total loan amount borrowed
          totalLoanAmount: {
            $sum: "$loans.amount",
          },
          // Total outstanding loan balance
          totalOutstandingLoans: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: "$loans",
                    cond: { $in: ["$$this.status", ["active", "approved"]] },
                  },
                },
                as: "loan",
                in: "$$loan.remainingBalance",
              },
            },
          },
          // Total investments (contributions)
          totalInvestments: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: "$transactions",
                    cond: { $eq: ["$$this.type", "CR"] },
                  },
                },
                as: "transaction",
                in: {
                  $cond: {
                    if: { $eq: ["$$transaction.status", "success"] },
                    then: "$$transaction.amount",
                    else: 0,
                  },
                },
              },
            },
          },
          // Total withdrawals
          totalWithdrawals: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: "$transactions",
                    cond: { $eq: ["$$this.type", "DR"] },
                  },
                },
                as: "transaction",
                in: {
                  $cond: {
                    if: { $eq: ["$$transaction.status", "success"] },
                    then: "$$transaction.amount",
                    else: 0,
                  },
                },
              },
            },
          },
          // Asset holdings statistics
          totalAssetHoldings: { $size: "$assetHoldings" },
          activeAssetHoldings: {
            $size: {
              $filter: {
                input: "$assetHoldings",
                cond: { $eq: ["$$this.status", "active"] },
              },
            },
          },
          totalAssetInvested: {
            $sum: "$assetHoldings.totalInvested",
          },
        },
      },
      {
        $project: {
          _id: 1,
          totalWalletBalance: { $ifNull: ["$totalWalletBalance", 0] },
          totalLoans: { $ifNull: ["$totalLoans", 0] },
          activeLoans: { $ifNull: ["$activeLoans", 0] },
          pendingLoans: { $ifNull: ["$pendingLoans", 0] },
          totalLoanAmount: { $ifNull: ["$totalLoanAmount", 0] },
          totalOutstandingLoans: { $ifNull: ["$totalOutstandingLoans", 0] },
          totalInvestments: { $ifNull: ["$totalInvestments", 0] },
          totalWithdrawals: { $ifNull: ["$totalWithdrawals", 0] },
          totalAssetHoldings: { $ifNull: ["$totalAssetHoldings", 0] },
          activeAssetHoldings: { $ifNull: ["$activeAssetHoldings", 0] },
          totalAssetInvested: { $ifNull: ["$totalAssetInvested", 0] },
        },
      },
    ]);

    // Get total number of assets in the cooperative
    const totalAssets = await AssetsRepo.countDocuments({ cooperativeId });

    // Get wallet balances by currency
    const walletBalances = await WalletRepo.aggregate([
      { $match: { member: new mongoose.Types.ObjectId(id) } },
      {
        $group: {
          _id: "$currency",
          balance: { $sum: "$ledger_balance" },
        },
      },
    ]);

    // Format wallet balances
    const formattedWalletBalances = {};
    walletBalances.forEach((wallet) => {
      formattedWalletBalances[wallet._id] = wallet.balance;
    });

    // Get loan statistics
    const loanStats = await LoanRepo.aggregate([
      { $match: { member: new mongoose.Types.ObjectId(id) } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          totalOutstanding: { $sum: "$remainingBalance" },
        },
      },
    ]);

    // Get asset holdings with populated asset data for current value calculations
    const assetHoldings = await AssetUserRepo.findAll({
      query: { member: id, status: "active" },
      populate: "asset",
    });

    // Calculate total current value of asset holdings
    const totalAssetCurrentValue = assetHoldings.reduce((total, holding) => {
      return total + (holding.currentValue || 0);
    }, 0);

    // Calculate total profit/loss from asset holdings
    const totalAssetProfitLoss = assetHoldings.reduce((total, holding) => {
      return total + (holding.profitLoss || 0);
    }, 0);

    // Format loan statistics
    const formattedLoanStats = {
      pending: { count: 0, totalAmount: 0, totalOutstanding: 0 },
      approved: { count: 0, totalAmount: 0, totalOutstanding: 0 },
      active: { count: 0, totalAmount: 0, totalOutstanding: 0 },
      completed: { count: 0, totalAmount: 0, totalOutstanding: 0 },
      defaulted: { count: 0, totalAmount: 0, totalOutstanding: 0 },
      rejected: { count: 0, totalAmount: 0, totalOutstanding: 0 },
    };

    loanStats.forEach((stat) => {
      formattedLoanStats[stat._id] = {
        count: stat.count,
        totalAmount: stat.totalAmount,
        totalOutstanding: stat.totalOutstanding,
      };
    });

    const result = stats[0] || {
      totalWalletBalance: 0,
      totalLoans: 0,
      activeLoans: 0,
      pendingLoans: 0,
      totalLoanAmount: 0,
      totalOutstandingLoans: 0,
      totalInvestments: 0,
      totalWithdrawals: 0,
      totalAssetHoldings: 0,
      activeAssetHoldings: 0,
      totalAssetInvested: 0,
    };

    return {
      // Wallet and Balance Information
      walletBalance: {
        total: result.totalWalletBalance || 0,
        byCurrency: formattedWalletBalances,
      },

      // Asset Information
      assets: {
        total: totalAssets || 0,
        holdings: {
          total: result.totalAssetHoldings || 0,
          active: result.activeAssetHoldings || 0,
          totalInvested: result.totalAssetInvested || 0,
          currentValue: totalAssetCurrentValue || 0,
          profitLoss: totalAssetProfitLoss || 0,
        },
      },

      // Loan Information
      loans: {
        total: result.totalLoans || 0,
        active: result.activeLoans || 0,
        pending: result.pendingLoans || 0,
        totalAmount: result.totalLoanAmount || 0,
        outstandingBalance: result.totalOutstandingLoans || 0,
        byStatus: formattedLoanStats,
      },

      // Investment Information
      investments: {
        total: result.totalInvestments || 0,
        withdrawals: result.totalWithdrawals || 0,
        netInvestment:
          (result.totalInvestments || 0) - (result.totalWithdrawals || 0),
      },

      // Summary
      summary: {
        totalAssets: totalAssets || 0,
        totalLoans: result.totalLoans || 0,
        totalWalletBalance: result.totalWalletBalance || 0,
        totalInvestments: result.totalInvestments || 0,
        totalAssetHoldings: result.totalAssetHoldings || 0,
        totalAssetValue: totalAssetCurrentValue || 0,
      },
    };
  };

  static myPortfolio = async ({ auth: { id }, assetId }) => {
    const portfolio = await WalletRepo.findOne({
      query: { member: id, assetId: assetId || null },
    });
    return portfolio;
  };

  static myActivities = async ({
    auth: { id },
    limit = 10,
    category,
    type,
    status,
  }) => {
    // Use ActivityRepo instead of direct model access
    const options = {
      limit: parseInt(limit),
      category,
      type,
      status,
    };

    const result = await ActivityRepo.getMemberActivityFeed(id, options);

    // Format activities for response
    const formattedActivities = result.data.map((activity) => ({
      id: activity._id,
      type: activity.type,
      category: activity.category,
      status: activity.status,
      title: activity.title,
      description: activity.description,
      metadata: activity.metadata,
      severity: activity.severity,
      createdAt: activity.createdAt,
      timeAgo: activity.timeAgo,
      relatedEntities: activity.relatedEntities,
    }));

    return {
      activities: formattedActivities,
      total: result.pagination.total,
      limit: parseInt(limit),
      pagination: result.pagination,
    };
  };
}

module.exports = UserService;
