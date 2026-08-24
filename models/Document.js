const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true,
        trim: true
    },

    originalName: {
        type: String,
        default: ""
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
