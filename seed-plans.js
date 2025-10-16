const mongoose = require("mongoose");
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

// Subscription plans data based on the pricing model
const plans = [
  {
    name: "Starter Plan",
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
    description:
      "Perfect for small cooperatives with up to 100 members. Includes basic member management, payment collection, and reporting features.",
    sort_order: 1,
  },
  {
    name: "Growth Plan",
    tier: "growth",
    monthly_fee: 15000,
    member_limit: 500,
    transaction_limit: 2000000,
    features: {
      basic_member_management: true,
      payment_collection: true,
      basic_reporting: true,
      loan_tracking: true,
      automated_payouts: true,
      priority_support: true,
      custom_integrations: false,
      dedicated_account_manager: false,
      advanced_analytics: false,
    },
    description:
      "Ideal for medium cooperatives with 100-500 members. Includes advanced features like loan tracking, automated payouts, and priority support.",
    sort_order: 2,
  },
  {
    name: "Enterprise Plan",
    tier: "enterprise",
    monthly_fee: 30000,
    member_limit: 999999, // Unlimited (represented as a large number)
    transaction_limit: 999999999, // Unlimited (represented as a large number)
    features: {
      basic_member_management: true,
      payment_collection: true,
      basic_reporting: true,
      loan_tracking: true,
      automated_payouts: true,
      priority_support: true,
      custom_integrations: true,
      dedicated_account_manager: true,
      advanced_analytics: true,
    },
    description:
      "For large cooperatives with unlimited members and transactions. Includes all features with custom integrations, dedicated account manager, and advanced analytics.",
    sort_order: 3,
  },
];

// Seed plans function
const seedPlans = async () => {
  try {
    console.log("Starting to seed subscription plans...");

    // Clear existing plans
    await Plan.deleteMany({});
    console.log("Cleared existing plans");

    // Insert new plans
    const createdPlans = await Plan.insertMany(plans);
    console.log(`Successfully seeded ${createdPlans.length} plans:`);

    createdPlans.forEach((plan) => {
      console.log(
        `- ${plan.name} (${
          plan.tier
        }): ₦${plan.monthly_fee.toLocaleString()}/month`
      );
    });

    return createdPlans;
  } catch (error) {
    console.error("Error seeding plans:", error);
    throw error;
  }
};

// Update existing cooperative with starter plan
const updateCooperativeWithPlan = async () => {
  try {
    console.log("Updating existing cooperative with subscription plan...");

    // Get the starter plan
    const starterPlan = await Plan.findOne({ tier: "starter" });
    if (!starterPlan) {
      throw new Error("Starter plan not found. Please run plan seeding first.");
    }

    // Find the first cooperative (assuming there's only one for now)
    const cooperative = await Cooperative.findOne({});
    if (!cooperative) {
      console.log("No cooperative found. Skipping cooperative update.");
      return;
    }

    // Update cooperative with subscription settings
    const nextBillingDate = new Date();
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1); // Next month

    const updatedCooperative = await Cooperative.findByIdAndUpdate(
      cooperative._id,
      {
        $set: {
          "settings.subscription_plan": {
            plan_id: starterPlan._id,
            expires_at: nextBillingDate,
          },
          "settings.subscription": {
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
        },
      },
      { new: true }
    );

    console.log(`Successfully updated cooperative: ${updatedCooperative.name}`);
    console.log(
      `Assigned to: ${
        starterPlan.name
      } (₦${starterPlan.monthly_fee.toLocaleString()}/month)`
    );

    return updatedCooperative;
  } catch (error) {
    console.error("Error updating cooperative:", error);
    throw error;
  }
};

// Main seeding function
const runSeeding = async () => {
  try {
    await connectDB();

    // Seed plans first
    await seedPlans();

    // Update cooperative with plan
    await updateCooperativeWithPlan();

    console.log("✅ Seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
};

// Run the seeding if this file is executed directly
if (require.main === module) {
  runSeeding();
}

module.exports = { seedPlans, updateCooperativeWithPlan };
