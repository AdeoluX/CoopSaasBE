const BaseRepository = require("./base.repo");
const Activity = require("../models/Activity");

class ActivityRepository extends BaseRepository {
  constructor() {
    super(Activity);
  }

  // Get member activity feed with filtering and pagination
  async getMemberActivityFeed(memberId, options = {}) {
    return await this.model.getMemberActivityFeed(memberId, options);
  }

  // Get cooperative activity log (for admins)
  async getCooperativeActivityLog(cooperativeId, options = {}) {
    return await this.model.getCooperativeActivityLog(cooperativeId, options);
  }

  // Log transaction activity
  async logTransactionActivity(
    type,
    memberId,
    cooperativeId,
    transactionId,
    metadata = {},
    session = null
  ) {
    return await this.model.logTransactionActivity(
      type,
      memberId,
      cooperativeId,
      transactionId,
      metadata,
      session
    );
  }

  // Log loan activity
  async logLoanActivity(
    type,
    memberId,
    cooperativeId,
    loanId,
    metadata = {},
    session = null
  ) {
    return await this.model.logLoanActivity(
      type,
      memberId,
      cooperativeId,
      loanId,
      metadata,
      session
    );
  }

  // Log asset activity
  async logAssetActivity(
    type,
    memberId,
    cooperativeId,
    assetId,
    assetUserId = null,
    metadata = {},
    session = null
  ) {
    return await this.model.logAssetActivity(
      type,
      memberId,
      cooperativeId,
      assetId,
      assetUserId,
      metadata,
      session
    );
  }

  // Log general activity
  async logActivity(activityData, session = null) {
    return await this.model.logActivity(activityData, session);
  }
}

module.exports = new ActivityRepository();
