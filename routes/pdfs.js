const express = require("express");
const router = express.Router();

const multer = require("multer");

const cloudinary = require("../config/cloudinary");

const {
    CloudinaryStorage
} = require("multer-storage-cloudinary");

const PDF = require("../models/PDF");

const ObjectivePDF = require("../models/ObjectivePDF");


// =====================================================
// CLOUDINARY STORAGE
// =====================================================

const storage = new CloudinaryStorage({

    cloudinary,

    params: {

        folder: "yunerx_pdfs",

        resource_type: "raw",

        format: async () => "pdf"

    }

});

const upload = multer({
    storage
});



// =====================================================
// OBJECTIVE PDF SEMESTER PAGE
// /objective-pdfs
// =====================================================

router.get(
    "/objective-pdfs",
    async (req, res) => {

        try {

            const semesters =
                await ObjectivePDF.distinct("semester");

            semesters.sort();

            res.render("objectivepdfs", {
                semesters
            });

        } catch (error) {

            console.error(error);

            res.status(500).send(
                "Unable to load objective PDF semesters"
            );

        }

    }
);



// =====================================================
// OBJECTIVE PDF SUBJECT PAGE
// /objective-pdfs/semester/:semester
// =====================================================

router.get(
    "/objective-pdfs/semester/:semester",
    async (req, res) => {

        try {

            const semester =
                decodeURIComponent(
                    req.params.semester
                );

            const subjects =
                await ObjectivePDF.distinct(
                    "subject",
                    {
                        semester: semester
                    }
                );

            subjects.sort();

            res.render("objectivesubjects", {

                semester,

                subjects

            });

        } catch (error) {

            console.error(error);

            res.status(500).send(
                "Unable to load objective PDF subjects"
            );

        }

    }
);



// =====================================================
// OBJECTIVE PDF DOCUMENTS PAGE
// /objective-pdfs/semester/:semester/subject/:subject
// =====================================================

router.get(
    "/objective-pdfs/semester/:semester/subject/:subject",
    async (req, res) => {

        try {

            const semester =
                decodeURIComponent(
                    req.params.semester
                );

            const subject =
                decodeURIComponent(
                    req.params.subject
                );

            const pdfs =
                await ObjectivePDF.find({

                    semester: semester,

                    subject: subject

                }).sort({

                    uploadedAt: -1

                });

            res.render("objectivedocuments", {

                semester,

                subject,

                pdfs

            });

        } catch (error) {

            console.error(error);

            res.status(500).send(
                "Unable to load objective PDF documents"
            );

        }

    }
);



// =====================================================
// THEORY PAST QUESTIONS
//
// LEVEL
//   ↓
// CATEGORY
//   ↓
// SEMESTER
//   ↓
// SUBJECT
//   ↓
// PDF DOCUMENTS
//
// /theory-pdfs/level/:level
// =====================================================

router.get(
    "/theory-pdfs/level/:level",
    async (req, res) => {

        try {

            const level =
                decodeURIComponent(
                    req.params.level
                );

            const categories =
                await PDF.distinct(
                    "category",
                    {
                        level: level
                    }
                );

            categories.sort();

            res.render(
                "theorycategories",
                {

                    level,

                    categories

                }
            );

        } catch (error) {

            console.error(
                "Theory category error:",
                error
            );

            res.status(500).send(
                "Unable to load theory categories"
            );

        }

    }
);



// =====================================================
// THEORY CATEGORY PAGE
//
// /theory-pdfs/level/:level/category/:category
// =====================================================

router.get(
    "/theory-pdfs/level/:level/category/:category",
    async (req, res) => {

        try {

            const level =
                decodeURIComponent(
                    req.params.level
                );

            const category =
                decodeURIComponent(
                    req.params.category
                );

            const semesters =
                await PDF.distinct(
                    "semester",
                    {

                        level: level,

                        category: category

                    }
                );

            semesters.sort();

            res.render(
                "theorysemesters",
                {

                    level,

                    category,

                    semesters

                }
            );

        } catch (error) {

            console.error(
                "Theory semester error:",
                error
            );

            res.status(500).send(
                "Unable to load theory semesters"
            );

        }

    }
);



// =====================================================
// THEORY SUBJECT PAGE
//
// /theory-pdfs/level/:level/category/:category/semester/:semester
// =====================================================

router.get(
    "/theory-pdfs/level/:level/category/:category/semester/:semester",
    async (req, res) => {

        try {

            const level =
                decodeURIComponent(
                    req.params.level
                );

            const category =
                decodeURIComponent(
                    req.params.category
                );

            const semester =
                decodeURIComponent(
                    req.params.semester
                );

            const subjects =
                await PDF.distinct(
                    "subject",
                    {

                        level: level,

                        category: category,

                        semester: semester

                    }
                );

            subjects.sort();

            res.render(
                "theorysubjects",
                {

                    level,

                    category,

                    semester,

                    subjects

                }
            );

        } catch (error) {

            console.error(
                "Theory subject error:",
                error
            );

            res.status(500).send(
                "Unable to load theory subjects"
            );

        }

    }
);



