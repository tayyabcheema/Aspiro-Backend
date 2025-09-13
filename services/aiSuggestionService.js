const OpenAI = require('openai');

/**
 * AI Service for generating multiple-choice suggestions
 * Uses OpenAI API to generate contextual answers based on document content
 */
class AISuggestionService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Generate direct answer for a question based on document content
   * @param {string} questionText - The question text
   * @param {string} questionType - Type of question (skills, education, experience, etc.)
   * @param {Object} documentData - Structured data from parsed documents
   * @param {Array} existingOptions - Existing options if any
   * @returns {Promise<Object>} Generated direct answer
   */
  async generateDirectAnswer(questionText, questionType, documentData, existingOptions = []) {
    try {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
      }


      const prompt = this.buildPrompt(questionText, questionType, documentData, existingOptions);
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert career counselor and resume analyst. Provide direct, accurate answers based on the provided document content and question context. For multiple-choice questions, select the best matching option. For text questions, provide concise, relevant answers."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.7,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
      });

      const answer = this.parseDirectAnswer(response.choices[0].message.content, existingOptions);
      
      return {
        success: true,
        answer,
        metadata: {
          questionType,
          generatedAt: new Date().toISOString(),
          model: "gpt-4o-mini",
          tokenUsage: response.usage
        }
      };

    } catch (error) {
      console.error('Error generating AI suggestions:', error);
      return {
        success: false,
        error: error.message,
        answer: this.getFallbackAnswer(questionType, existingOptions),
        metadata: {
          questionType,
          generatedAt: new Date().toISOString(),
          fallback: true
        }
      };
    }
  }

  /**
   * Build prompt for OpenAI API
   * @param {string} questionText - Question text
   * @param {string} questionType - Question type
   * @param {Object} documentData - Document data
   * @param {Array} existingOptions - Existing options
   * @returns {string} Formatted prompt
   */
  buildPrompt(questionText, questionType, documentData, existingOptions) {
    const documentSummary = this.summarizeDocumentData(documentData);
    
    let prompt = `Based on the following resume/CV content, provide a DIRECT ANSWER for this question:

Question: "${questionText}"
Question Type: ${questionType}

Document Content Summary:
${documentSummary}

`;

    if (existingOptions.length > 0) {
      prompt += `Available Options: ${existingOptions.join(', ')}

IMPORTANT: You must select ONE option from the list above that best matches the document content.
- For multiple-choice questions: Choose the option that best fits the person's profile
- For yes/no questions: Answer "Yes" or "No" based on the document content
- For text questions: Provide a concise, relevant answer based on the document
- Use EXACTLY the same text as in the options list for multiple-choice questions
- Do not generate new options or variations

Please respond with ONLY the selected answer, nothing else.

Answer:`;
    } else {
      prompt += `Please provide a direct answer based on the document content.
- For yes/no questions: Answer "Yes" or "No"
- For text questions: Provide a concise, relevant answer
- Keep answers brief and professional

Answer:`;
    }

    return prompt;
  }

  /**
   * Summarize document data for AI processing
   * @param {Object} documentData - Structured document data
   * @returns {string} Summary text
   */
  summarizeDocumentData(documentData) {
    const summary = [];
    
    if (documentData.personalInfo?.name) {
      summary.push(`Name: ${documentData.personalInfo.name}`);
    }
    
    if (documentData.education?.length > 0) {
      summary.push(`Education: ${documentData.education.map(edu => `${edu.degree} in ${edu.field}`).join(', ')}`);
    }
    
    if (documentData.experience?.length > 0) {
      summary.push(`Experience: ${documentData.experience.map(exp => `${exp.title} at ${exp.company}`).join(', ')}`);
    }
    
    if (documentData.skills?.length > 0) {
      summary.push(`Skills: ${documentData.skills.join(', ')}`);
    }
    
    if (documentData.certifications?.length > 0) {
      summary.push(`Certifications: ${documentData.certifications.map(cert => cert.name).join(', ')}`);
    }
    
    if (documentData.projects?.length > 0) {
      summary.push(`Projects: ${documentData.projects.map(proj => proj.name).join(', ')}`);
    }

    return summary.join('\n');
  }

  /**
   * Parse AI response into direct answer
   * @param {string} aiResponse - Raw AI response
   * @param {Array} existingOptions - Existing options for validation
   * @returns {string} Direct answer
   */
  parseDirectAnswer(aiResponse, existingOptions = []) {
    // Clean the response to get the main answer
    const cleanResponse = aiResponse.trim().replace(/^["']|["']$/g, ''); // Remove quotes
    
    // Get the first line as the main answer
    const mainAnswer = cleanResponse.split('\n')[0].trim();
    
    // If we have existing options, validate the answer matches one of them
    if (existingOptions.length > 0) {
      const matchingOption = existingOptions.find(option => 
        option.toLowerCase() === mainAnswer.toLowerCase() ||
        option.toLowerCase().includes(mainAnswer.toLowerCase()) ||
        mainAnswer.toLowerCase().includes(option.toLowerCase())
      );
      
      if (matchingOption) {
        return matchingOption; // Return the exact option text
      }
    }
    
    return mainAnswer || 'Not specified';
  }

  /**
   * Get fallback answer when AI fails
   * @param {string} questionType - Question type
   * @param {Array} existingOptions - Existing options
   * @returns {string} Fallback answer
   */
  getFallbackAnswer(questionType, existingOptions = []) {
    // If we have existing options, return the first one as fallback
    if (existingOptions.length > 0) {
      return existingOptions[0];
    }
    
    // Otherwise return generic fallbacks
    const fallbackAnswers = {
      skills: 'Not specified',
      education: 'Not specified',
      experience: 'Not specified',
      career_goals: 'Not specified',
      general: 'Not specified'
    };

    return fallbackAnswers[questionType] || 'Not specified';
  }

  /**
   * Generate suggestions for multiple questions at once
   * @param {Array} questions - Array of question objects
   * @param {Object} documentData - Document data
   * @returns {Promise<Object>} Suggestions for all questions
   */
  async generateBulkSuggestions(questions, documentData) {
    const results = {};
    
    for (const question of questions) {
      try {
        const answer = await this.generateDirectAnswer(
          question.text,
          question.category || 'general',
          documentData,
          question.options || []
        );
        results[question._id] = answer;
      } catch (error) {
        console.error(`Error generating suggestions for question ${question._id}:`, error);
        results[question._id] = {
          success: false,
          error: error.message,
          answer: this.getFallbackAnswer(question.category || 'general', question.options || [])
        };
      }
    }
    
    return results;
  }

  /**
   * Analyze document content and suggest question mappings
   * @param {Object} documentData - Structured document data
   * @param {Array} questions - Available questions
   * @returns {Object} Mapping suggestions
   */
  analyzeDocumentMapping(documentData, questions) {
    const mappings = {
      autoFill: [],
      aiSuggestions: [],
      noMatch: []
    };

    for (const question of questions) {
      const questionType = this.determineQuestionType(question.text);
      const hasDirectMatch = this.hasDirectMatch(documentData, questionType);
      
      if (hasDirectMatch) {
        mappings.autoFill.push({
          questionId: question._id,
          questionText: question.text,
          questionType,
          confidence: this.calculateConfidence(documentData, questionType)
        });
      } else if (this.canGenerateSuggestions(questionType)) {
        mappings.aiSuggestions.push({
          questionId: question._id,
          questionText: question.text,
          questionType
        });
      } else {
        mappings.noMatch.push({
          questionId: question._id,
          questionText: question.text,
          questionType
        });
      }
    }

    return mappings;
  }

  /**
   * Determine question type from question text
   * @param {string} questionText - Question text
   * @returns {string} Question type
   */
  determineQuestionType(questionText) {
    const text = questionText.toLowerCase();
    
    if (text.includes('skill') || text.includes('programming') || text.includes('technology')) {
      return 'skills';
    } else if (text.includes('education') || text.includes('degree') || text.includes('university')) {
      return 'education';
    } else if (text.includes('experience') || text.includes('work') || text.includes('career')) {
      return 'experience';
    } else if (text.includes('goal') || text.includes('objective') || text.includes('aspiration')) {
      return 'career_goals';
    } else if (text.includes('certification') || text.includes('certificate')) {
      return 'certifications';
    } else if (text.includes('language')) {
      return 'languages';
    } else {
      return 'general';
    }
  }

  /**
   * Check if document has direct match for question type
   * @param {Object} documentData - Document data
   * @param {string} questionType - Question type
   * @returns {boolean} Has direct match
   */
  hasDirectMatch(documentData, questionType) {
    switch (questionType) {
      case 'skills':
        return documentData.skills && documentData.skills.length > 0;
      case 'education':
        return documentData.education && documentData.education.length > 0;
      case 'experience':
        return documentData.experience && documentData.experience.length > 0;
      case 'certifications':
        return documentData.certifications && documentData.certifications.length > 0;
      case 'languages':
        return documentData.languages && documentData.languages.length > 0;
      default:
        return false;
    }
  }

  /**
   * Calculate confidence score for auto-fill
   * @param {Object} documentData - Document data
   * @param {string} questionType - Question type
   * @returns {number} Confidence score (0-1)
   */
  calculateConfidence(documentData, questionType) {
    const data = documentData[questionType];
    if (!data || data.length === 0) return 0;
    
    // Higher confidence for more data points
    const dataCount = Array.isArray(data) ? data.length : 1;
    return Math.min(dataCount / 3, 1); // Max confidence at 3+ data points
  }

  /**
   * Check if AI can generate suggestions for question type
   * @param {string} questionType - Question type
   * @returns {boolean} Can generate suggestions
   */
  canGenerateSuggestions(questionType) {
    const supportedTypes = ['skills', 'education', 'experience', 'career_goals', 'certifications', 'languages', 'general'];
    return supportedTypes.includes(questionType);
  }
}

module.exports = AISuggestionService;
