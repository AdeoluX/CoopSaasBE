const app = require("../app");
const supertest = require("supertest");
const request = supertest(app);
const mongoose = require("mongoose");
const Activity = require("../src/models/Activity");
const Member = require("../src/models/Members");
const Cooperative = require("../src/models/Cooperative");
const { generateToken } = require("../src/utils/tokenManagement");

describe("Member Activities Endpoint Tests", () => {
  let member, cooperative, token;

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

    // Generate token for authentication
    token = generateToken({
      id: member._id,
      cooperative: false,
      cooperativeId: cooperative._id,
      role: "user",
    });

    // Create some test activities
    await Activity.create([
      {
        type: "transaction_initiated",
        category: "transaction",
        member: member._id,
        cooperativeId: cooperative._id,
        status: "pending",
        title: "Transaction Initiated",
        description: "Transaction initiated for 1000 NGN",
        metadata: { amount: 1000, currency: "NGN" },
        visibleToUser: true,
      },
      {
        type: "transaction_successful",
        category: "transaction",
        member: member._id,
        cooperativeId: cooperative._id,
        status: "success",
        title: "Transaction Successful",
        description: "Transaction completed successfully for 1000 NGN",
        metadata: { amount: 1000, currency: "NGN" },
        visibleToUser: true,
      },
      {
        type: "wallet_created",
        category: "wallet",
        member: member._id,
        cooperativeId: cooperative._id,
        status: "success",
        title: "Wallet Created",
        description: "New wallet created for NGN currency",
        metadata: { currency: "NGN" },
        visibleToUser: true,
      },
      {
        type: "wallet_balance_updated",
        category: "wallet",
        member: member._id,
        cooperativeId: cooperative._id,
        status: "success",
        title: "Wallet Balance Updated",
        description: "Wallet balance increased by 1000 NGN",
        metadata: { amount: 1000, currency: "NGN" },
        visibleToUser: true,
      },
    ]);
  });

  test("should get member activities with default limit of 10", async () => {
    const response = await request
      .get("/api/v1/member/my-activities")
      .set("Authorization", `Bearer ${token.access_token}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.activities).toBeDefined();
    expect(response.body.data.activities.length).toBeLessThanOrEqual(10);
    expect(response.body.data.total).toBe(4);
    expect(response.body.data.limit).toBe(10);

    // Check activity structure
    const activity = response.body.data.activities[0];
    expect(activity).toHaveProperty("id");
    expect(activity).toHaveProperty("type");
    expect(activity).toHaveProperty("category");
    expect(activity).toHaveProperty("status");
    expect(activity).toHaveProperty("title");
    expect(activity).toHaveProperty("description");
    expect(activity).toHaveProperty("metadata");
    expect(activity).toHaveProperty("createdAt");
    expect(activity).toHaveProperty("timeAgo");
  });

  test("should get activities with custom limit", async () => {
    const response = await request
      .get("/api/v1/member/my-activities?limit=2")
      .set("Authorization", `Bearer ${token.access_token}`)
      .expect(200);

    expect(response.body.data.activities.length).toBeLessThanOrEqual(2);
    expect(response.body.data.limit).toBe(2);
  });

  test("should filter activities by category", async () => {
    const response = await request
      .get("/api/v1/member/my-activities?category=transaction")
      .set("Authorization", `Bearer ${token.access_token}`)
      .expect(200);

    expect(response.body.data.activities.length).toBe(2);
    response.body.data.activities.forEach((activity) => {
      expect(activity.category).toBe("transaction");
    });
  });

  test("should filter activities by type", async () => {
    const response = await request
      .get("/api/v1/member/my-activities?type=transaction_successful")
      .set("Authorization", `Bearer ${token.access_token}`)
      .expect(200);

    expect(response.body.data.activities.length).toBe(1);
    expect(response.body.data.activities[0].type).toBe(
      "transaction_successful"
    );
  });

  test("should filter activities by status", async () => {
    const response = await request
      .get("/api/v1/member/my-activities?status=success")
      .set("Authorization", `Bearer ${token.access_token}`)
      .expect(200);

    expect(response.body.data.activities.length).toBe(3);
    response.body.data.activities.forEach((activity) => {
      expect(activity.status).toBe("success");
    });
  });

  test("should combine multiple filters", async () => {
    const response = await request
      .get("/api/v1/member/my-activities?category=transaction&status=success")
      .set("Authorization", `Bearer ${token.access_token}`)
      .expect(200);

    expect(response.body.data.activities.length).toBe(1);
    const activity = response.body.data.activities[0];
    expect(activity.category).toBe("transaction");
    expect(activity.status).toBe("success");
  });

  test("should return activities in descending order (most recent first)", async () => {
    const response = await request
      .get("/api/v1/member/my-activities")
      .set("Authorization", `Bearer ${token.access_token}`)
      .expect(200);

    const activities = response.body.data.activities;
    for (let i = 0; i < activities.length - 1; i++) {
      const currentDate = new Date(activities[i].createdAt);
      const nextDate = new Date(activities[i + 1].createdAt);
      expect(currentDate.getTime()).toBeGreaterThanOrEqual(nextDate.getTime());
    }
  });

  test("should not return activities for other members", async () => {
    // Create another member
    const otherMember = await Member.create({
      firstname: "Jane",
      middlename: "Doe",
      lastname: "Smith",
      email: "jane@test.com",
      password: "password123",
      cooperativeId: cooperative._id,
    });

    // Create activity for other member
    await Activity.create({
      type: "transaction_initiated",
      category: "transaction",
      member: otherMember._id,
      cooperativeId: cooperative._id,
      status: "pending",
      title: "Transaction Initiated",
      description: "Transaction initiated for 500 NGN",
      metadata: { amount: 500, currency: "NGN" },
      visibleToUser: true,
    });

    const response = await request
      .get("/api/v1/member/my-activities")
      .set("Authorization", `Bearer ${token.access_token}`)
      .expect(200);

    // Should still only return 4 activities (the original ones for the authenticated member)
    expect(response.body.data.total).toBe(4);
  });

  test("should not return hidden activities", async () => {
    // Create a hidden activity
    await Activity.create({
      type: "system_maintenance",
      category: "system",
      member: member._id,
      cooperativeId: cooperative._id,
      status: "success",
      title: "System Maintenance",
      description: "System maintenance completed",
      visibleToUser: false,
    });

    const response = await request
      .get("/api/v1/member/my-activities")
      .set("Authorization", `Bearer ${token.access_token}`)
      .expect(200);

    // Should still only return 4 activities (the visible ones)
    expect(response.body.data.total).toBe(4);
  });
});
