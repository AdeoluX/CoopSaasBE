const mongoose = require("mongoose");

const SubaccountSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  provider: { type: String, required: true, enum: ["paystack", "flutterwave"] },
  name: { type: String, required: true },
  bank_code: { type: String, required: true },
  bank_name: { type: String, required: true },
  bank_account_number: { type: String, required: true },
  bank_account_name: { type: String, required: true },
  bank_account_type: { type: String, required: true },
});

const Subaccount = mongoose.model("Subaccount", SubaccountSchema);

module.exports = Subaccount;
