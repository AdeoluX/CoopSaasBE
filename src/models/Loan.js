const mongoose = require("mongoose");
const { Schema } = mongoose;

const LoanSchema = new Schema(
  {
    member: {
      type: Schema.Types.ObjectId,
      ref: "Member",
      required: true,
    },
    cooperativeId: {
      type: Schema.Types.ObjectId,
      ref: "Cooperative",
      required: true,
    },
    loanType: {
      type: String,
      enum: ["personal", "business", "emergency", "investment"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [1000, "Loan amount must be at least 1000"],
    },
    interestRate: {
      type: Number,
      required: true,
      min: [0, "Interest rate cannot be negative"],
      max: [100, "Interest rate cannot exceed 100%"],
    },
    term: {
      type: Number,
      required: true,
      min: [1, "Loan term must be at least 1 month"],
      max: [60, "Loan term cannot exceed 60 months"],
    },
    termUnit: {
      type: String,
      enum: ["days", "weeks", "months", "years"],
      default: "months",
    },
    status: {
      type: String,
      enum: [
        "pending",
        "approved",
        "active",
        "completed",
        "defaulted",
        "rejected",
      ],
      default: "pending",
    },
    purpose: {
      type: String,
      required: true,
      maxlength: [500, "Purpose description cannot exceed 500 characters"],
    },
    collateral: {
      type: String,
      maxlength: [1000, "Collateral description cannot exceed 1000 characters"],
    },
    guarantor: {
      name: String,
      phone: String,
      relationship: String,
      memberId: {
        type: Schema.Types.ObjectId,
        ref: "Member",
      },
    },
    disbursementMethod: {
      type: String,
      enum: ["wallet", "bank_transfer", "cash"],
      default: "wallet",
    },
    disbursementDetails: {
      accountNumber: String,
      bankName: String,
      accountName: String,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "Member",
    },
    approvedAt: Date,
    disbursedAt: Date,
    dueDate: Date,
    currency: {
      type: String,
      enum: ["NGN", "USD"],
      default: "NGN",
    },
    monthlyPayment: {
      type: Number,
      required: true,
    },
    totalInterest: {
      type: Number,
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    remainingBalance: {
      type: Number,
      default: function () {
        return this.totalAmount;
      },
    },
    payments: [
      {
        amount: {
          type: Number,
          required: true,
        },
        paymentDate: {
          type: Date,
          default: Date.now,
        },
        transactionId: {
          type: Schema.Types.ObjectId,
          ref: "Transaction",
        },
        status: {
          type: String,
          enum: ["pending", "success", "failed"],
          default: "pending",
        },
      },
    ],
    documents: [
      {
        type: Schema.Types.ObjectId,
        ref: "Attachment",
      },
    ],
    notes: [
      {
        content: String,
        createdBy: {
          type: Schema.Types.ObjectId,
          ref: "Member",
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
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

// Virtual for loan progress percentage
LoanSchema.virtual("progressPercentage").get(function () {
  if (this.totalAmount === 0) return 0;
  const paidAmount = this.totalAmount - this.remainingBalance;
  return Math.round((paidAmount / this.totalAmount) * 100);
});

// Virtual for days remaining
LoanSchema.virtual("daysRemaining").get(function () {
  if (!this.dueDate) return null;
  const now = new Date();
  const due = new Date(this.dueDate);
  const diffTime = due - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
});

// Virtual for is overdue
LoanSchema.virtual("isOverdue").get(function () {
  if (!this.dueDate) return false;
  return new Date() > new Date(this.dueDate) && this.remainingBalance > 0;
});

// Virtual for next payment due
LoanSchema.virtual("nextPaymentDue").get(function () {
  if (this.status !== "active" || this.remainingBalance <= 0) return null;

  const lastPayment = this.payments
    .filter((p) => p.status === "success")
    .sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate))[0];

  if (!lastPayment) return this.disbursedAt;

  const lastPaymentDate = new Date(lastPayment.paymentDate);
  const nextPaymentDate = new Date(lastPaymentDate);

  switch (this.termUnit) {
    case "days":
      nextPaymentDate.setDate(nextPaymentDate.getDate() + 30);
      break;
    case "weeks":
      nextPaymentDate.setDate(nextPaymentDate.getDate() + 7);
      break;
    case "months":
      nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
      break;
    case "years":
      nextPaymentDate.setFullYear(nextPaymentDate.getFullYear() + 1);
      break;
  }

  return nextPaymentDate;
});

// Indexes for better query performance
LoanSchema.index({ member: 1, createdAt: -1 });
LoanSchema.index({ cooperativeId: 1, status: 1 });
LoanSchema.index({ status: 1, dueDate: 1 });
LoanSchema.index({ member: 1, status: 1 });

// Pre-save middleware to calculate loan details
LoanSchema.pre("save", function (next) {
  if (
    this.isModified("amount") ||
    this.isModified("interestRate") ||
    this.isModified("term")
  ) {
    // Calculate monthly interest rate
    const monthlyInterestRate = this.interestRate / 100 / 12;

    // Calculate monthly payment using loan amortization formula
    if (monthlyInterestRate > 0) {
      this.monthlyPayment =
        (this.amount *
          monthlyInterestRate *
          Math.pow(1 + monthlyInterestRate, this.term)) /
        (Math.pow(1 + monthlyInterestRate, this.term) - 1);
    } else {
      this.monthlyPayment = this.amount / this.term;
    }

    // Calculate total interest and total amount
    this.totalInterest = this.monthlyPayment * this.term - this.amount;
    this.totalAmount = this.amount + this.totalInterest;

    // Set remaining balance to total amount for new loans
    if (this.isNew) {
      this.remainingBalance = this.totalAmount;
    }
  }

  this.updatedAt = new Date();
  next();
});

// Static method to create loan application
LoanSchema.statics.createLoanApplication = async function (
  loanData,
  session = null
) {
  const options = session ? { session } : {};
  return await this.create([loanData], options);
};

// Static method to approve loan
LoanSchema.statics.approveLoan = async function (
  loanId,
  approvedBy,
  session = null
) {
  const options = { new: true, runValidators: true };
  if (session) options.session = session;

  return await this.findByIdAndUpdate(
    loanId,
    {
      status: "approved",
      approvedBy,
      approvedAt: new Date(),
    },
    options
  );
};

// Static method to disburse loan
LoanSchema.statics.disburseLoan = async function (loanId, session = null) {
  const options = { new: true, runValidators: true };
  if (session) options.session = session;

  const loan = await this.findById(loanId);
  if (!loan) {
    throw new Error("Loan not found");
  }

  // Calculate due date based on term and term unit
  const dueDate = new Date();
  switch (loan.termUnit) {
    case "days":
      dueDate.setDate(dueDate.getDate() + loan.term);
      break;
    case "weeks":
      dueDate.setDate(dueDate.getDate() + loan.term * 7);
      break;
    case "months":
      dueDate.setMonth(dueDate.getMonth() + loan.term);
      break;
    case "years":
      dueDate.setFullYear(dueDate.getFullYear() + loan.term);
      break;
  }

  return await this.findByIdAndUpdate(
    loanId,
    {
      status: "active",
      disbursedAt: new Date(),
      dueDate,
    },
    options
  );
};

// Static method to record payment
LoanSchema.statics.recordPayment = async function (
  loanId,
  paymentData,
  session = null
) {
  const options = { new: true, runValidators: true };
  if (session) options.session = session;

  const loan = await this.findById(loanId);
  if (!loan) {
    throw new Error("Loan not found");
  }

  // Add payment to payments array
  loan.payments.push(paymentData);

  // Update remaining balance
  if (paymentData.status === "success") {
    loan.remainingBalance = Math.max(
      0,
      loan.remainingBalance - paymentData.amount
    );

    // Check if loan is completed
    if (loan.remainingBalance <= 0) {
      loan.status = "completed";
    }
  }

  return await loan.save(options);
};

// Static method to get member loans with pagination
LoanSchema.statics.getMemberLoans = async function (memberId, options = {}) {
  const { page = 1, limit = 10, status = null, loanType = null } = options;

  const skip = (page - 1) * limit;

  // Build query
  const query = { member: memberId };

  if (status) {
    query.status = status;
  }

  if (loanType) {
    query.loanType = loanType;
  }

  // Execute queries
  const [loans, total] = await Promise.all([
    this.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("cooperativeId", "name code")
      .populate("approvedBy", "firstname lastname"),
    this.countDocuments(query),
  ]);

  return {
    data: loans,
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

// Static method to get overdue loans
LoanSchema.statics.getOverdueLoans = async function (cooperativeId = null) {
  const query = {
    status: "active",
    dueDate: { $lt: new Date() },
    remainingBalance: { $gt: 0 },
  };

  if (cooperativeId) {
    query.cooperativeId = cooperativeId;
  }

  return await this.find(query)
    .populate("member", "firstname lastname email phone")
    .populate("cooperativeId", "name code");
};

// Instance method to check if loan can be approved
LoanSchema.methods.canBeApproved = function () {
  return this.status === "pending";
};

// Instance method to check if loan can be disbursed
LoanSchema.methods.canBeDisbursed = function () {
  return this.status === "approved";
};

// Instance method to get payment history
LoanSchema.methods.getPaymentHistory = function () {
  return this.payments
    .filter((payment) => payment.status === "success")
    .sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
};

// Instance method to calculate late fees
LoanSchema.methods.calculateLateFees = function () {
  if (!this.isOverdue) return 0;

  const daysOverdue = Math.abs(this.daysRemaining);
  const dailyLateFeeRate = 0.01; // 1% per day
  return this.remainingBalance * dailyLateFeeRate * daysOverdue;
};

// Method to transform document to JSON
LoanSchema.methods.toJSON = function () {
  const obj = this.toObject();

  // Remove empty fields
  Object.keys(obj).forEach((key) => {
    if (obj[key] === null || obj[key] === undefined || obj[key] === "") {
      delete obj[key];
    }
  });

  return obj;
};

const Loan = mongoose.model("Loan", LoanSchema);

module.exports = Loan;
