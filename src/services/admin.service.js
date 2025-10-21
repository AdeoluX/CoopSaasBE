const MemberRepo = require("../repo/member.repo");
const TransactionRepo = require("../repo/transaction.repo");
const WalletRepo = require("../repo/wallet.repo");
const InvitationRepo = require("../repo/invitation.repo");
const AssetsRepo = require("../repo/assets.repo");
const AssetUserRepo = require("../repo/assetUser.repo");
const AssetRedemptionRepo = require("../repo/assetRedemption.repo");
const LoanRepo = require("../repo/loan.repo");
const CooperativeRepo = require("../repo/cooperative.repo");
const WithdrawalRepo = require("../repo/withdrawal.repo");
const ActivityRepo = require("../repo/activity.repo");
const PlanRepo = require("../repo/plan.repo"); // Added PlanRepo
const AccessControlService = require("./access-control.service");
const fs = require("fs").promises;
const { parse } = require("csv-parse");
const { createReadStream } = require("fs");
const { abortIf } = require("../utils/responder");
const httpStatus = require("http-status");
const sendEmail = require("../utils/email.util");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Helper function to properly handle errors
const handleServiceError = (error, operation) => {
  // If it's already an HTTP error (has statusCode), re-throw it
  if (error.statusCode) {
    throw error;
  }
  // Otherwise, wrap it in a generic error
  throw new Error(`Failed to ${operation}: ${error.message}`);
};

