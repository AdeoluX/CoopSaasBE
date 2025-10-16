const mongoose = require("mongoose");
const Member = require("./src/models/Members");
const Wallet = require("./src/models/Wallet");
const Cooperative = require("./src/models/Cooperative");
require("dotenv").config();

// Database connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGO_URI || "mongodb://localhost:27017/cooperative",
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 10000,
      }
    );
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("Error connecting to database:", error);
    process.exit(1);
  }
};

// Create wallet for specific member
const createWalletForMember = async (memberEmail) => {
  try {
    console.log(`Creating wallet for member: ${memberEmail}`);

    // Find the member by email
    const member = await Member.findOne({ email: memberEmail });
    if (!member) {
      throw new Error(`Member with email ${memberEmail} not found`);
    }

    console.log(
      `Found member: ${member.firstname} ${member.lastname} (ID: ${member._id})`
    );

    // Check if member already has a wallet
    const existingWallet = await Wallet.findOne({
      member: member._id,
      walletType: "member",
    });

    if (existingWallet) {
      console.log(`Member already has a wallet with ID: ${existingWallet._id}`);
      console.log(
        `Current balance: ₦${existingWallet.ledger_balance.toLocaleString()}`
      );
      return existingWallet;
    }

    // Get the member's cooperative
    const cooperative = await Cooperative.findById(member.cooperativeId);
    if (!cooperative) {
      throw new Error(`Cooperative not found for member ${memberEmail}`);
    }

    console.log(
      `Member belongs to cooperative: ${cooperative.name} (ID: ${cooperative._id})`
    );

    // Create the wallet
    const wallet = await Wallet.create({
      member: member._id,
      cooperativeId: member.cooperativeId,
      currency: "NGN",
      walletType: "member",
      ledger_balance: 0, // Start with zero balance
    });

    console.log(`✅ Successfully created wallet with ID: ${wallet._id}`);

    // Add wallet to member's wallets array
    member.wallets.push(wallet._id);
    await member.save();

    console.log(`✅ Added wallet to member's wallets array`);

    return wallet;
  } catch (error) {
    console.error("Error creating wallet for member:", error);
    throw error;
  }
};

// Create wallets for multiple members
const createWalletsForMembers = async (memberEmails) => {
  try {
    console.log(`Creating wallets for ${memberEmails.length} members...`);

    const results = [];
    for (const email of memberEmails) {
      try {
        const wallet = await createWalletForMember(email);
        results.push({ email, wallet, success: true });
      } catch (error) {
        console.error(`Failed to create wallet for ${email}:`, error.message);
        results.push({ email, error: error.message, success: false });
      }
    }

    return results;
  } catch (error) {
    console.error("Error creating wallets for members:", error);
    throw error;
  }
};

// Main seeding function
const runSeeding = async () => {
  try {
    await connectDB();

    // Create wallet for the specific member
    const memberEmail = "juwontayo@gmail.com";
    await createWalletForMember(memberEmail);

    console.log("✅ Wallet seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Wallet seeding failed:", error);
    process.exit(1);
  }
};

// Run the seeding if this file is executed directly
if (require.main === module) {
  runSeeding();
}

module.exports = { createWalletForMember, createWalletsForMembers };
