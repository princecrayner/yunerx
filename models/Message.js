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

module.exports = mongoose.model("Message", MessageSchema);
