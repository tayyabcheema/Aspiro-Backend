const createError = require("../utils/error");
const User = require("../models/User");
const Question = require("../models/Question");
const UserResponse = require("../models/UserResponse");
const AIProcessingLog = require("../models/AIProcessingLog");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const path = require("path");
const QuestionPreFillService = require("../services/questionPreFillService");

/**
 * Extract text content from uploaded files
 * @param {string} filePath - Path to the uploaded file
 * @param {string} mimetype - MIME type of the file
 * @returns {Promise<string>} Extracted text content
 */
async function extractText(filePath, mimetype) {
  try {
  const buffer = fs.readFileSync(filePath);

  if (mimetype === "application/pdf") {
    const data = await pdfParse(buffer);
      return data.text.trim();
  } else if (
      mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimetype === "application/msword"
  ) {
    const result = await mammoth.extractRawText({ buffer });
      return result.value.trim();
  } else if (mimetype === "text/plain") {
      return buffer.toString("utf-8").trim();
  }

  return "";
  } catch (error) {
    console.error(`Error extracting text from ${filePath}:`, error);
    return "";
  }
}

/**
 * Validate that all required questions are answered
 * @param {Array} responses - Array of user responses
 * @param {Array} questions - Array of question objects
 * @returns {Object|null} Error object if validation fails, null if valid
 */
function validateAllQuestionsAnswered(responses, questions) {
  const responseMap = new Map();
  responses.forEach(r => responseMap.set(r.questionId, r));

  for (const question of questions) {
    const response = responseMap.get(question._id.toString());
    
    if (!response) {
      return {
        status: 400,
        message: `Question "${question.text}" is not answered`
      };
    }

    // Validate based on question type
    switch (question.type) {
      case "text":
        if (!response.answerText || response.answerText.trim() === "") {
          return {
            status: 400,
            message: `Text answer is required for question: "${question.text}"`
          };
        }
        break;

      case "yes/no":
        if (!response.answerChoice || response.answerChoice.trim() === "") {
          return {
            status: 400,
            message: `Yes/No answer is required for question: "${question.text}"`
          };
        }
        // For yes/no questions, accept "Yes" or "No" regardless of options array
        if (response.answerChoice !== "Yes" && response.answerChoice !== "No") {
          return {
            status: 400,
            message: `Invalid choice for question "${question.text}". Allowed options: Yes, No`
          };
        }
        break;

      case "multiple-choice":
        if (!response.answerChoice || response.answerChoice.trim() === "") {
          return {
            status: 400,
            message: `Choice answer is required for question: "${question.text}"`
          };
        }
        if (!question.options.includes(response.answerChoice)) {
          return {
            status: 400,
            message: `Invalid choice for question "${question.text}". Allowed options: ${question.options.join(", ")}`
          };
        }
        break;

      case "link":
        if (!response.answerLink || response.answerLink.trim() === "") {
          return {
            status: 400,
            message: `Link answer is required for question: "${question.text}"`
          };
        }
        break;

      case "upload":
        if (!response.files || response.files.length === 0) {
          return {
            status: 400,
            message: `At least one file must be uploaded for question: "${question.text}"`
          };
        }
        break;

      default:
        return {
          status: 400,
          message: `Invalid question type: ${question.type}`
        };
    }
  }

  return null;
}

/**
 * Validate that at least one document is uploaded across all questions
 * @param {Array} responses - Array of user responses
 * @returns {boolean} True if at least one document is uploaded
 */
function validateAtLeastOneDocument(responses) {
  return responses.some(response => 
    response.files && response.files.length > 0
  );
}

/**
 * Process uploaded files and extract text content
 * Handles both referenced files and direct uploads
 * @param {Array} fileReferences - Array of file references from request body
 * @param {Array} uploadedFiles - Array of files from multer
 * @returns {Promise<Object>} Object with processed files and unused files
 */
