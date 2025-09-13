const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const requireAdmin = require('../middleware/requireAdmin');
const { createUser, updateUser, deleteUser, listUsers, getUser } = require('../controller/adminUserController');
const { createCourse, listCourses, getCourse, updateCourse, deleteCourse } = require('../controller/courseController');
const { createMajor, listMajors, getMajor, updateMajor, deleteMajor } = require('../controller/majorController');

router.use(verifyToken, requireAdmin);

router.get('/users', listUsers);
router.get('/users/:id', getUser);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

// Course routes
router.get('/courses', listCourses);
router.get('/courses/:id', getCourse);
router.post('/courses', createCourse);
router.put('/courses/:id', updateCourse);
router.delete('/courses/:id', deleteCourse);

// Major routes
router.get('/majors', listMajors);
router.get('/majors/:id', getMajor);
router.post('/majors', createMajor);
router.put('/majors/:id', updateMajor);
router.delete('/majors/:id', deleteMajor);

module.exports = router;
