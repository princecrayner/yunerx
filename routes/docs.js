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

            console.log("UPLOAD REQUEST RECEIVED");

            console.log("FILE:", req.file);

            console.log("BODY:", req.body);

            if (!req.file) {

                return res.status(400).json({
                    message: "Please select a PDF file."
                });

            }

            const newDoc = new Document({

                name: req.body.name,

                pdfUrl: req.file.path,

                cloudinaryId: req.file.filename,

                originalName: req.file.originalname

            });

            await newDoc.save();

            console.log("DOCUMENT SAVED");

            res.status(201).json({
                message: "PDF uploaded successfully",
                document: newDoc
            });

        } catch (error) {

            console.error(
                "UPLOAD ERROR:",
                error
            );

            res.status(500).json({
                message:
                    "Unable to upload study material: " +
                    error.message
            });

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


// =====================================================
// DOWNLOAD PDF
// GET /docs/download/:id
// =====================================================

router.get("/download/:id", async (req, res) => {

    try {

        const document =
            await Document.findById(req.params.id);

        if (!document) {

            return res.status(404).send(
                "Document not found."
            );

        }

        const pdfUrl =
            cloudinary.url(
                document.cloudinaryId,
                {
                    resource_type: "raw",
                    secure: true
                }
            );

        console.log("Downloading PDF:");
        console.log(pdfUrl);

        const response =
            await fetch(pdfUrl);

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

        let filename =
            document.originalName ||
            document.name ||
            "document.pdf";

        filename =
            filename.replace(
                /[<>:"/\\|?*]/g,
                ""
            ).trim();

        if (
            !filename
                .toLowerCase()
                .endsWith(".pdf")
        ) {

            filename += ".pdf";

        }

        res.setHeader(
            "Content-Type",
            "application/pdf"
        );

        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${filename}"`
        );

        const { Readable } =
            require("stream");

        Readable
            .fromWeb(response.body)
            .pipe(res);

    } catch (error) {

        console.error(
            "PDF download error:",
            error
        );

        res.status(500).send(
            "Unable to download PDF."
        );

    }

});

// =====================================================
// OPEN PDF
// GET /docs/open/:id
// =====================================================

router.get("/open/:id", async (req, res) => {

    try {

        const document =
            await Document.findById(req.params.id);

        if (!document) {

            return res.status(404).send(
                "Document not found."
            );

        }

        const pdfUrl =
            cloudinary.url(
                document.cloudinaryId,
                {
                    resource_type: "raw",
                    secure: true
                }
            );

        console.log("Opening PDF:");
        console.log(pdfUrl);

        const response =
            await fetch(pdfUrl);

        if (!response.ok) {

            console.error(
                "Cloudinary response:",
                response.status,
                response.statusText
            );

            return res.status(500).send(
                "Unable to retrieve PDF."
            );

        }

        res.setHeader(
            "Content-Type",
            "application/pdf"
        );

        res.setHeader(
            "Content-Disposition",
            "inline"
        );

        const { Readable } =
            require("stream");

        Readable
            .fromWeb(response.body)
            .pipe(res);

    } catch (error) {

        console.error(
            "PDF view error:",
            error
        );

        res.status(500).send(
            "Unable to open PDF."
        );

    }

});



module.exports = router;
