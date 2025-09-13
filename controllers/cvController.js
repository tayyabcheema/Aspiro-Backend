const fs = require('fs');
const path = require('path');
const createError = require('../utils/error');
const parseText = require('../services/parser');
const extractStructuredData = require('../services/extractor');
const generateAISuggestions = require('../services/aiGenerator');
const Question = require('../models/Question');
const UserResponse = require('../models/UserResponse');
const AiLog = require('../models/AiLog');

const uploadCV = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(createError(400, 'No CV file uploaded'));
    }

    const userId = req.user.id || req.user._id;
    const filePath = req.file.path;
    const originalName = req.file.originalname;

    console.log(`Processing CV upload for user ${userId}: ${originalName}`);

    // Step 1: Extract text from uploaded file
    const extractedText = await parseText(filePath, req.file.mimetype);
    
    if (!extractedText || extractedText.trim().length === 0) {
      // Clean up uploaded file
      fs.unlinkSync(filePath);
      return next(createError(400, 'Could not extract text from the uploaded file'));
    }

    console.log(`Extracted text length: ${extractedText.length} characters`);

    // Step 2: Extract structured data from text
    const structuredData = await extractStructuredData(extractedText);
    console.log('Structured data extracted:', JSON.stringify(structuredData, null, 2));

    // Step 3: Get all questions for mapping
    const questions = await Question.find({ status: 'active' }).lean();
    
    // Step 4: Map structured data to questions and generate AI suggestions
    const autoFilled = {};
    const aiSuggestions = {};
    const aiLogs = [];

    for (const question of questions) {
      const questionId = question._id.toString();
      
      // Check if we have extracted data that matches this question
      const extractedAnswer = mapExtractedDataToQuestion(structuredData, question);
      
      if (extractedAnswer) {
        // Auto-fill the answer
        autoFilled[questionId] = extractedAnswer;
        
        // Save to UserResponse
        await UserResponse.findOneAndUpdate(
          { user: userId, question: questionId },
          {
            user: userId,
            question: questionId,
            questionText: question.text,
            questionType: question.type,
            step: question.step,
            category: question.category,
            answer: extractedAnswer,
            source: 'auto-fill'
          },
          { upsert: true, new: true }
        );
      } else {
        // Generate AI suggestions for questions without extracted data
        try {
          const suggestions = await generateAISuggestions(extractedText, question);
          
          if (suggestions && suggestions.length >= 4) {
            aiSuggestions[questionId] = suggestions;
            
            // Log AI suggestions for admin review
            const aiLog = new AiLog({
              userId: userId,
              questionId: questionId,
              questionText: question.text,
              suggestions: suggestions,
              cvText: extractedText.substring(0, 1000) // Store first 1000 chars for context
            });
            await aiLog.save();
            aiLogs.push(aiLog);
            
            // Save AI suggestions to UserResponse
            await UserResponse.findOneAndUpdate(
              { user: userId, question: questionId },
              {
                user: userId,
                question: questionId,
                questionText: question.text,
                questionType: question.type,
                step: question.step,
                category: question.category,
                aiSuggestions: suggestions,
                source: 'ai'
              },
              { upsert: true, new: true }
            );
          }
        } catch (aiError) {
          console.error(`Failed to generate AI suggestions for question ${questionId}:`, aiError);
          // Continue with other questions even if AI fails for one
        }
      }
    }

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    console.log(`CV processing complete. Auto-filled: ${Object.keys(autoFilled).length}, AI suggestions: ${Object.keys(aiSuggestions).length}`);

    return res.status(200).json({
      success: true,
      message: 'CV processed successfully',
      data: {
        autoFilled,
        aiSuggestions,
        extractedData: structuredData,
        processedQuestions: questions.length,
        aiLogsCount: aiLogs.length
      }
    });

  } catch (error) {
    console.error('CV upload error:', error);
    
    // Clean up uploaded file if it exists
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error('Failed to clean up uploaded file:', cleanupError);
      }
    }
    
    return next(createError(500, 'Failed to process CV: ' + error.message));
  }
};

const getCVSuggestions = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    
    // Get all user responses with AI suggestions
    const responses = await UserResponse.find({
      user: userId,
      source: 'ai',
      aiSuggestions: { $exists: true, $ne: [] }
    }).populate('question', 'text type step category').lean();

    const aiSuggestions = {};
    const autoFilled = {};

    // Separate auto-filled and AI suggestions
    for (const response of responses) {
      const questionId = response.question._id.toString();
      
      if (response.source === 'auto-fill' && response.answer) {
        autoFilled[questionId] = response.answer;
      } else if (response.source === 'ai' && response.aiSuggestions) {
        aiSuggestions[questionId] = response.aiSuggestions;
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        autoFilled,
        aiSuggestions
      }
    });

  } catch (error) {
    console.error('Get CV suggestions error:', error);
    return next(createError(500, 'Failed to get CV suggestions: ' + error.message));
  }
};

// Helper function to map extracted data to questions
function mapExtractedDataToQuestion(structuredData, question) {
  const questionText = question.text.toLowerCase();
  const questionCategory = question.category.toLowerCase();
  
  // Map based on question text keywords and category
  if (questionText.includes('skill') || questionText.includes('technology') || questionText.includes('programming')) {
    if (structuredData.skills && structuredData.skills.length > 0) {
      return structuredData.skills.join(', ');
    }
  }
  
  if (questionText.includes('education') || questionText.includes('degree') || questionText.includes('university') || questionText.includes('college')) {
    if (structuredData.education && structuredData.education.length > 0) {
      return structuredData.education.map(edu => `${edu.degree} from ${edu.institution}`).join(', ');
    }
  }
  
  if (questionText.includes('experience') || questionText.includes('work') || questionText.includes('job') || questionText.includes('position')) {
    if (structuredData.experience && structuredData.experience.length > 0) {
      return structuredData.experience.map(exp => `${exp.role} at ${exp.company}`).join(', ');
    }
  }
  
  if (questionText.includes('certification') || questionText.includes('certificate') || questionText.includes('certified')) {
    if (structuredData.certifications && structuredData.certifications.length > 0) {
      return structuredData.certifications.join(', ');
    }
  }
  
  if (questionText.includes('years') && questionText.includes('experience')) {
    if (structuredData.totalExperience) {
      return structuredData.totalExperience;
    }
  }
  
  // For yes/no questions, try to infer from context
  if (question.type === 'yes/no' || question.type === 'multiple-choice') {
    if (question.options && question.options.length === 2 && 
        question.options.includes('Yes') && question.options.includes('No')) {
      
      // Check if we have relevant data for this question
      if (questionText.includes('experience') && structuredData.experience && structuredData.experience.length > 0) {
        return 'Yes';
      }
      if (questionText.includes('certification') && structuredData.certifications && structuredData.certifications.length > 0) {
        return 'Yes';
      }
      if (questionText.includes('education') && structuredData.education && structuredData.education.length > 0) {
        return 'Yes';
      }
    }
  }
  
  return null;
}

module.exports = { uploadCV, getCVSuggestions };
