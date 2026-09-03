const express = require('express');
const router = express.Router();

const Question = require('../models/Question');


// =====================================================
// OBJECTIVE QUIZ HOME
// =====================================================

router.get('/', async (req, res) => {

    try {

        const questions = await Question.find({
            type: "objective"
        })
        .select('level section subject category')
        .lean();


        // =================================================
        // BUILD LEVEL STRUCTURE
        // =================================================

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


        // =================================================
        // CONVERT SETS TO ARRAYS
        // =================================================

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
// SHOW QUIZZES INSIDE A CATEGORY
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


            // =================================================
            // FIND ALL QUESTIONS FOR THIS CATEGORY
            // =================================================

            const questions =
                await Question.find({

                    type: "objective",

                    level: Number(level),

                    section: section,

                    subject: subject,

                    category: category

                })
                .select('quiz')
                .lean();


            if (!questions.length) {

                return res.status(404).send(
                    'No quizzes found for this category.'
                );

            }


            // =================================================
            // GET UNIQUE QUIZ NAMES
            // =================================================

            const quizSet = new Set();


            questions.forEach(question => {

                if (question.quiz) {

                    quizSet.add(
                        question.quiz
                    );

                }

            });


            const quizzes =
                Array.from(quizSet);


            if (!quizzes.length) {

                return res.status(404).send(
                    'No quizzes have been created for this category.'
                );

            }


            res.render('objective-quiz-list', {

                level,

                section,

                subject,

                category,

                quizzes

            });


        } catch (error) {

            console.error(
                'QUIZ LIST ERROR:',
                error
            );


            res.status(500).send(
                'Unable to load quizzes.'
            );

        }

    }
);


// =====================================================
// LOAD QUESTIONS FOR ONE SPECIFIC QUIZ
// =====================================================

router.get(
    '/:level/:section/:subject/:category/:quiz',
    async (req, res) => {

        try {

            const {
                level,
                section,
                subject,
                category,
                quiz
            } = req.params;


            // =================================================
            // FIND QUESTIONS FOR THIS EXACT QUIZ
            // =================================================

            const questions =
                await Question.find({

                    type: "objective",

                    level: Number(level),

                    section: section,

                    subject: subject,

                    category: category,

                    quiz: quiz

                })
                .sort({ createdAt: 1 })
                .lean();


            if (!questions.length) {

                return res.status(404).send(
                    'No questions found for this quiz.'
                );

            }


            res.render('objective-questions', {

                questions,

                level,

                section,

                subject,

                category,

                quiz

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
