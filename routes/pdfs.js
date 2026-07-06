const express = require("express");
const router = express.Router();

const multer = require("multer");

const cloudinary = require("../config/cloudinary");

const { CloudinaryStorage } = require("multer-storage-cloudinary");

const PDF = require("../models/PDF");


// STORAGE
const storage = new CloudinaryStorage({

    cloudinary,

    params: {

        folder: "yunerx_pdfs",

        resource_type: "raw",

        format: async () => "pdf"

    }

});

const upload = multer({ storage });


// ADMIN PAGE
router.get("/admin/upload-pdf", (req, res) => {

    res.render("/admin");

});


// UPLOAD PDF
router.post(
    "/admin/upload-pdf",
    upload.single("pdf"),
    async (req, res) => {

        const newPDF = new PDF({

            title: req.body.title,

            subject: req.body.subject,

            level: req.body.level,

            semester: req.body.semester,

            category: req.body.category,

            pdfUrl: req.file.path

        });

        await newPDF.save();

        res.redirect("/theory-pdfs");

});


// SHOW PDFs
router.get("/theory-pdfs", async (req, res) => {

    const pdfs = await PDF.find().sort({ uploadedAt: -1 });

    res.render("theorypdfs", { pdfs });

});

module.exports = router;
