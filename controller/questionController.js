const Question = require("../models/Question");
const User = require("../models/User")
const createError = require("../utils/error");

const addQuestion = async (req, res, next) => {
  try {
    // ✅ First check if request body exists
    if (!req.body || Object.keys(req.body).length === 0) {
      return next(createError(400, "Request body is missing or empty"));
    }

    const userId = req.user.id || req.user._id;
    const user = await User.findById(userId);

    if (!user || user.role !== "admin") {
      return next(
        createError(403, "You are not allowed! Only admin can add questions")
      );
    }

    // ✅ Handle multiple questions at once
    if (Array.isArray(req.body)) {
      // Validate each question before saving
      for (const q of req.body) {
        if (!q.text || !q.type || !q.step || !q.category) {
          return next(
            createError(
              400,
              "Each question must include: text, type, step, category"
            )
          );
        }
        if (!q.step.stepNumber || !q.step.stepName) {
          return next(
            createError(400, "Step must include stepNumber and stepName")
          );
        }
        if (
          q.type === "multiple-choice" &&
          (!q.options || q.options.length === 0)
        ) {
          return next(
            createError(400, "Options are required for multiple-choice questions")
          );
        }
      }

      const questions = await Question.insertMany(req.body);
      return res.status(201).json({
        message: "Questions added successfully",
        data: questions,
      });
    }

    // ✅ Single question (existing logic)
    const { text, type, options, step, category, optional, status } = req.body;

    if (!text || !type || !step || !category) {
      return next(
        createError(
          400,
          "Please provide all required fields: text, type, step, category"
        )
      );
    }

    if (!step.stepNumber || !step.stepName) {
      return next(createError(400, "Step must include stepNumber and stepName"));
    }

    if (type === "multiple-choice" && (!options || options.length === 0)) {
      return next(
        createError(400, "Options are required for multiple-choice questions")
      );
    }

    const newQuestion = new Question({
      text,
      type,
      options,
      step,
      category,
      optional,
      status,
    });

    await newQuestion.save();

    return res.status(201).json({
      message: "Question added successfully",
      data: newQuestion,
    });
  } catch (error) {
    console.error("Error adding question:", error);

    // ✅ Handle duplicate key error (single insert or bulk insert)
    if (error.code === 11000) {
      let duplicateMessage = "Duplicate question found";

      // For bulk insert errors
      if (error.writeErrors && error.writeErrors.length > 0) {
        const dupDoc = error.writeErrors[0].op; // original doc that caused duplicate
        duplicateMessage = `Duplicate question: "${dupDoc?.text || "Unknown"}" already exists in step ${dupDoc?.step?.stepNumber || "?"} for category "${dupDoc?.category || "?"}"`;
      }

      // For single insert errors
      else if (error.keyValue) {
        duplicateMessage = `Duplicate question already exists with values: ${JSON.stringify(
          error.keyValue
        )}`;
      }

      return next(createError(409, duplicateMessage));
    }

    return next(createError(500, "Internal server error"));
  }
};

const getAllQuestions = async (req, res, next) => {
  try {
    const questions = await Question.find()
      .sort({ "step.stepNumber": 1, createdAt: 1 }) // optional sorting
      .lean();

    if (!questions || questions.length === 0) {
      return next(createError(404, "No questions found"));
    }

    return res.status(200).json({
      success: true,
      count: questions.length,
      data: questions,
    });
  } catch (error) {
    console.error("Error fetching questions:", error);
    return next(createError(500, "Internal server error"));
  }
};

const getAllQuestionsForAI = async (req, res, next) => {
  try {
    const questions = await Question.find()
      .sort({ "step.stepNumber": 1, createdAt: 1 }) // optional sorting
      .lean();

    if (!questions || questions.length === 0) {
      return next(createError(404, "No questions found"));
    }

    return res.status(200).json({
      success: true,
      count: questions.length,
      data: questions,
    });
  } catch (error) {
    console.error("Error fetching questions:", error);
    return next(createError(500, "Internal server error"));
  }
};







module.exports = {addQuestion,getAllQuestions, getAllQuestionsForAI};