async function processUploadedFiles(fileReferences, uploadedFiles) {
  const processedFiles = [];
  const unusedFiles = [...uploadedFiles]; // Track files not yet assigned
  const uploadedFileNames = uploadedFiles.map(f => f.originalname);

  // Process referenced files first
  for (const fileRef of fileReferences) {
    // Find the actual uploaded file
    const uploadedFile = uploadedFiles.find(f => f.originalname === fileRef.file);

    if (!uploadedFile) {
      const availableFiles = uploadedFileNames.length > 0 
        ? `Available files: ${uploadedFileNames.join(", ")}` 
        : "No files were uploaded";
      throw new Error(`File "${fileRef.file}" not found in uploaded files. ${availableFiles}`);
    }

    // Validate file size (5MB limit)
    if (uploadedFile.size > 5 * 1024 * 1024) {
      throw new Error(`File "${uploadedFile.originalname}" exceeds 5MB limit`);
    }

    // Extract text content
    const textContent = await extractText(uploadedFile.path, uploadedFile.mimetype);

    processedFiles.push({
      type: fileRef.type || "other",
      originalName: uploadedFile.originalname,
      serverPath: uploadedFile.path,
      textContent: textContent,
      size: uploadedFile.size,
      mimetype: uploadedFile.mimetype
    });

    // Remove from unused files
    const unusedIndex = unusedFiles.findIndex(f => f.originalname === fileRef.file);
    if (unusedIndex !== -1) {
      unusedFiles.splice(unusedIndex, 1);
    }
  }

  // Process any remaining unused files (direct uploads)
  for (const uploadedFile of unusedFiles) {
    // Validate file size (5MB limit)
    if (uploadedFile.size > 5 * 1024 * 1024) {
      throw new Error(`File "${uploadedFile.originalname}" exceeds 5MB limit`);
    }

    // Extract text content
    const textContent = await extractText(uploadedFile.path, uploadedFile.mimetype);

    // Determine file type based on filename
    const fileType = determineFileType(uploadedFile.originalname);

    processedFiles.push({
      type: fileType,
      originalName: uploadedFile.originalname,
      serverPath: uploadedFile.path,
      textContent: textContent,
      size: uploadedFile.size,
      mimetype: uploadedFile.mimetype
    });
  }

  return {
    files: processedFiles,
    unusedCount: unusedFiles.length
  };
}

/**
 * Distribute processed files to appropriate questions
 * @param {Array} responses - Array of user responses
 * @param {Array} processedFiles - Array of processed file objects
 * @returns {Map} Map of questionId to files array
 */
function distributeFilesToQuestions(responses, processedFiles) {
  const filesByQuestion = new Map();
  
  // First, assign files based on explicit references
  responses.forEach(response => {
    if (response.files && response.files.length > 0) {
      const questionFiles = [];
      
      response.files.forEach(fileRef => {
        const matchingFile = processedFiles.find(file => 
          file.originalName === fileRef.file
        );
        if (matchingFile) {
          questionFiles.push(matchingFile);
        }
      });
      
      if (questionFiles.length > 0) {
        filesByQuestion.set(response.questionId, questionFiles);
      }
    }
  });
  
  // Then, assign any remaining files to upload-type questions
  const assignedFiles = new Set();
  filesByQuestion.forEach(files => {
    files.forEach(file => assignedFiles.add(file.originalName));
  });
  
  const unassignedFiles = processedFiles.filter(file => 
    !assignedFiles.has(file.originalName)
  );
  
  if (unassignedFiles.length > 0) {
    // Find upload-type questions that don't have files yet
    const uploadQuestions = responses.filter(response => {
      const question = responses.find(r => r.questionId === response.questionId);
      return question && !filesByQuestion.has(response.questionId);
    });
    
    // Distribute unassigned files to upload questions
    unassignedFiles.forEach((file, index) => {
      const targetQuestion = uploadQuestions[index % uploadQuestions.length];
      if (targetQuestion) {
        if (!filesByQuestion.has(targetQuestion.questionId)) {
          filesByQuestion.set(targetQuestion.questionId, []);
        }
        filesByQuestion.get(targetQuestion.questionId).push(file);
      }
    });
  }
  
  return filesByQuestion;
}

/**
 * Determine file type based on filename
 * @param {string} filename - Original filename
 * @returns {string} File type
 */
function determineFileType(filename) {
  const lowerName = filename.toLowerCase();
  
  if (lowerName.includes('cv') || lowerName.includes('resume')) {
    return 'cv';
  } else if (lowerName.includes('cover') || lowerName.includes('letter')) {
    return 'cover-letter';
  } else if (lowerName.includes('certificate') || lowerName.includes('cert')) {
    return 'certificate';
  } else if (lowerName.includes('transcript') || lowerName.includes('marksheet')) {
    return 'transcript';
  } else if (lowerName.includes('experience') || lowerName.includes('exp')) {
    return 'experience-letter';
  } else {
    return 'other';
  }
}

