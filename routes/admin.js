const express = require("express");
const router = express.Router();
const multer = require("multer");
const csv = require("csvtojson");
const Question = require("../models/Question");

const upload = multer({ dest: "uploads/" });

// Admin page
router.get("/", (req, res) => {
    res.render("admin");
});

// Upload CSV
router.post("/upload", upload.single("file"), async (req, res) => {
    try {
        const data = await csv().fromFile(req.file.path);

        const questions = data.map(q => ({
            type: "objective",
            category: q.category || "General",
            question: q.question,
            options: [q.A, q.B, q.C, q.D],
            answer: q.answer
        }));

        await Question.insertMany(questions);

        res.send("✅ Questions uploaded successfully!");
    } catch (err) {
        console.log(err);
        res.send("❌ Error uploading file");
    }
});

module.exports = router;
