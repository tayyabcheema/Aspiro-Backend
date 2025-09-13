const jwt = require("jsonwebtoken");
const createError = require("../utils/error");
const User = require("../models/User");

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(createError(401, "Unauthorized: No token provided"));
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return next(createError(401, "Unauthorized: Invalid token"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded.id) {
      return next(createError(401, "Unauthorized: Invalid token"));
    }

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return next(createError(404, "User not found"));
    }

    req.user = user;

    next();

  } catch (err) {
    return next(createError(401, "Invalid or expired token"));
  }
};

module.exports = verifyToken;