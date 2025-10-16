const TransactionRepo = require("../repo/transaction.repo");
const MemberRepo = require("../repo/member.repo");
const LoanRepo = require("../repo/loan.repo");
const AssetUserRepo = require("../repo/assetUser.repo");
const WalletRepo = require("../repo/wallet.repo");
const AssetsRepo = require("../repo/assets.repo");
const CooperativeRepo = require("../repo/cooperative.repo");
const ScheduledReportRepo = require("../repo/scheduledReport.repo");
const mongoose = require("mongoose");
const moment = require("moment");
const sendEmail = require("../utils/email.util");

class ReportingService {
  // ===== FINANCIAL REPORTS =====

  // Profit & Loss Report
  static async generateProfitLossReport({ cooperativeId, startDate, endDate }) {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);

      // Get all transactions in date range
      const transactions = await TransactionRepo.findAll({
        query: {
          cooperativeId,
          createdAt: { $gte: start, $lte: end },
          status: "success",
        },
        page: 1,
        limit: 10000, // Get all transactions
      });

      // Normalize to a plain array in case the repo returns either
      // { data: [...]} or just an array [...]
      const txns = Array.isArray(transactions?.data)
        ? transactions.data
        : Array.isArray(transactions)
        ? transactions
        : [];

      // Calculate revenue (contributions, loan repayments)
      const revenue = txns
        .filter(
          (t) => t.type === "CR" && !t.descriptions.includes("Loan approved")
        )
        .reduce((sum, t) => sum + t.amount, 0);

      // Calculate expenses (withdrawals, loan disbursements)
      const expenses = txns
        .filter(
          (t) => t.type === "DR" && !t.descriptions.includes("Asset purchase")
        )
        .reduce((sum, t) => sum + t.amount, 0);

      // Calculate loan interest income
      const loanInterest = txns
        .filter(
          (t) => t.descriptions.includes("Loan payment") && t.type === "CR"
        )
        .reduce((sum, t) => {
          // Extract interest amount from loan payments
          const interestMatch = t.descriptions.match(/Interest: (\d+)/);
          return sum + (interestMatch ? parseInt(interestMatch[1]) : 0);
        }, 0);

      // Calculate asset investment returns
      const assetReturns = txns
        .filter((t) => t.descriptions.includes("Asset sale") && t.type === "CR")
        .reduce((sum, t) => sum + t.amount, 0);

      const netProfit = revenue + loanInterest + assetReturns - expenses;

