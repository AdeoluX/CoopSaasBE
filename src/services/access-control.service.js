const CooperativeRepo = require("../repo/cooperative.repo");
const PlanRepo = require("../repo/plan.repo");

class AccessControlService {
  // Feature definitions with their required plans
  static FEATURE_REQUIREMENTS = {
    // Basic features (Starter plan)
    basic_member_management: ["starter", "growth", "enterprise"],
    payment_collection: ["starter", "growth", "enterprise"],
    basic_reporting: ["starter", "growth", "enterprise"],

    // Advanced features (Growth plan and above)
    loan_tracking: ["growth", "enterprise"],
    automated_payouts: ["growth", "enterprise"],
    priority_support: ["growth", "enterprise"],

    // Enterprise features (Enterprise plan only)
    custom_integrations: ["enterprise"],
    dedicated_account_manager: ["enterprise"],
    advanced_analytics: ["enterprise"],

    // Page access control
    admin_dashboard: ["starter", "growth", "enterprise"],
    member_management: ["starter", "growth", "enterprise"],
    asset_management: ["growth", "enterprise"],
    loan_management: ["growth", "enterprise"],
    wallet_management: ["starter", "growth", "enterprise"],
    withdrawal_management: ["starter", "growth", "enterprise"],
    settings_management: ["starter", "growth", "enterprise"],
    activity_logs: ["growth", "enterprise"],
    advanced_analytics_page: ["enterprise"],

    // API endpoint access
    create_member: ["starter", "growth", "enterprise"],
    update_member: ["starter", "growth", "enterprise"],
    delete_member: ["growth", "enterprise"],
    bulk_member_operations: ["growth", "enterprise"],

    create_asset: ["growth", "enterprise"],
    update_asset: ["growth", "enterprise"],
    delete_asset: ["enterprise"],
    publish_asset: ["growth", "enterprise"],

    create_loan: ["growth", "enterprise"],
    approve_loan: ["growth", "enterprise"],
    reject_loan: ["growth", "enterprise"],
    manage_loan_settings: ["enterprise"],

    view_transactions: ["starter", "growth", "enterprise"],
    export_transactions: ["growth", "enterprise"],
    bulk_transaction_operations: ["enterprise"],

    view_analytics: ["starter", "growth", "enterprise"],
    export_reports: ["growth", "enterprise"],
    custom_reports: ["enterprise"],

    // Limits
    member_limit: {
      starter: 100,
      growth: 500,
      enterprise: 999999,
    },
    transaction_limit: {
      starter: 500000,
      growth: 2000000,
      enterprise: 999999999,
    },
  };

  // Check if cooperative has access to a specific feature
  static async hasFeatureAccess(cooperativeId, feature) {
    try {
      const cooperative = await CooperativeRepo.findById(cooperativeId);
      if (!cooperative) {
        return { hasAccess: false, reason: "Cooperative not found" };
      }

      // Check if subscription is active
      const subscription = cooperative.settings?.subscription;
      if (!subscription || subscription.status !== "active") {
        return {
          hasAccess: false,
          reason: "Subscription is not active",
          requiredAction: "activate_subscription",
        };
      }

      const currentTier = subscription.tier;
      const requiredTiers = this.FEATURE_REQUIREMENTS[feature];

      if (!requiredTiers) {
        return { hasAccess: false, reason: "Feature not defined" };
      }

      const hasAccess = requiredTiers.includes(currentTier);

      return {
        hasAccess,
        reason: hasAccess
          ? "Access granted"
          : `Requires ${requiredTiers[0]} plan or higher`,
        currentTier,
        requiredTiers,
        upgradeRequired: !hasAccess ? requiredTiers[0] : null,
      };
    } catch (error) {
      throw new Error(`Failed to check feature access: ${error.message}`);
    }
  }

