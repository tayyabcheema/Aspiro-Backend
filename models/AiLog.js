const mongoose = require('mongoose');

const AiLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: true
  },
  questionText: {
    type: String,
    required: true
  },
  suggestions: {
    type: [String],
    required: true
  },
  cvText: {
    type: String,
    required: true
  },
  // Additional metadata
  model: {
    type: String,
    default: 'gpt-3.5-turbo'
  },
  tokensUsed: {
    type: Number,
    default: 0
  },
  processingTime: {
    type: Number, // in milliseconds
    default: 0
  },
  // Admin review fields
  reviewed: {
    type: Boolean,
    default: false
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  },
  adminNotes: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
AiLogSchema.index({ userId: 1, createdAt: -1 });
AiLogSchema.index({ questionId: 1 });
AiLogSchema.index({ reviewed: 1 });
AiLogSchema.index({ createdAt: -1 });

const AiLog = mongoose.model('AiLog', AiLogSchema);

module.exports = AiLog;
