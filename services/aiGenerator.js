const OpenAI = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Generate AI suggestions for questions based on CV content
 * @param {string} cvText - Extracted CV text
 * @param {Object} question - Question object from database
 * @returns {Promise<Array>} Array of 4-8 multiple-choice suggestions
 */
async function generateAISuggestions(cvText, question) {
  try {
    console.log(`Generating AI suggestions for question: ${question.text}`);
    
    if (!process.env.OPENAI_API_KEY) {
      console.warn('OpenAI API key not configured, returning default suggestions');
      return generateDefaultSuggestions(question);
    }

    // Truncate CV text to fit within token limits
    const truncatedCVText = cvText.substring(0, 3000);
    
    const prompt = buildPrompt(truncatedCVText, question);
    
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a career guidance AI assistant. Generate relevant multiple-choice options based on the CV content and question context. Always provide 4-8 options that are realistic and relevant to the person's background."
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

    const aiResponse = response.choices[0]?.message?.content;
    
    if (!aiResponse) {
      throw new Error('No response from OpenAI');
    }

    // Parse the AI response to extract options
    const suggestions = parseAISuggestions(aiResponse);
    
    // Validate and clean suggestions
    const cleanedSuggestions = cleanSuggestions(suggestions, question);
    
    console.log(`Generated ${cleanedSuggestions.length} AI suggestions`);
    return cleanedSuggestions;

  } catch (error) {
    console.error('Error generating AI suggestions:', error);
    
    // Fallback to default suggestions if AI fails
    return generateDefaultSuggestions(question);
  }
}

/**
 * Build prompt for OpenAI API
 */
function buildPrompt(cvText, question) {
  const questionContext = `
Question: "${question.text}"
Question Type: ${question.type}
Category: ${question.category}
Step: ${question.step.stepName}

CV Content:
${cvText}

Based on the CV content above, generate 4-8 relevant multiple-choice options for this question. The options should be:
1. Relevant to the person's background and experience
2. Realistic and achievable
3. Varied in scope and difficulty
4. Professional and appropriate

Format your response as a numbered list of options, one per line.
Example:
1. Option 1
2. Option 2
3. Option 3
4. Option 4
`;

  return questionContext;
}

/**
 * Parse AI response to extract suggestions
 */
function parseAISuggestions(aiResponse) {
  const suggestions = [];
  
  // Split by lines and extract numbered options
  const lines = aiResponse.split('\n');
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Match numbered list items (1., 2., etc.)
    const match = trimmedLine.match(/^\d+\.\s*(.+)$/);
    if (match) {
      suggestions.push(match[1].trim());
    }
    // Also match lines that start with bullet points or dashes
    else if (trimmedLine.match(/^[-•*]\s*(.+)$/)) {
      const bulletMatch = trimmedLine.match(/^[-•*]\s*(.+)$/);
      if (bulletMatch) {
        suggestions.push(bulletMatch[1].trim());
      }
    }
    // Match lines that look like options without numbering
    else if (trimmedLine.length > 5 && trimmedLine.length < 100 && !trimmedLine.includes(':')) {
      suggestions.push(trimmedLine);
    }
  }
  
  return suggestions;
}

/**
 * Clean and validate suggestions
 */
function cleanSuggestions(suggestions, question) {
  const cleaned = suggestions
    .filter(suggestion => {
      // Filter out empty or too short suggestions
      return suggestion && suggestion.trim().length > 3 && suggestion.trim().length < 150;
    })
    .map(suggestion => {
      // Clean up common formatting issues
      return suggestion
        .replace(/^[-•*]\s*/, '') // Remove bullet points
        .replace(/^\d+\.\s*/, '') // Remove numbering
        .trim();
    })
    .filter(suggestion => {
      // Remove duplicates
      return suggestion.length > 0;
    })
    .slice(0, 8); // Limit to 8 suggestions

  // Ensure we have at least 4 suggestions
  if (cleaned.length < 4) {
    const defaultSuggestions = generateDefaultSuggestions(question);
    return [...cleaned, ...defaultSuggestions].slice(0, 8);
  }

  return cleaned;
}

/**
 * Generate default suggestions when AI fails
 */
function generateDefaultSuggestions(question) {
  const questionText = question.text.toLowerCase();
  const category = question.category.toLowerCase();
  
  // Default suggestions based on question type and category
  if (questionText.includes('skill') || questionText.includes('technology')) {
    return [
      'JavaScript/TypeScript',
      'Python',
      'React/Vue/Angular',
      'Node.js/Express',
      'SQL/Database Management',
      'AWS/Cloud Computing',
      'Machine Learning/AI',
      'DevOps/Docker'
    ];
  }
  
  if (questionText.includes('experience') || questionText.includes('years')) {
    return [
      '0-1 years',
      '1-3 years',
      '3-5 years',
      '5-10 years',
      '10+ years'
    ];
  }
  
  if (questionText.includes('education') || questionText.includes('degree')) {
    return [
      'High School Diploma',
      'Associate Degree',
      'Bachelor\'s Degree',
      'Master\'s Degree',
      'PhD/Doctorate',
      'Professional Certification',
      'Bootcamp/Coding School',
      'Self-taught'
    ];
  }
  
  if (questionText.includes('certification')) {
    return [
      'AWS Certified Solutions Architect',
      'Google Cloud Professional',
      'Microsoft Azure Certification',
      'PMP Project Management',
      'Scrum Master Certification',
      'CompTIA Security+',
      'Cisco CCNA',
      'No certifications yet'
    ];
  }
  
  if (questionText.includes('career') || questionText.includes('goal')) {
    return [
      'Software Developer',
      'Data Scientist',
      'DevOps Engineer',
      'Product Manager',
      'UX/UI Designer',
      'Machine Learning Engineer',
      'Cloud Architect',
      'Technical Lead'
    ];
  }
  
  // Generic fallback
  return [
    'Beginner',
    'Intermediate',
    'Advanced',
    'Expert',
    'Not applicable',
    'Prefer not to answer',
    'Other',
    'Need more information'
  ];
}

module.exports = generateAISuggestions;
