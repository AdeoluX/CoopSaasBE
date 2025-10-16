const mongoose = require("mongoose");
const Transaction = require("../src/models/Transactions");
const Wallet = require("../src/models/Wallet");
const Member = require("../src/models/Members");
const Cooperative = require("../src/models/Cooperative");

describe("Wallet Balance Update Tests", () => {
  let member, cooperative, wallet, transaction;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/test"
    );
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear test data
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
      ledger_balance: 1000, // Starting balance
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

  test("should increment wallet balance for successful CR transaction", async () => {
    const initialBalance = wallet.ledger_balance;
    const transactionAmount = transaction.amount;

    console.log(`Initial wallet balance: ${initialBalance}`);
    console.log(`Transaction amount: ${transactionAmount}`);
    console.log(`Transaction type: ${transaction.type}`);

    // Process the webhook update
    const updatedTransaction = await Transaction.handleWebhookUpdate(
      transaction.reference,
      "success"
    );

    // Fetch updated wallet
    const updatedWallet = await Wallet.findById(wallet._id);

    console.log(`Final wallet balance: ${updatedWallet.ledger_balance}`);
    console.log(`Expected balance: ${initialBalance + transactionAmount}`);

    // Verify balance was incremented
    expect(updatedWallet.ledger_balance).toBe(
      initialBalance + transactionAmount
    );
    expect(updatedTransaction.status).toBe("success");
  });

  test("should not update wallet balance for failed transaction", async () => {
    const initialBalance = wallet.ledger_balance;

    // Process failed webhook
    const updatedTransaction = await Transaction.handleWebhookUpdate(
      transaction.reference,
      "failed"
    );

    // Fetch updated wallet
    const updatedWallet = await Wallet.findById(wallet._id);

    // Verify balance was not changed
    expect(updatedWallet.ledger_balance).toBe(initialBalance);
    expect(updatedTransaction.status).toBe("failed");
  });

  test("should handle DR transaction correctly", async () => {
    // Create a DR transaction
    const drTransaction = await Transaction.create({
      member: member._id,
      cooperativeId: cooperative._id,
      amount: 200,
      type: "DR",
      descriptions: "Test withdrawal",
      currency: "NGN",
      reference: `DR-TEST-${Date.now()}`,
      status: "pending",
      assetId: null,
    });

    const initialBalance = wallet.ledger_balance;

    // Process the webhook update
    await Transaction.handleWebhookUpdate(drTransaction.reference, "success");

    // Fetch updated wallet
    const updatedWallet = await Wallet.findById(wallet._id);

    // Verify balance was decremented for DR transaction
    expect(updatedWallet.ledger_balance).toBe(
      initialBalance - drTransaction.amount
    );
  });
});
