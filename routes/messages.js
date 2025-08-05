const express = require("express");
const router = express.Router();

const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");
const dotenv = require("dotenv");
dotenv.config();

const Message = require("../models/Message");
const auth = require("../middleware/verifyToken");

// ✅ Cloudinary config from .env
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

// ✅ Multer memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ✅ POST /api/messages/group/image - Upload group image to Cloudinary
router.post("/group/image", auth, upload.single("image"), async (req, res) => {
  try {
    const { groupId } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ message: "No image uploaded" });

    // Cloudinary stream upload
    const streamUpload = (buffer) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "smarttalk" },
          (error, result) => {
            if (result) resolve(result);
            else reject(error);
          }
        );
        streamifier.createReadStream(buffer).pipe(stream);
      });
    };

    const result = await streamUpload(file.buffer);

    const message = new Message({
      sender: req.userId,
      group: groupId,
      text: "",
      image: result.secure_url,
    });

    await message.save();
    await message.populate("sender", "username");

    res.status(201).json(message);
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Image upload failed" });
  }
});

module.exports = router;