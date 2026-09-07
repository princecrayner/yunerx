const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
    sender: String,
    receiver: String,
    phone: String,
    message: String,
    seen: {
        type: Boolean,
        default: false
    },
    time: String,
    date: String
});

const StorySchema = new mongoose.Schema({

    username: {
        type: String,
        required: true
    },

    type: {
        type: String,
        enum: ["text", "image", "video"],
        required: true
    },

    content: {
        type: String,
        required: true
    },

    createdAt: {
        type: Date,
        default: Date.now
    },

    expiresAt: {
        type: Date,
        required: true
    }

});

// Auto-delete expired stories from MongoDB
StorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Message = mongoose.model("Message", MessageSchema);
const Story = mongoose.model("Story", StorySchema);

module.exports = { Message, Story };
