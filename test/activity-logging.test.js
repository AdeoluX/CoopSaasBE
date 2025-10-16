const mongoose = require("mongoose");
const Transaction = require("../src/models/Transactions");
const Wallet = require("../src/models/Wallet");
const Activity = require("../src/models/Activity");
const Member = require("../src/models/Members");
const Cooperative = require("../src/models/Cooperative");

describe("Activity Logging Tests", () => {
  let member, cooperative, wallet, transaction;

  beforeAll(async () => {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/test"
    );
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await mongoose.connection.db.dropDatabase();

    // Create test cooperative
    cooperative = await Cooperative.create({
      name: "Test Cooperative",
      code: "TEST001",
      auth_credentials: {
        email: "test@coop.com",
        password: "password123",
      },
    });

    // Create test member
    member = await Member.create({
      firstname: "John",
      middlename: "Doe",
      lastname: "Smith",
      email: "john@test.com",
      password: "password123",
      cooperativeId: cooperative._id,
    });

    // Create test wallet
    wallet = await Wallet.create({
      member: member._id,
      cooperativeId: cooperative._id,
      assetId: null,
      currency: "NGN",
      ledger_balance: 1000,
    });

    // Create test transaction
    transaction = await Transaction.create({
      member: member._id,
      cooperativeId: cooperative._id,
      amount: 500,
      type: "CR",
      descriptions: "Test contribution",
      currency: "NGN",
      reference: `TEST-${Date.now()}`,
      status: "pending",
      assetId: null,
    });
  });

  test("should log activity when transaction is processed successfully", async () => {
    const initialActivityCount = await Activity.countDocuments();

    // Process the webhook update
    await Transaction.handleWebhookUpdate(transaction.reference, "success");

    // Check that activities were created
    const finalActivityCount = await Activity.countDocuments();
    expect(finalActivityCount).toBeGreaterThan(initialActivityCount);

    // Get the activities
    const activities = await Activity.find({
      "relatedEntities.transaction": transaction._id,
    }).sort({ createdAt: -1 });

    console.log(`Created ${activities.length} activities for transaction`);

    // Should have at least transaction_successful and wallet_balance_updated activities
    const activityTypes = activities.map((a) => a.type);
    expect(activityTypes).toContain("transaction_successful");
    expect(activityTypes).toContain("wallet_balance_updated");

    // Check transaction_successful activity
    const successfulActivity = activities.find(
      (a) => a.type === "transaction_successful"
    );
    expect(successfulActivity).toBeDefined();
    expect(successfulActivity.status).toBe("success");
    expect(successfulActivity.metadata.amount).toBe(500);
    expect(successfulActivity.metadata.type).toBe("CR");

    // Check wallet_balance_updated activity
    const walletActivity = activities.find(
      (a) => a.type === "wallet_balance_updated"
    );
    expect(walletActivity).toBeDefined();
    expect(walletActivity.status).toBe("success");
    expect(walletActivity.metadata.amount).toBe(500);
    expect(walletActivity.metadata.type).toBe("CR");
  });

  test("should log activity when transaction fails", async () => {
    const initialActivityCount = await Activity.countDocuments();

    // Process failed webhook
    await Transaction.handleWebhookUpdate(transaction.reference, "failed");

    // Check that activity was created
    const finalActivityCount = await Activity.countDocuments();
    expect(finalActivityCount).toBeGreaterThan(initialActivityCount);

    // Get the failed activity
    const failedActivity = await Activity.findOne({
      type: "transaction_failed",
      "relatedEntities.transaction": transaction._id,
    });

    expect(failedActivity).toBeDefined();
    expect(failedActivity.status).toBe("failed");
    expect(failedActivity.metadata.amount).toBe(500);
    expect(failedActivity.metadata.type).toBe("CR");
  });

  test("should log wallet creation activity", async () => {
    // Create a new wallet (simulating contribute function)
    const newWallet = await Wallet.create({
      member: member._id,
      cooperativeId: cooperative._id,
      assetId: null,
      currency: "USD",
      ledger_balance: 0,
    });

    // Log wallet creation activity
    await Activity.logActivity({
      type: "wallet_created",
      category: "wallet", // ✅ Explicitly set category
      member: member._id,
      cooperativeId: cooperative._id,
      status: "success",
      title: "Wallet Created",
      description:
        "New wallet created for USD currency for general contributions",
      metadata: {
        currency: "USD",
        assetId: null,
        walletId: newWallet._id,
      },
      relatedEntities: {
        wallet: newWallet._id,
      },
    });

    // Check that activity was created
    const walletActivity = await Activity.findOne({
      type: "wallet_created",
      "relatedEntities.wallet": newWallet._id,
    });

    expect(walletActivity).toBeDefined();
    expect(walletActivity.status).toBe("success");
    expect(walletActivity.metadata.currency).toBe("USD");
  });
});
