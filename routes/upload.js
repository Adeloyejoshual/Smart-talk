const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Chat = require('../models/Chat');
const authMiddleware = require('../middleware/authMiddleware');
const fs = require('fs');

// Ensure uploads folder exists
const uploadFolder = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadFolder)) {
  fs.mkdirSync(uploadFolder, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, uploadFolder);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Upload file route with auth
router.post('/file', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  try {
    const newMessage = new Chat({
      sender: req.userId,
      receiver: req.body.receiverId,
      fileUrl: `/uploads/${req.file.filename}`,
      content: '', // no text content since it's a file message
    });

    await newMessage.save();
    res.status(201).json({ message: 'File uploaded', data: newMessage });
  } catch (err) {
    res.status(500).json({ message: 'Failed to save file message', error: err.message });
  }
});

module.exports = router;