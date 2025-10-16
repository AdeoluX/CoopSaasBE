const mongoose = require("mongoose");

const ScheduledReportSchema = new mongoose.Schema(
  {
    cooperativeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cooperative",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    reportType: {
      type: String,
      enum: [
        "profit_loss",
        "balance_sheet",
        "cash_flow",
        "member_performance",
        "loan_portfolio",
        "asset_performance",
        "custom",
      ],
      required: true,
    },
    schedule: {
      frequency: {
        type: String,
        enum: ["daily", "weekly", "monthly", "quarterly", "yearly"],
        required: true,
      },
      dayOfWeek: {
        type: Number, // 0-6 (Sunday-Saturday) for weekly
        min: 0,
        max: 6,
      },
      dayOfMonth: {
        type: Number, // 1-31 for monthly
        min: 1,
        max: 31,
      },
      time: {
        type: String, // HH:MM format
        default: "09:00",
      },
      timezone: {
        type: String,
        default: "UTC",
      },
    },
    recipients: [
      {
        email: {
          type: String,
          required: true,
        },
        name: String,
        role: {
          type: String,
          enum: ["admin", "member"],
          default: "admin",
        },
      },
    ],
    reportConfig: {
      // Configuration for custom reports
      metrics: [String],
      filters: mongoose.Schema.Types.Mixed,
      groupBy: String,
      dateRange: {
        type: {
          type: String,
          enum: ["relative", "absolute"],
          default: "relative",
        },
        start: String, // "30d" for relative, "2024-01-01" for absolute
        end: String,
      },
    },
    exportFormat: {
      type: String,
      enum: ["json", "csv", "pdf"],
      default: "csv",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastRun: {
      type: Date,
    },
    nextRun: {
      type: Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
    },
    deliveryHistory: [
      {
        sentAt: {
          type: Date,
          default: Date.now,
        },
        recipients: [String],
        status: {
          type: String,
          enum: ["success", "failed", "partial"],
          default: "success",
        },
        errorMessage: String,
        reportData: mongoose.Schema.Types.Mixed,
      },
    ],
  },
  { timestamps: true }
);

// Indexes for better query performance
ScheduledReportSchema.index({ cooperativeId: 1, isActive: 1 });
ScheduledReportSchema.index({ nextRun: 1 });
ScheduledReportSchema.index({ "schedule.frequency": 1 });

// Pre-save middleware to calculate next run time
ScheduledReportSchema.pre("save", function (next) {
  if (this.isModified("schedule") || this.isNew) {
    this.nextRun = this.calculateNextRun();
  }
  next();
});

// Method to calculate next run time
ScheduledReportSchema.methods.calculateNextRun = function () {
  const now = new Date();
  let nextRun = new Date(now);

  // Set the time
  const [hours, minutes] = this.schedule.time.split(":");
  nextRun.setHours(parseInt(hours), parseInt(minutes), 0, 0);

  // If the time has already passed today, move to next occurrence
  if (nextRun <= now) {
    switch (this.schedule.frequency) {
      case "daily":
        nextRun.setDate(nextRun.getDate() + 1);
        break;
      case "weekly":
        const currentDay = nextRun.getDay();
        const targetDay = this.schedule.dayOfWeek || 0;
        const daysToAdd = (targetDay - currentDay + 7) % 7;
        nextRun.setDate(nextRun.getDate() + daysToAdd);
        break;
      case "monthly":
        nextRun.setMonth(nextRun.getMonth() + 1);
        nextRun.setDate(this.schedule.dayOfMonth || 1);
        break;
      case "quarterly":
        nextRun.setMonth(nextRun.getMonth() + 3);
        nextRun.setDate(this.schedule.dayOfMonth || 1);
        break;
      case "yearly":
        nextRun.setFullYear(nextRun.getFullYear() + 1);
        nextRun.setDate(this.schedule.dayOfMonth || 1);
        break;
    }
  }

  return nextRun;
};

// Method to mark report as delivered
ScheduledReportSchema.methods.markDelivered = function (deliveryResult) {
  this.lastRun = new Date();
  this.nextRun = this.calculateNextRun();
  this.deliveryHistory.push(deliveryResult);
  return this.save();
};

// Static method to get reports due for delivery
ScheduledReportSchema.statics.getReportsDueForDelivery = function () {
  const now = new Date();
  return this.find({
    isActive: true,
    nextRun: { $lte: now },
  }).populate("cooperativeId", "name");
};

// Static method to get reports by cooperative
ScheduledReportSchema.statics.getReportsByCooperative = function (
  cooperativeId
) {
  return this.find({ cooperativeId, isActive: true })
    .populate("createdBy", "firstName lastName email")
    .sort({ createdAt: -1 });
};

module.exports = mongoose.model("ScheduledReport", ScheduledReportSchema);
