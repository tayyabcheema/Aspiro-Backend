const createError = require("../utils/error");
const User = require("../models/User");
const UserResponse = require("../models/UserResponse");
const Roadmap = require("../models/Roadmap");
const Course = require("../models/Course");
const { generateRoadmap } = require("../services/roadmapGenerator");

/**
 * Generate a personalized roadmap for the user based on their responses
 */
const generateUserRoadmap = async (req, res, next) => {
  try {
    // Validate user authentication
    const userId = req.user.id || req.user._id;
    const user = await User.findById(userId);
    
    if (!user || user.role !== "user") {
      return next(createError(403, "Only registered users can generate roadmaps"));
    }

    // Check if user has completed onboarding (has responses)
    const userResponses = await UserResponse.find({ user: userId });
    
    if (!userResponses || userResponses.length === 0) {
      return next(createError(400, "Please complete the questionnaire first to generate your roadmap"));
    }

    // Check if roadmap already exists
    const existingRoadmap = await Roadmap.findOne({ user: userId });
    
    if (existingRoadmap) {
      return res.status(200).json({
        success: true,
        message: "Roadmap already exists for this user",
        data: existingRoadmap
      });
    }

    // Generate new roadmap using AI
    const roadmapResult = await generateRoadmap(userResponses);
    
    if (!roadmapResult.success) {
      return next(createError(500, `Failed to generate roadmap: ${roadmapResult.error}`));
    }

    // Populate course details for the selected courses
    const populatedCourses = await Promise.all(
      roadmapResult.data.courses.map(async (courseData) => {
        const course = await Course.findById(courseData.courseId);
        if (!course) {
          console.warn(`Course not found: ${courseData.courseId}`);
          return null;
        }
        
        return {
          course: course,
          order: courseData.order,
          reason: courseData.reason,
          estimatedDuration: courseData.estimatedDuration,
          prerequisites: courseData.prerequisites || []
        };
      })
    );

    // Filter out any null courses (in case some courses were deleted)
    const validCourses = populatedCourses.filter(course => course !== null);
    
    if (validCourses.length === 0) {
      return next(createError(500, "No valid courses found for roadmap generation"));
    }

    // Create roadmap document
    const roadmap = new Roadmap({
      user: userId,
      title: roadmapResult.data.title,
      description: roadmapResult.data.description,
      courses: validCourses,
      timeline: roadmapResult.data.timeline,
      goals: roadmapResult.data.goals,
      skills: roadmapResult.data.skills,
      status: roadmapResult.data.status,
      progress: roadmapResult.data.progress,
      aiMetadata: roadmapResult.metadata
    });

    await roadmap.save();

    // Populate the roadmap with course details for response
    const populatedRoadmap = await Roadmap.findById(roadmap._id)
      .populate('courses.course')
      .lean();

    return res.status(201).json({
      success: true,
      message: "Roadmap generated successfully",
      data: populatedRoadmap
    });

  } catch (error) {
    console.error("Error generating roadmap:", error);
    return next(createError(500, "Internal server error during roadmap generation"));
  }
};

/**
 * Get user's roadmap
 */
const getUserRoadmap = async (req, res, next) => {
  try {
    // Validate user authentication
    const userId = req.user.id || req.user._id;
    const user = await User.findById(userId);
    
    if (!user || user.role !== "user") {
      return next(createError(403, "Only registered users can view their roadmap"));
    }

    // Find user's roadmap
    const roadmap = await Roadmap.findOne({ user: userId })
      .populate('courses.course')
      .lean();

    if (!roadmap) {
      return next(createError(404, "No roadmap found. Please generate your roadmap first."));
    }

    return res.status(200).json({
      success: true,
      message: "Roadmap fetched successfully",
      data: roadmap
    });

  } catch (error) {
    console.error("Error fetching roadmap:", error);
    return next(createError(500, "Internal server error"));
  }
};

/**
 * Update roadmap progress
 */
