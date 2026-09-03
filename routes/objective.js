const express = require('express');
const router = express.Router();

const Question = require('../models/Question');


// =====================================================
// OBJECTIVE QUIZ HOME
// Shows ALL subjects alphabetically
// No level, section, or category
// =====================================================

router.get('/', async (req, res) => {

    try {

        const questions = await Question.find({
            type: "objective"
        })
        .select('subject')
        .lean();


        // =================================================
        // GET UNIQUE SUBJECTS
        // =================================================

        const subjectSet = new Set();


        questions.forEach(question => {

            if (question.subject) {

                subjectSet.add(
                    question.subject
                );

            }

        });


        // =================================================
        // CONVERT TO ARRAY AND SORT ALPHABETICALLY
        // =================================================

        const subjects =
            Array.from(subjectSet)
                .sort((a, b) =>
                    a.localeCompare(b)
                );


        res.render('objectivequizes', {

            subjects

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
// SHOW QUIZZES FOR ONE SUBJECT
// =====================================================

router.get(
    '/subject/:subject',
    async (req, res) => {

        try {

            const {
                subject
            } = req.params;


            // =================================================
            // FIND ALL QUESTIONS FOR THIS SUBJECT
            // =================================================

            const questions =
                await Question.find({

                    type: "objective",

                    subject: subject

                })
                .select('quiz')
                .lean();


            if (!questions.length) {

                return res.status(404).send(
                    'No quizzes found for this subject.'
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


            // =================================================
            // CONVERT TO ARRAY
            // =================================================

            const quizzes =
                Array.from(quizSet);


            if (!quizzes.length) {

                return res.status(404).send(
                    'No quizzes have been created for this subject.'
                );

            }


            // =================================================
            // SORT QUIZZES
            // =================================================

            quizzes.sort((a, b) => {

                return a.localeCompare(
                    b,
                    undefined,
                    {
                        numeric: true,
                        sensitivity: 'base'
                    }
                );

            });


            res.render(
                'objective-quiz-list',
                {

                    subject,

                    quizzes

                }
            );


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
    '/subject/:subject/quiz/:quiz',
    async (req, res) => {

        try {

            const {
                subject,
                quiz
            } = req.params;


            // =================================================
            // FIND QUESTIONS FOR THIS EXACT QUIZ
            // =================================================

            const questions =
                await Question.find({

                    type: "objective",

                    subject: subject,

                    quiz: quiz

                })
                .sort({
                    createdAt: 1
                })
                .lean();


            if (!questions.length) {

                return res.status(404).send(
                    'No questions found for this quiz.'
                );

            }


            res.render(
                'objective-questions',
                {

                    questions,

                    subject,

                    quiz

                }
            );


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
