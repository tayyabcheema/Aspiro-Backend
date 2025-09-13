const User = require("../models/User");
const createError = require("../utils/error");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");

const register = async (req, res, next) => {
  try {
    const { fullName, email, password, role } = req.body;

    if (!fullName || !email || !password) {
      return next(createError(400, "All fields are required"));
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return next(createError(400, "User already exists"));
    }

    const newUser = new User({ fullName, email, password, role });
    await newUser.save();

    // newUser.password = undefined;

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      user: newUser,
    });
  } catch (err) {
    return next(createError(500, err.message));
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(createError(400, "Email and password are required"));
    }

    const user = await User.findOne({ email });
    if (!user) {
      return next(createError(404, "User not found"));
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return next(createError(400, "Invalid credentials"));
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: { 
        _id: user._id, 
        fullName: user.fullName, 
        email: user.email, 
        role: user.role,
        hasCompletedOnboarding: user.hasCompletedOnboarding
      },
    });
  } catch (err) {
    return next(createError(500, err.message));
  }
};

// POST /api/auth/forgot-password  { email }
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return next(createError(400, "Email is required"));

    const user = await User.findOne({ email });
    const generic = { success: true, message: "If that email exists, an OTP has been sent." };
    if (!user) return res.status(200).json(generic); // no enumeration

    // generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashed = crypto.createHash('sha256').update(otp).digest('hex');

    user.passwordResetOTP = hashed;
    user.passwordResetOTPExpire = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    user.passwordResetOTPAttempts = 0;
    await user.save({ validateBeforeSave: false });

    try {
      await sendEmail({
        to: user.email,
        subject: 'Your Password Reset OTP',
        html: `<p>Your OTP is <b>${otp}</b>. It expires in 10 minutes.</p>`
      });
    } catch (e) {
      user.passwordResetOTP = undefined;
      user.passwordResetOTPExpire = undefined;
      await user.save({ validateBeforeSave: false });
      return next(createError(500, 'Failed to send reset email'));
    }

    return res.status(200).json(generic);
  } catch (err) {
    return next(createError(500, err.message));
  }
};

// POST /api/auth/reset-password { email, otp, newPassword }
const resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) return next(createError(400, 'Email, otp and newPassword are required'));

    const user = await User.findOne({ email }).select('+passwordResetOTP +password');
    if (!user || !user.passwordResetOTP || !user.passwordResetOTPExpire) return next(createError(400, 'Invalid or expired OTP'));

    if (user.passwordResetOTPExpire.getTime() < Date.now()) return next(createError(400, 'Invalid or expired OTP'));
    if (user.passwordResetOTPAttempts >= 5) return next(createError(429, 'Too many attempts'));

    const hashed = crypto.createHash('sha256').update(otp).digest('hex');
    if (hashed !== user.passwordResetOTP) {
      user.passwordResetOTPAttempts += 1;
      await user.save({ validateBeforeSave: false });
      return next(createError(400, 'Invalid or expired OTP'));
    }

    user.password = newPassword;
    user.passwordResetOTP = undefined;
    user.passwordResetOTPExpire = undefined;
    user.passwordResetOTPAttempts = 0;
    await user.save();

    return res.status(200).json({ success: true, message: 'Password reset successful' });
  } catch (err) {
    return next(createError(500, err.message));
  }
};

module.exports = { register, login, forgotPassword, resetPassword };
