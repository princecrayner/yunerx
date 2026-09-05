const Group = require("../models/Group");

const GroupMessage = require("../models/GroupMessage");

const express = require("express");

const router = express.Router();

let io;

router.setSocketIO = function(socketIO) {
    io = socketIO;
};

const Message = require("../models/Message");

const User = require("../models/User");



router.get("/chats", async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect("/login?redirect=/chats");
        }

        const currentUser = req.session.user.username;

        const messages = await Message.find({
            $or: [
                { sender: currentUser },
                { receiver: currentUser }
            ]
        }).sort({ _id: -1 });

        const conversations = [];
        const seenUsers = new Set();

        for (const message of messages) {

            let otherUser;

            if (message.sender === currentUser) {
                otherUser = message.receiver;
            } else {
                otherUser = message.sender;
            }

            if (!otherUser) continue;

            if (!seenUsers.has(otherUser)) {

                seenUsers.add(otherUser);

                // Count unread messages from this user
                const unreadCount = await Message.countDocuments({
                    sender: otherUser,
                    receiver: currentUser,
                    seen: false
                });

                conversations.push({
                    username: otherUser,
                    message: message.message,
                    time: message.time,
                    date: message.date,
                    seen: message.seen,
                    sender: message.sender,
                    unreadCount: unreadCount
                });
            }
        }

        res.render("chats", {
            messages: conversations,
            groups: [],
            currentUser
        });

    } catch (error) {

        console.error("Chats page error:", error);

        res.status(500).send("Unable to load chats.");
    }
});



// =========================================
// PRIVATE CHAT
// =========================================

router.get("/chat/:username", async (req, res) => {

    try {

        if (!req.session.user) {
            return res.redirect(
                "/login?redirect=/chat/" +
                encodeURIComponent(req.params.username)
            );
        }

        const currentUser = req.session.user.username;
        const otherUser = req.params.username;

        // Find the other user
        const user = await User.findOne({
            username: otherUser
        });

        if (!user) {
            return res.status(404).send("User not found.");
        }

        // Get messages between these two users
        const messages = await Message.find({
            $or: [
                {
                    sender: currentUser,
                    receiver: otherUser
                },
                {
                    sender: otherUser,
                    receiver: currentUser
                }
            ]
        }).sort({ _id: 1 });

        res.render("chat", {
            messages,
            currentUser,
            otherUser,
            user
        });

    } catch (error) {

        console.error(
            "Private chat error:",
            error
        );

        res.status(500).send(
            "Unable to load conversation."
        );

    }

});


// MARK PRIVATE MESSAGES AS SEEN
router.post("/chat/:username/seen", async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                success: false
            });
        }

        const currentUser = req.session.user.username;
        const otherUser = req.params.username;

        const result = await Message.updateMany(
            {
                sender: otherUser,
                receiver: currentUser,
                seen: false
            },
            {
                $set: {
                    seen: true
                }
            }
        );

        if (result.modifiedCount > 0 && io) {

            io.to(`user:${otherUser}`)
                .emit("messagesSeen", {
                    by: currentUser
                });

        }

        res.json({
            success: true
        });

    } catch (error) {
        console.error("Mark messages seen error:", error);

        res.status(500).json({
            success: false
        });
    }
});



router.get("/users", async (req, res) => {

    const users = await User.find();

    res.render("users", {
        users
    });

});


// GROUPS PAGE
router.get("/groups", async (req, res) => {

    if(!req.session.user){
        return res.redirect("/login");
    }

    const groups = await Group.find();

    res.render("groups", {
        groups
    });

});

// CREATE GROUP PAGE
router.get("/creategroup", (req, res) => {

    if(!req.session.user){
        return res.redirect("/login");
    }

    res.render("creategroup");

});

// CREATE GROUP
router.post("/creategroup", async (req, res) => {

    const group = new Group({

        groupName: req.body.groupName,

        members: [req.session.user.username]

    });

    await group.save();

    res.redirect("/groups");

});

// SINGLE GROUP CHAT
router.get("/group/:id", async (req, res) => {

    const group = await Group.findById(req.params.id);

    const messages = await GroupMessage.find({
        groupId: req.params.id
    });

    res.render("groupchat", {
        group,
        messages
    });

});

module.exports = router;
