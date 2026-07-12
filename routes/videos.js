const express = require("express");
const multer = require("multer");

const router = express.Router();

const Video = require("../models/Video");

// STORAGE
const storage = multer.diskStorage({

    destination: function(req, file, cb){
        cb(null, "public/uploads");
    },

    filename: function(req, file, cb){
        cb(null, Date.now() + "-" + file.originalname);
    }

});

// VIDEO FILTER
const fileFilter = (req, file, cb) => {

    if(file.mimetype === "video/mp4"){
        cb(null, true);
    }else{
        cb(new Error("Only MP4 videos allowed"), false);
    }

};

const upload = multer({
    storage,
    fileFilter
});

// VIDEOS PAGE
router.get("/videos", async (req, res) => {

    if(!req.session.user){
        return res.redirect("/login");
    }

    const videos = await Video.find();

    res.render("videos", { videos });

});

// UPLOAD PAGE
router.get("/uploadvideo", (req, res) => {

    if(!req.session.user){
        return res.redirect("/login");
    }

    res.render("uploadvideo");

});

// UPLOAD VIDEO
router.post("/uploadvideo", upload.single("video"), async (req, res) => {

    if(!req.session.user){
        return res.redirect("/login");
    }

    const video = new Video({

        title: req.body.title,

        videoUrl: "/uploads/" + req.file.filename,

        userId: req.session.user._id

    });

    await video.save();

    res.redirect("/profile");

});

module.exports = router;
