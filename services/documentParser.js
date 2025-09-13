const fs = require("fs");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const Tesseract = require("tesseract.js");
const sharp = require("sharp");
const path = require("path");

/**
 * Document Parser Service
 * Extracts structured data from CVs and supporting documents
 * Supports PDF, Word, and image formats with OCR
 */

class DocumentParser {
  constructor() {
    this.supportedFormats = {
      pdf: ["application/pdf"],
      word: [
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword"
      ],
      image: ["image/jpeg", "image/png", "image/tiff", "image/bmp"],
      text: ["text/plain"]
    };
  }

  /**
   * Main parsing function - determines file type and routes to appropriate parser
   * @param {string} filePath - Path to the uploaded file
   * @param {string} mimetype - MIME type of the file
   * @returns {Promise<Object>} Structured data extracted from document
   */
  async parseDocument(filePath, mimetype) {
    try {
      console.log(`Parsing document: ${path.basename(filePath)} (${mimetype})`);
      
      let rawText = "";
      let documentType = this.determineDocumentType(filePath, mimetype);

      // Extract raw text based on file type
      if (this.supportedFormats.pdf.includes(mimetype)) {
        rawText = await this.extractFromPDF(filePath);
      } else if (this.supportedFormats.word.includes(mimetype)) {
        rawText = await this.extractFromWord(filePath);
      } else if (this.supportedFormats.image.includes(mimetype)) {
        rawText = await this.extractFromImage(filePath);
      } else if (this.supportedFormats.text.includes(mimetype)) {
        rawText = await this.extractFromText(filePath);
      } else {
        throw new Error(`Unsupported file format: ${mimetype}`);
      }

      if (!rawText || rawText.trim().length === 0) {
        throw new Error("No text content could be extracted from the document");
      }

      // Parse structured data from raw text
      const structuredData = await this.parseStructuredData(rawText, documentType);
      
      console.log(`Successfully parsed document: ${path.basename(filePath)}`);
      return {
        success: true,
        documentType,
        rawText: rawText.substring(0, 1000) + "...", // Truncate for storage
        structuredData,
        metadata: {
          filePath: path.basename(filePath),
          mimetype,
          textLength: rawText.length,
          parsedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error(`Error parsing document ${filePath}:`, error);
      return {
        success: false,
        error: error.message,
        documentType: this.determineDocumentType(filePath, mimetype),
        metadata: {
          filePath: path.basename(filePath),
          mimetype,
          parsedAt: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Extract text from PDF files
   * @param {string} filePath - Path to PDF file
   * @returns {Promise<string>} Extracted text
   */
  async extractFromPDF(filePath) {
    try {
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      return data.text.trim();
    } catch (error) {
      console.error("Error extracting from PDF:", error);
      throw new Error("Failed to extract text from PDF");
    }
  }

  /**
   * Extract text from Word documents
   * @param {string} filePath - Path to Word file
   * @returns {Promise<string>} Extracted text
   */
  async extractFromWord(filePath) {
    try {
      const buffer = fs.readFileSync(filePath);
      const result = await mammoth.extractRawText({ buffer });
      return result.value.trim();
    } catch (error) {
      console.error("Error extracting from Word:", error);
      throw new Error("Failed to extract text from Word document");
    }
  }

  /**
   * Extract text from images using OCR
   * @param {string} filePath - Path to image file
   * @returns {Promise<string>} Extracted text
   */
  async extractFromImage(filePath) {
    try {
      // Preprocess image for better OCR results
      const processedImagePath = await this.preprocessImage(filePath);
      
      // Perform OCR
      const { data: { text } } = await Tesseract.recognize(
        processedImagePath,
        'eng',
        {
          logger: m => console.log(m) // Optional: log OCR progress
        }
      );

      // Clean up processed image
      if (processedImagePath !== filePath) {
        fs.unlinkSync(processedImagePath);
      }

      return text.trim();
    } catch (error) {
      console.error("Error extracting from image:", error);
      throw new Error("Failed to extract text from image using OCR");
    }
  }

  /**
   * Extract text from plain text files
   * @param {string} filePath - Path to text file
   * @returns {Promise<string>} Extracted text
   */
  async extractFromText(filePath) {
    try {
      const buffer = fs.readFileSync(filePath);
      return buffer.toString("utf-8").trim();
    } catch (error) {
      console.error("Error extracting from text file:", error);
      throw new Error("Failed to extract text from text file");
    }
  }

  /**
   * Preprocess image for better OCR results
   * @param {string} filePath - Path to original image
   * @returns {Promise<string>} Path to processed image
   */
  async preprocessImage(filePath) {
    try {
      const processedPath = filePath.replace(/\.[^/.]+$/, "_processed.png");
      
      await sharp(filePath)
        .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
        .grayscale()
        .normalize()
        .sharpen()
        .png()
        .toFile(processedPath);

      return processedPath;
    } catch (error) {
      console.error("Error preprocessing image:", error);
      return filePath; // Return original if preprocessing fails
    }
  }

  /**
   * Determine document type based on filename and content
   * @param {string} filePath - Path to file
   * @param {string} mimetype - MIME type
   * @returns {string} Document type
   */
  determineDocumentType(filePath, mimetype) {
    const filename = path.basename(filePath).toLowerCase();
    
    if (filename.includes('cv') || filename.includes('resume')) {
      return 'cv';
    } else if (filename.includes('cover') || filename.includes('letter')) {
      return 'cover-letter';
    } else if (filename.includes('certificate') || filename.includes('cert')) {
      return 'certificate';
    } else if (filename.includes('transcript') || filename.includes('marksheet')) {
      return 'transcript';
    } else if (filename.includes('experience') || filename.includes('exp')) {
      return 'experience-letter';
    } else {
      return 'other';
    }
  }

  /**
   * Parse structured data from raw text using pattern matching and AI
   * @param {string} rawText - Raw text content
   * @param {string} documentType - Type of document
   * @returns {Promise<Object>} Structured data
   */
  async parseStructuredData(rawText, documentType) {
    const structuredData = {
      personalInfo: this.extractPersonalInfo(rawText),
      education: this.extractEducation(rawText),
      experience: this.extractExperience(rawText),
      skills: this.extractSkills(rawText),
      certifications: this.extractCertifications(rawText),
      languages: this.extractLanguages(rawText),
      projects: this.extractProjects(rawText),
      achievements: this.extractAchievements(rawText),
      contactInfo: this.extractContactInfo(rawText)
    };

    // Add document-specific fields
    if (documentType === 'cv' || documentType === 'resume') {
      structuredData.objective = this.extractObjective(rawText);
      structuredData.summary = this.extractSummary(rawText);
    }

    return structuredData;
  }

  /**
   * Extract personal information
   * @param {string} text - Raw text
   * @returns {Object} Personal info
   */
  extractPersonalInfo(text) {
    const info = {};
    
    // Name extraction (usually at the beginning)
    const nameMatch = text.match(/^([A-Z][a-z]+ [A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/m);
    if (nameMatch) {
      info.name = nameMatch[1];
    }

    // Email extraction
    const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
      info.email = emailMatch[1];
    }

    // Phone extraction
    const phoneMatch = text.match(/(\+?[\d\s\-\(\)]{10,})/);
    if (phoneMatch) {
      info.phone = phoneMatch[1];
    }

    // Location extraction
    const locationMatch = text.match(/([A-Z][a-z]+(?:\s[A-Z][a-z]+)*,\s*[A-Z][a-z]+)/);
    if (locationMatch) {
      info.location = locationMatch[1];
    }

    return info;
  }

  /**
   * Extract education information
   * @param {string} text - Raw text
   * @returns {Array} Education entries
   */
  extractEducation(text) {
    const education = [];
    const educationKeywords = ['education', 'university', 'college', 'degree', 'bachelor', 'master', 'phd', 'diploma', 'certificate'];
    
    // Look for education section
    const educationSection = this.findSection(text, educationKeywords);
    if (educationSection) {
      // Extract degree information
      const degreePattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:in\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi;
      let match;
      while ((match = degreePattern.exec(educationSection)) !== null) {
        education.push({
          degree: match[1],
          field: match[2],
          institution: this.extractInstitution(educationSection, match.index),
          year: this.extractYear(educationSection, match.index)
        });
      }
    }

    return education;
  }

  /**
   * Extract work experience
   * @param {string} text - Raw text
   * @returns {Array} Experience entries
   */
  extractExperience(text) {
    const experience = [];
    const experienceKeywords = ['experience', 'employment', 'work', 'career', 'professional'];
    
    const experienceSection = this.findSection(text, experienceKeywords);
    if (experienceSection) {
      // Extract job titles and companies
      const jobPattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:at\s+|@\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi;
      let match;
      while ((match = jobPattern.exec(experienceSection)) !== null) {
        experience.push({
          title: match[1],
          company: match[2],
          duration: this.extractDuration(experienceSection, match.index),
          description: this.extractDescription(experienceSection, match.index)
        });
      }
    }

    return experience;
  }

  /**
   * Extract skills
   * @param {string} text - Raw text
   * @returns {Array} Skills list
   */
  extractSkills(text) {
    const skills = [];
    const skillKeywords = ['skills', 'technical', 'programming', 'software', 'tools'];
    
    const skillsSection = this.findSection(text, skillKeywords);
    if (skillsSection) {
      // Common technical skills patterns
      const skillPatterns = [
        /(?:JavaScript|Python|Java|C\+\+|C#|PHP|Ruby|Go|Swift|Kotlin)/gi,
        /(?:React|Angular|Vue|Node\.js|Express|Django|Flask|Spring|Laravel)/gi,
        /(?:HTML|CSS|SQL|MongoDB|PostgreSQL|MySQL|Redis)/gi,
        /(?:AWS|Azure|Docker|Kubernetes|Git|Linux|Windows)/gi
      ];

      skillPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(skillsSection)) !== null) {
          if (!skills.includes(match[1])) {
            skills.push(match[1]);
          }
        }
      });
    }

    return skills;
  }

  /**
   * Extract certifications
   * @param {string} text - Raw text
   * @returns {Array} Certifications
   */
  extractCertifications(text) {
    const certifications = [];
    const certKeywords = ['certification', 'certified', 'license', 'credential'];
    
    const certSection = this.findSection(text, certKeywords);
    if (certSection) {
      const certPattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Certification|Certificate|License)/gi;
      let match;
      while ((match = certPattern.exec(certSection)) !== null) {
        certifications.push({
          name: match[1],
          issuer: this.extractIssuer(certSection, match.index),
          year: this.extractYear(certSection, match.index)
        });
      }
    }

    return certifications;
  }

  /**
   * Extract languages
   * @param {string} text - Raw text
   * @returns {Array} Languages
   */
  extractLanguages(text) {
    const languages = [];
    const languageKeywords = ['languages', 'language', 'fluent', 'native'];
    
    const languageSection = this.findSection(text, languageKeywords);
    if (languageSection) {
      const commonLanguages = ['English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Chinese', 'Japanese', 'Korean', 'Arabic', 'Hindi'];
      commonLanguages.forEach(lang => {
        if (languageSection.toLowerCase().includes(lang.toLowerCase())) {
          languages.push(lang);
        }
      });
    }

    return languages;
  }

  /**
   * Extract projects
   * @param {string} text - Raw text
   * @returns {Array} Projects
   */
  extractProjects(text) {
    const projects = [];
    const projectKeywords = ['projects', 'project', 'portfolio', 'work'];
    
    const projectSection = this.findSection(text, projectKeywords);
    if (projectSection) {
      const projectPattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*[-:]\s*([^.\n]+)/gi;
      let match;
      while ((match = projectPattern.exec(projectSection)) !== null) {
        projects.push({
          name: match[1],
          description: match[2].trim()
        });
      }
    }

    return projects;
  }

  /**
   * Extract achievements
   * @param {string} text - Raw text
   * @returns {Array} Achievements
   */
  extractAchievements(text) {
    const achievements = [];
    const achievementKeywords = ['achievements', 'awards', 'honors', 'recognition'];
    
    const achievementSection = this.findSection(text, achievementKeywords);
    if (achievementSection) {
      const achievementPattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*[-:]\s*([^.\n]+)/gi;
      let match;
      while ((match = achievementPattern.exec(achievementSection)) !== null) {
        achievements.push({
          title: match[1],
          description: match[2].trim()
        });
      }
    }

    return achievements;
  }

  /**
   * Extract contact information
   * @param {string} text - Raw text
   * @returns {Object} Contact info
   */
  extractContactInfo(text) {
    const contact = {};
    
    // LinkedIn
    const linkedinMatch = text.match(/(?:linkedin\.com\/in\/|linkedin\.com\/pub\/)([a-zA-Z0-9\-]+)/);
    if (linkedinMatch) {
      contact.linkedin = `https://linkedin.com/in/${linkedinMatch[1]}`;
    }

    // GitHub
    const githubMatch = text.match(/(?:github\.com\/)([a-zA-Z0-9\-]+)/);
    if (githubMatch) {
      contact.github = `https://github.com/${githubMatch[1]}`;
    }

    // Portfolio/Website
    const websiteMatch = text.match(/(https?:\/\/[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,})/);
    if (websiteMatch) {
      contact.website = websiteMatch[1];
    }

    return contact;
  }

  /**
   * Extract objective/summary
   * @param {string} text - Raw text
   * @returns {string} Objective
   */
  extractObjective(text) {
    const objectiveKeywords = ['objective', 'summary', 'profile', 'about'];
    const objectiveSection = this.findSection(text, objectiveKeywords);
    return objectiveSection ? objectiveSection.substring(0, 200) : '';
  }

  /**
   * Extract summary
   * @param {string} text - Raw text
   * @returns {string} Summary
   */
  extractSummary(text) {
    return this.extractObjective(text); // Same logic for now
  }

  /**
   * Helper function to find a section in text
   * @param {string} text - Full text
   * @param {Array} keywords - Keywords to search for
   * @returns {string} Section content
   */
  findSection(text, keywords) {
    const lines = text.split('\n');
    let sectionStart = -1;
    let sectionEnd = lines.length;

    // Find section start
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (keywords.some(keyword => line.includes(keyword))) {
        sectionStart = i;
        break;
      }
    }

    if (sectionStart === -1) return null;

    // Find section end (next section header)
    const nextSectionKeywords = ['education', 'experience', 'skills', 'projects', 'achievements', 'certifications'];
    for (let i = sectionStart + 1; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (nextSectionKeywords.some(keyword => line.includes(keyword))) {
        sectionEnd = i;
        break;
      }
    }

    return lines.slice(sectionStart, sectionEnd).join('\n');
  }

  /**
   * Extract institution name from context
   * @param {string} text - Section text
   * @param {number} index - Match index
   * @returns {string} Institution name
   */
  extractInstitution(text, index) {
    const context = text.substring(Math.max(0, index - 100), index + 100);
    const institutionMatch = context.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:University|College|Institute|School))/);
    return institutionMatch ? institutionMatch[1] : '';
  }

  /**
   * Extract year from context
   * @param {string} text - Section text
   * @param {number} index - Match index
   * @returns {string} Year
   */
  extractYear(text, index) {
    const context = text.substring(Math.max(0, index - 50), index + 50);
    const yearMatch = context.match(/(19|20)\d{2}/);
    return yearMatch ? yearMatch[0] : '';
  }

  /**
   * Extract duration from context
   * @param {string} text - Section text
   * @param {number} index - Match index
   * @returns {string} Duration
   */
  extractDuration(text, index) {
    const context = text.substring(Math.max(0, index - 50), index + 50);
    const durationMatch = context.match(/(\d{4}\s*[-–]\s*\d{4}|\d{4}\s*[-–]\s*present|jan\s*\d{4}\s*[-–]\s*dec\s*\d{4})/i);
    return durationMatch ? durationMatch[1] : '';
  }

  /**
   * Extract description from context
   * @param {string} text - Section text
   * @param {number} index - Match index
   * @returns {string} Description
   */
  extractDescription(text, index) {
    const context = text.substring(index, index + 200);
    return context.substring(0, 150).trim();
  }

  /**
   * Extract issuer from context
   * @param {string} text - Section text
   * @param {number} index - Match index
   * @returns {string} Issuer
   */
  extractIssuer(text, index) {
    const context = text.substring(Math.max(0, index - 100), index + 100);
    const issuerMatch = context.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
    return issuerMatch ? issuerMatch[1] : '';
  }
}

module.exports = DocumentParser;
