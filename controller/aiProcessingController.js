const createError = require("../utils/error");
const User = require("../models/User");
const AIProcessingLog = require("../models/AIProcessingLog");

/**
 * Get AI processing statistics for admin dashboard
 */
const getAIProcessingStatistics = async (req, res, next) => {
  try {
    // Validate admin access
    const userId = req.user.id || req.user._id;
    const user = await User.findById(userId);
    if (!user || user.role !== "admin") {
      return next(createError(403, "Only admin users can access AI processing statistics"));
    }

    const { days = 30 } = req.query;
    const dateRange = parseInt(days);

    // Get processing statistics
    const statistics = await AIProcessingLog.getProcessingStatistics(dateRange);
    
    // Get recent processing logs
    const recentLogs = await AIProcessingLog.find({ status: "completed" })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('user', 'name email')
      .select('-documents.structuredData -questionMappings.aiSuggestions.suggestions');

    // Get error logs
    const errorLogs = await AIProcessingLog.find({ status: "failed" })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('user', 'name email')
      .select('user error createdAt statistics');

    // Get document type distribution
    const documentTypeStats = await AIProcessingLog.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - dateRange * 24 * 60 * 60 * 1000) },
          status: "completed"
        }
      },
      { $unwind: "$documents" },
      {
        $group: {
          _id: "$documents.documentType",
          count: { $sum: 1 },
          avgTextLength: { $avg: "$documents.textLength" },
          successRate: {
            $avg: { $cond: ["$documents.parsingSuccess", 1, 0] }
          }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get question type performance
    const questionTypeStats = await AIProcessingLog.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - dateRange * 24 * 60 * 60 * 1000) },
          status: "completed"
        }
      },
      { $unwind: "$questionMappings.autoFill" },
      {
        $group: {
          _id: "$questionMappings.autoFill.questionType",
          totalQuestions: { $sum: 1 },
          avgConfidence: { $avg: "$questionMappings.autoFill.confidence" },
          successRate: {
            $avg: { $cond: ["$questionMappings.autoFill.hasAnswer", 1, 0] }
          }
        }
      },
      { $sort: { totalQuestions: -1 } }
    ]);

    const result = {
      success: true,
      data: {
        overview: statistics[0] || {
          totalProcessings: 0,
          avgAutoFillSuccessRate: 0,
          avgAiSuggestionSuccessRate: 0,
          avgProcessingTime: 0,
          totalDocumentsProcessed: 0,
          totalQuestionsProcessed: 0,
          avgPreFillAccepted: 0,
          avgAiSuggestionsAccepted: 0
        },
        recentLogs,
        errorLogs,
        documentTypeStats,
        questionTypeStats,
        dateRange
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        requestedBy: userId
      }
    };

    return res.status(200).json(result);

  } catch (error) {
    console.error("Error fetching AI processing statistics:", error);
    return next(createError(500, "Internal server error"));
  }
};

/**
 * Get detailed AI processing log for a specific user
 */
const getUserAIProcessingLog = async (req, res, next) => {
  try {
    // Validate admin access
    const userId = req.user.id || req.user._id;
    const user = await User.findById(userId);
    if (!user || user.role !== "admin") {
      return next(createError(403, "Only admin users can access AI processing logs"));
    }

    const { targetUserId } = req.params;
    const { limit = 10 } = req.query;

    // Get user's processing history
    const processingHistory = await AIProcessingLog.getUserProcessingHistory(targetUserId, parseInt(limit));

    // Get user information
    const targetUser = await User.findById(targetUserId).select('name email role createdAt');

    if (!targetUser) {
      return next(createError(404, "User not found"));
    }

    return res.status(200).json({
      success: true,
      data: {
        user: targetUser,
        processingHistory,
        summary: {
          totalProcessings: processingHistory.length,
          successfulProcessings: processingHistory.filter(log => log.status === "completed").length,
          failedProcessings: processingHistory.filter(log => log.status === "failed").length,
          avgAutoFillSuccessRate: processingHistory.reduce((sum, log) => sum + (log.statistics?.autoFillSuccessRate || 0), 0) / processingHistory.length || 0,
          avgAiSuggestionSuccessRate: processingHistory.reduce((sum, log) => sum + (log.statistics?.aiSuggestionSuccessRate || 0), 0) / processingHistory.length || 0
        }
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        requestedBy: userId
      }
    });

  } catch (error) {
    console.error("Error fetching user AI processing log:", error);
    return next(createError(500, "Internal server error"));
  }
};

/**
 * Get detailed AI processing log by log ID
 */
