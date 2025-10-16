const AccessControlService = require("../services/access-control.service");
const { errorResponse } = require("../utils/responder");

// Middleware to check feature access
const requireFeature = (feature) => {
  return async (req, res, next) => {
    try {
      const cooperativeId = req.auth?.cooperativeId;
      if (!cooperativeId) {
        return errorResponse(res, "Unauthorized", 401);
      }

      const accessCheck = await AccessControlService.hasFeatureAccess(
        cooperativeId,
        feature
      );

      if (!accessCheck.hasAccess) {
        return errorResponse(
          res,
          {
            message: "Access Denied",
            reason: accessCheck.reason,
            upgradeRequired: accessCheck.upgradeRequired,
            currentTier: accessCheck.currentTier,
            requiredTiers: accessCheck.requiredTiers,
            errorCode: "FEATURE_ACCESS_DENIED",
          },
          403
        );
      }

      // Add access info to request for potential use
      req.accessInfo = {
        feature,
        currentTier: accessCheck.currentTier,
        hasAccess: true,
      };

      next();
    } catch (error) {
      return errorResponse(
        res,
        {
          message: "Access Control Error",
          error: error.message,
          errorCode: "ACCESS_CONTROL_ERROR",
        },
        500
      );
    }
  };
};

// Middleware to check limits
const requireWithinLimit = (limitType, getValueFn) => {
  return async (req, res, next) => {
    try {
      const cooperativeId = req.auth?.cooperativeId;
      if (!cooperativeId) {
        return errorResponse(res, "Unauthorized", 401);
      }

      const currentValue = getValueFn(req);
      const limitCheck = await AccessControlService.checkLimits(
        cooperativeId,
        limitType,
        currentValue
      );

      if (!limitCheck.withinLimit) {
        return errorResponse(
          res,
          {
            message: "Limit Exceeded",
            reason: limitCheck.reason,
            currentValue: limitCheck.currentValue,
            limit: limitCheck.limit,
            currentTier: limitCheck.currentTier,
            upgradeRequired: limitCheck.upgradeRequired,
            errorCode: "LIMIT_EXCEEDED",
          },
          403
        );
      }

      next();
    } catch (error) {
      return errorResponse(
        res,
        {
          message: "Limit Check Error",
          error: error.message,
          errorCode: "LIMIT_CHECK_ERROR",
        },
        500
      );
    }
  };
};

// Middleware to check action permission (combination of feature and limits)
const requireAction = (action, getContextFn = () => ({})) => {
  return async (req, res, next) => {
    try {
      const cooperativeId = req.auth?.cooperativeId;
      if (!cooperativeId) {
        return errorResponse(res, "Unauthorized", 401);
      }

      const context = getContextFn(req);
      const actionCheck = await AccessControlService.canPerformAction(
        cooperativeId,
        action,
        context
      );

      if (!actionCheck.canPerform) {
        return errorResponse(
          res,
          {
            message: "Action Not Allowed",
            reason: actionCheck.reason,
            upgradeRequired: actionCheck.upgradeRequired,
            currentTier: actionCheck.currentTier,
            errorCode: "ACTION_NOT_ALLOWED",
          },
          403
        );
      }

      next();
    } catch (error) {
      return errorResponse(
        res,
        {
          message: "Action Check Error",
          error: error.message,
          errorCode: "ACTION_CHECK_ERROR",
        },
        500
      );
    }
  };
};

// Middleware to get available features and add to response
const addFeatureInfo = async (req, res, next) => {
  try {
    const cooperativeId = req.auth?.cooperativeId;
    if (cooperativeId) {
      const availableFeatures = await AccessControlService.getAvailableFeatures(
        cooperativeId
      );
      req.availableFeatures = availableFeatures;
    }
    next();
  } catch (error) {
    // Don't block the request, just log the error
    console.error("Error getting available features:", error);
    next();
  }
};

// Helper function to get member count from request
const getMemberCountFromRequest = (req) => {
  // This could be from body (creating new member) or from existing count
  return req.body?.memberCount || req.query?.memberCount || 0;
};

// Helper function to get transaction amount from request
const getTransactionAmountFromRequest = (req) => {
  return req.body?.amount || req.body?.transactionAmount || 0;
};

module.exports = {
  requireFeature,
  requireWithinLimit,
  requireAction,
  addFeatureInfo,
  getMemberCountFromRequest,
  getTransactionAmountFromRequest,
};
