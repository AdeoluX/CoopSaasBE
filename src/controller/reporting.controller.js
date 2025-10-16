const catchAsync = require("../utils/catchAsync");
const { successResponse } = require("../utils/responder");
const ReportingService = require("../services/reporting.service");
const AdminService = require("../services/admin.service");

class ReportingController {
  // ===== FINANCIAL REPORTS =====

  // Profit & Loss Report
  static generateProfitLossReport = catchAsync(async (req, res) => {
    const { startDate, endDate } = req.query;
    const report = await ReportingService.generateProfitLossReport({
      cooperativeId: req.auth.cooperativeId,
      startDate: startDate || new Date(new Date().getFullYear(), 0, 1), // Start of year
      endDate: endDate || new Date(),
    });
    return successResponse(res, report);
  });

  // Balance Sheet Report
  static generateBalanceSheetReport = catchAsync(async (req, res) => {
    const { asOfDate } = req.query;
    const report = await ReportingService.generateBalanceSheetReport({
      cooperativeId: req.auth.cooperativeId,
      asOfDate: asOfDate || new Date(),
    });
    return successResponse(res, report);
  });

  // Cash Flow Report
  static generateCashFlowReport = catchAsync(async (req, res) => {
    const { startDate, endDate } = req.query;
    const report = await ReportingService.generateCashFlowReport({
      cooperativeId: req.auth.cooperativeId,
      startDate: startDate || new Date(new Date().getFullYear(), 0, 1),
      endDate: endDate || new Date(),
    });
    return successResponse(res, report);
  });

  // ===== MEMBER PERFORMANCE REPORTS =====

  // Member Performance Report
  static generateMemberPerformanceReport = catchAsync(async (req, res) => {
    const { startDate, endDate, memberId } = req.query;
    const report = await ReportingService.generateMemberPerformanceReport({
      cooperativeId: req.auth.cooperativeId,
      startDate: startDate || new Date(new Date().getFullYear(), 0, 1),
      endDate: endDate || new Date(),
      memberId,
    });
    return successResponse(res, report);
  });

  // ===== LOAN PORTFOLIO REPORTS =====

  // Loan Portfolio Report
  static generateLoanPortfolioReport = catchAsync(async (req, res) => {
    const { startDate, endDate } = req.query;
    const report = await ReportingService.generateLoanPortfolioReport({
      cooperativeId: req.auth.cooperativeId,
      startDate: startDate || new Date(new Date().getFullYear(), 0, 1),
      endDate: endDate || new Date(),
    });
    return successResponse(res, report);
  });

  // ===== ASSET PERFORMANCE REPORTS =====

  // Asset Performance Report
  static generateAssetPerformanceReport = catchAsync(async (req, res) => {
    const { startDate, endDate } = req.query;
    const report = await ReportingService.generateAssetPerformanceReport({
      cooperativeId: req.auth.cooperativeId,
      startDate: startDate || new Date(new Date().getFullYear(), 0, 1),
      endDate: endDate || new Date(),
    });
    return successResponse(res, report);
  });

  // ===== EXPORT FUNCTIONALITY =====

  // Export P&L Report to CSV
  static exportProfitLossCSV = catchAsync(async (req, res) => {
    const { startDate, endDate } = req.query;
    const report = await ReportingService.generateProfitLossReport({
      cooperativeId: req.auth.cooperativeId,
      startDate: startDate || new Date(new Date().getFullYear(), 0, 1),
      endDate: endDate || new Date(),
    });

    // Flatten the report data for CSV export
    const flattenedData = [
      {
        "Start Date": report.period.startDate.toISOString().split("T")[0],
        "End Date": report.period.endDate.toISOString().split("T")[0],
        "Total Revenue": report.revenue.total,
        Contributions: report.revenue.contributions,
        "Loan Interest": report.revenue.loanInterest,
        "Asset Returns": report.revenue.assetReturns,
        "Other Revenue": report.revenue.other,
        "Total Expenses": report.expenses.total,
        Withdrawals: report.expenses.withdrawals,
        "Loan Disbursements": report.expenses.loanDisbursements,
        "Operational Expenses": report.expenses.operational,
        "Net Profit": report.netProfit,
        "Profit Margin (%)": report.profitMargin.toFixed(2),
      },
    ];

    const csvExport = await ReportingService.exportToCSV({
      data: flattenedData,
      filename: "profit_loss_report",
    });

    res.setHeader("Content-Type", csvExport.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${csvExport.filename}"`
    );
    return res.send(csvExport.data);
  });

  // Export Balance Sheet to CSV
  static exportBalanceSheetCSV = catchAsync(async (req, res) => {
    const { asOfDate } = req.query;
    const report = await ReportingService.generateBalanceSheetReport({
      cooperativeId: req.auth.cooperativeId,
      asOfDate: asOfDate || new Date(),
    });

    // Flatten the balance sheet data for CSV export
    const flattenedData = [
      {
        "As Of Date": report.asOfDate.toISOString().split("T")[0],
        "Total Assets": report.assets.total,
        Cash: report.assets.breakdown.cash,
        Contributions: report.assets.breakdown.contributions,
        Assets: report.assets.breakdown.assets,
        "Member Wallets": report.assets.breakdown.memberWallets,
        "Total Liabilities": report.liabilities.total,
        "Outstanding Loans": report.liabilities.outstandingLoans,
        "Total Equity": report.equity.total,
        "Member Equity": report.equity.memberEquity,
      },
    ];

    const csvExport = await ReportingService.exportToCSV({
      data: flattenedData,
      filename: "balance_sheet_report",
    });

    res.setHeader("Content-Type", csvExport.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${csvExport.filename}"`
    );
    return res.send(csvExport.data);
  });

