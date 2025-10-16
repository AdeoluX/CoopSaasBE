const mongoose = require("mongoose");

const { Schema } = mongoose;

const AssetsSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: [
      "real_estate",
      "stocks",
      "bonds",
      "commodities",
      "cryptocurrency",
      "mutual_funds",
    ],
    default: "real_estate",
  },
  status: {
    type: String,
    enum: ["draft", "published"],
    default: "draft",
  },
  cooperativeId: {
    type: Schema.Types.ObjectId,
    ref: "Cooperative",
    required: true,
  },
  image: {
    type: String,
    required: false,
    default: "",
  },
  currency: {
    type: String,
    enum: ["NGN", "USD", "EUR"],
    default: "NGN",
  },
  settings: {
    pricePerUnit: {
      type: Number,
      required: false,
    },
    totalUnits: {
      type: Number,
      required: false,
    },
    minInvestment: {
      type: Number,
      required: false,
    },
    maxInvestment: {
      type: Number,
      required: false,
    },
    minUnit: {
      type: Number,
    },
    minAmount: {
      type: Number,
      required: false,
    },
    terms: {
      type: String,
      required: false,
    },
    risks: {
      type: String,
      required: false,
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the updatedAt field before saving
AssetsSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

const Assets = mongoose.model("Assets", AssetsSchema);

module.exports = Assets;
