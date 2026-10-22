const mongoose = require('mongoose');

// Objective questions need options and a letter answer.
// Fill-in questions need a list of accepted answers instead.
const isObjective = function () {
    return this.type === 'objective';
};

const isFill = function () {
    return this.type === 'fill';
};

const questionSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            required: true,
            enum: ['objective', 'fill', 'theory']
        },

        subject: {
            type: String,
            required: true,
            trim: true
        },

        quiz: {
            type: String,
            required: true,
            trim: true
        },

        question: {
            type: String,
            required: true,
            trim: true
        },

        options: {
            A: { type: String, required: isObjective },
            B: { type: String, required: isObjective },
            C: { type: String, required: isObjective },
            D: { type: String, required: isObjective }
        },

        answer: {
            type: String,
            required: isObjective,
            enum: ['A', 'B', 'C', 'D']
        },

        // Fill-in only. Examples: ["photosynthesis"], ["15", "fifteen"]
        acceptedAnswers: {
            type: [String],
            default: undefined,
            required: isFill,
            validate: {
                validator: function (list) {

                    if (this.type !== 'fill') {
                        return true;
                    }

                    return Array.isArray(list) &&
                           list.length > 0 &&
                           list.every((a) => String(a).trim() !== '');

                },
                message: 'A fill-in question needs at least one accepted answer.'
            }
        },

        explanation: {
            type: String,
            default: ''
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('Question', questionSchema);
