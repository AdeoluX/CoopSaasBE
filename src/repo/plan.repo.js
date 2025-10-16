const BaseRepository = require("./base.repo");
const Plan = require("../models/Plan");

class PlanRepository extends BaseRepository {
  constructor() {
    super(Plan);
  }

  // Get all active plans
  async getActivePlans() {
    return await this.model.find({ is_active: true }).sort({ sort_order: 1 });
  }

  // Get plan by tier
  async getPlanByTier(tier) {
    return await this.model.findOne({ tier, is_active: true });
  }

  // Get plan with features
  async getPlanWithFeatures(planId) {
    return await this.model.findById(planId).select("+features");
  }

  // Check if plan supports feature
  async planSupportsFeature(planId, feature) {
    const plan = await this.model.findById(planId);
    return plan && plan.features && plan.features[feature] === true;
  }

  // Get plan limits
  async getPlanLimits(planId) {
    const plan = await this.model.findById(planId);
    if (!plan) return null;

    return {
      member_limit: plan.member_limit,
      transaction_limit: plan.transaction_limit,
      monthly_fee: plan.monthly_fee,
    };
  }

  // Get all plans for admin display
  async getAllPlansForAdmin() {
    return await this.model.find({}).sort({ sort_order: 1 });
  }

  // Update plan features
  async updatePlanFeatures(planId, features) {
    return await this.model.findByIdAndUpdate(
      planId,
      { $set: { features } },
      { new: true }
    );
  }

  // Update plan pricing
  async updatePlanPricing(planId, pricing) {
    const { monthly_fee, member_limit, transaction_limit } = pricing;
    return await this.model.findByIdAndUpdate(
      planId,
      {
        $set: {
          monthly_fee,
          member_limit,
          transaction_limit,
        },
      },
      { new: true }
    );
  }
}

module.exports = new PlanRepository();
