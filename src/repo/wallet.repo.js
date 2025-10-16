const BaseRepository = require("./base.repo");
const Wallet = require("../models/Wallet");

class WalletRepository extends BaseRepository {
  constructor() {
    super(Wallet);
  }
}

module.exports = new WalletRepository();
