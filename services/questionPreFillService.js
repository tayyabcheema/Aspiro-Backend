const DocumentParser = require('./documentParser');
const AISuggestionService = require('./aiSuggestionService');

/**
 * Intelligent Question Pre-filling Service
 * Combines document parsing and AI suggestions to automatically fill questions
 */
class QuestionPreFillService {
  constructor() {
    this.documentParser = new DocumentParser();
    this.aiService = new AISuggestionService();
  }

  /**
   * Process uploaded documents and generate pre-filled answers for questions
   * @param {Array} uploadedFiles - Array of uploaded files
   * @param {Array} questions - Array of questions to pre-fill
   * @returns {Promise<Object>} Pre-fill results
   */
  async processDocumentsAndPreFill(uploadedFiles, questions) {
    try {

      // Step 1: Parse all documents
      const parsedDocuments = await this.parseAllDocuments(uploadedFiles);
      
      // Step 2: Combine document data
      const combinedDocumentData = this.combineDocumentData(parsedDocuments);
      
      // Step 3: Analyze question mappings
      const questionMappings = this.aiService.analyzeDocumentMapping(combinedDocumentData, questions);
      
      // Step 4: Generate pre-filled answers
      const preFilledAnswers = await this.generatePreFilledAnswers(
        questions,
        combinedDocumentData,
        questionMappings
      );

      return {
        success: true,
        data: {
          parsedDocuments,
          combinedDocumentData,
          questionMappings,
          preFilledAnswers
        },
        metadata: {
          processedAt: new Date().toISOString(),
          documentsProcessed: uploadedFiles.length,
          questionsProcessed: questions.length,
          autoFillCount: questionMappings.autoFill.length,
          aiSuggestionsCount: questionMappings.aiSuggestions.length,
          noMatchCount: questionMappings.noMatch.length
        }
      };

    } catch (error) {
      console.error('Error processing documents and pre-filling questions:', error);
      return {
        success: false,
        error: error.message,
        data: null,
        metadata: {
          processedAt: new Date().toISOString(),
          error: true
        }
      };
    }
  }

  /**
   * Parse all uploaded documents
   * @param {Array} uploadedFiles - Array of uploaded files
   * @returns {Promise<Array>} Parsed documents
   */
  async parseAllDocuments(uploadedFiles) {
    const parsedDocuments = [];
    
    for (const file of uploadedFiles) {
      try {
        const result = await this.documentParser.parseDocument(file.path, file.mimetype);
        parsedDocuments.push({
          ...result,
          originalFile: {
            name: file.originalname,
            size: file.size,
            mimetype: file.mimetype
          }
        });
      } catch (error) {
        console.error(`Error parsing document ${file.originalname}:`, error);
        parsedDocuments.push({
          success: false,
          error: error.message,
          originalFile: {
            name: file.originalname,
            size: file.size,
            mimetype: file.mimetype
          }
        });
      }
    }
    
    return parsedDocuments;
  }

  /**
   * Combine data from multiple documents
   * @param {Array} parsedDocuments - Array of parsed documents
   * @returns {Object} Combined document data
   */
  combineDocumentData(parsedDocuments) {
    const combinedData = {
      personalInfo: {},
      education: [],
      experience: [],
      skills: [],
      certifications: [],
      languages: [],
      projects: [],
      achievements: [],
      contactInfo: {},
      objective: '',
      summary: ''
    };

    for (const doc of parsedDocuments) {
      if (!doc.success || !doc.structuredData) continue;

      const data = doc.structuredData;

      // Merge personal info (take first non-empty value)
      Object.keys(data.personalInfo || {}).forEach(key => {
        if (data.personalInfo[key] && !combinedData.personalInfo[key]) {
          combinedData.personalInfo[key] = data.personalInfo[key];
        }
      });

      // Merge arrays (avoid duplicates)
      ['education', 'experience', 'skills', 'certifications', 'languages', 'projects', 'achievements'].forEach(field => {
        if (data[field] && Array.isArray(data[field])) {
          data[field].forEach(item => {
            if (!this.isDuplicate(combinedData[field], item)) {
              combinedData[field].push(item);
            }
          });
        }
      });

      // Merge contact info
      Object.keys(data.contactInfo || {}).forEach(key => {
        if (data.contactInfo[key] && !combinedData.contactInfo[key]) {
          combinedData.contactInfo[key] = data.contactInfo[key];
        }
      });

      // Use first non-empty objective/summary
      if (data.objective && !combinedData.objective) {
        combinedData.objective = data.objective;
      }
      if (data.summary && !combinedData.summary) {
        combinedData.summary = data.summary;
      }
    }

    return combinedData;
  }

