const express = require("express")
const router = express.Router()
const verifyToken = require("../middleware/authMiddleware")
const {addQuestion,getAllQuestions, getAllQuestionsForAI} = require("../controller/questionController")


router.post("/add", verifyToken, addQuestion)
router.get("/all", verifyToken, getAllQuestions)
router.get("/ai", getAllQuestionsForAI)


module.exports = router