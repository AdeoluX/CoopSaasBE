const mongoose = require("mongoose");
const { Schema } = mongoose;

const ActivitySchema = new Schema(
  {
    member: {
      type: Schema.Types.ObjectId,
      ref: "Member",
      required: false, // Some activities might not be member-specific
    },
    cooperativeId: {
      type: Schema.Types.ObjectId,
      ref: "Cooperative",
      required: true,
    },
    type: {
      type: String,
      enum: [
        // Authentication & User Activities
        "user_login",
        "user_logout",
        "user_registration",
        "password_reset",
        "email_verification",
        "profile_update",

        // Transaction Activities
        "transaction_initiated",
        "transaction_successful",
        "transaction_failed",
        "transaction_abandoned",
        "contribution_made",
        "withdrawal_requested",
        "withdrawal_processed",

        // Loan Activities
        "loan_application_submitted",
        "loan_application_approved",
        "loan_application_rejected",
        "loan_disbursed",
        "loan_payment_made",
        "loan_completed",
        "loan_defaulted",
        "loan_overdue",

        // Asset Activities
        "asset_purchase_initiated",
        "asset_purchase_completed",
        "asset_sale_initiated",
        "asset_sale_completed",
        "asset_price_updated",
        "asset_created",
        "asset_updated",

        // Wallet Activities
        "wallet_created",
        "wallet_balance_updated",
        "wallet_funded",
        "wallet_withdrawn",

        // Admin Activities
        "admin_action",
        "member_added",
        "member_removed",
        "member_suspended",
        "member_activated",
        "cooperative_settings_updated",
        "bulk_operation",

        // System Activities
        "system_maintenance",
        "backup_created",
        "report_generated",
        "notification_sent",
        "webhook_received",
        "error_occurred",

        // KYC Activities
        "kyc_submitted",
        "kyc_approved",
        "kyc_rejected",
        "kyc_document_uploaded",

        // Payment Activities
        "payment_initiated",
        "payment_successful",
        "payment_failed",
        "refund_processed",
        "chargeback_received",
      ],
      required: true,
    },
    category: {
      type: String,
      enum: [
        "authentication",
        "transaction",
        "loan",
        "asset",
        "wallet",
        "admin",
        "system",
        "kyc",
        "payment",
      ],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "success", "failed", "cancelled"],
      default: "pending",
    },
    title: {
      type: String,
      required: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      required: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    // Related entities
    relatedEntities: {
      transaction: {
        type: Schema.Types.ObjectId,
        ref: "Transaction",
      },
      loan: {
        type: Schema.Types.ObjectId,
        ref: "Loan",
      },
      asset: {
        type: Schema.Types.ObjectId,
        ref: "Assets",
      },
      assetUser: {
        type: Schema.Types.ObjectId,
        ref: "AssetUser",
      },
      wallet: {
        type: Schema.Types.ObjectId,
        ref: "Wallet",
      },
      attachment: {
        type: Schema.Types.ObjectId,
        ref: "Attachment",
      },
    },
    // IP address and user agent for security tracking
    ipAddress: {
      type: String,
      maxlength: [45, "IP address cannot exceed 45 characters"],
    },
    userAgent: {
      type: String,
      maxlength: [500, "User agent cannot exceed 500 characters"],
    },
    // Location tracking (if available)
    location: {
      country: String,
      region: String,
      city: String,
      latitude: Number,
      longitude: Number,
    },
    // Severity level for filtering and alerting
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "low",
    },
    // Whether this activity should trigger notifications
    notifyUser: {
      type: Boolean,
      default: false,
    },
    // Whether this activity should be visible to the user
    visibleToUser: {
      type: Boolean,
      default: true,
    },
    // Timestamps
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

// Virtual for formatted timestamp
ActivitySchema.virtual("formattedDate").get(function () {
  return this.createdAt.toLocaleDateString();
});

// Virtual for time ago
ActivitySchema.virtual("timeAgo").get(function () {
  const now = new Date();
  const diffInSeconds = Math.floor((now - this.createdAt) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
  if (diffInSeconds < 3600)
    return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400)
    return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 2592000)
    return `${Math.floor(diffInSeconds / 86400)} days ago`;

  return `${Math.floor(diffInSeconds / 2592000)} months ago`;
});

