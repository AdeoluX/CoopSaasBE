const BaseRepository = require("./base.repo");
const Transaction = require("../models/Transactions");

class TransactionRepository extends BaseRepository {
  constructor() {
    super(Transaction);
  }
}

module.exports = new TransactionRepository();
