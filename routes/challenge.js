const express = require("express");
const router = express.Router();

const Question = require("../models/Question");
const User = require("../models/User");
const { DailyChallenge, ChallengeAttempt, ChallengeStart } = require("../models/Challenge");
const { dateKey, weekKey, previousDateKey } = require("../utils/challengeDates");

const TOTAL = 10;                    // questions per day
const WANT_FILL = 3;                 // how many should be fill-in (topped up with objective if there aren't enough yet)
const RECENT_DAYS = 5;               // don't repeat questions used in the last few days
const LEVELS = ["100", "200", "300"];
const MAX_TIME_MS = 30 * 60 * 1000;  // a run counts as 30 minutes at most


// =====================================================
// PICKING TODAY'S QUESTIONS
// =====================================================

function shuffle(list) {

    const copy = list.slice();

    for (let i = copy.length - 1; i > 0; i--) {

        const j = Math.floor(Math.random() * (i + 1));

        [copy[i], copy[j]] = [copy[j], copy[i]];

    }

    return copy;

}

async function pickQuestions(excludeIds) {

    const fill = await Question.aggregate([
        { $match: { type: "fill", _id: { $nin: excludeIds } } },
        { $sample: { size: WANT_FILL } }
    ]);

    const objective = await Question.aggregate([
        { $match: { type: "objective", _id: { $nin: excludeIds } } },
        { $sample: { size: TOTAL - fill.length } }
    ]);

    return [...objective, ...fill];

}

// Created by whoever opens it first, then saved so everyone gets the same 10
async function getTodaysChallenge() {

    const key = dateKey();

    const existing = await DailyChallenge.findOne({ dateKey: key }).lean();

    if (existing) {
        return existing;
    }

    const recent = await DailyChallenge.find()
        .sort({ dateKey: -1 })
        .limit(RECENT_DAYS)
        .select("questions")
        .lean();

    const recentIds = recent.flatMap((c) => c.questions);

    let picked = await pickQuestions(recentIds);

    // Small question bank? Allow repeats rather than a short challenge
    if (picked.length < TOTAL) {
        picked = await pickQuestions([]);
    }

    if (picked.length === 0) {
        return null;
    }

    try {

        const created = await DailyChallenge.create({
            dateKey: key,
            questions: shuffle(picked).map((q) => q._id)
        });

        return created.toObject();

    } catch (error) {

        // Someone else created today's set at the same moment: use theirs
        if (error.code === 11000) {
            return DailyChallenge.findOne({ dateKey: key }).lean();
        }

        throw error;

    }

}


// =====================================================
// MARKING
// =====================================================

