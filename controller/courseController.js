const Course = require('../models/Course');
const createError = require('../utils/error');

const toDTO = (c) => ({
  _id: c._id,
  title: c.title,
  category: c.category,
  durationWeeks: c.durationWeeks,
  instructor: c.instructor,
  students: c.students,
  status: c.status,
  price: c.price,
  description: c.description,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt
});

// POST /api/admin/courses
const createCourse = async (req, res, next) => {
  try {
    const { title, category, durationWeeks, instructor, price, status, description } = req.body;
    if (!title || !category || !durationWeeks || !instructor || price == null) {
      return next(createError(400, 'title, category, durationWeeks, instructor, price are required'));
    }
    const course = await Course.create({ title, category, durationWeeks, instructor, price, status, description });
    return res.status(201).json({ success: true, course: toDTO(course) });
  } catch (err) { return next(createError(500, err.message)); }
};

// GET /api/admin/courses (with optional filters & pagination)
const listCourses = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, category, q } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (q) filter.title = { $regex: q, $options: 'i' };

    const skip = (Number(page) - 1) * Number(limit);
    const [courses, total] = await Promise.all([
      Course.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      Course.countDocuments(filter)
    ]);
    return res.json({ success: true, total, page: Number(page), pages: Math.ceil(total / Number(limit)), courses: courses.map(toDTO) });
  } catch (err) { return next(createError(500, err.message)); }
};

// GET /api/admin/courses/:id
const getCourse = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id).lean();
    if (!course) return next(createError(404, 'Course not found'));
    return res.json({ success: true, course: toDTO(course) });
  } catch (err) { return next(createError(500, err.message)); }
};

// PUT /api/admin/courses/:id
const updateCourse = async (req, res, next) => {
  try {
    const updates = (({ title, category, durationWeeks, instructor, students, status, price, description }) => ({ title, category, durationWeeks, instructor, students, status, price, description }))(req.body);
    Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k]);
    const course = await Course.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!course) return next(createError(404, 'Course not found'));
    return res.json({ success: true, course: toDTO(course) });
  } catch (err) { return next(createError(500, err.message)); }
};

// DELETE /api/admin/courses/:id
const deleteCourse = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return next(createError(404, 'Course not found'));
    await Course.deleteOne({ _id: course._id });
    return res.json({ success: true, message: 'Course deleted' });
  } catch (err) { return next(createError(500, err.message)); }
};

module.exports = { createCourse, listCourses, getCourse, updateCourse, deleteCourse };
