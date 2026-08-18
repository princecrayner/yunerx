const express = require("express");
const router = express.Router();

const multer = require("multer");
const csv = require("csvtojson");

const Question = require("../models/Question");
const Document = require("../models/Document");
const PDF = require("../models/PDF");

const ObjectivePDF = require("../models/ObjectivePDF");
const upload = require("../middleware/upload");

const cloudinary = require("../config/cloudinary");


// =====================================================
// CSV UPLOAD STORAGE
// =====================================================

const csvUpload = multer({
    dest: "uploads/"
});




// =====================================================
// ADMIN PAGE
// =====================================================
router.get("/", async (req, res) => {

    try {

        const pdfs = await PDF.find().sort({
            uploadedAt: -1
        });

        const docs = await Document.find().sort({
            uploadedAt: -1
        });

        const objectivePDFs = await ObjectivePDF.find().sort({
            uploadedAt: -1
        });

        res.render("admin", {

            pdfs,
            docs,
            objectivePDFs

        });

    } catch (err) {

        console.error(err);

        res.status(500).send(
            "Error loading admin dashboard."
        );

    }

});





// =====================================================
// UPLOAD OBJECTIVE QUESTIONS CSV
// =====================================================

router.post(
    "/upload",
    csvUpload.single("file"),
    async (req, res) => {

        try {

            if (!req.file) {

                return res.status(400).send(
                    "❌ Please select a CSV file."
                );

            }


            // Read CSV
            const data = await csv({
                trim: true
            }).fromFile(req.file.path);


            console.log("========== CSV DEBUG ==========");

            console.log("CSV HEADERS:");
            console.log(
                Object.keys(data[0] || {})
            );

            console.log("FIRST CSV ROW:");
            console.log(data[0]);

            console.log("NUMBER OF ROWS:");
            console.log(data.length);

            console.log("================================");


            // -----------------------------------------
            // Helper to find CSV columns
            // regardless of capitalization/spaces
            // -----------------------------------------

            function getValue(row, name) {

                const wanted =
                    name
                        .trim()
                        .toLowerCase();


                const key =
                    Object.keys(row).find(
                        key =>
                            key
                                .trim()
                                .toLowerCase() === wanted
                    );


                return key
                    ? String(row[key] || "").trim()
                    : "";

            }


            // -----------------------------------------
            // Convert CSV rows into Questions
            // -----------------------------------------

            const questions = data.map((row, index) => {

                const question =
                    getValue(row, "question");

                const A =
                    getValue(row, "A");

                const B =
                    getValue(row, "B");

                const C =
                    getValue(row, "C");

                const D =
                    getValue(row, "D");

                const answer =
                    getValue(row, "answer");

                const level =
                    getValue(row, "level");

                const category =
                    getValue(row, "category");

                const semester =
                    getValue(row, "semester");

                const subject =
                    getValue(row, "subject");

                const quiz =
                    getValue(row, "quiz") ||
                    "Quiz 1";


                // Debug each row
                console.log(
                    `ROW ${index + 1}:`,
                    {
                        question,
                        A,
                        B,
                        C,
                        D,
                        answer,
                        level,
                        category,
                        semester,
                        subject,
                        quiz
                    }
                );


                return {

                    type: "objective",

                    question,

                    options: [
                        A,
                        B,
                        C,
                        D
                    ],

                    answer,

                    level,

                    category,

                    semester,

                    subject,

                    quiz

                };

            });


            // -----------------------------------------
            // Check for missing required data
            // BEFORE saving to MongoDB
            // -----------------------------------------

            const invalidRows =
                questions.filter(q =>
                    !q.question ||
                    !q.answer ||
                    !q.level ||
                    !q.category ||
                    !q.semester ||
                    !q.subject
                );


            if (invalidRows.length > 0) {

                console.log(
                    "❌ INVALID CSV ROWS:"
                );

                console.log(
                    invalidRows
                );


                return res.status(400).send(
                    "❌ CSV contains missing required fields. Check your CSV headers and data."
                );

            }


            // -----------------------------------------
            // Save questions
            // -----------------------------------------

            await Question.insertMany(
                questions
            );


            console.log(
                `✅ ${questions.length} questions saved.`
            );


            res.send(
                `✅ ${questions.length} objective questions uploaded successfully!`
            );


        } catch (err) {

            console.error(
                "CSV upload error:",
                err
            );


            res.status(500).send(
                "❌ CSV upload error: " +
                err.message
            );

        }

    }
);

// =====================================================
// UPLOAD OBJECTIVE PAST QUESTION PDF
// =====================================================

