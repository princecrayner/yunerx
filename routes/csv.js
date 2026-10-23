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
            // 7. HEADERS
            // =================================================

            const actualHeaders =
                Object.keys(rows[0]);

            console.log('CSV HEADERS:');
            console.log(actualHeaders);

            // "type" is optional. A missing or blank type means "objective".
            const rowType = (row) =>
                String(row.type || 'objective')
                    .trim()
                    .toLowerCase();

            const hasObjective =
                rows.some((row) => rowType(row) === 'objective');

            const hasFill =
                rows.some((row) => rowType(row) === 'fill');

            const requiredHeaders = ['subject', 'question'];

            if (hasObjective) {
                requiredHeaders.push(
                    'optionA', 'optionB', 'optionC', 'optionD', 'answer'
                );
            }

            if (hasFill) {
                requiredHeaders.push('acceptedAnswers');
            }

            const missingHeaders =
                requiredHeaders.filter(
                    header => !actualHeaders.includes(header)
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

            // The quiz name comes from the upload form, so check it once
            const quiz =
                String(req.body.quiz || '').trim();

            if (!quiz) {
                errors.push('Quiz name is required.');
            }

            rows.forEach((row, index) => {

                const rowNumber = index + 2;

                const type = rowType(row);

                const subject =
                    String(row.subject || '').trim();

                const question =
                    String(row.question || '').trim();

                const explanation =
                    String(row.explanation || '').trim();

                if (!['objective', 'fill'].includes(type)) {

                    errors.push(
                        `Row ${rowNumber}: type must be objective or fill (or left blank).`
                    );

                    return;

                }

                if (!subject) {
                    errors.push(`Row ${rowNumber}: subject is required.`);
                }

                if (!question) {
                    errors.push(`Row ${rowNumber}: question is required.`);
                }


                // ---------- FILL-IN ----------

                if (type === 'fill') {

                    // Several accepted answers are separated with |   (for example: 15|fifteen)
                    const acceptedAnswers =
                        String(row.acceptedAnswers || '')
                            .split('|')
                            .map((a) => a.trim())
                            .filter(Boolean);

                    if (!acceptedAnswers.length) {

                        errors.push(
                            `Row ${rowNumber}: acceptedAnswers is required for fill-in questions (separate several with |).`
                        );

                    }

                    if (subject && question && acceptedAnswers.length) {

                        questions.push({
                            type: 'fill',
                            subject,
                            quiz,
                            question,
                            acceptedAnswers,
                            explanation
                        });

                    }

                    return;

                }


                // ---------- OBJECTIVE ----------

                const options = {
                    A: String(row.optionA || '').trim(),
                    B: String(row.optionB || '').trim(),
                    C: String(row.optionC || '').trim(),
                    D: String(row.optionD || '').trim()
                };

                const answer =
                    String(row.answer || '')
                        .trim()
                        .toUpperCase();

                ['A', 'B', 'C', 'D'].forEach((letter) => {

                    if (!options[letter]) {

                        errors.push(
                            `Row ${rowNumber}: option${letter} is required.`
                        );

                    }

                });

                if (!['A', 'B', 'C', 'D'].includes(answer)) {

                    errors.push(
                        `Row ${rowNumber}: answer must be A, B, C or D.`
                    );

                }

                if (
                    subject &&
                    question &&
                    Object.values(options).every(Boolean) &&
                    ['A', 'B', 'C', 'D'].includes(answer)
                ) {

                    questions.push({
                        type: 'objective',
                        subject,
                        quiz,
                        question,
                        options,
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




module.exports = router;
