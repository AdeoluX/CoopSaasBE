const mongoose = require("mongoose");
const Transaction = require("../models/Transactions");
const Wallet = require("../models/Wallet");

/**
 * Create transaction without updating wallet balance (for pending transactions)
 * @param {Object} params - Parameters object
 * @param {Object} params.transaction - Transaction data
 * @returns {Promise<Object>} - Result object with success status and data
 */
const createPendingTransaction = async ({ transaction }) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // Create transaction with pending status
    const newTransaction = await Transaction.create(
      [
        {
          ...transaction,
          status: "pending",
          _id: new mongoose.Types.ObjectId(),
        },
      ],
      { session }
    );

    await session.commitTransaction();

    return {
      success: true,
      transaction: newTransaction[0],
    };
  } catch (error) {
    await session.abortTransaction();

    return {
      success: false,
      error: error.message,
      code: error.code || "UNKNOWN_ERROR",
    };
  } finally {
    await session.endSession();
  }
};

/**
 * Batch transaction and wallet update with proper error handling
 * @param {Object} params - Parameters object
 * @param {Object} params.transaction - Transaction data
 * @param {Object} params.wallet - Wallet object
 * @param {String} params.type - Transaction type ('DR' or 'CR')
 * @returns {Promise<Object>} - Result object with success status and data
 */
const txnWallBatch = async ({ transaction, wallet, type }) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // Create transaction
    const newTransaction = await Transaction.create(
      [
        {
          ...transaction,
          _id: new mongoose.Types.ObjectId(),
        },
      ],
      { session }
    );

    // Calculate balance change
    const balanceChange =
      type === "DR" ? -Number(transaction.amount) : Number(transaction.amount);

    // Update wallet
    const updatedWallet = await Wallet.findByIdAndUpdate(
      wallet._id,
      {
        $inc: { ledger_balance: balanceChange },
        $push: { transactions: newTransaction[0]._id },
      },
      {
        session,
        new: true,
        runValidators: true,
      }
    );

    await session.commitTransaction();

    return {
      success: true,
      transaction: newTransaction[0],
      wallet: updatedWallet,
      balanceChange,
    };
  } catch (error) {
    await session.abortTransaction();

    return {
      success: false,
      error: error.message,
      code: error.code || "UNKNOWN_ERROR",
    };
  } finally {
    await session.endSession();
  }
};

/**
 * Update wallet balance for an existing transaction (used in webhooks)
 * @param {Object} params - Parameters object
 * @param {String} params.transactionId - Transaction ID
 * @param {String} params.walletId - Wallet ID
 * @param {Number} params.amount - Transaction amount
 * @param {String} params.type - Transaction type ('DR' or 'CR')
 * @returns {Promise<Object>} - Result object with success status and data
 */
const updateWalletForTransaction = async ({
  transactionId,
  walletId,
  amount,
  type,
}) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // Update transaction status to success
    const updatedTransaction = await Transaction.updateStatus(
      transactionId,
      "success",
      session
    );

    // Update wallet balance
    const wallet = await Wallet.findById(walletId).session(session);
    if (!wallet) {
      throw new Error("Wallet not found");
    }

    const updatedWallet = await wallet.updateBalance(
      amount,
      transactionId,
      type,
      session
    );

    await session.commitTransaction();

    return {
      success: true,
      transaction: updatedTransaction,
      wallet: updatedWallet,
    };
  } catch (error) {
    await session.abortTransaction();

    return {
      success: false,
      error: error.message,
      code: error.code || "UNKNOWN_ERROR",
    };
  } finally {
    await session.endSession();
  }
};

/**
 * Process multiple transactions in batch
 * @param {Array} transactions - Array of transaction objects
 * @returns {Promise<Array>} - Array of results
 */
const processBatchTransactions = async (transactions) => {
  const results = [];

  for (const txn of transactions) {
    const result = await txnWallBatch(txn);
    results.push(result);

    // If any transaction fails, you might want to handle it
    if (!result.success) {
      console.error(`Transaction failed: ${result.error}`);
    }
  }

  return results;
};

module.exports = {
  txnWallBatch,
  createPendingTransaction,
  updateWalletForTransaction,
  processBatchTransactions,
};
