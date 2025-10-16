const mongoose = require("mongoose");

const { Schema } = mongoose;
const ActivityRepo = require("../repo/activity.repo");

const TransactionSchema = new Schema({
  member: { type: Schema.Types.ObjectId, ref: "Member" },
  cooperativeId: {
    type: Schema.Types.ObjectId,
    ref: "Cooperative",
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: [0, "Amount cannot be negative"],
  },
  status: {
    type: String,
    enum: ["pending", "success", "failed", "abadoned"],
    default: "pending",
    required: true,
  },
  type: {
    type: String,
    enum: ["DR", "CR"],
    required: true,
  },
  descriptions: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  reference: {
    type: String,
    required: true,
    unique: true,
  },
  currency: {
    type: String,
    enum: ["NGN", "USD"],
    default: "NGN",
  },
  assetUserId: {
    required: false,
    type: Schema.Types.ObjectId,
    ref: "AssetUser",
  },
  assetId: {
    required: false,
    type: Schema.Types.ObjectId,
    ref: "Assets",
  },
});

// Index for better query performance
TransactionSchema.index({ member: 1, createdAt: -1 });
TransactionSchema.index({ reference: 1 }, { unique: true });
TransactionSchema.index({ cooperativeId: 1, status: 1 });

// Static method to create contribution transaction
TransactionSchema.statics.createContribution = async function (
  data,
  session = null
) {
  const transactionData = {
    ...data,
    type: "CR",
    status: "pending",
  };

  const options = session ? { session } : {};
  return await this.create([transactionData], options);
};

// Static method to create withdrawal transaction
TransactionSchema.statics.createWithdrawal = async function (
  data,
  session = null
) {
  const transactionData = {
    ...data,
    type: "DR",
    status: "pending",
  };

  const options = session ? { session } : {};
  return await this.create([transactionData], options);
};

// Static method to update transaction status
TransactionSchema.statics.updateStatus = async function (
  transactionId,
  status,
  session = null
) {
  const options = { new: true, runValidators: true };
  if (session) options.session = session;

  return await this.findByIdAndUpdate(transactionId, { status }, options);
};

// Static method to get member transactions with pagination
TransactionSchema.statics.getMemberTransactions = async function (
  memberId,
  options = {}
) {
  const {
    page = 1,
    limit = 10,
    search = null,
    startDate = null,
    endDate = null,
    status = null,
    type = null,
  } = options;

  const skip = (page - 1) * limit;

  // Build query
  const query = { member: memberId };

  if (search) {
    query.$or = [
      { descriptions: { $regex: search, $options: "i" } },
      { reference: { $regex: search, $options: "i" } },
    ];
  }

  if (startDate) {
    query.createdAt = { ...query.createdAt, $gte: new Date(startDate) };
  }

  if (endDate) {
    query.createdAt = { ...query.createdAt, $lte: new Date(endDate) };
  }

  if (status) {
    query.status = status;
  }

  if (type) {
    query.type = type;
  }

  // Execute queries
  const [transactions, total] = await Promise.all([
    this.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("cooperativeId", "name code"),
    this.countDocuments(query),
  ]);

  return {
    data: transactions,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / limit),
      hasNextPage: Number(page) < Math.ceil(total / limit),
      hasPrevPage: Number(page) > 1,
    },
  };
};

