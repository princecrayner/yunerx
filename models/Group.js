const mongoose = require("mongoose");

const GroupSchema = new mongoose.Schema({

    groupName: {
        type: String,
        required: true,
        trim: true
    },

    admin: {
        type: String,
        required: true
    },

    members: {
        type: [String],
        default: []
    },

    createdAt: {
        type: Date,
        default: Date.now
    }

});

module.exports = mongoose.model("Group", GroupSchema);
