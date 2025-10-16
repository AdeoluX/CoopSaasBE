const mongoose = require("mongoose");
const { Schema } = mongoose;
const crypto = require("crypto");

const InvitationSchema = new Schema(
  {
    cooperativeId: {
      type: Schema.Types.ObjectId,
      ref: "Cooperative",
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
    },
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    invitationCode: {
      type: String,
      unique: true,
      default: function () {
        return "INV_" + crypto.randomUUID().split("-").join("").slice(0, 12);
      },
    },
    invitationLink: {
      type: String,
      unique: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "expired", "cancelled"],
      default: "pending",
    },
    expiresAt: {
      type: Date,
      default: function () {
        return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      },
    },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: "Member",
      required: true,
    },
    acceptedAt: Date,
    acceptedBy: {
      type: Schema.Types.ObjectId,
      ref: "Member",
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    message: {
      type: String,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
InvitationSchema.index({ invitationCode: 1 }, { unique: true });
InvitationSchema.index({ invitationLink: 1 }, { unique: true });
InvitationSchema.index({ cooperativeId: 1, status: 1 });
InvitationSchema.index({ email: 1, cooperativeId: 1 });
InvitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Pre-save middleware to generate invitation link
InvitationSchema.pre("save", function (next) {
  if (!this.invitationLink) {
    this.invitationLink = `${
      process.env.FRONTEND_URL || "http://localhost:3000"
    }/invite/${this.invitationCode}`;
  }
  next();
});

// Static method to create invitation
InvitationSchema.statics.createInvitation = async function (invitationData) {
  const invitation = await this.create(invitationData);
  return invitation;
};

// Static method to find invitation by code
InvitationSchema.statics.findByCode = async function (code) {
  return await this.findOne({ invitationCode: code, status: "pending" });
};

// Static method to find invitation by link
InvitationSchema.statics.findByLink = async function (link) {
  return await this.findOne({ invitationLink: link, status: "pending" });
};

// Instance method to accept invitation
InvitationSchema.methods.accept = async function (memberId) {
  this.status = "accepted";
  this.acceptedAt = new Date();
  this.acceptedBy = memberId;
  return await this.save();
};

// Instance method to expire invitation
InvitationSchema.methods.expire = async function () {
  this.status = "expired";
  return await this.save();
};

// Instance method to cancel invitation
InvitationSchema.methods.cancel = async function () {
  this.status = "cancelled";
  return await this.save();
};

// Static method to get pending invitations for cooperative
InvitationSchema.statics.getPendingInvitations = async function (
  cooperativeId,
  options = {}
) {
  const { page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;

  const [invitations, total] = await Promise.all([
    this.find({ cooperativeId, status: "pending" })
      .populate("invitedBy", "firstname lastname email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    this.countDocuments({ cooperativeId, status: "pending" }),
  ]);

  return {
    data: invitations,
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

const Invitation = mongoose.model("Invitation", InvitationSchema);

module.exports = Invitation;