// Utility function to handle transactions gracefully
const executeWithTransaction = async (operation) => {
  try {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const result = await operation(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  } catch (error) {
    // If transaction fails, fall back to non-transactional execution
    console.warn(
      "Transaction failed, falling back to non-transactional execution:",
      error.message
    );
    return await operation(null);
  }
};

// Simple password generator function
const generatePassword = () => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Hash password function
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

class AdminService {
  static async addMembers({ cooperativeId, data, file }) {
    try {
      if (file) {
        // Validate file type
        if (!file.mimetype.includes("csv")) {
          throw new Error("Invalid file type. Please upload a CSV file.");
        }

        // Parse CSV file using streaming
        const jsonArray = await new Promise((resolve, reject) => {
          const results = [];
          createReadStream(file.tempFilePath)
            .pipe(
              parse({
                columns: true,
                skip_empty_lines: true,
                trim: true,
              })
            )
            .on("data", (row) => results.push(row))
            .on("end", () => resolve(results))
            .on("error", (err) =>
              reject(new Error(`CSV parsing failed: ${err.message}`))
            );
        });

        // Validate and prepare bulk data
        const membersData = jsonArray
          .filter((memberData) => {
            const { firstname, email, phone } = memberData;
            // Simple validation - check if required fields exist and are not empty
            return (
              firstname?.trim() &&
              email?.trim() &&
              phone?.trim() &&
              email.includes("@") // Basic email validation
            );
          })
          .map(async (memberData) => {
            const { firstname, email, phone, role, middlename, dob, lastname } =
              memberData;
            const plainPassword = "123456789";
            const hashedPassword = await hashPassword(plainPassword);
            return {
              firstname: firstname.trim(),
              email: email.trim().toLowerCase(),
              phone: phone.trim(),
              role: role?.trim() || "user",
              middlename: middlename?.trim() || "",
              lastname: lastname?.trim() || "",
              dob: dob || null,
              password: hashedPassword, // Hashed password
              cooperativeId,
            };
          });

        const processedMembersData = await Promise.all(membersData);

        if (processedMembersData.length === 0) {
          throw new Error("No valid records found in the CSV file.");
        }

        // Process in chunks with transaction support
        const CHUNK_SIZE = 1000;
        let allCreatedMembers = [];

        for (let i = 0; i < processedMembersData.length; i += CHUNK_SIZE) {
          const chunk = processedMembersData.slice(i, i + CHUNK_SIZE);
          const createdChunk = await MemberRepo.insertMany(chunk);
          allCreatedMembers = allCreatedMembers.concat(createdChunk);
        }

        // Clean up temporary file
        await fs.unlink(file.tempFilePath).catch((err) => {
          console.warn(`Failed to delete temp file: ${err.message}`);
        });

        return {
          message: `Successfully added ${allCreatedMembers.length} members`,
          members: allCreatedMembers,
          totalProcessed: jsonArray.length,
          validRecords: membersData.length,
          skippedRecords: jsonArray.length - membersData.length,
        };
      } else {
        // Handle single member creation
        const { firstname, email, phone, role, middlename, dob, lastname } =
          data;

        // Validate input
        if (
          !firstname?.trim() ||
          !email?.trim() ||
          !phone?.trim() ||
          !email.includes("@")
        ) {
          throw new Error(
            "Invalid input: firstname, email, and phone are required and must be valid."
          );
        }

        const plainPassword = "123456789";
        const hashedPassword = await hashPassword(plainPassword);

        const createMember = await MemberRepo.create({
          firstname: firstname.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          role: role?.trim() || "user",
          middlename: middlename?.trim() || "",
          lastname: lastname?.trim() || "",
          dob: dob || null,
          password: hashedPassword, // Hashed password
          cooperativeId,
        });

        // Send email to member (implementation not shown, assuming handled by MemberRepo or elsewhere)
        return {
          message: "Successfully added single member",
          member: createMember,
        };
      }
    } catch (error) {
      handleServiceError(error, "add members");
    }
  }

  static getAllMembers = async ({
    cooperativeId,
    page,
    limit,
    search,
    sort,
  }) => {
    let query = { cooperativeId };
    if (search) {
      query.$or = [
        { firstname: { $regex: search, $options: "i" } },
        { middlename: { $regex: search, $options: "i" } },
        { lastname: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }
    if (sort) {
      query.sort = sort;
    }
    const members = await MemberRepo.paginate({
      query,
      page,
      limit,
      search,
    });
    return members;
  };

  static getOneMember = async ({ cooperativeId, memberId }) => {
    const member = await MemberRepo.findOne({
      query: { cooperativeId, _id: memberId },
    });
    return member;
  };

  // ===== MEMBER DETAILS =====
  static getMemberStats = async ({ cooperativeId, memberId }) => {
    try {
      // Get member's contribution balance
      const memberWallet = await WalletRepo.findOne({
        query: { member: memberId, cooperativeId },
      });

      // Get member's asset investments
      const assetInvestments = await AssetUserRepo.findAll({
        query: { member: memberId, cooperativeId },
      });

      // Calculate total asset balance
      const assetBalance = assetInvestments.reduce((total, investment) => {
        return total + (investment.totalAmount || 0);
      }, 0);

      // Get member's transactions
      const transactions = await TransactionRepo.findAll({
        query: { member: memberId, cooperativeId },
        sort: { createdAt: -1 },
      });

      // Calculate contribution statistics
      const contributionTransactions = transactions.filter((t) =>
        t.descriptions?.toLowerCase().includes("contribution")
      );

      const totalContributions = contributionTransactions.reduce((total, t) => {
        return total + (t.type === "CR" ? t.amount : 0);
      }, 0);

      const lastContribution = contributionTransactions[0];

      return {
        totalBalance: (memberWallet?.ledger_balance || 0) + assetBalance,
        contributionBalance: memberWallet?.ledger_balance || 0,
        assetBalance: assetBalance,
        totalContributions: totalContributions,
        contributionCount: contributionTransactions.length,
        lastContributionDate: lastContribution?.createdAt,
        totalTransactions: transactions.length,
      };
    } catch (error) {
      handleServiceError(error, "get member stats");
    }
  };

  static getMemberTransactions = async ({
    cooperativeId,
    memberId,
    paginateOptions,
  }) => {
    try {
      const transactions = await TransactionRepo.paginate({
        query: { member: memberId, cooperativeId },
        ...paginateOptions,
        sort: { createdAt: -1 },
      });
      return transactions;
    } catch (error) {
      throw new Error(`Failed to get member transactions: ${error.message}`);
    }
  };

  static getMemberLoans = async ({
    cooperativeId,
    memberId,
    paginateOptions,
  }) => {
    try {
      const loans = await LoanRepo.paginate({
        query: { member: memberId, cooperativeId },
        ...paginateOptions,
        sort: { createdAt: -1 },
      });
      return loans;
    } catch (error) {
      throw new Error(`Failed to get member loans: ${error.message}`);
    }
  };

  static getMemberAssets = async ({
    cooperativeId,
    memberId,
    paginateOptions,
  }) => {
    try {
      const assets = await AssetUserRepo.paginate({
        query: { member: memberId, cooperativeId },
        ...paginateOptions,
        sort: { createdAt: -1 },
        populate: {
          path: "asset",
          select: "name description type settings",
        },
      });
      return assets;
    } catch (error) {
      throw new Error(`Failed to get member assets: ${error.message}`);
    }
  };

  static addSubaccounts = async ({ cooperativeId, data }) => {};

  static getAllTransactions = async ({
    cooperativeId,
    paginateOptions,
    search,
    dateFilter,
  }) => {
    const { startDate, endDate } = dateFilter;

    // Build the query object properly
    const query = { cooperativeId };

    // Add search conditions
    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [
        { descriptions: searchRegex },
        { reference: searchRegex },
        { type: searchRegex },
        { status: searchRegex },
      ];
    }

    // Add date filters
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    const transactions = await TransactionRepo.paginate({
      query,
      page: paginateOptions.page,
      limit: paginateOptions.limit,
      sort: { createdAt: -1 },
    });
    return transactions;
  };

  static getCooperativeBalance = async ({ cooperativeId }) => {
    const wallets = await WalletRepo.findAll({
      query: { cooperativeId },
    });
    const totalBalance = wallets.reduce(
      (sum, wallet) => sum + (wallet.ledger_balance || 0),
      0
    );
    return { balance: totalBalance };
  };

  static getAnalytics = async ({ cooperativeId, dateRange = "30d" }) => {
    try {
      // Calculate date range
      const endDate = new Date();
      let startDate;

      switch (dateRange) {
        case "7d":
          startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case "90d":
          startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case "1y":
          startDate = new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      // Get all transactions for the cooperative
      const transactions = await TransactionRepo.findAll({
        query: {
          cooperativeId,
          createdAt: { $gte: startDate, $lte: endDate },
        },
        sort: { createdAt: 1 },
      });

      // Get all members for the cooperative
      const members = await MemberRepo.findAll({
        query: { cooperativeId },
      });

      // Get all wallets for the cooperative
      const wallets = await WalletRepo.findAll({
        query: { cooperativeId },
      });

      // Calculate transaction analytics
      const transactionAnalytics = {
        total: transactions.length,
        successful: transactions.filter((t) => t.status === "success").length,
        pending: transactions.filter((t) => t.status === "pending").length,
        failed: transactions.filter((t) => t.status === "failed").length,
        totalAmount: transactions
          .filter((t) => t.status === "success")
          .reduce((sum, t) => sum + (t.amount || 0), 0),
        averageAmount:
          transactions.length > 0
            ? transactions.reduce((sum, t) => sum + (t.amount || 0), 0) /
              transactions.length
            : 0,
      };

      // Calculate member analytics
      const memberAnalytics = {
        total: members.length,
        active: members.filter((m) => m.isActive !== false).length,
        inactive: members.filter((m) => m.isActive === false).length,
        newThisPeriod: members.filter((m) => new Date(m.createdAt) >= startDate)
          .length,
      };

      // Calculate wallet analytics
      const walletAnalytics = {
        total: wallets.length,
        totalBalance: wallets.reduce(
          (sum, w) => sum + (w.ledger_balance || 0),
          0
        ),
        averageBalance:
          wallets.length > 0
            ? wallets.reduce((sum, w) => sum + (w.ledger_balance || 0), 0) /
              wallets.length
            : 0,
        walletsWithBalance: wallets.filter((w) => (w.ledger_balance || 0) > 0)
          .length,
      };

      // Calculate transaction trends by day
      const dailyTransactions = {};
      transactions.forEach((transaction) => {
        const date = transaction.createdAt.toISOString().split("T")[0];
        if (!dailyTransactions[date]) {
          dailyTransactions[date] = {
            count: 0,
            amount: 0,
            successful: 0,
            failed: 0,
          };
        }
        dailyTransactions[date].count++;
        dailyTransactions[date].amount += transaction.amount || 0;
        if (transaction.status === "success") {
          dailyTransactions[date].successful++;
        } else if (transaction.status === "failed") {
          dailyTransactions[date].failed++;
        }
      });

      // Calculate transaction type distribution
      const transactionTypes = {
        contributions: transactions.filter((t) => t.type === "CR").length,
        withdrawals: transactions.filter((t) => t.type === "DR").length,
      };

      // Calculate currency distribution
      const currencyDistribution = {};
      transactions.forEach((transaction) => {
        const currency = transaction.currency || "NGN";
        currencyDistribution[currency] =
          (currencyDistribution[currency] || 0) + 1;
      });

      // Calculate top contributors (by amount)
      const contributorStats = {};
      transactions
        .filter((t) => t.status === "success" && t.type === "CR")
        .forEach((transaction) => {
          const memberId = transaction.member.toString();
          if (!contributorStats[memberId]) {
            contributorStats[memberId] = {
              memberId,
              totalContributed: 0,
              transactionCount: 0,
            };
          }
          contributorStats[memberId].totalContributed +=
            transaction.amount || 0;
          contributorStats[memberId].transactionCount++;
        });

      const topContributors = Object.values(contributorStats)
        .sort((a, b) => b.totalContributed - a.totalContributed)
        .slice(0, 10);

      // Get member details for top contributors
      const topContributorsWithDetails = await Promise.all(
        topContributors.map(async (contributor) => {
          const member = await MemberRepo.findById(contributor.memberId);

          return {
            ...contributor,
            memberName: member
              ? `${member.firstname} ${member.lastname}`.trim()
              : "Unknown",
            memberEmail: member ? member.email : "Unknown",
          };
        })
      );

      return {
        period: {
          startDate,
          endDate,
          range: dateRange,
        },
        overview: {
          totalMembers: memberAnalytics.total,
          totalTransactions: transactionAnalytics.total,
          totalBalance: walletAnalytics.totalBalance,
          successRate:
            transactionAnalytics.total > 0
              ? (
                  (transactionAnalytics.successful /
                    transactionAnalytics.total) *
                  100
                ).toFixed(2)
              : 0,
        },
        transactions: {
          ...transactionAnalytics,
          types: transactionTypes,
          currencies: currencyDistribution,
        },
        members: memberAnalytics,
        wallets: walletAnalytics,
        trends: {
          daily: dailyTransactions,
        },
        topContributors: topContributorsWithDetails,
      };
    } catch (error) {
      throw new Error(`Failed to get analytics: ${error.message}`);
    }
  };

  static updateMemberContribution = async ({ cooperativeId, id, data }) => {
    try {
      const member = await MemberRepo.updateMemberContribution(
        cooperativeId,
        id,
        data
      );
      return member;
    } catch (error) {
      throw new Error(`Failed to update member contribution: ${error.message}`);
    }
  };

  // Add missing member management methods
  static updateMember = async ({ cooperativeId, memberId, updateData }) => {
    try {
      const member = await MemberRepo.update(memberId, {
        ...updateData,
        cooperativeId,
      });
      return member;
    } catch (error) {
      throw new Error(`Failed to update member: ${error.message}`);
    }
  };

  static deleteMember = async ({ cooperativeId, memberId }) => {
    try {
      const result = await MemberRepo.delete(memberId);
      return { message: "Member deleted successfully", result };
    } catch (error) {
      throw new Error(`Failed to delete member: ${error.message}`);
    }
  };

  // ===== INVITATION SYSTEM =====
  static async createInvitation({ cooperativeId, invitedBy, invitationData }) {
    try {
      const { email, firstName, lastName, phone, role, message } =
        invitationData;

      // Check if member already exists
      const existingMember = await MemberRepo.findOne({
        query: { email, cooperativeId },
      });
      abortIf(existingMember, httpStatus.BAD_REQUEST, "Member already exists");

      // Check if invitation already exists
      const existingInvitation = await InvitationRepo.findOne({
        query: { email, cooperativeId, status: "pending" },
      });
      abortIf(
        existingInvitation,
        httpStatus.BAD_REQUEST,
        "Invitation already sent"
      );

      const invitation = await InvitationRepo.createInvitation({
        cooperativeId,
        invitedBy,
        email,
        firstName,
        lastName,
        phone,
        role: role || "user",
        message,
      });

      // Send invitation email
      await sendEmail({
        to: email,
        subject: "You've been invited to join our Cooperative",
        template: "invitation",
        context: {
          firstName,
          invitationLink: invitation.invitationLink,
          invitationCode: invitation.invitationCode,
          message,
        },
      });

      return {
        message: "Invitation sent successfully",
        invitation: {
          id: invitation._id,
          email: invitation.email,
          invitationLink: invitation.invitationLink,
          invitationCode: invitation.invitationCode,
          expiresAt: invitation.expiresAt,
        },
      };
    } catch (error) {
      throw new Error(`Failed to create invitation: ${error.message}`);
    }
  }

  static async getPendingInvitations({ cooperativeId, page = 1, limit = 10 }) {
    try {
      const invitations = await InvitationRepo.getPendingInvitations(
        cooperativeId,
        {
          page,
          limit,
        }
      );
      return invitations;
    } catch (error) {
      throw new Error(`Failed to get invitations: ${error.message}`);
    }
  }

  static async cancelInvitation({ cooperativeId, invitationId, cancelledBy }) {
    try {
      const invitation = await InvitationRepo.findById(invitationId);
      abortIf(!invitation, httpStatus.NOT_FOUND, "Invitation not found");
      abortIf(
        invitation.cooperativeId.toString() !== cooperativeId,
        httpStatus.FORBIDDEN,
        "Not authorized"
      );

      await invitation.cancel();

      return {
        message: "Invitation cancelled successfully",
        invitation,
      };
    } catch (error) {
      throw new Error(`Failed to cancel invitation: ${error.message}`);
    }
  }

  // ===== ASSET MANAGEMENT =====
  static async createAsset({ cooperativeId, assetData }) {
    try {
      const { name, description, image, pricePerUnit, minUnit, minAmount } =
        assetData;

      // Create the asset
      const asset = await AssetsRepo.create({
        name,
        description,
        image: image || "",
        cooperativeId,
        settings: {
          pricePerUnit: pricePerUnit || 0,
          minUnit: minUnit || 1,
          minAmount: minAmount || 0,
        },
      });

      // Create asset wallet for the cooperative
      const assetWallet = await WalletRepo.create({
        cooperativeId,
        assetId: asset._id,
        currency: "NGN",
        walletType: "asset", // New field to distinguish wallet types
      });

      // Create external wallet for the cooperative (if it doesn't exist)
      const existingExternalWallet = await WalletRepo.findOne({
        query: { cooperativeId, walletType: "external" },
      });

      if (!existingExternalWallet) {
        await WalletRepo.create({
          cooperativeId,
          currency: "NGN",
          walletType: "external",
        });
      }

      // Create contribution wallet for the cooperative (if it doesn't exist)
      const existingContributionWallet = await WalletRepo.findOne({
        query: { cooperativeId, walletType: "contribution" },
      });

      if (!existingContributionWallet) {
        await WalletRepo.create({
          cooperativeId,
          currency: "NGN",
          walletType: "contribution",
        });
      }

      return {
        message: "Asset created successfully",
        asset: {
          id: asset._id,
          name: asset.name,
          description: asset.description,
          pricePerUnit: asset.settings.pricePerUnit,
          minUnit: asset.settings.minUnit,
          minAmount: asset.settings.minAmount,
        },
        assetWallet: {
          id: assetWallet._id,
          balance: assetWallet.ledger_balance,
        },
      };
    } catch (error) {
      throw new Error(`Failed to create asset: ${error.message}`);
    }
  }

  static async getAssets({ cooperativeId, page = 1, limit = 10 }) {
    try {
      const assets = await AssetsRepo.paginate({
        query: { cooperativeId },
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
      throw new Error(`Failed to get assets: ${error.message}`);
    }
  }

  static async updateAsset({ cooperativeId, assetId, assetData }) {
    try {
      // Check if asset exists and belongs to the cooperative
      const existingAsset = await AssetsRepo.findOne({
        query: { _id: assetId, cooperativeId },
      });

      if (!existingAsset) {
        throw new Error("Asset not found or access denied");
      }

      // Update the asset
      const updatedAsset = await AssetsRepo.update(assetId, {
        name: assetData.name,
        description: assetData.description,
        type: assetData.type,
        currency: assetData.currency,
        settings: {
          pricePerUnit: assetData.settings?.pricePerUnit || 0,
          totalUnits: assetData.settings?.totalUnits || 0,
          minInvestment: assetData.settings?.minInvestment || 0,
          maxInvestment: assetData.settings?.maxInvestment || 0,
          minUnit: assetData.settings?.minUnit || 1,
          minAmount: assetData.settings?.minAmount || 0,
          terms: assetData.settings?.terms || "",
          risks: assetData.settings?.risks || "",
        },
      });

      return {
        message: "Asset updated successfully",
        asset: updatedAsset,
      };
    } catch (error) {
      throw new Error(`Failed to update asset: ${error.message}`);
    }
  }

  static async publishAsset({ cooperativeId, assetId }) {
    try {
      // Check if asset exists and belongs to the cooperative
      const existingAsset = await AssetsRepo.findOne({
        query: { _id: assetId, cooperativeId },
      });

      if (!existingAsset) {
        throw new Error("Asset not found or access denied");
      }

      // Update asset status to published
      const publishedAsset = await AssetsRepo.update(assetId, {
        status: "published",
      });

      return {
        message: "Asset published successfully",
        asset: publishedAsset,
      };
    } catch (error) {
      throw new Error(`Failed to publish asset: ${error.message}`);
    }
  }

  static async getAssetById({ cooperativeId, assetId }) {
    try {
      // Get asset by ID and cooperative
      const asset = await AssetsRepo.findOne({
        query: { _id: assetId, cooperativeId },
      });

      if (!asset) {
        throw new Error("Asset not found or access denied");
      }

      // Get asset wallet for balance information
      const assetWallet = await WalletRepo.findOne({
        query: { cooperativeId, assetId, walletType: "asset" },
      });

      return {
        asset: {
          ...asset.toJSON(),
          walletBalance: assetWallet ? assetWallet.ledger_balance : 0,
        },
      };
    } catch (error) {
      throw new Error(`Failed to get asset: ${error.message}`);
    }
  }

  static async deleteAsset({ cooperativeId, assetId }) {
    try {
      // Check if asset exists and belongs to cooperative
      const asset = await AssetsRepo.findOne({
        query: { _id: assetId, cooperativeId },
      });

      if (!asset) {
        throw new Error("Asset not found or access denied");
      }

      // Check if asset has any investments or transactions
      const assetWallet = await WalletRepo.findOne({
        query: { cooperativeId, assetId, walletType: "asset" },
      });

      if (assetWallet && assetWallet.ledger_balance > 0) {
        throw new Error(
          "Cannot delete asset with existing investments. Please process all redemptions first."
        );
      }

      // Delete asset wallet if it exists
      if (assetWallet) {
        await WalletRepo.deleteOne({ _id: assetWallet._id });
      }

      // Delete the asset
      await AssetsRepo.deleteOne({ _id: assetId });

      return { message: "Asset deleted successfully" };
    } catch (error) {
      throw new Error(`Failed to delete asset: ${error.message}`);
    }
  }

  // ===== LOAN MANAGEMENT =====
  static async getLoanRequests({
    cooperativeId,
    page = 1,
    limit = 10,
    status,
  }) {
    try {
      let query = { cooperativeId };
      if (status) {
        query.status = status;
      }

      const loans = await LoanRepo.paginate({
        query,
        page,
        limit,
        sort: { createdAt: -1 },
        populate: "member",
      });

      return loans;
    } catch (error) {
      throw new Error(`Failed to get loan requests: ${error.message}`);
    }
  }

  static async getLoanManagementStats({ cooperativeId }) {
    try {
      // Get all loans for the cooperative
      const allLoans = await LoanRepo.find({ query: { cooperativeId } });

      // Calculate statistics
      const totalLoans = allLoans.length;

      const activeLoans = allLoans.filter(
        (loan) => loan.status === "active" || loan.status === "approved"
      ).length;

      const totalVolume = allLoans.reduce((sum, loan) => {
        // Only count approved, active, and completed loans in total volume
        if (["approved", "active", "completed"].includes(loan.status)) {
          return sum + loan.amount;
        }
        return sum;
      }, 0);

      const outstandingBalance = allLoans.reduce((sum, loan) => {
        // Only count active loans for outstanding balance
        if (loan.status === "active") {
          return sum + (loan.remainingBalance || loan.totalAmount);
        }
        return sum;
      }, 0);

      return {
        totalLoans,
        activeLoans,
        totalVolume,
        outstandingBalance,
        currency: "NGN", // Default currency, can be made dynamic
      };
    } catch (error) {
      throw new Error(`Failed to get loan management stats: ${error.message}`);
    }
  }

  static async approveLoan({
    cooperativeId,
    loanId,
    approvedBy,
    approvalData,
  }) {
    return await executeWithTransaction(async (session) => {
      const loan = await LoanRepo.findById(loanId);
      abortIf(!loan, httpStatus.NOT_FOUND, "Loan not found");
      abortIf(
        loan.cooperativeId.toString() !== cooperativeId,
        httpStatus.FORBIDDEN,
        "Not authorized"
      );
      abortIf(
        loan.status !== "pending",
        httpStatus.BAD_REQUEST,
        "Loan is not pending"
      );

      const { approvedAmount, interestRate, term, monthlyPayment } =
        approvalData;

      // Update loan with approval details
      const updatedLoan = session
        ? await LoanRepo.updateWithSession(
            loanId,
            {
              status: "approved",
              approvedBy,
              approvedAt: new Date(),
              amount: approvedAmount || loan.amount,
              interestRate: interestRate || loan.interestRate,
              term: term || loan.term,
              monthlyPayment: monthlyPayment || loan.monthlyPayment,
              dueDate: new Date(
                Date.now() + (term || loan.term) * 30 * 24 * 60 * 60 * 1000
              ), // 30 days per month
            },
            session
          )
        : await LoanRepo.update(loanId, {
            status: "approved",
            approvedBy,
            approvedAt: new Date(),
            amount: approvedAmount || loan.amount,
            interestRate: interestRate || loan.interestRate,
            term: term || loan.term,
            monthlyPayment: monthlyPayment || loan.monthlyPayment,
            dueDate: new Date(
              Date.now() + (term || loan.term) * 30 * 24 * 60 * 60 * 1000
            ), // 30 days per month
          });

      // Create transaction record for loan approval
      const transactionData = {
        member: loan.member,
        cooperativeId,
        amount: approvedAmount || loan.amount,
        type: "CR",
        descriptions: `Loan approved: ${loan.purpose}`,
        currency: loan.currency,
        reference: `LOAN-${loan._id}`,
        status: "success",
        loanId: loan._id,
      };

      if (session) {
        await TransactionRepo.createWithSession(transactionData, session);
      } else {
        await TransactionRepo.create(transactionData);
      }

      // Update member's wallet if disbursement method is wallet
      if (loan.disbursementMethod === "wallet") {
        const memberWallet = await WalletRepo.findOne({
          query: { member: loan.member, walletType: "contribution" },
        });

        if (memberWallet) {
          const updateData = {
            $inc: { ledger_balance: approvedAmount || loan.amount },
          };

          if (session) {
            await WalletRepo.updateWithSession(
              memberWallet._id,
              updateData,
              session
            );
          } else {
            await WalletRepo.update(memberWallet._id, updateData);
          }
        }
      }

      return {
        message: "Loan approved successfully",
        loan: updatedLoan,
      };
    });
  }

  static async rejectLoan({
    cooperativeId,
    loanId,
    rejectedBy,
    rejectionReason,
  }) {
    try {
      const loan = await LoanRepo.findById(loanId);
      abortIf(!loan, httpStatus.NOT_FOUND, "Loan not found");
      abortIf(
        loan.cooperativeId.toString() !== cooperativeId,
        httpStatus.FORBIDDEN,
        "Not authorized"
      );
      abortIf(
        loan.status !== "pending",
        httpStatus.BAD_REQUEST,
        "Loan is not pending"
      );

      const updatedLoan = await LoanRepo.update(loanId, {
        status: "rejected",
        approvedBy: rejectedBy,
        approvedAt: new Date(),
        rejectionReason,
      });

      return {
        message: "Loan rejected successfully",
        loan: updatedLoan,
      };
    } catch (error) {
      throw new Error(`Failed to reject loan: ${error.message}`);
    }
  }

  // ===== WALLET MANAGEMENT =====
  static async getCooperativeWallets({ cooperativeId }) {
    try {
      const wallets = await WalletRepo.findAll({
        query: { cooperativeId },
        populate: "assetId",
      });

      const walletTypes = {
        contribution: wallets.find((w) => w.walletType === "contribution"),
        external: wallets.find((w) => w.walletType === "external"),
        assets: wallets.filter((w) => w.walletType === "asset"),
      };

      return {
        wallets: walletTypes,
        totalBalance: wallets.reduce(
          (sum, wallet) => sum + (wallet.ledger_balance || 0),
          0
        ),
      };
    } catch (error) {
      throw new Error(`Failed to get cooperative wallets: ${error.message}`);
    }
  }

  // ===== WITHDRAWAL MANAGEMENT =====
  static async getPendingWithdrawals({ cooperativeId, page = 1, limit = 10 }) {
    try {
      const withdrawals = await WithdrawalRepo.getPendingWithdrawals(
        cooperativeId,
        {
          page,
          limit,
        }
      );
      return withdrawals;
    } catch (error) {
      handleServiceError(error, "get pending withdrawals");
    }
  }

  static async getWithdrawalById({ cooperativeId, withdrawalId }) {
    try {
      const withdrawal = await WithdrawalRepo.getWithdrawalById(withdrawalId);
      abortIf(!withdrawal, httpStatus.NOT_FOUND, "Withdrawal not found");
      abortIf(
        withdrawal.cooperativeId.toString() !== cooperativeId,
        httpStatus.FORBIDDEN,
        "Not authorized to view this withdrawal"
      );
      return withdrawal;
    } catch (error) {
      handleServiceError(error, "get withdrawal by id");
    }
  }

  static async approveWithdrawal({ cooperativeId, withdrawalId, approvedBy }) {
    return await executeWithTransaction(async (session) => {
      // Get withdrawal request
      console.log(`Looking for withdrawal with ID: ${withdrawalId}`);
      console.log(`For cooperative: ${cooperativeId}`);

      const withdrawal = await WithdrawalRepo.getWithdrawalById(withdrawalId);
      console.log(`Found withdrawal:`, withdrawal ? "YES" : "NO");

      if (withdrawal) {
        console.log(`Withdrawal cooperativeId: ${withdrawal.cooperativeId}`);
        console.log(`Withdrawal status: ${withdrawal.status}`);
      }

      abortIf(
        !withdrawal,
        httpStatus.NOT_FOUND,
        "Withdrawal request not found"
      );
      abortIf(
        withdrawal.cooperativeId.toString() !== cooperativeId,
        httpStatus.FORBIDDEN,
        "Not authorized"
      );
      // abortIf(
      //   withdrawal.status !== "pending",
      //   httpStatus.BAD_REQUEST,
      //   "Withdrawal is not pending"
      // );

      // Approve the withdrawal
      const updatedWithdrawal = session
        ? await withdrawal.approve(approvedBy, session)
        : await withdrawal.approve(approvedBy);

      // Create transaction record
      const reference = `WITHDRAW-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      const transactionData = {
        member: withdrawal.member,
        cooperativeId,
        amount: withdrawal.amount,
        type: "DR",
        descriptions: `Withdrawal: ${withdrawal.reason}`,
        currency: withdrawal.currency,
        reference,
        status: "success",
        withdrawalId: withdrawal._id,
      };

      const transaction = session
        ? await TransactionRepo.createWithSession(transactionData, session)
        : await TransactionRepo.create(transactionData);

      // Process wallet updates based on withdrawal type
      if (withdrawal.withdrawalType === "contribution") {
        // Check member's individual wallet balance first
        const memberWallet = await WalletRepo.findOne({
          query: {
            member: withdrawal.member,
            cooperativeId,
            walletType: "member",
            assetId: null, // General member wallet, not asset-specific
          },
        });
        console.log(`Member wallet found:`, memberWallet ? "YES" : "NO");
        if (memberWallet) {
          console.log(`Member wallet balance: ${memberWallet.ledger_balance}`);
          console.log(`Withdrawal amount: ${withdrawal.amount}`);
        }
        abortIf(!memberWallet, httpStatus.NOT_FOUND, "Member wallet not found");
        abortIf(
          memberWallet.ledger_balance < withdrawal.amount,
          httpStatus.BAD_REQUEST,
          `Insufficient member balance. Available: ${memberWallet.ledger_balance}, Required: ${withdrawal.amount}`
        );

        // Also check cooperative's contribution wallet
        const contributionWallet = await WalletRepo.findOne({
          query: { cooperativeId, walletType: "contribution" },
        });
        console.log(
          `Contribution wallet found:`,
          contributionWallet ? "YES" : "NO"
        );
        if (contributionWallet) {
          console.log(
            `Contribution wallet balance: ${contributionWallet.ledger_balance}`
          );
          console.log(`Withdrawal amount: ${withdrawal.amount}`);
        }
        abortIf(
          !contributionWallet,
          httpStatus.NOT_FOUND,
          "Contribution wallet not found"
        );
        abortIf(
          contributionWallet.ledger_balance < withdrawal.amount,
          httpStatus.BAD_REQUEST,
          `Insufficient cooperative contribution balance. Available: ${contributionWallet.ledger_balance}, Required: ${withdrawal.amount}`
        );

        const updateData = {
          $inc: { ledger_balance: -withdrawal.amount },
          $push: { transactions: transaction._id },
        };

        if (session) {
          await WalletRepo.updateWithSession(
            contributionWallet._id,
            updateData,
            session
          );
        } else {
          await WalletRepo.update(contributionWallet._id, updateData);
        }

        // DR (Debit) member's contribution wallet - Decrease member's balance
        let memberContributionWallet = await WalletRepo.findOne({
          query: {
            member: withdrawal.member,
            cooperativeId,
            assetId: null,
          },
        });
        if (!memberContributionWallet) {
          memberContributionWallet = await WalletRepo.create({
            member: withdrawal.member,
            cooperativeId,
            assetId: null,
            currency: withdrawal.currency,
          });
        }

        const memberWalletUpdateData = {
          $inc: { ledger_balance: -withdrawal.amount },
          $push: { transactions: transaction._id },
        };

        if (session) {
          await WalletRepo.updateWithSession(
            memberContributionWallet._id,
            memberWalletUpdateData,
            session
          );
        } else {
          await WalletRepo.update(
            memberContributionWallet._id,
            memberWalletUpdateData
          );
        }
      } else if (withdrawal.withdrawalType === "asset") {
        // DR (Debit) asset wallet
        const assetWallet = await WalletRepo.findOne({
          query: {
            cooperativeId,
            assetId: withdrawal.assetId,
            walletType: "asset",
          },
        });
        abortIf(!assetWallet, httpStatus.NOT_FOUND, "Asset wallet not found");
        abortIf(
          assetWallet.ledger_balance < withdrawal.amount,
          httpStatus.BAD_REQUEST,
          "Insufficient asset balance"
        );

        const updateData = {
          $inc: { ledger_balance: -withdrawal.amount },
          $push: { transactions: transaction._id },
        };

        if (session) {
          await WalletRepo.updateWithSession(
            assetWallet._id,
            updateData,
            session
          );
        } else {
          await WalletRepo.update(assetWallet._id, updateData);
        }

        // Update AssetUser record to reduce member's asset holdings
        const assetUser = await AssetUserRepo.findOne({
          query: {
            member: withdrawal.member,
            asset: withdrawal.assetId,
            cooperativeId,
          },
        });

        if (assetUser) {
          const withdrawalProportion =
            withdrawal.amount / assetUser.totalInvested;
          const quantityToWithdraw = assetUser.quantity * withdrawalProportion;

          const assetUserUpdateData = {
            quantity: assetUser.quantity - quantityToWithdraw,
            totalInvested: assetUser.totalInvested - withdrawal.amount,
          };

          if (session) {
            await AssetUserRepo.updateWithSession(
              assetUser._id,
              assetUserUpdateData,
              session
            );
          } else {
            await AssetUserRepo.update(assetUser._id, assetUserUpdateData);
          }
        }

        // DR (Debit) member's asset wallet - Decrease member's asset balance
        const memberAssetWallet = await WalletRepo.findOrCreate(
          withdrawal.member,
          cooperativeId,
          withdrawal.assetId, // assetId for asset-specific wallet
          withdrawal.currency
        );

        const memberAssetWalletUpdateData = {
          $inc: { ledger_balance: -withdrawal.amount },
          $push: { transactions: transaction._id },
        };

        if (session) {
          await WalletRepo.updateWithSession(
            memberAssetWallet._id,
            memberAssetWalletUpdateData,
            session
          );
        } else {
          await WalletRepo.update(
            memberAssetWallet._id,
            memberAssetWalletUpdateData
          );
        }
      }

      // CR (Credit) external wallet
      const externalWallet = await WalletRepo.findOne({
        query: { cooperativeId, walletType: "external" },
      });
      abortIf(
        !externalWallet,
        httpStatus.NOT_FOUND,
        "External wallet not found"
      );

      const externalWalletUpdateData = {
        $inc: { ledger_balance: withdrawal.amount },
        $push: { transactions: transaction._id },
      };

      if (session) {
        await WalletRepo.updateWithSession(
          externalWallet._id,
          externalWalletUpdateData,
          session
        );
      } else {
        await WalletRepo.update(externalWallet._id, externalWalletUpdateData);
      }

      return {
        success: true,
        message: "Withdrawal approved successfully",
        withdrawal: updatedWithdrawal,
        transaction: {
          id: transaction._id,
          reference: transaction.reference,
          amount: transaction.amount,
        },
      };
    });
  }

  static async rejectWithdrawal({
    cooperativeId,
    withdrawalId,
    rejectedBy,
    rejectionReason,
  }) {
    try {
      const withdrawal = await WithdrawalRepo.getWithdrawalById(withdrawalId);
      abortIf(
        !withdrawal,
        httpStatus.NOT_FOUND,
        "Withdrawal request not found"
      );
      abortIf(
        withdrawal.cooperativeId.toString() !== cooperativeId,
        httpStatus.FORBIDDEN,
        "Not authorized"
      );
      abortIf(
        withdrawal.status !== "pending",
        httpStatus.BAD_REQUEST,
        "Withdrawal is not pending"
      );

      const updatedWithdrawal = await withdrawal.reject(
        rejectedBy,
        rejectionReason
      );

      return {
        success: true,
        message: "Withdrawal rejected successfully",
        withdrawal: updatedWithdrawal,
      };
    } catch (error) {
      throw new Error(`Failed to reject withdrawal: ${error.message}`);
    }
  }

  // ===== COOPERATIVE SETTINGS MANAGEMENT =====
  static async getCooperativeSettings({ cooperativeId }) {
    try {
      const cooperative = await CooperativeRepo.findById(cooperativeId);
      abortIf(!cooperative, httpStatus.NOT_FOUND, "Cooperative not found");

      return {
        settings: cooperative.settings,
      };
    } catch (error) {
      throw new Error(`Failed to get cooperative settings: ${error.message}`);
    }
  }

  static async updateCooperativeSettings({ cooperativeId, settings }) {
    try {
      const cooperative = await CooperativeRepo.findById(cooperativeId);
      abortIf(!cooperative, httpStatus.NOT_FOUND, "Cooperative not found");

      // Update settings
      const updatedCooperative = await CooperativeRepo.update(cooperativeId, {
        settings: {
          ...cooperative.settings,
          ...settings,
        },
      });

      return {
        message: "Cooperative settings updated successfully",
        settings: updatedCooperative.settings,
      };
    } catch (error) {
      throw new Error(
        `Failed to update cooperative settings: ${error.message}`
      );
    }
  }

  // ===== COOPERATIVE STATS =====
  static async getCooperativeStats({ cooperativeId }) {
    try {
      // Get all active loans
      const activeLoans = await LoanRepo.findAll({
        query: {
          cooperativeId,
          status: { $in: ["approved", "active"] },
        },
      });

      // Get all assets
      const assets = await AssetsRepo.findAll({
        query: { cooperativeId },
      });

      // Get all members
      const members = await MemberRepo.findAll({
        query: { cooperativeId },
      });

      // Get all wallets and calculate total balance
      const wallets = await WalletRepo.findAll({
        query: { cooperativeId },
      });

      // Get all asset investments (from AssetUser)
      const assetInvestments = await AssetUserRepo.findAll({
        query: { cooperativeId, status: "active" },
      });

      // Calculate metrics
      const activeLoansCount = Array.isArray(activeLoans)
        ? activeLoans.length
        : 0;
      const totalAssetsCount = Array.isArray(assets) ? assets.length : 0;
      const memberCount = Array.isArray(members) ? members.length : 0;

      // Calculate total wallet balance
      const totalWalletBalance = Array.isArray(wallets)
        ? wallets.reduce((sum, wallet) => sum + (wallet.ledger_balance || 0), 0)
        : 0;

      // Calculate total investment volume
      const totalInvestmentVolume = Array.isArray(assetInvestments)
        ? assetInvestments.reduce(
            (sum, investment) => sum + (investment.totalInvested || 0),
            0
          )
        : 0;

      // Get additional metrics for better insights
      const pendingLoans = await LoanRepo.findAll({
        query: {
          cooperativeId,
          status: "pending",
        },
      });

      const pendingLoansCount = Array.isArray(pendingLoans)
        ? pendingLoans.length
        : 0;

      // Get total loan amount
      const totalLoanAmount = Array.isArray(activeLoans)
        ? activeLoans.reduce((sum, loan) => sum + (loan.amount || 0), 0)
        : 0;

      // Get total outstanding loan balance
      const totalOutstandingLoans = Array.isArray(activeLoans)
        ? activeLoans.reduce(
            (sum, loan) => sum + (loan.remainingBalance || loan.amount || 0),
            0
          )
        : 0;

      return {
        // Primary metrics (as requested)
        activeLoans: activeLoansCount,
        investmentVolume: totalInvestmentVolume,
        memberCount: memberCount,
        totalWalletBalance: totalWalletBalance,
        totalAssets: totalAssetsCount,

        // Additional insights
        pendingLoans: pendingLoansCount,
        totalLoanAmount: totalLoanAmount,
        totalOutstandingLoans: totalOutstandingLoans,

        // Breakdown by wallet type
        walletBreakdown: {
          external: Array.isArray(wallets)
            ? wallets
                .filter((w) => w.walletType === "external")
                .reduce((sum, w) => sum + (w.ledger_balance || 0), 0)
            : 0,
          contribution: Array.isArray(wallets)
            ? wallets
                .filter((w) => w.walletType === "contribution")
                .reduce((sum, w) => sum + (w.ledger_balance || 0), 0)
            : 0,
          asset: Array.isArray(wallets)
            ? wallets
                .filter((w) => w.walletType === "asset")
                .reduce((sum, w) => sum + (w.ledger_balance || 0), 0)
            : 0,
          member: Array.isArray(wallets)
            ? wallets
                .filter((w) => w.walletType === "member")
                .reduce((sum, w) => sum + (w.ledger_balance || 0), 0)
            : 0,
        },

        // Asset breakdown
        assetBreakdown: {
          totalAssets: totalAssetsCount,
          totalInvestments: totalInvestmentVolume,
          averageInvestmentPerAsset:
            totalAssetsCount > 0 ? totalInvestmentVolume / totalAssetsCount : 0,
        },

        // Member breakdown
        memberBreakdown: {
          totalMembers: memberCount,
          activeInvestors: Array.isArray(assetInvestments)
            ? new Set(assetInvestments.map((inv) => inv.member.toString())).size
            : 0,
          averageInvestmentPerMember:
            memberCount > 0 ? totalInvestmentVolume / memberCount : 0,
        },

        // Loan breakdown
        loanBreakdown: {
          activeLoans: activeLoansCount,
          pendingLoans: pendingLoansCount,
          totalLoanAmount: totalLoanAmount,
          totalOutstanding: totalOutstandingLoans,
          averageLoanAmount:
            activeLoansCount > 0 ? totalLoanAmount / activeLoansCount : 0,
        },

        // Summary
        summary: {
          totalAssets: totalAssetsCount,
          totalMembers: memberCount,
          totalLoans: activeLoansCount + pendingLoansCount,
          totalInvestments: totalInvestmentVolume,
          totalWalletBalance: totalWalletBalance,
        },
      };
    } catch (error) {
      throw new Error(`Failed to get cooperative stats: ${error.message}`);
    }
  }

  static async getAllActivities({
    cooperativeId,
    page = 1,
    limit = 10,
    category,
    type,
    status,
    severity,
    startDate,
    endDate,
    search,
  }) {
    try {
      const activities = await ActivityRepo.getCooperativeActivityLog(
        cooperativeId,
        {
          page,
          limit,
          category,
          type,
          status,
          severity,
          startDate,
          endDate,
          search,
        }
      );
      return activities;
    } catch (error) {
      throw new Error(`Failed to get activities: ${error.message}`);
    }
  }

  // ===== SUBSCRIPTION MANAGEMENT =====
  static async getSubscriptionPlans() {
    try {
      const plans = await PlanRepo.getActivePlans();
      return { plans };
    } catch (error) {
      throw new Error(`Failed to get subscription plans: ${error.message}`);
    }
  }

  static async getCurrentSubscription({ cooperativeId }) {
    try {
      const cooperative = await CooperativeRepo.findById(cooperativeId);
      if (!cooperative) {
        throw new Error("Cooperative not found");
      }

      const currentPlan = cooperative.settings?.subscription_plan?.plan_id
        ? await PlanRepo.findById(
            cooperative.settings.subscription_plan.plan_id
          )
        : null;

      return {
        currentPlan,
        subscription: cooperative.settings?.subscription,
        subscriptionPlan: cooperative.settings?.subscription_plan,
      };
    } catch (error) {
      throw new Error(`Failed to get current subscription: ${error.message}`);
    }
  }

  static async changeSubscription({
    cooperativeId,
    planId,
    planTier,
    changedBy,
  }) {
    try {
      // Get the new plan by ID or tier
      let newPlan;
      if (planId) {
        newPlan = await PlanRepo.findById(planId);
      } else if (planTier) {
        newPlan = await PlanRepo.getPlanByTier(planTier);
      } else {
        throw new Error("Either planId or planTier must be provided");
      }

      if (!newPlan) {
        throw new Error("Plan not found");
      }

      // Get current cooperative
      const cooperative = await CooperativeRepo.findById(cooperativeId);
      if (!cooperative) {
        throw new Error("Cooperative not found");
      }

      // Set next billing date
      const nextBillingDate = new Date();
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

      // Update cooperative with new subscription
      const updatedCooperative = await CooperativeRepo.update(cooperativeId, {
        "settings.subscription_plan": {
          plan_id: newPlan._id,
          expires_at: nextBillingDate,
        },
        "settings.subscription": {
          tier: newPlan.tier,
          monthly_fee: newPlan.monthly_fee,
          member_limit: newPlan.member_limit,
          transaction_limit: newPlan.transaction_limit,
          features: newPlan.features,
          next_billing_date: nextBillingDate,
          status: "active",
        },
      });

      // Log activity
      await ActivityRepo.logActivity({
        type: "subscription_changed",
        member: changedBy,
        cooperativeId,
        title: "Subscription Plan Changed",
        description: `Subscription changed to ${newPlan.name}`,
        category: "admin",
        status: "success",
        metadata: {
          oldPlan: cooperative.settings?.subscription?.tier,
          newPlan: newPlan.tier,
          newPlanName: newPlan.name,
          monthlyFee: newPlan.monthly_fee,
        },
      });

      return {
        message: "Subscription changed successfully",
        newPlan,
        nextBillingDate,
      };
    } catch (error) {
      throw new Error(`Failed to change subscription: ${error.message}`);
    }
  }

  static async updateSubscriptionSettings({ cooperativeId, subscriptionData }) {
    try {
      const updatedCooperative = await CooperativeRepo.update(cooperativeId, {
        "settings.subscription": subscriptionData,
      });

      return {
        message: "Subscription settings updated successfully",
        subscription: updatedCooperative.settings?.subscription,
      };
    } catch (error) {
      throw new Error(
        `Failed to update subscription settings: ${error.message}`
      );
    }
  }

  // ===== ACCESS CONTROL =====
  static async getAvailableFeatures({ cooperativeId }) {
    try {
      return await AccessControlService.getAvailableFeatures(cooperativeId);
    } catch (error) {
      throw new Error(`Failed to get available features: ${error.message}`);
    }
  }

  static async checkFeatureAccess({ cooperativeId, feature }) {
    try {
      return await AccessControlService.hasFeatureAccess(
        cooperativeId,
        feature
      );
    } catch (error) {
      throw new Error(`Failed to check feature access: ${error.message}`);
    }
  }

  static async getUpgradeSuggestions({ cooperativeId }) {
    try {
      return await AccessControlService.getUpgradeSuggestions(cooperativeId);
    } catch (error) {
      throw new Error(`Failed to get upgrade suggestions: ${error.message}`);
    }
  }

  static async checkLimits({ cooperativeId, limitType, currentValue }) {
    try {
      return await AccessControlService.checkLimits(
        cooperativeId,
        limitType,
        currentValue
      );
    } catch (error) {
      throw new Error(`Failed to check limits: ${error.message}`);
    }
  }

  // ===== ASSET REDEMPTION MANAGEMENT =====
  static async getPendingAssetRedemptions({
    cooperativeId,
    page = 1,
    limit = 10,
  }) {
    try {
      return await AssetRedemptionRepo.getPendingRedemptions(cooperativeId, {
        page,
        limit,
      });
    } catch (error) {
      throw new Error(
        `Failed to get pending asset redemptions: ${error.message}`
      );
    }
  }

  static async approveAssetRedemption({
    redemptionId,
    approvedBy,
    cooperativeId,
  }) {
    try {
      return await executeWithTransaction(async (session) => {
        // Get redemption details
        const redemption = await AssetRedemptionRepo.findByIdWithPopulate(
          redemptionId
        );
        abortIf(
          !redemption,
          httpStatus.NOT_FOUND,
          "Asset redemption not found"
        );
        abortIf(
          redemption.cooperativeId.toString() !== cooperativeId,
          httpStatus.FORBIDDEN,
          "Asset redemption not found in this cooperative"
        );
        abortIf(
          redemption.status !== "pending",
          httpStatus.BAD_REQUEST,
          "Asset redemption is not pending"
        );

        // Get member's asset holdings
        const assetHolding = await AssetUserRepo.findOne({
          member: redemption.member._id,
          asset: redemption.asset._id,
          cooperativeId,
        });
        abortIf(!assetHolding, httpStatus.NOT_FOUND, "Asset holding not found");
        abortIf(
          assetHolding.quantity < redemption.quantity,
          httpStatus.BAD_REQUEST,
          "Insufficient units for redemption"
        );

        // Get asset wallet and member's external wallet
        const assetWallet = await WalletRepo.findOne({
          cooperativeId,
          walletType: "asset",
          assetId: redemption.asset._id,
        });
        abortIf(!assetWallet, httpStatus.NOT_FOUND, "Asset wallet not found");

        const externalWallet = await WalletRepo.findOne({
          cooperativeId,
          walletType: "external",
        });
        abortIf(
          !externalWallet,
          httpStatus.NOT_FOUND,
          "External wallet not found"
        );

        // Create transaction reference
        const reference = `REDEMPTION-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`;

        // Create transaction for the redemption
        const transaction = await TransactionRepo.create(
          {
            member: redemption.member._id,
            cooperativeId,
            amount: redemption.redemptionAmount,
            type: "CR", // Credit to member's external wallet
            descriptions: `Asset redemption: ${redemption.quantity} units of ${redemption.asset.name}`,
            currency: redemption.currency,
            reference,
            status: "success",
            assetId: redemption.asset._id,
            metadata: {
              type: "asset_redemption",
              redemptionId: redemption._id.toString(),
              quantity: redemption.quantity,
              currentPricePerUnit: redemption.currentPricePerUnit,
              profitLoss: redemption.metadata?.profitLoss || 0,
            },
          },
          session
        );

        // Update asset holding (reduce quantity)
        await AssetUserRepo.update(
          assetHolding._id,
          {
            quantity: assetHolding.quantity - redemption.quantity,
            totalInvested:
              assetHolding.totalInvested -
              (redemption.metadata?.originalInvestment || 0),
            lastTransactionDate: new Date(),
          },
          session
        );

        // Update wallets
        await WalletRepo.update(
          assetWallet._id,
          {
            ledger_balance:
              assetWallet.ledger_balance - redemption.redemptionAmount,
          },
          session
        );

        await WalletRepo.update(
          externalWallet._id,
          {
            ledger_balance:
              externalWallet.ledger_balance + redemption.redemptionAmount,
          },
          session
        );

        // Update redemption status
        await AssetRedemptionRepo.updateStatus(
          redemptionId,
          "completed",
          approvedBy,
          null,
          session
        );

        // Update redemption with transaction ID
        await AssetRedemptionRepo.update(
          redemptionId,
          { transactionId: transaction._id },
          session
        );

        // Log activity
        await ActivityRepo.create(
          {
            member: approvedBy,
            cooperativeId,
            type: "asset_redemption_approved",
            title: "Asset Redemption Approved",
            description: `Approved redemption of ${
              redemption.quantity
            } units of ${redemption.asset.name} for ${
              redemption.currency
            } ${redemption.redemptionAmount.toLocaleString()}`,
            category: "admin",
            status: "success",
            metadata: {
              redemptionId: redemption._id.toString(),
              memberId: redemption.member._id.toString(),
              assetId: redemption.asset._id.toString(),
              quantity: redemption.quantity,
              redemptionAmount: redemption.redemptionAmount,
              transactionId: transaction._id.toString(),
            },
          },
          session
        );

        return {
          success: true,
          message: "Asset redemption approved successfully",
          redemption: {
            id: redemption._id,
            quantity: redemption.quantity,
            redemptionAmount: redemption.redemptionAmount,
            status: "completed",
            transactionId: transaction._id,
          },
        };
      });
    } catch (error) {
      throw new Error(`Failed to approve asset redemption: ${error.message}`);
    }
  }

  static async rejectAssetRedemption({
    redemptionId,
    rejectedBy,
    cooperativeId,
    rejectionReason,
  }) {
    try {
      // Get redemption details
      const redemption = await AssetRedemptionRepo.findByIdWithPopulate(
        redemptionId
      );
      abortIf(!redemption, httpStatus.NOT_FOUND, "Asset redemption not found");
      abortIf(
        redemption.cooperativeId.toString() !== cooperativeId,
        httpStatus.FORBIDDEN,
        "Asset redemption not found in this cooperative"
      );
      abortIf(
        redemption.status !== "pending",
        httpStatus.BAD_REQUEST,
        "Asset redemption is not pending"
      );

      // Update redemption status
      await AssetRedemptionRepo.updateStatus(
        redemptionId,
        "rejected",
        rejectedBy,
        rejectionReason
      );

      // Log activity
      await ActivityRepo.create({
        member: rejectedBy,
        cooperativeId,
        type: "asset_redemption_rejected",
        title: "Asset Redemption Rejected",
        description: `Rejected redemption of ${redemption.quantity} units of ${redemption.asset.name}. Reason: ${rejectionReason}`,
        category: "admin",
        status: "success",
        metadata: {
          redemptionId: redemption._id.toString(),
          memberId: redemption.member._id.toString(),
          assetId: redemption.asset._id.toString(),
          quantity: redemption.quantity,
          redemptionAmount: redemption.redemptionAmount,
          rejectionReason,
        },
      });

      return {
        success: true,
        message: "Asset redemption rejected successfully",
        redemption: {
          id: redemption._id,
          status: "rejected",
          rejectionReason,
        },
      };
    } catch (error) {
      throw new Error(`Failed to reject asset redemption: ${error.message}`);
    }
  }

  static async getAssetRedemptionStats({ cooperativeId }) {
    try {
      const stats = await AssetRedemptionRepo.aggregate([
        {
          $match: { cooperativeId },
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            totalAmount: { $sum: "$redemptionAmount" },
          },
        },
      ]);

      const result = {
        pending: { count: 0, totalAmount: 0 },
        approved: { count: 0, totalAmount: 0 },
        rejected: { count: 0, totalAmount: 0 },
        completed: { count: 0, totalAmount: 0 },
      };

      stats.forEach((stat) => {
        result[stat._id] = {
          count: stat.count,
          totalAmount: stat.totalAmount,
        };
      });

      return result;
    } catch (error) {
      throw new Error(`Failed to get asset redemption stats: ${error.message}`);
    }
  }
}

module.exports = AdminService;
