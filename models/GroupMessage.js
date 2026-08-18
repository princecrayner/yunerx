const mongoose = require("mongoose");

const GroupMessageSchema = new mongoose.Schema({

    groupId: String,

    sender: String,

    message: String,

    date: String,

    time: String

});

module.exports = mongoose.model("GroupMessage", GroupMessageSchema);
