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

        // Get all private messages involving the current user
        const messages = await Message.find({
            $or: [
                { sender: currentUser },
                { receiver: currentUser }
            ]
        })
        .sort({ _id: -1 })
        .lean();

        const unreadMessages = await Message.find({
    receiver: currentUser,
    seen: false
})
.select("sender")
.lean();

const unreadCounts = {};

for (const unreadMessage of unreadMessages) {

    if (!unreadMessage.sender) {
        continue;
    }

    unreadCounts[unreadMessage.sender] =
        (unreadCounts[unreadMessage.sender] || 0) + 1;
}

const conversations = [];
const seenUsers = new Set();

for (const message of messages) {

            const otherUser =
                message.sender === currentUser
                    ? message.receiver
                    : message.sender;

            if (!otherUser) {
                continue;
            }

            // We only need the newest message for each person
            if (seenUsers.has(otherUser)) {
                continue;
            }

            seenUsers.add(otherUser);

            // Count unread messages from this user
           const unreadCount = unreadCounts[otherUser] || 0;

            conversations.push({
                username: otherUser,
                message: message.message,
                time: message.time,
                date: message.date,
                seen: message.seen,
                sender: message.sender,
                unreadCount
            });
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
    try {

        if (!req.session.user) {
            return res.redirect("/login");
        }

        const currentUser = req.session.user.username;

        const search = req.query.search || "";

        const users = await User.find({
            username: {
                $ne: currentUser,
                $regex: search,
                $options: "i"
            }
        }).sort({
            username: 1
        });

        res.render("users", {
            users,
            currentUser,
            search
        });

    } catch (error) {

        console.error("Contacts page error:", error);

        res.status(500).send("Unable to load contacts.");

    }
});



// GROUPS PAGE
router.get("/groups", async (req, res) => {

    try {

        if (!req.session.user) {
            return res.redirect("/login");
        }

        const currentUser = req.session.user.username;

        const groups = await Group.find({
            members: currentUser
        }).sort({
            _id: -1
        });

        res.render("groups", {
            groups,
            currentUser
        });

    } catch (error) {

        console.error("Groups page error:", error);

        res.status(500).send(
            "Unable to load groups."
        );

    }

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

    try {

        if (!req.session.user) {
            return res.redirect(
                "/login?redirect=/group/" +
                encodeURIComponent(req.params.id)
            );
        }

        const currentUser = req.session.user.username;

        const group = await Group.findById(req.params.id);

        if (!group) {
            return res.status(404).send("Group not found.");
        }

        // Check whether the current user belongs to this group
        if (!group.members.includes(currentUser)) {
            return res.status(403).send(
                "You are not a member of this group."
            );
        }

        const messages = await GroupMessage.find({
            groupId: req.params.id
        }).sort({
            _id: 1
        });

        res.render("groupchat", {
            group,
            messages,
            currentUser
        });

    } catch (error) {

        console.error("Group chat error:", error);

        res.status(500).send(
            "Unable to load group chat."
        );

    }

});

module.exports = router;
