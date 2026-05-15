const mongoose = require("mongoose");

const QuestionSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ["objective", "theory"],
        required: true
    },
    category: {
        type: String,
        default: "General"
    },
    question: String,
    options: [String],
    answer: String
});

module.exports = mongoose.model("Question", QuestionSchema);
