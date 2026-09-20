const express = require("express");
const multer = require("multer");

const router = express.Router();

const Video = require("../models/Video");
const cloudinary = require("../config/cloudinary");

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {

    if (file.mimetype === "video/mp4") {
        cb(null, true);
    } else {
        cb(new Error("Only MP4 videos allowed"), false);
    }

};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024
    }
});

// VIDEOS PAGE
router.get("/videos", async (req, res) => {

    try {

        if (!req.session.user) {
            return res.redirect("/login?redirect=/videos");
        }

        const longVideos = await Video.find({ type: "long" }).sort({ createdAt: -1 });
        const shorts = await Video.find({ type: "short" }).sort({ createdAt: -1 });

        res.render("videos", { longVideos, shorts });

    } catch (error) {

        console.error("Videos page error:", error);

        res.status(500).send("Unable to load videos.");

    }

});

// UPLOAD PAGE
router.get("/uploadvideo", (req, res) => {

    if (!req.session.user) {
        return res.redirect("/login");
    }

    res.render("uploadvideo");

});

// UPLOAD VIDEO
router.post("/uploadvideo", upload.single("video"), async (req, res) => {

    try {

        if (!req.session.user) {
            return res.redirect("/login");
        }

        if (!req.file) {
            return res.status(400).send("Please select a video file.");
        }

        const result = await new Promise((resolve, reject) => {

            const stream = cloudinary.uploader.upload_stream(
                {
                    folder: "yunerx/videos",
                    resource_type: "video"
                },
                (error, result) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(result);
                    }
                }
            );

            stream.end(req.file.buffer);

        });

        const video = new Video({

            title: req.body.title,

            videoUrl: result.secure_url,

            type: req.body.type === "short" ? "short" : "long",

            userId: req.session.user._id

        });

        await video.save();

        res.redirect("/profile");

    } catch (error) {

        console.error("Video upload error:", error);

        res.status(500).send("Unable to upload video: " + error.message);

    }

});


// WATCH PAGE (single long video + suggestions)
router.get("/watch/:id", async (req, res) => {

    try {

        if (!req.session.user) {
            return res.redirect("/login?redirect=/watch/" + req.params.id);
        }

        const video = await Video.findById(req.params.id);

        if (!video) {
            return res.status(404).send("Video not found.");
        }

        // Suggested videos: other long videos, excluding this one
        const suggestions = await Video.find({
            type: "long",
            _id: { $ne: video._id }
        }).sort({ createdAt: -1 }).limit(20);

        res.render("watch", { video, suggestions });

    } catch (error) {

        console.error("Watch page error:", error);

        res.status(500).send("Unable to load video.");

    }

});




// SHORTS PAGE (vertical scroll feed, starting at the clicked short)
router.get("/shorts/:id", async (req, res) => {

    try {

        if (!req.session.user) {
            return res.redirect("/login?redirect=/shorts/" + req.params.id);
        }

        const startingShort = await Video.findById(req.params.id);

        if (!startingShort) {
            return res.status(404).send("Short not found.");
        }

        const allShorts = await Video.find({ type: "short" }).sort({ createdAt: -1 });

        res.render("shorts", { allShorts, startingId: req.params.id });

    } catch (error) {

        console.error("Shorts page error:", error);

        res.status(500).send("Unable to load shorts.");

    }

});


module.exports = router;
