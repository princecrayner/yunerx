router.post(
    "/upload",

    upload.single("pdf"),

    async (req, res) => {

        const Document = require("../models/Document");

        const newDoc = new Document({

            name: req.body.name,

            pdfUrl: req.file.path,

            cloudinaryId: req.file.filename

        });

        await newDoc.save();

        res.json(newDoc);

    }
);