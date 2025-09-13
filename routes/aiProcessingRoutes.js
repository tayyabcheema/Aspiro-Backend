const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/requireAdmin");
const {
  getAIProcessingStatistics,
  getUserAIProcessingLog,
  getAIProcessingLogDetails,
  updateUserInteraction,
  getAIPerformanceMetrics
} = require("../controller/aiProcessingController");

// Protect all routes with authentication and admin access
router.use(verifyToken);
router.use(requireAdmin);

// Get AI processing statistics for admin dashboard
router.get("/statistics", getAIProcessingStatistics);

// Get AI performance metrics with trends
router.get("/performance", getAIPerformanceMetrics);

// Get detailed AI processing log by log ID
router.get("/log/:logId", getAIProcessingLogDetails);

// Get AI processing history for a specific user
router.get("/user/:targetUserId", getUserAIProcessingLog);

// Update user interaction statistics
router.post("/log/:logId/interaction", updateUserInteraction);

module.exports = router;