// =====================================================
// THEORY PDF DOCUMENTS PAGE
//
// /theory-pdfs/level/:level/category/:category/semester/:semester/subject/:subject
// =====================================================

router.get(
    "/theory-pdfs/level/:level/category/:category/semester/:semester/subject/:subject",
    async (req, res) => {

        try {

            const level =
                decodeURIComponent(
                    req.params.level
                );

            const category =
                decodeURIComponent(
                    req.params.category
                );

            const semester =
                decodeURIComponent(
                    req.params.semester
                );

            const subject =
                decodeURIComponent(
                    req.params.subject
                );

            const pdfs =
                await PDF.find({

                    level: level,

                    category: category,

                    semester: semester,

                    subject: subject

                }).sort({

                    uploadedAt: -1

                });

            res.render(
                "theorydocuments",
                {

                    level,

                    category,

                    semester,

                    subject,

                    pdfs

                }
            );

        } catch (error) {

            console.error(
                "Theory documents error:",
                error
            );

            res.status(500).send(
                "Unable to load theory past question documents"
            );

        }

    }
);




// =====================================================
// UPLOAD THEORY PAST QUESTION PDF
// =====================================================

router.post(
    "/admin/upload-pdf",
    upload.single("pdf"),
    async (req, res) => {

        try {

            console.log("===== THEORY PDF UPLOAD START =====");

            console.log("BODY:", req.body);
            console.log("FILE:", req.file);

            if (!req.file) {
                console.log("NO FILE RECEIVED");

                return res.status(400).send(
                    "❌ No PDF file received."
                );
            }

            const newPDF = new PDF({

                title: req.body.title,

                subject: req.body.subject,

                level: req.body.level,

                semester: req.body.semester,

                category: req.body.category,

                pdfUrl: req.file.path,

                cloudinaryId: req.file.filename

            });

            await newPDF.save();

            console.log("MongoDB PDF saved successfully.");

            console.log("Cloudinary URL:", req.file.path);
            console.log("Cloudinary ID:", req.file.filename);

            console.log("===== THEORY PDF UPLOAD SUCCESS =====");

            res.send(
                "✅ Theory Past Question PDF uploaded successfully!"
            );

        } catch (error) {

            console.error("===== THEORY PDF UPLOAD ERROR =====");

            console.error(error);

            console.error("Message:", error.message);

            console.error("Stack:", error.stack);

            console.error("====================================");

            res.status(500).send(
                "❌ Theory PDF upload failed: " +
                error.message
            );

        }

    }
);
            


// =====================================================
// UPLOAD OBJECTIVE PAST QUESTION PDF
// =====================================================

router.post(
    "/admin/upload-objective-pdf",
    upload.single("pdf"),
    async (req, res) => {

        try {

            if (!req.file) {

                return res.status(400).send(
                    "Please select a PDF file."
                );

            }

            const newPDF =
                new ObjectivePDF({

                    title: req.body.title,

                    subject: req.body.subject,

                    semester: req.body.semester,

                    pdfUrl: req.file.path,

                    cloudinaryId: req.file.filename

                });

            await newPDF.save();

            console.log(
                "Objective PDF uploaded:"
            );

            console.log(
                "URL:",
                req.file.path
            );

            console.log(
                "Public ID:",
                req.file.filename
            );

            console.log(
                "Objective PDF saved to MongoDB"
            );

            res.send(
                "✅ Objective Past Question PDF uploaded successfully!"
            );

        } catch (error) {

            console.error(
                "Objective PDF upload error:",
                error
            );

            res.status(500).send(
                "Failed to upload Objective PDF: " +
                error.message
            );

        }

    }
);




// =====================================================
// VIEW OBJECTIVE PDF
// GET /objective-pdfs/view/:id
// =====================================================

