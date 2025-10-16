const BaseRepository = require("./base.repo");
const Loan = require("../models/Loan");

class LoanRepository extends BaseRepository {
  constructor() {
    super(Loan);
  }
}

module.exports = new LoanRepository();
