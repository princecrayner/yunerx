const Group = require("../models/Group");

const GroupMessage = require("../models/GroupMessage");

const express = require("express");

const router = express.Router();

const multer = require("multer");

const cloudinary = require("../config/cloudinary");

const storyUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024
    }
});

let io;

router.setSocketIO = function(socketIO) {
    io = socketIO;
};

const { Message, Story } = require("../models/Message");

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

            if (seenUsers.has(otherUser)) {
                continue;
            }

            seenUsers.add(otherUser);

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

               // NEW: load the user's real groups, same as /groups does
        const groups = await Group.find({
            members: currentUser
        }).sort({
            _id: -1
        });

               // Get list of contact usernames (people the user has messaged)
        const contactUsernames = conversations.map(
            convo => convo.username
        );

        // Load the current user's own hide/mute preferences
        const currentUserDoc = await User.findOne({ username: currentUser });
        const mutedStoryUsers = currentUserDoc?.mutedStoryUsers || [];

        // Fetch stories from contacts, newest first —
        // excluding anyone the current user has muted,
        // and excluding anyone who has hidden their story from the current user
        const contactStories = await Story.find({
            username: {
                $in: contactUsernames,
                $nin: mutedStoryUsers
            }
        }).sort({ createdAt: -1 });

        // Also filter out stories from users who've hidden their story specifically from this viewer
        const visibleContactStories = [];

        for (const story of contactStories) {

            const storyOwner = await User.findOne({ username: story.username });

            if (storyOwner && storyOwner.hiddenStoryFrom.includes(currentUser)) {
                continue;
            }

            visibleContactStories.push(story);

        }

        // Fetch the current user's own story (if any)
        const myStory = await Story.findOne({
            username: currentUser
        }).sort({ createdAt: -1 });

                // Keep only the newest story per contact (one circle per person)
        const seenStoryUsers = new Set();
        const stories = [];

        for (const story of visibleContactStories) {

            if (seenStoryUsers.has(story.username)) {
                continue;
            }

            seenStoryUsers.add(story.username);
            stories.push(story);

        }

        res.render("chats", {
            messages: conversations,
            groups,
            currentUser,
            stories,
            myStory
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



// STORY PRIVACY SETTINGS PAGE
router.get("/story-privacy", async (req, res) => {

    try {

        if (!req.session.user) {
            return res.redirect("/login");
        }

        const currentUser = req.session.user.username;

        const userDoc = await User.findOne({ username: currentUser });

        // Contacts = people this user has messaged (same logic as /chats)
        const messages = await Message.find({
            $or: [
                { sender: currentUser },
                { receiver: currentUser }
            ]
        }).lean();

        const contactUsernames = new Set();

        for (const message of messages) {

            const otherUser =
                message.sender === currentUser ? message.receiver : message.sender;

            if (otherUser) {
                contactUsernames.add(otherUser);
            }

        }

        res.render("storyprivacy", {
            contacts: Array.from(contactUsernames),
            hiddenStoryFrom: userDoc.hiddenStoryFrom || [],
            mutedStoryUsers: userDoc.mutedStoryUsers || []
        });

    } catch (error) {

        console.error("Story privacy page error:", error);

        res.status(500).send("Unable to load story privacy settings.");

    }

});


// TOGGLE: hide my story from a specific contact
router.post("/story-privacy/hide-from/:username", async (req, res) => {

    try {

        if (!req.session.user) {
            return res.status(401).json({ success: false });
        }

        const currentUser = req.session.user.username;
        const targetUsername = req.params.username;

        const userDoc = await User.findOne({ username: currentUser });

        const isHidden = userDoc.hiddenStoryFrom.includes(targetUsername);

        if (isHidden) {

            userDoc.hiddenStoryFrom = userDoc.hiddenStoryFrom.filter(
                username => username !== targetUsername
            );

        } else {

            userDoc.hiddenStoryFrom.push(targetUsername);

        }

        await userDoc.save();

        res.json({ success: true, hidden: !isHidden });

    } catch (error) {

        console.error("Toggle hide-from error:", error);

        res.status(500).json({ success: false });

    }

});


// TOGGLE: mute a specific user's stories from my own feed
router.post("/story-privacy/mute/:username", async (req, res) => {

    try {

        if (!req.session.user) {
            return res.status(401).json({ success: false });
        }

        const currentUser = req.session.user.username;
        const targetUsername = req.params.username;

        const userDoc = await User.findOne({ username: currentUser });

        const isMuted = userDoc.mutedStoryUsers.includes(targetUsername);

        if (isMuted) {

            userDoc.mutedStoryUsers = userDoc.mutedStoryUsers.filter(
                username => username !== targetUsername
            );

        } else {

            userDoc.mutedStoryUsers.push(targetUsername);

        }

        await userDoc.save();

        res.json({ success: true, muted: !isMuted });

    } catch (error) {

        console.error("Toggle mute error:", error);

        res.status(500).json({ success: false });

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

    try {

        if (!req.session.user) {
            return res.redirect("/login");
        }

        const currentUser = req.session.user.username;

        const group = new Group({

            groupName: req.body.groupName,

            admin: currentUser,

            members: [currentUser]

        });

        await group.save();

      res.redirect("/chats?tab=groups");

    } catch (error) {

        console.error("Create group error:", error);

        res.status(500).send(
            "Unable to create group."
        );

    }

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


// =========================================
// ADD MEMBERS PAGE
// =========================================

router.get("/group/:id/addmembers", async (req, res) => {

    try {

        if (!req.session.user) {
            return res.redirect("/login");
        }

        const currentUser = req.session.user.username;

        // Find the group
        const group = await Group.findById(req.params.id);

        if (!group) {
            return res.status(404).send("Group not found.");
        }

        // Only the admin can open this page
        if (group.admin !== currentUser) {
             return res.status(403).send(
        "Only the group admin can add members."
         );
       }

        // Get users who are NOT already members
        const users = await User.find({
            username: {
                $ne: currentUser,
                $nin: group.members
            }
        }).sort({
            username: 1
        });

        res.render("addmembers", {
            group,
            users,
            currentUser
        });

    } catch (error) {

        console.error("Add members page error:", error);

        res.status(500).send(
            "Unable to load add members page."
        );

    }

});


// =========================================
// ADD MEMBER TO GROUP
// =========================================

router.post("/group/:id/addmembers", async (req, res) => {

    try {

        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: "Please login first."
            });
        }

        const currentUser = req.session.user.username;

        // Find the group
        const group = await Group.findById(req.params.id);

        if (!group) {
            return res.status(404).json({
                success: false,
                message: "Group not found."
            });
        }


        // Only the admin can add new members
       if (group.admin !== currentUser) {
          return res.status(403).json({
        success: false,
        message: "Only the group admin can add members."
        });
      }

        const username = req.body.username;

        if (!username) {
            return res.status(400).json({
                success: false,
                message: "Username is required."
            });
        }

        // Find the user
        const user = await User.findOne({
            username
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        // Check if already a member
        if (group.members.includes(username)) {
            return res.status(400).json({
                success: false,
                message: "User is already a member."
            });
        }

        // Add the user
        group.members.push(username);

        await group.save();

        res.json({
            success: true,
            message: username + " added to the group."
        });

    } catch (error) {

        console.error("Add member error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to add member."
        });

    }

});


// REMOVE MEMBER FROM GROUP (admin only)
router.post("/group/:id/removemember", async (req, res) => {

    try {

        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: "Please login first."
            });
        }

        const currentUser = req.session.user.username;

        const group = await Group.findById(req.params.id);

        if (!group) {
            return res.status(404).json({
                success: false,
                message: "Group not found."
            });
        }

        // Only the admin can remove members
        if (group.admin !== currentUser) {
            return res.status(403).json({
                success: false,
                message: "Only the group admin can remove members."
            });
        }

        const username = req.body.username;

        if (!username) {
            return res.status(400).json({
                success: false,
                message: "Username is required."
            });
        }

        // Admin cannot remove themselves this way — they should use Leave Group
        if (username === currentUser) {
            return res.status(400).json({
                success: false,
                message: "Use Leave Group to remove yourself."
            });
        }

        if (!group.members.includes(username)) {
            return res.status(400).json({
                success: false,
                message: "User is not a member of this group."
            });
        }

        group.members = group.members.filter(
            member => member !== username
        );

        await group.save();

        res.json({
            success: true,
            message: username + " removed from the group."
        });

    } catch (error) {

        console.error("Remove member error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to remove member."
        });

    }

});


