// routes/messages.js 
const express = require("express");
const router = express.Router();
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");
const Message = require("../models/Message");
const auth = require("../middleware/verifyToken");

// Cloudinary config
cloudinary.config({
  cloud_name: "di6zeyneq",
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

// POST: Upload multiple images in private chat
router.post("/private/image", auth, upload.array("images", 5), async (req, res) => {
  try {
    const { receiverId } = req.body;
    if (!req.files?.length) return res.status(400).json({ message: "No images uploaded" });

    const uploadedImages = await Promise.all(req.files.map(file => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({ folder: "smarttalk" }, (error, result) => {
          if (result) resolve(result.secure_url);
          else reject(error);
        });
        streamifier.createReadStream(file.buffer).pipe(stream);
      });
    }));

    const messages = await Promise.all(uploadedImages.map(async (imageUrl) => {
      const msg = new Message({
        sender: req.userId,
        receiver: receiverId,
        text: "",
        image: imageUrl,
      });
      await msg.save();
      return msg;
    }));

    res.status(201).json({ success: true, messages });
  } catch (err) {
    console.error("Image upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

module.exports = router;