router.get(
    "/objective-pdfs/view/:id",
    async (req, res) => {

        try {

            const pdf = await ObjectivePDF.findById(
                req.params.id
            );

            if (!pdf) {

                return res.status(404).send(
                    "Objective PDF not found"
                );

            }

            // Use the exact Cloudinary URL saved during upload
            const pdfUrl = pdf.pdfUrl;

            console.log(
                "OBJECTIVE PDF VIEW:",
                pdfUrl
            );

            const response = await fetch(pdfUrl);

            if (!response.ok) {

                console.error(
                    "Cloudinary response:",
                    response.status,
                    response.statusText
                );

                return res.status(500).send(
                    "Unable to retrieve PDF from storage."
                );

            }

            // Tell browser this is a PDF
            res.setHeader(
                "Content-Type",
                "application/pdf"
            );

            // Open inside browser
            res.setHeader(
                "Content-Disposition",
                "inline"
            );

            // Send the actual PDF file
            const { Readable } = require("stream");

            Readable
                .fromWeb(response.body)
                .pipe(res);

        } catch (error) {

            console.error(
                "Objective PDF view error:",
                error
            );

            res.status(500).send(
                "Unable to open Objective PDF."
            );

        }

    }
);




// =====================================================
// DOWNLOAD OBJECTIVE PDF
// GET /objective-pdfs/download/:id
// =====================================================

router.get(
    "/objective-pdfs/download/:id",
    async (req, res) => {

        try {

            const pdf = await ObjectivePDF.findById(
                req.params.id
            );

            if (!pdf) {

                return res.status(404).send(
                    "Objective PDF not found"
                );

            }

            // Increase download count
            pdf.downloads =
                (pdf.downloads || 0) + 1;

            await pdf.save();

            // Use the exact Cloudinary URL saved during upload
            const pdfUrl = pdf.pdfUrl;

            console.log(
                "OBJECTIVE PDF DOWNLOAD:",
                pdfUrl
            );

            const response = await fetch(pdfUrl);

            if (!response.ok) {

                console.error(
                    "Cloudinary response:",
                    response.status,
                    response.statusText
                );

                return res.status(500).send(
                    "Unable to retrieve PDF from storage."
                );

            }

            // Clean filename
            let filename = (pdf.title || "objective-question")
                .replace(/[<>:"/\\|?*]/g, "")
                .trim();

            // Make sure filename ends with .pdf
            if (
                !filename
                    .toLowerCase()
                    .endsWith(".pdf")
            ) {

                filename += ".pdf";

            }

            // Tell browser this is a PDF
            res.setHeader(
                "Content-Type",
                "application/pdf"
            );

            // Force download
            res.setHeader(
                "Content-Disposition",
                `attachment; filename="${filename}"`
            );

            // Send actual PDF
            const { Readable } = require("stream");

            Readable
                .fromWeb(response.body)
                .pipe(res);

        } catch (error) {

            console.error(
                "Objective PDF download error:",
                error
            );

            res.status(500).send(
                "Unable to download Objective PDF."
            );

        }

    }
);



// =====================================================
// VIEW THEORY PDF
// GET /theory-pdfs/view/:id
// =====================================================

router.get(
    "/theory-pdfs/view/:id",
    async (req, res) => {

        try {

            const pdf = await PDF.findById(
                req.params.id
            );

            if (!pdf) {

                return res.status(404).send(
                    "Theory PDF not found"
                );

            }

            // Use the exact Cloudinary URL saved during upload
            const pdfUrl = pdf.pdfUrl;

            console.log(
                "THEORY PDF VIEW:",
                pdfUrl
            );

            // Fetch the actual PDF from Cloudinary
            const response = await fetch(pdfUrl);

            if (!response.ok) {

                console.error(
                    "Cloudinary response:",
                    response.status,
                    response.statusText
                );

                return res.status(500).send(
                    "Unable to retrieve PDF from storage."
                );

            }

            // Tell browser this is a PDF
            res.setHeader(
                "Content-Type",
                "application/pdf"
            );

            // Open inside browser
            res.setHeader(
                "Content-Disposition",
                "inline"
            );

            // Send the actual PDF
            const { Readable } = require("stream");

            Readable
                .fromWeb(response.body)
                .pipe(res);

        } catch (error) {

            console.error(
                "Theory PDF view error:",
                error
            );

            res.status(500).send(
                "Unable to open Theory PDF."
            );

        }

    }
);




// =====================================================
// DOWNLOAD THEORY PDF
// =====================================================

router.get(
    "/theory-pdfs/download/:id",
    async (req, res) => {

        try {

            const pdf = await PDF.findById(req.params.id);

            if (!pdf) {
                return res.status(404).send(
                    "Theory PDF not found"
                );
            }

            pdf.downloads =
                (pdf.downloads || 0) + 1;

            await pdf.save();

            const pdfUrl = cloudinary.url(
                pdf.cloudinaryId,
                {
                    resource_type: "raw",
                    type: "upload",
                    secure: true
                }
            );

            console.log("THEORY DOWNLOAD URL:", pdfUrl);

            res.redirect(pdfUrl);

        } catch (error) {

            console.error(
                "Theory PDF download error:",
                error
            );

            res.status(500).send(
                "Unable to download PDF"
            );

        }

    }
);

module.exports = router;
