const express = require("express");
const router = express.Router();
const { register, login, getResidents, getResidentById, deleteResident } = require("../controllers/authController");
const { protect, authorize } = require("../middleware/authMiddleware");

router.post("/register", register);
router.post("/login", login);
router.get("/admin/residents", protect, authorize("admin"), getResidents);
router.get("/admin/residents/:id", protect, authorize("admin"), getResidentById);
router.delete("/admin/residents/:id", protect, authorize("admin"), deleteResident);
router.get("/residents", protect, authorize("admin"), getResidents);
router.get("/residents/:id", protect, authorize("admin"), getResidentById);
router.delete("/residents/:id", protect, authorize("admin"), deleteResident);

module.exports = router;
