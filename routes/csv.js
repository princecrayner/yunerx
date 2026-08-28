const express = require('express');
const router = express.Router();

const { parse } = require('csv-parse/sync');

const csvUpload = require('../middleware/csvUpload');
const Question = require('../models/Question');


// =====================================================
// SHOW CSV UPLOAD PAGE
// =====================================================

router.get('/upload-csv', (req, res) => {

    res.render('upload-csv', {
        error: null,
        errors: [],
        success: null,
        count: 0
    });

});


// =====================================================
// UPLOAD CSV
// =====================================================

router.post(
    '/upload-csv',

    csvUpload.single('csvFile'),

    async (req, res) => {

        try {

            // =================================================
            // 1. CHECK FILE
            // =================================================

            if (!req.file) {

                return res.status(400).render('upload-csv', {

                    error: 'Please select a CSV file.',

                    errors: [],

                    success: null,

                    count: 0

                });

            }


            console.log('=================================');
            console.log('CSV FILE RECEIVED');
            console.log('=================================');

            console.log({
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size
            });


            // =================================================
            // 2. CHECK EXTENSION
            // =================================================

            if (
                !req.file.originalname
                    .toLowerCase()
                    .endsWith('.csv')
            ) {

                return res.status(400).render('upload-csv', {

                    error: 'The uploaded file must have a .csv extension.',

                    errors: [],

                    success: null,

                    count: 0

                });

            }


            // =================================================
            // 3. CHECK FILE CONTENT
            // =================================================

            const csvText =
                req.file.buffer.toString('utf8');


            console.log('CSV TEXT PREVIEW:');
            console.log(
                csvText.substring(0, 500)
            );


            // =================================================
            // 4. MAKE SURE IT DOESN'T LOOK LIKE A PDF
            // =================================================

            const firstBytes =
                req.file.buffer
                    .subarray(0, 10)
                    .toString('ascii');


            if (firstBytes.startsWith('%PDF')) {

                return res.status(400).render('upload-csv', {

                    error:
                        'This file is a PDF, not a CSV. Please select an actual CSV file.',

                    errors: [],

                    success: null,

                    count: 0

                });

            }


            // =================================================
            // 5. PARSE CSV
            // =================================================

            let rows;

            try {

                rows = parse(csvText, {

                    columns: true,

                    skip_empty_lines: true,

                    bom: true,

                    trim: true,

                    relax_quotes: false

                });

            } catch (parseError) {

                console.error(
                    'CSV PARSE ERROR:',
                    parseError
                );

                return res.status(400).render('upload-csv', {

                    error:
                        `CSV formatting error: ${parseError.message}`,

                    errors: [],

                    success: null,

                    count: 0

                });

            }


            // =================================================
            // 6. CHECK EMPTY CSV
            // =================================================

            if (!rows.length) {

                return res.status(400).render('upload-csv', {

                    error:
                        'The CSV file contains no questions.',

                    errors: [],

                    success: null,

                    count: 0

                });

            }


            // =================================================
            // 7. REQUIRED HEADERS
            // =================================================

            const requiredHeaders = [

                'level',
                'section',
                'subject',
                'category',
                'question',
                'optionA',
                'optionB',
                'optionC',
                'optionD',
                'answer',
                'explanation'

            ];


            const actualHeaders =
                Object.keys(rows[0]);


            console.log('CSV HEADERS:');
            console.log(actualHeaders);


            const missingHeaders =
                requiredHeaders.filter(
                    header =>
                        !actualHeaders.includes(header)
                );


            if (missingHeaders.length) {

                return res.status(400).render('upload-csv', {

                    error:
                        'CSV is missing required columns.',

                    errors: missingHeaders.map(
                        header =>
                            `Missing column: ${header}`
                    ),

                    success: null,

                    count: 0

                });

            }


            // =================================================
            // 8. VALIDATE QUESTIONS
            // =================================================

            const questions = [];

            const errors = [];


            rows.forEach((row, index) => {

                const rowNumber = index + 2;


                const level =
                    Number(
                        String(
                            row.level || ''
                        ).trim()
                    );


                const section =
                    String(
                        row.section || ''
                    ).trim();


                const subject =
                    String(
                        row.subject || ''
                    ).trim();


                const category =
                    String(
                        row.category || ''
                    ).trim();


                const question =
                    String(
                        row.question || ''
                    ).trim();


                const optionA =
                    String(
                        row.optionA || ''
                    ).trim();


                const optionB =
                    String(
                        row.optionB || ''
                    ).trim();


                const optionC =
                    String(
                        row.optionC || ''
                    ).trim();


                const optionD =
                    String(
                        row.optionD || ''
                    ).trim();


                const answer =
                    String(
                        row.answer || ''
                    )
                    .trim()
                    .toUpperCase();


                const explanation =
                    String(
                        row.explanation || ''
                    ).trim();


                // -----------------------------------------
                // LEVEL
                // -----------------------------------------

                if (
                    ![100, 200, 300]
                        .includes(level)
                ) {

                    errors.push(
                        `Row ${rowNumber}: level must be 100, 200 or 300.`
                    );

                }


                // -----------------------------------------
                // REQUIRED TEXT
                // -----------------------------------------

                if (!section) {

                    errors.push(
                        `Row ${rowNumber}: section is required.`
                    );

                }


                if (!subject) {

                    errors.push(
                        `Row ${rowNumber}: subject is required.`
                    );

                }


                if (!category) {

                    errors.push(
                        `Row ${rowNumber}: category is required.`
                    );

                }


                if (!question) {

                    errors.push(
                        `Row ${rowNumber}: question is required.`
                    );

                }


                // -----------------------------------------
                // OPTIONS
                // -----------------------------------------

                if (!optionA) {

                    errors.push(
                        `Row ${rowNumber}: optionA is required.`
                    );

                }


                if (!optionB) {

                    errors.push(
                        `Row ${rowNumber}: optionB is required.`
                    );

                }


                if (!optionC) {

                    errors.push(
                        `Row ${rowNumber}: optionC is required.`
                    );

                }


                if (!optionD) {

                    errors.push(
                        `Row ${rowNumber}: optionD is required.`
                    );

                }


                // -----------------------------------------
                // ANSWER
                // -----------------------------------------

                if (
                    !['A', 'B', 'C', 'D']
                        .includes(answer)
                ) {

                    errors.push(
                        `Row ${rowNumber}: answer must be A, B, C or D.`
                    );

                }


                // -----------------------------------------
                // ONLY ADD VALID QUESTIONS
                // -----------------------------------------

                if (

                    [100, 200, 300]
                        .includes(level)

                    && section

                    && subject

                    && category

                    && question

                    && optionA

                    && optionB

                    && optionC

                    && optionD

                    && ['A', 'B', 'C', 'D']
                        .includes(answer)

                ) {

                    questions.push({

    type: "objective",

    level,
    section,
    subject,
    category,
    question,

    options: {
        A: optionA,
        B: optionB,
        C: optionC,
        D: optionD
    },

    answer,
    explanation

});

                }

            });


            // =================================================
            // 9. STOP IF VALIDATION FAILED
            // =================================================

            if (errors.length) {

                console.log(
                    'CSV VALIDATION ERRORS:'
                );

                console.log(errors);


                return res.status(400).render(
                    'upload-csv',
                    {

                        error:
                            'Some questions contain errors.',

                        errors,

                        success: null,

                        count: 0

                    }
                );

            }


            // =================================================
            // 10. SAVE TO MONGODB
            // =================================================

            const inserted =
                await Question.insertMany(
                    questions
                );


            console.log(
                `${inserted.length} questions inserted.`
            );


            // =================================================
            // 11. SUCCESS
            // =================================================

            return res.render(
                'upload-csv',
                {

                    error: null,

                    errors: [],

                    success:
                        `${inserted.length} questions uploaded successfully.`,

                    count:
                        inserted.length

                }
            );


        } catch (error) {

            console.error(
                'CSV UPLOAD ERROR:',
                error
            );


            return res.status(500).render(
                'upload-csv',
                {

                    error:
                        'Something went wrong while uploading the CSV.',

                    errors: [],

                    success: null,

                    count: 0

                }
            );

        }

    }
);



// =====================================================
// DELETE QUESTION
// =====================================================

router.get('/delete-question/:id', async (req, res) => {

    try {

        await Question.findByIdAndDelete(req.params.id);

        res.redirect('/admin');

    } catch (error) {

        console.error('DELETE QUESTION ERROR:', error);

        res.status(500).send(
            'Unable to delete question.'
        );

    }

});


module.exports = router;
