const mongoose = require("mongoose");

const FileSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    type: {
      type: String,
      enum: ["cv", "cover-letter", "certificate", "transcript", "other"],
      default: "other",
    },
  },
  { _id: false }
);

const UserResponseSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    question: { type: mongoose.Schema.Types.ObjectId, ref: "Question", required: true },
    questionText: { type: String, required: true }, // ✅ store question text
    questionType: { type: String, enum: ["text", "yes/no", "multiple-choice", "upload", "link"], required: true },
    step: {
      stepNumber: Number,
      stepName: String,
    },
    category: { type: String, enum: ["student", "professional"], required: true },

    // Store only the relevant answer based on question type
    answer: {
      type: mongoose.Schema.Types.Mixed, // Can be String, Boolean, or Array of files
      required: true
    },

    // files array for upload-type questions (optional field)
    files: {
      type: [
        {
          type: mongoose.Schema.Types.Mixed, // allow either object or string
        },
      ],
      default: undefined, // Don't store empty array, only store when files exist
    },

    // AI-generated suggestions for multiple-choice questions
    aiSuggestions: {
      type: [String],
      default: undefined, // Don't store empty array, only store when suggestions exist
    },

    // Source of the response (auto-fill from CV or AI-generated)
    source: {
      type: String,
      enum: ["manual", "auto-fill", "ai"],
      default: "manual"
    },
  },
  { timestamps: true }
);

// ✅ Ensure user cannot submit multiple responses for same question
UserResponseSchema.index({ user: 1, question: 1 }, { unique: true });

const UserResponse = mongoose.model("UserResponse", UserResponseSchema);
module.exports = UserResponse;
