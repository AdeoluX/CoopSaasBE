const Transaction = require("../models/Transactions");
const { abortIf } = require("../utils/responder");
const httpStatus = require("http-status");
const { executeWithTransaction } = require("../utils/transaction.utils");

class WebhookService {
  static fundWallet = async ({ reference, status }) => {
    try {
      // Use the new method to handle webhook update atomically
      const updatedTransaction = await executeWithTransaction(
        async (session) => {
          return await Transaction.handleWebhookUpdate(
            reference,
            status,
            session
          );
        }
      );

      return {
        success: true,
        transaction: updatedTransaction,
        status,
      };
    } catch (error) {
      console.error("Webhook processing error:", error);
      throw error;
    }
  };

  // Method to handle failed payments
  static handleFailedPayment = async ({ reference, reason }) => {
    try {
      const result = await executeWithTransaction(async (session) => {
        // Find transaction by reference first
        const transactionQuery = Transaction.findOne({ reference });
        if (session) transactionQuery.session(session);
        const transaction = await transactionQuery;

        if (!transaction) {
          throw new Error(`Transaction with reference ${reference} not found`);
        }

        // Update transaction status to failed (no wallet balance update for failed payments)
        const updatedTransaction = await Transaction.updateStatus(
          transaction._id,
          "failed",
          session
        );

        return updatedTransaction;
      });

      return {
        success: true,
        transaction: result,
        status: "failed",
        reason,
      };
    } catch (error) {
      console.error("Failed payment handling error:", error);
      throw error;
    }
  };

  static paystackWebhook = async ({ reference, status }) => {
    try {
      console.log(
        `Processing Paystack webhook for reference: ${reference}, status: ${status}`
      );

      // Check if transaction already processed to prevent duplicates
      const existingTransaction = await Transaction.findOne({ reference });
      if (existingTransaction && existingTransaction.status === status) {
        console.log(
          `Transaction ${reference} already processed with status: ${status}`
        );
        return {
          success: true,
          transaction: existingTransaction,
          status,
          message: "Already processed",
        };
      }

      // Use a single transaction so `session` is available consistently to downstream calls
      const updatedTransaction = await executeWithTransaction(
        async (session) => {
          const tx = await Transaction.handleWebhookUpdate(
            reference,
            status,
            session
          );

          // If this is an asset purchase and payment was successful, process the asset allocation
          if (status === "success" && tx.assetId) {
            await WebhookService.processAssetPurchase(tx, session);
          }

          // Note: For contributions, wallet updates are already handled in Transaction.handleWebhookUpdate
          // No need to call processContribution to avoid double processing

          return tx;
        }
      );

      console.log(
        `Successfully processed webhook for reference: ${reference}, status: ${status}`
      );

      return {
        success: true,
        transaction: updatedTransaction,
        status,
      };
    } catch (error) {
      console.error("Paystack webhook processing error:", error);
      throw error;
    }
  };

  static processAssetPurchase = async (transaction, session = null) => {
    try {
      console.log(
        `Processing asset purchase for transaction: ${transaction._id}`
      );

      const { assetId, quantity, memberId, cooperativeId } =
        transaction.metadata;

      // Get required repositories
      const WalletRepo = require("../repo/wallet.repo");
      const AssetUserRepo = require("../repo/assetUser.repo");

      // Get asset wallet
      const assetWallet = await WalletRepo.findOne({
        query: { cooperativeId, assetId, walletType: "asset" },
      });
      if (!assetWallet) {
        throw new Error("Asset wallet not found");
      }

      // Get external wallet
      const externalWallet = await WalletRepo.findOne({
        query: { cooperativeId, walletType: "external" },
      });
      if (!externalWallet) {
        throw new Error("External wallet not found");
      }

      // DR (Debit) external wallet - Money subtracted from external wallet (money coming in from external payment)
      await WalletRepo.updateWithSession(
        externalWallet._id,
        {
          $inc: { ledger_balance: -transaction.amount },
          $push: { transactions: transaction._id },
        },
        session
      );

      // CR (Credit) asset wallet - Money going to asset
      await WalletRepo.updateWithSession(
        assetWallet._id,
        {
          $inc: { ledger_balance: transaction.amount },
          $push: { transactions: transaction._id },
        },
        session
      );

      // Update or create asset user record to track member's asset holdings
      await AssetUserRepo.findOrCreate(
        memberId,
        assetId,
        cooperativeId,
        session
      );
      await AssetUserRepo.addInvestment(
        memberId,
        assetId,
        quantity,
        transaction.amount / quantity, // price per unit
        transaction._id,
        session
      );

      console.log(
        `Successfully processed asset purchase for transaction: ${transaction._id}`
      );
    } catch (error) {
      console.error(`Error processing asset purchase: ${error.message}`);
      throw error;
    }
  };

  static processContribution = async (transaction, session = null) => {
    try {
      console.log(
        `Processing contribution for transaction: ${transaction._id}`
      );

      let memberId, cooperativeId;

      if (transaction?.metadata) {
        memberId = transaction.metadata.memberId;
        cooperativeId = transaction.metadata.cooperativeId;
      } else {
        memberId = transaction.member;
        cooperativeId = transaction.cooperativeId;
      }

      // Get required repositories
      const WalletRepo = require("../repo/wallet.repo");

      // Get cooperative contribution wallet
      const contributionWallet = await WalletRepo.findOne({
        query: { cooperativeId, walletType: "contribution" },
      });
      if (!contributionWallet) {
        throw new Error("Contribution wallet not found");
      }

      // Get external wallet
      const externalWallet = await WalletRepo.findOne({
        query: { cooperativeId, walletType: "external" },
      });
      if (!externalWallet) {
        throw new Error("External wallet not found");
      }

      // DR (Debit) external wallet - Money subtracted from external wallet (money coming in from external payment)
      await WalletRepo.updateWithSession(
        externalWallet._id,
        {
          $inc: { ledger_balance: -transaction.amount },
          $push: { transactions: transaction._id },
        },
        session
      );

      // CR (Credit) contribution wallet - Money going to cooperative contribution
      await WalletRepo.updateWithSession(
        contributionWallet._id,
        {
          $inc: { ledger_balance: transaction.amount },
          $push: { transactions: transaction._id },
        },
        session
      );

      // CR (Credit) member's wallet - For tracking member's balance
      let memberWallet = await WalletRepo.findOne({
        query: {
          member: memberId,
          cooperativeId,
          assetId: null,
        },
      });
      if (!memberWallet) {
        memberWallet = await WalletRepo.create({
          member: memberId,
          cooperativeId,
          assetId: null,
          currency: transaction.currency,
        });
      }
      await WalletRepo.updateWithSession(
        memberWallet._id,
        {
          $inc: { ledger_balance: transaction.amount },
          $push: { transactions: transaction._id },
        },
        session
      );

      console.log(
        `Successfully processed contribution for transaction: ${transaction._id}`
      );
    } catch (error) {
      console.error(`Error processing contribution: ${error.message}`);
      throw error;
    }
  };
}

module.exports = WebhookService;
