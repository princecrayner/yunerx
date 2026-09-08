const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({

    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minLength: 4,
        maxLength: 20
    },

    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },

    phone: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },

    password: {
        type: String,
        required: true,
        minLength: 8,
        maxLength: 20
    },

    profileImage: {
        type: String,
        default: "/profile.png"
    },

    videos: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Video"
        }
    ]

});


module.exports = mongoose.model("User", UserSchema);
