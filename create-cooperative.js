const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Plan = require("./src/models/Plan");
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

// Create sample cooperative
const createSampleCooperative = async () => {
  try {
    console.log("Creating sample cooperative...");

    // Check if cooperative already exists
    const existingCoop = await Cooperative.findOne({
      "auth_credentials.email": "admin@cyberdyne.com",
    });
    if (existingCoop) {
      console.log("✅ Cooperative already exists:", existingCoop.name);
      return existingCoop;
    }

    // Get the starter plan
    const starterPlan = await Plan.findOne({ tier: "starter" });
    if (!starterPlan) {
      throw new Error("Starter plan not found. Please run plan seeding first.");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash("password123", 10);

    // Set next billing date
    const nextBillingDate = new Date();
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

    // Create cooperative data
    const cooperativeData = {
      name: "Cyber Dyne Cooperative",
      auth_credentials: {
        email: "admin@cyberdyne.com",
        password: hashedPassword,
      },
      is_active: true,
      settings: {
        timezone: "Africa/Lagos",
        language: "en",
        currency: "NGN",
        subscription_plan: {
          plan_id: starterPlan._id,
          expires_at: nextBillingDate,
        },
        subscription: {
          tier: "starter",
          monthly_fee: 5000,
          member_limit: 100,
          transaction_limit: 500000,
          features: {
            basic_member_management: true,
            payment_collection: true,
            basic_reporting: true,
            loan_tracking: false,
            automated_payouts: false,
            priority_support: false,
            custom_integrations: false,
            dedicated_account_manager: false,
            advanced_analytics: false,
          },
          next_billing_date: nextBillingDate,
          status: "active",
        },
        loans: {
          personal_interest_rate: 18,
          business_interest_rate: 20,
          emergency_interest_rate: 22,
          investment_interest_rate: 16,
          max_loan_amount: 2000000,
          min_loan_amount: 1000,
          max_loan_term: 60,
          min_loan_term: 1,
          requires_collateral: false,
          requires_guarantor: false,
        },
        contributions: {
          min_contribution: 2000,
          max_contribution: 20000000,
          contribution_frequency: "monthly",
        },
        assets: {
          min_investment: 1000,
          max_investment: 10000000,
          requires_approval: false,
        },
      },
      kyc_details: {
        nin: "12345678901",
        rc: "RC123456",
      },
      address: {
        street: "123 Tech Street",
        city: "Lagos",
        state: "Lagos",
        country: "Nigeria",
        postal_code: "100001",
      },
      contact_details: {
        phone: "+2348012345678",
        email: "contact@cyberdyne.com",
        website: "https://cyberdyne.com",
      },
      social_media: {
        facebook: "cyberdynecoop",
        twitter: "cyberdynecoop",
        instagram: "cyberdynecoop",
        linkedin: "cyberdynecoop",
      },
    };

    // Create the cooperative
    const cooperative = new Cooperative(cooperativeData);
    await cooperative.save();

    console.log("✅ Successfully created cooperative:", cooperative.name);
    console.log(`   Email: ${cooperative.auth_credentials.email}`);
    console.log(`   Password: password123`);
    console.log(`   Code: ${cooperative.code}`);
    console.log(
      `   Subscription: ${
        starterPlan.name
      } (₦${starterPlan.monthly_fee.toLocaleString()}/month)`
    );
    console.log(`   Next Billing: ${nextBillingDate.toLocaleDateString()}`);

    return cooperative;
  } catch (error) {
    console.error("Error creating cooperative:", error);
    throw error;
  }
};

// Main function
const runCreation = async () => {
  try {
    await connectDB();
    await createSampleCooperative();
    console.log("\n🎉 Cooperative creation completed successfully!");
    console.log("You can now log in with:");
    console.log("Email: admin@cyberdyne.com");
    console.log("Password: password123");
    process.exit(0);
  } catch (error) {
    console.error("❌ Cooperative creation failed:", error);
    process.exit(1);
  }
};

// Run the creation if this file is executed directly
if (require.main === module) {
  runCreation();
}

module.exports = { createSampleCooperative };
