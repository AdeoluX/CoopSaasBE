const mongoose = require("mongoose");

const { Schema } = mongoose;
const ActivityRepo = require("../repo/activity.repo");

const WalletSchema = new Schema(
  {
    member: {
      type: Schema.Types.ObjectId,
      ref: "Member",
    },
    cooperativeId: {
      type: Schema.Types.ObjectId,
      ref: "Cooperative",
      required: true,
    },
    assetId: {
      type: Schema.Types.ObjectId,
      ref: "Assets",
      default: null,
    },
    ledger_balance: {
      type: Number,
      default: 0,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    transactions: [
      {
        type: Schema.Types.ObjectId,
        ref: "Transaction",
      },
    ],
    currency: {
      type: String,
      enum: ["NGN", "USD"],
      default: "NGN",
    },
    walletType: {
      type: String,
      enum: ["contribution", "external", "asset", "member"],
      default: "member",
    },
  },
  {
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
  }
);

WalletSchema.virtual("availableBalance").get(function () {
  const amount =
    this.ledger_balance -
    this.transactions
      .filter((t) => t.status === "pending" && t.type === "DR")
      .reduce((sum, transaction) => sum + transaction.amount, 0);
  return amount;
});

// Static method to find or create wallet
WalletSchema.statics.findOrCreate = async function (
  memberId,
  cooperativeId,
  assetId = null,
  currency = "NGN"
) {
  let wallet = await this.findOne({
    member: memberId,
    assetId: assetId,
  });

  if (!wallet) {
    wallet = await this.create({
      member: memberId,
      cooperativeId,
      assetId,
      currency,
    });
  }

  return wallet;
};

// Instance method to update balance
WalletSchema.methods.updateBalance = async function (
  amount,
  transactionId,
  type = "CR",
  session = null
) {
  const balanceChange = type === "DR" ? -amount : amount;

  const updateData = {
    $inc: { ledger_balance: balanceChange },
    $push: { transactions: transactionId },
  };

  const options = { new: true, runValidators: true };
  if (session) options.session = session;

  const updatedWallet = await this.constructor.findByIdAndUpdate(
    this._id,
    updateData,
    options
  );

  // Log activity for wallet balance update
  await ActivityRepo.logActivity(
    {
      type: "wallet_balance_updated",
      category: "wallet", // ✅ Explicitly set category
      member: this.member,
      cooperativeId: this.cooperativeId,
      status: "success",
      title: "Wallet Balance Updated",
      description: `Wallet balance ${
        type === "CR" ? "increased" : "decreased"
      } by ${amount} ${this.currency || "NGN"}`,
      metadata: {
        amount,
        type,
        currency: this.currency || "NGN",
        transactionId,
        balanceChange,
        newBalance: updatedWallet.ledger_balance,
      },
      relatedEntities: {
        wallet: this._id,
        transaction: transactionId,
      },
    },
    session
  );

  return updatedWallet;
};

// Instance method to check if wallet has sufficient balance
WalletSchema.methods.hasSufficientBalance = function (amount) {
  return this.availableBalance >= amount;
};

// Instance method to get transaction history
WalletSchema.methods.getTransactionHistory = async function (options = {}) {
  const { limit = 10, skip = 0, sort = { createdAt: -1 } } = options;

  const Transaction = mongoose.model("Transaction");

  return await Transaction.find({
    _id: { $in: this.transactions },
  })
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate("cooperativeId", "name code");
};

const Wallet = mongoose.model("Wallet", WalletSchema);

module.exports = Wallet;
