const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Local uploads directory
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Upload a file to local storage (development) or R2 (production).
 * Returns the file path/URL and the stored file key.
 */
exports.uploadFile = async (fileBuffer, originalName, mimetype) => {
    const fileKey = `${uuidv4()}-${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = path.join(UPLOADS_DIR, fileKey);

    // Use local storage (R2 credentials are placeholder)
    const useR2 = process.env.R2_ACCESS_KEY_ID && process.env.R2_ACCESS_KEY_ID !== 'your_access_key';

    if (useR2) {
        try {
            const { PutObjectCommand } = require('@aws-sdk/client-s3');
            const s3Client = require('../config/s3');
            const params = {
                Bucket: process.env.R2_BUCKET_NAME,
                Key: fileKey,
                Body: fileBuffer,
                ContentType: mimetype,
            };
            await s3Client.send(new PutObjectCommand(params));
            return {
                file_url: `${process.env.R2_ENDPOINT}/${process.env.R2_BUCKET_NAME}/${fileKey}`,
                file_key: fileKey,
                storage: 'r2'
            };
        } catch (err) {
            console.error('R2 upload failed, falling back to local:', err.message);
        }
    }

    // Local file storage
    fs.writeFileSync(filePath, fileBuffer);
    return {
        file_url: `/uploads/${fileKey}`,
        file_key: fileKey,
        storage: 'local'
    };
};

/**
 * Read a file's content (for plagiarism comparison).
 * Supports both local and R2 stored files.
 */
exports.readFileContent = async (fileUrl) => {
    try {
        if (fileUrl.startsWith('/uploads/')) {
            const fileName = fileUrl.replace('/uploads/', '');
            const filePath = path.join(UPLOADS_DIR, fileName);
            if (fs.existsSync(filePath)) {
                return fs.readFileSync(filePath, 'utf-8');
            }
        }
        return null;
    } catch (err) {
        console.error('Failed to read file:', err.message);
        return null;
    }
};

// Keep old export for backward compatibility
exports.uploadFileToR2 = async (fileBuffer, originalName, mimetype) => {
    const result = await exports.uploadFile(fileBuffer, originalName, mimetype);
    return result.file_url;
};
