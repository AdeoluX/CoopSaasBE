const BaseRepository = require("./base.repo");
const Invitation = require("../models/Invitation");

class InvitationRepository extends BaseRepository {
  constructor() {
    super(Invitation);
  }

  async createInvitation(invitationData) {
    return await this.model.createInvitation(invitationData);
  }

  async findByCode(code) {
    return await this.model.findByCode(code);
  }

  async findByLink(link) {
    return await this.model.findByLink(link);
  }

  async getPendingInvitations(cooperativeId, options = {}) {
    return await this.model.getPendingInvitations(cooperativeId, options);
  }
}

module.exports = new InvitationRepository();