  /**
   * Check if item is duplicate in array
   * @param {Array} array - Array to check
   * @param {Object} item - Item to check
   * @returns {boolean} Is duplicate
   */
  isDuplicate(array, item) {
    if (typeof item === 'string') {
      return array.includes(item);
    }
    
    // For objects, check if any existing item has same key properties
    return array.some(existing => {
      if (typeof existing === 'string') return false;
      
      // Check common key properties
      const keys = ['name', 'title', 'degree', 'company'];
      return keys.some(key => 
        existing[key] && item[key] && 
        existing[key].toLowerCase() === item[key].toLowerCase()
      );
    });
  }

  /**
   * Generate pre-filled answers for all questions
   * @param {Array} questions - Questions to pre-fill
   * @param {Object} documentData - Combined document data
   * @param {Object} questionMappings - Question mappings
   * @returns {Promise<Object>} Pre-filled answers
   */
  async generatePreFilledAnswers(questions, documentData, questionMappings) {
    const preFilledAnswers = {};

    // Process auto-fill questions
    for (const mapping of questionMappings.autoFill) {
      const question = questions.find(q => q._id.toString() === mapping.questionId.toString());
      if (question) {
        preFilledAnswers[mapping.questionId.toString()] = await this.generateAutoFillAnswer(
          question,
          documentData,
          mapping.questionType
        );
      }
    }

    // Process AI suggestion questions
    for (const mapping of questionMappings.aiSuggestions) {
      const question = questions.find(q => q._id.toString() === mapping.questionId.toString());
      if (question) {
        preFilledAnswers[mapping.questionId.toString()] = await this.generateAISuggestions(
          question,
          documentData,
          mapping.questionType
        );
      }
    }

    return preFilledAnswers;
  }

