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

// Create wallet for specific member with options
const createWalletForMember = async (memberEmail, options = {}) => {
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

    // Default wallet options
    const walletOptions = {
      walletType: "member",
      currency: "NGN",
      ledger_balance: 0,
      assetId: null,
      ...options,
    };

    // Check if member already has a wallet of this type
    const existingWallet = await Wallet.findOne({
      member: member._id,
      walletType: walletOptions.walletType,
      assetId: walletOptions.assetId,
    });

    if (existingWallet) {
      console.log(
        `Member already has a ${walletOptions.walletType} wallet with ID: ${existingWallet._id}`
      );
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
      currency: walletOptions.currency,
      walletType: walletOptions.walletType,
      ledger_balance: walletOptions.ledger_balance,
      assetId: walletOptions.assetId,
    });

    console.log(
      `✅ Successfully created ${walletOptions.walletType} wallet with ID: ${wallet._id}`
    );
    console.log(`   Balance: ₦${wallet.ledger_balance.toLocaleString()}`);
    console.log(`   Currency: ${wallet.currency}`);

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

// Create multiple wallet types for a member
const createAllWalletsForMember = async (memberEmail) => {
  try {
    console.log(`Creating all wallet types for member: ${memberEmail}`);

    const wallets = [];

    // Create member wallet (general wallet)
    const memberWallet = await createWalletForMember(memberEmail, {
      walletType: "member",
      currency: "NGN",
      ledger_balance: 0,
    });
    wallets.push(memberWallet);

    // Create contribution wallet
    const contributionWallet = await createWalletForMember(memberEmail, {
      walletType: "contribution",
      currency: "NGN",
      ledger_balance: 0,
    });
    wallets.push(contributionWallet);

    console.log(
      `✅ Created ${wallets.length} wallets for member ${memberEmail}`
    );
    return wallets;
  } catch (error) {
    console.error("Error creating all wallets for member:", error);
    throw error;
  }
};

// List all members without wallets
const listMembersWithoutWallets = async () => {
  try {
    console.log("Finding members without wallets...");

    const members = await Member.find({}).populate("wallets");
    const membersWithoutWallets = members.filter(
      (member) => !member.wallets || member.wallets.length === 0
    );

    console.log(
      `Found ${membersWithoutWallets.length} members without wallets:`
    );
    membersWithoutWallets.forEach((member) => {
      console.log(`- ${member.firstname} ${member.lastname} (${member.email})`);
    });

    return membersWithoutWallets;
  } catch (error) {
    console.error("Error listing members without wallets:", error);
    throw error;
  }
};

// Create wallets for all members without wallets
const createWalletsForAllMembers = async () => {
  try {
    const membersWithoutWallets = await listMembersWithoutWallets();

    if (membersWithoutWallets.length === 0) {
      console.log("All members already have wallets!");
      return;
    }

    console.log(
      `Creating wallets for ${membersWithoutWallets.length} members...`
    );

    const results = [];
    for (const member of membersWithoutWallets) {
      try {
        const wallet = await createWalletForMember(member.email, {
          walletType: "member",
          currency: "NGN",
          ledger_balance: 0,
        });
        results.push({ email: member.email, wallet, success: true });
      } catch (error) {
        console.error(
          `Failed to create wallet for ${member.email}:`,
          error.message
        );
        results.push({
          email: member.email,
          error: error.message,
          success: false,
        });
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(`✅ Wallet creation completed:`);
    console.log(`   Successful: ${successful}`);
    console.log(`   Failed: ${failed}`);

    return results;
  } catch (error) {
    console.error("Error creating wallets for all members:", error);
    throw error;
  }
};

// Main seeding function
const runSeeding = async () => {
  try {
    await connectDB();

    // Create wallet for the specific member
    const memberEmail = "juwontayo@gmail.com";

    console.log("=== Creating Wallet for Specific Member ===");
    await createWalletForMember(memberEmail, {
      walletType: "member",
      currency: "NGN",
      ledger_balance: 0,
    });

    console.log("\n=== Creating All Wallet Types for Member ===");
    await createAllWalletsForMember(memberEmail);

    console.log("\n=== Listing Members Without Wallets ===");
    await listMembersWithoutWallets();

    console.log("\n✅ Wallet seeding completed successfully!");
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

module.exports = {
  createWalletForMember,
  createAllWalletsForMember,
  listMembersWithoutWallets,
  createWalletsForAllMembers,
};