// Makes "  Composition. " and "composition" the same, and "1,000" the same as "1000"
function normalize(text) {

    return String(text == null ? "" : text)
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")                 // é -> e
        .toLowerCase()
        .replace(/[\u2018\u2019\u201C\u201D'"`]/g, "")   // quote marks
        .replace(/,/g, "")                               // thousands separators
        .replace(/\s+/g, " ")
        .trim()
        .replace(/[.\s]+$/g, "");                        // a full stop at the end
}

function isCorrect(question, given) {

    if (question.type === "objective") {
        return String(given).trim().toUpperCase() === question.answer;
    }

    if (question.type === "fill") {

        const typed = normalize(given);

        if (typed === "") {
            return false;
        }

        return (question.acceptedAnswers || []).some((accepted) => {

            const expected = normalize(accepted);

            if (expected === typed) {
                return true;
            }

            // numbers: 15 = 15.0 = 015
            return expected !== "" && !isNaN(expected) && !isNaN(typed) &&
                   Number(expected) === Number(typed);

        });

    }

    return false;

}


// =====================================================
// START TIME + STREAK
// =====================================================

// Saved only the FIRST time someone opens today's questions, so refreshing doesn't reset the clock
async function recordStart(userId, key) {

    try {

        return await ChallengeStart.findOneAndUpdate(
            { userId, dateKey: key },
            { $setOnInsert: { startedAt: new Date() } },
            { upsert: true, new: true }
        ).lean();

    } catch (error) {

        // Two tabs at once: the first one already saved it
        if (error.code === 11000) {
            return ChallengeStart.findOne({ userId, dateKey: key }).lean();
        }

        throw error;

    }

}

// Days in a row. Still alive if you played yesterday but haven't played yet today.
async function currentStreak(userId, today) {

    const attempts = await ChallengeAttempt.find({ userId })
        .sort({ dateKey: -1 })
        .limit(400)
        .select("dateKey")
        .lean();

    const played = new Set(attempts.map((a) => a.dateKey));

    let cursor = played.has(today) ? today : previousDateKey(today);

    let streak = 0;

    while (played.has(cursor)) {
        streak++;
        cursor = previousDateKey(cursor);
    }

    return streak;

}


// =====================================================
// ROUTES
// =====================================================

// Choose your level (100 / 200 / 300)
router.post("/challenge/level", async (req, res) => {

    if (!req.session.user) {
        return res.status(401).json({ loginRequired: true });
    }

    try {

        const level = String(req.body.level || "");

        if (!LEVELS.includes(level)) {
            return res.status(400).json({ message: "Level must be 100, 200 or 300." });
        }

        await User.findByIdAndUpdate(req.session.user._id, { level });

        req.session.user.level = level;

        res.json({ success: true, level });

    } catch (error) {

        console.error("Challenge level error:", error);

        res.status(500).json({ message: "Unable to save your level." });

    }

});


// Today's questions, WITHOUT the answers or explanations
router.get("/challenge/today", async (req, res) => {

    if (!req.session.user) {
        return res.status(401).json({ loginRequired: true });
    }

    try {

        const userId = req.session.user._id;

        res.set("Cache-Control", "no-store");

        // The clock only starts after a level is chosen
        const user = await User.findById(userId).select("level").lean();

        if (!user || !LEVELS.includes(user.level)) {
            return res.json({ needLevel: true });
        }

        const challenge = await getTodaysChallenge();

        if (!challenge) {
            return res.status(503).json({ message: "No questions are available yet." });
        }

        const attempt = await ChallengeAttempt.findOne({
            userId,
            dateKey: challenge.dateKey
        }).select("score timeMs").lean();

        // Already played today: no questions again (stops them being shared)
        if (attempt) {
            return res.json({
                dateKey: challenge.dateKey,
                level: user.level,
                alreadyPlayed: true,
                result: { score: attempt.score, timeMs: attempt.timeMs },
                questions: []
            });
        }

        const start = await recordStart(userId, challenge.dateKey);

        const found = await Question.find({ _id: { $in: challenge.questions } }).lean();

        const byId = new Map(found.map((q) => [String(q._id), q]));

        // Keep the saved order, and only send what a student is allowed to see
        const questions = challenge.questions
            .map((id) => byId.get(String(id)))
            .filter(Boolean)
            .map((q) => ({
                _id: q._id,
                type: q.type,
                subject: q.subject,
                question: q.question,
                options: q.type === "objective" ? q.options : undefined
            }));

          res.json({
            dateKey: challenge.dateKey,
            level: user.level,
            alreadyPlayed: false,
            total: questions.length,
            elapsedMs: Math.max(0, Math.min(Date.now() - new Date(start.startedAt).getTime(), MAX_TIME_MS)),
            questions
        });

    } catch (error) {

        console.error("Challenge today error:", error);

        res.status(500).json({ message: "Unable to load today's challenge." });

    }

});


// Submit answers: the server marks them, times the run and saves ONE attempt for today
router.post("/challenge/submit", async (req, res) => {

    if (!req.session.user) {
        return res.status(401).json({ loginRequired: true });
    }

    try {

        const userId = req.session.user._id;
        const key = dateKey();

        const user = await User.findById(userId).select("level").lean();

        if (!user || !LEVELS.includes(user.level)) {
            return res.status(400).json({ needLevel: true, message: "Choose your level first." });
        }

        const challenge = await DailyChallenge.findOne({ dateKey: key }).lean();
        const start = await ChallengeStart.findOne({ userId, dateKey: key }).lean();

        // Nothing opened today: usually a page left open since yesterday
        if (!challenge || !start) {
            return res.status(409).json({ stale: true, message: "Please reload the page to open today's challenge." });
        }

        const alreadyPlayed = await ChallengeAttempt.exists({ userId, dateKey: key });

        if (alreadyPlayed) {
            return res.status(409).json({ alreadyPlayed: true, message: "You have already played today." });
        }

        const submitted = Array.isArray(req.body.answers) ? req.body.answers : [];

        const todaysIds = new Set(challenge.questions.map(String));

        // Questions from a different day: refuse, without using up today's attempt
        if (submitted.some((a) => !a || !todaysIds.has(String(a.questionId)))) {
            return res.status(409).json({ stale: true, message: "Today's challenge has changed. Please reload the page." });
        }

        const given = new Map();

        submitted.forEach((a) => {
            given.set(String(a.questionId), String(a.answer == null ? "" : a.answer).slice(0, 200));
        });

        const found = await Question.find({ _id: { $in: challenge.questions } }).lean();

        const byId = new Map(found.map((q) => [String(q._id), q]));

        const results = [];

        let score = 0;

        for (const id of challenge.questions) {

            const q = byId.get(String(id));

            if (!q) {
                continue;               // deleted since the day began
            }

            const answer = given.get(String(id)) || "";
            const correct = isCorrect(q, answer);

            if (correct) {
                score++;
            }

            results.push({ q, answer, correct });

        }

        // Timed by the server, never by the browser
        const timeMs = Math.max(0, Math.min(Date.now() - new Date(start.startedAt).getTime(), MAX_TIME_MS));

        try {

            await ChallengeAttempt.create({
                userId,
                dateKey: key,
                weekKey: weekKey(),
                level: user.level,
                score,
                timeMs,
                answers: results.map((r) => ({
                    questionId: r.q._id,
                    given: r.answer,
                    correct: r.correct
                }))
            });

        } catch (error) {

            // Two submits at the same moment: the database lets only one through
            if (error.code === 11000) {
                return res.status(409).json({ alreadyPlayed: true, message: "You have already played today." });
            }

            throw error;

        }

        const streak = await currentStreak(userId, key);

        // The attempt is locked in now, so it's safe to reveal the answers
        res.json({
            score,
            total: results.length,
            timeMs,
            streak,
            results: results.map((r) => ({
                questionId: r.q._id,
                question: r.q.question,
                yourAnswer: r.answer,
                correct: r.correct,
                correctAnswer: r.q.type === "objective"
                    ? r.q.answer + ". " + r.q.options[r.q.answer]
                    : (r.q.acceptedAnswers || [])[0] || "",
                explanation: r.q.explanation || ""
            }))
        });

    } catch (error) {

        console.error("Challenge submit error:", error);

        res.status(500).json({ message: "Unable to submit your answers." });

    }

});


// The Arena page itself
router.get("/arena", (req, res) => {

    if (!req.session.user) {
        return res.redirect("/login?redirect=/arena");
    }

    res.render("arena", { currentUser: req.session.user.username });

});


// What the Arena home screen needs. It does NOT start the clock.
router.get("/challenge/status", async (req, res) => {

    if (!req.session.user) {
        return res.status(401).json({ loginRequired: true });
    }

    try {

        const userId = req.session.user._id;
        const key = dateKey();

        res.set("Cache-Control", "no-store");

        const user = await User.findById(userId).select("level").lean();

        if (!user || !LEVELS.includes(user.level)) {
            return res.json({ needLevel: true });
        }

        const attempt = await ChallengeAttempt.findOne({ userId, dateKey: key })
            .select("score timeMs")
            .lean();

        const started = attempt ? null : await ChallengeStart.exists({ userId, dateKey: key });

        const streak = await currentStreak(userId, key);

        res.json({
            dateKey: key,
            level: user.level,
            total: TOTAL,
            streak,
            alreadyPlayed: !!attempt,
            inProgress: !!started,
            result: attempt ? { score: attempt.score, timeMs: attempt.timeMs } : null
        });

    } catch (error) {

        console.error("Challenge status error:", error);

        res.status(500).json({ message: "Unable to load the challenge." });

    }

});


// This week's board for one level: total of the week's daily scores, ties go to the faster total time
router.get("/challenge/leaderboard", async (req, res) => {

    if (!req.session.user) {
        return res.status(401).json({ loginRequired: true });
    }

    try {

        const level = String(req.query.level || "");

        if (!LEVELS.includes(level)) {
            return res.status(400).json({ message: "Level must be 100, 200 or 300." });
        }

        const wk = weekKey();

        const rows = await ChallengeAttempt.aggregate([
            { $match: { weekKey: wk, level } },
            { $group: {
                _id: "$userId",
                points: { $sum: "$score" },
                timeMs: { $sum: "$timeMs" },
                days: { $sum: 1 }
            } },
            { $sort: { points: -1, timeMs: 1, _id: 1 } }
        ]);

        const top = rows.slice(0, 50);

        const users = await User.find({ _id: { $in: top.map((r) => r._id) } })
            .select("username profileImage")
            .lean();

        const byId = new Map(users.map((u) => [String(u._id), u]));

        const meId = String(req.session.user._id);

        const myIndex = rows.findIndex((r) => String(r._id) === meId);

        res.set("Cache-Control", "no-store");

        res.json({
            level,
            weekKey: wk,
            totalPlayers: rows.length,
            leaders: top.map((r, i) => {

                const u = byId.get(String(r._id)) || {};

                return {
                    rank: i + 1,
                    username: u.username || "Deleted user",
                    profileImage: u.profileImage || "",
                    points: r.points,
                    days: r.days,
                    timeMs: r.timeMs,
                    isMe: String(r._id) === meId
                };

            }),
            mine: myIndex === -1 ? null : {
                rank: myIndex + 1,
                points: rows[myIndex].points,
                days: rows[myIndex].days,
                timeMs: rows[myIndex].timeMs
            }
        });

    } catch (error) {

        console.error("Challenge leaderboard error:", error);

        res.status(500).json({ message: "Unable to load the leaderboard." });

    }

});

module.exports = router;
