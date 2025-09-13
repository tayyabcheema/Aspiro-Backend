const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const {
  generateUserRoadmap,
  getUserRoadmap,
  updateRoadmapProgress,
  deleteUserRoadmap,
  regenerateUserRoadmap
} = require("../controller/roadmapController");

// Protect all routes with authentication
router.use(verifyToken);

// POST /api/roadmap/generate - Generate a new roadmap for the user
router.post("/generate", generateUserRoadmap);

// GET /api/roadmap - Get user's current roadmap
router.get("/", getUserRoadmap);

// PUT /api/roadmap/progress - Update roadmap progress
router.put("/progress", updateRoadmapProgress);

// DELETE /api/roadmap - Delete user's roadmap
router.delete("/", deleteUserRoadmap);

// POST /api/roadmap/regenerate - Regenerate user's roadmap
router.post("/regenerate", regenerateUserRoadmap);

module.exports = router;
