const Major = require('../models/Major');
const createHttpError = require('../utils/error');

// Create Major
exports.createMajor = async (req, res, next) => {
  try {
    const { name, description, department, students, courses, status } = req.body;
    if(!name || !department) return next(createHttpError(400, 'Name and department are required'));
    const existing = await Major.findOne({ name });
    if(existing) return next(createHttpError(409, 'Major with this name already exists'));

    const major = await Major.create({ name, description, department, students, courses, status });
    res.status(201).json({ success: true, data: major });
  } catch (err) { next(err); }
};

// List Majors with filters & pagination
exports.listMajors = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, q, status, department } = req.query;
    const filter = {};
    if(q) filter.name = { $regex: q, $options: 'i' };
    if(status) filter.status = status;
    if(department) filter.department = department;

    const skip = (parseInt(page)-1) * parseInt(limit);
    const [items, total] = await Promise.all([
      Major.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Major.countDocuments(filter)
    ]);

    res.json({ success: true, data: items, page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total/parseInt(limit)) });
  } catch (err) { next(err); }
};

// Get Single Major
exports.getMajor = async (req, res, next) => {
  try {
    const major = await Major.findById(req.params.id);
    if(!major) return next(createHttpError(404, 'Major not found'));
    res.json({ success: true, data: major });
  } catch (err) { next(err); }
};

// Update Major
exports.updateMajor = async (req, res, next) => {
  try {
    const updates = req.body;
    if(updates.name){
      const exists = await Major.findOne({ name: updates.name, _id: { $ne: req.params.id } });
      if(exists) return next(createHttpError(409, 'Another major with this name already exists'));
    }
    const major = await Major.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if(!major) return next(createHttpError(404, 'Major not found'));
    res.json({ success: true, data: major });
  } catch (err) { next(err); }
};

// Delete Major
exports.deleteMajor = async (req, res, next) => {
  try {
    const major = await Major.findByIdAndDelete(req.params.id);
    if(!major) return next(createHttpError(404, 'Major not found'));
    res.json({ success: true, message: 'Major deleted' });
  } catch (err) { next(err); }
};
