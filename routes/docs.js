const express = require("express");
const router = express.Router();

const Document = require("../models/Document");
const upload = require("../middleware/upload");
const cloudinary = require("../config/cloudinary");


// =====================================================
// UPLOAD STUDY MATERIAL
// POST /docs/upload
// =====================================================

router.post(
    "/upload",
    upload.single("pdf"),
    async (req, res) => {

        try {

            if (!req.file) {

                return res.status(400).send(
                    "Please select a PDF file."
                );

            }


            const newDoc = new Document({

                name: req.body.name,

                pdfUrl: req.file.path,

                cloudinaryId: req.file.filename

            });


            await newDoc.save();


            // Return to admin dashboard
            res.redirect("/admin");

        } catch (error) {

            console.error(
                "Study material upload error:",
                error
            );

            res.status(500).send(
                "Unable to upload study material: " +
                error.message
            );

        }

    }
);



// =====================================================
// SHOW STUDY MATERIALS PAGE
// GET /docs
// =====================================================

router.get(
    "/",
    async (req, res) => {

        try {

            const docs =
                await Document.find()
                    .sort({
                        uploadedAt: -1
                    });


            res.render(
                "docs",
                {
                    docs
                }
            );

        } catch (error) {

            console.error(
                "Error loading study materials:",
                error
            );

            res.status(500).send(
                "Unable to load study materials."
            );

        }

    }
);



// =====================================================
// GET STUDY MATERIALS AS JSON
// GET /docs/api
// =====================================================

router.get(
    "/api",
    async (req, res) => {

        try {

            const docs =
                await Document.find()
                    .sort({
                        uploadedAt: -1
                    });


            res.json(docs);

        } catch (error) {

            console.error(
                "Error loading study materials:",
                error
            );

            res.status(500).json({

                message: error.message

            });

        }

    }
);



// =====================================================
// EDIT STUDY MATERIAL PAGE
// GET /docs/edit/:id
// =====================================================

router.get(
    "/edit/:id",
    async (req, res) => {

        try {

            const doc =
                await Document.findById(
                    req.params.id
                );


            if (!doc) {

                return res.status(404).send(
                    "Study material not found."
                );

            }


            res.render(
                "editdocument",
                {
                    doc
                }
            );

        } catch (error) {

            console.error(
                "Load study material edit error:",
                error
            );

            res.status(500).send(
                "Unable to load edit page."
            );

        }

    }
);



// =====================================================
// UPDATE STUDY MATERIAL
// POST /docs/edit/:id
// =====================================================

router.post(
    "/edit/:id",
    async (req, res) => {

        try {

            const doc =
                await Document.findById(
                    req.params.id
                );


            if (!doc) {

                return res.status(404).send(
                    "Study material not found."
                );

            }


            await Document.findByIdAndUpdate(
                req.params.id,
                {

                    name: req.body.name

                }
            );


            res.redirect("/admin");

        } catch (error) {

            console.error(
                "Edit study material error:",
                error
            );

            res.status(500).send(
                "Unable to update study material."
            );

        }

    }
);



// =====================================================
// DELETE STUDY MATERIAL
// DELETE /docs/:id
// =====================================================

router.delete(
    "/:id",
    async (req, res) => {

        try {

            const doc =
                await Document.findById(
                    req.params.id
                );


            if (!doc) {

                return res.status(404).json({

                    message:
                        "Study material not found."

                });

            }


            // -----------------------------------------
            // DELETE FILE FROM CLOUDINARY
            // -----------------------------------------

            if (doc.cloudinaryId) {

                await cloudinary.uploader.destroy(
                    doc.cloudinaryId,
                    {
                        resource_type: "raw"
                    }
                );

            }


            // -----------------------------------------
            // DELETE FROM MONGODB
            // -----------------------------------------

            await Document.findByIdAndDelete(
                req.params.id
            );


            res.json({

                message:
                    "Study material deleted successfully."

            });

        } catch (error) {

            console.error(
                "Delete study material error:",
                error
            );

            res.status(500).json({

                message:
                    error.message

            });

        }

    }
);


module.exports = router;