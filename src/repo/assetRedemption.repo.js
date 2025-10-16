const BaseRepository = require("./base.repo");
const AssetRedemption = require("../models/AssetRedemption");

class AssetRedemptionRepo extends BaseRepository {
  constructor() {
    super(AssetRedemption);
  }

  // Get pending redemptions for a cooperative
  async getPendingRedemptions(cooperativeId, options = {}) {
    return await AssetRedemption.getPendingRedemptions(cooperativeId, options);
  }

  // Get member's redemptions
  async getMemberRedemptions(memberId, cooperativeId, options = {}) {
    return await AssetRedemption.getMemberRedemptions(
      memberId,
      cooperativeId,
      options
    );
  }

  // Get redemption by ID with populated fields
  async findByIdWithPopulate(id) {
    return await AssetRedemption.findById(id)
      .populate("member", "firstname lastname email phone")
      .populate("asset", "name description settings")
      .populate("approvedBy", "firstname lastname")
      .populate("transactionId", "amount type status reference");
  }

  // Update redemption status
  async updateStatus(id, status, approvedBy = null, rejectionReason = null) {
    const updateData = {
      status,
      approvedAt: new Date(),
    };

    if (approvedBy) {
      updateData.approvedBy = approvedBy;
    }

    if (rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    }

    if (status === "completed") {
      updateData.completedAt = new Date();
    }

    return await AssetRedemption.findByIdAndUpdate(id, updateData, {
      new: true,
    });
  }

  // Get redemption statistics for a member
  async getMemberRedemptionStats(memberId, cooperativeId) {
    const stats = await AssetRedemption.aggregate([
      {
        $match: {
          member: memberId,
          cooperativeId: cooperativeId,
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$redemptionAmount" },
        },
      },
    ]);

    const result = {
      pending: { count: 0, totalAmount: 0 },
      approved: { count: 0, totalAmount: 0 },
      rejected: { count: 0, totalAmount: 0 },
      completed: { count: 0, totalAmount: 0 },
    };

    stats.forEach((stat) => {
      result[stat._id] = {
        count: stat.count,
        totalAmount: stat.totalAmount,
      };
    });

    return result;
  }
}

module.exports = new AssetRedemptionRepo();
