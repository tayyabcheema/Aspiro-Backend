/**
 * Script to fix the user type question options in the database
 * 
 * This script updates the "Are you a student or Professional?" question
 * to have separate "Student" and "Professional" options instead of
 * the combined "Student Professional" option.
 */

const mongoose = require('mongoose');
const Question = require('./models/Question');

async function fixUserTypeQuestion() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/aspiro');
    console.log('Connected to MongoDB');

    // Find the user type question
    const userTypeQuestion = await Question.findOne({
      text: { $regex: /student.*professional/i }
    });

    if (!userTypeQuestion) {
      console.log('User type question not found');
      return;
    }

    console.log('Found user type question:', {
      id: userTypeQuestion._id,
      text: userTypeQuestion.text,
      currentOptions: userTypeQuestion.options
    });

    // Update the options
    const updatedQuestion = await Question.findByIdAndUpdate(
      userTypeQuestion._id,
      {
        options: ['Student', 'Professional']
      },
      { new: true }
    );

    console.log('Updated user type question:', {
      id: updatedQuestion._id,
      text: updatedQuestion.text,
      newOptions: updatedQuestion.options
    });

    console.log('User type question fixed successfully!');
    
  } catch (error) {
    console.error('Error fixing user type question:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  fixUserTypeQuestion();
}

module.exports = fixUserTypeQuestion;