  // Export Member Performance to CSV
  static exportMemberPerformanceCSV = catchAsync(async (req, res) => {
    const { startDate, endDate, memberId } = req.query;
    const report = await ReportingService.generateMemberPerformanceReport({
      cooperativeId: req.auth.cooperativeId,
      startDate: startDate || new Date(new Date().getFullYear(), 0, 1),
      endDate: endDate || new Date(),
      memberId,
    });

    const csvExport = await ReportingService.exportToCSV({
      data: [report],
      filename: "member_performance_report",
    });

    res.setHeader("Content-Type", csvExport.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${csvExport.filename}"`
    );
    return res.send(csvExport.data);
  });

  // Export Loan Portfolio to CSV
  static exportLoanPortfolioCSV = catchAsync(async (req, res) => {
    const { startDate, endDate } = req.query;
    const report = await ReportingService.generateLoanPortfolioReport({
      cooperativeId: req.auth.cooperativeId,
      startDate: startDate || new Date(new Date().getFullYear(), 0, 1),
      endDate: endDate || new Date(),
    });

    // Flatten the loan portfolio data for CSV export
    const flattenedData = [
      {
        "Start Date": report.period.startDate.toISOString().split("T")[0],
        "End Date": report.period.endDate.toISOString().split("T")[0],
        "Total Loans": report.summary.totalLoans,
        "Total Amount": report.summary.totalAmount,
        "Total Outstanding": report.summary.totalOutstanding,
        "Average Loan Size": report.summary.averageLoanSize.toFixed(2),
        "Default Rate (%)": report.summary.defaultRate.toFixed(2),
        "Pending Loans": report.statusBreakdown.pending,
        "Approved Loans": report.statusBreakdown.approved,
        "Active Loans": report.statusBreakdown.active,
        "Completed Loans": report.statusBreakdown.completed,
        "Defaulted Loans": report.statusBreakdown.defaulted,
        "Rejected Loans": report.statusBreakdown.rejected,
        "Pending Amount": report.amountByStatus.pending,
        "Approved Amount": report.amountByStatus.approved,
        "Active Amount": report.amountByStatus.active,
        "Completed Amount": report.amountByStatus.completed,
        "Defaulted Amount": report.amountByStatus.defaulted,
        "Rejected Amount": report.amountByStatus.rejected,
      },
    ];

    const csvExport = await ReportingService.exportToCSV({
      data: flattenedData,
      filename: "loan_portfolio_report",
    });

    res.setHeader("Content-Type", csvExport.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${csvExport.filename}"`
    );
    return res.send(csvExport.data);
  });

  // Export Asset Performance to CSV
  static exportAssetPerformanceCSV = catchAsync(async (req, res) => {
    const { startDate, endDate } = req.query;
    const report = await ReportingService.generateAssetPerformanceReport({
      cooperativeId: req.auth.cooperativeId,
      startDate: startDate || new Date(new Date().getFullYear(), 0, 1),
      endDate: endDate || new Date(),
    });

    // Create summary row first
    const summaryRow = {
      "Asset Name": "SUMMARY",
      "Start Date": report.period.startDate.toISOString().split("T")[0],
      "End Date": report.period.endDate.toISOString().split("T")[0],
      "Total Investment": report.summary.totalInvestment,
      "Total Units": report.summary.totalUnits,
      "Average Price": report.summary.averageInvestmentPerAsset.toFixed(2),
      "Current Price": "",
      "Total Holders": "",
      "Transaction Count": "",
    };

    // Flatten individual asset performance data
    const assetRows = report.assetPerformance.map((asset) => ({
      "Asset Name": asset.assetName,
      "Start Date": "",
      "End Date": "",
      "Total Investment": asset.totalInvestment,
      "Total Units": asset.totalUnits,
      "Average Price": asset.averagePrice.toFixed(2),
      "Current Price": asset.currentPrice,
      "Total Holders": asset.totalHolders,
      "Transaction Count": asset.transactionCount,
    }));

    // Combine summary and asset data
    const flattenedData = [summaryRow, ...assetRows];

    const csvExport = await ReportingService.exportToCSV({
      data: flattenedData,
      filename: "asset_performance_report",
    });

    res.setHeader("Content-Type", csvExport.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${csvExport.filename}"`
    );
    return res.send(csvExport.data);
  });

  // ===== CUSTOM REPORT BUILDER =====

  // Build Custom Report
  static buildCustomReport = catchAsync(async (req, res) => {
    const { reportConfig } = req.body;
    const report = await ReportingService.buildCustomReport({
      cooperativeId: req.auth.cooperativeId,
      reportConfig,
    });
    return successResponse(res, report);
  });

