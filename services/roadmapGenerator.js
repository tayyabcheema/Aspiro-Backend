const OpenAI = require('openai');
const Course = require('../models/Course');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Generate a personalized roadmap based on user responses
 * @param {Array} userResponses - Array of user responses from database
 * @returns {Promise<Object>} Generated roadmap with selected courses
 */
async function generateRoadmap(userResponses) {
  try {
    console.log('Starting roadmap generation process...');
    
    // Get all available courses
    const allCourses = await Course.find({ status: 'active' }).lean();
    
    if (allCourses.length === 0) {
      throw new Error('No active courses available in the database');
    }
    
    // Extract user profile data from responses
    const userProfile = extractUserProfile(userResponses);
    
    // Generate AI-powered course selection
    let selectedCourses = [];
    let aiMetadata = {
      model: 'gpt-4o-mini',
      processingTime: 0,
      confidence: 0,
      fallbackUsed: false
    };
    
    const startTime = Date.now();
    
    try {
      if (process.env.OPENAI_API_KEY) {
        selectedCourses = await generateAICourseSelection(userProfile, allCourses);
        aiMetadata.confidence = 0.85;
      } else {
        throw new Error('OpenAI API key not configured');
      }
    } catch (aiError) {
      console.warn('AI course selection failed, falling back to random selection:', aiError.message);
      selectedCourses = generateRandomCourseSelection(allCourses);
      aiMetadata.fallbackUsed = true;
      aiMetadata.confidence = 0.3;
    }
    
    aiMetadata.processingTime = Date.now() - startTime;
    
    // Generate roadmap structure
    const roadmap = generateRoadmapStructure(userProfile, selectedCourses);
    
    return {
      success: true,
      data: roadmap,
      metadata: aiMetadata
    };
    
  } catch (error) {
    console.error('Error generating roadmap:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Extract user profile information from responses
 * @param {Array} responses - User responses
 * @returns {Object} User profile data
 */
function extractUserProfile(responses) {
  const profile = {
    academicBackground: {},
    careerGoals: {},
    skills: [],
    interests: [],
    experience: {},
    challenges: [],
    preferences: {}
  };
  
  responses.forEach(response => {
    const questionText = response.questionText.toLowerCase();
    const answer = response.answer;
    
    // Academic background
    if (questionText.includes('level of study') || questionText.includes('current level')) {
      profile.academicBackground.level = answer;
    }
    
    if (questionText.includes('major') || questionText.includes('field of study')) {
      profile.academicBackground.major = answer;
    }
    
    if (questionText.includes('subjects') || questionText.includes('courses') || questionText.includes('enjoy')) {
      if (typeof answer === 'string' && !answer.includes('document does not')) {
        profile.interests.push(answer);
      }
    }
    
    // Career goals
    if (questionText.includes('career goal') || questionText.includes('long-term')) {
      profile.careerGoals.longTerm = answer;
    }
    
    if (questionText.includes('graduate') || questionText.includes('graduation')) {
      profile.careerGoals.graduationTimeline = answer;
    }
    
    // Work preferences
    if (questionText.includes('internship') || questionText.includes('part-time') || questionText.includes('volunteering')) {
      profile.preferences.openToInternships = answer === 'Yes';
    }
    
    // Challenges
    if (questionText.includes('setback') || questionText.includes('challenge')) {
      profile.challenges.push(answer);
    }
    
    // Networking
    if (questionText.includes('linkedin') || questionText.includes('professional platform')) {
      profile.preferences.usesLinkedIn = answer === 'Yes';
    }
    
    if (questionText.includes('mentorship') || questionText.includes('coaching')) {
      profile.preferences.interestedInMentorship = answer === 'Yes';
    }
    
    // CV content extraction
    if (response.questionType === 'upload' && response.files) {
      response.files.forEach(file => {
        if (file.type === 'cv' && file.textContent) {
          profile.cvContent = file.textContent.substring(0, 2000); // Limit CV content
        }
      });
    }
  });
  
  return profile;
}

/**
 * Generate AI-powered course selection
 * @param {Object} userProfile - User profile data
 * @param {Array} courses - Available courses
 * @returns {Promise<Array>} Selected courses with reasons
 */
async function generateAICourseSelection(userProfile, courses) {
  const prompt = buildCourseSelectionPrompt(userProfile, courses);
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a career guidance AI assistant. Based on the user's profile, select the 4 most relevant courses that will help them achieve their career goals. Consider their academic background, interests, career goals, and current skills.

Return your response as a JSON object with this exact structure:
{
  "selectedCourses": [
    {
      "courseId": "course_id_here",
      "reason": "Detailed explanation of why this course is recommended",
      "order": 1,
      "estimatedDuration": "4-6 weeks",
      "prerequisites": ["prerequisite1", "prerequisite2"]
    }
  ]
}

Only select exactly 4 courses and provide detailed reasons for each selection.`
      },
      {
        role: "user",
        content: prompt
      }
    ],
    max_tokens: 2000,
    temperature: 0.7
  });
  
  const aiResponse = response.choices[0]?.message?.content;
  
  if (!aiResponse) {
    throw new Error('No response from OpenAI');
  }
  
  try {
    const parsedResponse = JSON.parse(aiResponse);
    return parsedResponse.selectedCourses || [];
  } catch (parseError) {
    console.error('Error parsing AI response:', parseError);
    throw new Error('Invalid AI response format');
  }
}

/**
 * Build prompt for course selection
 * @param {Object} userProfile - User profile
 * @param {Array} courses - Available courses
 * @returns {string} Formatted prompt
 */
function buildCourseSelectionPrompt(userProfile, courses) {
  const coursesList = courses.map(course => 
    `ID: ${course._id}
Title: ${course.title}
Category: ${course.category}
Duration: ${course.durationWeeks} weeks
Price: $${course.price}
Description: ${course.description || 'No description available'}
---`
  ).join('\n');
  
  return `
User Profile:
- Academic Level: ${userProfile.academicBackground.level || 'Not specified'}
- Major/Field: ${userProfile.academicBackground.major || 'Not specified'}
- Interests: ${userProfile.interests.join(', ') || 'Not specified'}
- Career Goals: ${userProfile.careerGoals.longTerm || 'Not specified'}
- Graduation Timeline: ${userProfile.careerGoals.graduationTimeline || 'Not specified'}
- Open to Internships: ${userProfile.preferences.openToInternships ? 'Yes' : 'No'}
- Uses LinkedIn: ${userProfile.preferences.usesLinkedIn ? 'Yes' : 'No'}
- Interested in Mentorship: ${userProfile.preferences.interestedInMentorship ? 'Yes' : 'No'}
- Challenges: ${userProfile.challenges.join(', ') || 'None specified'}

CV Content (if available):
${userProfile.cvContent || 'No CV content available'}

Available Courses:
${coursesList}

Based on this information, select the 4 most relevant courses that will help this user achieve their career goals and develop necessary skills. Consider their current level, interests, and long-term objectives.`;
}

/**
 * Generate random course selection as fallback
 * @param {Array} courses - Available courses
 * @returns {Array} Randomly selected courses
 */
function generateRandomCourseSelection(courses) {
  const shuffled = courses.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 4).map((course, index) => ({
    courseId: course._id,
    reason: `This course is selected as part of your personalized learning journey. It covers ${course.category.toLowerCase()} topics that can benefit your career development.`,
    order: index + 1,
    estimatedDuration: `${course.durationWeeks} weeks`,
    prerequisites: []
  }));
}

/**
 * Generate roadmap structure
 * @param {Object} userProfile - User profile
 * @param {Array} selectedCourses - Selected courses with metadata
 * @returns {Object} Complete roadmap structure
 */
function generateRoadmapStructure(userProfile, selectedCourses) {
  const totalWeeks = selectedCourses.reduce((sum, course) => {
    const duration = parseInt(course.estimatedDuration) || 4;
    return sum + duration;
  }, 0);
  
  return {
    title: 'Personalized Career Roadmap',
    description: `Your personalized learning journey based on your ${userProfile.academicBackground.level || 'academic'} background in ${userProfile.academicBackground.major || 'your field'} and career goals.`,
    courses: selectedCourses,
    timeline: {
      totalDuration: `${totalWeeks}-${totalWeeks + 8} weeks`,
      milestones: generateMilestones(selectedCourses)
    },
    goals: {
      shortTerm: [
        'Complete foundational courses',
        'Build practical skills',
        'Create portfolio projects',
        'Network with industry professionals'
      ],
      longTerm: [
        userProfile.careerGoals.longTerm || 'Achieve career advancement',
        'Develop expertise in chosen field',
        'Build professional network',
        'Contribute to industry knowledge'
      ]
    },
    skills: generateSkillsList(userProfile, selectedCourses),
    status: 'generated',
    progress: 0
  };
}

/**
 * Generate milestones for the roadmap
 * @param {Array} courses - Selected courses
 * @returns {Array} Milestone objects
 */
function generateMilestones(courses) {
  const milestones = [];
  let currentDate = new Date();
  
  courses.forEach((course, index) => {
    const duration = parseInt(course.estimatedDuration) || 4;
    currentDate.setDate(currentDate.getDate() + (duration * 7));
    
    milestones.push({
      title: `Complete ${course.courseId ? 'Course' : 'Learning Module'} ${index + 1}`,
      description: `Finish the ${course.courseId ? 'course' : 'learning module'} and apply the knowledge gained.`,
      targetDate: new Date(currentDate),
      completed: false
    });
  });
  
  return milestones;
}

/**
 * Generate skills list based on user profile and selected courses
 * @param {Object} userProfile - User profile
 * @param {Array} courses - Selected courses
 * @returns {Array} Skills with current and target levels
 */
function generateSkillsList(userProfile, courses) {
  const commonSkills = [
    { name: 'Critical Thinking', level: 'beginner', targetLevel: 'intermediate' },
    { name: 'Communication', level: 'beginner', targetLevel: 'intermediate' },
    { name: 'Problem Solving', level: 'beginner', targetLevel: 'intermediate' },
    { name: 'Time Management', level: 'beginner', targetLevel: 'advanced' }
  ];
  
  // Add field-specific skills based on major
  if (userProfile.academicBackground.major) {
    const major = userProfile.academicBackground.major.toLowerCase();
    
    if (major.includes('computer') || major.includes('engineering') || major.includes('technology')) {
      commonSkills.push(
        { name: 'Programming', level: 'beginner', targetLevel: 'intermediate' },
        { name: 'Data Analysis', level: 'beginner', targetLevel: 'intermediate' }
      );
    } else if (major.includes('business') || major.includes('management')) {
      commonSkills.push(
        { name: 'Project Management', level: 'beginner', targetLevel: 'intermediate' },
        { name: 'Leadership', level: 'beginner', targetLevel: 'intermediate' }
      );
    }
  }
  
  return commonSkills;
}

module.exports = {
  generateRoadmap
};
