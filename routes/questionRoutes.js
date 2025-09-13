const express = require("express")
const router = express.Router()
const verifyToken = require("../middleware/authMiddleware")
const {addQuestion, getAllQuestions, getAllQuestionsForAI, updateQuestion, deleteQuestion} = require("../controller/questionController")


router.post("/add", verifyToken, addQuestion)
router.get("/all", verifyToken, getAllQuestions)
router.get("/ai", getAllQuestionsForAI)
router.put("/:id", verifyToken, updateQuestion)
router.delete("/:id", verifyToken, deleteQuestion)


module.exports = router