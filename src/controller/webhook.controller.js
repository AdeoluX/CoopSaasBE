const catchAsync = require("../utils/catchAsync");
const { WebhookService } = require("../services");
const {
  successResponse,
  redirectResponse,
  abortIf,
} = require("../utils/responder");
const { paginateOptions } = require("../utils/utils.utils");
const crypto = require("crypto");
const { verifyTransaction } = require("../utils/paystack.utils");
const httpStatus = require("http-status");

class WebhookController {
  static fundWallet = catchAsync(async (req, res, next) => {
    const create = await WebhookService.fundWallet(req.body);
    return successResponse(res, create);
  });

  static paystackWebhook = catchAsync(async (req, res, next) => {
    let result;
    console.log(
      "Received Paystack webhook:",
      JSON.stringify(req.body, null, 2)
    );

    // Verify webhook signature for security
    const signature = req.headers["x-paystack-signature"];
    if (!signature && req.headers.host !== process.env.BACKEND_URL) {
      console.error("Missing Paystack signature header");
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (req.headers.host === process.env.BACKEND_URL) {
      const { reference } = req.query;
      //verify the refence on paystack
      const transaction = await verifyTransaction(reference);
      const { status, metadata } = transaction;
      if (status !== "success") {
        return res.status(200).json({ message: "Webhook received" });
      }
      const { cooperativeId, memberId } = metadata;
      const CooperativeRepo = require("../repo/cooperative.repo");
      const MemberRepo = require("../repo/member.repo");
      const cooperative = await CooperativeRepo.findById(cooperativeId);
      abortIf(!cooperative, httpStatus.NOT_FOUND, "Cooperative not found");
      const member = await MemberRepo.findById(memberId);
      abortIf(!member, httpStatus.NOT_FOUND, "Member not found");

      result = await WebhookService.paystackWebhook({ reference, status });
      return redirectResponse(
        res,
        `${process.env.FRONTEND_URL}/${cooperative.slug}/me`
      );
    } else {
      // Verify the webhook signature
      const hash = crypto
        .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
        .update(JSON.stringify(req.body))
        .digest("hex");

      if (hash !== signature) {
        console.error("Invalid webhook signature");
        return res.status(401).json({ error: "Invalid signature" });
      }

      // Paystack webhook format: { event: "charge.success", data: { reference, status, ... } }
      const { event, data } = req.body;

      if (!event || !data) {
        console.error("Invalid Paystack webhook format");
        return res.status(400).json({ error: "Invalid webhook format" });
      }

      // Process charge events (success and failed)
      if (event !== "charge.success" && event !== "charge.failed") {
        console.log(`Ignoring webhook event: ${event}`);
        return res.status(200).json({ message: "Event ignored" });
      }

      const { reference } = data;

      // Map event to status
      const status = event === "charge.success" ? "success" : "failed";

      if (!reference || !status) {
        console.error("Missing reference or status in webhook data");
        return res.status(400).json({ error: "Missing required fields" });
      }
      result = await WebhookService.paystackWebhook({ reference, status });
      return successResponse(res, result);
    }
  });
}

module.exports = WebhookController;
