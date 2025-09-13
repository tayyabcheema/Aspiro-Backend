const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    role:{
      type: String,
      enum: ["admin", "user"],
      default: "user"
    },
    hasCompletedOnboarding: {
      type: Boolean,
      default: false
    },
    resetPasswordToken: { type: String },
  resetPasswordExpire: { type: Date },
  passwordResetOTP: { type: String },
  passwordResetOTPExpire: { type: Date },
  passwordResetOTPAttempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Hash password before save
userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// Compare passwords
userSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

const User = mongoose.model("User", userSchema);

module.exports = User;