// Indexes for better query performance
ActivitySchema.index({ member: 1, createdAt: -1 });
ActivitySchema.index({ cooperativeId: 1, createdAt: -1 });
ActivitySchema.index({ type: 1, createdAt: -1 });
ActivitySchema.index({ category: 1, createdAt: -1 });
ActivitySchema.index({ status: 1, createdAt: -1 });
ActivitySchema.index({ severity: 1, createdAt: -1 });
ActivitySchema.index({ "relatedEntities.transaction": 1 });
ActivitySchema.index({ "relatedEntities.loan": 1 });
ActivitySchema.index({ "relatedEntities.asset": 1 });

// Pre-save middleware to set category based on type
ActivitySchema.pre("save", function (next) {
  // Auto-set category based on type if not provided
  if (!this.category) {
    const typeToCategory = {
      // Authentication
      user_login: "authentication",
      user_logout: "authentication",
      user_registration: "authentication",
      password_reset: "authentication",
      email_verification: "authentication",
      profile_update: "authentication",

      // Transactions
      transaction_initiated: "transaction",
      transaction_successful: "transaction",
      transaction_failed: "transaction",
      transaction_abandoned: "transaction",
      contribution_made: "transaction",
      withdrawal_requested: "transaction",
      withdrawal_processed: "transaction",

      // Loans
      loan_application_submitted: "loan",
      loan_application_approved: "loan",
      loan_application_rejected: "loan",
      loan_disbursed: "loan",
      loan_payment_made: "loan",
      loan_completed: "loan",
      loan_defaulted: "loan",
      loan_overdue: "loan",

      // Assets
      asset_purchase_initiated: "asset",
      asset_purchase_completed: "asset",
      asset_sale_initiated: "asset",
      asset_sale_completed: "asset",
      asset_price_updated: "asset",
      asset_created: "asset",
      asset_updated: "asset",

      // Wallets
      wallet_created: "wallet",
      wallet_balance_updated: "wallet",
      wallet_funded: "wallet",
      wallet_withdrawn: "wallet",

      // Admin
      admin_action: "admin",
      member_added: "admin",
      member_removed: "admin",
      member_suspended: "admin",
      member_activated: "admin",
      cooperative_settings_updated: "admin",
      bulk_operation: "admin",

      // System
      system_maintenance: "system",
      backup_created: "system",
      report_generated: "system",
      notification_sent: "system",
      webhook_received: "system",
      error_occurred: "system",

      // KYC
      kyc_submitted: "kyc",
      kyc_approved: "kyc",
      kyc_rejected: "kyc",
      kyc_document_uploaded: "kyc",

      // Payment
      payment_initiated: "payment",
      payment_successful: "payment",
      payment_failed: "payment",
      refund_processed: "payment",
      chargeback_received: "payment",
    };

    this.category = typeToCategory[this.type] || "system";
  }

  this.updatedAt = new Date();
  next();
});

// Static method to log activity
ActivitySchema.statics.logActivity = async function (
  activityData,
  session = null
) {
  const options = session ? { session } : {};
  return await this.create([activityData], options);
};

// Static method to log transaction activity
ActivitySchema.statics.logTransactionActivity = async function (
  type,
  memberId,
  cooperativeId,
  transactionId,
  metadata = {},
  session = null
) {
  const activityData = {
    type,
    category: "transaction", // ✅ Explicitly set category
    member: memberId,
    cooperativeId,
    status: type.includes("successful")
      ? "success"
      : type.includes("failed")
      ? "failed"
      : "pending",
    title: this.getActivityTitle(type),
    description: this.getActivityDescription(type, metadata),
    metadata,
    relatedEntities: { transaction: transactionId },
    severity: this.getActivitySeverity(type),
    notifyUser: this.shouldNotifyUser(type),
  };

  return await this.logActivity(activityData, session);
};