const getAIProcessingLogDetails = async (req, res, next) => {
  try {
    // Validate admin access
    const userId = req.user.id || req.user._id;
    const user = await User.findById(userId);
    if (!user || user.role !== "admin") {
      return next(createError(403, "Only admin users can access AI processing log details"));
    }

    const { logId } = req.params;

    // Get detailed log
    const log = await AIProcessingLog.findById(logId)
      .populate('user', 'name email')
      .populate('questionMappings.autoFill.questionId', 'text type options')
      .populate('questionMappings.aiSuggestions.questionId', 'text type options')
      .populate('questionMappings.noMatch.questionId', 'text type options');

    if (!log) {
      return next(createError(404, "AI processing log not found"));
    }

    return res.status(200).json({
      success: true,
      data: log,
      metadata: {
        generatedAt: new Date().toISOString(),
        requestedBy: userId
      }
    });

  } catch (error) {
    console.error("Error fetching AI processing log details:", error);
    return next(createError(500, "Internal server error"));
  }
};

/**
 * Update user interaction statistics for a processing log
 */
const updateUserInteraction = async (req, res, next) => {
  try {
    // Validate admin access
    const userId = req.user.id || req.user._id;
    const user = await User.findById(userId);
    if (!user || user.role !== "admin") {
      return next(createError(403, "Only admin users can update interaction statistics"));
    }

    const { logId } = req.params;
    const { interactionType } = req.body;

    if (!interactionType || !['prefill_accepted', 'prefill_modified', 'ai_suggestion_accepted', 'ai_suggestion_modified', 'manual_answer'].includes(interactionType)) {
      return next(createError(400, "Invalid interaction type"));
    }

    const log = await AIProcessingLog.findById(logId);
    if (!log) {
      return next(createError(404, "AI processing log not found"));
    }

    await log.updateUserInteraction(interactionType);

    return res.status(200).json({
      success: true,
      message: "User interaction updated successfully",
      data: {
        logId,
        interactionType,
        updatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error("Error updating user interaction:", error);
    return next(createError(500, "Internal server error"));
  }
};

/**
 * Get AI processing performance metrics
 */
const getAIPerformanceMetrics = async (req, res, next) => {
  try {
    // Validate admin access
    const userId = req.user.id || req.user._id;
    const user = await User.findById(userId);
    if (!user || user.role !== "admin") {
      return next(createError(403, "Only admin users can access AI performance metrics"));
    }

    const { days = 7 } = req.query;
    const dateRange = parseInt(days);
    const startDate = new Date(Date.now() - dateRange * 24 * 60 * 60 * 1000);

    // Get performance metrics
    const metrics = await AIProcessingLog.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: "completed"
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" }
          },
          dailyProcessings: { $sum: 1 },
          avgAutoFillSuccessRate: { $avg: "$statistics.autoFillSuccessRate" },
          avgAiSuggestionSuccessRate: { $avg: "$statistics.aiSuggestionSuccessRate" },
          avgProcessingTime: { $avg: "$aiMetadata.processingTime" },
          totalDocumentsProcessed: { $sum: "$statistics.documentsProcessed" },
          totalQuestionsProcessed: { $sum: "$statistics.totalQuestions" },
          avgPreFillAccepted: { $avg: "$userInteraction.preFilledAnswersAccepted" },
          avgAiSuggestionsAccepted: { $avg: "$userInteraction.aiSuggestionsAccepted" }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
    ]);

    // Get error trends
    const errorTrends = await AIProcessingLog.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: "failed"
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" }
          },
          errorCount: { $sum: 1 },
          commonErrors: { $push: "$error.message" }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
    ]);

    return res.status(200).json({
      success: true,
      data: {
        performanceMetrics: metrics,
        errorTrends,
        dateRange,
        summary: {
          totalDays: dateRange,
          avgDailyProcessings: metrics.reduce((sum, m) => sum + m.dailyProcessings, 0) / metrics.length || 0,
          avgAutoFillSuccessRate: metrics.reduce((sum, m) => sum + (m.avgAutoFillSuccessRate || 0), 0) / metrics.length || 0,
          avgAiSuggestionSuccessRate: metrics.reduce((sum, m) => sum + (m.avgAiSuggestionSuccessRate || 0), 0) / metrics.length || 0,
          avgProcessingTime: metrics.reduce((sum, m) => sum + (m.avgProcessingTime || 0), 0) / metrics.length || 0
        }
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        requestedBy: userId
      }
    });

  } catch (error) {
    console.error("Error fetching AI performance metrics:", error);
    return next(createError(500, "Internal server error"));
  }
};

module.exports = {
  getAIProcessingStatistics,
  getUserAIProcessingLog,
  getAIProcessingLogDetails,
  updateUserInteraction,
  getAIPerformanceMetrics
};
