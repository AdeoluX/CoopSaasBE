const mongoose = require("mongoose");
const crypto = require("crypto");

const CooperativeSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      unique: true,
      index: true,
    },
    code: {
      type: String, // You can also use Schema.Types.String if UUIDs are stored as strings
      default: function () {
        return "coo_" + crypto.randomUUID().split("-").join("").slice(0, 12); // Replaced arrow function with a regular function
      },
    },
    name: {
      type: String,
      required: true,
    },
    auth_credentials: {
      email: { type: String, required: true, unique: true },
      password: { type: String, required: true },
    },
    is_active: { type: Boolean, default: true },
    settings: {
      timezone: { type: String },
      language: { type: String },
      currency: { type: String },
      subscription_plan: {
        expires_at: { type: Date },
        plan_id: { type: mongoose.Schema.Types.ObjectId, ref: "Plan" },
      },
      loans: {
        personal_interest_rate: { type: Number, default: 15, min: 0, max: 100 },
        business_interest_rate: { type: Number, default: 18, min: 0, max: 100 },
        emergency_interest_rate: {
          type: Number,
          default: 20,
          min: 0,
          max: 100,
        },
        investment_interest_rate: {
          type: Number,
          default: 16,
          min: 0,
          max: 100,
        },
        max_loan_amount: { type: Number, default: 1000000 },
        min_loan_amount: { type: Number, default: 1000 },
        max_loan_term: { type: Number, default: 60 }, // months
        min_loan_term: { type: Number, default: 1 }, // months
        requires_collateral: { type: Boolean, default: false },
        requires_guarantor: { type: Boolean, default: false },
      },
      contributions: {
        min_contribution: { type: Number, default: 1000 },
        max_contribution: { type: Number, default: 10000000 },
        contribution_frequency: {
          type: String,
          enum: ["daily", "weekly", "monthly", "quarterly", "yearly"],
          default: "monthly",
        },
      },
      assets: {
        min_investment: { type: Number, default: 1000 },
        max_investment: { type: Number, default: 10000000 },
        requires_approval: { type: Boolean, default: false },
      },
    },
    subaccounts: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Subaccount",
        },
      ],
    },
    kyc_details: {
      nin: { type: String },
      rc: { type: String },
    },
    logo: { type: String },
    address: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      country: { type: String },
      postal_code: { type: String },
    },
    contact_details: {
      phone: { type: String },
      email: { type: String },
      website: { type: String },
    },
    social_media: {
      facebook: { type: String },
      twitter: { type: String },
      instagram: { type: String },
      linkedin: { type: String },
    },
  },
  { timestamps: true }
);

// Ensure unique slug
CooperativeSchema.index({ slug: 1 }, { unique: true });

// Make RC unique only when present (allow multiple nulls)
CooperativeSchema.index(
  { "kyc_details.rc": 1 },
  { unique: true, sparse: true }
);

// Make phone unique only when present (allow multiple nulls)
CooperativeSchema.index(
  { "contact_details.phone": 1 },
  { unique: true, sparse: true }
);

// Method to transform document to JSON
CooperativeSchema.methods.toJSON = function () {
  const obj = this.toObject();

  // Remove sensitive fields
  delete obj.auth_credentials.password;
  delete obj.cac;
  delete obj.accountDetails?.accountNumber;

  // Remove empty fields
  Object.keys(obj).forEach((key) => {
    if (obj[key] === null || obj[key] === undefined || obj[key] === "") {
      delete obj[key];
    }
  });

  return obj;
};

// Method to get sensitive data (for internal use only)
CooperativeSchema.methods.getSensitiveData = function () {
  const obj = this.toObject();
  return {
    password: obj.password,
    cac: obj.cac,
    accountNumber: obj.accountDetails?.accountNumber,
  };
};

// Pre-save middleware to ensure password is hashed
CooperativeSchema.pre("save", async function (next) {
  if (!this.isModified("auth_credentials.password")) return next();

  try {
    const bcrypt = require("bcryptjs");
    const salt = await bcrypt.genSalt(10);
    this.auth_credentials.password = await bcrypt.hash(
      this.auth_credentials.password,
      salt
    );
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
CooperativeSchema.methods.comparePassword = async function (candidatePassword) {
  const bcrypt = require("bcryptjs");
  return bcrypt.compare(candidatePassword, this.auth_credentials.password);
};

module.exports = mongoose.model("Cooperative", CooperativeSchema);
