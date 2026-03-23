const express = require("express");
const router = express.Router();
const { createReportSummary, getReportSummaries } = require("../controllers/reportSummaryController");
const { protect, authorize } = require("../middleware/authMiddleware");

router.get("/", protect, authorize("admin"), getReportSummaries);
router.post("/", protect, authorize("admin"), createReportSummary);

module.exports = router;
