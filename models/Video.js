const mongoose = require("mongoose");

const VideoSchema = new mongoose.Schema({

    title: String,

    videoUrl: String,

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
