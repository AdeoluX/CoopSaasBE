const BaseRepository = require("./base.repo");
const ScheduledReport = require("../models/ScheduledReport");

class ScheduledReportRepository extends BaseRepository {
  constructor() {
    super(ScheduledReport);
  }

  // Get reports due for delivery
  async getReportsDueForDelivery() {
    return await ScheduledReport.getReportsDueForDelivery();
  }

  // Get reports by cooperative
  async getReportsByCooperative(cooperativeId) {
    return await ScheduledReport.getReportsByCooperative(cooperativeId);
  }

  // Get active reports
  async getActiveReports(cooperativeId) {
    return await this.findAll({
      query: { cooperativeId, isActive: true },
      sort: { nextRun: 1 },
    });
  }

  // Get reports by type
  async getReportsByType(cooperativeId, reportType) {
    return await this.findAll({
      query: { cooperativeId, reportType, isActive: true },
      sort: { createdAt: -1 },
    });
  }

  // Get reports by frequency
  async getReportsByFrequency(cooperativeId, frequency) {
    return await this.findAll({
      query: { cooperativeId, "schedule.frequency": frequency, isActive: true },
      sort: { nextRun: 1 },
    });
  }

  // Get reports with delivery history
  async getReportsWithHistory(cooperativeId, limit = 10) {
    return await this.findAll({
      query: { cooperativeId },
      sort: { lastRun: -1 },
      limit,
      populate: "createdBy",
    });
  }

  // Get failed reports
  async getFailedReports(cooperativeId) {
    return await this.findAll({
      query: {
        cooperativeId,
        "deliveryHistory.status": "failed",
      },
      sort: { "deliveryHistory.sentAt": -1 },
    });
  }

  // Update next run time
  async updateNextRun(reportId) {
    const report = await this.findById(reportId);
    if (report) {
      report.nextRun = report.calculateNextRun();
      return await report.save();
    }
    return null;
  }

  // Mark report as delivered
  async markDelivered(reportId, deliveryResult) {
    const report = await this.findById(reportId);
    if (report) {
      return await report.markDelivered(deliveryResult);
    }
    return null;
  }

  // Get reports statistics
  async getReportStats(cooperativeId) {
    const stats = await this.aggregate([
      { $match: { cooperativeId: this.toObjectId(cooperativeId) } },
      {
        $group: {
          _id: null,
          totalReports: { $sum: 1 },
          activeReports: {
            $sum: { $cond: ["$isActive", 1, 0] },
          },
          reportsByType: {
            $push: "$reportType",
          },
          reportsByFrequency: {
            $push: "$schedule.frequency",
          },
        },
      },
    ]);

    if (stats.length === 0) {
      return {
        totalReports: 0,
        activeReports: 0,
        reportsByType: {},
        reportsByFrequency: {},
      };
    }

    const stat = stats[0];

    // Count by type
    const typeCount = {};
    stat.reportsByType.forEach((type) => {
      typeCount[type] = (typeCount[type] || 0) + 1;
    });

    // Count by frequency
    const frequencyCount = {};
    stat.reportsByFrequency.forEach((freq) => {
      frequencyCount[freq] = (frequencyCount[freq] || 0) + 1;
    });

    return {
      totalReports: stat.totalReports,
      activeReports: stat.activeReports,
      reportsByType: typeCount,
      reportsByFrequency: frequencyCount,
    };
  }

  // Helper method to convert string to ObjectId
  toObjectId(id) {
    if (typeof id === "string") {
      return new this.model.base.Types.ObjectId(id);
    }
    return id;
  }
}

module.exports = new ScheduledReportRepository();
