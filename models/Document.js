// models/Document.js

const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },

    pdfUrl: {
        type: String,
        required: true
    },

    cloudinaryId: {
        type: String,
        required: true
    },

    uploadedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Document", documentSchema);