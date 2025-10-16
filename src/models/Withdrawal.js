const mongoose = require("mongoose");

// Ensure required models are loaded
require("./Members");
require("./Assets");
require("./Transactions");
require("./Cooperative");

const WithdrawalSchema = new mongoose.Schema(
  {
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
    },
    cooperativeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cooperative",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    withdrawalType: {
      type: String,
      enum: ["contribution", "asset"],
      required: true,
    },
    assetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assets",
      // Required only for asset withdrawals
    },
    currency: {
      type: String,
      default: "NGN",
    },
    reason: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "completed"],
      default: "pending",
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cooperative",
      // Admin who approved/rejected
    },
    approvedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      // Reason if rejected
    },
    completedAt: {
      type: Date,
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transactions",
      // Reference to the transaction created when approved
    },
  },
  { timestamps: true }
);

// Indexes for better query performance
WithdrawalSchema.index({ member: 1, cooperativeId: 1 });
WithdrawalSchema.index({ cooperativeId: 1, status: 1 });
WithdrawalSchema.index({ requestedAt: -1 });

// Static method to get pending withdrawals for cooperative
WithdrawalSchema.statics.getPendingWithdrawals = async function (
  cooperativeId,
  options = {}
) {
  const { page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;

  const withdrawals = await this.find({ cooperativeId, status: "pending" })
    .populate("member", "firstname lastname email phone")
    .populate("assetId", "name description")
    .sort({ requestedAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await this.countDocuments({ cooperativeId, status: "pending" });

  return {
    data: withdrawals,
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

// Instance method to approve withdrawal
WithdrawalSchema.methods.approve = async function (approvedBy, session = null) {
  this.status = "approved";
  this.approvedBy = approvedBy;
  this.approvedAt = new Date();

  const options = { new: true, runValidators: true };
  if (session) options.session = session;

  return await this.constructor.findByIdAndUpdate(this._id, this, options);
};

// Instance method to reject withdrawal
WithdrawalSchema.methods.reject = async function (
  approvedBy,
  rejectionReason,
  session = null
) {
  this.status = "rejected";
  this.approvedBy = approvedBy;
  this.approvedAt = new Date();
  this.rejectionReason = rejectionReason;

  const options = { new: true, runValidators: true };
  if (session) options.session = session;

  return await this.constructor.findByIdAndUpdate(this._id, this, options);
};

// Instance method to complete withdrawal
WithdrawalSchema.methods.complete = async function (
  transactionId,
  session = null
) {
  this.status = "completed";
  this.completedAt = new Date();
  this.transactionId = transactionId;

  const options = { new: true, runValidators: true };
  if (session) options.session = session;

  return await this.constructor.findByIdAndUpdate(this._id, this, options);
};

module.exports = mongoose.model("Withdrawal", WithdrawalSchema);
