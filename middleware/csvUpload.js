const multer = require('multer');

const storage = multer.memoryStorage();

const csvUpload = multer({
    storage,

    limits: {
        fileSize: 10 * 1024 * 1024
    },

    fileFilter: (req, file, cb) => {

        const extension = file.originalname
            .toLowerCase()
            .split('.')
            .pop();

        if (extension !== 'csv') {

            return cb(
                new Error('Only CSV files are allowed.')
            );

        }

        cb(null, true);
    }
});

module.exports = csvUpload;