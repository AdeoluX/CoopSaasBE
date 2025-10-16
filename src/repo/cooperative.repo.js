const BaseRepository = require("./base.repo");
const Cooperative = require("../models/Cooperative");

class CooperativeRepository extends BaseRepository {
  constructor() {
    super(Cooperative);
  }
}

module.exports = new CooperativeRepository();
