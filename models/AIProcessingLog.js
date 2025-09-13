const mongoose = require("mongoose");

/**
 * AI Processing Log Schema
 * Stores logs of AI suggestions and document parsing for admin visibility
 */
const AIProcessingLogSchema = new mongoose.Schema(
  {
    user: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    },
    
    // Document processing information
    documents: [{
      filename: { type: String, required: true },
      mimetype: { type: String, required: true },
      size: { type: Number, required: true },
      documentType: { type: String, required: true }, // cv, cover-letter, etc.
      parsingSuccess: { type: Boolean, required: true },
      parsingError: { type: String },
      textLength: { type: Number },
      structuredData: { type: mongoose.Schema.Types.Mixed }
    }],

    // Question processing results
    questionMappings: {
      autoFill: [{
        questionId: { type: mongoose.Schema.Types.ObjectId, ref: "Question" },
        questionText: { type: String, required: true },
        questionType: { type: String, required: true },
        confidence: { type: Number, min: 0, max: 1 },
        hasAnswer: { type: Boolean, default: false }
      }],
      aiSuggestions: [{
        questionId: { type: mongoose.Schema.Types.ObjectId, ref: "Question" },
        questionText: { type: String, required: true },
        questionType: { type: String, required: true },
        suggestionCount: { type: Number, default: 0 },
        suggestions: [String]
      }],
      noMatch: [{
        questionId: { type: mongoose.Schema.Types.ObjectId, ref: "Question" },
        questionText: { type: String, required: true },
        questionType: { type: String, required: true }
      }]
    },

    // Processing statistics
    statistics: {
      totalQuestions: { type: Number, required: true },
      autoFillQuestions: { type: Number, required: true },
      aiSuggestionQuestions: { type: Number, required: true },
      noMatchQuestions: { type: Number, required: true },
      autoFillSuccessRate: { type: Number, min: 0, max: 100 },
      aiSuggestionSuccessRate: { type: Number, min: 0, max: 100 },
      documentsProcessed: { type: Number, required: true }
    },

    // AI service metadata
    aiMetadata: {
      model: { type: String },
      tokenUsage: {
        promptTokens: { type: Number },
        completionTokens: { type: Number },
        totalTokens: { type: Number }
      },
      processingTime: { type: Number }, // in milliseconds
      openaiApiCalls: { type: Number, default: 0 },
      fallbackUsed: { type: Boolean, default: false }
    },

    // Processing status
    status: {
      type: String,
      enum: ["processing", "completed", "failed", "partial"],
      default: "processing"
    },

    // Error information
    error: {
      message: { type: String },
      stack: { type: String },
      timestamp: { type: Date }
    },

    // User interaction data
    userInteraction: {
      preFilledAnswersAccepted: { type: Number, default: 0 },
      preFilledAnswersModified: { type: Number, default: 0 },
      aiSuggestionsAccepted: { type: Number, default: 0 },
      aiSuggestionsModified: { type: Number, default: 0 },
      manualAnswersProvided: { type: Number, default: 0 }
    }
  },
  { 
    timestamps: true,
    collection: "ai_processing_logs"
  }
);

// Indexes for efficient querying
AIProcessingLogSchema.index({ user: 1, createdAt: -1 });
AIProcessingLogSchema.index({ status: 1, createdAt: -1 });
AIProcessingLogSchema.index({ "statistics.autoFillSuccessRate": -1 });
AIProcessingLogSchema.index({ "aiMetadata.processingTime": -1 });

// Virtual for processing duration
AIProcessingLogSchema.virtual('processingDuration').get(function() {
  if (this.createdAt && this.updatedAt) {
    return this.updatedAt.getTime() - this.createdAt.getTime();
  }
  return null;
});

// Method to update user interaction statistics
AIProcessingLogSchema.methods.updateUserInteraction = function(interactionType) {
  if (!this.userInteraction) {
    this.userInteraction = {
      preFilledAnswersAccepted: 0,
      preFilledAnswersModified: 0,
      aiSuggestionsAccepted: 0,
      aiSuggestionsModified: 0,
      manualAnswersProvided: 0
    };
  }

  switch (interactionType) {
    case 'prefill_accepted':
      this.userInteraction.preFilledAnswersAccepted += 1;
      break;
    case 'prefill_modified':
      this.userInteraction.preFilledAnswersModified += 1;
      break;
    case 'ai_suggestion_accepted':
      this.userInteraction.aiSuggestionsAccepted += 1;
      break;
    case 'ai_suggestion_modified':
      this.userInteraction.aiSuggestionsModified += 1;
      break;
    case 'manual_answer':
      this.userInteraction.manualAnswersProvided += 1;
      break;
  }

  return this.save();
};

// Static method to get processing statistics for admin dashboard
AIProcessingLogSchema.statics.getProcessingStatistics = function(dateRange = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - dateRange);

  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate },
        status: "completed"
      }
    },
    {
      $group: {
        _id: null,
        totalProcessings: { $sum: 1 },
        avgAutoFillSuccessRate: { $avg: "$statistics.autoFillSuccessRate" },
        avgAiSuggestionSuccessRate: { $avg: "$statistics.aiSuggestionSuccessRate" },
        avgProcessingTime: { $avg: "$aiMetadata.processingTime" },
        totalDocumentsProcessed: { $sum: "$statistics.documentsProcessed" },
        totalQuestionsProcessed: { $sum: "$statistics.totalQuestions" },
        avgPreFillAccepted: { $avg: "$userInteraction.preFilledAnswersAccepted" },
        avgAiSuggestionsAccepted: { $avg: "$userInteraction.aiSuggestionsAccepted" }
      }
    }
  ]);
};

// Static method to get user-specific processing history
AIProcessingLogSchema.statics.getUserProcessingHistory = function(userId, limit = 10) {
  return this.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('user', 'name email')
    .select('-documents.structuredData -questionMappings.aiSuggestions.suggestions');
};

const AIProcessingLog = mongoose.model("AIProcessingLog", AIProcessingLogSchema);

module.exports = AIProcessingLog;