router.post(
    "/upload-objective-pdf",
    upload.single("pdf"),
    async (req, res) => {

        try {

            if (!req.file) {
                return res.status(400).send(
                    "❌ Please select an Objective PDF."
                );
            }

            const objectivePDF = new ObjectivePDF({

                title: req.body.title,

                subject: req.body.subject,

                semester: req.body.semester,

                pdfUrl: req.file.path,

                cloudinaryId: req.file.filename

            });

            await objectivePDF.save();

            res.send(
                "✅ Objective Past Question PDF uploaded successfully!"
            );

        } catch (err) {

            console.error(err);

            res.status(500).send(
                "❌ Error uploading Objective PDF: " +
                err.message
            );

        }

    }
);



// =====================================================
// EDIT OBJECTIVE PAST QUESTION PAGE
// =====================================================

router.get(
    "/edit-objective-pdf/:id",
    async (req, res) => {

        try {

            const pdf = await ObjectivePDF.findById(
                req.params.id
            );

            if (!pdf) {
                return res.status(404).send(
                    "Objective PDF not found."
                );
            }

            res.render("editobjectivepdf", {
                pdf
            });

        } catch (err) {

            console.error(err);

            res.status(500).send(
                "Error loading Objective PDF."
            );

        }

    }
);


// =====================================================
// UPDATE OBJECTIVE PAST QUESTION
// =====================================================

router.post(
    "/edit-objective-pdf/:id",
    async (req, res) => {

        try {

            const {
                title,
                subject,
                semester
            } = req.body;

            await ObjectivePDF.findByIdAndUpdate(
                req.params.id,
                {
                    title,
                    subject,
                    semester
                }
            );

            res.redirect("/admin");

        } catch (err) {

            console.error(err);

            res.status(500).send(
                "Error updating Objective PDF."
            );

        }

    }
);



// =====================================================
// DELETE OBJECTIVE PAST QUESTION
// =====================================================

router.get(
    "/delete-objective-pdf/:id",
    async (req, res) => {

        try {

            const pdf = await ObjectivePDF.findById(
                req.params.id
            );

            if (!pdf) {
                return res.status(404).send(
                    "Objective PDF not found."
                );
            }

            // Delete file from Cloudinary
            if (pdf.cloudinaryId) {

                await cloudinary.uploader.destroy(
                    pdf.cloudinaryId,
                    {
                        resource_type: "raw"
                    }
                );

            }

            // Delete database record
            await ObjectivePDF.findByIdAndDelete(
                req.params.id
            );

            res.redirect("/admin");

        } catch (err) {

            console.error(err);

            res.status(500).send(
                "Error deleting Objective PDF."
            );

        }

    }
);



// =====================================================
// DELETE THEORY PAST QUESTION
// =====================================================

router.get(
    "/delete-pdf/:id",
    async (req, res) => {

        try {

            const pdf =
                await PDF.findById(
                    req.params.id
                );

            if (!pdf) {

                return res.status(404).send(
                    "Theory past question not found."
                );

            }


            // Delete PDF from Cloudinary
            if (pdf.cloudinaryId) {

                await cloudinary.uploader.destroy(
                    pdf.cloudinaryId,
                    {
                        resource_type: "raw"
                    }
                );

            }


            // Delete MongoDB record
            await PDF.findByIdAndDelete(
                req.params.id
            );


            res.redirect("/admin");

        } catch (error) {

            console.error(
                "Delete theory PDF error:",
                error
            );

            res.status(500).send(
                "Unable to delete theory past question."
            );

        }

    }
);


// =====================================================
// EDIT THEORY PAST QUESTION - PAGE
// =====================================================

router.get(
    "/edit-pdf/:id",
    async (req, res) => {

        try {

            const pdf =
                await PDF.findById(
                    req.params.id
                );


            if (!pdf) {

                return res.status(404).send(
                    "Theory past question not found."
                );

            }


            res.render(
                "editpdf",
                {
                    pdf
                }
            );

        } catch (error) {

            console.error(
                "Load edit theory PDF error:",
                error
            );

            res.status(500).send(
                "Unable to load edit page."
            );

        }

    }
);


// =====================================================
// EDIT THEORY PAST QUESTION - SAVE
// =====================================================

router.post(
    "/edit-pdf/:id",
    async (req, res) => {

        try {

            await PDF.findByIdAndUpdate(
                req.params.id,
                {

                    title: req.body.title,

                    subject: req.body.subject,

                    level: req.body.level,

                    semester: req.body.semester,

                    category: req.body.category

                }
            );


            res.redirect("/admin");

        } catch (error) {

            console.error(
                "Edit theory PDF error:",
                error
            );

            res.status(500).send(
                "Unable to update theory past question."
            );

        }

    }
);


router.get("/questions", async (req, res) => {

    try {

        const questions = await Question.find();

        console.log("QUESTIONS IN DATABASE:");
        console.log(questions);

        res.json(questions);

    } catch (error) {

        console.error(error);

        res.status(500).send(
            "Error loading questions"
        );

    }

});



module.exports = router;