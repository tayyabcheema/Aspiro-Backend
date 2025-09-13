const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true }, // e.g. Programming, AI/ML, Data Science
  durationWeeks: { type: Number, required: true, min: 1 },
  instructor: { type: String, required: true, trim: true },
  students: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ['active','draft','inactive'], default: 'draft' },
  price: { type: Number, required: true, min: 0 },
  description: { type: String, trim: true },
  // Optional future fields: syllabus, tags, level
}, { timestamps: true });

courseSchema.index({ title: 1 });
courseSchema.index({ category: 1, status: 1 });

module.exports = mongoose.model('Course', courseSchema);
