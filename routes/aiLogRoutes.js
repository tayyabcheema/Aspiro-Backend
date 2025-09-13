const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const requireAdmin = require('../middleware/requireAdmin');
const AiLog = require('../models/AiLog');
const createError = require('../utils/error');

// Get AI logs for admin review
router.get('/logs', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const logs = await AiLog.find()
      .populate('userId', 'fullName email')
      .populate('questionId', 'text step category')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await AiLog.countDocuments();

    return res.status(200).json({
      success: true,
      data: {
        logs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching AI logs:', error);
    return next(createError(500, 'Failed to fetch AI logs'));
  }
});

// Update AI log review status
router.patch('/logs/:id/review', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const { reviewed, adminNotes } = req.body;
    const adminId = req.user.id || req.user._id;

    const log = await AiLog.findByIdAndUpdate(
      req.params.id,
      {
        reviewed: reviewed || false,
        reviewedBy: adminId,
        reviewedAt: new Date(),
        adminNotes: adminNotes || ''
      },
      { new: true }
    ).populate('userId', 'fullName email')
     .populate('questionId', 'text step category');

    if (!log) {
      return next(createError(404, 'AI log not found'));
    }

    return res.status(200).json({
      success: true,
      data: log
    });

  } catch (error) {
    console.error('Error updating AI log:', error);
    return next(createError(500, 'Failed to update AI log'));
  }
});

// Get AI logs statistics
router.get('/stats', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const totalLogs = await AiLog.countDocuments();
    const reviewedLogs = await AiLog.countDocuments({ reviewed: true });
    const unreviewedLogs = await AiLog.countDocuments({ reviewed: false });
    
    // Get logs by date (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentLogs = await AiLog.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    return res.status(200).json({
      success: true,
      data: {
        totalLogs,
        reviewedLogs,
        unreviewedLogs,
        recentLogs,
        reviewRate: totalLogs > 0 ? Math.round((reviewedLogs / totalLogs) * 100) : 0
      }
    });

  } catch (error) {
    console.error('Error fetching AI logs stats:', error);
    return next(createError(500, 'Failed to fetch AI logs statistics'));
  }
});

module.exports = router;
