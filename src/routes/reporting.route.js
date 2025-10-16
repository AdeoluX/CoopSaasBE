const express = require("express");
const ReportingController = require("../controller/reporting.controller");
const { verify } = require("../middleware/verifyToken");

const router = express.Router();

// ===== FINANCIAL REPORTS =====

// Profit & Loss Report
router.get(
  "/financial/profit-loss",
  verify("*"),
  ReportingController.generateProfitLossReport
);

router.get(
  "/financial/profit-loss/export",
  verify("*"),
  ReportingController.exportProfitLossCSV
);

// Balance Sheet Report
router.get(
  "/financial/balance-sheet",
  verify("*"),
  ReportingController.generateBalanceSheetReport
);

router.get(
  "/financial/balance-sheet/export",
  verify("*"),
  ReportingController.exportBalanceSheetCSV
);

// Cash Flow Report
router.get(
  "/financial/cash-flow",
  verify("*"),
  ReportingController.generateCashFlowReport
);

// ===== MEMBER PERFORMANCE REPORTS =====

// Member Performance Report
router.get(
  "/members/performance",
  verify("*"),
  ReportingController.generateMemberPerformanceReport
);

router.get(
  "/members/performance/export",
  verify("*"),
  ReportingController.exportMemberPerformanceCSV
);

// ===== LOAN PORTFOLIO REPORTS =====

// Loan Portfolio Report
router.get(
  "/loans/portfolio",
  verify("*"),
  ReportingController.generateLoanPortfolioReport
);

router.get(
  "/loans/portfolio/export",
  verify("*"),
  ReportingController.exportLoanPortfolioCSV
);

// ===== ASSET PERFORMANCE REPORTS =====

// Asset Performance Report
router.get(
  "/assets/performance",
  verify("*"),
  ReportingController.generateAssetPerformanceReport
);

router.get(
  "/assets/performance/export",
  verify("*"),
  ReportingController.exportAssetPerformanceCSV
);

// ===== CUSTOM REPORT BUILDER =====

// Build Custom Report
router.post(
  "/custom/build",
  verify("*"),
  ReportingController.buildCustomReport
);

// Export Custom Report
router.post(
  "/custom/export",
  verify("*"),
  ReportingController.exportCustomReportCSV
);

// ===== DASHBOARD REPORTS =====

// Dashboard Summary
router.get(
  "/dashboard/summary",
  verify("*"),
  ReportingController.getDashboardSummary
);

// ===== SCHEDULED REPORTS =====

// Create scheduled report
router.post(
  "/scheduled",
  verify("*"),
  ReportingController.createScheduledReport
);

// Get scheduled reports
router.get("/scheduled", verify("*"), ReportingController.getScheduledReports);

// Update scheduled report
router.put(
  "/scheduled/:id",
  verify("*"),
  ReportingController.updateScheduledReport
);

// Delete scheduled report
router.delete(
  "/scheduled/:id",
  verify("*"),
  ReportingController.deleteScheduledReport
);

// Get scheduled report statistics
router.get(
  "/scheduled/stats",
  verify("*"),
  ReportingController.getScheduledReportStats
);

module.exports = router;
