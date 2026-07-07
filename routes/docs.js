const express = require("express");
const router = express.Router();

const Document = require("../models/Document");
const upload = require("../middleware/upload");

// Upload PDF
router.post(
    "/upload",
    upload.single("pdf"),
    async (req, res) => {

        const newDoc = new Document({
            name: req.body.name,
            pdfUrl: req.file.path,
            cloudinaryId: req.file.filename
        });

        await newDoc.save();

        res.json(newDoc);
    }
);

// Get all PDFs
router.get("/", async (req, res) => {

    const docs = await Document.find().sort({
        uploadedAt: -1
    });

    res.render("docs", {
        docs
    });

});

module.exports = router;