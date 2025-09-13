const natural = require('natural');

/**
 * Extract structured data from CV text
 * @param {string} text - Raw extracted text from CV
 * @returns {Promise<Object>} Structured data object
 */
async function extractStructuredData(text) {
  try {
    console.log('Extracting structured data from text...');
    
    const structuredData = {
      skills: [],
      education: [],
      experience: [],
      certifications: [],
      totalExperience: null,
      contactInfo: {}
    };

    // Normalize text for processing
    const normalizedText = normalizeText(text);
    
    // Extract different sections
    structuredData.skills = extractSkills(normalizedText);
    structuredData.education = extractEducation(normalizedText);
    structuredData.experience = extractExperience(normalizedText);
    structuredData.certifications = extractCertifications(normalizedText);
    structuredData.totalExperience = extractTotalExperience(normalizedText);
    structuredData.contactInfo = extractContactInfo(normalizedText);

    console.log('Structured data extracted:', {
      skillsCount: structuredData.skills.length,
      educationCount: structuredData.education.length,
      experienceCount: structuredData.experience.length,
      certificationsCount: structuredData.certifications.length
    });

    return structuredData;

  } catch (error) {
    console.error('Error extracting structured data:', error);
    throw new Error(`Failed to extract structured data: ${error.message}`);
  }
}

/**
 * Normalize text for better processing
 */
function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s.,;:!?@#$%&*()\-+=\[\]{}|\\:";'<>.,?\/]/g, ' ')
    .trim();
}

/**
 * Extract technical skills from text
 */
function extractSkills(text) {
  const skills = new Set();
  
  // Common technical skills patterns
  const skillPatterns = [
    // Programming languages
    /\b(javascript|js|typescript|ts|python|java|c\+\+|c#|php|ruby|go|rust|swift|kotlin|scala|r|matlab|sql|html|css|sass|scss|less)\b/g,
    
    // Frameworks and libraries
    /\b(react|vue|angular|node\.?js|express|django|flask|spring|laravel|rails|asp\.net|jquery|bootstrap|tailwind|material-ui|redux|mobx|next\.js|nuxt\.js|gatsby)\b/g,
    
    // Databases
    /\b(mysql|postgresql|mongodb|redis|elasticsearch|sqlite|oracle|sql server|dynamodb|cassandra|neo4j)\b/g,
    
    // Cloud platforms
    /\b(aws|azure|gcp|google cloud|docker|kubernetes|terraform|jenkins|gitlab|github|ci\/cd|devops)\b/g,
    
    // AI/ML
    /\b(machine learning|ml|artificial intelligence|ai|deep learning|neural networks|tensorflow|pytorch|scikit-learn|pandas|numpy|opencv|nlp|natural language processing)\b/g,
    
    // Tools and technologies
    /\b(git|linux|unix|bash|shell|powershell|vim|emacs|vscode|intellij|eclipse|postman|insomnia|figma|sketch|adobe|photoshop|illustrator)\b/g
  ];

  skillPatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        // Clean up the match
        const cleanMatch = match.replace(/[^\w\s]/g, '').trim();
        if (cleanMatch.length > 1) {
          skills.add(cleanMatch);
        }
      });
    }
  });

  // Additional skill extraction using keywords
  const skillKeywords = [
    'programming', 'coding', 'development', 'software engineering',
    'web development', 'mobile development', 'frontend', 'backend',
    'full stack', 'data analysis', 'data science', 'analytics',
    'project management', 'agile', 'scrum', 'testing', 'qa',
    'ui/ux', 'design', 'graphic design', 'user experience'
  ];

  skillKeywords.forEach(keyword => {
    if (text.includes(keyword)) {
      skills.add(keyword);
    }
  });

  return Array.from(skills).slice(0, 20); // Limit to 20 skills
}

/**
 * Extract education information
 */
