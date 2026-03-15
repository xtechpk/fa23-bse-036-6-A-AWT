const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const ApiError = require('../utils/ApiError');

const chatAllowedMimePatterns = [
  /^image\//i,
  /^video\//i,
  /^application\/pdf$/i,
  /^application\/msword$/i,
  /^application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document$/i,
  /^application\/vnd\.ms-excel$/i,
  /^application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet$/i,
  /^application\/vnd\.ms-powerpoint$/i,
  /^application\/vnd\.openxmlformats-officedocument\.presentationml\.presentation$/i,
  /^text\/plain$/i,
];

const avatarAllowedMimePatterns = [/^image\//i];

const ensureDirectory = (folderName) => {
  const directory = path.join(__dirname, `../../public/uploads/${folderName}`);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  return directory;
};

const isAllowedMimeType = (mimeType = '', patterns = []) =>
  patterns.some((pattern) => pattern.test(String(mimeType).trim()));

const createUploader = ({ folderName, allowedMimePatterns, maxFiles, maxFileSize }) => {
  const uploadDirectory = ensureDirectory(folderName);

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadDirectory);
    },
    filename: (_req, file, cb) => {
      const timestamp = Date.now();
      const randomSuffix = crypto.randomUUID();
      const sanitizedOriginal = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${timestamp}-${randomSuffix}-${sanitizedOriginal}`);
    },
  });

  return multer({
    storage,
    limits: {
      fileSize: maxFileSize,
      files: maxFiles,
    },
    fileFilter: (_req, file, cb) => {
      if (!isAllowedMimeType(file.mimetype, allowedMimePatterns)) {
        return cb(new ApiError(400, `Unsupported file type: ${file.mimetype}`));
      }

      return cb(null, true);
    },
  });
};

const chatUploader = createUploader({
  folderName: 'chat',
  allowedMimePatterns: chatAllowedMimePatterns,
  maxFiles: 10,
  maxFileSize: 100 * 1024 * 1024,
});

const avatarUploader = createUploader({
  folderName: 'avatars',
  allowedMimePatterns: avatarAllowedMimePatterns,
  maxFiles: 1,
  maxFileSize: 10 * 1024 * 1024,
});

const uploadChatAttachments = (req, res, next) => {
  chatUploader.array('files', 10)(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error instanceof ApiError) {
      return next(error);
    }

    if (error.code === 'LIMIT_FILE_SIZE') {
      return next(new ApiError(400, 'Each file must be less than or equal to 100MB'));
    }

    if (error.code === 'LIMIT_FILE_COUNT') {
      return next(new ApiError(400, 'You can upload up to 10 files at a time'));
    }

    return next(new ApiError(400, error.message || 'File upload failed'));
  });
};

const uploadAvatar = (req, res, next) => {
  avatarUploader.single('file')(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error instanceof ApiError) {
      return next(error);
    }

    if (error.code === 'LIMIT_FILE_SIZE') {
      return next(new ApiError(400, 'Avatar file must be less than or equal to 10MB'));
    }

    if (error.code === 'LIMIT_FILE_COUNT') {
      return next(new ApiError(400, 'Only one avatar file can be uploaded at a time'));
    }

    return next(new ApiError(400, error.message || 'Avatar upload failed'));
  });
};

module.exports = {
  uploadChatAttachments,
  uploadAvatar,
};
