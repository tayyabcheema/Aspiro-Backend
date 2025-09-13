const mongoose = require("mongoose");

const StepSchema = new mongoose.Schema(
  {
    stepNumber: {
      type: Number,
      required: true,
    },
    stepName: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

// ✅ Sub-schema for optional documents
const OptionalDocumentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["cover-letter", "experience-letter", "certificate", "other"],
      required: true,
    },
    required: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const QuestionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["text", "yes/no", "multiple-choice", "upload", "link"],
      default: "text",
    },
    options: [
      {
        type: String,
      },
    ],
    step: {
      type: StepSchema,
      required: true,
    },
    category: {
      type: String,
      enum: ["student", "professional"],
      required: true,
    },
    optional: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    // ✅ New field for CV + optional documents
    documents: {
      cv: {
        type: Boolean,
        default: true, // CV upload is mandatory
      },
      optionalDocs: {
        type: [OptionalDocumentSchema],
        validate: {
          validator: function (val) {
            return val.length <= 5; // allow up to 5 optional docs
          },
          message: "You can only add up to 5 optional documents",
        },
      },
    },
  },
  { timestamps: true }
);

// ✅ Compound Unique Index (text + stepNumber + category)
QuestionSchema.index(
  { text: 1, "step.stepNumber": 1, category: 1 },
  { unique: true }
);

const Question = mongoose.model("Question", QuestionSchema);

module.exports = Question;
