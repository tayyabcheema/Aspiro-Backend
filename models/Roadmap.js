const mongoose = require('mongoose');

const RoadmapSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  title: { 
    type: String, 
    required: true, 
    trim: true,
    default: 'Personalized Career Roadmap'
  },
  description: { 
    type: String, 
    trim: true,
    default: 'Your personalized learning journey based on your responses and goals'
  },
  courses: [{
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true
    },
    order: {
      type: Number,
      required: true
    },
    reason: {
      type: String,
      required: true
    },
    estimatedDuration: {
      type: String,
      default: '4-6 weeks'
    },
    prerequisites: [{
      type: String
    }]
  }],
  timeline: {
    totalDuration: {
      type: String,
      default: '16-24 weeks'
    },
    milestones: [{
      title: String,
      description: String,
      targetDate: Date,
      completed: {
        type: Boolean,
        default: false
      }
    }]
  },
  goals: [{
    shortTerm: [String],
    longTerm: [String]
  }],
  skills: [{
    name: String,
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'beginner'
    },
    targetLevel: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'intermediate'
    }
  }],
  status: {
    type: String,
    enum: ['generated', 'in_progress', 'completed', 'paused'],
    default: 'generated'
  },
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  aiMetadata: {
    model: String,
    processingTime: Number,
    confidence: Number,
    fallbackUsed: {
      type: Boolean,
      default: false
    }
  }
}, { timestamps: true });

// Indexes for better performance
RoadmapSchema.index({ user: 1 });
RoadmapSchema.index({ status: 1 });
RoadmapSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Roadmap', RoadmapSchema);
