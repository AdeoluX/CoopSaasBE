const app = require("../app");
const supertest = require("supertest");
const request = supertest(app);
const mongoose = require("mongoose");
const crypto = require("crypto");
const { faker } = require("@faker-js/faker");

describe("Paystack Webhook Tests", () => {
  jest.setTimeout(100000);

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
  });

  const generateWebhookSignature = (body, secretKey) => {
    return crypto
      .createHmac("sha512", secretKey)
      .update(JSON.stringify(body))
      .digest("hex");
  };

  test("should process successful charge webhook", async () => {
    const webhookBody = {
      event: "charge.success",
      data: {
        id: 123456789,
        status: "success",
        reference: `CNT-${faker.string.alphanumeric(32)}`,
        amount: 1000000, // 10,000 NGN in kobo
        currency: "NGN",
        metadata: {
          contribution: new mongoose.Types.ObjectId().toString(),
          wallet: new mongoose.Types.ObjectId().toString(),
        },
      },
    };

    const signature = generateWebhookSignature(
      webhookBody,
      process.env.PAYSTACK_SECRET_KEY
    );

    const response = await request
      .post("/api/v1/webhook/paystack/webhook")
      .set("Content-Type", "application/json")
      .set("x-paystack-signature", signature)
      .send(webhookBody);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  test("should reject webhook with invalid signature", async () => {
    const webhookBody = {
      event: "charge.success",
      data: {
        reference: `CNT-${faker.string.alphanumeric(32)}`,
        status: "success",
      },
    };

    const invalidSignature = "invalid_signature";

    const response = await request
      .post("/api/v1/webhook/paystack/webhook")
      .set("Content-Type", "application/json")
      .set("x-paystack-signature", invalidSignature)
      .send(webhookBody);

    expect(response.status).toBe(401);
  });

  test("should ignore non-charge events", async () => {
    const webhookBody = {
      event: "transfer.success",
      data: {
        reference: `TRF-${faker.string.alphanumeric(32)}`,
        status: "success",
      },
    };

    const signature = generateWebhookSignature(
      webhookBody,
      process.env.PAYSTACK_SECRET_KEY
    );

    const response = await request
      .post("/api/v1/webhook/paystack/webhook")
      .set("Content-Type", "application/json")
      .set("x-paystack-signature", signature)
      .send(webhookBody);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Event ignored");
  });

  test("should handle failed charge webhook", async () => {
    const webhookBody = {
      event: "charge.failed",
      data: {
        id: 123456789,
        status: "failed",
        reference: `CNT-${faker.string.alphanumeric(32)}`,
        amount: 1000000,
        currency: "NGN",
        metadata: {
          contribution: new mongoose.Types.ObjectId().toString(),
          wallet: new mongoose.Types.ObjectId().toString(),
        },
      },
    };

    const signature = generateWebhookSignature(
      webhookBody,
      process.env.PAYSTACK_SECRET_KEY
    );

    const response = await request
      .post("/api/v1/webhook/paystack/webhook")
      .set("Content-Type", "application/json")
      .set("x-paystack-signature", signature)
      .send(webhookBody);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