// Static method to log loan activity
ActivitySchema.statics.logLoanActivity = async function (
  type,
  memberId,
  cooperativeId,
  loanId,
  metadata = {},
  session = null
) {
  const activityData = {
    type,
    category: "loan", // ✅ Explicitly set category
    member: memberId,
    cooperativeId,
    status: type.includes("approved")
      ? "success"
      : type.includes("rejected")
      ? "failed"
      : "pending",
    title: this.getActivityTitle(type),
    description: this.getActivityDescription(type, metadata),
    metadata,
    relatedEntities: { loan: loanId },
    severity: this.getActivitySeverity(type),
    notifyUser: this.shouldNotifyUser(type),
  };

  return await this.logActivity(activityData, session);
};

// Static method to log asset activity
ActivitySchema.statics.logAssetActivity = async function (
  type,
  memberId,
  cooperativeId,
  assetId,
  assetUserId = null,
  metadata = {},
  session = null
) {
  const activityData = {
    type,
    category: "asset", // ✅ Explicitly set category
    member: memberId,
    cooperativeId,
    status: type.includes("completed")
      ? "success"
      : type.includes("failed")
      ? "failed"
      : "pending",
    title: this.getActivityTitle(type),
    description: this.getActivityDescription(type, metadata),
    metadata,
    relatedEntities: {
      asset: assetId,
      ...(assetUserId && { assetUser: assetUserId }),
    },
    severity: this.getActivitySeverity(type),
    notifyUser: this.shouldNotifyUser(type),
  };

  return await this.logActivity(activityData, session);
};