  /**
   * Generate auto-fill answer for a question
   * @param {Object} question - Question object
   * @param {Object} documentData - Document data
   * @param {string} questionType - Question type
   * @returns {Promise<Object>} Auto-fill answer
   */
  async generateAutoFillAnswer(question, documentData, questionType) {
    try {
      let answer = null;
      let confidence = 0;

      switch (questionType) {
        case 'skills':
          if (documentData.skills && documentData.skills.length > 0) {
            // For multiple-choice skills questions, select the first matching skill
            if (question.type === 'multiple-choice' && question.options) {
              const matchingSkill = documentData.skills.find(skill => 
                question.options.some(option => 
                  option.toLowerCase().includes(skill.toLowerCase()) ||
                  skill.toLowerCase().includes(option.toLowerCase())
                )
              );
              if (matchingSkill) {
                answer = question.options.find(option => 
                  option.toLowerCase().includes(matchingSkill.toLowerCase()) ||
                  matchingSkill.toLowerCase().includes(option.toLowerCase())
                );
                confidence = 0.9;
              }
            } else {
              // For text questions, use the skills list
              answer = documentData.skills.join(', ');
              confidence = 0.8;
            }
          }
          break;

        case 'education':
          if (documentData.education && documentData.education.length > 0) {
            const education = documentData.education[0]; // Use highest/most recent
            if (question.type === 'multiple-choice' && question.options) {
              const matchingDegree = question.options.find(option => 
                option.toLowerCase().includes(education.degree.toLowerCase()) ||
                education.degree.toLowerCase().includes(option.toLowerCase())
              );
              if (matchingDegree) {
                answer = matchingDegree;
                confidence = 0.9;
              }
            } else {
              answer = `${education.degree} in ${education.field}`;
              confidence = 0.8;
            }
          }
          break;

        case 'experience':
          if (documentData.experience && documentData.experience.length > 0) {
            const experience = documentData.experience[0]; // Use most recent
            if (question.type === 'multiple-choice' && question.options) {
              const matchingExperience = question.options.find(option => 
                option.toLowerCase().includes(experience.title.toLowerCase()) ||
                experience.title.toLowerCase().includes(option.toLowerCase())
              );
              if (matchingExperience) {
                answer = matchingExperience;
                confidence = 0.9;
              }
            } else {
              answer = `${experience.title} at ${experience.company}`;
              confidence = 0.8;
            }
          }
          break;

        case 'certifications':
          if (documentData.certifications && documentData.certifications.length > 0) {
            const certification = documentData.certifications[0];
            if (question.type === 'multiple-choice' && question.options) {
              const matchingCert = question.options.find(option => 
                option.toLowerCase().includes(certification.name.toLowerCase()) ||
                certification.name.toLowerCase().includes(option.toLowerCase())
              );
              if (matchingCert) {
                answer = matchingCert;
                confidence = 0.9;
              }
            } else {
              answer = certification.name;
              confidence = 0.8;
            }
          }
          break;

        case 'languages':
          if (documentData.languages && documentData.languages.length > 0) {
            if (question.type === 'multiple-choice' && question.options) {
              const matchingLanguage = documentData.languages.find(lang => 
                question.options.some(option => 
                  option.toLowerCase().includes(lang.toLowerCase()) ||
                  lang.toLowerCase().includes(option.toLowerCase())
                )
              );
              if (matchingLanguage) {
                answer = question.options.find(option => 
                  option.toLowerCase().includes(matchingLanguage.toLowerCase()) ||
                  matchingLanguage.toLowerCase().includes(option.toLowerCase())
                );
                confidence = 0.9;
              }
            } else {
              answer = documentData.languages.join(', ');
              confidence = 0.8;
            }
          }
          break;
      }

      return {
        type: 'auto-fill',
        answer,
        confidence,
        source: 'document-parsing',
        metadata: {
          questionType,
          questionText: question.text,
          generatedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error(`Error generating auto-fill answer for question ${question._id}:`, error);
      return {
        type: 'auto-fill',
        answer: null,
        confidence: 0,
        source: 'document-parsing',
        error: error.message,
        metadata: {
          questionType,
          questionText: question.text,
          generatedAt: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Generate AI suggestions for a question
   * @param {Object} question - Question object
   * @param {Object} documentData - Document data
   * @param {string} questionType - Question type
   * @returns {Promise<Object>} AI suggestions
   */
  async generateAISuggestions(question, documentData, questionType) {
    try {
      const aiResult = await this.aiService.generateDirectAnswer(
        question.text,
        questionType,
        documentData,
        question.options || []
      );

      return {
        type: 'ai-suggestions',
        answer: aiResult.answer,
        confidence: aiResult.success ? 0.7 : 0.3,
        source: 'ai-generation',
        metadata: {
          questionType,
          questionText: question.text,
          generatedAt: new Date().toISOString(),
          aiMetadata: aiResult.metadata
        }
      };

    } catch (error) {
      console.error(`Error generating AI answer for question ${question._id}:`, error);
      return {
        type: 'ai-suggestions',
        answer: this.aiService.getFallbackAnswer(questionType, question.options || []),
        confidence: 0.3,
        source: 'ai-generation',
        error: error.message,
        metadata: {
          questionType,
          questionText: question.text,
          generatedAt: new Date().toISOString(),
          fallback: true
        }
      };
    }
  }

  /**
   * Get pre-fill summary for admin logging
   * @param {Object} preFillResults - Pre-fill results
   * @returns {Object} Summary for admin
   */
  getPreFillSummary(preFillResults) {
    if (!preFillResults.success) {
      return {
        success: false,
        error: preFillResults.error,
        summary: 'Pre-fill processing failed'
      };
    }

    const { questionMappings, preFilledAnswers } = preFillResults.data;
    
    const summary = {
      success: true,
      totalQuestions: Object.keys(preFilledAnswers).length,
      autoFillQuestions: questionMappings.autoFill.length,
      aiSuggestionQuestions: questionMappings.aiSuggestions.length,
      noMatchQuestions: questionMappings.noMatch.length,
      autoFillSuccessRate: 0,
      aiSuggestionSuccessRate: 0,
      details: {
        autoFill: questionMappings.autoFill.map(mapping => ({
          questionId: mapping.questionId,
          questionText: mapping.questionText,
          questionType: mapping.questionType,
          confidence: mapping.confidence,
          hasAnswer: !!preFilledAnswers[mapping.questionId]?.answer
        })),
        aiSuggestions: questionMappings.aiSuggestions.map(mapping => ({
          questionId: mapping.questionId,
          questionText: mapping.questionText,
          questionType: mapping.questionType,
          hasAnswer: !!preFilledAnswers[mapping.questionId]?.answer
        })),
        noMatch: questionMappings.noMatch.map(mapping => ({
          questionId: mapping.questionId,
          questionText: mapping.questionText,
          questionType: mapping.questionType
        }))
      }
    };

    // Calculate success rates
    const autoFillWithAnswers = summary.details.autoFill.filter(item => item.hasAnswer).length;
    summary.autoFillSuccessRate = questionMappings.autoFill.length > 0 
      ? (autoFillWithAnswers / questionMappings.autoFill.length) * 100 
      : 0;

    const aiSuggestionsWithAnswers = summary.details.aiSuggestions.filter(item => item.hasAnswer).length;
    summary.aiSuggestionSuccessRate = questionMappings.aiSuggestions.length > 0 
      ? (aiSuggestionsWithAnswers / questionMappings.aiSuggestions.length) * 100 
      : 0;

    return summary;
  }
}

module.exports = QuestionPreFillService;