  // Check if cooperative is within limits
  static async checkLimits(cooperativeId, limitType, currentValue) {
    try {
      const cooperative = await CooperativeRepo.findById(cooperativeId);
      if (!cooperative) {
        return { withinLimit: false, reason: "Cooperative not found" };
      }

      const subscription = cooperative.settings?.subscription;
      if (!subscription || subscription.status !== "active") {
        return { withinLimit: false, reason: "Subscription is not active" };
      }

      const currentTier = subscription.tier;
      const limit = this.FEATURE_REQUIREMENTS[limitType]?.[currentTier];

      if (limit === undefined) {
        return { withinLimit: false, reason: "Limit not defined" };
      }

      const withinLimit = currentValue < limit;

      return {
        withinLimit,
        reason: withinLimit ? "Within limit" : `Exceeds ${limitType} limit`,
        currentValue,
        limit,
        currentTier,
        upgradeRequired: !withinLimit ? this.getNextTier(currentTier) : null,
      };
    } catch (error) {
      throw new Error(`Failed to check limits: ${error.message}`);
    }
  }

  // Get next tier for upgrade suggestions
  static getNextTier(currentTier) {
    const tiers = ["starter", "growth", "enterprise"];
    const currentIndex = tiers.indexOf(currentTier);
    return currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : null;
  }

  // Get all features available to a cooperative
  static async getAvailableFeatures(cooperativeId) {
    try {
      const cooperative = await CooperativeRepo.findById(cooperativeId);
      if (!cooperative) {
        return { features: [], reason: "Cooperative not found" };
      }

      const subscription = cooperative.settings?.subscription;
      if (!subscription || subscription.status !== "active") {
        return { features: [], reason: "Subscription is not active" };
      }

      const currentTier = subscription.tier;
      const availableFeatures = [];

      for (const [feature, requiredTiers] of Object.entries(
        this.FEATURE_REQUIREMENTS
      )) {
        if (
          Array.isArray(requiredTiers) &&
          requiredTiers.includes(currentTier)
        ) {
          availableFeatures.push(feature);
        }
      }

      return {
        features: availableFeatures,
        currentTier,
        subscription,
      };
    } catch (error) {
      throw new Error(`Failed to get available features: ${error.message}`);
    }
  }

  // Check if cooperative can perform an action (combination of feature access and limits)
  static async canPerformAction(cooperativeId, action, context = {}) {
    try {
      // First check feature access
      const featureAccess = await this.hasFeatureAccess(cooperativeId, action);
      if (!featureAccess.hasAccess) {
        return featureAccess;
      }

      // Then check limits if applicable
      if (context.memberCount !== undefined) {
        const memberLimit = await this.checkLimits(
          cooperativeId,
          "member_limit",
          context.memberCount
        );
        if (!memberLimit.withinLimit) {
          return memberLimit;
        }
      }

      if (context.transactionAmount !== undefined) {
        const transactionLimit = await this.checkLimits(
          cooperativeId,
          "transaction_limit",
          context.transactionAmount
        );
        if (!transactionLimit.withinLimit) {
          return transactionLimit;
        }
      }

      return { canPerform: true, reason: "Action allowed" };
    } catch (error) {
      throw new Error(`Failed to check action permission: ${error.message}`);
    }
  }

  // Get upgrade suggestions for a cooperative
  static async getUpgradeSuggestions(cooperativeId) {
    try {
      const cooperative = await CooperativeRepo.findById(cooperativeId);
      if (!cooperative) {
        return { suggestions: [], reason: "Cooperative not found" };
      }

      const subscription = cooperative.settings?.subscription;
      if (!subscription) {
        return { suggestions: [], reason: "No subscription found" };
      }

      const currentTier = subscription.tier;
      const nextTier = this.getNextTier(currentTier);

      if (!nextTier) {
        return { suggestions: [], reason: "Already on highest tier" };
      }

      // Get features that would be unlocked with upgrade
      const unlockedFeatures = [];
      for (const [feature, requiredTiers] of Object.entries(
        this.FEATURE_REQUIREMENTS
      )) {
        if (
          Array.isArray(requiredTiers) &&
          requiredTiers.includes(nextTier) &&
          !requiredTiers.includes(currentTier)
        ) {
          unlockedFeatures.push(feature);
        }
      }

      // Get plan details
      const nextPlan = await PlanRepo.getPlanByTier(nextTier);

      return {
        suggestions: [
          {
            currentTier,
            suggestedTier: nextTier,
            suggestedPlan: nextPlan,
            unlockedFeatures,
            upgradeReason: "Access to additional features",
          },
        ],
        currentTier,
        nextTier,
      };
    } catch (error) {
      throw new Error(`Failed to get upgrade suggestions: ${error.message}`);
    }
  }
}

module.exports = AccessControlService;
