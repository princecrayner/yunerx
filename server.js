const docsRoutes = require("./routes/docs");

const pdfRoutes = require("./routes/pdfs");

const multer = require("multer");
const path = require("path");

const GroupMessage = require("./models/GroupMessage");
const Message = require("./models/Message");

const http = require("http");
const { Server } = require("socket.io");

const authRoutes = require("./routes/auth");
const videoRoutes = require("./routes/videos");
const chatRoutes = require("./routes/chats");

const session = require("express-session");

const mongoose = require("mongoose");
const Question = require("./models/Question");
const adminRoutes = require("./routes/admin");

const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// PROFILE IMAGE STORAGE
const storage = multer.diskStorage({

    destination: (req, file, cb) => {

        cb(null, "public/uploads/");
    },

    filename: (req, file, cb) => {

        cb(null, Date.now() + path.extname(file.originalname));
    }

});

const upload = multer({ storage });



require("dotenv").config();

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));
app.use("/admin", adminRoutes);
app.use("/docs", docsRoutes);
app.use("/", pdfRoutes);
app.use("/", authRoutes);
app.use("/", videoRoutes);
app.use("/", chatRoutes);

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB connected"))
.catch(err => console.log(err));

app.use("/admin", adminRoutes);

// Load questions
function loadQuestions() {
    return JSON.parse(fs.readFileSync("questions.json"));
}

// Home page
app.get("/", (req, res) => {

    res.render("index", {

        user: req.session.user

    });

});


// DOCS PAGE 
app.get("/docs", (req, res) => {
    res.render("docs");
});

// SETTINGS PAGE
app.get("/settings", (req, res) => {
    res.render("settings");
});

// ABOUT PAGE
app.get("/about", (req, res) => {
    res.render("about");
});

// CONTACT PAGE
app.get("/contact", (req, res) => {
    res.render("contact");
});


// PROFILE PAGE
app.get("/profile", async (req, res) => {

    res.render("profile", {

        user: req.session.user,
        videos: []

    });

});


// UPLOAD PROFILE IMAGE
app.post("/upload-profile",
upload.single("profileImage"),

async (req, res) => {

    req.session.user.profileImage =
        "/uploads/" + req.file.filename;

    res.redirect("/profile");

});

// LOGOUT PAGE
app.get("/logout", (req, res) => {
    res.render("logout");
});


// LEVEL PAGES
app.get("/levels/level100", (req, res) => {
    res.render("levels/level100");
});

app.get("/levels/level200", (req, res) => {
    res.render("levels/level200");
});

app.get("/levels/level300", (req, res) => {
    res.render("levels/level300");
});

// PRIMARY + JHS PAGES

app.get("/primary/100primary", (req, res) => {
    res.render("primary/100primary");
});

app.get("/jhs/100jhs", (req, res) => {
    res.render("jhs/100jhs");
});

app.get("/primary/200primary", (req, res) => {
    res.render("primary/200primary");
});

app.get("/jhs/200jhs", (req, res) => {
    res.render("jhs/200jhs");
});

app.get("/primary/300primary", (req, res) => {
    res.render("primary/300primary");
});

app.get("/jhs/300jhs", (req, res) => {
    res.render("jhs/300jhs");
});

app.get("/objectivequizes", (req, res) => {
    res.render("objectivequizes");
});

app.get("/theorysubjects", (req, res) => {
    res.render("theorysubjects");
});

// Start objective from index 0
app.get("/objective", (req, res) => {
    const data = loadQuestions();
    const index = 0;

    const question = data.objective[index];

    res.render("objective", {
        question,
        index,
        total: data.objective.length
    });
});

// Next questions
app.get("/objective/:index", (req, res) => {
    const data = loadQuestions();
    const index = parseInt(req.params.index);

    const question = data.objective[index];

    if (!question) {
        return res.send("<h2>Quiz Completed 🎉</h2><a href='/'>Go Home</a>");
    }

    res.render("objective", {
        question,
        index,
        total: data.objective.length
    });
});


// THEORY MODE
app.get("/theory", (req, res) => {
    const data = loadQuestions();
    res.render("theory", { theory: data.theory });
});


server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});



app.get("/objective", async (req, res) => {
    const questions = await Question.aggregate([
        { $match: { type: "objective" } },
        { $sample: { size: 1 } }
    ]);

    if (!questions.length) {
        return res.send("No questions available");
    }

    res.render("objective", {
        question: questions[0],
        index: 0,
        total: 1
    });
});



app.get("/objective/category/:name", async (req, res) => {
    const questions = await Question.aggregate([
        { $match: { type: "objective", category: req.params.name } },
        { $sample: { size: 1 } }
    ]);

    if (!questions.length) {
        return res.send("No questions in this category");
    }

    res.render("objective", {
        question: questions[0],
        index: 0,
        total: 1
    });
});



app.get("/quiz/:objectivequizes", async (req, res) => {

    const questions = await Question.find({
        category: req.params.subject
    });

    if (!questions.length) {
        return res.send("No quizes available for this subject");
    }

    res.render("objective", {
        question: questions[0],
        index: 0,
        total: questions.length
    });

});


app.get("/theory/:subject", async (req, res) => {

    const questions = await Question.find({
        category: req.params.subject
    });

    res.render("theory", {
        questions
    });

});


io.on("connection", (socket) => {

    console.log("User Connected");

    socket.on("sendMessage", async (data) => {

      const message = new Message(data);

        await message.save();

   io.emit("receiveMessage", data);

   });


socket.on("groupMessage", async (data) => {

    const message = new GroupMessage(data);

    await message.save();

    io.emit("receiveGroupMessage", data);

   });

});


// CONFIRM LOGOUT
app.get("/confirmlogout", (req, res) => {

    req.session.destroy(() => {

        res.render("goodbye");

    });

});
