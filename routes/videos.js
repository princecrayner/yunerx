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

// VIDEOS PAGE (renders the first block, rest loads via infinite scroll)
router.get("/videos", async (req, res) => {

    try {

        if (!req.session.user) {
            return res.redirect("/login?redirect=/videos");
        }

        const totalLong = await Video.countDocuments({ type: "long" });

        let longVideos = [];

        if (totalLong > 0) {
            longVideos = await Video.find({ type: "long" })
                .sort({ createdAt: -1 })
                .limit(BLOCK_SIZE);
        }

        const shorts = await Video.aggregate([
            { $match: { type: "short" } },
            { $sample: { size: BLOCK_SIZE } }
        ]);

        const nextOffset = totalLong > 0 ? BLOCK_SIZE % totalLong : 0;

        res.render("videos", {
            longVideos,
            shorts,
            nextOffset,
            hasContent: longVideos.length > 0 || shorts.length > 0
        });

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

        res.redirect("/videos");

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

        const currentUser = req.session.user.username;

        const video = await Video.findById(req.params.id);

        if (!video) {
            return res.status(404).send("Video not found.");
        }

        // Record a view, once per user
        const alreadyViewed = video.views.includes(currentUser);

        if (!alreadyViewed) {

            video.views.push(currentUser);

            await video.save();

        }

        const hasLiked = video.likes.includes(currentUser);

        const suggestions = await Video.find({
            type: "long",
            _id: { $ne: video._id }
        }).sort({ createdAt: -1 }).limit(20);

        res.render("watch", {
            video,
            suggestions,
            currentUser,
            hasLiked
        });

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

        const currentUser = req.session.user.username;

        const startingShort = await Video.findById(req.params.id);

        if (!startingShort) {
            return res.status(404).send("Short not found.");
        }

        const allShorts = await Video.find({ type: "short" }).sort({ createdAt: -1 });

        res.render("shorts", {
            allShorts,
            startingId: req.params.id,
            currentUser
        });

    } catch (error) {

        console.error("Shorts page error:", error);

        res.status(500).send("Unable to load shorts.");

    }

});




// RECORD A SHORT VIEW (called via fetch as user scrolls to it)
router.post("/shorts/:id/view", async (req, res) => {

    try {

        if (!req.session.user) {
            return res.status(401).json({ success: false });
        }

        const currentUser = req.session.user.username;

        const video = await Video.findById(req.params.id);

        if (!video) {
            return res.status(404).json({ success: false });
        }

        if (!video.views.includes(currentUser)) {

            video.views.push(currentUser);

            await video.save();

        }

        res.json({ success: true, viewCount: video.views.length });

    } catch (error) {

        console.error("Record short view error:", error);

        res.status(500).json({ success: false });

    }

});



const BLOCK_SIZE = 7;

// FEED — returns one block of long videos + one block of random shorts
router.get("/videos/feed", async (req, res) => {

    try {

        if (!req.session.user) {
            return res.status(401).json({ message: "Please login first." });
        }

        const offset = parseInt(req.query.offset) || 0;

        const totalLong = await Video.countDocuments({ type: "long" });

        let longVideos = [];

        if (totalLong > 0) {

            if (offset + BLOCK_SIZE <= totalLong) {

                longVideos = await Video.find({ type: "long" })
                    .sort({ createdAt: -1 })
                    .skip(offset)
                    .limit(BLOCK_SIZE);

            } else {

                // Wrap around to the beginning once we reach the end,
                // so the feed never runs dry — same idea as social apps looping content
                const firstPart = await Video.find({ type: "long" })
                    .sort({ createdAt: -1 })
                    .skip(offset)
                    .limit(totalLong - offset);

                const remaining = BLOCK_SIZE - firstPart.length;

                const secondPart = remaining > 0
                    ? await Video.find({ type: "long" })
                        .sort({ createdAt: -1 })
                        .skip(0)
                        .limit(remaining)
                    : [];

                longVideos = [...firstPart, ...secondPart];

            }

        }

        // Random shorts — different suggestions every time, repeats allowed (like a real shorts feed)
        const shorts = await Video.aggregate([
            { $match: { type: "short" } },
            { $sample: { size: BLOCK_SIZE } }
        ]);

        const nextOffset = totalLong > 0 ? (offset + BLOCK_SIZE) % totalLong : 0;

        res.json({
            longVideos,
            shorts,
            nextOffset,
            hasContent: longVideos.length > 0 || shorts.length > 0
        });

    } catch (error) {

        console.error("Video feed error:", error);

        res.status(500).json({ message: "Unable to load feed." });

    }

});


