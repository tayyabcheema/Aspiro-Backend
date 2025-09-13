const User = require('../models/User');
const createError = require('../utils/error');

// Helper to shape user response
const toDTO = (u) => ({
  _id: u._id,
  fullName: u.fullName,
  email: u.email,
  role: u.role,
  createdAt: u.createdAt,
  updatedAt: u.updatedAt,
});

// POST /api/admin/users
const createUser = async (req, res, next) => {
  try {
    const { fullName, email, password, role = 'user' } = req.body;
    if (!fullName || !email || !password) return next(createError(400, 'fullName, email, password are required'));

    const exists = await User.findOne({ email }).lean();
    if (exists) return next(createError(400, 'Email already in use'));

    const user = new User({ fullName, email, password, role });
    await user.save();
    return res.status(201).json({ success: true, user: toDTO(user) });
  } catch (err) {
    return next(createError(500, err.message));
  }
};

// PUT /api/admin/users/:id
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fullName, email, role, password } = req.body;
    const user = await User.findById(id).select('+password');
    if (!user) return next(createError(404, 'User not found'));

    if (email && email !== user.email) {
      const emailUsed = await User.findOne({ email, _id: { $ne: id } }).lean();
      if (emailUsed) return next(createError(400, 'Email already in use'));
      user.email = email;
    }
    if (fullName) user.fullName = fullName;
    if (role) user.role = role;
    if (password) user.password = password; // will hash via pre-save

    await user.save();
    return res.json({ success: true, user: toDTO(user) });
  } catch (err) {
    return next(createError(500, err.message));
  }
};

// DELETE /api/admin/users/:id
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return next(createError(404, 'User not found'));
    await User.deleteOne({ _id: id });
    return res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    return next(createError(500, err.message));
  }
};

// GET /api/admin/users
const listUsers = async (_req, res, next) => {
  try {
    // No filters => returns ALL users (admins and non-admins)
    const users = await User
      .find({}, 'fullName email role createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ success: true, total: users.length, users });
  } catch (err) {
    return next(createError(500, err.message));
  }
};

// GET /api/admin/users/:id
const getUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select('-password');
    if (!user) return next(createError(404, 'User not found'));
    return res.json({ success: true, user: toDTO(user) });
  } catch (err) {
    return next(createError(500, err.message));
  }
};

module.exports = { createUser, updateUser, deleteUser, listUsers, getUser };
