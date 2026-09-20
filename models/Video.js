const mongoose = require("mongoose");

const VideoSchema = new mongoose.Schema({

    title: String,

    videoUrl: String,

    type: {
        type: String,
        enum: ["long", "short"],
        default: "long"
    },

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },

    createdAt: {
        type: Date,
        default: Date.now
    }

});

module.exports = mongoose.model("Video", VideoSchema);
