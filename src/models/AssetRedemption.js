const mongoose = require("mongoose");
const { Schema } = mongoose;

const AssetRedemptionSchema = new Schema(
  {
    member: {
      type: Schema.Types.ObjectId,
      ref: "Member",
      required: true,
    },
    asset: {
      type: Schema.Types.ObjectId,
      ref: "Assets",
      required: true,
    },
    cooperativeId: {
      type: Schema.Types.ObjectId,
      ref: "Cooperative",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, "Quantity must be at least 1"],
    },
    redemptionAmount: {
      type: Number,
      required: true,
      min: [0, "Redemption amount cannot be negative"],
    },
    currentPricePerUnit: {
      type: Number,
      required: true,
      min: [0, "Price per unit cannot be negative"],
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "completed"],
      default: "pending",
    },
    reason: {
      type: String,
      required: true,
      maxlength: [500, "Reason cannot exceed 500 characters"],
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "Member",
      // Admin who approved/rejected
    },
    approvedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      maxlength: [500, "Rejection reason cannot exceed 500 characters"],
    },
    completedAt: {
      type: Date,
    },
    transactionId: {
      type: Schema.Types.ObjectId,
      ref: "Transaction",
      // Reference to the transaction created when approved
    },
    currency: {
      type: String,
      enum: ["NGN", "USD"],
      default: "NGN",
    },
    metadata: {
      // Additional data for tracking
      originalInvestment: Number, // Original amount invested
      profitLoss: Number, // Profit or loss on this redemption
      averagePrice: Number, // Average price paid for the units being redeemed
    },
  },
  {
    timestamps: true,
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
  }
);

// Virtual for profit/loss calculation
AssetRedemptionSchema.virtual("profitLossAmount").get(function () {
  if (!this.metadata || !this.metadata.originalInvestment) return 0;
  return this.redemptionAmount - this.metadata.originalInvestment;
});

// Virtual for profit/loss percentage
AssetRedemptionSchema.virtual("profitLossPercentage").get(function () {
  if (
    !this.metadata ||
    !this.metadata.originalInvestment ||
    this.metadata.originalInvestment === 0
  ) {
    return 0;
  }
  return (this.profitLossAmount / this.metadata.originalInvestment) * 100;
});

// Indexes for better query performance
AssetRedemptionSchema.index({ member: 1, cooperativeId: 1 });
AssetRedemptionSchema.index({ cooperativeId: 1, status: 1 });
AssetRedemptionSchema.index({ asset: 1, status: 1 });
AssetRedemptionSchema.index({ requestedAt: -1 });

// Static method to get pending redemptions for cooperative
AssetRedemptionSchema.statics.getPendingRedemptions = async function (
  cooperativeId,
  options = {}
) {
  const { page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;

  const redemptions = await this.find({ cooperativeId, status: "pending" })
    .populate("member", "firstname lastname email phone")
    .populate("asset", "name description settings")
    .populate("approvedBy", "firstname lastname")
    .sort({ requestedAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await this.countDocuments({ cooperativeId, status: "pending" });

  return {
    data: redemptions,
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

// Static method to get member's redemptions
AssetRedemptionSchema.statics.getMemberRedemptions = async function (
  memberId,
  cooperativeId,
  options = {}
) {
  const { page = 1, limit = 10, status } = options;
  const skip = (page - 1) * limit;

  let query = { member: memberId, cooperativeId };
  if (status) {
    query.status = status;
  }

  const redemptions = await this.find(query)
    .populate("asset", "name description settings")
    .populate("approvedBy", "firstname lastname")
    .sort({ requestedAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await this.countDocuments(query);

  return {
    data: redemptions,
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

module.exports = mongoose.model("AssetRedemption", AssetRedemptionSchema);
