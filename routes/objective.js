const express = require('express');
const router = express.Router();

const Question = require('../models/Question');


// =====================================================
// OBJECTIVE QUIZ HOME
// =====================================================

router.get('/', async (req, res) => {

    try {

        // Get all different level/section combinations
        const questions = await Question.find({
    type: "objective"
})
    .select('level section subject category')
    .lean();


        // Build levels structure
        const levels = {};


        questions.forEach(question => {

            const levelKey =
                `${question.level} ${question.section}`;


            if (!levels[levelKey]) {

                levels[levelKey] = {
                    level: question.level,
                    section: question.section,
                    subjects: {}
                };

            }


            const subject =
                question.subject;


            if (!levels[levelKey].subjects[subject]) {

                levels[levelKey].subjects[subject] = {

                    name: subject,

                    categories: new Set()

                };

            }


            levels[levelKey]
                .subjects[subject]
                .categories
                .add(question.category);

        });


        // Convert Sets to arrays
        Object.values(levels).forEach(level => {

            Object.values(level.subjects).forEach(subject => {

                subject.categories =
                    Array.from(subject.categories);

            });

        });


        res.render('objectivequizes', {
            levels
        });


    } catch (error) {

        console.error(
            'OBJECTIVE QUIZ ERROR:',
            error
        );


        res.status(500).send(
            'Unable to load objective quizzes.'
        );

    }

});


// =====================================================
// QUESTIONS FOR A CATEGORY
// =====================================================

router.get(
    '/:level/:section/:subject/:category',
    async (req, res) => {

        try {

            const {
                level,
                section,
                subject,
                category
            } = req.params;


            const questions =
                await Question.find({

                    level: Number(level),

                    section: section,

                    subject: subject,

                    category: category

                })
                .sort({ createdAt: 1 })
                .lean();


            if (!questions.length) {

                return res.status(404).send(
                    'No questions found for this category.'
                );

            }


            res.render('objective-questions', {

                questions,

                level,

                section,

                subject,

                category

            });


        } catch (error) {

            console.error(
                'OBJECTIVE QUESTIONS ERROR:',
                error
            );


            res.status(500).send(
                'Unable to load questions.'
            );

        }

    }
);


module.exports = router;