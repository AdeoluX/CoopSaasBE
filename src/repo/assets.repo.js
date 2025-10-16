const BaseRepository = require("./base.repo");
const Assets = require("../models/Assets");

class AssetsRepository extends BaseRepository {
  constructor() {
    super(Assets);
  }
}

module.exports = new AssetsRepository();