// LEAVE GROUP
router.post("/group/:id/leave", async (req, res) => {

    try {

        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: "Please login first."
            });
        }

        const currentUser = req.session.user.username;

        const group = await Group.findById(req.params.id);

        if (!group) {
            return res.status(404).json({
                success: false,
                message: "Group not found."
            });
        }

        if (!group.members.includes(currentUser)) {
            return res.status(400).json({
                success: false,
                message: "You are not a member of this group."
            });
        }

        // Remove the user from members
        group.members = group.members.filter(
            member => member !== currentUser
        );

        // If the admin is leaving, hand admin role to the next member
        if (group.admin === currentUser) {

            if (group.members.length > 0) {
                group.admin = group.members[0];
            } else {
                // No members left — delete the group entirely
                await Group.findByIdAndDelete(req.params.id);

                return res.json({
                    success: true,
                    groupDeleted: true
                });
            }

        }

        await group.save();

        res.json({
            success: true,
            groupDeleted: false
        });

    } catch (error) {

        console.error("Leave group error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to leave group."
        });

    }

});



// CREATE STORY PAGE
router.get("/createstory", (req, res) => {

    if (!req.session.user) {
        return res.redirect("/login");
    }

    res.render("createstory");

});



       // CREATE STORY (text, image, or video)
