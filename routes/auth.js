const express = require("express");
const bcrypt = require("bcryptjs");

const User = require("../models/User");

const router = express.Router();

router.get("/register", (req, res) => {
    res.render("register");
});

router.get("/login", (req, res) => {
    res.render("login");
});

router.post("/register", async (req, res) => {

    const { username, email, phone, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
        username,
        email,
        phone,
        password: hashedPassword
    });

    await user.save();

    res.redirect("/login");

});

router.post("/login", async (req, res) => {

    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
        return res.send("User not found");
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
        return res.send("Wrong Password");
    }

    req.session.user = user;

    res.redirect("/profile");

});

router.get("/profile", async (req, res) => {

    if (!req.session.user) {
        return res.redirect("/login");
    }

    const Video = require("../models/Video");

    const videos = await Video.find({
        userId: req.session.user._id
    });


const user = await User.findById(req.session.user._id);

res.render("profile", {

    user,
    videos: []

});


module.exports = router;
