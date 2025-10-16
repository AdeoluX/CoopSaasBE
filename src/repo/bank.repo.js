const BaseRepository = require("./base.repo");
const Bank = require("../models/Bank");

class BankRepository extends BaseRepository {
  constructor() {
    super(Bank);
  }

  // Get bank by member ID
  async getBankByMember(memberId) {
    return await this.model.findOne({ member: memberId });
  }

  // Create or update bank for member
  async createOrUpdateBankForMember(memberId, bankData) {
    const existingBank = await this.getBankByMember(memberId);

    if (existingBank) {
      return await this.model.findByIdAndUpdate(existingBank._id, bankData, {
        new: true,
        runValidators: true,
      });
    } else {
      return await this.model.create({
        ...bankData,
        member: memberId,
      });
    }
  }

  // Delete bank for member
  async deleteBankForMember(memberId) {
    return await this.model.findOneAndDelete({ member: memberId });
  }

  // Get all banks (for listing)
  async getAllBanks() {
    return await this.model.find({}).sort({ bankName: 1 });
  }
}

module.exports = new BankRepository();

