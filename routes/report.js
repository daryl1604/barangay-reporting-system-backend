const express = require("express");
const router = express.Router();
const {
  createReport,
  getMyReports,
  getAllReports,
  updateStatus,
  deleteReport,
  addComment,
  updateComment,
  deleteComment,
  getPurokAnalytics,
  getDashboardSummary,
  getResidentReportSummary,
  getAnalyticsPeriodSummary,
  getAnalyticsTrends,
  getYearlyAnalytics
} = require("../controllers/reportController");

const { protect, authorize } = require("../middleware/authMiddleware");

// Resident Routes
router.post("/", protect, authorize("resident"), createReport);
router.get("/my", protect, authorize("resident"), getMyReports);

// Admin Routes
router.get("/all", protect, authorize("admin"), getAllReports);
router.put("/:id", protect, authorize("admin"), updateStatus);
router.delete("/:id", protect, authorize("admin"), deleteReport);

router.post("/:id/comment", protect, addComment);
router.put("/:id/comment/:commentId", protect, authorize("admin"), updateComment);
router.delete("/:id/comment/:commentId", protect, authorize("admin"), deleteComment);

router.get("/analytics/purok", protect, authorize("admin"), getPurokAnalytics);

router.get("/analytics/summary", protect, authorize("admin"), getDashboardSummary);
router.get("/resident/:residentId/summary", protect, authorize("admin"), getResidentReportSummary);
router.get("/analytics/period-summary", protect, authorize("admin"), getAnalyticsPeriodSummary);
router.get("/analytics/trends", protect, authorize("admin"), getAnalyticsTrends);
router.get("/analytics/yearly", protect, authorize("admin"), getYearlyAnalytics);

module.exports = router;
