const express = require("express");
const router = express.Router();

const Question = require("../models/Question");
const { DailyChallenge, ChallengeAttempt } = require("../models/Challenge");
const { dateKey } = require("../utils/challengeDates");

const TOTAL = 10;          // questions per day
const WANT_FILL = 3;       // how many should be fill-in (topped up with objective if there aren't enough yet)
const RECENT_DAYS = 5;     // don't repeat questions used in the last few days


function shuffle(list) {

    const copy = list.slice();

    for (let i = copy.length - 1; i > 0; i--) {

        const j = Math.floor(Math.random() * (i + 1));

        [copy[i], copy[j]] = [copy[j], copy[i]];

    }

    return copy;

}


// Random questions, skipping any ids in excludeIds
async function pickQuestions(excludeIds) {

    const fill = await Question.aggregate([
        { $match: { type: "fill", _id: { $nin: excludeIds } } },
        { $sample: { size: WANT_FILL } }
    ]);

    // If there aren't 3 fill-in questions yet, objective ones fill the gap
    const objective = await Question.aggregate([
        { $match: { type: "objective", _id: { $nin: excludeIds } } },
        { $sample: { size: TOTAL - fill.length } }
    ]);

    return [...objective, ...fill];

}


// Today's set: created by whoever opens it first, then saved so everyone gets the same 10
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


// Today's questions, WITHOUT the answers or explanations
router.get("/challenge/today", async (req, res) => {

    if (!req.session.user) {
        return res.status(401).json({ loginRequired: true });
    }

    try {

        const challenge = await getTodaysChallenge();

        if (!challenge) {
            return res.status(503).json({ message: "No questions are available yet." });
        }

        const attempt = await ChallengeAttempt.findOne({
            userId: req.session.user._id,
            dateKey: challenge.dateKey
        }).select("score timeMs").lean();

        res.set("Cache-Control", "no-store");

        // Already played today: no questions again (stops them being shared)
        if (attempt) {
            return res.json({
                dateKey: challenge.dateKey,
                alreadyPlayed: true,
                result: { score: attempt.score, timeMs: attempt.timeMs },
                questions: []
            });
        }

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
            alreadyPlayed: false,
            total: questions.length,
            questions
        });

    } catch (error) {

        console.error("Challenge today error:", error);

        res.status(500).json({ message: "Unable to load today's challenge." });

    }

});

module.exports = router;
