const Group = require("../models/Group");

const GroupMessage = require("../models/GroupMessage");

const express = require("express");

const router = express.Router();

const Message = require("../models/Message");

const User = require("../models/User");

router.get("/chats", async (req, res) => {

    if (!req.session.user) {
        return res.redirect("/login");
    }

    const messages = await Message.find();

    res.render("chats", {
        messages
    });

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
