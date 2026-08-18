const mongoose = require("mongoose");

const pdfSchema = new mongoose.Schema({

    title: {
        type: String,
        required: true
    },

    subject: {
        type: String,
        required: true
    },

    level: {
        type: String,
        required: true
    },

    semester: {
        type: String,
        required: true
    },

    category: {
        type: String,
        required: true
    },

    pdfUrl: {
        type: String,
        required: true
    },

    cloudinaryId: {
        type: String,
        default: ""
    },

    downloads: {
        type: Number,
        default: 0
    },

    uploadedAt: {
        type: Date,
        default: Date.now
    }

});

module.exports = mongoose.model("PDF", pdfSchema);