const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
    {
        type: {
           type: String,
           required: true,
           enum: ['objective', 'theory']
        },

      
        level: {
            type: Number,
            required: true,
            enum: [100, 200, 300]
        },

        section: {
            type: String,
            required: true,
            trim: true
        },

        subject: {
            type: String,
            required: true,
            trim: true
        },

        category: {
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
            A: {
                type: String,
                required: true
            },
            B: {
                type: String,
                required: true
            },
            C: {
                type: String,
                required: true
            },
            D: {
                type: String,
                required: true
            }
        },

        answer: {
            type: String,
            required: true,
            enum: ['A', 'B', 'C', 'D']
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