// Static method to get member activity feed
ActivitySchema.statics.getMemberActivityFeed = async function (
  memberId,
  options = {}
) {
  const {
    page = 1,
    limit = 20,
    category = null,
    type = null,
    status = null,
  } = options;

  const skip = (page - 1) * limit;

  const query = { member: memberId, visibleToUser: true };

  if (category) query.category = category;
  if (type) query.type = type;
  if (status) query.status = status;

  const [activities, total] = await Promise.all([
    this.find(query)
      .populate("relatedEntities.transaction", "amount type status reference")
      .populate("relatedEntities.loan", "amount status loanType")
      .populate("relatedEntities.asset", "name description")
      .populate("relatedEntities.assetUser", "quantity totalInvested")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    this.countDocuments(query),
  ]);

  return {
    data: activities,
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

// Static method to get cooperative activity log (for admins)
ActivitySchema.statics.getCooperativeActivityLog = async function (
  cooperativeId,
  options = {}
) {
  const {
    page = 1,
    limit = 50,
    category = null,
    type = null,
    status = null,
    severity = null,
    startDate = null,
    endDate = null,
    search = null,
  } = options;

  const skip = (page - 1) * limit;

  const query = { cooperativeId };

  if (category) query.category = category;
  if (type) query.type = type;
  if (status) query.status = status;
  if (severity) query.severity = severity;

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  // Add search functionality
  if (search) {
    query.$or = [
      { description: { $regex: search, $options: "i" } },
      { title: { $regex: search, $options: "i" } },
      { "metadata.details": { $regex: search, $options: "i" } },
    ];
  }

  const [activities, total] = await Promise.all([
    this.find(query)
      .populate("member", "firstname lastname email")
      .populate("relatedEntities.transaction", "amount type status reference")
      .populate("relatedEntities.loan", "amount status loanType")
      .populate("relatedEntities.asset", "name description")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    this.countDocuments(query),
  ]);

  return {
    data: activities,
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

// Helper method to get activity title
ActivitySchema.statics.getActivityTitle = function (type) {
  const titles = {
    user_login: "User Login",
    user_logout: "User Logout",
    user_registration: "User Registration",
    password_reset: "Password Reset",
    email_verification: "Email Verification",
    profile_update: "Profile Updated",
    transaction_initiated: "Transaction Initiated",
    transaction_successful: "Transaction Successful",
    transaction_failed: "Transaction Failed",
    transaction_abandoned: "Transaction Abandoned",
    contribution_made: "Contribution Made",
    withdrawal_requested: "Withdrawal Requested",
    withdrawal_processed: "Withdrawal Processed",
    loan_application_submitted: "Loan Application Submitted",
    loan_application_approved: "Loan Application Approved",
    loan_application_rejected: "Loan Application Rejected",
    loan_disbursed: "Loan Disbursed",
    loan_payment_made: "Loan Payment Made",
    loan_completed: "Loan Completed",
    loan_defaulted: "Loan Defaulted",
    loan_overdue: "Loan Overdue",
    asset_purchase_initiated: "Asset Purchase Initiated",
    asset_purchase_completed: "Asset Purchase Completed",
    asset_sale_initiated: "Asset Sale Initiated",
    asset_sale_completed: "Asset Sale Completed",
    asset_price_updated: "Asset Price Updated",
    asset_created: "Asset Created",
    asset_updated: "Asset Updated",
    wallet_created: "Wallet Created",
    wallet_balance_updated: "Wallet Balance Updated",
    wallet_funded: "Wallet Funded",
    wallet_withdrawn: "Wallet Withdrawn",
    admin_action: "Admin Action",
    member_added: "Member Added",
    member_removed: "Member Removed",
    member_suspended: "Member Suspended",
    member_activated: "Member Activated",
    cooperative_settings_updated: "Cooperative Settings Updated",
    bulk_operation: "Bulk Operation",
    system_maintenance: "System Maintenance",
    backup_created: "Backup Created",
    report_generated: "Report Generated",
    notification_sent: "Notification Sent",
    webhook_received: "Webhook Received",
    error_occurred: "Error Occurred",
    kyc_submitted: "KYC Submitted",
    kyc_approved: "KYC Approved",
    kyc_rejected: "KYC Rejected",
    kyc_document_uploaded: "KYC Document Uploaded",
    payment_initiated: "Payment Initiated",
    payment_successful: "Payment Successful",
    payment_failed: "Payment Failed",
    refund_processed: "Refund Processed",
    chargeback_received: "Chargeback Received",
  };

  return titles[type] || "Activity";
};

// Helper method to get activity description
ActivitySchema.statics.getActivityDescription = function (type, metadata = {}) {
  const descriptions = {
    user_login: `User logged in successfully${
      metadata.ipAddress ? ` from ${metadata.ipAddress}` : ""
    }`,
    user_logout: "User logged out",
    user_registration: "New user registered successfully",
    password_reset: "Password reset requested",
    email_verification: "Email verification completed",
    profile_update: "User profile updated",
    transaction_initiated: `Transaction initiated for ${
      metadata.amount || "N/A"
    } ${metadata.currency || "NGN"}`,
    transaction_successful: `Transaction completed successfully for ${
      metadata.amount || "N/A"
    } ${metadata.currency || "NGN"}`,
    transaction_failed: `Transaction failed for ${metadata.amount || "N/A"} ${
      metadata.currency || "NGN"
    }`,
    transaction_abandoned: "Transaction was abandoned",
    contribution_made: `Contribution of ${metadata.amount || "N/A"} ${
      metadata.currency || "NGN"
    } made`,
    withdrawal_requested: `Withdrawal request for ${metadata.amount || "N/A"} ${
      metadata.currency || "NGN"
    }`,
    withdrawal_processed: `Withdrawal processed for ${
      metadata.amount || "N/A"
    } ${metadata.currency || "NGN"}`,
    loan_application_submitted: `Loan application submitted for ${
      metadata.amount || "N/A"
    } ${metadata.currency || "NGN"}`,
    loan_application_approved: `Loan application approved for ${
      metadata.amount || "N/A"
    } ${metadata.currency || "NGN"}`,
    loan_application_rejected: `Loan application rejected for ${
      metadata.amount || "N/A"
    } ${metadata.currency || "NGN"}`,
    loan_disbursed: `Loan disbursed for ${metadata.amount || "N/A"} ${
      metadata.currency || "NGN"
    }`,
    loan_payment_made: `Loan payment of ${metadata.amount || "N/A"} ${
      metadata.currency || "NGN"
    } made`,
    loan_completed: "Loan fully repaid and completed",
    loan_defaulted: "Loan has defaulted",
    loan_overdue: "Loan payment is overdue",
    asset_purchase_initiated: `Asset purchase initiated for ${
      metadata.quantity || "N/A"
    } units`,
    asset_purchase_completed: `Asset purchase completed for ${
      metadata.quantity || "N/A"
    } units`,
    asset_sale_initiated: `Asset sale initiated for ${
      metadata.quantity || "N/A"
    } units`,
    asset_sale_completed: `Asset sale completed for ${
      metadata.quantity || "N/A"
    } units`,
    asset_price_updated: `Asset price updated to ${
      metadata.newPrice || "N/A"
    } ${metadata.currency || "NGN"}`,
    asset_created: "New asset created",
    asset_updated: "Asset details updated",
    wallet_created: "New wallet created",
    wallet_balance_updated: "Wallet balance updated",
    wallet_funded: `Wallet funded with ${metadata.amount || "N/A"} ${
      metadata.currency || "NGN"
    }`,
    wallet_withdrawn: `Withdrawal of ${metadata.amount || "N/A"} ${
      metadata.currency || "NGN"
    } from wallet`,
    admin_action: metadata.action || "Admin action performed",
    member_added: "New member added to cooperative",
    member_removed: "Member removed from cooperative",
    member_suspended: "Member account suspended",
    member_activated: "Member account activated",
    cooperative_settings_updated: "Cooperative settings updated",
    bulk_operation: "Bulk operation performed",
    system_maintenance: "System maintenance performed",
    backup_created: "System backup created",
    report_generated: "Report generated",
    notification_sent: "Notification sent",
    webhook_received: "Webhook received from external service",
    error_occurred: metadata.error || "System error occurred",
    kyc_submitted: "KYC documents submitted",
    kyc_approved: "KYC verification approved",
    kyc_rejected: "KYC verification rejected",
    kyc_document_uploaded: "KYC document uploaded",
    payment_initiated: `Payment initiated for ${metadata.amount || "N/A"} ${
      metadata.currency || "NGN"
    }`,
    payment_successful: `Payment successful for ${metadata.amount || "N/A"} ${
      metadata.currency || "NGN"
    }`,
    payment_failed: `Payment failed for ${metadata.amount || "N/A"} ${
      metadata.currency || "NGN"
    }`,
    refund_processed: `Refund processed for ${metadata.amount || "N/A"} ${
      metadata.currency || "NGN"
    }`,
    chargeback_received: `Chargeback received for ${metadata.amount || "N/A"} ${
      metadata.currency || "NGN"
    }`,
  };

  return descriptions[type] || "Activity performed";
};

// Helper method to get activity severity
ActivitySchema.statics.getActivitySeverity = function (type) {
  const severityMap = {
    // Critical
    error_occurred: "critical",
    loan_defaulted: "critical",
    payment_failed: "critical",
    transaction_failed: "critical",

    // High
    loan_overdue: "high",
    chargeback_received: "high",
    member_suspended: "high",
    system_maintenance: "high",

    // Medium
    loan_application_rejected: "medium",
    kyc_rejected: "medium",
    withdrawal_requested: "medium",
    asset_price_updated: "medium",

    // Low (default)
    user_login: "low",
    user_logout: "low",
    profile_update: "low",
    transaction_successful: "low",
    loan_application_approved: "low",
    loan_payment_made: "low",
    asset_purchase_completed: "low",
    wallet_created: "low",
    notification_sent: "low",
  };

  return severityMap[type] || "low";
};

// Helper method to determine if user should be notified
ActivitySchema.statics.shouldNotifyUser = function (type) {
  const notifyTypes = [
    "transaction_successful",
    "transaction_failed",
    "loan_application_approved",
    "loan_application_rejected",
    "loan_disbursed",
    "loan_overdue",
    "asset_purchase_completed",
    "asset_sale_completed",
    "kyc_approved",
    "kyc_rejected",
    "payment_successful",
    "payment_failed",
  ];

  return notifyTypes.includes(type);
};

// Method to transform document to JSON
ActivitySchema.methods.toJSON = function () {
  const obj = this.toObject();

  // Remove empty fields
  Object.keys(obj).forEach((key) => {
    if (obj[key] === null || obj[key] === undefined || obj[key] === "") {
      delete obj[key];
    }
  });

  return obj;
};

const Activity = mongoose.model("Activity", ActivitySchema);

module.exports = Activity;
