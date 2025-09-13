const createError = require('../utils/error');

module.exports = function requireAdmin(req, _res, next) {
  if (!req.user) return next(createError(401, 'Unauthorized'));
  if (req.user.role !== 'admin') return next(createError(403, 'Forbidden: admin only'));
  next();
};
