const express = require("express");
const router = express.Router();


const Question = require("../models/Question");
const Document = require("../models/Document");
const PDF = require("../models/PDF");

const ObjectivePDF = require("../models/ObjectivePDF");
const upload = require("../middleware/upload");

const cloudinary = require("../config/cloudinary");





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
        
        
      const quizzes = await Question.aggregate([
    {
        $match: {
            type: "objective"
        }
    },
    {
        $group: {
            _id: {
                level: "$level",
                section: "$section",
                category: "$category",
                subject: "$subject",
                quiz: "$quiz"
            },
            questionCount: {
                $sum: 1
            }
        }
    },
    {
        $project: {
            _id: 1,
            level: "$_id.level",
            section: "$_id.section",
            category: "$_id.category",
            subject: "$_id.subject",
            quiz: "$_id.quiz",
            questionCount: 1
        }
    },
    {
        $sort: {
            level: 1,
            category: 1,
            subject: 1,
            quiz: 1
        }
    }
]);


        res.render("admin", {

            pdfs,
            docs,
            objectivePDFs,
            quizzes

        });

    } catch (err) {

        console.error(err);

        res.status(500).send(
            "Error loading admin dashboard."
        );

    }

});



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
     

// =====================================================
// DELETE ENTIRE CSV QUIZ
// =====================================================

router.get(
    "/delete-quiz",
    async (req, res) => {

        try {

            const {
                level,
                category,
                semester,
                subject,
                quiz
            } = req.query;


            console.log("DELETE QUIZ REQUEST:", {
                level,
                category,
                semester,
                subject,
                quiz
            });


            if (
                !level ||
                !category ||
                !semester ||
                !subject ||
                !quiz
            ) {

                return res.status(400).send(
                    "Missing quiz information."
                );

            }


            const result =
                await Question.deleteMany({

                    type: "objective",

                    level: Number(level),

                    category: category,


                    subject: subject,


                });


            console.log(
                `Deleted quiz "${quiz}" - ${result.deletedCount} questions`
            );


            res.redirect("/admin");


        } catch (error) {

            console.error(
                "Delete quiz error:",
                error
            );


            res.status(500).send(
                "Unable to delete quiz."
            );

        }

    }
);


module.exports = router;
