const BaseRepository = require("./base.repo");
const Withdrawal = require("../models/Withdrawal");

class WithdrawalRepository extends BaseRepository {
  constructor() {
    super(Withdrawal);
  }

  // Get pending withdrawals for cooperative
  async getPendingWithdrawals(cooperativeId, options = {}) {
    return await Withdrawal.getPendingWithdrawals(cooperativeId, options);
  }

  // Get withdrawals by member
  async getMemberWithdrawals(memberId, cooperativeId, options = {}) {
    const { page = 1, limit = 10, status } = options;
    const skip = (page - 1) * limit;

    let query = { member: memberId, cooperativeId };
    if (status) query.status = status;

    const withdrawals = await Withdrawal.find(query)
      .populate("assetId", "name description")
      .sort({ requestedAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Withdrawal.countDocuments(query);

    return {
      data: withdrawals,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit),
        hasNextPage: Number(page) < Math.ceil(total / limit),
        hasPrevPage: Number(page) > 1,
      },
    };
  }

  // Get withdrawal by ID with populated fields
  async getWithdrawalById(withdrawalId) {
    return await Withdrawal.findById(withdrawalId)
      .populate("member", "firstname lastname email phone")
      .populate("assetId", "name description")
      .populate("approvedBy", "firstname lastname")
      .populate("transactionId");
  }
}

module.exports = new WithdrawalRepository();