function extractEducation(text) {
  const education = [];
  
  // Education patterns
  const degreePatterns = [
    /\b(bachelor|b\.?s\.?|master|m\.?s\.?|phd|doctorate|associate|diploma|certificate)\b.*?(?:in|of|from)\s*([^,.\n]+)/gi,
    /\b([^,.\n]*(?:university|college|institute|school)[^,.\n]*)\b.*?(?:bachelor|master|phd|degree)/gi
  ];

  degreePatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const cleanMatch = match.trim();
        if (cleanMatch.length > 10) {
          education.push({
            degree: extractDegree(cleanMatch),
            institution: extractInstitution(cleanMatch),
            raw: cleanMatch
          });
        }
      });
    }
  });

  return education.slice(0, 5); // Limit to 5 education entries
}

/**
 * Extract work experience
 */
function extractExperience(text) {
  const experience = [];
  
  // Experience patterns
  const experiencePatterns = [
    /\b(?:worked|experience|position|role|job|employed)\s+(?:as|at|in)\s+([^,.\n]+)/gi,
    /\b([^,.\n]+)\s+(?:at|in)\s+([^,.\n]+)/gi
  ];

  experiencePatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const cleanMatch = match.trim();
        if (cleanMatch.length > 5) {
          const parts = cleanMatch.split(/\s+(?:at|in)\s+/);
          if (parts.length >= 2) {
            experience.push({
              role: parts[0].trim(),
              company: parts[1].trim(),
              raw: cleanMatch
            });
          }
        }
      });
    }
  });

  return experience.slice(0, 10); // Limit to 10 experience entries
}

/**
 * Extract certifications
 */
function extractCertifications(text) {
  const certifications = new Set();
  
  // Certification patterns
  const certPatterns = [
    /\b(certified|certification|certificate)\s+([^,.\n]+)/gi,
    /\b([^,.\n]*(?:aws|azure|google|microsoft|cisco|comptia|pmp|scrum|agile)[^,.\n]*certification?[^,.\n]*)\b/gi
  ];

  certPatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const cleanMatch = match.replace(/\b(certified|certification|certificate)\b/gi, '').trim();
        if (cleanMatch.length > 3) {
          certifications.add(cleanMatch);
        }
      });
    }
  });

  return Array.from(certifications).slice(0, 10); // Limit to 10 certifications
}

/**
 * Extract total years of experience
 */
function extractTotalExperience(text) {
  const experiencePatterns = [
    /\b(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s*)?(?:experience|exp)/gi,
    /\b(?:experience|exp):\s*(\d+)\+?\s*(?:years?|yrs?)/gi
  ];

  for (const pattern of experiencePatterns) {
    const matches = text.match(pattern);
    if (matches) {
      const years = matches.map(match => {
        const yearMatch = match.match(/(\d+)/);
        return yearMatch ? parseInt(yearMatch[1]) : 0;
      });
      
      if (years.length > 0) {
        return Math.max(...years).toString();
      }
    }
  }

  return null;
}

/**
 * Extract contact information
 */
function extractContactInfo(text) {
  const contactInfo = {};
  
  // Email
  const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
  if (emailMatch) {
    contactInfo.email = emailMatch[0];
  }
  
  // Phone
  const phoneMatch = text.match(/\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/);
  if (phoneMatch) {
    contactInfo.phone = phoneMatch[0];
  }
  
  // LinkedIn
  const linkedinMatch = text.match(/linkedin\.com\/in\/[A-Za-z0-9-]+/);
  if (linkedinMatch) {
    contactInfo.linkedin = linkedinMatch[0];
  }

  return contactInfo;
}

/**
 * Extract degree from education text
 */
function extractDegree(text) {
  const degreePatterns = [
    /\b(bachelor|b\.?s\.?|master|m\.?s\.?|phd|doctorate|associate|diploma|certificate)\b/gi
  ];
  
  for (const pattern of degreePatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0].toLowerCase();
    }
  }
  
  return 'degree';
}

/**
 * Extract institution from education text
 */
function extractInstitution(text) {
  const institutionPatterns = [
    /\b([A-Z][^,.\n]*(?:university|college|institute|school)[^,.\n]*)\b/gi
  ];
  
  for (const pattern of institutionPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }
  
  return 'institution';
}

module.exports = extractStructuredData;
