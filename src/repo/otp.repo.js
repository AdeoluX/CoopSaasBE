const BaseRepository = require("./base.repo");
const Otp = require("../models/Otp");

class OtpRepository extends BaseRepository {
  constructor() {
    super(Otp);
  }
}

module.exports = new OtpRepository();