  // Export Custom Report to CSV
  static exportCustomReportCSV = catchAsync(async (req, res) => {
    const { reportConfig, filename } = req.body;
    const report = await ReportingService.buildCustomReport({
      cooperativeId: req.auth.cooperativeId,
      reportConfig,
    });

    const csvExport = await ReportingService.exportToCSV({
      data: report.data,
      filename: filename || "custom_report",
    });

    res.setHeader("Content-Type", csvExport.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${csvExport.filename}"`
    );
    return res.send(csvExport.data);
  });

  // ===== DASHBOARD REPORTS =====

  // Get Dashboard Summary
  static getDashboardSummary = catchAsync(async (req, res) => {
    const { dateRange = "30d" } = req.query;

    // Calculate date range
    const endDate = new Date();
    let startDate;

    switch (dateRange) {
      case "7d":
        startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "1y":
        startDate = new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Generate all reports for dashboard
    const [
      plReport,
      balanceSheet,
      cashFlow,
      loanPortfolio,
      assetPerformance,
      coopStats,
    ] = await Promise.all([
      ReportingService.generateProfitLossReport({
        cooperativeId: req.auth.cooperativeId,
        startDate,
        endDate,
      }),
      ReportingService.generateBalanceSheetReport({
        cooperativeId: req.auth.cooperativeId,
        asOfDate: endDate,
      }),
      ReportingService.generateCashFlowReport({
        cooperativeId: req.auth.cooperativeId,
        startDate,
        endDate,
      }),
      ReportingService.generateLoanPortfolioReport({
        cooperativeId: req.auth.cooperativeId,
        startDate,
        endDate,
      }),
      ReportingService.generateAssetPerformanceReport({
        cooperativeId: req.auth.cooperativeId,
        startDate,
        endDate,
      }),
      AdminService.getCooperativeStats({
        cooperativeId: req.auth.cooperativeId,
      }),
    ]);

    const dashboardSummary = {
      dateRange: { startDate, endDate },
      // High-level KPIs expected by dashboard
      memberCount: coopStats?.memberCount || 0,
      walletBalance:
        coopStats?.totalWalletBalance ?? balanceSheet?.assets?.total ?? 0,
      loansOutstanding: loanPortfolio?.summary?.totalOutstanding || 0,
      assetValue:
        assetPerformance?.summary?.totalInvestment ??
        coopStats?.totalInvestmentVolume ??
        0,
      financial: {
        netProfit: plReport.netProfit,
        totalAssets: balanceSheet.assets.total,
        totalLiabilities: balanceSheet.liabilities.total,
        memberEquity: balanceSheet.equity.total,
        netCashFlow: cashFlow.netCashFlow,
      },
      loans: {
        totalLoans: loanPortfolio.summary.totalLoans,
        totalOutstanding: loanPortfolio.summary.totalOutstanding,
        defaultRate: loanPortfolio.summary.defaultRate,
        averageLoanSize: loanPortfolio.summary.averageLoanSize,
      },
      assets: {
        totalAssets: assetPerformance.summary.totalAssets,
        totalInvestment: assetPerformance.summary.totalInvestment,
        totalUnits: assetPerformance.summary.totalUnits,
        topPerformingAssets: assetPerformance.topPerformingAssets,
      },
      performance: {
        profitMargin: plReport.profitMargin,
        assetUtilization:
          balanceSheet.assets.total > 0
            ? (loanPortfolio.summary.totalOutstanding /
                balanceSheet.assets.total) *
              100
            : 0,
        memberGrowth: 0, // Would need to calculate from member data
        transactionVolume: 0, // Would need to calculate from transaction data
      },
    };

    return successResponse(res, dashboardSummary);
  });

  // ===== SCHEDULED REPORTS =====

  // Create scheduled report
  static createScheduledReport = catchAsync(async (req, res) => {
    const result = await ReportingService.createScheduledReport({
      cooperativeId: req.auth.cooperativeId,
      createdBy: req.auth.id,
      reportData: req.body,
    });
    return successResponse(res, result);
  });

  // Get scheduled reports
  static getScheduledReports = catchAsync(async (req, res) => {
    const reports = await ReportingService.getScheduledReports({
      cooperativeId: req.auth.cooperativeId,
    });
    return successResponse(res, reports);
  });

  // Update scheduled report
  static updateScheduledReport = catchAsync(async (req, res) => {
    const result = await ReportingService.updateScheduledReport({
      reportId: req.params.id,
      updateData: req.body,
    });
    return successResponse(res, result);
  });

  // Delete scheduled report
  static deleteScheduledReport = catchAsync(async (req, res) => {
    const result = await ReportingService.deleteScheduledReport({
      reportId: req.params.id,
    });
    return successResponse(res, result);
  });

  // Get scheduled report statistics
  static getScheduledReportStats = catchAsync(async (req, res) => {
    const stats = await ScheduledReportRepo.getReportStats(
      req.auth.cooperativeId
    );
    return successResponse(res, stats);
  });
}

module.exports = ReportingController;
