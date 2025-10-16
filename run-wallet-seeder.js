#!/usr/bin/env node

/**
 * Wallet Seeder Runner
 *
 * This script creates wallets for members who don't have them.
 *
 * Usage:
 *   node run-wallet-seeder.js
 *   node run-wallet-seeder.js --email juwontayo@gmail.com
 *   node run-wallet-seeder.js --all
 *   node run-wallet-seeder.js --list
 */

const {
  createWalletForMember,
  createAllWalletsForMember,
  listMembersWithoutWallets,
  createWalletsForAllMembers,
} = require("./seed-member-wallets");

// Parse command line arguments
const args = process.argv.slice(2);
const emailArg = args.find((arg) => arg.startsWith("--email="));
const email = emailArg ? emailArg.split("=")[1] : null;
const allFlag = args.includes("--all");
const listFlag = args.includes("--list");

async function main() {
  try {
    if (listFlag) {
      console.log("=== Listing Members Without Wallets ===");
      await listMembersWithoutWallets();
    } else if (allFlag) {
      console.log("=== Creating Wallets for All Members ===");
      await createWalletsForAllMembers();
    } else if (email) {
      console.log(`=== Creating Wallet for ${email} ===`);
      await createWalletForMember(email, {
        walletType: "member",
        currency: "NGN",
        ledger_balance: 0,
      });
    } else {
      // Default: create wallet for juwontayo@gmail.com
      console.log("=== Creating Wallet for juwontayo@gmail.com ===");
      await createWalletForMember("juwontayo@gmail.com", {
        walletType: "member",
        currency: "NGN",
        ledger_balance: 0,
      });
    }

    console.log("\n✅ Wallet seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Wallet seeding failed:", error);
    process.exit(1);
  }
}

// Show usage if help is requested
if (args.includes("--help") || args.includes("-h")) {
  console.log(`
Wallet Seeder Runner

Usage:
  node run-wallet-seeder.js                    # Create wallet for juwontayo@gmail.com
  node run-wallet-seeder.js --email=user@example.com  # Create wallet for specific email
  node run-wallet-seeder.js --all              # Create wallets for all members without wallets
  node run-wallet-seeder.js --list             # List members without wallets
  node run-wallet-seeder.js --help             # Show this help message

Examples:
  node run-wallet-seeder.js --email=juwontayo@gmail.com
  node run-wallet-seeder.js --all
  node run-wallet-seeder.js --list
`);
  process.exit(0);
}

main();