/**
 * Clean up uploaded files from the filesystem
 * @param {Array} filePaths - Array of file paths to delete
 * @returns {Promise<Object>} Result with deleted files and any errors
 */
async function cleanupUploadedFiles(filePaths) {
  const results = {
    deleted: [],
    errors: []
  };

  for (const filePath of filePaths) {
    try {
      // Check if file exists before attempting to delete
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        results.deleted.push(filePath);
      } else {
        console.warn(`File not found for cleanup: ${filePath}`);
      }
    } catch (error) {
      console.error(`Error deleting file ${filePath}:`, error.message);
      results.errors.push({
        file: filePath,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * Save user responses to questionnaire
 * Validates all questions are answered, processes file uploads, and saves to database
 */
const saveUserResponses = async (req, res, next) => {
  try {
    // Validate request body
    if (!req.body || Object.keys(req.body).length === 0) {
      return next(createError(400, "Request body is missing or empty"));
    }

    // Validate user authentication and role
    const userId = req.user.id || req.user._id;
    const user = await User.findById(userId);
    if (!user || user.role !== "user") {
      return next(createError(403, "Only registered users can submit responses"));
    }

    // Handle different request formats
    let responses;
    const uploadedFiles = req.files || [];

    // Debug logging for file uploads

    // Parse responses from different formats
    if (req.body.responses) {
      // Form-data format: responses field contains JSON string
      try {
        responses = JSON.parse(req.body.responses);
      } catch (error) {
        return next(createError(400, "Invalid JSON format in responses field"));
      }
    } else if (Array.isArray(req.body)) {
      // Direct JSON array format
      responses = req.body;
    } else if (req.body && typeof req.body === 'object') {
      // Single response object
      responses = [req.body];
    } else {
      return next(createError(400, "Request body is missing or invalid format"));
    }

    // Ensure responses is an array
    if (!Array.isArray(responses)) {
      return next(createError(400, "Responses must be an array"));
    }

    // Extract all question IDs from responses
    const questionIds = responses.map(r => r.questionId);
    
    // Debug logging for question IDs
    
    // Fetch all questions at once for validation
    const questions = await Question.find({ 
      _id: { $in: questionIds },
      status: "active" 
    });

    
    if (questions.length !== questionIds.length) {
      const foundIds = questions.map(q => q._id.toString());
      const missingIds = questionIds.filter(id => !foundIds.includes(id));
      return next(createError(404, `One or more questions not found or inactive. Missing: ${missingIds.join(", ")}`));
    }

    // Validate that all questions are answered
    const validationError = validateAllQuestionsAnswered(responses, questions);
    if (validationError) {
      return next(createError(validationError.status, validationError.message));
    }

    // Collect all file references from responses
    const allFileReferences = [];
    responses.forEach(response => {
      if (response.files && response.files.length > 0) {
        allFileReferences.push(...response.files);
      }
    });

    // Validate that at least one document is uploaded (either referenced or direct)
    if (allFileReferences.length === 0 && uploadedFiles.length === 0) {
      return next(createError(400, "At least one document must be uploaded"));
    }

    // Process all uploaded files (both referenced and direct uploads)
    let processedFilesResult;
    try {
      processedFilesResult = await processUploadedFiles(allFileReferences, uploadedFiles);
    } catch (fileError) {
      return next(createError(400, fileError.message));
    }

    // Log information about file processing
    if (processedFilesResult.unusedCount > 0) {
    }

    // Distribute files to appropriate questions
    const filesByQuestion = distributeFilesToQuestions(responses, processedFilesResult.files);

    // Process all responses
    const savedResponses = [];
    const questionMap = new Map();
    questions.forEach(q => questionMap.set(q._id.toString(), q));

    for (const response of responses) {
      const question = questionMap.get(response.questionId);
      
      // Prepare response data with optimized structure
      const responseData = {
        user: userId,
        question: question._id,
        questionText: question.text,
        questionType: question.type,
        step: question.step,
        category: question.category
      };

      // Store only the relevant answer based on question type
      switch (question.type) {
        case "text":
          responseData.answer = response.answerText;
          break;
        case "yes/no":
          responseData.answer = response.answerChoice;
          break;
        case "multiple-choice":
          responseData.answer = response.answerChoice;
          break;
        case "link":
          responseData.answer = response.answerLink;
          break;
        case "upload":
          // For upload questions, store files and set answer to files array
          const questionFiles = filesByQuestion.get(response.questionId) || [];
          responseData.answer = questionFiles;
          responseData.files = questionFiles; // Only store files field for upload questions
          break;
        default:
          throw new Error(`Invalid question type: ${question.type}`);
      }

      // Save or update user response
      const userResponse = await UserResponse.findOneAndUpdate(
        { user: userId, question: question._id },
        responseData,
        { 
          new: true, 
          upsert: true, 
          runValidators: true 
        }
      );

      savedResponses.push(userResponse);
    }

    // Clean up uploaded files after successful processing
    const uploadedFilePaths = uploadedFiles.map(file => file.path);
    const cleanupResult = await cleanupUploadedFiles(uploadedFilePaths);
    
    // Log cleanup results
    if (cleanupResult.deleted.length > 0) {
    }
    if (cleanupResult.errors.length > 0) {
      console.warn(`Failed to clean up ${cleanupResult.errors.length} files:`, cleanupResult.errors);
    }

    // Update user's onboarding completion status
    try {
      await User.findByIdAndUpdate(userId, { hasCompletedOnboarding: true });
    } catch (updateError) {
      console.error("Failed to update user onboarding status:", updateError);
      // Don't fail the entire request if this update fails
    }

    // Return success response
    return res.status(201).json({
      success: true,
      message: "Responses saved successfully",
      data: savedResponses,
      cleanup: {
        filesDeleted: cleanupResult.deleted.length,
        cleanupErrors: cleanupResult.errors.length
      }
    });

  } catch (error) {
    console.error("Error saving responses:", error);

    // Clean up uploaded files even if there was an error
    if (uploadedFiles && uploadedFiles.length > 0) {
      const uploadedFilePaths = uploadedFiles.map(file => file.path);
      const cleanupResult = await cleanupUploadedFiles(uploadedFilePaths);
      
      if (cleanupResult.deleted.length > 0) {
      }
    }

    // Handle duplicate key error
    if (error.code === 11000) {
      return next(createError(409, "You have already submitted a response for one or more questions"));
    }

    // Handle validation errors
    if (error.name === "ValidationError") {
      return next(createError(400, `Validation error: ${error.message}`));
    }

    // Handle other errors
    return next(createError(500, "Internal server error"));
  }
};

/**
 * Pre-fill questions based on uploaded documents
 * Uses AI and document parsing to automatically suggest answers
 */
const preFillQuestions = async (req, res, next) => {
  try {
    // Validate user authentication
    const userId = req.user.id || req.user._id;
    const user = await User.findById(userId);
    if (!user || user.role !== "user") {
      return next(createError(403, "Only registered users can pre-fill questions"));
    }

    const uploadedFiles = req.files || [];
    
    if (uploadedFiles.length === 0) {
      return next(createError(400, "At least one document must be uploaded for pre-filling"));
    }

    // Get all active questions
    const questions = await Question.find({ status: "active" }).sort({ "step.stepNumber": 1 });
    
    if (!questions || questions.length === 0) {
      return next(createError(404, "No active questions found"));
    }

    // Initialize pre-fill service
    const preFillService = new QuestionPreFillService();

    // Create AI processing log entry
    const processingLog = new AIProcessingLog({
      user: userId,
      documents: uploadedFiles.map(file => ({
        filename: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        documentType: preFillService.documentParser.determineDocumentType(file.path, file.mimetype),
        parsingSuccess: false, // Will be updated after processing
        textLength: 0
      })),
      statistics: {
        totalQuestions: questions.length,
        autoFillQuestions: 0,
        aiSuggestionQuestions: 0,
        noMatchQuestions: 0,
        autoFillSuccessRate: 0,
        aiSuggestionSuccessRate: 0,
        documentsProcessed: uploadedFiles.length
      },
      status: "processing"
    });

    await processingLog.save();

    // Process documents and generate pre-filled answers
    const preFillResults = await preFillService.processDocumentsAndPreFill(uploadedFiles, questions);

    if (!preFillResults.success) {
      // Update log with error
      processingLog.status = "failed";
      processingLog.error = {
        message: preFillResults.error,
        timestamp: new Date()
      };
      await processingLog.save();
      
      return next(createError(500, `Pre-fill processing failed: ${preFillResults.error}`));
    }

    // Generate summary for admin logging
    const summary = preFillService.getPreFillSummary(preFillResults);
    

    // Update processing log with results
    processingLog.documents = preFillResults.data.parsedDocuments.map((doc, index) => ({
      filename: uploadedFiles[index].originalname,
      mimetype: uploadedFiles[index].mimetype,
      size: uploadedFiles[index].size,
      documentType: doc.documentType || 'other',
      parsingSuccess: doc.success,
      parsingError: doc.error || null,
      textLength: doc.structuredData ? JSON.stringify(doc.structuredData).length : 0,
      structuredData: doc.success ? doc.structuredData : null
    }));

    // Ensure all mappings have required questionType field
    processingLog.questionMappings = {
      autoFill: summary.details.autoFill.map(item => ({
        questionId: item.questionId,
        questionText: item.questionText,
        questionType: item.questionType || 'general',
        confidence: item.confidence || 0,
        hasAnswer: item.hasAnswer || false
      })),
      aiSuggestions: summary.details.aiSuggestions.map(item => ({
        questionId: item.questionId,
        questionText: item.questionText,
        questionType: item.questionType || 'general',
        suggestionCount: item.suggestionCount || 0,
        suggestions: []
      })),
      noMatch: summary.details.noMatch.map(item => ({
        questionId: item.questionId,
        questionText: item.questionText,
        questionType: item.questionType || 'general'
      }))
    };

    processingLog.statistics = {
      totalQuestions: summary.totalQuestions,
      autoFillQuestions: summary.autoFillQuestions,
      aiSuggestionQuestions: summary.aiSuggestionQuestions,
      noMatchQuestions: summary.noMatchQuestions,
      autoFillSuccessRate: summary.autoFillSuccessRate,
      aiSuggestionSuccessRate: summary.aiSuggestionSuccessRate,
      documentsProcessed: uploadedFiles.length
    };

    processingLog.aiMetadata = {
      model: "gpt-4o-mini",
      processingTime: Date.now() - processingLog.createdAt.getTime(),
      openaiApiCalls: summary.aiSuggestionQuestions,
      fallbackUsed: summary.details.aiSuggestions.some(item => item.suggestionCount === 0)
    };

    processingLog.status = "completed";
    
    try {
      await processingLog.save();
    } catch (saveError) {
      console.error("Error saving AI processing log:", saveError);
      // Don't fail the entire request if logging fails
      console.warn("Continuing without saving processing log due to validation error");
    }

    // Clean up uploaded files after processing
    const uploadedFilePaths = uploadedFiles.map(file => file.path);
    const cleanupResult = await cleanupUploadedFiles(uploadedFilePaths);
    

    // Return pre-fill results
    return res.status(200).json({
      success: true,
      message: "Questions pre-filled successfully",
      data: {
        preFilledAnswers: preFillResults.data.preFilledAnswers,
        questionMappings: preFillResults.data.questionMappings,
        documentSummary: preFillResults.data.combinedDocumentData,
        summary
      },
      metadata: preFillResults.metadata
    });

  } catch (error) {
    console.error("Error pre-filling questions:", error);

    // Clean up uploaded files even if there was an error
    if (req.files && req.files.length > 0) {
      const uploadedFilePaths = req.files.map(file => file.path);
      const cleanupResult = await cleanupUploadedFiles(uploadedFilePaths);
      
      if (cleanupResult.deleted.length > 0) {
      }
    }

    return next(createError(500, "Internal server error during pre-fill processing"));
  }
};

const getUserResponses = async(req,res,next)=>{
  try {
    const userId = req.user.id || req.user._id
    const user = await User.findById(userId)
    if(!user || user.role !== "user"){
      return next(createError(403, "Only registered users can get their responses"))
    }
    const responses = await UserResponse.find({user:userId})
    return res.status(200).json({
      success: true,
      message: "Responses fetched successfully",
      data: responses
    })
  } catch (error) {
    console.error("Error fetching user responses:", error);
    return next(createError(500, "Internal server error"));
  }
}

module.exports = { saveUserResponses, preFillQuestions, getUserResponses };
