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
// OBJECTIVE PDF VIEWER PAGE (in-app preview)
// GET /objective-pdfs/viewer/:id
// =====================================================

router.get(
    "/objective-pdfs/viewer/:id",
    async (req, res) => {

        try {

            const pdf = await ObjectivePDF.findById(req.params.id);

            if (!pdf) {
                return res.status(404).send("Objective PDF not found");
            }

            res.render("pdfviewer", {
                subject: pdf.subject || "Objective Past Question",
                viewUrl: `/objective-pdfs/view/${pdf._id}`,
                downloadUrl: `/objective-pdfs/download/${pdf._id}`
            });

        } catch (error) {

            console.error("Objective PDF viewer error:", error);

            res.status(500).send("Unable to load PDF viewer.");

        }

    }
);


// =====================================================
// THEORY PDF VIEWER PAGE (in-app preview)
// GET /theory-pdfs/viewer/:id
// =====================================================

router.get(
    "/theory-pdfs/viewer/:id",
    async (req, res) => {

        try {

            const pdf = await PDF.findById(req.params.id);

            if (!pdf) {
                return res.status(404).send("Theory PDF not found");
            }

            res.render("pdfviewer", {
                title: pdf.title || "Theory Past Question",
                viewUrl: `/theory-pdfs/view/${pdf._id}`,
                downloadUrl: `/theory-pdfs/download/${pdf._id}`
            });

        } catch (error) {

            console.error("Theory PDF viewer error:", error);

            res.status(500).send("Unable to load PDF viewer.");

        }

    }
);




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

            const semesters =
                await PDF.distinct(
                    "semester",
                    {
                        level: level
                    }
                );

            semesters.sort();

            res.render(
                "theorysemesters",
                {

                    level,

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
// /theory-pdfs/level/:level/semester/:semester
// =====================================================

router.get(
    "/theory-pdfs/level/:level/semester/:semester",
    async (req, res) => {

        try {

            const level =
                decodeURIComponent(
                    req.params.level
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

                        semester: semester

                    }
                );

            subjects.sort();

            res.render(
                "theorysubjects",
                {

                    level,

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
// /theory-pdfs/level/:level/semester/:semester/subject/:subject
// =====================================================

router.get(
    "/theory-pdfs/level/:level/semester/:semester/subject/:subject",
    async (req, res) => {

        try {

            const level =
                decodeURIComponent(
                    req.params.level
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

                    semester: semester,

                    subject: subject

                }).sort({

                    uploadedAt: -1

                });

            res.render(
                "theorydocuments",
                {

                    level,

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
            let filename = (pdf.subject || "objective-question")
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
// VIEW THEORY PDF (streamed inline, matches objective pattern)
// GET /theory-pdfs/view/:id
// =====================================================

router.get(
    "/theory-pdfs/view/:id",
    async (req, res) => {

        try {

            const pdf = await PDF.findById(req.params.id);

            if (!pdf) {
                return res.status(404).send("Theory PDF not found");
            }

            const pdfUrl = cloudinary.url(
                pdf.cloudinaryId,
                {
                    resource_type: "raw",
                    type: "upload",
                    secure: true
                }
            );

            console.log("THEORY VIEW URL:", pdfUrl);

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

            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", "inline");

            const { Readable } = require("stream");

            Readable
                .fromWeb(response.body)
                .pipe(res);

        } catch (error) {

            console.error("Theory PDF view error:", error);

            res.status(500).send("Unable to view PDF");

        }

    }
);


// =====================================================
// DOWNLOAD THEORY PDF
// GET /theory-pdfs/download/:id
// =====================================================

router.get(
    "/theory-pdfs/download/:id",
    async (req, res) => {

        try {

            const pdf = await PDF.findById(req.params.id);

            if (!pdf) {
                return res.status(404).send("Theory PDF not found");
            }

            pdf.downloads = (pdf.downloads || 0) + 1;

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

            let filename = (pdf.subject || "theory-question")
                .replace(/[<>:"/\\|?*]/g, "")
                .trim();

            if (!filename.toLowerCase().endsWith(".pdf")) {
                filename += ".pdf";
            }

            res.setHeader("Content-Type", "application/pdf");
            res.setHeader(
                "Content-Disposition",
                `attachment; filename="${filename}"`
            );

            const { Readable } = require("stream");

            Readable
                .fromWeb(response.body)
                .pipe(res);

        } catch (error) {

            console.error("Theory PDF download error:", error);

            res.status(500).send("Unable to download PDF");

        }

    }
);
module.exports = router;
