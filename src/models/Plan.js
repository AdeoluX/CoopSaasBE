const mongoose = require("mongoose");

const PlanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    tier: {
      type: String,
      enum: ["starter", "growth", "enterprise"],
      required: true,
      unique: true,
    },
    monthly_fee: {
      type: Number,
      required: true,
      min: 0,
    },
    member_limit: {
      type: Number,
      required: true,
      min: 1,
    },
    transaction_limit: {
      type: Number,
      required: true,
      min: 0,
    },
    features: {
      basic_member_management: { type: Boolean, default: false },
      payment_collection: { type: Boolean, default: false },
      basic_reporting: { type: Boolean, default: false },
      loan_tracking: { type: Boolean, default: false },
      automated_payouts: { type: Boolean, default: false },
      priority_support: { type: Boolean, default: false },
      custom_integrations: { type: Boolean, default: false },
      dedicated_account_manager: { type: Boolean, default: false },
      advanced_analytics: { type: Boolean, default: false },
    },
    description: {
      type: String,
      required: true,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    sort_order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Index for better query performance
PlanSchema.index({ tier: 1 });
PlanSchema.index({ is_active: 1 });
PlanSchema.index({ sort_order: 1 });

// Method to transform document to JSON
PlanSchema.methods.toJSON = function () {
  const obj = this.toObject();

  // Remove empty fields
  Object.keys(obj).forEach((key) => {
    if (obj[key] === null || obj[key] === undefined || obj[key] === "") {
      delete obj[key];
    }
  });

  return obj;
};

const Plan = mongoose.model("Plan", PlanSchema);

module.exports = Plan;