const updateRoadmapProgress = async (req, res, next) => {
  try {
    // Validate user authentication
    const userId = req.user.id || req.user._id;
    const user = await User.findById(userId);
    
    if (!user || user.role !== "user") {
      return next(createError(403, "Only registered users can update roadmap progress"));
    }

    const { progress, status, milestoneId } = req.body;

    // Find user's roadmap
    const roadmap = await Roadmap.findOne({ user: userId });
    
    if (!roadmap) {
      return next(createError(404, "No roadmap found"));
    }

    // Update progress if provided
    if (progress !== undefined) {
      roadmap.progress = Math.max(0, Math.min(100, progress));
    }

    // Update status if provided
    if (status && ['generated', 'in_progress', 'completed', 'paused'].includes(status)) {
      roadmap.status = status;
    }

    // Update milestone completion if provided
    if (milestoneId !== undefined && roadmap.timeline.milestones) {
      const milestone = roadmap.timeline.milestones.id(milestoneId);
      if (milestone) {
        milestone.completed = true;
      }
    }

    await roadmap.save();

    // Populate and return updated roadmap
    const updatedRoadmap = await Roadmap.findById(roadmap._id)
      .populate('courses.course')
      .lean();

    return res.status(200).json({
      success: true,
      message: "Roadmap updated successfully",
      data: updatedRoadmap
    });

  } catch (error) {
    console.error("Error updating roadmap:", error);
    return next(createError(500, "Internal server error"));
  }
};

/**
 * Delete user's roadmap
 */
const deleteUserRoadmap = async (req, res, next) => {
  try {
    // Validate user authentication
    const userId = req.user.id || req.user._id;
    const user = await User.findById(userId);
    
    if (!user || user.role !== "user") {
      return next(createError(403, "Only registered users can delete their roadmap"));
    }

    // Find and delete user's roadmap
    const roadmap = await Roadmap.findOneAndDelete({ user: userId });
    
    if (!roadmap) {
      return next(createError(404, "No roadmap found to delete"));
    }

    return res.status(200).json({
      success: true,
      message: "Roadmap deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting roadmap:", error);
    return next(createError(500, "Internal server error"));
  }
};

/**
 * Regenerate user's roadmap (delete existing and create new one)
 */
const regenerateUserRoadmap = async (req, res, next) => {
  try {
    // Validate user authentication
    const userId = req.user.id || req.user._id;
    const user = await User.findById(userId);
    
    if (!user || user.role !== "user") {
      return next(createError(403, "Only registered users can regenerate roadmaps"));
    }

    // Delete existing roadmap if it exists
    await Roadmap.findOneAndDelete({ user: userId });

    // Get fresh user responses
    const userResponses = await UserResponse.find({ user: userId });
    
    if (!userResponses || userResponses.length === 0) {
      return next(createError(400, "Please complete the questionnaire first to generate your roadmap"));
    }

    // Generate new roadmap
    const roadmapResult = await generateRoadmap(userResponses);
    
    if (!roadmapResult.success) {
      return next(createError(500, `Failed to generate roadmap: ${roadmapResult.error}`));
    }

    // Populate course details
    const populatedCourses = await Promise.all(
      roadmapResult.data.courses.map(async (courseData) => {
        const course = await Course.findById(courseData.courseId);
        if (!course) {
          return null;
        }
        
        return {
          course: course,
          order: courseData.order,
          reason: courseData.reason,
          estimatedDuration: courseData.estimatedDuration,
          prerequisites: courseData.prerequisites || []
        };
      })
    );

    const validCourses = populatedCourses.filter(course => course !== null);
    
    if (validCourses.length === 0) {
      return next(createError(500, "No valid courses found for roadmap generation"));
    }

    // Create new roadmap
    const roadmap = new Roadmap({
      user: userId,
      title: roadmapResult.data.title,
      description: roadmapResult.data.description,
      courses: validCourses,
      timeline: roadmapResult.data.timeline,
      goals: roadmapResult.data.goals,
      skills: roadmapResult.data.skills,
      status: roadmapResult.data.status,
      progress: roadmapResult.data.progress,
      aiMetadata: roadmapResult.metadata
    });

    await roadmap.save();

    // Populate and return new roadmap
    const populatedRoadmap = await Roadmap.findById(roadmap._id)
      .populate('courses.course')
      .lean();

    return res.status(201).json({
      success: true,
      message: "Roadmap regenerated successfully",
      data: populatedRoadmap
    });

  } catch (error) {
    console.error("Error regenerating roadmap:", error);
    return next(createError(500, "Internal server error during roadmap regeneration"));
  }
};

module.exports = {
  generateUserRoadmap,
  getUserRoadmap,
  updateRoadmapProgress,
  deleteUserRoadmap,
  regenerateUserRoadmap
};
