const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const storage = new CloudinaryStorage({

    cloudinary: cloudinary,

    params: async (req, file) => {

        const originalName = file.originalname
            .replace(/\.[^/.]+$/, "")
            .replace(/[^a-zA-Z0-9-_]/g, "-")
            .toLowerCase();

        return {

            folder: "docs",

            resource_type: "raw",

            public_id: `${Date.now()}-${originalName}`

        };

    }

});


const upload = multer({

    storage: storage,

    fileFilter: (req, file, cb) => {

        if (file.mimetype === "application/pdf") {

            cb(null, true);

        } else {

            cb(new Error("Only PDF files are allowed."), false);

        }

    },

    limits: {

        fileSize: 20 * 1024 * 1024

    }

});


module.exports = upload;



