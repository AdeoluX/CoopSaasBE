const mongoose = require("mongoose");
const { Schema } = mongoose;

const MemberSchema = new Schema({
  firstname: {
    type: String,
    required: true,
  },
  middlename: {
    type: String,
  },
  lastname: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
    select: false, // Don't include password by default in queries
  },
  dob: {
    type: Date,
  },
  nin: {
    type: String,
    select: false, // Don't include NIN by default
  },
  phone: {
    type: String,
  },
  tier: {
    type: String,
    enum: ["1", "2", "3"],
    default: "1",
  },
  emailStatus: {
    type: String,
    enum: ["verified", "unverified"],
    default: "unverified",
  },
  otps: [
    {
      type: Schema.Types.ObjectId,
      ref: "Otp",
    },
  ],
  twoFactor: {
    type: Boolean,
    default: true,
  },
  image: {
    type: String,
  },
  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user",
  },
  cooperativeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Cooperative",
    required: true,
  },
  address: {
    street: {
      type: String,
    },
    city: {
      type: String,
    },
    state: {
      type: String,
    },
    country: {
      type: String,
    },
  },
  profilePicture: { type: mongoose.Schema.Types.ObjectId, ref: "Attachment" },
  coopSettings: {
    contributionAmount: {
      type: Number,
    },
  },
  wallets: [{ type: mongoose.Schema.Types.ObjectId, ref: "Wallet" }],
  bank: { type: mongoose.Schema.Types.ObjectId, ref: "Bank" },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

MemberSchema.virtual("status").get(function () {
  if (this.tier === "3") {
    return "platinum";
  }
  if (this.tier === "2") {
    return "gold";
  }
  if (this.tier === "1") {
    return "silver";
  }
});

// Method to transform document to JSON
MemberSchema.methods.toJSON = function () {
  const obj = this.toObject();

  // Remove sensitive fields
  delete obj.password;
  delete obj.nin;

  // Remove empty fields
  Object.keys(obj).forEach((key) => {
    if (obj[key] === null || obj[key] === undefined || obj[key] === "") {
      delete obj[key];
    }
  });

  return obj;
};

// Method to get sensitive data (for internal use only)
MemberSchema.methods.getSensitiveData = function () {
  const obj = this.toObject();
  return {
    password: obj.password,
    nin: obj.nin,
  };
};

// Pre-save middleware to ensure password is hashed
MemberSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const bcrypt = require("bcryptjs");
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
MemberSchema.methods.comparePassword = async function (candidatePassword) {
  const bcrypt = require("bcryptjs");
  return bcrypt.compare(candidatePassword, this.password);
};

const Member = mongoose.model("Member", MemberSchema);

module.exports = Member;
