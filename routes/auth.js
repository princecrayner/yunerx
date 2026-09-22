const express = require("express");
const bcrypt = require("bcryptjs");

const User = require("../models/User");

const router = express.Router();


const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function getRecentChangeCount(changeDates) {

    const cutoff = Date.now() - THIRTY_DAYS_MS;

    return changeDates.filter(date => date.getTime() > cutoff).length;

}



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

    try {

        const Video = require("../models/Video");

        const user = await User.findById(req.session.user._id);

        if (!user) {

            // Session references a user that no longer exists — clear it and force re-login
            req.session.destroy(() => {
                res.redirect("/login");
            });

            return;

        }

        const longVideos = await Video.find({
            userId: req.session.user._id,
            type: "long"
        }).sort({ createdAt: -1 });

        const shorts = await Video.find({
            userId: req.session.user._id,
            type: "short"
        }).sort({ createdAt: -1 });

        res.render("profile", {
            user,
            longVideos,
            shorts
        });

    } catch (error) {

        console.error("Profile page error:", error);

        res.status(500).send("Unable to load profile.");

    }

});



// =====================================================
// CHANGE USERNAME
// =====================================================

router.post("/change-username", async (req, res) => {

    try {

        if (!req.session.user) {
            return res.redirect("/login");
        }

        const currentUser = await User.findById(req.session.user._id);

        if (!currentUser) {
            return res.redirect("/login");
        }

        const recentChanges = getRecentChangeCount(currentUser.usernameChanges);

        if (recentChanges >= 2) {
            return res.redirect("/settings?error=" + encodeURIComponent("You can only change your username 2 times per month."));
        }

        const newUsername = req.body.username?.trim();

        if (!newUsername || newUsername.length < 4 || newUsername.length > 20) {
            return res.redirect("/settings?error=" + encodeURIComponent("Username must be between 4 and 20 characters."));
        }

        const oldUsername = currentUser.username;

        if (newUsername === oldUsername) {
            return res.redirect("/settings?error=" + encodeURIComponent("That's already your username."));
        }

        // Make sure the new username isn't already taken before touching anything
        const existing = await User.findOne({ username: newUsername });

        if (existing) {
            return res.redirect("/settings?error=" + encodeURIComponent("That username is already taken."));
        }

        currentUser.username = newUsername;
        currentUser.usernameChanges.push(new Date());

        await currentUser.save();

        // ============================================
        // CASCADE: update every other collection that
        // stores this user's OLD username as a string
        // ============================================

        const Group = require("../models/Group");
        const GroupMessage = require("../models/GroupMessage");
        const Video = require("../models/Video");
        const { Message, Story } = require("../models/Message");

        // Private messages
        await Message.updateMany({ sender: oldUsername }, { $set: { sender: newUsername } });
        await Message.updateMany({ receiver: oldUsername }, { $set: { receiver: newUsername } });

        // Group membership + admin
        await Group.updateMany(
            { members: oldUsername },
            { $set: { "members.$[elem]": newUsername } },
            { arrayFilters: [{ elem: oldUsername }] }
        );

        await Group.updateMany({ admin: oldUsername }, { $set: { admin: newUsername } });

        // Group messages
        await GroupMessage.updateMany({ sender: oldUsername }, { $set: { sender: newUsername } });

        // Stories (ownership + who viewed them)
        await Story.updateMany({ username: oldUsername }, { $set: { username: newUsername } });

        await Story.updateMany(
            { "views.username": oldUsername },
            { $set: { "views.$[elem].username": newUsername } },
            { arrayFilters: [{ "elem.username": oldUsername }] }
        );

        // Other users' hide/mute lists that reference this username
        await User.updateMany(
            { hiddenStoryFrom: oldUsername },
            { $set: { "hiddenStoryFrom.$[elem]": newUsername } },
            { arrayFilters: [{ elem: oldUsername }] }
        );

        await User.updateMany(
            { mutedStoryUsers: oldUsername },
            { $set: { "mutedStoryUsers.$[elem]": newUsername } },
            { arrayFilters: [{ elem: oldUsername }] }
        );

        // Video likes, views, comments
        await Video.updateMany(
            { likes: oldUsername },
            { $set: { "likes.$[elem]": newUsername } },
            { arrayFilters: [{ elem: oldUsername }] }
        );

        await Video.updateMany(
            { views: oldUsername },
            { $set: { "views.$[elem]": newUsername } },
            { arrayFilters: [{ elem: oldUsername }] }
        );

        await Video.updateMany(
            { "comments.username": oldUsername },
            { $set: { "comments.$[elem].username": newUsername } },
            { arrayFilters: [{ "elem.username": oldUsername }] }
        );

        // Keep session in sync
        req.session.user.username = newUsername;

        res.redirect("/settings?success=" + encodeURIComponent("Username updated successfully."));

    } catch (error) {

        console.error("Change username error:", error);

        res.redirect("/settings?error=" + encodeURIComponent("Unable to update username."));

    }

});

// =====================================================
// CHANGE EMAIL
// =====================================================

