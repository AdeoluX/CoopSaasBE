/**
 * Utility functions for handling database transactions
 */

/**
 * Check if the current MongoDB connection supports transactions
 * @returns {boolean} True if transactions are supported
 */
const isTransactionSupported = () => {
  // Check if we're connected to a replica set or mongos
  const connection = require("mongoose").connection;

  if (!connection || !connection.db) {
    return false;
  }

  // For development, we'll assume transactions are not supported
  // In production, you can implement proper detection logic here
  return (
    process.env.NODE_ENV === "production" &&
    process.env.ENABLE_TRANSACTIONS === "true"
  );
};

/**
 * Execute a function with transaction support if available, otherwise execute without
 * @param {Function} fn - Function to execute
 * @param {Object} options - Options for transaction
 * @returns {Promise} Result of the function execution
 */
const executeWithTransaction = async (fn, options = {}) => {
  if (isTransactionSupported()) {
    const mongoose = require("mongoose");
    const session = await mongoose.startSession();

    try {
      session.startTransaction();
      const result = await fn(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  } else {
    // Execute without transaction for development
    return await fn(null);
  }
};

module.exports = {
  isTransactionSupported,
  executeWithTransaction,
};