// Static method to handle webhook status update and wallet balance update
TransactionSchema.statics.handleWebhookUpdate = async function (
  reference,
  status,
  session = null
) {
  const options = { new: true, runValidators: true };
  if (session) options.session = session;

  console.log(`Looking for transaction with reference: ${reference}`);

  // Find transaction first (without updating status)
  let transaction = await this.findOne({ reference });

  if (!transaction) {
    throw new Error(`Transaction with reference ${reference} not found`);
  }

  console.log(
    `Found transaction: ${transaction._id}, member: ${
      transaction.member
    }, amount: ${transaction.amount}, assetId: ${
      transaction.assetId || "null"
    }, current status: ${transaction.status}`
  );

  // Validate that the transaction is still pending (not already processed)
  if (transaction.status !== "pending") {
    console.log(
      `Transaction ${transaction._id} already processed with status: ${transaction.status}`
    );
    return transaction;
  }

  // Now update the transaction status
  transaction = await this.findByIdAndUpdate(
    transaction._id,
    { status },
    options
  );

  console.log(
    `Processing transaction with status: ${status}, current status: ${transaction.status}`
  );

  // If payment is successful, update wallet balance
  if (status === "success") {
    const Wallet = mongoose.model("Wallet");

    console.log(
      `Payment successful, looking for wallet for member: ${
        transaction.member
      }, currency: ${transaction.currency}, assetId: ${
        transaction.assetId || "null"
      }, transaction type: ${transaction.type}, amount: ${transaction.amount}`
    );

    // Validate transaction data
    if (!transaction.amount || transaction.amount <= 0) {
      throw new Error(`Invalid transaction amount: ${transaction.amount}`);
    }

    if (!transaction.type || !["CR", "DR"].includes(transaction.type)) {
      throw new Error(`Invalid transaction type: ${transaction.type}`);
    }

    // Find wallet for this member, currency, and assetId
    // The assetId can be null for general contributions or a specific asset ID for asset-specific contributions
    const walletQuery = Wallet.findOne({
      member: transaction.member,
      currency: transaction.currency,
      assetId: transaction.assetId || null,
    });

    if (session) {
      walletQuery.session(session);
    }

    const wallet = await walletQuery;

    // Debug: Let's also try to find any wallet for this member to see what exists
    const allWalletsForMember = await Wallet.find({
      member: transaction.member,
    });
    console.log(
      `Found ${allWalletsForMember.length} wallets for member ${transaction.member}:`,
      allWalletsForMember.map((w) => ({
        id: w._id,
        currency: w.currency,
        assetId: w.assetId,
        balance: w.ledger_balance,
      }))
    );

    if (wallet) {
      console.log(
        `Found wallet: ${wallet._id}, current balance: ${wallet.ledger_balance}`
      );

      // Update wallet balance
      const updatedWallet = await wallet.updateBalance(
        transaction.amount,
        transaction._id,
        transaction.type,
        session
      );

      console.log(
        `Updated wallet balance for wallet: ${wallet._id}, new balance: ${updatedWallet.ledger_balance}, amount added: ${transaction.amount}`
      );

      // Log activity for successful transaction
      await ActivityRepo.logTransactionActivity(
        "transaction_successful",
        transaction.member,
        transaction.cooperativeId,
        transaction._id,
        {
          amount: transaction.amount,
          currency: transaction.currency,
          type: transaction.type,
          reference: transaction.reference,
          walletId: wallet._id,
          newBalance: updatedWallet.ledger_balance,
        },
        session
      );

      console.log(
        `Activity logged for successful transaction: ${transaction._id}`
      );
    } else {
      // Fallback: Try to find any wallet for this member and assetId (ignore currency)
      console.log(
        `No wallet found with exact match, trying fallback lookup...`
      );
      const fallbackWalletQuery = Wallet.findOne({
        member: transaction.member,
        assetId: transaction.assetId || null,
      });

      if (session) {
        fallbackWalletQuery.session(session);
      }

      const fallbackWallet = await fallbackWalletQuery;

      if (fallbackWallet) {
        console.log(
          `Found fallback wallet: ${fallbackWallet._id}, current balance: ${fallbackWallet.ledger_balance}`
        );

        // Update wallet balance
        const updatedWallet = await fallbackWallet.updateBalance(
          transaction.amount,
          transaction._id,
          transaction.type,
          session
        );

        console.log(
          `Updated fallback wallet balance for wallet: ${fallbackWallet._id}, new balance: ${updatedWallet.ledger_balance}, amount added: ${transaction.amount}`
        );

        // Log activity for successful transaction (fallback wallet)
        await ActivityRepo.logTransactionActivity(
          "transaction_successful",
          transaction.member,
          transaction.cooperativeId,
          transaction._id,
          {
            amount: transaction.amount,
            currency: transaction.currency,
            type: transaction.type,
            reference: transaction.reference,
            walletId: fallbackWallet._id,
            newBalance: updatedWallet.ledger_balance,
            fallbackWallet: true,
          },
          session
        );

        console.log(
          `Activity logged for successful transaction (fallback): ${transaction._id}`
        );
      } else {
        throw new Error(
          `Wallet not found for member ${transaction.member}, currency ${
            transaction.currency
          }, and assetId ${transaction.assetId || "null"}`
        );
      }
    }
  }

  // Log activity for transaction status change
  if (status === "failed") {
    await ActivityRepo.logTransactionActivity(
      "transaction_failed",
      transaction.member,
      transaction.cooperativeId,
      transaction._id,
      {
        amount: transaction.amount,
        currency: transaction.currency,
        type: transaction.type,
        reference: transaction.reference,
      },
      session
    );

    console.log(`Activity logged for failed transaction: ${transaction._id}`);
  }

  return transaction;
};

// Instance method to check if transaction is successful
TransactionSchema.methods.isSuccessful = function () {
  return this.status === "success";
};

// Instance method to check if transaction is pending
TransactionSchema.methods.isPending = function () {
  return this.status === "pending";
};

// Instance method to check if transaction is failed
TransactionSchema.methods.isFailed = function () {
  return this.status === "failed";
};

// Pre-save middleware to validate amount
TransactionSchema.pre("save", function (next) {
  if (this.amount <= 0) {
    return next(new Error("Transaction amount must be greater than 0"));
  }
  next();
});

const Transaction = mongoose.model("Transaction", TransactionSchema);

module.exports = Transaction;