router.post("/change-email", async (req, res) => {

    try {

        if (!req.session.user) {
            return res.redirect("/login");
        }

        const currentUser = await User.findById(req.session.user._id);

        if (!currentUser) {
            return res.redirect("/login");
        }

        const recentChanges = getRecentChangeCount(currentUser.emailChanges);

        if (recentChanges >= 2) {
            return res.redirect("/settings?error=" + encodeURIComponent("You can only change your email 2 times per month."));
        }

        const newEmail = req.body.email?.trim().toLowerCase();

        if (!newEmail) {
            return res.redirect("/settings?error=" + encodeURIComponent("Email is required."));
        }

        if (newEmail === currentUser.email) {
            return res.redirect("/settings?error=" + encodeURIComponent("That's already your email."));
        }

        currentUser.email = newEmail;
        currentUser.emailChanges.push(new Date());

        await currentUser.save();

        req.session.user.email = newEmail;

        res.redirect("/settings?success=" + encodeURIComponent("Email updated successfully."));

    } catch (error) {

        console.error("Change email error:", error);

        if (error.code === 11000) {
            return res.redirect("/settings?error=" + encodeURIComponent("That email is already registered."));
        }

        res.redirect("/settings?error=" + encodeURIComponent("Unable to update email."));

    }

});


// =====================================================
// CHANGE PHONE
// =====================================================

router.post("/change-phone", async (req, res) => {

    try {

        if (!req.session.user) {
            return res.redirect("/login");
        }

        const currentUser = await User.findById(req.session.user._id);

        if (!currentUser) {
            return res.redirect("/login");
        }

        const recentChanges = getRecentChangeCount(currentUser.phoneChanges);

        if (recentChanges >= 2) {
            return res.redirect("/settings?error=" + encodeURIComponent("You can only change your phone number 2 times per month."));
        }

        const newPhone = req.body.phone?.trim();

        if (!newPhone) {
            return res.redirect("/settings?error=" + encodeURIComponent("Phone number is required."));
        }

        if (newPhone === currentUser.phone) {
            return res.redirect("/settings?error=" + encodeURIComponent("That's already your phone number."));
        }

        currentUser.phone = newPhone;
        currentUser.phoneChanges.push(new Date());

        await currentUser.save();

        req.session.user.phone = newPhone;

        res.redirect("/settings?success=" + encodeURIComponent("Phone number updated successfully."));

    } catch (error) {

        console.error("Change phone error:", error);

        if (error.code === 11000) {
            return res.redirect("/settings?error=" + encodeURIComponent("That phone number is already registered."));
        }

        res.redirect("/settings?error=" + encodeURIComponent("Unable to update phone number."));

    }

});


// =====================================================
// CHANGE PASSWORD
// =====================================================

router.post("/change-password", async (req, res) => {

    try {

        if (!req.session.user) {
            return res.redirect("/login");
        }

        const currentUser = await User.findById(req.session.user._id);

        if (!currentUser) {
            return res.redirect("/login");
        }

        const recentChanges = getRecentChangeCount(currentUser.passwordChanges);

        if (recentChanges >= 2) {
            return res.redirect("/settings?error=" + encodeURIComponent("You can only change your password 2 times per month."));
        }

        const { currentPassword, newPassword } = req.body;

        const validPassword = await bcrypt.compare(currentPassword, currentUser.password);

        if (!validPassword) {
            return res.redirect("/settings?error=" + encodeURIComponent("Current password is incorrect."));
        }

        if (!newPassword || newPassword.length < 8 || newPassword.length > 20) {
            return res.redirect("/settings?error=" + encodeURIComponent("New password must be between 8 and 20 characters."));
        }

        currentUser.password = await bcrypt.hash(newPassword, 10);
        currentUser.passwordChanges.push(new Date());

        await currentUser.save();

        res.redirect("/settings?success=" + encodeURIComponent("Password updated successfully."));

    } catch (error) {

        console.error("Change password error:", error);

        res.redirect("/settings?error=" + encodeURIComponent("Unable to update password."));

    }

});




// DELETE ACCOUNT
router.post("/delete-account", async (req, res) => {

    try {

        if (!req.session.user) {
            return res.redirect("/login");
        }

        const currentUserId = req.session.user._id;
        const currentUsername = req.session.user.username;

        const user = await User.findById(currentUserId);

        if (!user) {

            req.session.destroy(() => {
                res.redirect("/login");
            });

            return;

        }

        const validPassword = await bcrypt.compare(req.body.password, user.password);

        if (!validPassword) {
            return res.redirect("/settings?error=" + encodeURIComponent("Incorrect password."));
        }

        // Clean up content owned by this user
        const Video = require("../models/Video");
        const { Story } = require("../models/Message");

        await Video.deleteMany({ userId: currentUserId });
        await Story.deleteMany({ username: currentUsername });

        // Finally, delete the user account itself
        await User.findByIdAndDelete(currentUserId);

        // Destroy the session and log them out
        req.session.destroy(() => {
            res.redirect("/goodbye");
        });

    } catch (error) {

        console.error("Delete account error:", error);

        res.redirect("/settings?error=" + encodeURIComponent("Unable to delete account. Please try again."));

    }

});


module.exports = router;