// TOGGLE LIKE ON A VIDEO
router.post("/video/:id/like", async (req, res) => {

    try {

        if (!req.session.user) {
            return res.status(401).json({ success: false });
        }

        const currentUser = req.session.user.username;

        const video = await Video.findById(req.params.id);

        if (!video) {
            return res.status(404).json({ success: false });
        }

        const alreadyLiked = video.likes.includes(currentUser);

        if (alreadyLiked) {

            video.likes = video.likes.filter(username => username !== currentUser);

        } else {

            video.likes.push(currentUser);

        }

        await video.save();

        res.json({
            success: true,
            liked: !alreadyLiked,
            likeCount: video.likes.length
        });

    } catch (error) {

        console.error("Toggle like error:", error);

        res.status(500).json({ success: false });

    }

});


// ADD A COMMENT
router.post("/video/:id/comment", async (req, res) => {

    try {

        if (!req.session.user) {
            return res.status(401).json({ success: false });
        }

        const currentUser = req.session.user.username;
        const text = req.body.text;

        if (!text || !text.trim()) {
            return res.status(400).json({ success: false, message: "Comment cannot be empty." });
        }

        const video = await Video.findById(req.params.id);

        if (!video) {
            return res.status(404).json({ success: false, message: "Video not found." });
        }

        const comment = {
            username: currentUser,
            text: text.trim(),
            createdAt: new Date()
        };

        video.comments.push(comment);

        await video.save();

        const savedComment = video.comments[video.comments.length - 1];

        res.json({
            success: true,
            comment: {
                _id: savedComment._id,
                username: savedComment.username,
                text: savedComment.text,
                createdAt: savedComment.createdAt
            },
            commentCount: video.comments.length
        });

    } catch (error) {

        console.error("Add comment error:", error);

        res.status(500).json({ success: false });

    }

});


// DELETE A COMMENT (only the comment's own author can delete it)
router.post("/video/:videoId/comment/:commentId/delete", async (req, res) => {

    try {

        if (!req.session.user) {
            return res.status(401).json({ success: false });
        }

        const currentUser = req.session.user.username;

        const video = await Video.findById(req.params.videoId);

        if (!video) {
            return res.status(404).json({ success: false, message: "Video not found." });
        }

        const comment = video.comments.id(req.params.commentId);

        if (!comment) {
            return res.status(404).json({ success: false, message: "Comment not found." });
        }

        if (comment.username !== currentUser) {
            return res.status(403).json({ success: false, message: "You can only delete your own comments." });
        }

        comment.deleteOne();

        await video.save();

        res.json({ success: true, commentCount: video.comments.length });

    } catch (error) {

        console.error("Delete comment error:", error);

        res.status(500).json({ success: false });

    }

});


// DELETE A VIDEO (only the uploader can delete their own video)
router.post("/video/:id/delete", async (req, res) => {

    try {

        if (!req.session.user) {
            return res.status(401).send("Please login first.");
        }

        const currentUserId = req.session.user._id;

        const video = await Video.findById(req.params.id);

        if (!video) {
            return res.status(404).send("Video not found.");
        }

        // Only the uploader can delete their own video
        if (video.userId.toString() !== currentUserId.toString()) {
            return res.status(403).send("You can only delete your own videos.");
        }

        // Delete from Cloudinary too, so storage doesn't pile up with orphaned files
        try {

            const cloudinary = require("../config/cloudinary");

            // Extract the public ID from the stored URL to tell Cloudinary what to delete
            const urlParts = video.videoUrl.split("/");
            const fileWithExtension = urlParts[urlParts.length - 1];
            const publicId = "yunerx/videos/" + fileWithExtension.split(".")[0];

            await cloudinary.uploader.destroy(publicId, { resource_type: "video" });

        } catch (cloudinaryError) {

            // Log it, but don't block the DB deletion just because Cloudinary cleanup failed
            console.error("Cloudinary video delete error:", cloudinaryError);

        }

        await Video.findByIdAndDelete(req.params.id);

        res.redirect("/profile");

    } catch (error) {

        console.error("Delete video error:", error);

        res.status(500).send("Unable to delete video.");

    }

});


module.exports = router;
