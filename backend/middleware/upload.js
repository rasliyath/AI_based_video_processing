const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Use system temp directory or create uploads folder
const uploadsDir = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');

// Ensure directory exists
if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('[Upload] Created directory:', uploadsDir);
  } catch (err) {
    console.error('[Upload] Failed to create directory:', err.message);
  }
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log('[Upload] Saving to:', uploadsDir);
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1E5);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext).replace(/\s+/g, '_');
    
    const filename = `${name}_${timestamp}_${random}${ext}`;
    console.log('[Upload] Generated filename:', filename);
    cb(null, filename);
  }
});

// File filter - accept all video types
const fileFilter = (req, file, cb) => {
  console.log('[Upload] File received:');
  console.log('  - Field:', file.fieldname);
  console.log('  - Original name:', file.originalname);
  console.log('  - MIME type:', file.mimetype);
  console.log('  - Size:', (file.size / 1024 / 1024).toFixed(2), 'MB');

  // Accept all files - filter by extension
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.mpeg', '.3gp', '.flv', '.wmv', '.m4v'];

  if (allowedExts.includes(ext)) {
    console.log('[Upload] ✓ File accepted');
    cb(null, true);
  } else {
    const error = `Unsupported file format: ${ext}. Allowed: ${allowedExts.join(', ')}`;
    console.error('[Upload] ✗', error);
    cb(new Error(error), false);
  }
};

// Create multer instance with generous limits
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024 * 1024, // 100GB - no practical limit
    files: 1
  }
});

// Custom error handling middleware
const uploadErrorHandler = (err, req, res, next) => {
  console.error('[Upload Error]:', err.message);
  
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Max 10GB allowed.' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Only 1 file allowed at a time.' });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  
  next();
};

console.log('[Upload] Configured successfully');
console.log('[Upload] Upload directory:', uploadsDir);
console.log('[Upload] Max file size: 10GB');

module.exports = { upload, uploadErrorHandler };