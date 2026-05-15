const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({

    username: String,

    email: String,

    phone: String,

    password: String,

    profileImage: {
        type: String,
        default: "profile.png"
    },

    videos: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Video"
        }
    ]

});

module.exports = mongoose.model("User", UserSchema);
