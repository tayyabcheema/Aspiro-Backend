const express = require("express");
const router = express.Router();
const multer = require("multer");
const verifyToken = require("../middleware/authMiddleware");
const { saveUserResponses, preFillQuestions, getUserResponses } = require("../controller/UserResponseController");


// ✅ Multer storage setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // Upload folder
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

// ✅ File size limit 5 MB
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// ✅ Protect all routes
router.use(verifyToken);

// ✅ Updated POST route for saving responses with file uploads
// upload.array("files") allows multiple files per request
router.post("/save", upload.array("files"), saveUserResponses);

// ✅ New POST route for pre-filling questions based on uploaded documents
router.post("/prefill", upload.array("files"), preFillQuestions);

router.get("/", getUserResponses);


module.exports = router;
