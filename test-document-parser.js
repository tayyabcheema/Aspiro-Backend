const DocumentParser = require('./services/documentParser');
const fs = require('fs');
const path = require('path');

/**
 * Test script for document parsing functionality
 * This script tests the document parser with sample documents
 */
async function testDocumentParser() {
  console.log('🧪 Testing Document Parser...\n');

  const parser = new DocumentParser();

  // Test with a sample text file
  const testText = `
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
  fs.writeFileSync(testFilePath, testText);

  try {
    console.log('📄 Testing text file parsing...');
    const result = await parser.parseDocument(testFilePath, 'text/plain');
    
    if (result.success) {
      console.log('✅ Text parsing successful!');
      console.log('📊 Extracted data:');
      console.log(JSON.stringify(result.structuredData, null, 2));
    } else {
      console.log('❌ Text parsing failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Error testing text parsing:', error.message);
  }

  // Clean up test file
  if (fs.existsSync(testFilePath)) {
    fs.unlinkSync(testFilePath);
  }

  console.log('\n🎯 Testing question type determination...');
  
  const testQuestions = [
    'What programming languages do you know?',
    'What is your highest level of education?',
    'How many years of experience do you have?',
    'What are your career goals?',
    'Do you have any certifications?',
    'What languages do you speak?'
  ];

  testQuestions.forEach(question => {
    const questionType = parser.determineQuestionType ? 
      parser.determineQuestionType(question) : 
      'general';
    console.log(`❓ "${question}" → ${questionType}`);
  });

  console.log('\n✨ Document parser test completed!');
}

// Run the test if this file is executed directly
if (require.main === module) {
  testDocumentParser().catch(console.error);
}

module.exports = { testDocumentParser };
