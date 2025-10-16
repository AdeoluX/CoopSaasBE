const mongoose = require("mongoose");
const Cooperative = require("./src/models/Cooperative");
require("dotenv").config();

// Database connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/cooperative",
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }
    );
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("Error connecting to database:", error);
    process.exit(1);
  }
};

// Check for existing cooperatives
const checkCooperatives = async () => {
  try {
    console.log("Checking for existing cooperatives...");

    const cooperatives = await Cooperative.find({});

    if (cooperatives.length === 0) {
      console.log("❌ No cooperatives found in the database.");
      console.log(
        "You need to create a cooperative first before assigning a subscription plan."
      );
      return;
    }

    console.log(`✅ Found ${cooperatives.length} cooperative(s):`);

    cooperatives.forEach((coop, index) => {
      console.log(`\n${index + 1}. Cooperative Details:`);
      console.log(`   Name: ${coop.name}`);
      console.log(`   Email: ${coop.auth_credentials?.email}`);
      console.log(`   Code: ${coop.code}`);
      console.log(`   Active: ${coop.is_active}`);
      console.log(`   Created: ${coop.createdAt}`);

      if (coop.settings?.subscription_plan) {
        console.log(
          `   Subscription Plan: ${coop.settings.subscription_plan.plan_id}`
        );
        console.log(
          `   Expires: ${coop.settings.subscription_plan.expires_at}`
        );
      } else {
        console.log(`   Subscription Plan: None assigned`);
      }

      if (coop.settings?.subscription) {
        console.log(`   Subscription Tier: ${coop.settings.subscription.tier}`);
        console.log(
          `   Monthly Fee: ₦${coop.settings.subscription.monthly_fee?.toLocaleString()}`
        );
        console.log(`   Status: ${coop.settings.subscription.status}`);
      } else {
        console.log(`   Subscription Settings: None`);
      }
    });
  } catch (error) {
    console.error("Error checking cooperatives:", error);
  }
};

// Main function
const runCheck = async () => {
  try {
    await connectDB();
    await checkCooperatives();
    process.exit(0);
  } catch (error) {
    console.error("❌ Check failed:", error);
    process.exit(1);
  }
};

// Run the check if this file is executed directly
if (require.main === module) {
  runCheck();
}

module.exports = { checkCooperatives };
