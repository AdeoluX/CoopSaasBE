const BaseRepository = require("./base.repo");
const AssetUser = require("../models/AssetUser");

class AssetUserRepository extends BaseRepository {
  constructor() {
    super(AssetUser);
  }

  // Find or create asset holding
  async findOrCreate(memberId, assetId, cooperativeId, session = null) {
    return await AssetUser.findOrCreate(
      memberId,
      assetId,
      cooperativeId,
      session
    );
  }

  // Add investment to asset holding
  async addInvestment(
    memberId,
    assetId,
    quantity,
    price,
    transactionId,
    session = null
  ) {
    return await AssetUser.addInvestment(
      memberId,
      assetId,
      quantity,
      price,
      transactionId,
      session
    );
  }

  // Sell asset holding
  async sellAsset(
    memberId,
    assetId,
    quantity,
    price,
    transactionId,
    session = null
  ) {
    return await AssetUser.sellAsset(
      memberId,
      assetId,
      quantity,
      price,
      transactionId,
      session
    );
  }

  // Get member portfolio
  async getMemberPortfolio(memberId, options = {}) {
    return await AssetUser.getMemberPortfolio(memberId, options);
  }

  // Get asset holders
  async getAssetHolders(assetId, options = {}) {
    return await AssetUser.getAssetHolders(assetId, options);
  }

  // Get asset transactions
  async getAssetTransactions(assetUserId, options = {}) {
    return await AssetUser.getAssetTransactions(assetUserId, options);
  }

  // Get active holdings by member
  async getActiveHoldingsByMember(memberId, cooperativeId) {
    return await this.findAll({
      query: {
        member: memberId,
        cooperativeId,
        status: "active",
      },
      populate: "asset",
      sort: { updatedAt: -1 },
    });
  }

  // Get holdings by asset
  async getHoldingsByAsset(assetId, cooperativeId) {
    return await this.findAll({
      query: {
        asset: assetId,
        cooperativeId,
        status: "active",
      },
      populate: "member",
      sort: { quantity: -1 },
    });
  }

  // Get total investment by member
  async getTotalInvestmentByMember(memberId, cooperativeId) {
    const result = await this.aggregate([
      {
        $match: {
          member: this.toObjectId(memberId),
          cooperativeId: this.toObjectId(cooperativeId),
          status: "active",
        },
      },
      {
        $group: {
          _id: null,
          totalInvestment: { $sum: "$totalInvested" },
          totalQuantity: { $sum: "$quantity" },
          assetCount: { $sum: 1 },
        },
      },
    ]);

    return result.length > 0
      ? result[0]
      : {
          totalInvestment: 0,
          totalQuantity: 0,
          assetCount: 0,
        };
  }

  // Get portfolio summary by member
  async getPortfolioSummary(memberId, cooperativeId) {
    const holdings = await this.findAll({
      query: {
        member: memberId,
        cooperativeId,
        status: "active",
      },
      populate: "asset",
      sort: { updatedAt: -1 },
    });

    const summary = {
      totalAssets: holdings.data.length,
      totalInvestment: holdings.data.reduce(
        (sum, holding) => sum + (holding.totalInvested || 0),
        0
      ),
      totalQuantity: holdings.data.reduce(
        (sum, holding) => sum + (holding.quantity || 0),
        0
      ),
      assets: holdings.data.map((holding) => ({
        assetId: holding.asset._id,
        assetName: holding.asset.name,
        quantity: holding.quantity,
        totalInvested: holding.totalInvested,
        averagePrice: holding.averagePrice,
        currentValue: holding.currentValue,
        profitLoss: holding.profitLoss,
        profitLossPercentage: holding.profitLossPercentage,
      })),
    };

    return summary;
  }

  // Helper method to convert string to ObjectId
  toObjectId(id) {
    if (typeof id === "string") {
      return new this.model.base.Types.ObjectId(id);
    }
    return id;
  }
}

module.exports = new AssetUserRepository();
