const express = require("express");
const bcrypt = require("bcryptjs");

const User = require("../models/User");

const router = express.Router();

router.get("/register", (req, res) => {
    res.render("register");
});

router.get("/login", (req, res) => {
       if (req.query.redirect) {
           req.session.redirectTo = req.query.redirect;
           }
    res.render("login");
});

router.post("/register", async (req, res) => {

    try {

        const { username, email, phone, password } = req.body;

                if (!username || !email || !phone || !password) {
            return res.redirect("/register?error=" + encodeURIComponent("All fields are required."));
        }

        if (password.length < 8) {
            return res.redirect("/register?error=" + encodeURIComponent("Password must be at least 8 characters."));
        }

        if (password.length > 20) {
            return res.redirect("/register?error=" + encodeURIComponent("Password must be no more than 20 characters."));
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({
            username,
            email,
            phone,
            password: hashedPassword
        });

        await user.save();

        res.redirect("/login");

    } catch (error) {

        console.error("Register error:", error);

        if (error.code === 11000) {

            const duplicateField = Object.keys(error.keyPattern)[0];

            return res.redirect(
                "/register?error=" + encodeURIComponent(`That ${duplicateField} is already taken.`)
            );

        }

        if (error.name === "ValidationError") {

            const firstError = Object.values(error.errors)[0].message;

            return res.redirect(
                "/register?error=" + encodeURIComponent(firstError)
            );

        }

        res.redirect(
            "/register?error=" + encodeURIComponent("Unable to register. Please try again.")
        );

    }

});

router.post("/login", async (req, res) => {

    try {

        const { email, password } = req.body;

        const user = await User.findOne({ email });

        if (!user) {
            return res.send("User not found");
        }

        const validPassword =
            await bcrypt.compare(
                password,
                user.password
            );

        if (!validPassword) {
            return res.send("Wrong Password");
        }

        // Store only the important user information
        // in the session
        req.session.user = {
            _id: user._id,
            username: user.username,
            email: user.email,
            phone: user.phone,
            profileImage: user.profileImage
        };

        req.session.save((err) => {

            if (err) {

                console.error(
                    "Session save error:",
                    err
                );

                return res.send(
                    "Unable to create session."
                );

            }

            const redirectTo = req.session.redirectTo || "/profile";
            delete req.session.redirectTo;
            
            res.redirect(redirectTo);

        });

    } catch (error) {

        console.error(
            "Login error:",
            error
        );

        res.status(500).send(
            "Unable to login."
        );

    }

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

console.log("PROFILE USER:", user);

res.render("profile", {

    user,
    videos
  });
});
 

module.exports = router;
