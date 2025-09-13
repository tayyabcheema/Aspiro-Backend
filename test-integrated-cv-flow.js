const DocumentParser = require('./services/documentParser');
const AISuggestionService = require('./services/aiSuggestionService');
const QuestionPreFillService = require('./services/questionPreFillService');
const fs = require('fs');
const path = require('path');

/**
 * Test script for integrated CV upload and pre-filling functionality
 * This simulates the complete flow from CV upload to question pre-filling
 */
async function testIntegratedCVFlow() {
  console.log('🧪 Testing Integrated CV Upload and Pre-filling Flow...\n');

  // Create a sample CV text
  const sampleCV = `
John Smith
Software Engineer
john.smith@email.com
+1 (555) 123-4567
San Francisco, CA

EDUCATION
Bachelor of Science in Computer Science
University of California, Berkeley
2018-2022

EXPERIENCE
Software Engineer
Google Inc.
2022-Present
- Developed web applications using React and Node.js
- Implemented microservices architecture
- Collaborated with cross-functional teams

Frontend Developer Intern
Facebook
Summer 2021
- Built responsive user interfaces
- Worked with React and TypeScript
- Participated in code reviews

SKILLS
JavaScript, Python, React, Node.js, SQL, Git, AWS, Docker

CERTIFICATIONS
AWS Certified Developer
Amazon Web Services
2023

PROJECTS
E-commerce Platform
- Full-stack web application built with React and Node.js
- Integrated payment processing with Stripe
- Deployed on AWS with CI/CD pipeline

Portfolio Website
- Personal portfolio website showcasing projects
- Built with Next.js and Tailwind CSS
- Responsive design for all devices
`;

  // Create a temporary test file
  const testFilePath = path.join(__dirname, 'test-cv.txt');
  fs.writeFileSync(testFilePath, sampleCV);

  try {
    // Test 1: Document Parsing
    console.log('📄 Testing document parsing...');
    const parser = new DocumentParser();
    const parseResult = await parser.parseDocument(testFilePath, 'text/plain');
    
    if (parseResult.success) {
      console.log('✅ Document parsing successful!');
      console.log('📊 Extracted structured data:');
      console.log(JSON.stringify(parseResult.structuredData, null, 2));
    } else {
      console.log('❌ Document parsing failed:', parseResult.error);
      return;
    }

    // Test 2: AI Suggestion Service
    console.log('\n🤖 Testing AI suggestion service...');
    const aiService = new AISuggestionService();
    
    // Mock questions for testing
    const mockQuestions = [
      {
        _id: 'q1',
        text: 'What programming languages do you know?',
        category: 'skills',
        type: 'multiple-choice',
        options: ['JavaScript', 'Python', 'Java', 'C++', 'C#', 'PHP', 'Ruby']
      },
      {
        _id: 'q2',
        text: 'What is your highest level of education?',
        category: 'education',
        type: 'multiple-choice',
        options: ['High School', 'Bachelor\'s Degree', 'Master\'s Degree', 'PhD', 'Other']
      },
      {
        _id: 'q3',
        text: 'How many years of work experience do you have?',
        category: 'experience',
        type: 'multiple-choice',
        options: ['0-1 years', '1-3 years', '3-5 years', '5-10 years', '10+ years']
      }
    ];

    // Test question mapping analysis
    const questionMappings = aiService.analyzeDocumentMapping(parseResult.structuredData, mockQuestions);
    console.log('✅ Question mapping analysis completed!');
    console.log('📊 Question mappings:');
    console.log(JSON.stringify(questionMappings, null, 2));

    // Test 3: Complete Pre-fill Service
    console.log('\n🎯 Testing complete pre-fill service...');
    const preFillService = new QuestionPreFillService();
    
    // Mock uploaded files
    const mockUploadedFiles = [
      {
        path: testFilePath,
        mimetype: 'text/plain',
        originalname: 'test-cv.txt',
        size: fs.statSync(testFilePath).size
      }
    ];

    const preFillResults = await preFillService.processDocumentsAndPreFill(mockUploadedFiles, mockQuestions);
    
    if (preFillResults.success) {
      console.log('✅ Pre-fill processing successful!');
      console.log('📊 Pre-fill results:');
      console.log(JSON.stringify(preFillResults.data.preFilledAnswers, null, 2));
      
      // Test summary generation
      const summary = preFillService.getPreFillSummary(preFillResults);
      console.log('\n📈 Processing summary:');
      console.log(JSON.stringify(summary, null, 2));
    } else {
      console.log('❌ Pre-fill processing failed:', preFillResults.error);
    }

  } catch (error) {
    console.error('❌ Error in integrated CV flow test:', error);
  } finally {
    // Clean up test file
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  }

  console.log('\n✨ Integrated CV flow test completed!');
}

// Test CV upload detection logic
function testCVUploadDetection() {
  console.log('\n🔍 Testing CV upload detection logic...');
  
  const testSteps = [
    {
      id: 'step1',
      title: 'Upload your CV/Resume',
      type: 'file',
      stepName: 'Professional Documents'
    },
    {
      id: 'step2',
      title: 'What is your name?',
      type: 'text',
      stepName: 'Personal Information'
    },
    {
      id: 'step3',
      title: 'Upload supporting documents',
      type: 'file',
      stepName: 'Additional Documents'
    }
  ];

  testSteps.forEach((step, index) => {
    const isCVUpload = index === 0 && step.type === "file" && 
                      (step.title.toLowerCase().includes('cv') || 
                       step.title.toLowerCase().includes('resume') ||
                       step.title.toLowerCase().includes('document') ||
                       step.stepName.toLowerCase().includes('professional') ||
                       step.stepName.toLowerCase().includes('documents'));
    
    console.log(`Step ${index + 1}: "${step.title}" → CV Upload: ${isCVUpload ? '✅' : '❌'}`);
  });
}

// Run the tests if this file is executed directly
if (require.main === module) {
  testIntegratedCVFlow()
    .then(() => testCVUploadDetection())
    .catch(console.error);
}

module.exports = { testIntegratedCVFlow, testCVUploadDetection };
