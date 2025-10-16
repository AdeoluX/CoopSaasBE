const BaseRepository = require("./base.repo");
const Member = require("../models/Members");

class MemberRepository extends BaseRepository {
  constructor() {
    super(Member);
  }
}

module.exports = new MemberRepository();
