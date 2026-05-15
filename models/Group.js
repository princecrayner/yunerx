const mongoose = require("mongoose");

const GroupSchema = new mongoose.Schema({

    groupName: String,

    members: [String],

    createdAt: {
        type: Date,
        default: Date.now
    }

});

module.exports = mongoose.model("Group", GroupSchema);
