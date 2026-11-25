const express = require("express");
const router = express.Router();

const mongoose = require("mongoose");
const User = require("../models/User");
const Product = require("../models/Product");
const Favorite = require("../models/Favorite");
const Report = require("../models/Report");
const helpers = require("../utils/marketHelpers");


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


        const openReports = await Report.countDocuments({ status: "open" });

        res.render("admin", {

            pdfs,
            docs,
            objectivePDFs,
            quizzes,
            openReports

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

            console.error(
                "Objective PDF upload error:",
                err
            );

            res.status(500).send(
                "Failed to upload Objective PDF: " +
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
                subject,
                semester
            } = req.body;

            await ObjectivePDF.findByIdAndUpdate(
                req.params.id,
                {
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
// UPLOAD THEORY PAST QUESTION PDF
// =====================================================

router.post(
    "/upload-pdf",
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
// DELETE ONE CSV QUIZ
// =====================================================

router.get(
    "/delete-quiz",
    async (req, res) => {

        try {

            const {
                subject,
                quiz
            } = req.query;


            console.log("DELETE QUIZ REQUEST:", {
                subject,
                quiz
            });


            // -----------------------------------------
            // CHECK REQUIRED INFORMATION
            // -----------------------------------------

            if (
              
                !subject ||
                !quiz
            ) {

                return res.status(400).send(
                    "Missing quiz information."
                );

            }


            // -----------------------------------------
            // DELETE ONLY THIS SPECIFIC QUIZ
            // -----------------------------------------

            const result =
                await Question.deleteMany({

                    type: "objective",

                    subject: subject,

                    quiz: quiz

                });


            console.log(
                `Deleted quiz "${quiz}" - ${result.deletedCount} questions`
            );


            // -----------------------------------------
            // RETURN TO ADMIN PAGE
            // -----------------------------------------

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


// =====================================================
// REPORTED LISTINGS
// =====================================================

router.get("/reports", async (req, res) => {

    try {

        // one entry per reported listing, most reported first
        const groups = await Report.aggregate([
            { $match: { status: "open" } },
            { $group: {
                _id: "$productId",
                sellerId: { $first: "$sellerId" },
                count: { $sum: 1 },
                latest: { $max: "$createdAt" },
                items: { $push: { reason: "$reason", details: "$details", at: "$createdAt" } }
            } },
            { $sort: { count: -1, latest: -1 } },
            { $limit: 100 }
        ]);

        const sellerIds = groups.map((g) => g.sellerId);

        const [products, sellers, sellerTotals] = await Promise.all([

            Product.find({ _id: { $in: groups.map((g) => g._id) } }).lean(),

            User.find({ _id: { $in: sellerIds } }).select("username").lean(),

            // how many open reports each of these sellers has across all their listings
            Report.aggregate([
                { $match: { status: "open", sellerId: { $in: sellerIds } } },
                { $group: { _id: "$sellerId", total: { $sum: 1 } } }
            ])

        ]);

        const productById = new Map(products.map((p) => [String(p._id), p]));
        const sellerById = new Map(sellers.map((u) => [String(u._id), u.username]));
        const totalBySeller = new Map(sellerTotals.map((t) => [String(t._id), t.total]));

        const reports = groups.map((g) => {

            const tally = {};

            g.items.forEach((item) => {
                tally[item.reason] = (tally[item.reason] || 0) + 1;
            });

            return {
                productId: String(g._id),
                product: productById.get(String(g._id)) || null,
                sellerName: sellerById.get(String(g.sellerId)) || "Deleted user",
                sellerTotal: totalBySeller.get(String(g.sellerId)) || 0,
                count: g.count,
                latest: g.latest,
                reasons: Object.entries(tally).sort((a, b) => b[1] - a[1]),
                notes: g.items
                    .filter((item) => item.details)
                    .sort((a, b) => new Date(b.at) - new Date(a.at))
                    .slice(0, 5)
            };

        });

        res.render("adminreports", { reports, ...helpers });

    } catch (error) {

        console.error("Admin reports error:", error);

        res.status(500).send("Unable to load reports.");

    }

});


// Keep the listing up and close its reports
router.post("/reports/:productId/dismiss", async (req, res) => {

    try {

        if (!mongoose.isValidObjectId(req.params.productId)) {
            return res.status(400).json({ message: "Invalid request." });
        }

        await Report.updateMany(
            { productId: req.params.productId, status: "open" },
            { status: "reviewed" }
        );

        res.json({ success: true });

    } catch (error) {

        console.error("Dismiss report error:", error);

        res.status(500).json({ message: "Something went wrong." });

    }

});


// Delete the listing (and its photos) and close its reports
router.post("/reports/:productId/remove", async (req, res) => {

    try {

        const id = req.params.productId;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid request." });
        }

        const product = await Product.findById(id);

        if (product) {

            await Promise.all((product.images || []).map((image) =>
                cloudinary.uploader
                    .destroy(image.publicId, { resource_type: "image" })
                    .catch((error) => console.error("Image delete error:", error.message))
            ));

            await Favorite.deleteMany({ productId: product._id });

            await product.deleteOne();

        }

        await Report.updateMany({ productId: id, status: "open" }, { status: "reviewed" });

        res.json({ success: true });

    } catch (error) {

        console.error("Remove reported listing error:", error);

        res.status(500).json({ message: "Something went wrong." });

    }

});

module.exports = router;
