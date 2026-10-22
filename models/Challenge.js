const mongoose = require("mongoose");

// The 10 questions chosen for one day (the same set for everybody)
const DailyChallengeSchema = new mongoose.Schema({

    // "2026-10-21". Unique, so two people opening the page at the same
    // moment can never create two different sets for the same day.
    dateKey: {
        type: String,
        required: true,
        unique: true
    },

    questions: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Question"
        }
    ],

    createdAt: {
        type: Date,
        default: Date.now
    }

});


// One person's result for one day
const ChallengeAttemptSchema = new mongoose.Schema({

    // userId, not username: renaming an account can never orphan these scores
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    dateKey: { type: String, required: true },     // the day played
    weekKey: { type: String, required: true },     // the Monday of that week

    // The user's level when they played (kept here so old points never move boards)
    level: { type: String, required: true },

    score: { type: Number, required: true, min: 0 },

    // total time in milliseconds, used only to break ties
    timeMs: { type: Number, required: true, min: 0 },

    answers: [
        {
            questionId: { type: mongoose.Schema.Types.ObjectId, ref: "Question" },
            given: String,
            correct: Boolean
        }
    ],

    createdAt: {
        type: Date,
        default: Date.now
    }

});

// One attempt per person per day, enforced by the database itself
ChallengeAttemptSchema.index({ userId: 1, dateKey: 1 }, { unique: true });

// Makes the weekly leaderboard fast
ChallengeAttemptSchema.index({ weekKey: 1, level: 1 });

module.exports = {
    DailyChallenge: mongoose.model("DailyChallenge", DailyChallengeSchema),
    ChallengeAttempt: mongoose.model("ChallengeAttempt", ChallengeAttemptSchema)
};
