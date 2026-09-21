const mongoose = require("mongoose");

const CommentSchema = new mongoose.Schema({

    username: {
        type: String,
        required: true
    },

    text: {
        type: String,
        required: true
    },

    createdAt: {
        type: Date,
        default: Date.now
    }

});

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

    views: {
        type: [String],
        default: []
    },

    likes: {
        type: [String],
        default: []
    },

    comments: {
        type: [CommentSchema],
        default: []
    },

    createdAt: {
        type: Date,
        default: Date.now
    }

});

module.exports = mongoose.model("Video", VideoSchema);
