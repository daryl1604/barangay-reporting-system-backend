const express = require("express");
const router = express.Router();
const { createAnnouncement, getAnnouncements } = require("../controllers/announcementController");
const { protect, authorize } = require("../middleware/authMiddleware");

router.get("/", protect, authorize("admin"), getAnnouncements);
router.post("/", protect, authorize("admin"), createAnnouncement);

module.exports = router;
