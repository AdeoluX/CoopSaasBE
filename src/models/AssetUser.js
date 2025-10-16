const mongoose = require("mongoose");
const { Schema } = mongoose;

const AssetUserSchema = new Schema(
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
      min: [0, "Quantity cannot be negative"],
      default: 0,
    },
    totalInvested: {
      type: Number,
      required: true,
      min: [0, "Total invested cannot be negative"],
      default: 0,
    },
    status: {
      type: String,
      enum: ["active", "sold", "pending"],
      default: "active",
    },
    lastTransactionDate: {
      type: Date,
      default: Date.now,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
  }
);

// Virtual for average price calculation
AssetUserSchema.virtual("averagePrice").get(function () {
  if (this.quantity === 0) return 0;
  return this.totalInvested / this.quantity;
});

// Virtual for current value calculation (based on asset's current price)
AssetUserSchema.virtual("currentValue").get(function () {
  if (
    !this.populated("asset") ||
    !this.asset ||
    !this.asset.settings ||
    !this.asset.settings.pricePerUnit
  ) {
    return 0;
  }
  return this.quantity * this.asset.settings.pricePerUnit;
});

// Virtual for profit/loss calculation
AssetUserSchema.virtual("profitLoss").get(function () {
  return this.currentValue - this.totalInvested;
});

// Virtual for profit/loss percentage
AssetUserSchema.virtual("profitLossPercentage").get(function () {
  if (this.totalInvested === 0) return 0;
  return (this.profitLoss / this.totalInvested) * 100;
});

// Virtual for backward compatibility - totalInvestment
AssetUserSchema.virtual("totalInvestment").get(function () {
  return this.totalInvested;
});

// Virtual for backward compatibility - totalUnits
AssetUserSchema.virtual("totalUnits").get(function () {
  return this.quantity;
});

// Indexes for better query performance
AssetUserSchema.index({ member: 1, asset: 1 }, { unique: true });
AssetUserSchema.index({ cooperativeId: 1, status: 1 });
AssetUserSchema.index({ member: 1, status: 1 });
AssetUserSchema.index({ asset: 1, status: 1 });

// Pre-save middleware to update timestamp
AssetUserSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

// Static method to find or create asset holding
AssetUserSchema.statics.findOrCreate = async function (
  memberId,
  assetId,
  cooperativeId,
  session = null
) {
  const options = session ? { session } : {};

  let assetHolding = await this.findOne({
    member: memberId,
    asset: assetId,
  }).session(session);

  if (!assetHolding) {
    assetHolding = await this.create(
      [
        {
          member: memberId,
          asset: assetId,
          cooperativeId,
          quantity: 0,
          totalInvested: 0,
        },
      ],
      options
    );
  }

  return assetHolding[0] || assetHolding;
};

// Static method to add investment to asset holding
AssetUserSchema.statics.addInvestment = async function (
  memberId,
  assetId,
  quantity,
  price,
  transactionId,
  session = null
) {
  const options = session ? { session } : {};

  const assetHolding = await this.findOne({
    member: memberId,
    asset: assetId,
  }).session(session);

  if (!assetHolding) {
    throw new Error("Asset holding not found");
  }

  const investmentAmount = quantity * price;
  const newTotalQuantity = assetHolding.quantity + quantity;
  const newTotalInvested = assetHolding.totalInvested + investmentAmount;

  // Update the asset holding
  const updatedHolding = await this.findByIdAndUpdate(
    assetHolding._id,
    {
      quantity: newTotalQuantity,
      totalInvested: newTotalInvested,
      lastTransactionDate: new Date(),
    },
    { new: true, runValidators: true, ...options }
  );

  return updatedHolding;
};

// Static method to sell asset holding
AssetUserSchema.statics.sellAsset = async function (
  memberId,
  assetId,
  quantity,
  price,
  transactionId,
  session = null
) {
  const options = session ? { session } : {};

  const assetHolding = await this.findOne({
    member: memberId,
    asset: assetId,
  }).session(session);

  if (!assetHolding) {
    throw new Error("Asset holding not found");
  }

  if (assetHolding.quantity < quantity) {
    throw new Error("Insufficient quantity to sell");
  }

  const newQuantity = assetHolding.quantity - quantity;
  const soldProportion = quantity / assetHolding.quantity;
  const soldInvestment = assetHolding.totalInvested * soldProportion;
  const newTotalInvested = assetHolding.totalInvested - soldInvestment;

  // Update the asset holding
  const updatedHolding = await this.findByIdAndUpdate(
    assetHolding._id,
    {
      quantity: newQuantity,
      totalInvested: newTotalInvested,
      lastTransactionDate: new Date(),
      status: newQuantity === 0 ? "sold" : "active",
    },
    { new: true, runValidators: true, ...options }
  );

  return updatedHolding;
};

// Static method to get member portfolio
AssetUserSchema.statics.getMemberPortfolio = async function (
  memberId,
  options = {}
) {
  const { page = 1, limit = 10, status = "active" } = options;

  const skip = (page - 1) * limit;

  const query = { member: memberId };
  if (status) {
    query.status = status;
  }

  const [holdings, total] = await Promise.all([
    this.find(query)
      .populate("asset", "name description image settings")
      .populate("cooperativeId", "name code")
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean({ virtuals: true }),
    this.countDocuments(query),
  ]);

  return {
    data: holdings,
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

// Static method to get asset holders
AssetUserSchema.statics.getAssetHolders = async function (
  assetId,
  options = {}
) {
  const { page = 1, limit = 10, status = "active" } = options;

  const skip = (page - 1) * limit;

  const query = { asset: assetId };
  if (status) {
    query.status = status;
  }

  const [holdings, total] = await Promise.all([
    this.find(query)
      .populate("member", "firstname lastname email")
      .populate("cooperativeId", "name code")
      .populate("asset", "name description image settings")
      .sort({ quantity: -1 })
      .skip(skip)
      .limit(limit)
      .lean({ virtuals: true }),
    this.countDocuments(query),
  ]);

  return {
    data: holdings,
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

// Instance method to calculate total portfolio value
AssetUserSchema.methods.calculatePortfolioValue = function () {
  return this.currentValue;
};

// Static method to get transactions for a specific asset holding
AssetUserSchema.statics.getAssetTransactions = async function (
  assetUserId,
  options = {}
) {
  const { limit = 10, skip = 0, sort = { createdAt: -1 } } = options;

  const Transaction = mongoose.model("Transaction");

  return await Transaction.find({
    assetUserId: assetUserId,
  })
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate("cooperativeId", "name code");
};

// Method to transform document to JSON
AssetUserSchema.methods.toJSON = function () {
  const obj = this.toObject();

  // Remove empty fields
  Object.keys(obj).forEach((key) => {
    if (obj[key] === null || obj[key] === undefined || obj[key] === "") {
      delete obj[key];
    }
  });

  return obj;
};

const AssetUser = mongoose.model("AssetUser", AssetUserSchema);

module.exports = AssetUser;