      return {
        period: { startDate: start, endDate: end },
        revenue: {
          total: revenue,
          contributions: revenue,
          loanInterest,
          assetReturns,
          other: 0,
        },
        expenses: {
          total: expenses,
          withdrawals: expenses,
          loanDisbursements: 0,
          operational: 0,
        },
        netProfit,
        profitMargin: revenue > 0 ? (netProfit / revenue) * 100 : 0,
      };
    } catch (error) {
      throw new Error(`Failed to generate P&L report: ${error.message}`);
    }
  }

  // Balance Sheet Report
  static async generateBalanceSheetReport({ cooperativeId, asOfDate }) {
    try {
      const asOf = new Date(asOfDate || new Date());

      // Get all wallets
      const wallets = await WalletRepo.findAll({
        query: { cooperativeId },
        page: 1,
        limit: 1000,
      });

      // Normalize to a plain array
      const walletList = Array.isArray(wallets?.data)
        ? wallets.data
        : Array.isArray(wallets)
        ? wallets
        : [];

      // Calculate total assets
      const totalAssets = walletList.reduce((sum, wallet) => {
        return sum + (wallet.ledger_balance || 0);
      }, 0);

      // Get outstanding loans
      const outstandingLoans = await LoanRepo.findAll({
        query: {
          cooperativeId,
          status: { $in: ["approved", "active"] },
        },
        page: 1,
        limit: 1000,
      });

      // Normalize loans to a plain array
      const loanList = Array.isArray(outstandingLoans?.data)
        ? outstandingLoans.data
        : Array.isArray(outstandingLoans)
        ? outstandingLoans
        : [];

      const totalLiabilities = loanList.reduce((sum, loan) => {
        return sum + (loan.remainingBalance || loan.amount);
      }, 0);

      // Calculate member equity (assets - liabilities)
      const memberEquity = totalAssets - totalLiabilities;

      // Categorize assets by wallet type
      const assetsByType = {
        cash: walletList
          .filter((w) => w.walletType === "external")
          .reduce((sum, w) => sum + (w.ledger_balance || 0), 0),
        contributions: walletList
          .filter((w) => w.walletType === "contribution")
          .reduce((sum, w) => sum + (w.ledger_balance || 0), 0),
        assets: walletList
          .filter((w) => w.walletType === "asset")
          .reduce((sum, w) => sum + (w.ledger_balance || 0), 0),
        memberWallets: walletList
          .filter((w) => w.walletType === "member")
          .reduce((sum, w) => sum + (w.ledger_balance || 0), 0),
      };

      return {
        asOfDate: asOf,
        assets: {
          total: totalAssets,
          breakdown: assetsByType,
        },
        liabilities: {
          total: totalLiabilities,
          outstandingLoans: totalLiabilities,
        },
        equity: {
          total: memberEquity,
          memberEquity,
        },
        balanceSheet: {
          assets: totalAssets,
          liabilities: totalLiabilities,
          equity: memberEquity,
        },
      };
    } catch (error) {
      throw new Error(`Failed to generate balance sheet: ${error.message}`);
    }
  }

  // Cash Flow Report
  static async generateCashFlowReport({ cooperativeId, startDate, endDate }) {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);

      // Get all transactions in date range
      const transactions = await TransactionRepo.findAll({
        query: {
          cooperativeId,
          createdAt: { $gte: start, $lte: end },
          status: "success",
        },
        page: 1,
        limit: 10000,
      });

      // Normalize to a plain array
      const txns = Array.isArray(transactions?.data)
        ? transactions.data
        : Array.isArray(transactions)
        ? transactions
        : [];

      // Operating Activities
      const operatingActivities = {
        contributions: txns
          .filter(
            (t) => t.type === "CR" && t.descriptions.includes("Contribution")
          )
          .reduce((sum, t) => sum + t.amount, 0),
        withdrawals: txns
          .filter(
            (t) => t.type === "DR" && t.descriptions.includes("Withdrawal")
          )
          .reduce((sum, t) => sum + t.amount, 0),
        loanInterest: txns
          .filter(
            (t) => t.type === "CR" && t.descriptions.includes("Loan payment")
          )
          .reduce((sum, t) => sum + t.amount, 0),
      };

      // Investing Activities
      const investingActivities = {
        assetPurchases: txns
          .filter(
            (t) => t.type === "DR" && t.descriptions.includes("Asset purchase")
          )
          .reduce((sum, t) => sum + t.amount, 0),
        assetSales: txns
          .filter(
            (t) => t.type === "CR" && t.descriptions.includes("Asset sale")
          )
          .reduce((sum, t) => sum + t.amount, 0),
      };

      // Financing Activities
      const financingActivities = {
        loanDisbursements: txns
          .filter(
            (t) => t.type === "CR" && t.descriptions.includes("Loan approved")
          )
          .reduce((sum, t) => sum + t.amount, 0),
        loanRepayments: txns
          .filter(
            (t) => t.type === "DR" && t.descriptions.includes("Loan payment")
          )
          .reduce((sum, t) => sum + t.amount, 0),
      };

      const netOperatingCash =
        operatingActivities.contributions +
        operatingActivities.loanInterest -
        operatingActivities.withdrawals;
      const netInvestingCash =
        investingActivities.assetSales - investingActivities.assetPurchases;
      const netFinancingCash =
        financingActivities.loanRepayments -
        financingActivities.loanDisbursements;
      const netCashFlow =
        netOperatingCash + netInvestingCash + netFinancingCash;

      return {
        period: { startDate: start, endDate: end },
        operatingActivities: {
          ...operatingActivities,
          netCash: netOperatingCash,
        },
        investingActivities: {
          ...investingActivities,
          netCash: netInvestingCash,
        },
        financingActivities: {
          ...financingActivities,
          netCash: netFinancingCash,
        },
        netCashFlow,
        beginningCash: 0, // Would need to calculate from previous period
        endingCash: netCashFlow,
      };
    } catch (error) {
      throw new Error(`Failed to generate cash flow report: ${error.message}`);
    }
  }

  // ===== MEMBER PERFORMANCE REPORTS =====

  // Member Performance Report
  static async generateMemberPerformanceReport({
    cooperativeId,
    startDate,
    endDate,
    memberId,
  }) {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);

      let query = {
        cooperativeId,
        createdAt: { $gte: start, $lte: end },
        status: "success",
      };

      if (memberId) {
        query.member = memberId;
      }

      // Get member transactions
      const transactions = await TransactionRepo.findAll({
        query,
        page: 1,
        limit: 10000,
      });

      // Get member loans
      const loans = await LoanRepo.findAll({
        query: {
          cooperativeId,
          ...(memberId && { member: memberId }),
          createdAt: { $gte: start, $lte: end },
        },
        page: 1,
        limit: 1000,
      });

      // Get member assets
      const assets = await AssetUserRepo.findAll({
        query: {
          cooperativeId,
          ...(memberId && { member: memberId }),
        },
        page: 1,
        limit: 1000,
      });

      // Normalize to plain arrays
      const transactionList = Array.isArray(transactions?.data)
        ? transactions.data
        : Array.isArray(transactions)
        ? transactions
        : [];

      const loanList = Array.isArray(loans?.data)
        ? loans.data
        : Array.isArray(loans)
        ? loans
        : [];

      const assetList = Array.isArray(assets?.data)
        ? assets.data
        : Array.isArray(assets)
        ? assets
        : [];

      // Calculate performance metrics
      const totalContributions = transactionList
        .filter(
          (t) => t.type === "CR" && t.descriptions.includes("Contribution")
        )
        .reduce((sum, t) => sum + t.amount, 0);

      const totalWithdrawals = transactionList
        .filter((t) => t.type === "DR" && t.descriptions.includes("Withdrawal"))
        .reduce((sum, t) => sum + t.amount, 0);

      const totalAssetInvestment = assetList.reduce((sum, asset) => {
        return sum + (asset.totalInvestment || 0);
      }, 0);

      const activeLoans = loanList.filter((loan) => loan.status === "approved");
      const totalLoanAmount = activeLoans.reduce(
        (sum, loan) => sum + loan.amount,
        0
      );

      const netWorth =
        totalContributions - totalWithdrawals + totalAssetInvestment;

      return {
        period: { startDate: start, endDate: end },
        memberId,
        contributions: {
          total: totalContributions,
          count: transactionList.filter(
            (t) => t.type === "CR" && t.descriptions.includes("Contribution")
          ).length,
        },
        withdrawals: {
          total: totalWithdrawals,
          count: transactionList.filter(
            (t) => t.type === "DR" && t.descriptions.includes("Withdrawal")
          ).length,
        },
        assets: {
          totalInvestment: totalAssetInvestment,
          assetCount: assetList.length,
          currentValue: totalAssetInvestment, // Simplified - would need current market values
        },
        loans: {
          totalAmount: totalLoanAmount,
          activeLoans: activeLoans.length,
          totalRepaid: 0, // Would need to calculate from loan payments
        },
        performance: {
          netWorth,
          contributionGrowth: 0, // Would need historical data
          assetGrowth: 0,
          loanUtilization:
            totalLoanAmount > 0 ? (totalLoanAmount / netWorth) * 100 : 0,
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to generate member performance report: ${error.message}`
      );
    }
  }

  // ===== LOAN PORTFOLIO REPORTS =====

  // Loan Portfolio Report
  static async generateLoanPortfolioReport({
    cooperativeId,
    startDate,
    endDate,
  }) {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);

      // Get all loans
      const loans = await LoanRepo.findAll({
        query: {
          cooperativeId,
          createdAt: { $gte: start, $lte: end },
        },
        page: 1,
        limit: 1000,
      });

      // Normalize to a plain array
      const loanList = Array.isArray(loans?.data)
        ? loans.data
        : Array.isArray(loans)
        ? loans
        : [];

      // Calculate portfolio metrics
      const totalLoans = loanList.length;
      const totalAmount = loanList.reduce((sum, loan) => sum + loan.amount, 0);
      const totalOutstanding = loanList.reduce(
        (sum, loan) => sum + (loan.remainingBalance || loan.amount),
        0
      );

      // Status breakdown
      const statusBreakdown = {
        pending: loanList.filter((loan) => loan.status === "pending").length,
        approved: loanList.filter((loan) => loan.status === "approved").length,
        active: loanList.filter((loan) => loan.status === "active").length,
        completed: loanList.filter((loan) => loan.status === "completed")
          .length,
        defaulted: loanList.filter((loan) => loan.status === "defaulted")
          .length,
        rejected: loanList.filter((loan) => loan.status === "rejected").length,
      };

      // Amount breakdown by status
      const amountByStatus = {
        pending: loanList
          .filter((loan) => loan.status === "pending")
          .reduce((sum, loan) => sum + loan.amount, 0),
        approved: loanList
          .filter((loan) => loan.status === "approved")
          .reduce((sum, loan) => sum + loan.amount, 0),
        active: loanList
          .filter((loan) => loan.status === "active")
          .reduce((sum, loan) => sum + loan.amount, 0),
        completed: loanList
          .filter((loan) => loan.status === "completed")
          .reduce((sum, loan) => sum + loan.amount, 0),
        defaulted: loanList
          .filter((loan) => loan.status === "defaulted")
          .reduce((sum, loan) => sum + loan.amount, 0),
        rejected: loanList
          .filter((loan) => loan.status === "rejected")
          .reduce((sum, loan) => sum + loan.amount, 0),
      };

      // Risk metrics
      const defaultRate =
        totalLoans > 0 ? (statusBreakdown.defaulted / totalLoans) * 100 : 0;
      const averageLoanSize = totalLoans > 0 ? totalAmount / totalLoans : 0;

      return {
        period: { startDate: start, endDate: end },
        summary: {
          totalLoans,
          totalAmount,
          totalOutstanding,
          averageLoanSize,
          defaultRate,
        },
        statusBreakdown,
        amountByStatus,
        riskMetrics: {
          defaultRate,
          portfolioConcentration: 0, // Would need to calculate
          averageInterestRate: 0, // Would need to calculate
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to generate loan portfolio report: ${error.message}`
      );
    }
  }

  // ===== ASSET PERFORMANCE REPORTS =====

  // Asset Performance Report
  static async generateAssetPerformanceReport({
    cooperativeId,
    startDate,
    endDate,
  }) {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);

      // Get all assets
      const assets = await AssetsRepo.findAll({
        query: { cooperativeId },
        page: 1,
        limit: 1000,
      });

      // Get asset transactions
      const assetTransactions = await TransactionRepo.findAll({
        query: {
          cooperativeId,
          assetId: { $exists: true },
          createdAt: { $gte: start, $lte: end },
          status: "success",
        },
        page: 1,
        limit: 10000,
      });

      // Get asset user holdings
      const assetHoldings = await AssetUserRepo.findAll({
        query: { cooperativeId },
        page: 1,
        limit: 10000,
      });

      // Normalize to plain arrays
      const assetList = Array.isArray(assets?.data)
        ? assets.data
        : Array.isArray(assets)
        ? assets
        : [];

      const transactionList = Array.isArray(assetTransactions?.data)
        ? assetTransactions.data
        : Array.isArray(assetTransactions)
        ? assetTransactions
        : [];

      const holdingList = Array.isArray(assetHoldings?.data)
        ? assetHoldings.data
        : Array.isArray(assetHoldings)
        ? assetHoldings
        : [];

      // Calculate performance metrics
      const totalAssets = assetList.length;
      const totalInvestment = holdingList.reduce(
        (sum, holding) => sum + (holding.totalInvestment || 0),
        0
      );
      const totalUnits = holdingList.reduce(
        (sum, holding) => sum + (holding.totalUnits || 0),
        0
      );

      // Asset performance by asset
      const assetPerformance = assetList.map((asset) => {
        const assetHoldings = holdingList.filter(
          (h) => h.asset.toString() === asset._id.toString()
        );
        const assetTransactions = transactionList.filter(
          (t) => t.assetId.toString() === asset._id.toString()
        );

        const totalInvestment = assetHoldings.reduce(
          (sum, h) => sum + (h.totalInvestment || 0),
          0
        );
        const totalUnits = assetHoldings.reduce(
          (sum, h) => sum + (h.totalUnits || 0),
          0
        );
        const averagePrice = totalUnits > 0 ? totalInvestment / totalUnits : 0;

        return {
          assetId: asset._id,
          assetName: asset.name,
          totalInvestment,
          totalUnits,
          averagePrice,
          currentPrice: asset.settings?.pricePerUnit || 0,
          totalHolders: assetHoldings.length,
          transactionCount: assetTransactions.length,
        };
      });

      return {
        period: { startDate: start, endDate: end },
        summary: {
          totalAssets,
          totalInvestment,
          totalUnits,
          averageInvestmentPerAsset:
            totalAssets > 0 ? totalInvestment / totalAssets : 0,
        },
        assetPerformance,
        topPerformingAssets: assetPerformance
          .sort(
            (a, b) =>
              b.currentPrice -
              b.averagePrice -
              (a.currentPrice - a.averagePrice)
          )
          .slice(0, 5),
      };
    } catch (error) {
      throw new Error(
        `Failed to generate asset performance report: ${error.message}`
      );
    }
  }

  // ===== EXPORT FUNCTIONALITY =====

  // Export to CSV
  static async exportToCSV({ data, filename }) {
    try {
      const csv = this.convertToCSV(data);
      return {
        filename: `${filename}_${moment().format("YYYY-MM-DD_HH-mm-ss")}.csv`,
        data: csv,
        contentType: "text/csv",
      };
    } catch (error) {
      throw new Error(`Failed to export to CSV: ${error.message}`);
    }
  }

  // Convert data to CSV format
  static convertToCSV(data) {
    if (!Array.isArray(data) || data.length === 0) {
      return "";
    }

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(",")];

    for (const row of data) {
      const values = headers.map((header) => {
        const value = row[header];
        return typeof value === "string"
          ? `"${value.replace(/"/g, '""')}"`
          : value;
      });
      csvRows.push(values.join(","));
    }

    return csvRows.join("\n");
  }

  // ===== CUSTOM REPORT BUILDER =====

  // Build custom report
  static async buildCustomReport({ cooperativeId, reportConfig }) {
    try {
      const { metrics, filters, groupBy, dateRange } = reportConfig;
      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);

      let query = {
        cooperativeId,
        createdAt: { $gte: startDate, $lte: endDate },
      };

      // Apply filters
      if (filters) {
        Object.assign(query, filters);
      }

      // Get data based on metrics
      let reportData = [];

      if (metrics.includes("transactions")) {
        const transactions = await TransactionRepo.findAll({
          query,
          page: 1,
          limit: 10000,
        });
        reportData = transactions.data;
      }

      if (metrics.includes("loans")) {
        const loans = await LoanRepo.findAll({
          query,
          page: 1,
          limit: 1000,
        });
        reportData = [...reportData, ...loans.data];
      }

      if (metrics.includes("assets")) {
        const assets = await AssetUserRepo.findAll({
          query,
          page: 1,
          limit: 1000,
        });
        reportData = [...reportData, ...assets.data];
      }

      // Group data if specified
      if (groupBy) {
        reportData = this.groupData(reportData, groupBy);
      }

      return {
        config: reportConfig,
        data: reportData,
        summary: {
          totalRecords: reportData.length,
          dateRange: { startDate, endDate },
        },
      };
    } catch (error) {
      throw new Error(`Failed to build custom report: ${error.message}`);
    }
  }

  // Group data by specified field
  static groupData(data, groupBy) {
    const grouped = {};

    data.forEach((item) => {
      const key = item[groupBy];
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(item);
    });

    return Object.entries(grouped).map(([key, items]) => ({
      [groupBy]: key,
      count: items.length,
      items,
    }));
  }

  // ===== SCHEDULED REPORT DELIVERY =====

  // Create scheduled report
  static async createScheduledReport({ cooperativeId, createdBy, reportData }) {
    try {
      const scheduledReport = await ScheduledReportRepo.create({
        cooperativeId,
        createdBy,
        ...reportData,
      });

      return {
        success: true,
        message: "Scheduled report created successfully",
        scheduledReport,
      };
    } catch (error) {
      throw new Error(`Failed to create scheduled report: ${error.message}`);
    }
  }

  // Get scheduled reports for cooperative
  static async getScheduledReports({ cooperativeId }) {
    try {
      const reports = await ScheduledReportRepo.getReportsByCooperative(
        cooperativeId
      );
      return reports;
    } catch (error) {
      throw new Error(`Failed to get scheduled reports: ${error.message}`);
    }
  }

  // Update scheduled report
  static async updateScheduledReport({ reportId, updateData }) {
    try {
      const report = await ScheduledReportRepo.update(reportId, updateData);
      return {
        success: true,
        message: "Scheduled report updated successfully",
        report,
      };
    } catch (error) {
      throw new Error(`Failed to update scheduled report: ${error.message}`);
    }
  }

  // Delete scheduled report
  static async deleteScheduledReport({ reportId }) {
    try {
      await ScheduledReportRepo.delete(reportId);
      return {
        success: true,
        message: "Scheduled report deleted successfully",
      };
    } catch (error) {
      throw new Error(`Failed to delete scheduled report: ${error.message}`);
    }
  }

  // Process scheduled reports (called by cron job)
  static async processScheduledReports() {
    try {
      const reportsDue = await ScheduledReportRepo.getReportsDueForDelivery();

      for (const report of reportsDue) {
        try {
          await this.deliverScheduledReport(report);
        } catch (error) {
          console.error(
            `Failed to deliver report ${report._id}:`,
            error.message
          );
          // Mark as failed
          await report.markDelivered({
            status: "failed",
            errorMessage: error.message,
            recipients: report.recipients.map((r) => r.email),
          });
        }
      }

      return {
        success: true,
        processed: reportsDue.length,
      };
    } catch (error) {
      throw new Error(`Failed to process scheduled reports: ${error.message}`);
    }
  }

  // Deliver a scheduled report
  static async deliverScheduledReport(scheduledReport) {
    try {
      // Generate the report based on type
      let reportData;
      const endDate = new Date();
      const startDate = this.calculateStartDate(
        scheduledReport.schedule.frequency
      );

      switch (scheduledReport.reportType) {
        case "profit_loss":
          reportData = await this.generateProfitLossReport({
            cooperativeId: scheduledReport.cooperativeId,
            startDate,
            endDate,
          });
          break;
        case "balance_sheet":
          reportData = await this.generateBalanceSheetReport({
            cooperativeId: scheduledReport.cooperativeId,
            asOfDate: endDate,
          });
          break;
        case "cash_flow":
          reportData = await this.generateCashFlowReport({
            cooperativeId: scheduledReport.cooperativeId,
            startDate,
            endDate,
          });
          break;
        case "member_performance":
          reportData = await this.generateMemberPerformanceReport({
            cooperativeId: scheduledReport.cooperativeId,
            startDate,
            endDate,
          });
          break;
        case "loan_portfolio":
          reportData = await this.generateLoanPortfolioReport({
            cooperativeId: scheduledReport.cooperativeId,
            startDate,
            endDate,
          });
          break;
        case "asset_performance":
          reportData = await this.generateAssetPerformanceReport({
            cooperativeId: scheduledReport.cooperativeId,
            startDate,
            endDate,
          });
          break;
        case "custom":
          reportData = await this.buildCustomReport({
            cooperativeId: scheduledReport.cooperativeId,
            reportConfig: scheduledReport.reportConfig,
          });
          break;
        default:
          throw new Error(`Unknown report type: ${scheduledReport.reportType}`);
      }

      // Export report if needed
      let attachment = null;
      if (scheduledReport.exportFormat === "csv") {
        const csvExport = await this.exportToCSV({
          data: [reportData],
          filename: scheduledReport.name.toLowerCase().replace(/\s+/g, "_"),
        });
        attachment = {
          filename: csvExport.filename,
          content: csvExport.data,
          contentType: csvExport.contentType,
        };
      }

      // Send email to recipients
      const emailPromises = scheduledReport.recipients.map((recipient) => {
        return sendEmail({
          to: recipient.email,
          subject: `Scheduled Report: ${scheduledReport.name}`,
          template: "scheduled_report",
          context: {
            recipientName: recipient.name || recipient.email,
            reportName: scheduledReport.name,
            reportDescription: scheduledReport.description,
            reportData: reportData,
            generatedAt: new Date().toISOString(),
            nextDelivery: scheduledReport.nextRun,
          },
          attachment,
        });
      });

      await Promise.all(emailPromises);

      // Mark as delivered
      await scheduledReport.markDelivered({
        status: "success",
        recipients: scheduledReport.recipients.map((r) => r.email),
        reportData: reportData,
      });

      return {
        success: true,
        deliveredTo: scheduledReport.recipients.length,
      };
    } catch (error) {
      throw new Error(`Failed to deliver scheduled report: ${error.message}`);
    }
  }

  // Calculate start date based on frequency
  static calculateStartDate(frequency) {
    const endDate = new Date();

    switch (frequency) {
      case "daily":
        return new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
      case "weekly":
        return new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      case "monthly":
        return new Date(
          endDate.getFullYear(),
          endDate.getMonth() - 1,
          endDate.getDate()
        );
      case "quarterly":
        return new Date(
          endDate.getFullYear(),
          endDate.getMonth() - 3,
          endDate.getDate()
        );
      case "yearly":
        return new Date(
          endDate.getFullYear() - 1,
          endDate.getMonth(),
          endDate.getDate()
        );
      default:
        return new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days
    }
  }
}

module.exports = ReportingService;
