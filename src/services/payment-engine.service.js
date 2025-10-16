const httpStatus = require("http-status");
const { generateRandomString } = require("../utils/utils.utils");
const mongoose = require("mongoose");
const { abortIf } = require("../utils/responder");
const WalletRepo = require("../repo/wallet.repo");
const TransactionRepo = require("../repo/transaction.repo");
const MemberRepo = require("../repo/member.repo");
const AssetsRepo = require("../repo/assets.repo");
const AssetUserRepo = require("../repo/assetUser.repo");

class PaymentEngineService {
  static fundWallet = async ({ auth, amount, currency }) => {
    const { id } = auth;
    const wallet = await WalletRepo.findOne({
      query: {
        currency,
        member: id,
      },
      populate: "member",
    });
    const reference = `FW-${generateRandomString(10, "alpha")}`;
    const transaction = await TransactionRepo.create({
      wallet_id: wallet.id,
      member: id,
      amount,
      type: "CR",
      currency,
      description: "Wallet Funding",
      reference,
    });
    return {
      amount,
      reference,
      email: wallet?.member?.email,
    };
  };
  static buyToken = async ({ auth, tokens, asset_id, currency }) => {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const { id } = auth;
      const user = (
        await MemberRepo.findOne({
          query: { _id: id },
          populate: "wallets",
        })
      ).toJSON();
      const wallet = user.wallets.find((item) => item.currency === currency);
      const { availableBalance } = wallet;
      const walletId = wallet.id;
      const asset = await AssetsRepo.findById(asset_id);
      const amount = Number(tokens * asset.minimumAmount);
      abortIf(
        amount > availableBalance,
        httpStatus.BAD_REQUEST,
        "Insufficient Funds."
      );

      const { availableTokens } = asset;
      abortIf(
        tokens > availableTokens,
        httpStatus.BAD_REQUEST,
        "Not Enough Tokens available."
      );
      //increment amountPaid
      await AssetsRepo.updateWithSession(
        asset_id,
        {
          $inc: { amountPaid: amount },
        },
        session
      );
      const reference = `AP-${generateRandomString(10, "alpha")}`;
      await TransactionRepo.createWithSession(
        {
          wallet_id: walletId,
          member: id,
          amount: Number(tokens * asset.minimumAmount),
          type: "DR",
          currency,
          description: "Asset Purchase",
          reference,
          status: "success",
        },
        session
      );
      //decrement wallet of User
      await WalletRepo.updateWithSession(
        walletId,
        {
          $inc: { ledger_balance: -Number(tokens * asset.minimumAmount) },
        },
        session
      );
      //check AssetUser table
      const assetUser = await AssetUserRepo.findOne({
        query: {
          member: id,
          asset: asset_id,
        },
      });
      if (!assetUser) {
        await AssetUserRepo.createWithSession(
          {
            member: id,
            asset: asset_id,
            tokenOwned: tokens,
          },
          session
        );
      } else {
        await AssetUserRepo.updateWithSession(
          assetUser._id,
          {
            $inc: { tokenOwned: Number(tokens) },
          },
          session
        );
      }
      await session.commitTransaction();
      return { message: "Asset Bought Successfully!" };
    } catch (error) {
      await session.abortTransaction();
      abortIf(error, httpStatus.INTERNAL_SERVER_ERROR, "Something went wrong!");
    } finally {
      await session.endSession();
    }
  };
}

module.exports = PaymentEngineService;