router.post(
    "/createstory",
    storyUpload.single("media"),
    async (req, res) => {

        try {

            if (!req.session.user) {
                return res.redirect("/login");
            }

            const currentUser = req.session.user.username;

            const text = req.body.text;

            const now = new Date();
            const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

            // CASE 1: a file was uploaded (image or video)
            if (req.file) {

                const isVideo = req.file.mimetype.startsWith("video");

                const result = await new Promise((resolve, reject) => {

                    const stream = cloudinary.uploader.upload_stream(
                        {
                            folder: "yunerx/stories",
                            resource_type: isVideo ? "video" : "image"
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

                const story = new Story({
                    username: currentUser,
                    type: isVideo ? "video" : "image",
                    content: result.secure_url,
                    expiresAt
                });

                await story.save();

                return res.redirect("/chats");

            }

            // CASE 2: text-only story
            if (!text || !text.trim()) {
                return res.status(400).send("Story text or media is required.");
            }

            const story = new Story({
                username: currentUser,
                type: "text",
                content: text.trim(),
                expiresAt
            });

            await story.save();

            res.redirect("/chats");

        } catch (error) {

            console.error("Create story error:", error);

            res.status(500).send("Unable to create story.");

        }

    }
);


// VIEW A USER'S STORY
router.get("/story/:username", async (req, res) => {

    try {

        if (!req.session.user) {
            return res.redirect(
                "/login?redirect=/story/" +
                encodeURIComponent(req.params.username)
            );
        }

        const currentUser = req.session.user.username;
        const storyUsername = req.params.username;

        const story = await Story.findOne({
            username: storyUsername
        }).sort({ createdAt: -1 });

        if (!story) {
            return res.status(404).send("This story is no longer available.");
        }

        // Only allow viewing your own story, or a contact's story
        if (storyUsername !== currentUser) {

            const hasChatted = await Message.findOne({
                $or: [
                    { sender: currentUser, receiver: storyUsername },
                    { sender: storyUsername, receiver: currentUser }
                ]
            });

            if (!hasChatted) {
                return res.status(403).send("You can't view this story.");
            }

            // Record the view, but only once per viewer per story,
            // and never record the owner viewing their own story
            const alreadyViewed = story.views.some(
                view => view.username === currentUser
            );

            if (!alreadyViewed) {

                story.views.push({ username: currentUser });

                await story.save();

            }

        }

        // If this is the owner looking at their own story, load who viewed it
        let viewers = [];

        if (storyUsername === currentUser) {
            viewers = story.views.slice().reverse();
        }

        res.render("story", {
            story,
            storyUsername,
            currentUser,
            viewers,
            viewCount: story.views.length
        });

    } catch (error) {

        console.error("View story error:", error);

        res.status(500).send("Unable to load story.");

    }

});


module.exports = router;
