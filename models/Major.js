const mongoose = require('mongoose');

const majorSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  department: { type: String, required: true, trim: true },
  students: { type: Number, default: 0, min: 0 },
  courses: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ['active','inactive','draft'], default: 'draft' }
}, { timestamps: true });

majorSchema.index({ name: 1 }, { unique: true });
majorSchema.index({ department: 1, status: 1 });

module.exports = mongoose.model('Major', majorSchema);
