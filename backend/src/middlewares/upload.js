const multer = require('multer');

// Memory storage for multer since we upload to R2
const storage = multer.memoryStorage();
const upload = multer({ storage });

module.exports = upload;
